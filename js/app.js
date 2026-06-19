/**
 * @file js/app.js
 * @description Main application controller and event bindings module. Orchestrates state changes, database persistence, editing triggers, and modal handlers.
 */

import { state } from './state.js';
import { toTitleCase, showModal, showAiMessage } from './utils.js';
import { database, auth, setupRealtimeListeners, progressivelyLoadData } from './firebase-config.js';
import { setMode, setTheme, suggestNextRecNo, disableAutoUpdate, enableAutoUpdate, showEntrySection } from './ui.js';
import { clearInputs, populateForm, getFormDataAsObject, getDynamicInputs, addTrackingInput, addFlightSegment, populateDynamicInputs } from './form-handlers.js';
import { logAction, updateUndoButtonState } from './actions.js';
import { searchData, displayResults } from './search-display.js';
import { initializeSpeechRecognition, toggleRecording, sendAiFollowUp } from './ai-voice.js';

// Import distinct action functions that are exposed globally
import './utils.js';
import './ui.js';
import './form-handlers.js';
import './bill.js';
import './actions.js';
import './search-display.js';
import './ai-voice.js';

/**
 * Commits a record transaction directly to the Remote Firebase Database tree.
 * @param {Object} packetData - Structured JSON payload to save.
 * @param {Object|null} oldDataForLog - Previous state of record before modification for historical logs.
 */
async function performSave(packetData, oldDataForLog) {
    const [year, month] = packetData.date.split('-');
    const saveRoot = packetData.entryType === 'courier' ? 'courier_packets' : packetData.entryType === 'ticketing' ? 'ticketing_packets' : 'manifest_packets';
    const savePath = `${saveRoot}/${year}/${month}`;
    
    if (state.currentEditingPacket) {
        const oldPath = state.currentEditingPacket.path;
        const newPath = `${savePath}/${state.currentEditingPacket.key}`;
        const updatedPacket = { ...packetData, key: state.currentEditingPacket.key, path: newPath };
        
        logAction({ type: 'edit', oldData: oldDataForLog, newData: updatedPacket });
        
        if (oldPath !== newPath) {
            const updates = {};
            updates[oldPath] = null;
            updates[newPath] = packetData;
            await database.ref().update(updates);
            state.allPackets = state.allPackets.filter(p => p.key !== state.currentEditingPacket.key);
            state.allPackets.unshift(updatedPacket);
        } else {
            await database.ref(oldPath).update(packetData);
            const index = state.allPackets.findIndex(p => p.key === state.currentEditingPacket.key);
            if (index > -1) {
                state.allPackets[index] = updatedPacket;
            }
        }
    } else {
        const newRecordRef = await database.ref(savePath).push(packetData);
        const newPacket = { ...packetData, key: newRecordRef.key, path: `${savePath}/${newRecordRef.key}` };
        state.allPackets.unshift(newPacket);
        logAction({ type: 'add', addedData: newPacket });
    }
    
    state.currentEditingPacket = null;
    clearInputs(true);
    displayResults();
}

/**
 * Validates active forms input fields and persists transaction details securely.
 */
