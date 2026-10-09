/**
 * @file js/expenses.js
 * @description High-performance modularized logic for Smart Expense Tracker.
 * Implements progressive loading, batched DOM rendering, optimistic inline editing, and strict auth security.
 */

// Initialize Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC3pnVKpMYszW9XCEXkeOqIkAQUHXYdMRI",
    authDomain: "d-data-storage-399801.firebaseapp.com",
    databaseURL: "https://d-data-storage-399801-default-rtdb.firebaseio.com",
    projectId: "d-data-storage-399801",
    storageBucket: "d-data-storage-399801.appspot.com",
    messagingSenderId: "515303559494",
    appId: "1:515303559494:web:f108f881e01ee3ddec9547",
    measurementId: "G-BECRQ4T8BP"
};

const app = firebase.initializeApp(firebaseConfig);
const database = app.database();
const auth = firebase.auth();
const ADMIN_UID = "CF4g7aQ7WFPK6kOEMHxxbMXD9mp2";

// State variables
let allExpenses = [];
let allIncome = [];
const processedIncomeKeys = new Set();
let filteredExpenses = [];
let filteredIncome = [];
let isEditing = false;
let editingExpense = null;

// Virtual chunk rendering state
const INCOME_CHUNK_SIZE = 100;
let displayedIncomeCount = INCOME_CHUNK_SIZE;
let renderDebounceTimer = null;
let searchDebounceTimer = null;

const searchInput = document.getElementById('searchInput');
const timeFilter = document.getElementById('timeFilter');
const viewSelect = document.getElementById('viewSelect');
const addSection = document.getElementById('addSection');
const expensesSection = document.getElementById('expensesSection');
const incomeSection = document.getElementById('incomeSection');

document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    const expenseDateEl = document.getElementById('expenseDate');
    if (expenseDateEl) expenseDateEl.value = today;
    
    // Set default view visually and functionally
    viewSelect.value = 'both';
    handleViewChange();

    fetchExpenses();
    fetchIncomeProgressively();

    searchInput.addEventListener('input', handleSearchDebounced);
    timeFilter.addEventListener('change', applyFilters);
    viewSelect.addEventListener('change', handleViewChange);

        // Infinite scroll for high performance on massive datasets
    const incomeContainer = document.querySelector('#incomeSection .table-container');
    if (incomeContainer) {
        incomeContainer.addEventListener('scroll', handleTableScroll);
    }

    // Configure login submit behaviors
    const loginBtn = document.getElementById('loginButton');
    if (loginBtn) {
        loginBtn.addEventListener('click', performLogin);
    }
    const adminPasswordInput = document.getElementById('adminPassword');
    if (adminPasswordInput) {
        adminPasswordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                performLogin();
            }
        });
    }
});

// Function globally exposed for the edit inline amount feature
window.editAmount = function(element, fullPath, currentAmount) {
    if (element.querySelector('input')) return;

    const input = document.createElement('input');
    input.type = 'number';
    input.value = currentAmount;
    input.step = '0.01';
    input.style.width = '100px';
    input.style.padding = '4px 8px';
    input.style.fontSize = '14px';
    input.style.borderRadius = '5px';
    input.style.border = '2px solid #007bff';
    input.style.boxSizing = 'border-box';
    
    const saveValue = () => {
        const newValue = input.value;
        const matchingIncome = allIncome.find(i => i.fullPath === fullPath);

        if (newValue === '') {
            // Restore original amount
            database.ref(fullPath).child('updatedAmount').remove();
            if (matchingIncome) {
                delete matchingIncome.updatedAmount;
            }
            applyFilters();
        } else if (parseFloat(newValue) !== currentAmount) {
            const updatedStr = parseFloat(newValue).toString();
            database.ref(fullPath).update({
                updatedAmount: updatedStr
            });
            if (matchingIncome) {
                matchingIncome.updatedAmount = updatedStr;
            }
            applyFilters();
        } else {
            displayIncome();
        }
    };
    
    input.onblur = saveValue;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            displayIncome();
        }
    };
    
    const parent = element.parentNode;
    parent.replaceChild(input, element);
    input.focus();
    input.select();
};

function fetchExpenses() {
    const expensesRef = database.ref('expenses');
    expensesRef.on('value', (snapshot) => {
        const expenses = [];
        snapshot.forEach((childSnapshot) => {
            const expense = childSnapshot.val();
            expenses.push({...expense, key: childSnapshot.key});
        });
        allExpenses = expenses;
        scheduleFiltersUpdate();
    });
}

/**
 * Loads recent data first (< 250ms), sets live listeners for current month,
 * and progressively loads older historical months in background.
 */
