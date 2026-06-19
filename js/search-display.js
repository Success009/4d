/**
 * @file js/search-display.js
 * @description Processes active searches filtering, total prices calculations, and dynamic record HTML rendering.
 */

import { state } from './state.js';
import { highlightText, formatDuration } from './utils.js';
import { suggestNextRecNo, hideEntrySection, showEntrySection } from './ui.js';

/**
 * Iterates through all child properties of an object to flatten its strings.
 * Used internally for deep search lookups across multiple data types.
 * @param {Object} obj - Target object.
 * @returns {string} Space-concatenated values list.
 */
export function flattenObjectValues(obj) {
    let values = '';
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            values += flattenObjectValues(obj[key]) + ' ';
        } else if (obj[key] !== null && typeof obj[key] !== 'undefined') {
            values += obj[key].toString().toLowerCase() + ' ';
        }
    }
    return values;
}

/**
 * Reads filter queries and re-draws the results lists in real-time.
 */
export function displayResults() {
    let results = state.allPackets.filter(p => (p.entryType || 'courier') === state.currentMode);
    const dateLimit = document.getElementById('dateLimit').value;
    
    if (dateLimit) {
        results = results.filter(packet => packet.date === dateLimit);
    }
    if (state.searchTerm) {
        results = results.filter(packet => {
            const flatPacket = flattenObjectValues(packet);
            return flatPacket.includes(state.searchTerm);
        });
    }
    
    results.sort((a, b) => new Date(b.date) - new Date(a.date) || b.recNo - a.recNo);
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
        const noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'no-results';
        noResultsDiv.textContent = state.searchTerm || dateLimit ? `No results found` : `No ${state.currentMode} records found.`;
        resultsContainer.appendChild(noResultsDiv);
        calculateAndDisplayTotal([ ]);
        calculateAndDisplayTotalPackages([ ]);
        return;
    }
    
    results.forEach((packet) => {
        const packetDiv = document.createElement('div');
        packetDiv.className = 'packet';
        
        if (packet.entryType === 'ticketing') {
            const itineraryHTML = renderItinerary(packet);
            const fareText = packet.fareDetails ? `Base: ${packet.fareDetails.base}, Tax: ${packet.fareDetails.taxes}` : 'N/A';
            packetDiv.innerHTML = `<p class="entry-type-header">TICKET</p><p>Rec NO: ${highlightText(packet.recNo)}</p><p>Date: ${highlightText(packet.date)}</p><p>Price: ${highlightText(packet.price)}</p><p>Passenger Name: ${highlightText(packet.passengerName)}</p><p>PNR: ${highlightText(packet.pnrNumber)} | Ticket: ${highlightText(packet.ticketNumber)}</p><p>Trip: ${highlightText(packet.tripType)} | Fare: ${highlightText(fareText)}</p>${itineraryHTML}<p>Luggage: ${highlightText(packet.luggageWeight)}</p><p>Remarks: ${highlightText(packet.remarks)}</p>`;
        } else if (packet.entryType === 'manifest') {
            packetDiv.innerHTML = `<p class="entry-type-header">MANIFEST</p><p>Manifest No: ${highlightText(packet.recNo)}</p><p>Date: ${highlightText(packet.date)}</p><p>Email: ${highlightText(packet.email)}</p><p>Price: ${highlightText(packet.price)}</p><p>Pack: ${highlightText(packet.pack)}</p><p>Receiver Name: ${highlightText(packet.receiverName)}</p><p>Receiver Country: ${highlightText(packet.receiverCountry)}</p><p>Gateway: ${highlightText(packet.update)}</p>`;
        } else {
            const trackingNumbers = (packet.trackingNumber || '').split(',').filter(tn => tn.trim());
            const trackingLinks = trackingNumbers.map(tn => {
                const tn_trim = tn.trim();
                return tn_trim.startsWith('SG') ? `<a href="https://shipglobal.au/tracking?waybill=${tn_trim}&submit=Track" target="_blank">${highlightText(tn_trim)}</a>` : tn_trim.startsWith('FFC') ? `<a href="https://www.firstflightcanada.com/tracking?waybill=${tn_trim}&submit=Track" target="_blank">${highlightText(tn_trim)}</a>` : `<a href="https://parcelsapp.com/en/tracking/${tn_trim}" target="_blank">${highlightText(tn_trim)}</a>`;
            }).join(', ');
            packetDiv.innerHTML = `<p class="entry-type-header">COURIER</p><p>Rec NO: ${highlightText(packet.recNo)}</p><p>Date: ${highlightText(packet.date)}</p><p>Email: ${highlightText(packet.email)}</p><p>Sender Name: ${highlightText(packet.senderName)}</p><p>Sender Address: ${highlightText(packet.senderAddress)}</p><p>Sender Contact: ${highlightText(packet.senderContact)}</p><p>Weight KG: ${highlightText(packet.weightTicket)}</p><p>Price: ${highlightText(packet.price)}</p><p>Receiver Name: ${highlightText(packet.receiverName)}</p><p>Receiver Address: ${highlightText(packet.receiverAddress)}</p><p>Receiver Contact: ${highlightText(packet.receiverContact)}</p><p>Gateway: ${highlightText(packet.update)}</p><p>Bill Item: ${highlightText(packet.billItem)}</p><p>Tracking Number(s): ${trackingLinks}</p><p>Delivered Date: ${highlightText(packet.deliveredDate)}</p><p>Item: ${highlightText(packet.courierTicket)}</p>`;
        }
        
        const actionsContainer = document.createElement('div');
        actionsContainer.innerHTML = `<button onclick="editPacket('${packet.key}')">Edit</button><button onclick="deletePacket('${packet.key}')" style="background-color: var(--accent-red-alt);">Delete</button><button onclick="copyToClipboard('${packet.key}')">Copy</button><button onclick="copyForPrint('${packet.key}')">Print</button><button onclick="sendMail('${packet.key}')")">Mail</button><button id="billBtn-${packet.key}" onclick="downloadBill('${packet.key}')">Bill</button>`;
        packetDiv.appendChild(actionsContainer);
        resultsContainer.appendChild(packetDiv);
        
        if (packet.entryType === 'manifest') {
            document.getElementById(`billBtn-${packet.key}`).style.display = 'none';
        }
    });
    
    calculateAndDisplayTotal(results);
    calculateAndDisplayTotalPackages(results);
}

