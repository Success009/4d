/**
 * @file js/ui.js
 * @description Controls UI mode switches (Courier, Ticketing, Manifest), theme updates, and entry section toggles.
 */

import { state } from './state.js';
import { displayResults } from './search-display.js';
import { clearInputs } from './form-handlers.js';

/**
 * Disables automatic receipt number generation (triggered when the user clicks or types manually).
 */
export function disableAutoUpdate() {
    if (!state.isAutoUpdateMode) return;
    state.isAutoUpdateMode = false;
    document.getElementById('recNo').classList.remove('auto-update-glow');
}

/**
 * Enables automatic receipt number generation and suggests the next number.
 */
export function enableAutoUpdate() {
    state.isAutoUpdateMode = true;
    suggestNextRecNo();
}

/**
 * Calculates and suggests the next receipt number sequentially based on loaded history.
 */
export function suggestNextRecNo() {
    if (state.currentEditingPacket) {
        disableAutoUpdate();
        return;
    }
    
    if (!state.isAutoUpdateMode) return;

    const relevantPackets = state.allPackets.filter(p => (p.entryType || 'courier') === state.currentMode);
    const maxRecNo = relevantPackets.length > 0 
        ? Math.max(0, ...relevantPackets.map(p => parseInt(p.recNo, 10)).filter(n => !isNaN(n))) 
        : 0;
        
    const recNoInput = document.getElementById('recNo');
    if (recNoInput) {
        recNoInput.value = maxRecNo + 1;
        recNoInput.classList.add('auto-update-glow');
    }
}

/**
 * Updates application context mode.
 * @param {string} mode - Selected category mode ('courier', 'ticketing', 'manifest').
 */
export function setMode(mode) {
    state.currentMode = mode;
    localStorage.setItem('entryMode', mode);
    
    document.getElementById('courierForm').style.display = mode === 'courier' ? 'block' : 'none';
    document.getElementById('ticketingForm').style.display = mode === 'ticketing' ? 'block' : 'none';
    document.getElementById('manifestForm').style.display = mode === 'manifest' ? 'block' : 'none';
    
    document.getElementById('courier-mode-btn').classList.toggle('active', mode === 'courier');
    document.getElementById('ticketing-mode-btn').classList.toggle('active', mode === 'ticketing');
    document.getElementById('manifest-mode-btn').classList.toggle('active', mode === 'manifest');
    document.getElementById('recNoLabel').textContent = mode === 'manifest' ? 'Manifest No:' : 'Rec NO:';
    
    clearInputs(false);
    suggestNextRecNo();
    displayResults();
}

/**
 * Sets application dark/light theme stylesheet variable tokens.
 * @param {string} theme - Theme key ('dark' or 'light').
 */
export function setTheme(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggle) themeToggle.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        if (themeToggle) themeToggle.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    }
}

/**
 * Shows the data entry panel section.
 */
export function showEntrySection() { 
    document.getElementById('entrySection').style.display = 'block'; 
}

/**
 * Hides the data entry panel section.
 */
export function hideEntrySection() { 
    document.getElementById('entrySection').style.display = 'none'; 
}

// Map variables to global scope for native inline callback handlers
window.setMode = setMode;
window.showEntrySection = showEntrySection;
