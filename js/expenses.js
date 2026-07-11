/**
 * @file js/expenses.js
 * @description Modularized logic for Smart Expense Tracker. Manages state, Firebase listeners, UI display, filtering, and inline updates.
 */

// Initialize Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC3pnVKpMYszW9XCEXkeOqIkAQUHXYdMRI",
    authDomain: "d-data-storage-399801.firebaseapp.com",
    projectId: "d-data-storage-399801",
    storageBucket: "d-data-storage-399801.appspot.com",
    messagingSenderId: "515303559494",
    appId: "1:515303559494:web:46cece8a07ce607aec9547",
    measurementId: "G-XZHYK7WP4R"
};

const app = firebase.initializeApp(firebaseConfig);
const database = app.database();
const auth = firebase.auth();
const ADMIN_UID = "CF4g7aQ7WFPK6kOEMHxxbMXD9mp2";

// State variables
let allExpenses = [ ];
let allIncome = [ ];
let filteredExpenses = [ ];
let filteredIncome = [ ];
let isEditing = false;
let editingExpense = null;

const searchInput = document.getElementById('searchInput');
const timeFilter = document.getElementById('timeFilter');
const viewSelect = document.getElementById('viewSelect');
const addSection = document.getElementById('addSection');
const expensesSection = document.getElementById('expensesSection');
const incomeSection = document.getElementById('incomeSection');

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    
    // Set default view visually and functionally
    viewSelect.value = 'both';
    handleViewChange();

    fetchExpenses();
    fetchIncome();
    searchInput.addEventListener('input', handleSearch);
    timeFilter.addEventListener('change', applyFilters);
    viewSelect.addEventListener('change', handleViewChange);
});

// Function globally exposed for the edit inline amount feature
window.editAmount = function(element, fullPath, currentAmount) {
    // Prevent replacing an input with another input if already clicked
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
        if (newValue === '') {
            // Removing the value restores to the original un-updated amount
            database.ref(fullPath).child('updatedAmount').remove();
        } else if (parseFloat(newValue) !== currentAmount) {
            // Set the updatedAmount without overwriting the original price
            database.ref(fullPath).update({
                updatedAmount: parseFloat(newValue).toString()
            });
        } else {
            displayIncome(); // redraw if nothing was changed
        }
    };
    
    input.onblur = saveValue;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            displayIncome(); // cancel
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
        allExpenses = [ ];
        snapshot.forEach((childSnapshot) => {
            const expense = childSnapshot.val();
            allExpenses.push({...expense, key: childSnapshot.key});
        });
        applyFilters();
    });
}

function fetchIncome() {
    const dataRoots = ['packets', 'courier_packets', 'ticketing_packets'];
    let tempIncomeStorage = {
        packets: [ ],
        courier_packets: [ ],
        ticketing_packets: [ ]
    };

    dataRoots.forEach(rootNode => {
        const rootRef = database.ref(rootNode);
        rootRef.on('value', (snapshot) => {
            const rootData = snapshot.val();
            const flattenedPackets = [ ];

            if (rootData) {
                // Track currentPath so we can update the correct node location exactly
                const extractPackets = (obj, currentPath) => {
                    Object.keys(obj).forEach(key => {
                        const val = obj[key];
                        if (val && typeof val === 'object') {
                            // Identify if this is a packet (has price/date/recNo) or a folder (Year/Month)
                            if ((val.price !== undefined || val.recNo !== undefined) && val.date !== undefined) {
                                flattenedPackets.push({...val, key: key, sourceRoot: rootNode, fullPath: `${currentPath}/${key}`});
                            } else {
                                // Recursively dig deeper (Year -> Month)
                                extractPackets(val, `${currentPath}/${key}`);
                            }
                        }
                    });
                };
                extractPackets(rootData, rootNode);
            }

            tempIncomeStorage[rootNode] = flattenedPackets;

            // Combine all results
            allIncome = [
                ...tempIncomeStorage.packets,
                ...tempIncomeStorage.courier_packets,
                ...tempIncomeStorage.ticketing_packets
            ];

            applyFilters();
        });
    });
}

