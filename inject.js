/**
 * TextFlow Page Injection Script
 * Injected into the page context (not isolated world) for deep integration
 * Based on techniques from production text expansion tools
 */

(function () {
    'use strict';

    // Prevent double injection
    if (window.__TextFlowInjected) return;
    window.__TextFlowInjected = true;

    const EXTENSION_ID = document.currentScript?.getAttribute('data-extension-id') || '';
    const IS_GOOGLE_DOCS = document.currentScript?.getAttribute('data-is-google-docs') === 'true';

    // =========================================
    // EXEC COMMAND WRAPPER
    // =========================================
    // Wraps execCommand for async execution (needed for some editors)
    const execCommandWrapper = {
        originalExecCommand: document.execCommand,
        isOverridden: Document.prototype.execCommand !== document.execCommand,

        install() {
            const self = this;
            document.execCommand = function (...args) {
                const fn = self.isOverridden
                    ? self.originalExecCommand.bind(document)
                    : Document.prototype.execCommand.bind(document);

                // Check for async execution flag
                if (document.body?.dataset.__TF_execCommand === '1') {
                    document.body.dataset.__TF_execCommand_pending = '1';
                    queueMicrotask(() => {
                        fn(...args);
                        document.body.dataset.__TF_execCommand_finished = '1';
                    });
                    return true;
                }

                return fn(...args);
            };
        },

        uninstall() {
            document.execCommand = this.originalExecCommand;
        }
    };

    // =========================================
    // DATA TRANSFER OVERRIDE
    // =========================================
    // Intercepts paste events for clipboard manipulation
    const dataTransferOverride = {
        originalDescriptors: {},
        symbolMap: {},

        install() {
            const proto = DataTransfer.prototype;
            const props = ['types', 'items', 'getData'];
            const overrideKey = (name) => `__TF_override-${name}`;

            props.forEach(prop => {
                const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
                const symbol = Symbol('__' + prop);

                this.symbolMap[prop] = symbol;
                this.originalDescriptors[prop] = descriptor;

                Object.defineProperty(proto, symbol, descriptor);

                let newDescriptor;
                if (prop === 'types' || prop === 'items') {
                    newDescriptor = {
                        get() {
                            return this.__is_TF_overridden
                                ? this[overrideKey(prop)]
                                : this[symbol];
                        }
                    };
                } else {
                    newDescriptor = {
                        value: function (...args) {
                            return this.__is_TF_overridden
                                ? this[overrideKey(prop)](...args)
                                : this[symbol](...args);
                        },
                        writable: true
                    };
                }
                Object.defineProperty(proto, prop, newDescriptor);
            });

            // Paste event interceptor
            this.pasteHandler = (e) => {
                if (document.body?.dataset.__TF_execCommand) {
                    const clipboardData = e.clipboardData;
                    clipboardData.__is_TF_overridden = true;
                    clipboardData[overrideKey('types')] = clipboardData[this.symbolMap.types].slice();

                    const dataTransfer = new DataTransfer();
                    const dataCache = Object.create(null);

                    for (const type of clipboardData[overrideKey('types')]) {
                        const data = clipboardData[this.symbolMap.getData](type);
                        dataCache[type] = data;
                        dataTransfer.setData(type, data);
                    }

                    clipboardData[overrideKey('items')] = dataTransfer[this.symbolMap.items];
                    clipboardData[overrideKey('getData')] = function (type) {
                        if (this.__is_TF_overridden) {
                            type = type.toLowerCase();
                            if (type === 'text') type = 'text/plain';
                            if (type in dataCache) return dataCache[type];
                        }
                        return this[this.symbolMap?.getData]?.(...arguments) || '';
                    };
                }
            };

            document.addEventListener('paste', this.pasteHandler, true);
        },

        uninstall() {
            document.removeEventListener('paste', this.pasteHandler, true);
            const proto = DataTransfer.prototype;
            for (const prop in this.originalDescriptors) {
                Object.defineProperty(proto, prop, this.originalDescriptors[prop]);
            }
        }
    };

    // =========================================
    // GOOGLE DOCS EXTRACTOR
    // =========================================
    const docsExtractor = {
        annotator: null,
        eventName: 'tf-get-docs-content',

        async install() {
            // Try to get Google's internal annotator
            if (IS_GOOGLE_DOCS && EXTENSION_ID && window._docs_annotate_getAnnotatedText) {
                try {
                    this.annotator = await window._docs_annotate_getAnnotatedText(EXTENSION_ID);
                    console.log('[TextFlow] Google Docs annotator initialized');
                } catch (e) {
                    console.debug('[TextFlow] Could not get Docs annotator:', e);
                }
            }

            this.handler = (e) => {
                let result;
                try {
                    result = this.handleRequest(e);
                } catch (err) {
                    result = { error: err.message };
                }
                if (result) {
                    window.dispatchEvent(new CustomEvent(`${this.eventName}res`, {
                        detail: result
                    }));
                }
            };

            window.addEventListener(this.eventName, this.handler);
        },

        handleRequest(e) {
            const type = e.detail?.type || 'get-text';

            if (type === 'get-text') {
                if (!this.annotator) return null;
                const text = this.annotator.getText();
                // Remove special markers
                const kix = '\uFEFF';
                const start = text.indexOf(kix);
                const end = text.indexOf(kix, start + 1);
                const cleanStart = start + 1;
                const cleanEnd = end !== -1 ? end : text.length;
                return text.substring(cleanStart, cleanEnd);
            }

            if (type === 'get-selection') {
                if (!this.annotator) return { start: 0, end: 0 };
                const selection = this.annotator.getSelection()?.[0];
                if (!selection) return { start: 0, end: 0 };

                const text = this.annotator.getText();
                const kix = '\uFEFF';
                let markerCount = 0;
                for (let i = 0; i < text.length && i < selection.start && markerCount < 2; i++) {
                    if (text[i] === kix) markerCount++;
                }
                if (markerCount >= 2) return { start: 0, end: 0 };

                return {
                    start: selection.start - markerCount,
                    end: selection.end - markerCount
                };
            }

            return null;
        },

        uninstall() {
            window.removeEventListener(this.eventName, this.handler);
        }
    };

    // =========================================
    // EDIT CONTEXT API HANDLER
    // =========================================
    const editContextHandler = {
        originalDescriptor: null,

        install() {
            const proto = HTMLElement.prototype;
            this.originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'editContext');

            if (!this.originalDescriptor) return;

            const original = this.originalDescriptor;
            Object.defineProperty(proto, 'editContext', {
                configurable: true,
                enumerable: true,
                get() {
                    return original.get.call(this);
                },
                set(value) {
                    try {
                        if (value) {
                            // Element is getting an EditContext - register it
                            queueMicrotask(() => {
                                this.dispatchEvent(new CustomEvent('__TF_registerElement', {
                                    bubbles: true,
                                    detail: { register: true }
                                }));
                            });
                        } else if (document.body?.dataset.__TF_pasteEvent) {
                            // EditContext being removed during paste
                            const result = original.set.call(this, value);
                            delete document.body.dataset.__TF_pasteEvent;
                            queueMicrotask(() => {
                                this.dispatchEvent(new CustomEvent('__TF_triggerPaste', {
                                    bubbles: true
                                }));
                            });
                            return result;
                        }
                    } catch (e) {
                        console.error('[TextFlow] EditContext error:', e);
                    }
                    return original.set.call(this, value);
                }
            });
        },

        uninstall() {
            if (this.originalDescriptor) {
                Object.defineProperty(HTMLElement.prototype, 'editContext', this.originalDescriptor);
            }
        }
    };

    // =========================================
    // KEYBOARD SIMULATION
    // =========================================

    // Find the correct target element for Google Docs
    function getGoogleDocsEditTarget() {
        // 1. Try to find the event target iframe (where keyboard events go)
        const eventTargetIframe = document.querySelector('.docs-texteventtarget-iframe');
        if (eventTargetIframe) {
            if (eventTargetIframe.contentDocument) {
                const editableDiv = eventTargetIframe.contentDocument.querySelector('[contenteditable="true"]');
                if (editableDiv) return editableDiv;
            }
            // Sometimes we just need to target the iframe element itself in the main doc
            return eventTargetIframe;
        }

        // 2. Try the main kix editor canvas
        const kixEditor = document.querySelector('.kix-appview-editor');
        if (kixEditor) return kixEditor;

        // 3. Fallback to any contenteditable that IS NOT the title
        const editables = document.querySelectorAll('[contenteditable="true"]');
        for (const el of editables) {
            if (!isGoogleDocsTitle(el) && el.offsetParent !== null) {
                return el;
            }
        }

        return null;
    }

    // Check if element is the title input (not the main document)
    function isGoogleDocsTitle(element) {
        if (!element) return false;

        // The hidden event input iframe content is NEVER the title
        const frameEl = element.ownerDocument?.defaultView?.frameElement;
        if (frameEl?.classList?.contains('docs-texteventtarget-iframe')) {
            return false;
        }

        // Check DOM hierarchy for header/title containers
        const parent = element.closest ? element.closest('.docs-title-input-container, .docs-title-widget, #docs-title-widget, #docs-header') : null;
        if (parent) return true;

        // Check IDs and Classes
        const id = element.id || '';
        const className = (element.className && typeof element.className === 'string') ? element.className : '';

        if (id === 'docs-title-inner' || id === 'docs-title-input') return true;
        if (className.includes('docs-title-input') || className.includes('docs-title-inner')) return true;

        // Check ARIA
        const ariaLabel = element.getAttribute('aria-label') || '';
        if (ariaLabel === 'Rename' || ariaLabel.includes('Document title')) return true;

        // Heuristic: Position check (Title is usually at the very top)
        if (element.getBoundingClientRect) {
            const rect = element.getBoundingClientRect();
            // Google Docs title is usually within top 120px and VISIBLE
            // Check rect.top >= 0 to avoid flagging offscreen hidden iframes
            if (rect.top >= 0 && rect.top < 120 && rect.height < 50 && rect.width < 800) {
                // It's likely the title if it's small and at the top
                // But double check it's NOT the main toolbar or menu
                if (!element.closest('.kix-appview-editor')) {
                    // Check if it's an input-like element
                    if (element.tagName === 'INPUT' || element.getAttribute('contenteditable') === 'true') {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // For editors that need simulated typing
    window.__TextFlowSimulateTyping = async function (text, targetElement) {
        // For Google Docs, find the correct target
        if (IS_GOOGLE_DOCS) {
            const docsTarget = getGoogleDocsEditTarget();
            if (docsTarget) {
                targetElement = docsTarget;
                console.log('[TextFlow] Using Google Docs editor target:', targetElement);
            } else if (!targetElement || isGoogleDocsTitle(targetElement)) {
                // Don't type into the title!
                console.warn('[TextFlow] Cannot find Google Docs editor target');
                return false;
            }
        }

        if (!targetElement) {
            targetElement = document.activeElement;
        }

        // Double-check we're not in the title
        if (isGoogleDocsTitle(targetElement)) {
            console.warn('[TextFlow] Blocking insertion into title area');
            return false;
        }

        // Focus the target first
        targetElement.focus();
        await new Promise(r => setTimeout(r, 50));

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

            const keydownEvent = new KeyboardEvent('keydown', eventInit);
            const keypressEvent = new KeyboardEvent('keypress', eventInit);

            const inputEvent = new InputEvent('beforeinput', {
                inputType: 'insertText',
                data: char,
                bubbles: true,
                cancelable: true,
                composed: true
            });

            const textInputEvent = new InputEvent('textInput', {
                data: char,
                bubbles: true,
                cancelable: true,
                composed: true
            });

            targetElement.dispatchEvent(keydownEvent);
            targetElement.dispatchEvent(keypressEvent);
            targetElement.dispatchEvent(inputEvent);
            targetElement.dispatchEvent(textInputEvent);

            const keyupEvent = new KeyboardEvent('keyup', {
                ...eventInit,
                bubbles: true
            });
            targetElement.dispatchEvent(keyupEvent);

            // Small delay between characters
            await new Promise(r => setTimeout(r, 5));
        }

        return true;
    };

    // Delete characters by simulating backspace
    window.__TextFlowDeleteChars = async function (count) {
        if (count <= 0) return true;

        const target = getGoogleDocsEditTarget() || document.activeElement;

        // Safety check
        if (isGoogleDocsTitle(target)) {
            console.warn('[TextFlow] Blocking delete in title area');
            return false;
        }

        target.focus();
        await new Promise(r => setTimeout(r, 20));

        for (let i = 0; i < count; i++) {
            const eventInit = {
                key: 'Backspace',
                code: 'Backspace',
                keyCode: 8,
                which: 8,
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window
            };

            target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
            // Backspace typically doesn't trigger keypress
            target.dispatchEvent(new KeyboardEvent('keyup', eventInit));

            // Input events for reactivity
            target.dispatchEvent(new InputEvent('beforeinput', {
                inputType: 'deleteContentBackward',
                data: null,
                bubbles: true,
                cancelable: true,
                composed: true
            }));

            // Small delay between deletes
            await new Promise(r => setTimeout(r, 5));
        }

        return true;
    };

    // Alternative: Use clipboard paste for Google Docs
    window.__TextFlowPasteInDocs = async function (text, isRichText = false) {
        try {
            // Write to clipboard
            if (isRichText) {
                // If we can use the Clipboard API with ClipboardItem
                if (navigator.clipboard.write && window.ClipboardItem) {
                    try {
                        const htmlBlob = new Blob([text], { type: 'text/html' });
                        // Strip HTML tags to get plain text without touching DOM/innerHTML
                        // Google Docs enforces TrustedHTML which blocks innerHTML and DOMParser
                        const plainText = text.replace(/<\/?[^>]+(>|$)/g, '').trim();
                        const textBlob = new Blob([plainText], { type: 'text/plain' });

                        await navigator.clipboard.write([
                            new ClipboardItem({
                                'text/html': htmlBlob,
                                'text/plain': textBlob
                            })
                        ]);
                    } catch (e) {
                        console.warn('[TextFlow] Rich text clipboard write failed, falling back to plain text', e);
                        await navigator.clipboard.writeText(text);
                    }
                } else {
                    await navigator.clipboard.writeText(text);
                }
            } else {
                await navigator.clipboard.writeText(text);
            }

            // Find the target
            const target = getGoogleDocsEditTarget() || document.activeElement;
            if (isGoogleDocsTitle(target)) {
                console.warn('[TextFlow] Cannot paste into title');
                return false;
            }

            // Create and dispatch a synthetic paste event with clipboard data
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            if (isRichText) {
                dataTransfer.setData('text/html', text);
            }

            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                composed: true,
                clipboardData: dataTransfer
            });
            target.dispatchEvent(pasteEvent);

            return true;
        } catch (e) {
            console.error('[TextFlow] Paste failed:', e);
            return false;
        }
    };

    // =========================================
    // MESSAGING BRIDGE (World Isolation Fix)
    // =========================================
    let textFlowReqHandler = null;
    let textFlowShutdownHandler = null;

    function registerTextFlowBridge() {
        textFlowReqHandler = async function (e) {
            if (!e.detail) return;

            const { id, type, payload } = e.detail;
            let result = { success: false };

            try {
                if (type === 'paste') {
                    result.success = await window.__TextFlowPasteInDocs(payload.text, payload.isRichText);
                } else if (type === 'delete') {
                    result.success = await window.__TextFlowDeleteChars(payload.count);
                } else if (type === 'ping') {
                    result.success = true;
                } else {
                    console.warn(`[TextFlow] Unknown request type: ${type}`);
                }
            } catch (err) {
                console.error(`[TextFlow] Req failed:`, err);
                result.error = err.message;
                result.success = false;
            }

            window.dispatchEvent(new CustomEvent('TextFlow_Res', {
                detail: { id, ...result }
            }));
        };

        textFlowShutdownHandler = function () {
            console.log('[TextFlow] Shutting down stale instance');
            if (textFlowReqHandler) {
                window.removeEventListener('TextFlow_Req', textFlowReqHandler);
                textFlowReqHandler = null;
            }
            if (window.__TextFlowCleanup) {
                try { window.__TextFlowCleanup(); } catch (e) {}
            }
            window.removeEventListener('TextFlow_Shutdown_New_Instance', textFlowShutdownHandler);
        };

        // Listen for future new instances telling us to quit
        window.addEventListener('TextFlow_Shutdown_New_Instance', textFlowShutdownHandler);

        // Register our bridge
        window.addEventListener('TextFlow_Req', textFlowReqHandler);
    }

    // =========================================
    // ASYNC TASK HANDLER
    // =========================================
    const asyncTaskHandler = {
        install() {
            this.handler = (e) => {
                const detail = e.detail;
                if (detail.type === 'setTimeout') {
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('TF_asyncTaskDone', {
                            detail: { id: detail.id }
                        }));
                    }, detail.delayMs);
                }
            };
            window.addEventListener('TF_asyncTask', this.handler);
        },

        uninstall() {
            window.removeEventListener('TF_asyncTask', this.handler);
        }
    };

    // =========================================
    // INSTALL ALL HANDLERS
    // =========================================
    try {
        // Step 1: Tell any stale cached instances to self-destruct
        window.dispatchEvent(new CustomEvent('TextFlow_Shutdown_New_Instance'));

        registerTextFlowBridge();
        execCommandWrapper.install();
        dataTransferOverride.install();
        editContextHandler.install();
        asyncTaskHandler.install();

        if (IS_GOOGLE_DOCS) {
            docsExtractor.install();
        }

        console.log('[TextFlow] Page injection complete');
    } catch (e) {
        console.error('[TextFlow] Injection error:', e);
    }

    // Store cleanup functions
    window.__TextFlowCleanup = function () {
        execCommandWrapper.uninstall();
        dataTransferOverride.uninstall();
        editContextHandler.uninstall();
        asyncTaskHandler.uninstall();
        docsExtractor.uninstall();
    };
})();