function fetchIncomeProgressively() {
    const dataRoots = ['packets', 'courier_packets', 'ticketing_packets'];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    // 1. Setup real-time listeners for current month
    dataRoots.forEach(root => {
        const livePath = `${root}/${currentYear}/${currentMonth}`;
        const ref = database.ref(livePath);

        ref.on('child_added', (snap) => {
            const key = snap.key;
            if (!processedIncomeKeys.has(key)) {
                const val = snap.val();
                if (val && typeof val === 'object') {
                    const item = { ...val, key: key, sourceRoot: root, fullPath: `${livePath}/${key}` };
                    processedIncomeKeys.add(key);
                    allIncome.unshift(item);
                    scheduleFiltersUpdate();
                }
            }
        });

        ref.on('child_changed', (snap) => {
            const key = snap.key;
            const idx = allIncome.findIndex(i => i.key === key);
            if (idx > -1) {
                allIncome[idx] = { ...snap.val(), key: key, sourceRoot: root, fullPath: `${livePath}/${key}` };
                scheduleFiltersUpdate();
            }
        });

        ref.on('child_removed', (snap) => {
            const key = snap.key;
            allIncome = allIncome.filter(i => i.key !== key);
            processedIncomeKeys.delete(key);
            scheduleFiltersUpdate();
        });
    });

    // 2. Fetch past 4 months immediately in parallel for near-instant first paint
    let monthsToFetch = [];
    let y = currentYear;
    let m = now.getMonth() + 1;

    for (let i = 0; i < 4; i++) {
        monthsToFetch.push({ year: y, month: String(m).padStart(2, '0') });
        m--;
        if (m === 0) {
            m = 12;
            y--;
        }
    }

    const fetchMonthData = async (root, year, monthStr) => {
        const path = `${root}/${year}/${monthStr}`;
        try {
            const snap = await database.ref(path).once('value');
            const packets = [];
            if (snap.exists()) {
                snap.forEach(child => {
                    const k = child.key;
                    if (!processedIncomeKeys.has(k)) {
                        const val = child.val();
                        if (val && typeof val === 'object') {
                            processedIncomeKeys.add(k);
                            packets.push({ ...val, key: k, sourceRoot: root, fullPath: `${path}/${k}` });
                        }
                    }
                });
            }
            return packets;
        } catch (err) {
            return [];
        }
    };

    const fetchBatch = async (months) => {
        const promises = [];
        for (const mon of months) {
            for (const root of dataRoots) {
                promises.push(fetchMonthData(root, mon.year, mon.month));
            }
        }
        const results = await Promise.all(promises);
        const flattened = results.flat();
        if (flattened.length > 0) {
            allIncome.push(...flattened);
            scheduleFiltersUpdate();
        }
    };

    // Load recent months right away
    fetchBatch(monthsToFetch).then(() => {
        // 3. Progressively load older historical records (up to 4 years back) in background
        const historicalMonths = [];
        for (let i = 0; i < 48; i++) {
            historicalMonths.push({ year: y, month: String(m).padStart(2, '0') });
            m--;
            if (m === 0) {
                m = 12;
                y--;
            }
        }

        const BATCH_CHUNK = 6;
        let index = 0;
        const loadNextHistoricalBatch = async () => {
            if (index >= historicalMonths.length) return;
            const slice = historicalMonths.slice(index, index + BATCH_CHUNK);
            index += BATCH_CHUNK;
            await fetchBatch(slice);
            setTimeout(loadNextHistoricalBatch, 60);
        };
        setTimeout(loadNextHistoricalBatch, 150);
    });
}

function scheduleFiltersUpdate() {
    if (renderDebounceTimer) cancelAnimationFrame(renderDebounceTimer);
    renderDebounceTimer = requestAnimationFrame(applyFilters);
}

function handleSearchDebounced() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(handleSearch, 150);
}

function handleTableScroll(e) {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
        if (displayedIncomeCount < filteredIncome.length) {
            displayedIncomeCount += INCOME_CHUNK_SIZE;
            displayIncome(true);
        }
    }
}

function applyTimeFilter(data) {
    const filter = timeFilter.value;
    if (filter === 'all') return data;

    const currentDate = new Date();
    const curYear = currentDate.getFullYear();
    const curMonth = currentDate.getMonth();
    const curDateStr = currentDate.toISOString().split('T')[0];
    const weekAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    return data.filter(item => {
        if (!item.date) return false;
        if (filter === 'today') {
            return item.date === curDateStr;
        }
        const itemDate = new Date(item.date);
        switch (filter) {
            case 'week':
                return itemDate >= weekAgo;
            case 'month':
                return itemDate.getMonth() === curMonth && itemDate.getFullYear() === curYear;
            case 'year':
                return itemDate.getFullYear() === curYear;
            default:
                return true;
        }
    });
}

