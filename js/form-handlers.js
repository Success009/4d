/**
 * @file js/form-handlers.js
 * @description Controls inputs clearing, dynamic segments mapping, tracking entries generation, and values extraction.
 */

import { state } from './state.js';
import { suggestNextRecNo } from './ui.js';

/**
 * Appends a new tracking number text input row to the Courier Tracking container.
 */
export function addTrackingInput() {
    const container = document.getElementById('trackingInputs');
    const div = document.createElement('div');
    div.className = 'dynamic-input-group';
    div.innerHTML = `<input type="text" class="dynamic-input"><button type="button" onclick="removeDynamicInput(this)" style="background-color: var(--accent-red-alt);">-</button>`;
    container.appendChild(div);
}

/**
 * Removes a dynamic input field from the parent container.
 * @param {HTMLButtonElement} button - Trigger element.
 */
export function removeDynamicInput(button) {
    button.parentElement.remove();
}

/**
 * Extracts all populated values from a dynamic input group into an Array.
 * @param {string} containerId - Container DOM element id.
 * @returns {Array<string>} Array of valid values.
 */
export function getDynamicInputs(containerId) {
    const container = document.getElementById(containerId);
    const inputs = container.querySelectorAll('.dynamic-input');
    return Array.from(inputs).map(input => input.value).filter(val => val.trim());
}

/**
 * Appends dynamic flight segments to the Ticketing flight container.
 * @param {Object} [data={}] - Initial segments values data.
 */
export function addFlightSegment(data = {}) {
    const container = document.getElementById('flightSegmentsContainer');
    if (!container) return;
    const segmentCount = container.getElementsByClassName('flight-segment').length;
    const div = document.createElement('div');
    div.className = 'flight-segment';
    div.innerHTML = `
        <h4>Segment ${segmentCount + 1}</h4>
        <div class="segment-row">
            <input type="text" class="segment-airline" placeholder="Airline" value="${data.airline || ''}">
            <input type="text" class="segment-flightNo" placeholder="Flight No." value="${data.flightNo || ''}">
            <input type="text" class="segment-aircraft" placeholder="Aircraft" value="${data.aircraft || ''}">
        </div>
        <div class="segment-row">
            <input type="text" class="segment-depAirport" placeholder="Departure Airport" value="${data.depAirport || ''}">
            <input type="datetime-local" class="segment-depDateTime" title="Departure Date & Time" value="${data.depDateTime || ''}">
        </div>
        <div class="segment-row">
            <input type="text" class="segment-arrAirport" placeholder="Arrival Airport" value="${data.arrAirport || ''}">
            <input type="datetime-local" class="segment-arrDateTime" title="Arrival Date & Time" value="${data.arrDateTime || ''}">
        </div>
        <div class="segment-row">
            <input type="text" class="segment-terminal" placeholder="Terminal" value="${data.terminal || ''}">
            <button type="button" onclick="removeFlightSegment(this)" style="background-color: var(--accent-red-alt); width: 100px;">Remove</button>
        </div>
    `;
    container.appendChild(div);
}

/**
 * Removes a dynamic flight segment row.
 * @param {HTMLButtonElement} button - Trigger element.
 */
export function removeFlightSegment(button) {
    const segmentDiv = button.closest('.flight-segment');
    segmentDiv.remove();
    const container = document.getElementById('flightSegmentsContainer');
    const segments = container.getElementsByClassName('flight-segment');
    Array.from(segments).forEach((segment, index) => {
        segment.querySelector('h4').textContent = `Segment ${index + 1}`;
    });
}

/**
 * Scrapes all dynamic flight segment fields into a structured JSON payload.
 * @returns {Array<Object>} Extracted flight segment payloads.
 */
export function getFlightSegments() {
    const segments = [ ];
    const segmentElements = document.getElementsByClassName('flight-segment');
    for (const segmentEl of segmentElements) {
        segments.push({
            airline: segmentEl.querySelector('.segment-airline').value,
            flightNo: segmentEl.querySelector('.segment-flightNo').value,
            aircraft: segmentEl.querySelector('.segment-aircraft').value,
            depAirport: segmentEl.querySelector('.segment-depAirport').value,
            depDateTime: segmentEl.querySelector('.segment-depDateTime').value,
            arrAirport: segmentEl.querySelector('.segment-arrAirport').value,
            arrDateTime: segmentEl.querySelector('.segment-arrDateTime').value,
            terminal: segmentEl.querySelector('.segment-terminal').value,
        });
    }
    return segments;
}

/**
 * Regenerates lists of dynamic tracking inputs given standard values arrays.
 * @param {string} containerId - Target container id.
 * @param {Array<string>} values - Array of values.
 * @param {Function} addFunction - Function pointer used to append rows.
 */
