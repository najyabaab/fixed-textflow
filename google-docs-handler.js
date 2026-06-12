/**
 * Google Docs Handler - Dedicated module for Google Docs integration
 * Provides robust text expansion within Google Docs canvas-based editor
 */

(function () {
    'use strict';

    // =========================================
    // CONSTANTS
    // =========================================

    // Stable selectors that are less likely to change with Google updates
    const SELECTORS = {
        eventIframe: '.docs-texteventtarget-iframe',
        kixPage: '.kix-page',
        docsEditor: '.docs-editor',
        appViewEditor: '.kix-appview-editor',
        titleContainer: '.docs-title-input-container',
        titleWidget: '.docs-title-widget, #docs-title-widget, #docs-header',
        contentEditable: '[contenteditable="true"]',
        textbox: '[role="textbox"]'
    };

    // Title-related patterns for detection
    const TITLE_PATTERNS = {
        ids: ['docs-title-inner', 'docs-title-input'],
        classes: ['docs-title-input', 'docs-title-inner'],
        ariaLabels: ['Rename', 'Document title']
    };

    // =========================================
    // EXPANSION LOCK
    // =========================================

    /**
     * Prevents race conditions during expansion
     * Ensures only one expansion happens at a time
     */
    class ExpansionLock {
        constructor() {
            this.isLocked = false;
            this.pendingChars = [];
            this.lockTimeout = null;
        }

        async acquire() {
            if (this.isLocked) {
                return false;
            }
            this.isLocked = true;
            // Safety timeout - release lock after 5 seconds max
            this.lockTimeout = setTimeout(() => this.release(), 5000);
            return true;
        }

        release() {
            this.isLocked = false;
            if (this.lockTimeout) {
                clearTimeout(this.lockTimeout);
                this.lockTimeout = null;
            }
        }

        queueChar(char) {
            if (this.isLocked) {
                this.pendingChars.push(char);
            }
        }

        getPendingChars() {
            const chars = this.pendingChars.slice();
            this.pendingChars = [];
            return chars;
        }

        get locked() {
            return this.isLocked;
        }
    }

    // =========================================
    // GOOGLE DOCS HANDLER
    // =========================================

    const GoogleDocsHandler = {
        expansionLock: new ExpansionLock(),
        initialized: false,
        useClipboard: true, // Prefer clipboard method

        /**
         * Initialize the handler
         */
        init() {
            if (this.initialized) return;
            this.initialized = true;
            console.log('[GoogleDocsHandler] Initialized');
        },

        /**
         * Check if we're in a Google Docs environment
         */
        isGoogleDocsEnv() {
            return window.location.hostname === 'docs.google.com' ||
                document.querySelector(SELECTORS.kixPage) !== null ||
                document.querySelector(SELECTORS.docsEditor) !== null;
        },

        /**
         * Find the correct editor target for keyboard/paste events
         * Uses multiple fallback strategies for robustness
         */
        getEditTarget(retries = 3, delay = 100) {
            return new Promise(async (resolve) => {
                for (let i = 0; i < retries; i++) {
                    const target = this._findEditTarget();
                    if (target) {
                        resolve(target);
                        return;
                    }
                    if (i < retries - 1) {
                        await this._delay(delay);
                    }
                }
                resolve(null);
            });
        },

        /**
         * Internal method to find edit target
         */
        _findEditTarget() {
            // Priority 1: The hidden event target iframe
            const eventIframe = document.querySelector(SELECTORS.eventIframe);
            if (eventIframe) {
                try {
                    if (eventIframe.contentDocument) {
                        const editable = eventIframe.contentDocument.querySelector(SELECTORS.contentEditable);
                        if (editable) return editable;
                    }
                } catch (e) {
                    // Cross-origin access denied - use iframe itself
                }
                return eventIframe;
            }

            // Priority 2: Main editor canvas
            const kixEditor = document.querySelector(SELECTORS.appViewEditor);
            if (kixEditor) return kixEditor;

            // Priority 3: Any contenteditable not in title
            const editables = document.querySelectorAll(SELECTORS.contentEditable);
            for (const el of editables) {
                if (!this.isTitleArea(el) && this._isVisible(el)) {
                    return el;
                }
            }

            // Priority 4: ARIA textbox role
            const textbox = document.querySelector(`${SELECTORS.textbox}:not([aria-label*="title"])`);
            if (textbox && this._isVisible(textbox)) {
                return textbox;
            }

            return null;
        },

        /**
         * Check if an element is the document title area
         */
        isTitleArea(element) {
            if (!element) return false;

            // The hidden event input iframe content is NEVER the title
            const frameEl = element.ownerDocument?.defaultView?.frameElement;
            if (frameEl?.classList?.contains('docs-texteventtarget-iframe')) {
                return false;
            }

            // Check DOM hierarchy
            if (element.closest) {
                const titleParent = element.closest(SELECTORS.titleContainer) ||
                    element.closest(SELECTORS.titleWidget);
                if (titleParent) return true;
            }

            // Check IDs
            const id = element.id || '';
            if (TITLE_PATTERNS.ids.some(p => id === p)) return true;

            // Check classes
            const className = (element.className && typeof element.className === 'string')
                ? element.className : '';
            if (TITLE_PATTERNS.classes.some(p => className.includes(p))) return true;

            // Check ARIA labels
            const ariaLabel = element.getAttribute('aria-label') || '';
            if (TITLE_PATTERNS.ariaLabels.some(p => ariaLabel.includes(p))) return true;

            // Heuristic: Position check (title is at the top)
            if (element.getBoundingClientRect) {
                const rect = element.getBoundingClientRect();
                if (rect.top < 120 && rect.height < 50 && rect.width < 800) {
                    if (!element.closest(SELECTORS.appViewEditor)) {
                        const isInputLike = element.tagName === 'INPUT' ||
                            element.getAttribute('contenteditable') === 'true';
                        if (isInputLike) return true;
                    }
                }
            }

            return false;
        },

        /**
         * Check if element is visible
         */
        _isVisible(element) {
            if (!element) return false;
            return element.offsetParent !== null ||
                element.offsetWidth > 0 ||
                element.offsetHeight > 0;
        },

        /**
         * Delete characters via backspace simulation
         * Used to remove the shortcut text before insertion
         */
        async deleteChars(count) {
            if (count <= 0) return true;

            // Dispatch via injected script if available
            // Use Messaging Bridge
            const success = await this._sendCommand('delete', { count });
            if (success) return true;

            // Fallback: dispatch backspace events directly
            const target = await this.getEditTarget();
            if (!target) {
                console.warn('[GoogleDocsHandler] No edit target for delete');
                return false;
            }

            target.focus();
            await this._delay(30);

            for (let i = 0; i < count; i++) {
                target.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Backspace',
                    code: 'Backspace',
                    keyCode: 8,
                    which: 8,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }));
                await this._delay(5);
            }

            await this._delay(20);
            return true;
        },

        /**
         * Insert text via clipboard (preferred method)
         * Faster and preserves undo stack
         */
        async insertViaClipboard(text, isRichText = false) {
            // Use injected script if available
            // Use Messaging Bridge
            const success = await this._sendCommand('paste', { text, isRichText });
            if (success) return true;

            try {
                // Write to clipboard
                if (isRichText && navigator.clipboard.write) {
                    // Try rich text clipboard
                    const htmlBlob = new Blob([text], { type: 'text/html' });
                    const textBlob = new Blob([this._htmlToPlainText(text)], { type: 'text/plain' });
                    const item = new ClipboardItem({
                        'text/html': htmlBlob,
                        'text/plain': textBlob
                    });
                    await navigator.clipboard.write([item]);
                } else {
                    await navigator.clipboard.writeText(text);
                }

                // Find target and paste
                const target = await this.getEditTarget();
                if (!target) {
                    console.error('[GoogleDocsHandler] No edit target for paste');
                    return false;
                }

                if (this.isTitleArea(target)) {
                    console.warn('[GoogleDocsHandler] Blocking paste into title area');
                    return false;
                }

                target.focus();
                await this._delay(50);

                // Simulate Ctrl+V
                const pasteEvent = new KeyboardEvent('keydown', {
                    key: 'v',
                    code: 'KeyV',
                    keyCode: 86,
                    which: 86,
                    ctrlKey: true,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                });
                target.dispatchEvent(pasteEvent);

                return true;
            } catch (e) {
                console.error('[GoogleDocsHandler] Clipboard insert failed:', e);
                return false;
            }
        },

        /**
         * Insert text via typing simulation (fallback)
         * Slower but more compatible
         */
        async insertViaTyping(text) {
            // Use injected script if available
            // Use Messaging Bridge (Typing simulation not yet exposed via bridge, adding TODO)
            // For now, we'll fall back to local event dispatch if bridge doesn't support it
            // or if we add it to bridge later.
            // if (typeof window.__TextFlowSimulateTyping === 'function') {
            //    return await window.__TextFlowSimulateTyping(text);
            // }

            const target = await this.getEditTarget();
            if (!target) {
                console.error('[GoogleDocsHandler] No edit target for typing');
                return false;
            }

            if (this.isTitleArea(target)) {
                console.warn('[GoogleDocsHandler] Blocking typing into title area');
                return false;
            }

            target.focus();
            await this._delay(50);

            for (const char of text) {
                const eventInit = {
                    key: char,
                    code: char === ' ' ? 'Space' : `Key${char.toUpperCase()}`,
                    charCode: char.charCodeAt(0),
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window
                };

                target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
                target.dispatchEvent(new KeyboardEvent('keypress', eventInit));
                target.dispatchEvent(new InputEvent('beforeinput', {
                    inputType: 'insertText',
                    data: char,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }));
                target.dispatchEvent(new InputEvent('textInput', {
                    data: char,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                }));
                target.dispatchEvent(new KeyboardEvent('keyup', {
                    ...eventInit,
                    bubbles: true
                }));

                await this._delay(5);
            }

            return true;
        },

        /**
         * Main expansion method for Google Docs
         * Handles the full expansion flow with locking
         */
        async expand(shortcutLength, content, isRichText = false) {
            // Acquire lock
            if (!await this.expansionLock.acquire()) {
                console.debug('[GoogleDocsHandler] Expansion already in progress');
                return false;
            }

            try {
                // Step 1: Delete the shortcut text
                const deleteSuccess = await this.deleteChars(shortcutLength);
                if (!deleteSuccess) {
                    console.warn('[GoogleDocsHandler] Failed to delete shortcut');
                }

                await this._delay(30);

                // Step 2: Insert the expanded content
                let insertSuccess = false;

                if (this.useClipboard) {
                    // Try clipboard first (preferred)
                    insertSuccess = await this.insertViaClipboard(content, isRichText);

                    if (!insertSuccess) {
                        // Fallback to typing
                        console.debug('[GoogleDocsHandler] Clipboard failed, falling back to typing');
                        const plainText = isRichText ? this._htmlToPlainText(content) : content;
                        insertSuccess = await this.insertViaTyping(plainText);
                    }
                } else {
                    // Use typing simulation
                    const plainText = isRichText ? this._htmlToPlainText(content) : content;
                    insertSuccess = await this.insertViaTyping(plainText);
                }

                return insertSuccess;
            } catch (e) {
                console.error('[GoogleDocsHandler] Expansion error:', e);
                return false;
            } finally {
                this.expansionLock.release();
            }
        },

        /**
         * Convert HTML to plain text
         */
        _htmlToPlainText(html) {
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || div.innerText || '';
        },

        /**
         * Delay helper
         */
        _delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        /**
         * Send command to Main World via messaging bridge
         */
        _sendCommand(type, payload) {
            return new Promise(resolve => {
                const id = Math.random().toString(36).substr(2, 9);

                const handler = (e) => {
                    if (e.detail && e.detail.id === id) {
                        window.removeEventListener('TextFlow_Res', handler);
                        if (e.detail.error) {
                            console.warn(`[GoogleDocsHandler] Command ${type} failed:`, e.detail.error);
                            resolve(false);
                        } else {
                            resolve(e.detail.success);
                        }
                    }
                };

                window.addEventListener('TextFlow_Res', handler);
                window.dispatchEvent(new CustomEvent('TextFlow_Req', {
                    detail: { id, type, payload }
                }));

                // Timeout fallback
                setTimeout(() => {
                    window.removeEventListener('TextFlow_Res', handler);
                    resolve(false);
                }, 2000);
            });
        }
    };

    // Initialize and expose
    GoogleDocsHandler.init();
    window.GoogleDocsHandler = GoogleDocsHandler;

    console.log('[GoogleDocsHandler] Module loaded');
})();