function applySearchFilter(data, isIncome = false) {
    const keyword = searchInput.value.toLowerCase().trim();
    if (!keyword) return data;

    return data.filter(item => {
        if (isIncome) {
            const activeAmount = item.updatedAmount !== undefined ? item.updatedAmount : item.price;
            const fields = [
                item.recNo,
                item.date, 
                activeAmount, 
                item.update, 
                item.receiverName, 
                item.receiverAddress,
                item.senderName
            ];
            if (item.entryType === 'ticketing') {
                fields.push(item.passengerName, item.pnrNumber, item.ticketNumber);
                if (item.flightSegments && Array.isArray(item.flightSegments)) {
                    item.flightSegments.forEach(seg => {
                        fields.push(seg.airline, seg.flightNo, seg.depAirport, seg.arrAirport);
                    });
                }
            }
            return fields.some(f => f && f.toString().toLowerCase().includes(keyword));
        } else {
            const fields = [item.date, item.price, item.details];
            return fields.some(f => f && f.toString().toLowerCase().includes(keyword));
        }
    });
}

function applyFilters() {
    const timeFilteredExpenses = applyTimeFilter(allExpenses);
    const timeFilteredIncome = applyTimeFilter(allIncome);
    filteredExpenses = applySearchFilter(timeFilteredExpenses, false);
    filteredIncome = applySearchFilter(timeFilteredIncome, true);
    displayedIncomeCount = INCOME_CHUNK_SIZE;
    displayExpenses();
    displayIncome();
    updateStats();
}

function handleSearch() {
    const hasSearch = searchInput.value.trim().length > 0;
    if (hasSearch && !isEditing) {
        addSection.classList.remove('show');
    } else if (!hasSearch || isEditing) {
        addSection.classList.add('show');
    }
    applyFilters();
}

function displayExpenses() {
    const tbody = document.querySelector('#expensesTable tbody');
    const noData = document.getElementById('expensesNoData');
    if (!tbody) return;

    if (filteredExpenses.length === 0) {
        tbody.innerHTML = '';
        noData.classList.remove('hidden');
        return;
    }
    noData.classList.add('hidden');

    // Fast string comparison
    filteredExpenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const rowsHtml = filteredExpenses.map(expense => `
        <tr>
            <td><button class="edit-btn" onclick="editExpense('${expense.key}')">Edit</button></td>
            <td>${expense.date || '-'}</td>
            <td>Rs ${parseFloat(expense.price || 0).toFixed(2)}</td>
            <td>${expense.details || '-'}</td>
        </tr>
    `).join('');

    tbody.innerHTML = rowsHtml;
}

