/**
 * @file js/firebase-config.js
 * @description Manages Firebase Realtime Database connections, user authentication observers, loading logs, and progressive data loaders.
 */

import { state } from './state.js';
import { showAiMessage } from './utils.js';
import { displayResults } from './search-display.js';
import { suggestNextRecNo } from './ui.js';

// firebase credentials configuration matching the live system
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

// Initialize firebase compatibility instances
export const app = firebase.initializeApp(firebaseConfig);
export const database = firebase.database();
export const auth = firebase.auth();

/**
 * Connects Firebase Realtime Database observers to automatically push changes to the active UI table lists.
 */
export function setupRealtimeListeners() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dataRoots = ['packets', 'courier_packets', 'ticketing_packets', 'manifest_packets'];

    dataRoots.forEach(root => {
        const path = `${root}/${year}/${month}`;
        database.ref(path).on('child_added', (snapshot) => {
            const key = snapshot.key;
            if (!state.processedKeys.has(key)) {
                const packet = { ...snapshot.val(), key: key, path: `${path}/${key}` };
                state.allPackets.unshift(packet);
                state.processedKeys.add(key);
                displayResults();
                suggestNextRecNo();
            }
        });
        database.ref(path).on('child_changed', (snapshot) => {
            const key = snapshot.key;
            const index = state.allPackets.findIndex(p => p.key === key);
            if (index > -1) {
                state.allPackets[index] = { ...snapshot.val(), key: key, path: `${path}/${key}` };
                displayResults();
            }
        });
        database.ref(path).on('child_removed', (snapshot) => {
            const key = snapshot.key;
            state.allPackets = state.allPackets.filter(p => p.key !== key);
            state.processedKeys.delete(key);
            displayResults();
            suggestNextRecNo();
        });
    });
}

/**
 * Gradually pulls data from historical monthly database blocks over the past 5 years to maintain blazing-fast initial load times.
 */
export async function progressivelyLoadData() {
    const loadingStatus = document.getElementById('loadingStatus');
    const date = new Date();
    const dataRoots = ['packets', 'courier_packets', 'ticketing_packets', 'manifest_packets'];
    let currentYear = date.getFullYear();
    let currentMonth = date.getMonth() + 1;
    
    const fetchBatch = async (numMonths) => {
        let promises = [];
        for (let i = 0; i < numMonths; i++) {
            for (const root of dataRoots) {
                promises.push(fetchDataForMonth(root, currentYear, String(currentMonth).padStart(2, '0')));
            }
            currentMonth--;
            if (currentMonth === 0) {
                currentMonth = 12;
                currentYear--;
            }
        }
        const packetArrays = await Promise.all(promises);
        const newPackets = packetArrays.flat();
        if (newPackets.length > 0) {
            state.allPackets.push(...newPackets);
            displayResults();
            suggestNextRecNo();
        }
    };
    
    loadingStatus.textContent = 'Loading recent records...';
    await fetchBatch(3);
    loadingStatus.textContent = 'Loading historical records...';
    
    const remainingMonthsToLoad = 61 - 3;
    const BATCH_SIZE = 12;
    
    const loadOlderData = async () => {
        for (let i = 0; i < remainingMonthsToLoad; i += BATCH_SIZE) {
            const monthsInBatch = Math.min(BATCH_SIZE, remainingMonthsToLoad - i);
            await fetchBatch(monthsInBatch);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        loadingStatus.textContent = 'All records loaded.';
        setTimeout(() => { loadingStatus.style.display = 'none'; }, 3000);
    };
    
    setTimeout(loadOlderData, 100);
}

/**
 * Downloads a single month's worth of transactions from the specified data root.
 * @param {string} root - Database table root node.
 * @param {number|string} year - Numerical Year.
 * @param {string} month - Zero-padded Month representation.
 * @returns {Array<Object>} Extracted array of monthly packets.
 */
async function fetchDataForMonth(root, year, month) {
    const dataPath = `${root}/${year}/${month}`;
    const monthPackets = [ ];
    try {
        const snapshot = await database.ref(dataPath).once('value');
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const key = childSnapshot.key;
                if (!state.processedKeys.has(key)) {
                    monthPackets.push({ ...childSnapshot.val(), key: key, path: `${dataPath}/${key}` });
                    state.processedKeys.add(key);
                }
            });
        }
    } catch (error) {
        console.error(`Failed to fetch data from ${dataPath}:`, error);
    }
    return monthPackets;
}