export async function saveData() {
    const requiredInputs = state.currentMode === 'courier' 
        ? ['recNo', 'senderName', 'senderContact', 'senderAddress', 'price'] 
        : state.currentMode === 'ticketing' 
            ? ['recNo', 'passengerName', 'passengerContact', 'price'] 
            : ['recNo', 'manifestReceiverName', 'receiverCountry', 'price'];
            
    if (requiredInputs.some(id => !document.getElementById(id)?.value.trim())) {
        showModal('Input Required', `Please fill in all required input fields for ${state.currentMode}.`);
        return;
    }
    
    const dateValue = document.getElementById('date').value;
    if (!dateValue) {
        showModal('Input Required', 'Please select a date.');
        return;
    }
    
    let packetData = {
        entryType: state.currentMode,
        recNo: document.getElementById('recNo').value,
        date: dateValue,
        email: document.getElementById('email').value,
        price: document.getElementById('price').value,
    };
    
    if (state.currentMode === 'courier') {
        Object.assign(packetData, {
            senderName: toTitleCase(document.getElementById('senderName').value),
            senderAddress: toTitleCase(document.getElementById('senderAddress').value),
            senderContact: document.getElementById('senderContact').value,
            weightTicket: document.getElementById('weightTicket').value,
            receiverName: toTitleCase(document.getElementById('receiverName').value),
            receiverAddress: toTitleCase(document.getElementById('receiverAddress').value),
            receiverContact: document.getElementById('receiverContact').value,
            update: toTitleCase(document.getElementById('update').value),
            billItem: toTitleCase(document.getElementById('billItem').value),
            trackingNumber: getDynamicInputs('trackingInputs').join(','),
            deliveredDate: document.getElementById('deliveredDate').value,
            courierTicket: toTitleCase(document.getElementById('courierTicket').value)
        });
    } else if (state.currentMode === 'ticketing') {
        Object.assign(packetData, {
            passengerName: document.getElementById('passengerName').value,
            passengerContact: document.getElementById('passengerContact').value,
            pnrNumber: document.getElementById('pnrNumber').value,
            ticketNumber: document.getElementById('ticketNumber').value,
            tripType: document.getElementById('tripType').value,
            fareDetails: { base: document.getElementById('baseFare').value, taxes: document.getElementById('taxes').value },
            flightSegments: window.getFlightSegments ? window.getFlightSegments() : [ ],
            luggageWeight: document.getElementById('luggageWeight').value,
            remarks: document.getElementById('remarks').value
        });
    } else if (state.currentMode === 'manifest') {
        Object.assign(packetData, {
            pack: document.getElementById('pack').value,
            receiverName: toTitleCase(document.getElementById('manifestReceiverName').value),
            receiverCountry: toTitleCase(document.getElementById('receiverCountry').value),
            update: toTitleCase(document.getElementById('manifestGateway').value)
        });
    }
    
    const conflictingPacket = state.allPackets.find(p =>
        (p.entryType || 'courier') === packetData.entryType &&
        p.recNo === packetData.recNo && 
        (!state.currentEditingPacket || p.key !== state.currentEditingPacket.key)
    );
    
    if (conflictingPacket) {
        showModal(
            'Confirm Overwrite', 
            `A packet with ${state.currentMode === 'manifest' ? 'Manifest No.' : 'Rec No.'} '${packetData.recNo}' already exists. Are you sure you want to replace it?`,
            'confirm',
            () => {
                if (state.currentEditingPacket && state.currentEditingPacket.key !== conflictingPacket.key) {
                    const originalPacketToDelete = { ...state.currentEditingPacket };
                    database.ref(originalPacketToDelete.path).remove();
                    state.allPackets = state.allPackets.filter(p => p.key !== originalPacketToDelete.key);
                    logAction({ type: 'delete', deletedData: originalPacketToDelete, reason: `overwrite of RecNo ${conflictingPacket.recNo}` });
                }
                const oldDataToLog = { ...conflictingPacket };
                state.currentEditingPacket = conflictingPacket;
                performSave(packetData, oldDataToLog);
            },
            { isWarning: true }
        );
    } else {
        const oldDataToLog = state.currentEditingPacket ? { ...state.currentEditingPacket } : null;
        performSave(packetData, oldDataToLog);
    }
}

/**
 * Loads a selected record transaction into form fields for active edits.
 * @param {string} key - Database key.
 */