/**
 * Searches the master data with active queries.
 */
export function searchData() {
    state.searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    displayResults();
}

/**
 * Clears active queries, restores default view and updates results.
 */
export function clearSearch() {
    document.getElementById('searchInput').value = '';
    state.searchTerm = '';
    document.getElementById('dateLimit').value = '';
    displayResults();
}

/**
 * Triggers full data search and closes input panel sections.
 */
export function handleSearchClick() {
    searchData();
    hideEntrySection();
}

/**
 * Generates structured HTML layouts for multi-segment flight itineraries.
 * @param {Object} packet - Ticketing data record.
 * @returns {string} Formatted HTML output template representation.
 */
export function renderItinerary(packet) {
    if (!packet.flightSegments || packet.flightSegments.length === 0) return '';
    let itineraryHTML = '<div class="itinerary-display">';
    let totalFlightMinutes = 0;
    let totalLayoverMinutes = 0;
    
    packet.flightSegments.forEach((segment, index) => {
        const depDate = new Date(segment.depDateTime);
        const arrDate = new Date(segment.arrDateTime);
        const flightMinutes = !isNaN(depDate) && !isNaN(arrDate) ? (arrDate - depDate) / 60000 : 0;
        totalFlightMinutes += flightMinutes > 0 ? flightMinutes : 0;
        
        itineraryHTML += `<div class="itinerary-segment">✈️ <span>${highlightText(segment.depAirport)} → ${highlightText(segment.arrAirport)}</span> (${highlightText(segment.airline)} ${highlightText(segment.flightNo)})<br>    Aircraft: ${highlightText(segment.aircraft)} | Duration: ${formatDuration(flightMinutes)}</div>`;
        
        if (index < packet.flightSegments.length - 1) {
            const nextDepDate = new Date(packet.flightSegments[index+1].depDateTime);
            const layoverMinutes = !isNaN(arrDate) && !isNaN(nextDepDate) ? (nextDepDate - arrDate) / 60000 : 0;
            totalLayoverMinutes += layoverMinutes > 0 ? layoverMinutes : 0;
            itineraryHTML += `<div class="itinerary-layover">🔄 Layover: ${formatDuration(layoverMinutes)}</div>`;
        }
    });
    
    const firstSegDate = new Date(packet.flightSegments[0].depDateTime);
    const lastSegDate = new Date(packet.flightSegments[packet.flightSegments.length - 1].arrDateTime);
    const totalJourneyMinutes = !isNaN(firstSegDate) && !isNaN(lastSegDate) ? (lastSegDate - firstSegDate) / 60000 : 0;
    
    itineraryHTML += `<div class="itinerary-summary">Total Journey: ${formatDuration(totalJourneyMinutes)} (Flight: ${formatDuration(totalFlightMinutes)}, Layover: ${formatDuration(totalLayoverMinutes)})</div></div>`;
    return itineraryHTML;
}

/**
 * Calculates sum values and prints onto active headers.
 * @param {Array<Object>} displayedPackets - Filtered Array of loaded records.
 */
export function calculateAndDisplayTotal(displayedPackets) {
    const total = displayedPackets.reduce((acc, packet) => acc + (parseFloat(packet.price) || 0), 0);
    const label = state.currentMode === 'manifest' ? `Price for ${state.currentMode}` : `Total Price for ${state.currentMode}`;
    document.getElementById('totalPrice').textContent = `${label}: RS.${total.toFixed(2)}`;
}

/**
 * Calculates manifest packages count and displays.
 * @param {Array<Object>} displayedPackets - Filtered loaded records array.
 */
export function calculateAndDisplayTotalPackages(displayedPackets) {
    const totalPackagesEl = document.getElementById('totalPackages');
    if (!totalPackagesEl) return;
    
    if (state.currentMode === 'manifest') {
        const total = displayedPackets.reduce((acc, packet) => acc + (parseFloat(packet.pack) || 0), 0);
        totalPackagesEl.textContent = `Packages: ${total}`;
    } else {
        totalPackagesEl.textContent = '';
    }
}

// Map variables to global window object
window.clearSearch = clearSearch;
window.handleSearchClick = handleSearchClick;
