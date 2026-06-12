/**
 * Content Script - Smart Text Expander
 * Main entry point for content script functionality
 */

import TypingStream from './modules/typingStream';
import TextExpander from './modules/textExpander';
import EditorDetector from './modules/editorDetector';
import type { Snippet, SnippetMap } from '@/lib/types';

// State
let snippets: SnippetMap = {};
let isEnabled = true;
let settings = {
    triggerKey: 'space',
    showPreview: true,
};

/**
 * Initialize the content script
 */
async function init() {
    console.log('[SmartTextExpander] Content script initializing...');

    // Load snippets and settings
    await loadSnippets();
    await loadSettings();

    // Initialize typing stream
    TypingStream.init();
    TypingStream.setSnippets(snippets);

    // Register shortcut match callback
    TypingStream.onShortcutMatch(handleShortcutMatch);

    // Set up message listener
    setupMessageListener();

    // Setup observer for dynamic editors
    setupEditorObserver();

    // Request MAIN world injection for complex editors if needed
    if (needsMainWorldInjection()) {
        requestMainWorldInjection();
    }

    console.log(`[SmartTextExpander] Ready with ${Object.keys(snippets).length} snippets`);
}

/**
 * Load snippets from storage via background
 */
async function loadSnippets() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SNIPPETS' });
        if (response?.snippets) {
            snippets = response.snippets;
            TypingStream.setSnippets(snippets);
        }
    } catch (error) {
        console.error('[SmartTextExpander] Failed to load snippets:', error);
    }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        if (response?.settings) {
            settings = { ...settings, ...response.settings };
            isEnabled = response.settings.enabled !== false;
        }
    } catch (error) {
        console.error('[SmartTextExpander] Failed to load settings:', error);
    }
}

/**
 * Handle matched shortcut
 */
async function handleShortcutMatch(element: Element, shortcut: string) {
    if (!isEnabled) {
        console.log('[SmartTextExpander] Disabled, ignoring match');
        return;
    }

    const snippet = snippets[shortcut];
    if (!snippet) {
        console.log(`[SmartTextExpander] Snippet not found: ${shortcut}`);
        return;
    }

    console.log(`[SmartTextExpander] Expanding: ${shortcut}`);

    // Evaluate snippet content (handle variables)
    let expandedSnippet: Snippet;

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'EXPAND_SNIPPET',
            payload: {
                shortcut,
                context: {
                    url: window.location.href,
                    title: document.title,
                    selection: window.getSelection()?.toString() || '',
                },
            },
        });

        if (response?.expanded) {
            expandedSnippet = {
                ...snippet,
                content: response.expanded,
            };
        } else {
            expandedSnippet = snippet;
        }
    } catch {
        expandedSnippet = snippet;
    }

    // Perform expansion
    const result = await TextExpander.expand(element, shortcut, expandedSnippet);

    if (!result.success) {
        console.error('[SmartTextExpander] Expansion failed:', result.error);
        // Could show notification here
    }
}

/**
 * Set up message listener for updates from background/popup
 */
function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case 'SNIPPETS_UPDATED':
                snippets = message.payload || {};
                TypingStream.setSnippets(snippets);
                console.log('[SmartTextExpander] Snippets updated');
                break;

            case 'SETTINGS_UPDATED':
                settings = { ...settings, ...message.payload };
                break;

            case 'TOGGLE_ENABLED':
                isEnabled = message.payload;
                console.log(`[SmartTextExpander] ${isEnabled ? 'Enabled' : 'Disabled'}`);
                break;

            case 'PING':
                sendResponse({ pong: true });
                break;
        }

        return true;
    });
}

/**
 * Check if current site needs MAIN world injection
 */
function needsMainWorldInjection(): boolean {
    const hostname = window.location.hostname;

    const sites = [
        'docs.google.com',
        'sheets.google.com',
        'slides.google.com',
        'notion.so',
        'notion.site',
        'figma.com',
    ];

    return sites.some(site => hostname.includes(site));
}

/**
 * Request background to inject MAIN world script
 */
async function requestMainWorldInjection() {
    try {
        await chrome.runtime.sendMessage({ type: 'INJECT_REMAPPER' });
        console.log('[SmartTextExpander] MAIN world script requested');
    } catch (error) {
        console.warn('[SmartTextExpander] Failed to request MAIN world injection:', error);
    }
}

/**
 * Observe DOM for dynamically loaded editors
 */
function setupEditorObserver() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node instanceof Element) {
                    // Check if new editable elements were added
                    const editables = node.querySelectorAll(
                        'input, textarea, [contenteditable="true"]'
                    );

                    if (editables.length > 0 || EditorDetector.isEditable(node)) {
                        // New editor detected - ensure our listeners are attached
                        console.log('[SmartTextExpander] New editable element detected');
                    }
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Also handle window messages from MAIN world
window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data?.type === 'SMART_TEXT_EXPANDER_RESPONSE') {
        console.log('[SmartTextExpander] MAIN world response:', event.data);
    }
});

// Export for potential debugging
(window as any).__SmartTextExpander = {
    snippets: () => snippets,
    isEnabled: () => isEnabled,
    settings: () => settings,
    TypingStream,
    TextExpander,
    EditorDetector,
};
