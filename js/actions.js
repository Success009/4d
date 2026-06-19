/**
 * @file js/actions.js
 * @description Manages transactional processes such as undo logs stack, deleted nodes cleaning, email composition draft launching, and print layouts copying.
 */

import { state } from './state.js';
import { showModal } from './utils.js';
import { database } from './firebase-config.js';
import { clearInputs } from './form-handlers.js';
import { displayResults } from './search-display.js';
import { suggestNextRecNo } from './ui.js';

/**
 * Triggers a standard visual status update on the Undo action button state.
 */
export function updateUndoButtonState() {
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
        undoBtn.disabled = state.actionHistory.length === 0;
    }
}

/**
 * Logs a transactional action into our undo stack structure.
 * @param {Object} action - Action details payload.
 */
export function logAction(action) {
    state.actionHistory.unshift(action);
    if (state.actionHistory.length > state.MAX_HISTORY_SIZE) {
        state.actionHistory.pop();
    }
    updateUndoButtonState();
}

/**
 * Reverts the most recent user action (Add, Edit, Delete).
 */
export async function undoLastAction() {
    if (state.actionHistory.length === 0) return;
    const lastAction = state.actionHistory.shift();
    updateUndoButtonState();
    
    try {
        switch (lastAction.type) {
            case 'add':
                await database.ref(lastAction.addedData.path).remove();
                state.allPackets = state.allPackets.filter(p => p.key !== lastAction.addedData.key);
                break;
            case 'edit':
                await database.ref(lastAction.oldData.path).set(lastAction.oldData);
                const index = state.allPackets.findIndex(p => p.key === lastAction.oldData.key);
                if (index > -1) {
                    state.allPackets[index] = lastAction.oldData;
                } else {
                    state.allPackets = state.allPackets.filter(p => p.key !== lastAction.oldData.key);
                    state.allPackets.unshift(lastAction.oldData);
                }
                break;
            case 'delete':
                await database.ref(lastAction.deletedData.path).set(lastAction.deletedData);
                state.allPackets.unshift(lastAction.deletedData);
                break;
        }
        displayResults();
        showModal('Success', `Undo successful: '${lastAction.type}' operation reversed.`);
    } catch (error) {
        console.error("Undo failed:", error);
        showModal('Error', 'Could not perform undo operation.');
        state.actionHistory.unshift(lastAction);
        updateUndoButtonState();
    }
}

/**
 * Deletes a packet transaction from the remote Database and local arrays.
 * @param {string} key - Database key.
 */
export async function deletePacket(key) {
    showModal('Confirm Deletion', 'Are you sure you want to delete this entry? This action cannot be undone via the normal Undo button.', 'confirm', async () => {
        const packetToDelete = state.allPackets.find(p => p.key === key);
        if (!packetToDelete) return;
        
        logAction({ type: 'delete', deletedData: { ...packetToDelete } });
        await database.ref(packetToDelete.path).remove();
        
        if (state.currentEditingPacket && state.currentEditingPacket.key === key) {
            state.currentEditingPacket = null;
            clearInputs(true);
        }
        state.allPackets = state.allPackets.filter(p => p.key !== key);
        displayResults();
        showModal('Success', 'The entry has been deleted.');
    }, { isWarning: true });
}

/**
 * Copies a complete transaction record details in formatted layout plaintext onto the device Clipboard.
 * @param {string} key - Database key matching transaction.
 */
export function copyToClipboard(key) {
    const packet = state.allPackets.find(p => p.key === key);
    if (!packet) return;
    let packetText = '';
    
    if (packet.entryType === 'ticketing') {
        packetText = `Entry Type: TICKET\nRec NO: ${packet.recNo}\nDate: ${packet.date}\nPrice: ${packet.price}\nPassenger Name: ${packet.passengerName}\nPassenger Contact: ${packet.passengerContact}\nPNR: ${packet.pnrNumber}\nTicket Number: ${packet.ticketNumber}\nTrip Type: ${packet.tripType}\nFare: Base ${packet.fareDetails?.base}, Taxes ${packet.fareDetails?.taxes}\nLuggage: ${packet.luggageWeight}\nRemarks: ${packet.remarks}\n--- Itinerary ---\n${(packet.flightSegments || [ ]).map(s => `    ✈️ ${s.depAirport} -> ${s.arrAirport} on ${s.airline} ${s.flightNo}`).join('\n')}`;
    } else if (packet.entryType === 'manifest') {
        packetText = `Entry Type: MANIFEST\nManifest No: ${packet.recNo}\nDate: ${packet.date}\nEmail: ${packet.email}\nPrice: ${packet.price}\nPack: ${packet.pack}\nReceiver Name: ${packet.receiverName}\nReceiver Country: ${packet.receiverCountry}\nGateway: ${packet.update}`;
    } else {
        packetText = `Entry Type: COURIER\nRec NO: ${packet.recNo}\nDate: ${packet.date}\nEmail: ${packet.email}\nSender Name: ${packet.senderName}\nSender Address: ${packet.senderAddress}\nSender Contact: ${packet.senderContact}\nWeight KG: ${packet.weightTicket}\nPrice: ${packet.price}\nReceiver Name: ${packet.receiverName}\nReceiver Address: ${packet.receiverAddress}\nReceiver Contact: ${packet.receiverContact}\nGateway: ${packet.update}\nBill Item: ${packet.billItem}\nTracking Number: ${packet.trackingNumber}\nDelivered Date: ${packet.deliveredDate}\nItem: ${packet.courierTicket}`;
    }
    
    navigator.clipboard.writeText(packetText.trim()).then(() => showModal('Success', 'Copied to clipboard!'));
}