function displayIncome(isAppending = false) {
    const tbody = document.querySelector('#incomeTable tbody');
    const noData = document.getElementById('incomeNoData');
    if (!tbody) return;

    if (filteredIncome.length === 0) {
        tbody.innerHTML = '';
        noData.classList.remove('hidden');
        return;
    }
    noData.classList.add('hidden');

    // Fast date sorting
    filteredIncome.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const itemsToRender = filteredIncome.slice(0, displayedIncomeCount);

    const rowsHtml = itemsToRender.map(income => {
        let reference = '-';
        let name = '-';
        let details = '-';

        if (income.entryType === 'ticketing') {
            reference = income.pnrNumber || income.ticketNumber || 'Ticket';
            name = income.passengerName || '-';
            if (income.flightSegments && income.flightSegments.length > 0) {
                const firstSegment = income.flightSegments[0];
                const lastSegment = income.flightSegments[income.flightSegments.length - 1];
                details = `✈️ ${firstSegment.depAirport || '?'} → ${lastSegment.arrAirport || '?'}`;
            }
        } else {
            reference = income.recNo ? `C-${income.recNo}` : '-';
            name = income.receiverName || income.senderName || '-';
            details = income.update ? `📍 ${income.update}` : (income.receiverAddress || '-');
        }

        const hasUpdatedAmount = income.updatedAmount !== undefined && income.updatedAmount !== null;
        const displayAmount = hasUpdatedAmount ? parseFloat(income.updatedAmount) : parseFloat(income.price || 0);
        const amountHtml = `<span class="editable-amount ${!hasUpdatedAmount ? 'un-updated' : ''}" title="Click to edit" onclick="editAmount(this, '${income.fullPath}', ${displayAmount})">Rs ${displayAmount.toFixed(2)}</span>`;
        const rowClass = !hasUpdatedAmount ? 'class="un-updated-row"' : '';

        return `
            <tr ${rowClass}>
                <td>${income.date || '-'}</td>
                <td>${amountHtml}</td>
                <td>${reference}</td>
                <td>${name}</td>
                <td>${details}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

function updateStats() {
    let modifiedIncomeAmount = 0;
    let unmodifiedIncomeAmount = 0;

    for (let i = 0; i < filteredIncome.length; i++) {
        const item = filteredIncome[i];
        const orig = parseFloat(item.price || 0);
        const mod = (item.updatedAmount !== undefined && item.updatedAmount !== null) 
            ? parseFloat(item.updatedAmount) 
            : orig;
        unmodifiedIncomeAmount += orig;
        modifiedIncomeAmount += mod;
    }

    let totalExpensesAmount = 0;
    for (let i = 0; i < filteredExpenses.length; i++) {
        totalExpensesAmount += parseFloat(filteredExpenses[i].price || 0);
    }

    const balance = unmodifiedIncomeAmount - totalExpensesAmount;

    document.getElementById('unmodifiedIncome').textContent = `Rs ${unmodifiedIncomeAmount.toFixed(2)}`;
    document.getElementById('modifiedIncome').textContent = `Rs ${modifiedIncomeAmount.toFixed(2)}`;
    document.getElementById('totalExpenses').textContent = `Rs ${totalExpensesAmount.toFixed(2)}`;
    
    const balanceElement = document.getElementById('totalBalance');
    balanceElement.textContent = `Rs ${balance.toFixed(2)}`;
    balanceElement.className = `stat-value ${balance >= 0 ? 'balance-pos' : 'balance-neg'}`;
}

function handleViewChange() {
    const view = viewSelect.value;
    switch (view) {
        case 'expenses':
            expensesSection.classList.remove('hidden');
            incomeSection.classList.add('hidden');
            break;
        case 'income':
            expensesSection.classList.add('hidden');
            incomeSection.classList.remove('hidden');
            break;
        case 'both':
            expensesSection.classList.remove('hidden');
            incomeSection.classList.remove('hidden');
            break;
    }
}

function addExpense() {
    const date = document.getElementById('expenseDate').value;
    const price = document.getElementById('expensePrice').value;
    const details = document.getElementById('expenseDetails').value;
    if (!date || !price || !details) {
        alert('Please fill all fields');
        return;
    }
    const expenseData = {date: date, price: parseFloat(price).toString(), details: details};
    if (isEditing && editingExpense) {
        database.ref(`expenses/${editingExpense.key}`).set(expenseData);
        isEditing = false;
        editingExpense = null;
    } else {
        database.ref('expenses').push(expenseData);
    }
    clearForm();
}

function editExpense(key) {
    const expense = allExpenses.find(exp => exp.key === key);
    if (!expense) return;
    document.getElementById('expenseDate').value = expense.date;
    document.getElementById('expensePrice').value = expense.price;
    document.getElementById('expenseDetails').value = expense.details;
    isEditing = true;
    editingExpense = expense;
    addSection.classList.add('show');
    addSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearForm() {
    const expenseDateEl = document.getElementById('expenseDate');
    if (expenseDateEl) expenseDateEl.value = new Date().toISOString().split('T')[0];
    document.getElementById('expensePrice').value = '';
    document.getElementById('expenseDetails').value = '';
    if (!searchInput.value.trim()) {
        addSection.classList.remove('show');
    }
}

// Authentication handlers
export function performLogin() {
    const adminPasswordInput = document.getElementById('adminPassword');
    const loginError = document.getElementById('loginError');
    const password = adminPasswordInput ? adminPasswordInput.value : '';
    const email = "fourdirection02@gmail.com";

    if (!password) {
        if (loginError) loginError.textContent = 'Password is required.';
        return;
    }

    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => auth.signInWithEmailAndPassword(email, password))
        .catch(error => { 
            if (loginError) loginError.textContent = 'Login failed: Incorrect password.'; 
        });
}

// Strict Authentication Observer
auth.onAuthStateChanged(user => {
    const overlay = document.getElementById('loginOverlay');
    if (user && user.uid === ADMIN_UID) {
        console.log("Admin access verified for expenses page.");
        if (overlay) overlay.classList.remove('visible');
    } else {
        console.log("Access denied. Showing login challenge...");
        if (overlay) overlay.classList.add('visible');
    }
});

// Expose functions globally for inline HTML event handlers
window.performLogin = performLogin;
window.addExpense = addExpense;
window.editExpense = editExpense;
