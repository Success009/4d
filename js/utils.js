/**
 * @file js/utils.js
 * @description Core utility helper functions including modal helpers, search highlights, currency word conversion, and time duration formatters.
 */

import { state } from './state.js';

/**
 * Converts a string to Title Case.
 * @param {string} str - The original string.
 * @returns {string} The formatted title case string.
 */
export function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Formats a duration in minutes to a readable string (e.g. "1d 2h 30m").
 * @param {number} minutes - Total journey minutes.
 * @returns {string} Readable travel time format.
 */
export function formatDuration(minutes) {
    if (isNaN(minutes) || minutes < 0) return '';
    const d = Math.floor(minutes / (24 * 60));
    const h = Math.floor((minutes % (24 * 60)) / 60);
    const m = Math.round(minutes % 60);
    let result = '';
    if (d > 0) result += `${d}d `;
    if (h > 0) result += `${h}h `;
    if (m > 0 || (d === 0 && h === 0)) result += `${m}m`;
    return result.trim() || '0m';
}

/**
 * Converts numbers into the Nepalese numbering naming system words format.
 * @param {number|string} num - Numerical price.
 * @returns {string} Number formatted in words representing rupees.
 */
export function numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    num = parseFloat(num);
    if (isNaN(num)) return '';
    if (num === 0) return 'Zero';

    function convertLessThanOneThousand(n) {
        if (n === 0) return '';
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convertLessThanOneThousand(n % 100) : '');
    }

    let result = '';
    if (num >= 10000000) { result += convertLessThanOneThousand(Math.floor(num / 10000000)) + ' Crore '; num %= 10000000; }
    if (num >= 100000) { result += convertLessThanOneThousand(Math.floor(num / 100000)) + ' Lakh '; num %= 100000; }
    if (num >= 1000) { result += convertLessThanOneThousand(Math.floor(num / 1000)) + ' Thousand '; num %= 1000; }
    if (num > 0) { result += convertLessThanOneThousand(num); }
    return result.trim();
}

/**
 * Highlights matches from search query term using inline CSS highlighting classes.
 * @param {string|number} text - Target text.
 * @returns {string} HTML content representing text with highlighted search term matches.
 */
export function highlightText(text) {
    if (!state.searchTerm || text === null || typeof text === 'undefined') return text || '';
    const textStr = text.toString();
    const searchStr = state.searchTerm.toLowerCase();
    const lowerText = textStr.toLowerCase();
    if (searchStr === '' || !lowerText.includes(searchStr)) return textStr;
    
    let result = '';
    let lastIndex = 0;
    let index;
    while ((index = lowerText.indexOf(searchStr, lastIndex)) !== -1) {
        result += textStr.substring(lastIndex, index);
        result += `<span class="highlight">${textStr.substring(index, index + searchStr.length)}</span>`;
        lastIndex = index + searchStr.length;
    }
    result += textStr.substring(lastIndex);
    return result;
}

/**
 * Renders an alert or confirm modal on screen.
 * @param {string} title - Modal heading text.
 * @param {string} message - Modal body copy description.
 * @param {string} type - Display type ('alert' or 'confirm').
 * @param {Function} onConfirm - Confirm action callback logic.
 * @param {Object} options - Custom visual styling settings (e.g. isWarning).
 */
export function showModal(title, message, type = 'alert', onConfirm = () => { }, options = {}) {
    const { isWarning = false } = options;
    const overlay = document.getElementById('customModalOverlay');
    const modalContent = overlay.querySelector('.modal-content');
    
    modalContent.classList.toggle('warning-modal', isWarning);
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const okBtn = document.getElementById('modalOkBtn');
    
    confirmBtn.style.display = type === 'confirm' ? 'inline-block' : 'none';
    cancelBtn.style.display = type === 'confirm' ? 'inline-block' : 'none';
    okBtn.style.display = type === 'alert' ? 'inline-block' : 'none';
    overlay.style.display = 'flex';
    
    const closeModal = () => {
        overlay.style.display = 'none';
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        okBtn.onclick = null;
        modalContent.classList.remove('warning-modal');
    };
    
    confirmBtn.onclick = () => { onConfirm(); closeModal(); };
    cancelBtn.onclick = closeModal;
    okBtn.onclick = closeModal;
}

/**
 * Appends a message to the AI Chatbox assistant display.
 * @param {string} message - Text payload to log.
 * @param {string} type - Message author class type ('user', 'ai', 'error', 'info').
 */
export function showAiMessage(message, type) {
    const box = document.getElementById('ai-assistant-box');
    const history = document.getElementById('ai-chat-history');
    const existingInfo = history.querySelector('.info');
    
    if (existingInfo && type !== 'info') {
        existingInfo.remove();
    } else if (type === 'info' && existingInfo) {
        existingInfo.textContent = message;
        return;
    }
    
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${type}`;
    msgEl.textContent = message;
    history.appendChild(msgEl);
    history.scrollTop = history.scrollHeight;
    box.classList.add('visible');
}

/**
 * Dismisses the visible AI assistant chat box.
 */
export function hideAiMessage() {
    document.getElementById('ai-assistant-box').classList.remove('visible');
}

// Bind to window to allow references in native markup inline listeners
window.highlightText = highlightText;
window.hideAiMessage = hideAiMessage;
