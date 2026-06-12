/**
 * PasteHelper - MAIN World Script
 * Handles clipboard operations and paste in Google Docs and similar editors
 * Must run in MAIN world to access native clipboard API
 */

(function () {
    'use strict';

    console.log('[PasteHelper] MAIN world script loaded');

    // Flag for execCommand override
    let pasteOverrideActive = false;
    let pasteData: { text: string; html?: string } | null = null;

    // Listen for messages from content script
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        const { type, data } = event.data || {};

        switch (type) {
            case 'SMART_TEXT_EXPANDER_PASTE':
                handlePasteRequest();
                break;

            case 'SMART_TEXT_EXPANDER_SET_PASTE_DATA':
                pasteData = data;
                pasteOverrideActive = true;
                break;

            case 'SMART_TEXT_EXPANDER_CLEAR_PASTE_DATA':
                pasteData = null;
                pasteOverrideActive = false;
                break;
        }
    });

    /**
     * Handle paste request from content script
     */
    function handlePasteRequest() {
        if (!pasteData) {
            console.warn('[PasteHelper] No paste data available');
            return;
        }

        // Try to paste via clipboard API
        if (navigator.clipboard && pasteData.text) {
            navigator.clipboard.writeText(pasteData.text)
                .then(() => {
                    // Execute paste command
                    document.execCommand('paste');
                })
                .catch((err) => {
                    console.error('[PasteHelper] Clipboard write failed:', err);
                    fallbackPaste();
                });
        } else {
            fallbackPaste();
        }
    }

    /**
     * Fallback paste method
     */
    function fallbackPaste() {
        if (!pasteData) return;

        // Try insertText
        const success = document.execCommand('insertText', false, pasteData.text);

        if (!success) {
            // Dispatch synthetic input event
            const activeEl = document.activeElement as HTMLElement;
            if (activeEl) {
                const inputEvent = new InputEvent('beforeinput', {
                    inputType: 'insertText',
                    data: pasteData.text,
                    bubbles: true,
                    cancelable: true,
                });
                activeEl.dispatchEvent(inputEvent);
            }
        }

        // Notify completion
        window.postMessage({
            type: 'SMART_TEXT_EXPANDER_PASTE_COMPLETE',
            success: true,
        }, '*');
    }

    /**
     * Override paste event for clipboard data injection
     */
    document.addEventListener('paste', (event) => {
        if (!pasteOverrideActive || !pasteData) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        // Get clipboard data
        const clipboardData = event.clipboardData;
        if (!clipboardData) return;

        // We can't directly set clipboard data, but we can try insertText
        fallbackPaste();

        // Clear override
        pasteData = null;
        pasteOverrideActive = false;
    }, true);

    /**
     * Override execCommand for paste interception
     */
    const originalExecCommand = document.execCommand.bind(document);

    document.execCommand = function (command: string, showUI?: boolean, value?: string): boolean {
        if (command.toLowerCase() === 'paste' && pasteOverrideActive && pasteData) {
            // Instead of paste, do insertText with our data
            const result = originalExecCommand('insertText', false, pasteData.text);

            // Clear after use
            pasteData = null;
            pasteOverrideActive = false;

            return result;
        }

        return originalExecCommand(command, showUI, value);
    };

    // Expose API for debugging
    (window as any).__PasteHelper = {
        setPasteData: (data: { text: string; html?: string }) => {
            pasteData = data;
            pasteOverrideActive = true;
        },
        clearPasteData: () => {
            pasteData = null;
            pasteOverrideActive = false;
        },
    };

})();