function applyTimeFilter(data) {
    const filter = timeFilter.value;
    const currentDate = new Date();
    if (filter === 'all') return data;
    return data.filter(item => {
        const itemDate = new Date(item.date);
        switch (filter) {
            case 'today':
                return itemDate.toDateString() === currentDate.toDateString();
            case 'week':
                const weekAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                return itemDate >= weekAgo;
            case 'month':
                return itemDate.getMonth() === currentDate.getMonth() && itemDate.getFullYear() === currentDate.getFullYear();
            case 'year':
                return itemDate.getFullYear() === currentDate.getFullYear();
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
            // Search uses updatedAmount if available, otherwise regular price
            let activeAmount = item.updatedAmount !== undefined ? item.updatedAmount : item.price;
            let searchFields = [
                item.recNo,
                item.date, 
                activeAmount, 
                item.update, 
                item.receiverName, 
                item.receiverAddress,
                item.senderName
            ];
            // Only add ticketing fields if applicable
            if (item.entryType === 'ticketing') {
                searchFields.push(
                    item.passengerName,
                    item.pnrNumber,
                    item.ticketNumber
                );
                if (item.flightSegments && Array.isArray(item.flightSegments)) {
                   item.flightSegments.forEach(seg => {
                       searchFields.push(seg.airline, seg.flightNo, seg.depAirport, seg.arrAirport);
                   });
                }
            }
            return searchFields.some(field => field && field.toString().toLowerCase().includes(keyword));
        } else {
            const searchFields = [item.date, item.price, item.details];
            return searchFields.some(field => field && field.toString().toLowerCase().includes(keyword));
        }
    });
}

function applyFilters() {
    const timeFilteredExpenses = applyTimeFilter(allExpenses);
    const timeFilteredIncome = applyTimeFilter(allIncome);
    filteredExpenses = applySearchFilter(timeFilteredExpenses, false);
    filteredIncome = applySearchFilter(timeFilteredIncome, true);
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
    tbody.innerHTML = '';
    if (filteredExpenses.length === 0) {
        noData.classList.remove('hidden');
        return;
    }
    noData.classList.add('hidden');
    filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    filteredExpenses.forEach(expense => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><button class="edit-btn" onclick="editExpense('${expense.key}')">Edit</button></td>
            <td>${expense.date}</td>
            <td>Rs ${parseFloat(expense.price).toFixed(2)}</td>
            <td>${expense.details}</td>
        `;
        tbody.appendChild(row);
    });
}

function displayIncome() {
    const tbody = document.querySelector('#incomeTable tbody');
    const noData = document.getElementById('incomeNoData');
    tbody.innerHTML = '';
    if (filteredIncome.length === 0) {
        noData.classList.remove('hidden');
        return;
    }
    noData.classList.add('hidden');
    filteredIncome.sort((a, b) => new Date(b.date) - new Date(a.date));
    filteredIncome.forEach(income => {
        const row = document.createElement('tr');
        
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
            // Courier (default)
            reference = income.recNo ? `C-${income.recNo}` : '-';
            name = income.receiverName || income.senderName || '-';
            details = income.update ? `📍 ${income.update}` : (income.receiverAddress || '-');
        }

        // Handling for Updated Amounts
        let hasUpdatedAmount = income.updatedAmount !== undefined && income.updatedAmount !== null;
        let displayAmount = hasUpdatedAmount ? parseFloat(income.updatedAmount) : parseFloat(income.price || 0);
        
        let amountHtml = `<span class="editable-amount ${!hasUpdatedAmount ? 'un-updated' : ''}" title="Click to edit" onclick="editAmount(this, '${income.fullPath}', ${displayAmount})">Rs ${displayAmount.toFixed(2)}</span>`;

        row.innerHTML = `
            <td>${income.date}</td>
            <td>${amountHtml}</td>
            <td>${reference}</td>
            <td>${name}</td>
            <td>${details}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateStats() {
    // Modified Income: uses updatedAmount for income calculation if it exists, otherwise falls back to price
    const modifiedIncomeAmount = filteredIncome.reduce((sum, item) => {
        const amount = (item.updatedAmount !== undefined && item.updatedAmount !== null) ? parseFloat(item.updatedAmount) : parseFloat(item.price || 0);
        return sum + amount;
    }, 0);

    // Unmodified Income: always uses the original price
    const unmodifiedIncomeAmount = filteredIncome.reduce((sum, item) => {
        return sum + parseFloat(item.price || 0);
    }, 0);
    
    const totalExpensesAmount = filteredExpenses.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
    // Balance is calculated as Unmodified Income minus Total Expenses
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
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('expensePrice').value = '';
    document.getElementById('expenseDetails').value = '';
    if (!searchInput.value.trim()) {
        addSection.classList.remove('show');
    }
}

auth.onAuthStateChanged(user => {
    if (user && user.uid === ADMIN_UID) {
        console.log("Admin access verified for expenses page.");
    } else {
        console.log("Access denied. Redirecting to login page...");
        window.location.href = 'index.html';
    }
});

// Expose functions globally for inline HTML event handers
window.addExpense = addExpense;
window.editExpense = editExpense;
