/**
 * @file js/state.js
 * @description Centralized, reactive application state for the Four Direction Travels and Tours administration system.
 * Holds references to real-time records, active UI selections, search metrics, action history stacks, and API configurations.
 */

export const state = {
    // List of all loaded records/packets from Firebase Realtime Database
    allPackets: [ ],

    // Set of unique keys already processed to prevent duplicate records in the UI list
    processedKeys: new Set(),

    // Current query term entered in the search field
    searchTerm: '',

    // Active mode of transaction ('courier', 'ticketing', 'manifest')
    currentMode: 'courier',

    // Record currently loaded into the form editor, or null if creating a new entry
    currentEditingPacket: null,

    // Auto-increment mode flag for Suggesting Next Receipt/Manifest Numbers
    isAutoUpdateMode: true,

    // Undo action stack to keep track of user modifications (max capacity defined by MAX_HISTORY_SIZE)
    actionHistory: [ ],

    // Maximum history size permitted for the Undo feature
    MAX_HISTORY_SIZE: 10,

    // API Key retrieved from Firebase configuration for Gemini LLM extractions
    geminiApiKey: null,

    // Last processed binary document/image part mapped for the generative model
    lastAnalyzedImagePart: null,

    // Web Speech API recognition controller instance
    recognition: null,

    // Recording status tracker for speech to text commands
    isRecording: false,

    // Unique Identifier for the Admin authentication session
    ADMIN_UID: "CF4g7aQ7WFPK6kOEMHxxbMXD9mp2"
};