export function populateDynamicInputs(containerId, values, addFunction) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const addBtnHTML = `<button type="button" onclick="${addFunction.name}()" style="width: 30px; background-color: var(--accent-green);">+</button>`;
    const initialGroupHTML = `<div class="dynamic-input-group"><input type="text" id="trackingNumber" class="dynamic-input">${addBtnHTML}</div>`;
    
    if (!values || values.length === 0 || values.every(v => !v.trim())) {
        container.innerHTML = initialGroupHTML;
        return;
    }
    
    values.forEach((value, index) => {
        const div = document.createElement('div');
        div.className = 'dynamic-input-group';
        const buttonHTML = index === 0 ? addBtnHTML : `<button type="button" onclick="removeDynamicInput(this)" style="background-color: var(--accent-red-alt);">-</button>`;
        div.innerHTML = `<input type="text" class="dynamic-input" value="${value.trim()}"> ${buttonHTML}`;
        container.appendChild(div);
    });
}

/**
 * Purges form inputs to reset active states.
 * @param {boolean} [clearAll=true] - Set to false to retain shared date/receipt structures.
 */
export function clearInputs(clearAll = true) {
    const selectors = [
        '#courierForm input, #courierForm textarea',
        '#ticketingForm input, #ticketingForm textarea, #ticketingForm select',
        '#manifestForm input, #manifestForm textarea'
    ];
    if (clearAll) {
        selectors.push('#entrySection > div > input[type="date"], #entrySection > div > input[type="number"], #entrySection > div > input[type="text"]');
    }
    document.querySelectorAll(selectors.join(', ')).forEach(input => {
        if (input.id !== 'adminEmail') input.value = '';
    });
    
    const trackingCont = document.getElementById('trackingInputs');
    if (trackingCont) {
        trackingCont.innerHTML = `<div class="dynamic-input-group"><input type="text" id="trackingNumber" class="dynamic-input"><button type="button" onclick="addTrackingInput()" style="width: 30px; background-color: var(--accent-green);">+</button></div>`;
    }
    
    const segmentCont = document.getElementById('flightSegmentsContainer');
    if (segmentCont) {
        segmentCont.innerHTML = '';
        addFlightSegment();
    }
    
    if (clearAll) {
        state.currentEditingPacket = null;
        suggestNextRecNo();
    }
}

/**
 * Maps input contents of target form inputs into a JSON payload object.
 * @returns {Object} Represented document form data payload.
 */
export function getFormDataAsObject() {
    const data = {
        entryType: state.currentMode,
        recNo: document.getElementById('recNo').value,
        date: document.getElementById('date').value,
        email: document.getElementById('email').value,
        price: document.getElementById('price').value,
    };
    if (state.currentMode === 'courier') {
        Object.assign(data, {
            senderName: document.getElementById('senderName').value,
            senderAddress: document.getElementById('senderAddress').value,
            senderContact: document.getElementById('senderContact').value,
            weightTicket: document.getElementById('weightTicket').value,
            receiverName: document.getElementById('receiverName').value,
            receiverAddress: document.getElementById('receiverAddress').value,
            receiverContact: document.getElementById('receiverContact').value,
            update: document.getElementById('update').value,
            billItem: document.getElementById('billItem').value,
            trackingNumber: getDynamicInputs('trackingInputs').join(','),
            deliveredDate: document.getElementById('deliveredDate').value,
            courierTicket: document.getElementById('courierTicket').value
        });
    } else {
        Object.assign(data, {
            passengerName: document.getElementById('passengerName').value,
            passengerContact: document.getElementById('passengerContact').value,
            pnrNumber: document.getElementById('pnrNumber').value,
            ticketNumber: document.getElementById('ticketNumber').value,
            tripType: document.getElementById('tripType').value,
            baseFare: document.getElementById('baseFare').value,
            taxes: document.getElementById('taxes').value,
            flightSegments: getFlightSegments(),
            luggageWeight: document.getElementById('luggageWeight').value,
            remarks: document.getElementById('remarks').value
        });
    }
    return data;
}

/**
 * Fills out form inputs programmatically with data payload structures.
 * @param {Object} data - Payload data representing a transaction record.
 */
export function populateForm(data) {
    clearInputs(false);
    for (const key in data) {
        if (key === 'flightSegments') {
            const container = document.getElementById('flightSegmentsContainer');
            if (container) container.innerHTML = '';
            (data.flightSegments || [ ]).forEach(segment => addFlightSegment(segment));
        } else if (key === 'trackingNumber') {
            populateDynamicInputs('trackingInputs', (data.trackingNumber || '').split(','), addTrackingInput);
        } else if (key === 'baseFare' || key === 'taxes') {
            const el = document.getElementById(key);
            if (el) el.value = data[key] || '';
        } else {
            const element = document.getElementById(key);
            if (element) element.value = data[key];
        }
    }
}

// Map variables to window for inline HTML references
window.addTrackingInput = addTrackingInput;
window.removeDynamicInput = removeDynamicInput;
window.addFlightSegment = addFlightSegment;
window.removeFlightSegment = removeFlightSegment;