/**
 * Copies a shorter summary of the transaction record details optimized for labels printing.
 * @param {string} key - Database key.
 */
export function copyForPrint(key) {
    const packet = state.allPackets.find(p => p.key === key);
    if (!packet) return;
    let packetText = '';
    
    if (packet.entryType === 'ticketing') {
        packetText = `Four Direction Travels & Tours - 056-490449\nPassenger: ${packet.passengerName}\nPNR: ${packet.pnrNumber}\nDate: ${packet.date}\n${(packet.flightSegments || [ ]).map(s => `Flight: ${s.airline} ${s.flightNo} from ${s.depAirport} to ${s.arrAirport}`).join('\n')}`;
    } else if (packet.entryType === 'manifest') {
        packetText = `Four Direction - 056-490449\nManifest No: ${packet.recNo}\nDate: ${packet.date}\nReceiver: ${packet.receiverName} (${packet.receiverCountry})\nGateway: ${packet.update}\nPack: ${packet.pack}`;
    } else {
        packetText = `Four Direction - 056-490449\nTracking Number: ${packet.trackingNumber}\n${packet.update}\nDate: ${packet.date}\nSender: ${packet.senderName} (${packet.senderContact})\nAddress: ${packet.senderAddress}\nWeight: ${packet.weightTicket} KG\nReceiver: ${packet.receiverName} (${packet.receiverContact})\nAddress: ${packet.receiverAddress}\nItem: ${packet.courierTicket}`;
    }
    
    navigator.clipboard.writeText(packetText.trim()).then(() => showModal('Success', 'Print-friendly text copied!'));
}

/**
 * Composes and redirects to a pre-filled Gmail draft link matching receipt details.
 * @param {string} key - Database key.
 */
export function sendMail(key) {
    const packet = state.allPackets.find(p => p.key === key);
    if (!packet) return;
    if (!packet.email) {
        showModal("No Email Found", "No email address found for this entry.");
        return;
    }
    
    let subject = '';
    let mailBody = '';
    
    if (packet.entryType === 'ticketing') {
        subject = `Your Flight Itinerary from Four Direction - PNR: ${packet.pnrNumber}`;
        mailBody = `Dear ${packet.passengerName},\n\nPlease find your flight itinerary below:\n\nPNR: ${packet.pnrNumber}\nTicket Number: ${packet.ticketNumber}\n\n${(packet.flightSegments || [ ]).map(s => `Flight: ${s.airline} ${s.flightNo}\nDeparture: ${s.depAirport} at ${new Date(s.depDateTime).toLocaleString()}\nArrival: ${s.arrAirport} at ${new Date(s.arrDateTime).toLocaleString()}\n`).join('\n')}\nThank you for choosing our service.\n\nBest regards,\nFour Direction Travels & Tours\n056-490499 , 9855020449\nBhatpur-10, Hakim Chowk, Chitwan`;
    } else if (packet.entryType === 'manifest') {
        subject = `Your Manifest Details from Four Direction`;
        mailBody = `Dear Customer,\n\nHere are your manifest details:\n\nManifest No: ${packet.recNo}\nDate: ${packet.date}\nReceiver: ${packet.receiverName} in ${packet.receiverCountry}\n\nBest regards,\nFour Direction\n056-490499 , 9855020449\nBhatpur-10, Hakim Chowk, Chitwan`;
    } else {
        const trackingNumbers = (packet.trackingNumber || '').split(',').filter(t => t.trim());
        const trackingInfo = trackingNumbers.map(tn => {
            const tn_trim = tn.trim();
            const link = tn_trim.startsWith('SG') ? `https://shipglobal.au/tracking?waybill=${encodeURIComponent(tn_trim)}&submit=Track` : tn_trim.startsWith('FFC') ? `https://www.firstflightcanada.com/tracking?waybill=${encodeURIComponent(tn_trim)}&submit=Track` : `https://parcelsapp.com/en/tracking/${encodeURIComponent(tn_trim)}`;
            return `\nTracking Number: ${tn_trim}\nTracking Link: ${link}`;
        }).join('\n');
        
        subject = `Your Package Status from Four Direction`;
        mailBody = `Dear Customer,\n\nWe hope this email finds you well.\n\nWe are pleased to inform you that your recent shipment has been processed and assigned the following tracking information:${trackingInfo}\n\nIf you have any queries about your package please do not hesitate to contact us.\n\nBest regards,\nFour Direction Courier\n056-490499 , 9855020449\nBhatpur-10, Hakim Chowk, Chitwan`;
    }
    
    window.open(`https://mail.google.com/mail/u/0/?fs=1&tf=cm&to=${encodeURIComponent(packet.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`, '_blank');
}

// Map references to window for inline call support
window.undoLastAction = undoLastAction;
window.deletePacket = deletePacket;
window.copyToClipboard = copyToClipboard;
window.copyForPrint = copyForPrint;
window.sendMail = sendMail;
