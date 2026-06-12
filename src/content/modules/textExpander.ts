/**
 * TextExpander - Smart Text Expander
 * Core expansion logic for inserting text into different editor types
 */

import EditorDetector from './editorDetector';
import CursorManager from './cursorManager';
import type { EditorData, Snippet } from '@/lib/types';

interface ExpansionResult {
    success: boolean;
    error?: string;
}

export const TextExpander = {
    /**
     * Expand a snippet in the given element
     */
    async expand(
        element: Element,
        shortcut: string,
        snippet: Snippet
    ): Promise<ExpansionResult> {
        const editorData = EditorDetector.getEditorData(element);

        console.log(`[TextExpander] Expanding "${shortcut}" in ${editorData.editorType}`);

        // Process cursor placeholder
        const { cleanContent, cursorOffset } = CursorManager.findCursorPlaceholder(
            snippet.content
        );

        try {
            // Route to appropriate insertion method
            if (editorData.requiresClipboard || editorData.isGoogleDocs) {
                await this.insertViaClipboard(cleanContent, shortcut.length, element, editorData);
            } else if (editorData.isInput || editorData.isTextarea) {
                await this.insertInStandardInput(cleanContent, shortcut.length, element as HTMLInputElement);
            } else if (editorData.isContentEditable || editorData.isIntegrated) {
                await this.insertInContentEditable(cleanContent, shortcut.length, element, editorData);
            } else {
                // Fallback to standard insertion
                await this.insertInStandardInput(cleanContent, shortcut.length, element as HTMLInputElement);
            }

            // Handle cursor positioning
            if (cursorOffset >= 0) {
                const direction = CursorManager.getTextDirection(element);
                await CursorManager.moveCursor(
                    cursorOffset,
                    element,
                    direction,
                    editorData.isIntegrated,
                    cleanContent.length
                );
            }

            return { success: true };
        } catch (error) {
            console.error('[TextExpander] Expansion failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    },

    /**
     * Insert in standard input/textarea elements
     */
    async insertInStandardInput(
        text: string,
        shortcutLength: number,
        element: HTMLInputElement | HTMLTextAreaElement
    ): Promise<void> {
        const start = element.selectionStart ?? 0;
        const end = element.selectionEnd ?? 0;
        const value = element.value;

        // Calculate new value: remove shortcut, insert expansion
        const beforeShortcut = value.slice(0, start - shortcutLength);
        const afterCursor = value.slice(end);
        const newValue = beforeShortcut + text + afterCursor;

        // Use execCommand for undo stack preservation
        element.focus();
        element.setSelectionRange(start - shortcutLength, end);

        // Try execCommand first (preserves undo)
        const success = document.execCommand('insertText', false, text);

        if (!success) {
            // Fallback: direct value assignment (breaks undo)
            element.value = newValue;
            const newPos = beforeShortcut.length + text.length;
            element.setSelectionRange(newPos, newPos);
        }

        // Dispatch input event
        element.dispatchEvent(new Event('input', { bubbles: true }));
    },

    /**
     * Insert in contenteditable elements
     */
    async insertInContentEditable(
        text: string,
        shortcutLength: number,
        element: Element,
        editorData: EditorData
    ): Promise<void> {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            throw new Error('No selection available');
        }

        // Clear the shortcut first
        await this.clearShortcut(shortcutLength, element, editorData);

        // Insert the text
        const success = document.execCommand('insertText', false, text);

        if (!success) {
            // Fallback: use insertHTML
            document.execCommand('insertHTML', false, this.escapeHtml(text));
        }

        // Dispatch input event
        element.dispatchEvent(new Event('input', { bubbles: true }));
    },

    /**
     * Insert via clipboard (for complex editors like Google Docs, Notion)
     */
    async insertViaClipboard(
        text: string,
        shortcutLength: number,
        element: Element,
        editorData: EditorData
    ): Promise<void> {
        // Request background to handle clipboard
        try {
            // Cache current clipboard
            await chrome.runtime.sendMessage({
                type: 'SET_CLIPBOARD',
                payload: {
                    text,
                    html: this.textToHtml(text),
                }
            });

            // Clear shortcut
            await this.clearShortcut(shortcutLength, element, editorData);

            // Execute paste - this will use the cached clipboard content
            if (editorData.isGoogleDocs) {
                await this.pasteInGoogleDocs(element);
            } else {
                document.execCommand('paste');
            }

            // Restore clipboard after a delay
            setTimeout(() => {
                chrome.runtime.sendMessage({ type: 'RESTORE_CLIPBOARD' }).catch(() => { });
            }, 100);
        } catch (error) {
            console.error('[TextExpander] Clipboard insertion failed:', error);
            throw error;
        }
    },

    /**
     * Clear the shortcut from the current position
     */
    async clearShortcut(
        length: number,
        element: Element,
        editorData: EditorData
    ): Promise<void> {
        // Try selection + delete first
        const selection = window.getSelection();

        if (selection && selection.rangeCount > 0) {
            try {
                const range = selection.getRangeAt(0);

                // Extend selection backwards
                for (let i = 0; i < length; i++) {
                    selection.modify('extend', 'backward', 'character');
                }

                // Delete the selection
                document.execCommand('delete', false);
                return;
            } catch {
                // Fall through to backspace simulation
            }
        }

        // Fallback: simulate backspaces
        await this.simulateBackspaces(length, element);
    },

    /**
     * Simulate backspace key presses
     */
    async simulateBackspaces(count: number, element: Element): Promise<void> {
        for (let i = 0; i < count; i++) {
            const event = new KeyboardEvent('keydown', {
                key: 'Backspace',
                code: 'Backspace',
                keyCode: 8,
                which: 8,
                bubbles: true,
                cancelable: true,
            });

            element.dispatchEvent(event);

            // Also try input event for newer editors
            const inputEvent = new InputEvent('beforeinput', {
                inputType: 'deleteContentBackward',
                bubbles: true,
                cancelable: true,
            });
            element.dispatchEvent(inputEvent);

            // Small delay between backspaces
            await new Promise(resolve => setTimeout(resolve, 5));
        }
    },

    /**
     * Paste in Google Docs using MAIN world script communication
     */
    async pasteInGoogleDocs(element: Element): Promise<void> {
        // Google Docs requires paste in MAIN world
        // Signal to the injected remapper script
        window.postMessage({
            type: 'SMART_TEXT_EXPANDER_PASTE',
            target: 'main',
        }, '*');

        // Also try standard paste command
        await new Promise(resolve => setTimeout(resolve, 50));

        // Trigger keyboard shortcut for paste
        const pasteEvent = new KeyboardEvent('keydown', {
            key: 'v',
            code: 'KeyV',
            keyCode: 86,
            which: 86,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });

        element.dispatchEvent(pasteEvent);
    },

    /**
     * Convert plain text to simple HTML
     */
    textToHtml(text: string): string {
        return this.escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/  /g, '&nbsp; ');
    },

    /**
     * Escape HTML entities
     */
    escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
};

export default TextExpander;