export function editPacket(key) {
    showModal('Confirm Edit', 'Are you sure you want to edit this entry?', 'confirm', () => {
        const packet = state.allPackets.find(p => p.key === key);
        if (!packet) return;
        const packetMode = packet.entryType || 'courier';
        
        setMode(packetMode);
        clearInputs(true);
        state.currentEditingPacket = packet;
        
        document.getElementById('date').value = packet.date || '';
        document.getElementById('recNo').value = packet.recNo || '';
        document.getElementById('email').value = packet.email || '';
        document.getElementById('price').value = packet.price || '';
        
        if (packetMode === 'courier') {
            ['senderName', 'senderAddress', 'senderContact', 'weightTicket', 'receiverName', 'receiverAddress', 'receiverContact', 'update', 'billItem', 'deliveredDate', 'courierTicket'].forEach(key => {
                document.getElementById(key).value = packet[key] || '';
            });
            populateDynamicInputs('trackingInputs', (packet.trackingNumber || '').split(','), addTrackingInput);
        } else if (packetMode === 'ticketing') {
            ['passengerName', 'passengerContact', 'pnrNumber', 'ticketNumber', 'tripType', 'luggageWeight', 'remarks'].forEach(key => {
                document.getElementById(key).value = packet[key] || '';
            });
            if (packet.fareDetails) {
                document.getElementById('baseFare').value = packet.fareDetails.base || '';
                document.getElementById('taxes').value = packet.fareDetails.taxes || '';
            }
            if (packet.flightSegments) {
                const container = document.getElementById('flightSegmentsContainer');
                if (container) container.innerHTML = '';
                packet.flightSegments.forEach(segmentData => addFlightSegment(segmentData));
            }
        } else if (packetMode === 'manifest') {
            document.getElementById('pack').value = packet.pack || '';
            document.getElementById('manifestReceiverName').value = packet.receiverName || '';
            document.getElementById('receiverCountry').value = packet.receiverCountry || '';
            document.getElementById('manifestGateway').value = packet.update || '';
        }
        showEntrySection();
        window.scrollTo(0, 0);
    });
}

/**
 * Triggers standard authentication credentials audits from input values.
 */
export function performLogin() {
    const adminPasswordInput = document.getElementById('adminPassword');
    const loginError = document.getElementById('loginError');
    const password = adminPasswordInput ? adminPasswordInput.value : '';
    const email = "fourdirection02@gmail.com";
    
    if (!password) {
        if (loginError) loginError.textContent = 'Password is required.';
        return;
    }
    
    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(() => auth.signInWithEmailAndPassword(email, password))
        .catch(error => { 
            if (loginError) loginError.textContent = 'Login failed: Incorrect password.'; 
        });
}

/**
 * Core boot-loader method starting all Realtime Sync systems, listeners, and views.
 */
export async function initializeApp() {
    const savedMode = localStorage.getItem('entryMode') || 'courier';
    setMode(savedMode);
    addFlightSegment();
    initializeSpeechRecognition();

    const recNoInput = document.getElementById('recNo');
    if (recNoInput) {
        recNoInput.addEventListener('mousedown', disableAutoUpdate);
        recNoInput.addEventListener('input', disableAutoUpdate);
    }

    const dateLimitInput = document.getElementById('dateLimit');
    if (dateLimitInput) {
        dateLimitInput.addEventListener('change', searchData);
    }
    
    const recordVoiceBtn = document.getElementById('ai-record-btn');
    if (recordVoiceBtn) {
        recordVoiceBtn.addEventListener('click', toggleRecording);
    }
    
    const sendCommandBtn = document.getElementById('ai-send-btn');
    if (sendCommandBtn) {
        sendCommandBtn.addEventListener('click', sendAiFollowUp);
    }
    
    const commandTextarea = document.getElementById('ai-user-input');
    if (commandTextarea) {
        commandTextarea.addEventListener('keydown', (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                sendAiFollowUp();
            }
        });
    }
    
    database.ref('config/geminiApiKey').once('value', (snapshot) => {
        if (snapshot.exists()) {
            state.geminiApiKey = snapshot.val();
            console.log("Gemini API Key loaded.");
        } else {
            console.warn("Gemini API Key not found in Firebase config.");
            showAiMessage("AI features disabled. API key not configured.", "error");
        }
    });

    setupRealtimeListeners();
    progressivelyLoadData();
}

// Bind to window to integrate cleanly with legacy index.html inline click events
window.saveData = saveData;
window.editPacket = editPacket;
window.performLogin = performLogin;

// Monitor User Authentication changes directly
auth.onAuthStateChanged(user => {
    const overlay = document.getElementById('loginOverlay');
    if (user && user.uid === state.ADMIN_UID) {
        console.log("Admin access verified.");
        if (overlay) overlay.classList.remove('visible');
        initializeApp();
    } else {
        console.log("Access denied. Showing login challenge...");
        if (overlay) overlay.classList.add('visible');
    }
});

// Configure login submit behaviors
document.addEventListener('DOMContentLoaded', () => {
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
    
    // Set Theme from cached localStorage profile
    setTheme(localStorage.getItem('theme') || 'light');
});
