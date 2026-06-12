/**
 * Content Script - TextFlow SOTA Omnibar
 * Multi-mode command palette with advanced features
 */

(function () {
    'use strict';

    // =========================================
    // STATE
    // =========================================
    let snippets = {};
    let settings = {};
    let isEnabled = true;

    // IME/Composition state
    let isIMEComposing = false;
    let lastCompositionData = '';
    let imeKeyCode229Detected = false;

    // Omnibar state
    let omnibarOpen = false;
    let omnibarEl = null;
    let omnibarBackdrop = null;
    let selectedIndex = 0;
    let filteredResults = [];
    let currentMode = 'search'; // search, command, create, category, help
    let clipboardHistory = [];
    let recentSnippets = [];

    // Cursor placeholder for positioning
    const CURSOR_PLACEHOLDER = '\u200B\u200B__TF_CURSOR__\u200B\u200B';

    // =========================================
    // SHADOW DOM UTILITIES
    // =========================================
    function getShadowRoot(element) {
        if (!element) return null;
        try {
            // Try browser-specific API for closed shadow roots
            if (typeof chrome !== 'undefined' && chrome.dom?.openOrClosedShadowRoot) {
                return chrome.dom.openOrClosedShadowRoot(element);
            }
            // Fallback to standard API (only works for open shadows)
            return element.shadowRoot || null;
        } catch (e) {
            console.debug('[TextFlow] Shadow root access error:', e);
            return null;
        }
    }

    function getActiveElement(doc = document, traverseShadow = true) {
        let active = doc.activeElement;
        if (!active) return null;

        // Traverse into shadow roots
        if (traverseShadow) {
            const shadow = getShadowRoot(active);
            if (shadow && shadow.activeElement) {
                return getActiveElement(shadow, true);
            }
        }

        // Traverse into iframes (same-origin only)
        if (active.tagName === 'IFRAME' || active.tagName === 'FRAME') {
            try {
                if (active.contentDocument && active.contentDocument.activeElement) {
                    return getActiveElement(active.contentDocument, traverseShadow);
                }
            } catch (e) {
                // Cross-origin iframe - can't access
            }
        }

        return active;
    }

    function getSelectionFromElement(element) {
        if (!element) return window.getSelection();

        const root = element.getRootNode();

        // If in shadow DOM, use shadow root's selection
        if (root instanceof ShadowRoot && typeof root.getSelection === 'function') {
            return root.getSelection();
        }

        // Default to window selection
        return window.getSelection();
    }

    function getElementWindow(element) {
        return element?.ownerDocument?.defaultView || window;
    }

    // =========================================
    // EDITOR DETECTION
    // =========================================
    const EditorDetector = {
        isTinyMCE(element) {
            if (!element) return false;
            return element.classList?.contains('mce-content-body')
                || element.id === 'tinymce'
                || element.closest?.('.tox-edit-area') !== null
                || element.closest?.('.mce-edit-area') !== null;
        },

        isCKEditor(element) {
            if (!element) return false;
            return element.classList?.contains('cke_editable')
                || element.closest?.('.cke_contents') !== null
                || element.closest?.('.ck-editor__editable') !== null;
        },

        isProseMirror(element) {
            if (!element) return false;
            return element.classList?.contains('ProseMirror');
        },

        isQuill(element) {
            if (!element) return false;
            return element.classList?.contains('ql-editor');
        },

        isGoogleDocs(element) {
            if (!element) return false;
            return element.classList?.contains('docs-texteventtarget-iframe')
                || document.querySelector('.kix-page') !== null
                || document.querySelector('.docs-editor') !== null;
        },

        isSlate(element) {
            if (!element) return false;
            return element.hasAttribute?.('data-slate-editor')
                || element.closest?.('[data-slate-editor]') !== null;
        },

        isLexical(element) {
            if (!element) return false;
            return element.hasAttribute?.('data-lexical-editor')
                || element.closest?.('[data-lexical-editor]') !== null;
        },

        isDraftJS(element) {
            if (!element) return false;
            return element.classList?.contains('public-DraftEditor-content')
                || element.closest?.('.DraftEditor-root') !== null;
        },

        getEditorType(element) {
            if (this.isTinyMCE(element)) return 'tinymce';
            if (this.isCKEditor(element)) return 'ckeditor';
            if (this.isProseMirror(element)) return 'prosemirror';
            if (this.isQuill(element)) return 'quill';
            if (this.isGoogleDocs(element)) return 'googledocs';
            if (this.isSlate(element)) return 'slate';
            if (this.isLexical(element)) return 'lexical';
            if (this.isDraftJS(element)) return 'draftjs';
            return null;
        },

        needsSpecialCursor(element) {
            const type = this.getEditorType(element);
            return ['tinymce', 'ckeditor', 'prosemirror', 'quill', 'slate', 'lexical', 'draftjs'].includes(type);
        },

        needsClipboardFallback(element) {
            return this.isGoogleDocs(element);
        }
    };

    // =========================================
    // FOCUS STATE MANAGER
    // =========================================
    const FocusStateManager = {
        states: new Map(),

        save(id, element) {
            if (!element) return;

            try {
                const state = {
                    element: new WeakRef(element),
                    timestamp: Date.now()
                };

                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    state.selectionStart = element.selectionStart;
                    state.selectionEnd = element.selectionEnd;
                    state.scrollTop = element.scrollTop;
                    state.scrollLeft = element.scrollLeft;
                } else if (element.isContentEditable) {
                    const selection = getSelectionFromElement(element);
                    if (selection && selection.rangeCount > 0) {
                        state.range = selection.getRangeAt(0).cloneRange();
                    }
                }

                this.states.set(id, state);
            } catch (e) {
                console.debug('[TextFlow] Failed to save focus state:', e);
            }
        },

        restore(id) {
            const state = this.states.get(id);
            if (!state) return false;

            try {
                const element = state.element.deref();
                if (!element || !element.isConnected) return false;

                element.focus();

                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    if (state.selectionStart !== undefined) {
                        element.setSelectionRange(state.selectionStart, state.selectionEnd);
                    }
                    if (state.scrollTop !== undefined) {
                        element.scrollTop = state.scrollTop;
                        element.scrollLeft = state.scrollLeft;
                    }
                } else if (state.range) {
                    const selection = getSelectionFromElement(element);
                    if (selection) {
                        selection.removeAllRanges();
                        try {
                            selection.addRange(state.range);
                        } catch (e) {
                            // Range may be invalid if DOM changed
                        }
                    }
                }

                return true;
            } catch (e) {
                console.debug('[TextFlow] Failed to restore focus:', e);
                return false;
            }
        },

        clear(id) {
            this.states.delete(id);
        },

        getElement(id) {
            const state = this.states.get(id);
            return state?.element?.deref() || null;
        },

        cleanup(maxAge = 300000) {
            const now = Date.now();
            for (const [id, state] of this.states) {
                if (now - state.timestamp > maxAge || !state.element.deref()) {
                    this.states.delete(id);
                }
            }
        }
    };

    // Periodic cleanup
    setInterval(() => FocusStateManager.cleanup(), 60000);

    // =========================================
    // INPUT BUFFER CLASS
    // =========================================
    class InputBuffer {
        constructor() {
            this.stream = [];
            this.timeout = 2000;
            this.timer = null;
            this.previousTarget = null;
            this.lastTargetRef = null;
        }

        checkTarget(element) {
            if (!this.previousTarget) {
                this.previousTarget = element;
                this.lastTargetRef = new WeakRef(element);
                return true;
            }

            // Same element
            if (this.previousTarget === element) return true;

            // Check if previous target still exists
            const prevElement = this.lastTargetRef?.deref();
            if (!prevElement || !prevElement.isConnected) {
                this.clear('previous target removed');
                this.previousTarget = element;
                this.lastTargetRef = new WeakRef(element);
                return true;
            }

            // Allow parent-child relationships (clicking within contenteditable)
            if (prevElement.contains(element)) {
                this.previousTarget = element;
                this.lastTargetRef = new WeakRef(element);
                return true;
            }

            // Child contains parent (moving up the tree)
            if (element.contains(prevElement)) {
                return true;
            }

            // Different element tree - reset
            this.clear('target changed');
            this.previousTarget = element;
            this.lastTargetRef = new WeakRef(element);
            return false;
        }

        add(element, char, isComposition = false) {
            // Security: Skip sensitive fields like passwords
            if (shouldIgnoreElement(element)) {
                this.clear('sensitive field ignored');
                return;
            }

            if (!this.checkTarget(element)) return;

            this.resetTimer();

            // For composition, add characters individually
            if (typeof char === 'string') {
                for (const c of char) {
                    this.stream.push(c);
                }
            }

            // Keep buffer at reasonable size
            if (this.stream.length > 150) {
                this.stream = this.stream.slice(-100);
            }

            // Check for shortcuts (skip during active composition)
            if (!isComposition && !isIMEComposing) {
                checkForShortcuts(element);
            }
        }

        pop() {
            if (this.stream.length > 0) {
                this.stream.pop();
                const target = this.lastTargetRef?.deref();
                if (target && isEditable(target)) {
                    checkForShortcuts(target);
                }
            }
            this.resetTimer();
        }

        clear(reason = '') {
            if (this.stream.length > 0) {
                console.debug(`[TextFlow] Buffer cleared: ${reason}`);
            }
            this.stream.length = 0;
            this.previousTarget = null;
            this.lastTargetRef = null;
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        }

        resetTimer() {
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => this.clear('timeout'), this.timeout);
        }

        toString() {
            return this.stream.join('');
        }

        get length() {
            return this.stream.length;
        }

        endsWith(str) {
            return this.toString().endsWith(str);
        }
    }

    // Initialize buffer instance
    const inputBuffer = new InputBuffer();

    // Commands available in command mode
    const COMMANDS = [
        { id: 'toggle', name: 'Toggle Extension', desc: 'Enable or disable TextFlow', icon: 'power', action: () => toggleExtension() },
        { id: 'settings', name: 'Open Settings', desc: 'Open extension settings page', icon: 'settings', action: () => openSettings() },
        { id: 'create', name: 'Create Snippet', desc: 'Create a new snippet', icon: 'plus', action: () => openCreate() },
        { id: 'export', name: 'Export Snippets', desc: 'Export all snippets to JSON', icon: 'download', action: () => exportSnippets() },
        { id: 'import', name: 'Import Snippets', desc: 'Import snippets from file', icon: 'upload', action: () => importSnippets() },
        { id: 'clear', name: 'Clear Recent', desc: 'Clear recently used snippets', icon: 'trash', action: () => clearRecent() },
        { id: 'help', name: 'Show Help', desc: 'Display keyboard shortcuts', icon: 'help', action: () => switchMode('help') },
    ];

    // Help content
    const HELP_SECTIONS = [
        {
            title: 'Modes',
            items: [
                { key: '/', desc: 'Search snippets (default)' },
                { key: '>', desc: 'Run commands' },
                { key: '@shortcut â†’ text', desc: 'Quick create snippet' },
                { key: '#category', desc: 'Filter by category' },
                { key: '?', desc: 'Show this help' },
            ]
        },
        {
            title: 'Navigation',
            items: [
                { key: 'â†‘ â†“', desc: 'Move selection' },
                { key: '1-9', desc: 'Quick select item' },
                { key: 'Enter', desc: 'Insert/execute selected' },
                { key: 'Tab', desc: 'Autocomplete shortcut' },
                { key: 'Esc', desc: 'Close omnibar' },
            ]
        },
        {
            title: 'Actions',
            items: [
                { key: 'Ctrl+E', desc: 'Edit selected snippet' },
                { key: 'Ctrl+C', desc: 'Copy snippet content' },
                { key: 'Ctrl+Shift+Space', desc: 'Toggle omnibar' },
            ]
        }
    ];

    // =========================================
    // INITIALIZATION
    // =========================================

    // Detect if we're in Google Docs
    function isGoogleDocs() {
        return window.location.hostname === 'docs.google.com' ||
            document.querySelector('.kix-page') !== null ||
            document.querySelector('.docs-editor') !== null;
    }

    // Inject page script for deep integration (Google Docs, etc.)
    function injectPageScript() {
        try {
            // Remove any previously-injected TextFlow scripts to avoid stale cached copies
            // that survive extension reloads and race with the new version
            const oldScripts = document.querySelectorAll('script[data-extension-id^="e"][src*="inject.js"]');
            oldScripts.forEach(s => s.remove());

            const existingScripts = document.querySelectorAll(`script[data-extension-id="${chrome.runtime.id}"]`);
            existingScripts.forEach(s => s.remove());

            const script = document.createElement('script');
            // Add a version nonce to bust Chrome's cache for chrome-extension:// URLs
            const version = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.())?.version || Date.now();
            script.src = chrome.runtime.getURL('inject.js') + '?v=' + encodeURIComponent(version);
            script.setAttribute('data-extension-id', chrome.runtime.id);
            script.setAttribute('data-is-google-docs', isGoogleDocs() ? 'true' : 'false');
            script.onload = () => {
                script.remove();
                console.log('[TextFlow] Page script injected');
            };
            (document.head || document.documentElement).appendChild(script);
        } catch (e) {
            console.debug('[TextFlow] Script injection skipped:', e);
        }
    }

    async function init() {
        console.log('[TextFlow] Initializing SOTA Omnibar...');

        // Inject page script first for deep integration
        injectPageScript();

        await loadSnippets();
        await loadSettings();
        loadRecentSnippets();
        setupListeners();
        setupMessageListener();

        // Setup Google Docs specific listeners if detected
        if (isGoogleDocs()) {
            setupGoogleDocsListeners();
        }

        console.log(`[TextFlow] Ready with ${Object.keys(snippets).length} snippets`);
    }

    // Google Docs specific event listeners
    function setupGoogleDocsListeners() {
        console.log('[TextFlow] Setting up Google Docs integration');

        // Listen for response from injected script
        window.addEventListener('tf-get-docs-contentres', (e) => {
            if (e.detail) {
                console.debug('[TextFlow] Got Docs content:', e.detail);
            }
        });

        // Attach event listeners to the hidden contenteditable iframe
        // Content scripts don't run in about:blank iframes in MV3,
        // so we proxy events from the iframe's contentDocument
        function attachToDocsIframe() {
            const iframe = document.querySelector('iframe.docs-texteventtarget-iframe');
            if (!iframe || !iframe.contentDocument) {
                setTimeout(attachToDocsIframe, 500);
                return;
            }
            const doc = iframe.contentDocument;
            console.log('[TextFlow] Attached to docs iframe');

            doc.addEventListener('keydown', (e) => {
                if (omnibarOpen) return;
                const target = getActiveElement() || e.target;
                if (!isEditable(target)) return;
                if (e.keyCode === 229 || e.key === 'Process' || e.key === 'Unidentified') {
                    imeKeyCode229Detected = true;
                    return;
                }
                imeKeyCode229Detected = false;
                if (isIMEComposing) return;
                if (e.key === 'Backspace') {
                    popBuffer();
                } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', 'Escape', 'Enter'].includes(e.key)) {
                    clearBuffer();
                }
            }, true);

            doc.addEventListener('keypress', (e) => {
                if (omnibarOpen || isIMEComposing || imeKeyCode229Detected) return;
                const target = getActiveElement() || e.target;
                if (!isEditable(target)) return;
                if (e.key && e.key.length === 1) {
                    addToBuffer(target, e.key);
                }
            }, true);

            doc.addEventListener('beforeinput', (e) => {
                if (omnibarOpen) return;
                const target = getActiveElement() || e.target;
                if (!isEditable(target)) return;
                if (e.isComposing || isIMEComposing) {
                    if (e.inputType === 'insertCompositionText' && e.data) {
                        lastCompositionData = e.data;
                    }
                    return;
                }
                if (e.inputType === 'insertText' && e.data) {
                    addToBuffer(target, e.data);
                } else if (e.inputType === 'deleteContentBackward') {
                    popBuffer();
                } else if (e.inputType.includes('paste') || e.inputType.includes('drop')) {
                    clearBuffer();
                } else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
                    clearBuffer();
                }
            }, true);

            doc.addEventListener('compositionstart', (e) => {
                isIMEComposing = true;
                lastCompositionData = '';
            }, true);

            doc.addEventListener('compositionupdate', (e) => {
                lastCompositionData = e.data || '';
            }, true);

            doc.addEventListener('compositionend', (e) => {
                if (omnibarOpen) {
                    isIMEComposing = false;
                    return;
                }
                const target = getActiveElement() || e.target;
                if (!isEditable(target)) {
                    isIMEComposing = false;
                    return;
                }
                isIMEComposing = false;
                imeKeyCode229Detected = false;
                if (e.data) {
                    addToBuffer(target, e.data);
                }
                lastCompositionData = '';
            }, true);
        }

        attachToDocsIframe();
    }

    // Request text from Google Docs via injected script
    function getGoogleDocsText() {
        return new Promise((resolve) => {
            const handler = (e) => {
                window.removeEventListener('tf-get-docs-contentres', handler);
                resolve(e.detail);
            };
            document.addEventListener('tf-get-docs-contentres', handler);
            document.dispatchEvent(new CustomEvent('tf-get-docs-content', {
                detail: { type: 'get-text' },
                bubbles: true,
                composed: true
            }));
            // Timeout fallback
            setTimeout(() => {
                document.removeEventListener('tf-get-docs-contentres', handler);
                resolve(null);
            }, 1000);
        });
    }

    // Request selection from Google Docs via injected script  
    function getGoogleDocsSelection() {
        return new Promise((resolve) => {
            const handler = (e) => {
                document.removeEventListener('tf-get-docs-contentres', handler);
                resolve(e.detail);
            };
            document.addEventListener('tf-get-docs-contentres', handler);
            document.dispatchEvent(new CustomEvent('tf-get-docs-content', {
                detail: { type: 'get-selection' },
                bubbles: true,
                composed: true
            }));
            setTimeout(() => {
                document.removeEventListener('tf-get-docs-contentres', handler);
                resolve({ start: 0, end: 0 });
            }, 1000);
        });
    }

    async function loadSnippets() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SNIPPETS' });
            if (response?.snippets) {
                snippets = response.snippets;
            }
        } catch (error) {
            console.error('[TextFlow] Failed to load snippets:', error);
        }
    }

    async function loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            if (response?.settings) {
                settings = response.settings;
                isEnabled = settings.enabled !== false;
            }
        } catch (error) {
            console.error('[TextFlow] Failed to load settings:', error);
        }
    }

    function loadRecentSnippets() {
        try {
            const stored = localStorage.getItem('textflow_recent');
            if (stored) {
                recentSnippets = JSON.parse(stored).slice(0, 5);
            }
        } catch { }
    }

    function saveRecentSnippet(shortcut) {
        recentSnippets = [shortcut, ...recentSnippets.filter(s => s !== shortcut)].slice(0, 5);
        try {
            localStorage.setItem('textflow_recent', JSON.stringify(recentSnippets));
        } catch { }
    }

    // Shared AudioContext for sound effects (reused to prevent memory leaks)
    let sharedAudioContext = null;

    // Play a subtle pop sound on successful expansion
    function playExpansionSound() {
        if (!settings.soundEnabled) return;

        try {
            // Reuse existing AudioContext or create new one
            if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
                sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume if suspended (browser autoplay policy)
            if (sharedAudioContext.state === 'suspended') {
                sharedAudioContext.resume();
            }

            const oscillator = sharedAudioContext.createOscillator();
            const gainNode = sharedAudioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(sharedAudioContext.destination);

            // Subtle high-pitched blip
            oscillator.frequency.setValueAtTime(880, sharedAudioContext.currentTime); // A5
            oscillator.frequency.exponentialRampToValueAtTime(1320, sharedAudioContext.currentTime + 0.05); // E6

            // Quick fade in and out
            gainNode.gain.setValueAtTime(0, sharedAudioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, sharedAudioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, sharedAudioContext.currentTime + 0.1);

            oscillator.start(sharedAudioContext.currentTime);
            oscillator.stop(sharedAudioContext.currentTime + 0.1);
            // No need to close context - it will be reused
        } catch (e) {
            // Audio not available, silently fail
            console.debug('[TextFlow] Audio not available:', e);
        }
    }

    // =========================================
    // TEXT EXPANSION (Original functionality)
    // =========================================
    function isEditable(element) {
        if (!element) return false;

        // Get the element's window context (for cross-frame instanceof checks)
        const w = getElementWindow(element);

        // Check HTMLInputElement with correct window context
        if (w.HTMLInputElement && element instanceof w.HTMLInputElement) {
            // Exclude non-text input types
            const excludedTypes = ['submit', 'button', 'reset', 'radio',
                'range', 'image', 'file', 'color', 'checkbox', 'hidden'];
            return !excludedTypes.includes(element.type);
        }

        // Check HTMLTextAreaElement with correct window context
        if (w.HTMLTextAreaElement && element instanceof w.HTMLTextAreaElement) {
            return true;
        }

        // ContentEditable check
        if (element.isContentEditable) return true;

        // Explicit contenteditable attribute (handles edge cases)
        if (element.getAttribute('contenteditable') === 'true' ||
            element.getAttribute('contenteditable') === '') {
            return true;
        }

        // Design mode - whole document editing (TinyMCE, some email composers)
        if (element.ownerDocument?.designMode?.toLowerCase() === 'on') {
            return true;
        }

        // EditContext API (Chrome 121+) - for custom text editors like Figma
        if (element.editContext) return true;

        // ARIA textbox role (accessibility, custom widgets)
        if (element.getAttribute('role') === 'textbox') return true;

        // ARIA role combobox with editable (searchable dropdowns)
        if (element.getAttribute('role') === 'combobox' &&
            element.getAttribute('aria-autocomplete')) {
            return true;
        }

        return false;
    }

    // =========================================
    // SECURITY: PASSWORD FIELD PROTECTION
    // =========================================
    /**
     * Check if element should be ignored for text expansion
     * This prevents expansion in sensitive fields like passwords
     * @param {Element} element - The element to check
     * @returns {boolean} - True if element should be ignored
     */
    function shouldIgnoreElement(element) {
        if (!element) return true;

        const tagName = element.tagName?.toLowerCase();
        const w = getElementWindow(element);

        // Check for password input fields - security critical
        if (tagName === 'input' || (w.HTMLInputElement && element instanceof w.HTMLInputElement)) {
            const type = element.type?.toLowerCase() || 'text';

            // Password fields must always be ignored
            if (type === 'password') return true;

            // Check for autocomplete attributes that suggest sensitive data
            const autocomplete = (element.autocomplete || '').toLowerCase();
            const sensitiveAutocomplete = [
                'current-password', 'new-password',  // Passwords
                'cc-number', 'cc-csc', 'cc-exp',     // Credit card
                'cc-exp-month', 'cc-exp-year',       // Credit card expiry
                'one-time-code',                      // 2FA codes
            ];
            if (sensitiveAutocomplete.some(s => autocomplete.includes(s))) return true;

            // Check name/id attributes for password-like fields
            const nameAttr = (element.name || '').toLowerCase();
            const idAttr = (element.id || '').toLowerCase();
            const passwordPatterns = ['password', 'passwd', 'pwd', 'pin', 'otp', 'cvv', 'cvc', 'security-code'];
            if (passwordPatterns.some(p => nameAttr.includes(p) || idAttr.includes(p))) return true;
        }

        // Check for data-* attributes that indicate sensitive fields
        if (element.dataset?.sensitive === 'true') return true;
        if (element.dataset?.textflowDisabled === 'true') return true;

        // Check for aria attributes indicating password
        const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
        if (ariaLabel.includes('password') || ariaLabel.includes('pin')) return true;

        return false;
    }

    // Check if element is allowed for insertion (not on banned sites/elements)
    function isAllowedToInsert(element) {
        if (!element) return false;

        // Add banned hosts if needed
        const bannedHosts = [];
        if (bannedHosts.includes(document.location.host)) {
            return element.classList?.contains('allow-textflow');
        }

        // Check for elements marked as no-expand
        if (element.hasAttribute?.('data-textflow-disabled')) {
            return false;
        }

        return true;
    }

    // Wrapper functions for backward compatibility with old buffer API
    function addToBuffer(target, char) {
        inputBuffer.add(target, char);
    }

    function popBuffer() {
        inputBuffer.pop();
    }

    function clearBuffer() {
        inputBuffer.clear('manual clear');
    }

    function checkForShortcuts(target) {
        if (!isEnabled || inputBuffer.length < 2) return;
        if (!isAllowedToInsert(target)) return;

        // Security: Double-check sensitive fields (defense in depth)
        if (shouldIgnoreElement(target)) return;

        const bufferStr = inputBuffer.toString();

        // Sort shortcuts by length descending for greedy matching
        // This ensures longer shortcuts are matched before shorter ones
        // e.g., `;email` matches before `;em`
        const sortedShortcuts = Object.keys(snippets)
            .sort((a, b) => b.length - a.length);

        for (const shortcut of sortedShortcuts) {
            if (bufferStr.endsWith(shortcut)) {
                expandSnippet(target, shortcut);
                inputBuffer.clear('shortcut matched');
                return;
            }
        }
    }

    async function expandSnippet(element, shortcut) {
        const snippet = snippets[shortcut];
        if (!snippet) return;

        const isRichText = snippet.isRichText || false;

        let content;
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
            // If TextFlowExecutor is available (client-side dynamic logic), prefer raw content
            // to ensure fresh form processing and avoid stale background state
            if (window.TextFlowExecutor) {
                content = snippet.content;
            } else {
                content = response?.expanded || snippet.content;
            }
        } catch {
            content = snippet.content;
        }

        // Set up command executor context for dynamic commands
        if (window.TextFlowExecutor) {
            window.TextFlowExecutor.reset(); // Ensure clean state before setting context
            window.TextFlowExecutor.setContext({
                site: {
                    url: window.location.href,
                    title: document.title,
                    domain: window.location.hostname,
                    selection: window.getSelection()?.toString() || ''
                },
                snippets: snippets,
                user: {},
                currentSnippet: snippet,
                rootSnippet: snippet,
                currentTrigger: shortcut
            });
        }

        // Decode HTML entities (from rich text editor) before command processing
        const decodeHtmlEntities = (html) => {
            const txt = document.createElement('textarea');
            txt.innerHTML = html;
            return txt.value;
        };

        if (content.includes('&') && content.includes(';')) {
            content = decodeHtmlEntities(content);
        }

        // Check for dynamic commands using new system
        if (window.TextFlowParser?.hasCommands(content)) {
            try {
                // First pass: check if forms are needed
                let result = await window.TextFlowExecutor.execute(content);

                // If form is required, show modal
                if (result.requiresForm && result.formFields.length > 0) {
                    if (window.TextFlowFormModal) {
                        const formResult = await window.TextFlowFormModal.show(
                            result.formFields,
                            snippet.name || shortcut,
                            // Action callback for buttons
                            async (code, currentValues) => {
                                window.TextFlowExecutor.setFormValues(currentValues);
                                await window.TextFlowExecutor.evaluateWithSandbox(code);
                                return window.TextFlowExecutor.context.formValues;
                            }
                        );

                        if (!formResult.submitted) {
                            return; // User cancelled
                        }

                        // Set form values and re-execute
                        window.TextFlowExecutor.setFormValues(formResult.values);
                        result = await window.TextFlowExecutor.execute(content);
                    }
                }

                content = result.content;

                // Handle cursor positioning from {cursor} command
                if (result.cursorPosition >= 0) {
                    // Rich text doesn't support cursor positioning well, fall back to plain text
                    await insertText(element, shortcut.length, content);
                    const moveBack = content.length - result.cursorPosition;
                    if (moveBack > 0) {
                        await moveCursorBack(element, moveBack);
                    }
                    saveRecentSnippet(shortcut);
                    incrementUsage(shortcut);
                    playExpansionSound();
                    return;
                }

                // Google Docs Handling
                if (window.GoogleDocsHandler && window.GoogleDocsHandler.isGoogleDocsEnv()) {
                    await window.GoogleDocsHandler.expand(shortcut.length, content, isRichText);
                } else {
                    // Standard Insertion
                    if (isRichText) {
                        await insertRichText(element, shortcut.length, content);
                    } else {
                        await insertText(element, shortcut.length, content);
                    }
                }
                saveRecentSnippet(shortcut);
                incrementUsage(shortcut);
                playExpansionSound();
                return;
            } catch (error) {
                console.error('[TextFlow] Command execution error:', error);
                showToast(`Error: ${error.message}`, 'error');
                return;
            }
        }

        // Legacy support: Check for old {input:fieldname} syntax
        const dynamicVars = content.match(/\{input:([^}]+)\}/g);
        if (dynamicVars && dynamicVars.length > 0) {
            content = await promptForVariables(content, dynamicVars);
            if (content === null) return; // User cancelled
        }

        // Legacy support: Check for |cursor| placeholder
        const cursorPlaceholder = '|cursor|';
        const cursorIndex = content.indexOf(cursorPlaceholder);
        const cleanContent = content.replace(cursorPlaceholder, '');

        // Google Docs Handling
        if (window.GoogleDocsHandler && window.GoogleDocsHandler.isGoogleDocsEnv()) {
            await window.GoogleDocsHandler.expand(shortcut.length, cleanContent, isRichText);
        } else {
            // Standard Insertion
            // Use appropriate insertion method based on rich text flag
            if (isRichText && cursorIndex < 0) {
                // Rich text with no cursor positioning
                await insertRichText(element, shortcut.length, cleanContent);
            } else {
                // Plain text or rich text with cursor (falls back to plain)
                await insertText(element, shortcut.length, cursorIndex >= 0 ? cleanContent : cleanContent);

                if (cursorIndex >= 0) {
                    const moveBack = cleanContent.length - cursorIndex;
                    await moveCursorBack(element, moveBack);
                }
            }
        }

        saveRecentSnippet(shortcut);
        incrementUsage(shortcut);
        playExpansionSound();
    }

    // New function to handle rich text (HTML) insertion
    async function insertRichText(element, shortcutLength, html) {
        const tagName = element.tagName?.toLowerCase();

        // For input/textarea fields, fall back to plain text
        if (tagName === 'input' || tagName === 'textarea') {
            const plainText = htmlToPlainText(html);
            await insertText(element, shortcutLength, plainText);
            return;
        }

        // For contenteditable elements, insert HTML
        await clearShortcutFromContentEditable(shortcutLength);

        // Use insertHTML command
        const success = document.execCommand('insertHTML', false, html);
        if (!success) {
            // Fallback: create a fragment and insert it
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const fragment = document.createRange().createContextualFragment(html);
                range.insertNode(fragment);
                range.collapse(false);
            }
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Helper to convert HTML to plain text
    function htmlToPlainText(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    async function insertText(element, shortcutLength, text) {
        const tagName = element.tagName?.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') {
            const start = element.selectionStart || 0;
            element.focus();
            element.setSelectionRange(start - shortcutLength, start);
            const success = document.execCommand('insertText', false, text);
            if (!success) {
                const value = element.value;
                const before = value.slice(0, start - shortcutLength);
                const after = value.slice(start);
                element.value = before + text + after;
                element.setSelectionRange(before.length + text.length, before.length + text.length);
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            await clearShortcutFromContentEditable(shortcutLength);
            const success = document.execCommand('insertText', false, text);
            if (!success) {
                document.execCommand('insertHTML', false, escapeHtml(text).replace(/\n/g, '<br>'));
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    async function clearShortcutFromContentEditable(length) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        // Direct approach: if cursor is in a text node, set selection range directly
        if (node.nodeType === Node.TEXT_NODE) {
            const startOffset = Math.max(0, range.startOffset - length);
            range.setStart(node, startOffset);
            range.setEnd(node, range.startOffset + length);
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand('delete', false);
            return;
        }

        // Fallback for non-text nodes: extend selection backward char by char
        try {
            for (let i = 0; i < length; i++) {
                selection.modify('extend', 'backward', 'character');
            }
            document.execCommand('delete', false);
        } catch {
            for (let i = 0; i < length; i++) {
                document.execCommand('delete', false);
            }
        }
    }

    async function moveCursorBack(element, count) {
        const tagName = element.tagName?.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') {
            const pos = element.selectionStart || 0;
            element.setSelectionRange(pos - count, pos - count);
        } else {
            for (let i = 0; i < count; i++) {
                element.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true,
                }));
                await new Promise(r => setTimeout(r, 10));
            }
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function incrementUsage(shortcut) {
        try {
            await chrome.runtime.sendMessage({ type: 'INCREMENT_USAGE', payload: { shortcut } });
        } catch { }
    }

    // =========================================
    // DYNAMIC VARIABLE PROMPTS
    // =========================================
    async function promptForVariables(content, variables) {
        return new Promise((resolve) => {
            const fields = variables.map(v => {
                const match = v.match(/\{input:([^}]+)\}/);
                return match ? match[1] : 'value';
            });

            const uniqueFields = [...new Set(fields)];
            const modal = createVariableModal(uniqueFields, (values) => {
                if (values === null) {
                    resolve(null);
                } else {
                    let result = content;
                    for (const [field, value] of Object.entries(values)) {
                        result = result.replace(new RegExp(`\\{input:${field}\\}`, 'g'), value);
                    }
                    resolve(result);
                }
                modal.remove();
            });

            document.body.appendChild(modal);
            modal.querySelector('input')?.focus();
        });
    }

    function createVariableModal(fields, callback) {
        const modal = document.createElement('div');
        modal.className = 'ste-variable-modal';
        modal.innerHTML = `
            <div class="ste-variable-modal-title">Fill in the values</div>
            ${fields.map(field => `
                <div class="ste-variable-modal-field">
                    <label class="ste-variable-modal-label">${field}</label>
                    <input type="text" class="ste-variable-modal-input" data-field="${field}" placeholder="Enter ${field}...">
                </div>
            `).join('')}
            <div class="ste-variable-modal-actions">
                <button class="ste-variable-modal-btn ste-variable-modal-btn-cancel">Cancel</button>
                <button class="ste-variable-modal-btn ste-variable-modal-btn-confirm">Insert</button>
            </div>
        `;

        modal.querySelector('.ste-variable-modal-btn-cancel').addEventListener('click', () => callback(null));
        modal.querySelector('.ste-variable-modal-btn-confirm').addEventListener('click', () => {
            const values = {};
            modal.querySelectorAll('.ste-variable-modal-input').forEach(input => {
                values[input.dataset.field] = input.value;
            });
            callback(values);
        });

        // Enter to confirm
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                modal.querySelector('.ste-variable-modal-btn-confirm').click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                callback(null);
            }
        });

        return modal;
    }

    // =========================================
    // OMNIBAR UI
    // =========================================
    function createOmnibar() {
        // Backdrop
        omnibarBackdrop = document.createElement('div');
        omnibarBackdrop.className = 'ste-omnibar-backdrop';
        omnibarBackdrop.addEventListener('click', hideOmnibar);

        // Main container
        omnibarEl = document.createElement('div');
        omnibarEl.className = 'ste-omnibar';
        omnibarEl.innerHTML = `
            <div class="ste-omnibar-header">
                <div class="ste-omnibar-search">
                    <svg class="ste-omnibar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input type="text" class="ste-omnibar-input" placeholder="Search snippets... (/ > @ # ?)" autocomplete="off" spellcheck="false">
                    <span class="ste-omnibar-mode" id="ste-mode-indicator" style="display:none;">SEARCH</span>
                    <span class="ste-omnibar-shortcut-hint">ESC</span>
                </div>
            </div>
            <div class="ste-omnibar-body">
                <div class="ste-omnibar-results-column">
                    <div class="ste-omnibar-results" id="ste-results"></div>
                </div>
                <div class="ste-omnibar-preview-column">
                    <div class="ste-omnibar-preview-header">
                        <span class="ste-omnibar-preview-title">Preview</span>
                    </div>
                    <div class="ste-omnibar-preview-content" id="ste-preview">
                        <div class="ste-omnibar-preview-empty">
                            <div class="ste-omnibar-preview-empty-icon">ðŸ“</div>
                            Select a snippet to preview
                        </div>
                    </div>
                </div>
            </div>
            <div class="ste-omnibar-footer">
                <div class="ste-omnibar-footer-left">
                    <span class="ste-omnibar-hint"><kbd>â†‘â†“</kbd> Navigate</span>
                    <span class="ste-omnibar-hint"><kbd>1-9</kbd> Quick select</span>
                </div>
                <div class="ste-omnibar-footer-right">
                    <span class="ste-omnibar-hint"><kbd>Tab</kbd> Complete</span>
                    <span class="ste-omnibar-hint"><kbd>Enter</kbd> Insert</span>
                </div>
            </div>
        `;

        document.body.appendChild(omnibarBackdrop);
        document.body.appendChild(omnibarEl);

        const input = omnibarEl.querySelector('.ste-omnibar-input');
        input.addEventListener('input', (e) => handleInput(e.target.value));
        input.addEventListener('keydown', handleKeydown);

        // Initial render
        currentMode = 'search';
        handleInput('');
        setTimeout(() => input.focus(), 10);
    }

    function handleInput(value) {
        const prefix = value.charAt(0);
        const query = value.slice(1);

        // Detect mode from prefix
        if (prefix === '>' && currentMode !== 'command') {
            switchMode('command');
        } else if (prefix === '@' && currentMode !== 'create') {
            switchMode('create');
        } else if (prefix === '#' && currentMode !== 'category') {
            switchMode('category');
        } else if (prefix === '?' && currentMode !== 'help') {
            switchMode('help');
        } else if (prefix !== '>' && prefix !== '@' && prefix !== '#' && prefix !== '?' && currentMode !== 'search') {
            switchMode('search');
        }

        // Filter based on mode
        switch (currentMode) {
            case 'command':
                filterCommands(query);
                break;
            case 'create':
                handleCreateMode(query);
                break;
            case 'category':
                filterByCategory(query);
                break;
            case 'help':
                renderHelp();
                break;
            default:
                filterSnippets(value);
        }
    }

    function switchMode(mode) {
        currentMode = mode;
        const indicator = omnibarEl.querySelector('#ste-mode-indicator');

        const modeConfig = {
            search: { text: 'SEARCH', class: '' },
            command: { text: 'COMMAND', class: 'ste-mode-command' },
            create: { text: 'CREATE', class: 'ste-mode-create' },
            category: { text: 'CATEGORY', class: 'ste-mode-category' },
            help: { text: 'HELP', class: 'ste-mode-help' },
        };

        const config = modeConfig[mode] || modeConfig.search;
        indicator.textContent = config.text;
        indicator.className = 'ste-omnibar-mode ' + config.class;
        indicator.style.display = mode === 'search' ? 'none' : 'inline-flex';
    }

    // =========================================
    // SEARCH MODE
    // =========================================
    function filterSnippets(query) {
        const snippetList = Object.values(snippets);
        let results = [];

        // Add recent snippets section if no query
        if (!query.trim() && recentSnippets.length > 0) {
            const recentItems = recentSnippets
                .filter(s => snippets[s])
                .map(s => ({ ...snippets[s], isRecent: true }));
            if (recentItems.length > 0) {
                results.push({ type: 'section', title: 'Recently Used' });
                results.push(...recentItems);
                results.push({ type: 'section', title: 'All Snippets' });
            }
        }

        // Filter snippets
        if (!query.trim()) {
            results.push(...snippetList.filter(s => !recentSnippets.includes(s.shortcut)).slice(0, 10));
        } else {
            const q = query.toLowerCase();
            const filtered = snippetList
                .filter(s =>
                    s.shortcut.toLowerCase().includes(q) ||
                    (s.name && s.name.toLowerCase().includes(q)) ||
                    s.content.toLowerCase().includes(q)
                )
                .sort((a, b) => {
                    // Prioritize shortcut matches
                    const aMatch = a.shortcut.toLowerCase().startsWith(q);
                    const bMatch = b.shortcut.toLowerCase().startsWith(q);
                    if (aMatch && !bMatch) return -1;
                    if (!aMatch && bMatch) return 1;
                    return 0;
                })
                .slice(0, 10);
            results.push(...filtered);
        }

        // Keep sections in filteredResults so keyboard navigation aligns with rendered items
        filteredResults = results;

        // Set selectedIndex to first non-section item
        selectedIndex = results.findIndex(r => r.type !== 'section');
        if (selectedIndex < 0) selectedIndex = 0;

        renderResults(results, query);
        updatePreview();
    }

    function renderResults(results, query) {
        const container = omnibarEl.querySelector('#ste-results');

        if (results.length === 0 || (results.length === 1 && results[0].type === 'section')) {
            container.innerHTML = `
                <div class="ste-omnibar-empty">
                    <div class="ste-omnibar-empty-icon">ðŸ”</div>
                    ${query ? 'No snippets found' : 'No snippets yet'}
                </div>
            `;
            return;
        }

        let visualNumber = 0;
        container.innerHTML = results.map((item, idx) => {
            if (item.type === 'section') {
                return `<div class="ste-omnibar-section" data-index="${idx}">${item.title}</div>`;
            }

            visualNumber++;
            const preview = item.content.slice(0, 50).replace(/\n/g, ' ');
            const shortcutDisplay = highlightMatch(item.shortcut, query);
            const nameDisplay = item.name ? highlightMatch(item.name, query) : '';
            const categoryAttr = item.category ? `data-category="${item.category}"` : '';

            return `
                <div class="ste-omnibar-item ${idx === selectedIndex ? 'ste-selected' : ''}" data-index="${idx}">
                    <span class="ste-omnibar-item-number">${visualNumber <= 9 ? visualNumber : ''}</span>
                    <div class="ste-omnibar-item-content">
                        <div class="ste-omnibar-item-header">
                            <span class="ste-omnibar-item-shortcut">${shortcutDisplay}</span>
                            ${nameDisplay ? `<span class="ste-omnibar-item-name">${nameDisplay}</span>` : ''}
                        </div>
                        <div class="ste-omnibar-item-preview">${escapeHtml(preview)}${item.content.length > 50 ? '...' : ''}</div>
                    </div>
                    ${item.category ? `<span class="ste-omnibar-item-category" ${categoryAttr}>${item.category}</span>` : ''}
                    ${item.usageCount ? `<span class="ste-omnibar-item-stats">${item.usageCount}Ã—</span>` : ''}
                </div>
            `;
        }).join('');

        attachItemListeners();
    }

    // =========================================
    // COMMAND MODE
    // =========================================
    function filterCommands(query) {
        const q = query.toLowerCase().trim();
        filteredResults = COMMANDS.filter(cmd =>
            cmd.id.includes(q) || cmd.name.toLowerCase().includes(q) || cmd.desc.toLowerCase().includes(q)
        );
        selectedIndex = 0;
        renderCommands(filteredResults, query);
        updatePreview();
    }

    function renderCommands(commands, query) {
        const container = omnibarEl.querySelector('#ste-results');

        if (commands.length === 0) {
            container.innerHTML = `
                <div class="ste-omnibar-empty">
                    <div class="ste-omnibar-empty-icon">âš¡</div>
                    No commands found
                </div>
            `;
            return;
        }

        const icons = {
            power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>',
            settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
            plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
            download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
            upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
            trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        };

        container.innerHTML = commands.map((cmd, idx) => `
            <div class="ste-omnibar-item ste-command-item ${idx === selectedIndex ? 'ste-selected' : ''}" data-index="${idx}">
                <div class="ste-omnibar-item-icon">${icons[cmd.icon] || ''}</div>
                <div class="ste-omnibar-item-content">
                    <div class="ste-omnibar-item-header">
                        <span class="ste-omnibar-item-shortcut">${highlightMatch(cmd.name, query)}</span>
                    </div>
                    <div class="ste-omnibar-item-preview">${cmd.desc}</div>
                </div>
            </div>
        `).join('');

        attachItemListeners();
    }

    // =========================================
    // CREATE MODE
    // =========================================
    function handleCreateMode(query) {
        const container = omnibarEl.querySelector('#ste-results');
        const preview = omnibarEl.querySelector('#ste-preview');

        // Parse @shortcut â†’ content
        const match = query.match(/^([^\sâ†’]+)\s*â†’\s*(.+)$/);

        if (match) {
            const [, shortcut, content] = match;
            filteredResults = [{ type: 'create', shortcut: shortcut.trim(), content: content.trim() }];

            container.innerHTML = `
                <div class="ste-omnibar-create-hint">
                    Press <code>Enter</code> to create snippet
                </div>
                <div class="ste-omnibar-item ste-selected" data-index="0">
                    <span class="ste-omnibar-item-number">+</span>
                    <div class="ste-omnibar-item-content">
                        <div class="ste-omnibar-item-header">
                            <span class="ste-omnibar-item-shortcut">${escapeHtml(shortcut.trim())}</span>
                            <span class="ste-omnibar-item-name">New Snippet</span>
                        </div>
                        <div class="ste-omnibar-item-preview">${escapeHtml(content.trim().slice(0, 50))}...</div>
                    </div>
                </div>
            `;

            preview.innerHTML = `<div style="white-space: pre-wrap;">${escapeHtml(content.trim())}</div>`;
        } else {
            filteredResults = [];
            container.innerHTML = `
                <div class="ste-omnibar-create-hint">
                    Format: <code>@shortcut â†’ content</code>
                </div>
                <div class="ste-omnibar-empty">
                    <div class="ste-omnibar-empty-icon">âœ¨</div>
                    Type shortcut â†’ content to create
                </div>
            `;
            preview.innerHTML = `<div class="ste-omnibar-preview-empty">
                <div class="ste-omnibar-preview-empty-icon">âœï¸</div>
                Enter snippet content
            </div>`;
        }
    }

    // =========================================
    // CATEGORY MODE
    // =========================================
    function filterByCategory(query) {
        const snippetList = Object.values(snippets);
        const q = query.toLowerCase().trim();

        if (!q) {
            // Show all categories
            const categories = [...new Set(snippetList.map(s => s.category).filter(Boolean))];
            filteredResults = categories.map(cat => ({
                type: 'category',
                name: cat,
                count: snippetList.filter(s => s.category === cat).length
            }));
        } else {
            // Filter snippets by category
            filteredResults = snippetList.filter(s =>
                s.category && s.category.toLowerCase().includes(q)
            ).slice(0, 10);
        }

        selectedIndex = 0;
        renderCategoryResults(filteredResults, query);
        updatePreview();
    }

    function renderCategoryResults(results, query) {
        const container = omnibarEl.querySelector('#ste-results');

        if (results.length === 0) {
            container.innerHTML = `
                <div class="ste-omnibar-empty">
                    <div class="ste-omnibar-empty-icon">ðŸ“</div>
                    No categories found
                </div>
            `;
            return;
        }

        if (results[0]?.type === 'category') {
            container.innerHTML = results.map((cat, idx) => `
                <div class="ste-omnibar-item ${idx === selectedIndex ? 'ste-selected' : ''}" data-index="${idx}">
                    <span class="ste-omnibar-item-category" data-category="${cat.name}">${cat.name}</span>
                    <div class="ste-omnibar-item-content">
                        <div class="ste-omnibar-item-header">
                            <span class="ste-omnibar-item-shortcut">${cat.name}</span>
                        </div>
                        <div class="ste-omnibar-item-preview">${cat.count} snippet${cat.count !== 1 ? 's' : ''}</div>
                    </div>
                </div>
            `).join('');
        } else {
            renderResults(results, query);
        }

        attachItemListeners();
    }

    // =========================================
    // HELP MODE
    // =========================================
    function renderHelp() {
        const container = omnibarEl.querySelector('#ste-results');
        filteredResults = [];

        container.innerHTML = `
            <div class="ste-omnibar-help">
                ${HELP_SECTIONS.map(section => `
                    <div class="ste-omnibar-help-section">
                        <div class="ste-omnibar-help-title">${section.title}</div>
                        <div class="ste-omnibar-help-grid">
                            ${section.items.map(item => `
                                <span class="ste-omnibar-help-key">${item.key}</span>
                                <span class="ste-omnibar-help-desc">${item.desc}</span>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        const preview = omnibarEl.querySelector('#ste-preview');
        preview.innerHTML = `
            <div class="ste-omnibar-preview-empty">
                <div class="ste-omnibar-preview-empty-icon">âŒ¨ï¸</div>
                Keyboard shortcuts reference
            </div>
        `;
    }

    // =========================================
    // COMMON UTILITIES
    // =========================================
    function highlightMatch(text, query) {
        if (!query) return escapeHtml(text);
        // Remove prefix characters from query for highlighting
        const cleanQuery = query.replace(/^[>@#?\/]/, '');
        if (!cleanQuery) return escapeHtml(text);

        const escaped = escapeHtml(text);
        const q = cleanQuery.toLowerCase();
        const idx = text.toLowerCase().indexOf(q);
        if (idx === -1) return escaped;

        return escaped.slice(0, idx) +
            '<span class="ste-match">' + escaped.slice(idx, idx + cleanQuery.length) + '</span>' +
            escaped.slice(idx + cleanQuery.length);
    }

    function attachItemListeners() {
        const container = omnibarEl.querySelector('#ste-results');
        container.querySelectorAll('.ste-omnibar-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                selectedIndex = idx;
                selectCurrentItem();
            });
            item.addEventListener('mouseenter', () => {
                selectedIndex = parseInt(item.dataset.index);
                updateSelection();
                updatePreview();
            });
        });
    }

    function updateSelection() {
        // Use data-index attribute for proper matching (handles sections correctly)
        const items = omnibarEl.querySelectorAll('.ste-omnibar-item');
        items.forEach((item) => {
            const itemIndex = parseInt(item.getAttribute('data-index'), 10);
            item.classList.toggle('ste-selected', itemIndex === selectedIndex);
        });
        const selected = omnibarEl.querySelector(`.ste-omnibar-item[data-index="${selectedIndex}"]`);
        if (selected) selected.scrollIntoView({ block: 'nearest' });
    }

    async function updatePreview() {
        const preview = omnibarEl.querySelector('#ste-preview');
        const item = filteredResults[selectedIndex];

        if (!item || item.type === 'section' || item.type === 'category') {
            preview.innerHTML = `
                <div class="ste-omnibar-preview-empty">
                    <div class="ste-omnibar-preview-empty-icon">📂</div>
                    Select a snippet to preview
                </div>
            `;
            return;
        }

        if (item.type === 'create') {
            preview.innerHTML = `<div style="white-space: pre-wrap;">${escapeHtml(item.content)}</div>`;
            return;
        }

        if (item.content) {
            let contentToPreview = item.content;

            // Try to execute commands for preview if executor is available
            if (window.TextFlowExecutor && window.TextFlowParser && window.TextFlowParser.hasCommands(contentToPreview)) {
                try {
                    // Reset to clean state
                    window.TextFlowExecutor.reset();

                    // Set context for preview (important for {snippet} command etc)
                    window.TextFlowExecutor.setContext({
                        site: {
                            url: window.location.href,
                            title: document.title,
                            domain: window.location.hostname,
                            selection: window.getSelection()?.toString() || ''
                        },
                        snippets: snippets,
                        user: {},
                        currentSnippet: item,
                        rootSnippet: item,
                        currentTrigger: item.shortcut || ''
                    });

                    // Execute with preview mode enabled
                    const result = await window.TextFlowExecutor.execute(contentToPreview, { preview: true });
                    contentToPreview = result.content;
                } catch (e) {
                    console.debug('[TextFlow] Preview execution failed:', e);
                    // Fallback to raw content on error
                }
            }

            preview.innerHTML = `<div style="white-space: pre-wrap;">${escapeHtml(contentToPreview)}</div>`;
        } else if (item.desc) {
            preview.innerHTML = `<div>${escapeHtml(item.desc)}</div>`;
        }
    }

    // =========================================
    // KEYBOARD HANDLING
    // =========================================
    function handleKeydown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            // Find next selectable item (skip sections)
            let nextIndex = selectedIndex + 1;
            while (nextIndex < filteredResults.length && filteredResults[nextIndex].type === 'section') {
                nextIndex++;
            }
            if (nextIndex < filteredResults.length) {
                selectedIndex = nextIndex;
                updateSelection();
                updatePreview();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            // Find previous selectable item (skip sections)
            let prevIndex = selectedIndex - 1;
            while (prevIndex >= 0 && filteredResults[prevIndex].type === 'section') {
                prevIndex--;
            }
            if (prevIndex >= 0) {
                selectedIndex = prevIndex;
                updateSelection();
                updatePreview();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            selectCurrentItem();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideOmnibar();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            tabComplete();
        } else if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Quick select needs to map visual number to data index
            const num = parseInt(e.key);
            let meaningfulIndex = -1;
            let visualCount = 0;

            // Find the Nth selectable item
            for (let i = 0; i < filteredResults.length; i++) {
                if (filteredResults[i].type !== 'section') {
                    visualCount++;
                    if (visualCount === num) {
                        meaningfulIndex = i;
                        break;
                    }
                }
            }

            if (meaningfulIndex !== -1) {
                e.preventDefault();
                selectedIndex = meaningfulIndex;
                updateSelection();
                selectCurrentItem();
            }
        } else if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            editSelectedSnippet();
        } else if (e.ctrlKey && e.key === 'c' && filteredResults[selectedIndex]?.content) {
            e.preventDefault();
            copySnippetContent();
        }
    }

    function selectCurrentItem() {
        const item = filteredResults[selectedIndex];
        if (!item) return;

        if (currentMode === 'command') {
            item.action?.();
            hideOmnibar();
        } else if (currentMode === 'create' && item.type === 'create') {
            createQuickSnippet(item.shortcut, item.content);
        } else if (currentMode === 'category' && item.type === 'category') {
            const input = omnibarEl.querySelector('.ste-omnibar-input');
            input.value = '#' + item.name + ' ';
            handleInput(input.value);
        } else if (item.shortcut) {
            insertSnippetFromOmnibar(item);
        }
    }

    function tabComplete() {
        if (filteredResults.length === 0) return;
        const item = filteredResults[selectedIndex];
        if (item?.shortcut) {
            const input = omnibarEl.querySelector('.ste-omnibar-input');
            input.value = item.shortcut;
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    // =========================================
    // ACTIONS
    // =========================================
    async function insertSnippetFromOmnibar(snippet) {
        // Get the saved element BEFORE hiding omnibar
        const targetElement = FocusStateManager.getElement('omnibar_restore');

        if (!targetElement || !isEditable(targetElement)) {
            console.log('[TextFlow] No editable element');
            hideOmnibar();
            return;
        }

        // Get raw content - prefer raw for local command processing
        let content = snippet.content;
        const isRichText = snippet.isRichText || false;

        console.log('[TextFlow] Processing snippet:', snippet.shortcut, 'Content:', content.slice(0, 100));
        console.log('[TextFlow] TextFlowParser available:', !!window.TextFlowParser);
        console.log('[TextFlow] TextFlowExecutor available:', !!window.TextFlowExecutor);
        console.log('[TextFlow] TextFlowFormModal available:', !!window.TextFlowFormModal);

        // Set up command executor context for dynamic commands
        if (window.TextFlowExecutor) {
            window.TextFlowExecutor.reset(); // Ensure clean state
            window.TextFlowExecutor.setContext({
                site: {
                    url: window.location.href,
                    title: document.title,
                    domain: window.location.hostname,
                    selection: getSelectionFromElement(targetElement)?.toString() || ''
                },
                snippets: snippets,
                user: {}
            });
        }

        // Decode HTML entities (from rich text editor) before command processing
        // This handles &nbsp;, &amp;, etc.
        const decodeHtmlEntities = (html) => {
            const txt = document.createElement('textarea');
            txt.innerHTML = html;
            return txt.value;
        };

        // Check if content has HTML entities and decode if needed
        if (content.includes('&') && content.includes(';')) {
            content = decodeHtmlEntities(content);
            console.log('[TextFlow] Decoded content:', content.slice(0, 100));
        }

        // Check for dynamic commands using new system
        const hasCommands = window.TextFlowParser?.hasCommands(content);
        console.log('[TextFlow] Has commands:', hasCommands);

        // Debug: Check what parser sees
        if (window.TextFlowParser) {
            const parsedCommands = window.TextFlowParser.parseAll(content);
            console.log('[TextFlow] Parsed commands:', parsedCommands);
            const formFields = window.TextFlowParser.extractFormFields(content);
            console.log('[TextFlow] Extracted form fields:', formFields);
        }

        if (hasCommands && window.TextFlowExecutor) {
            try {
                // First pass: check if forms are needed
                let result = await window.TextFlowExecutor.execute(content);
                console.log('[TextFlow] Execute result:', result);

                // If form is required, show modal (BEFORE hiding omnibar)
                if (result.requiresForm && result.formFields.length > 0) {
                    console.log('[TextFlow] Form required, fields:', result.formFields);

                    if (window.TextFlowFormModal) {
                        // Hide omnibar first so form modal is visible
                        hideOmnibar();

                        const formResult = await window.TextFlowFormModal.show(
                            result.formFields,
                            snippet.name || snippet.shortcut
                        );

                        console.log('[TextFlow] Form result:', formResult);

                        if (!formResult.submitted) {
                            return; // User cancelled
                        }

                        // Set form values and re-execute
                        console.log('[TextFlow] Setting form values:', formResult.values);
                        window.TextFlowExecutor.setFormValues(formResult.values);
                        console.log('[TextFlow] Re-executing with form values...');
                        result = await window.TextFlowExecutor.execute(content);
                        console.log('[TextFlow] Re-execution result:', result);
                    } else {
                        console.error('[TextFlow] TextFlowFormModal not available!');
                        hideOmnibar();
                    }
                } else {
                    // No form needed, hide omnibar now
                    hideOmnibar();
                }

                // Ensure we have a valid result
                if (!result || !result.content) {
                    console.error('[TextFlow] Invalid result after execution:', result);
                    hideOmnibar();
                    return;
                }

                content = result.content;
                console.log('[TextFlow] Processed content:', content.slice(0, 100));

                // Handle cursor positioning from {cursor} command
                if (result.cursorPosition >= 0) {
                    targetElement.focus();
                    await new Promise(r => setTimeout(r, 50));
                    await insertText(targetElement, 0, content);
                    const moveBack = content.length - result.cursorPosition;
                    if (moveBack > 0) {
                        await moveCursorBack(targetElement, moveBack);
                    }
                    saveRecentSnippet(snippet.shortcut);
                    incrementUsage(snippet.shortcut);
                    playExpansionSound();
                    return;
                }
                // If no cursor command, fall through to normal insertion below
                console.log('[TextFlow] No cursor command, proceeding to normal insertion');
            } catch (error) {
                console.error('[TextFlow] Command execution error:', error);
                showToast(`Error: ${error.message}`, 'error');
                hideOmnibar();
                return;
            }
        } else {
            // No commands or executor not available - hide omnibar first
            hideOmnibar();
            // Legacy support or no commands - try background expansion for simple date/time
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'EXPAND_SNIPPET',
                    payload: {
                        shortcut: snippet.shortcut,
                        context: {
                            url: window.location.href,
                            title: document.title,
                            selection: getSelectionFromElement(targetElement)?.toString() || '',
                        },
                    },
                });
                if (response?.expanded) {
                    content = response.expanded;
                }
            } catch {
                // Use raw content
            }
        }

        // Legacy support: Check for old {input:fieldname} syntax
        const dynamicVars = content.match(/\{input:([^}]+)\}/g);
        if (dynamicVars && dynamicVars.length > 0) {
            content = await promptForVariables(content, dynamicVars);
            if (content === null) return;
        }

        const cursorPlaceholder = '|cursor|';
        const cursorIndex = content.indexOf(cursorPlaceholder);
        const cleanContent = content.replace(cursorPlaceholder, '');

        // Google Docs - use GoogleDocsHandler bridge-based insertion
        // This communicates with inject.js in the main world via TextFlow_Req/TextFlow_Res
        // custom events, bypassing MV3 isolated world restrictions.
        if (window.GoogleDocsHandler && window.GoogleDocsHandler.isGoogleDocsEnv()) {
            await window.GoogleDocsHandler.expand(0, cleanContent, isRichText);
            saveRecentSnippet(snippet.shortcut);
            incrementUsage(snippet.shortcut);
            playExpansionSound();
            return;
        }

        console.log('[TextFlow] About to insert. cleanContent:', cleanContent.slice(0, 50));
        console.log('[TextFlow] Target element:', targetElement.tagName, targetElement);

        targetElement.focus();
        await new Promise(r => setTimeout(r, 50));

        const w = getElementWindow(targetElement);
        const tagName = targetElement.tagName?.toLowerCase();

        if (tagName === 'input' || (w.HTMLInputElement && targetElement instanceof w.HTMLInputElement) ||
            tagName === 'textarea' || (w.HTMLTextAreaElement && targetElement instanceof w.HTMLTextAreaElement)) {
            // Standard input/textarea handling
            const start = targetElement.selectionStart || 0;
            const end = targetElement.selectionEnd || 0;
            const value = targetElement.value;
            targetElement.value = value.slice(0, start) + cleanContent + value.slice(end);

            let newPos = start + cleanContent.length;
            if (cursorIndex >= 0) {
                newPos = start + cursorIndex;
            }
            targetElement.setSelectionRange(newPos, newPos);
            targetElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // ContentEditable handling with editor-specific awareness
            if (EditorDetector.needsSpecialCursor(targetElement) && cursorIndex >= 0) {
                // Use placeholder-based cursor positioning for rich editors
                await insertWithCursorPlaceholder(targetElement, cleanContent, cursorIndex);
            } else {
                // Standard contenteditable insertion
                const success = document.execCommand('insertText', false, cleanContent);
                if (!success) {
                    // Fallback for editors that block execCommand
                    const selection = getSelectionFromElement(targetElement);
                    if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(document.createTextNode(cleanContent));
                        range.collapse(false);
                    }
                }
                targetElement.dispatchEvent(new Event('input', { bubbles: true }));

                if (cursorIndex >= 0) {
                    const moveBack = cleanContent.length - cursorIndex;
                    await moveCursorBack(targetElement, moveBack);
                }
            }
        }

        saveRecentSnippet(snippet.shortcut);
        incrementUsage(snippet.shortcut);
    }

    // Insert with cursor placeholder for rich text editors
    async function insertWithCursorPlaceholder(element, content, cursorOffset) {
        // Insert content with placeholder
        const beforeCursor = content.slice(0, cursorOffset);
        const afterCursor = content.slice(cursorOffset);
        const contentWithPlaceholder = beforeCursor + CURSOR_PLACEHOLDER + afterCursor;

        // Insert the content
        document.execCommand('insertText', false, contentWithPlaceholder);
        element.dispatchEvent(new Event('input', { bubbles: true }));

        // Find and remove the placeholder, positioning cursor there
        await new Promise(r => setTimeout(r, 20));

        const selection = getSelectionFromElement(element);

        // Use TreeWalker to find placeholder in DOM
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            const index = node.textContent.indexOf(CURSOR_PLACEHOLDER);
            if (index !== -1) {
                // Found the placeholder - create range and delete it
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + CURSOR_PLACEHOLDER.length);

                selection.removeAllRanges();
                selection.addRange(range);

                // Delete the placeholder
                document.execCommand('delete');
                return;
            }
        }
    }

    async function createQuickSnippet(shortcut, content) {
        try {
            await chrome.runtime.sendMessage({
                type: 'SAVE_SNIPPET',
                payload: { shortcut, content, name: 'Quick snippet' }
            });
            snippets[shortcut] = { shortcut, content, name: 'Quick snippet' };
            hideOmnibar();
            showToast(`Created snippet: ${shortcut}`);
        } catch (error) {
            console.error('[TextFlow] Failed to create snippet:', error);
        }
    }

    function toggleExtension() {
        isEnabled = !isEnabled;
        chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED', payload: isEnabled });
        showToast(isEnabled ? 'TextFlow enabled' : 'TextFlow disabled');
    }

    function openSettings() {
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    }

    function openCreate() {
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS', payload: { create: true } });
    }

    async function exportSnippets() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'EXPORT_SNIPPETS' });
            if (response?.data) {
                const blob = new Blob([response.data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'textflow-snippets.json';
                a.click();
                URL.revokeObjectURL(url);
                showToast('Snippets exported!');
            }
        } catch (error) {
            console.error('[TextFlow] Export failed:', error);
        }
    }

    function importSnippets() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                await chrome.runtime.sendMessage({
                    type: 'IMPORT_SNIPPETS',
                    payload: { snippets: data.snippets || data, merge: true }
                });
                await loadSnippets();
                showToast('Snippets imported!');
            } catch (error) {
                console.error('[TextFlow] Import failed:', error);
                showToast('Import failed');
            }
        };
        input.click();
    }

    function clearRecent() {
        recentSnippets = [];
        localStorage.removeItem('textflow_recent');
        showToast('Recent history cleared');
    }

    function editSelectedSnippet() {
        const item = filteredResults[selectedIndex];
        if (item?.shortcut) {
            chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS', payload: { edit: item.shortcut } });
            hideOmnibar();
        }
    }

    function copySnippetContent() {
        const item = filteredResults[selectedIndex];
        if (item?.content) {
            navigator.clipboard.writeText(item.content);
            showToast('Copied to clipboard');
        }
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'ste-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    // =========================================
    // OMNIBAR LIFECYCLE
    // =========================================
    function showOmnibar() {
        if (omnibarOpen) return;

        // Save focus state using enhanced focus manager (traverses Shadow DOM)
        const activeEl = getActiveElement();
        FocusStateManager.save('omnibar_restore', activeEl);

        omnibarOpen = true;
        currentMode = 'search';
        createOmnibar();
    }

    function hideOmnibar() {
        if (!omnibarOpen) return;
        omnibarOpen = false;

        if (omnibarBackdrop) {
            omnibarBackdrop.remove();
            omnibarBackdrop = null;
        }
        if (omnibarEl) {
            omnibarEl.remove();
            omnibarEl = null;
        }

        filteredResults = [];
        selectedIndex = 0;

        // Restore focus state with full selection restoration
        FocusStateManager.restore('omnibar_restore');
        FocusStateManager.clear('omnibar_restore');
    }

    function toggleOmnibar() {
        omnibarOpen ? hideOmnibar() : showOmnibar();
    }

    // =========================================
    // EVENT LISTENERS
    // =========================================
    function setupListeners() {
        // Global keyboard shortcut (Ctrl+Shift+Space)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
                toggleOmnibar();
                return;
            }
        }, true);

        // Text expansion keydown listener with IME detection
        document.addEventListener('keydown', (e) => {
            if (omnibarOpen) return;

            // Try getActiveElement first (works for regular forms, shadow DOM).
            // Fall back to e.target when getActiveElement returns a non-editable
            // container (e.g. the offscreen input iframe in Google Docs).
            let target = getActiveElement();
            if (!isEditable(target)) target = e.target;
            if (!isEditable(target)) return;

            // Detect IME composition key (keyCode 229 = Process key)
            if (e.keyCode === 229 || e.key === 'Process' || e.key === 'Unidentified') {
                imeKeyCode229Detected = true;
                return; // Let composition events handle it
            }

            imeKeyCode229Detected = false;

            // Skip if in IME composition
            if (isIMEComposing) return;

            if (e.key === 'Backspace') {
                popBuffer();
            } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', 'Escape', 'Enter'].includes(e.key)) {
                clearBuffer();
            }
        }, true);

        // Keypress listener (skip during composition)
        document.addEventListener('keypress', (e) => {
            if (omnibarOpen || isIMEComposing || imeKeyCode229Detected) return;

            // Try getActiveElement first, fall back to e.target for iframe-based editors
            let target = getActiveElement();
            if (!isEditable(target)) target = e.target;
            if (!isEditable(target)) return;

            if (e.key && e.key.length === 1) {
                addToBuffer(target, e.key);
            }
        }, true);

        // Beforeinput listener with composition awareness
        document.addEventListener('beforeinput', (e) => {
            if (omnibarOpen) return;

            const target = getActiveElement() || e.target;
            if (!isEditable(target)) return;

            // Handle composition text specially
            if (e.isComposing || isIMEComposing) {
                // During composition, track but don't trigger shortcuts
                if (e.inputType === 'insertCompositionText' && e.data) {
                    // Don't add to buffer yet - wait for compositionend
                    lastCompositionData = e.data;
                }
                return;
            }

            if (e.inputType === 'insertText' && e.data) {
                // Add each character for multi-char insertions
                addToBuffer(target, e.data);
            } else if (e.inputType === 'deleteContentBackward') {
                popBuffer();
            } else if (e.inputType.includes('paste') || e.inputType.includes('drop')) {
                clearBuffer();
            } else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
                clearBuffer();
            }
        }, true);

        // =========================================
        // IME/COMPOSITION EVENT HANDLERS
        // =========================================
        document.addEventListener('compositionstart', (e) => {
            isIMEComposing = true;
            lastCompositionData = '';
            console.debug('[TextFlow] Composition started');
        }, true);

        document.addEventListener('compositionupdate', (e) => {
            // Track composition data but don't add to buffer yet
            lastCompositionData = e.data || '';
        }, true);

        document.addEventListener('compositionend', (e) => {
            if (omnibarOpen) {
                isIMEComposing = false;
                return;
            }

            const target = getActiveElement() || e.target;
            if (!isEditable(target)) {
                isIMEComposing = false;
                return;
            }

            isIMEComposing = false;
            imeKeyCode229Detected = false;

            // Add the final composed string to buffer
            if (e.data) {
                console.debug('[TextFlow] Composition ended with:', e.data);
                addToBuffer(target, e.data);
            }

            lastCompositionData = '';
        }, true);

        // =========================================
        // FOCUS/BLUR HANDLERS
        // =========================================
        document.addEventListener('focus', (e) => {
            // Clear buffer on focus change (user clicked different field)
            const target = e.target;
            if (isEditable(target)) {
                const currentBufferTarget = inputBuffer.lastTargetRef?.deref();
                if (currentBufferTarget && currentBufferTarget !== target &&
                    !currentBufferTarget.contains(target) && !target.contains(currentBufferTarget)) {
                    inputBuffer.clear('focus changed to different field');
                }
            }
        }, true);

        // =========================================
        // MUTATION OBSERVER FOR DYNAMIC ELEMENTS
        // =========================================
        setupMutationObserver();
    }

    // MutationObserver for dynamically added editable elements
    const registeredElements = new WeakSet();

    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check for new editable elements
                            if (isEditable(node)) {
                                registerEditableElement(node);
                            }
                            // Check children for editable elements
                            const editables = node.querySelectorAll?.(
                                'input:not([type="hidden"]), textarea, [contenteditable="true"], [contenteditable=""]'
                            );
                            editables?.forEach(registerEditableElement);
                        }
                    }
                } else if (mutation.type === 'attributes') {
                    if (mutation.attributeName === 'contenteditable') {
                        if (isEditable(mutation.target)) {
                            registerEditableElement(mutation.target);
                        }
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['contenteditable']
        });
    }

    function registerEditableElement(element) {
        if (!element || registeredElements.has(element)) return;
        registeredElements.add(element);
        console.debug('[TextFlow] Registered editable:', element.tagName, element.className);
    }

    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'SNIPPETS_UPDATED':
                    snippets = message.payload || {};
                    break;
                case 'SETTINGS_UPDATED':
                    isEnabled = message.payload?.enabled !== false;
                    break;
                case 'TOGGLE_ENABLED':
                    isEnabled = message.payload;
                    break;
                case 'TOGGLE_OMNIBAR':
                    toggleOmnibar();
                    break;
                case 'PING':
                    sendResponse({ pong: true });
                    break;
                case 'PICK_ELEMENT':
                    // Handle element picker request from options page
                    if (window.TextFlowElementPicker) {
                        window.TextFlowElementPicker.pick({
                            title: message.title || 'Click on an element to select it'
                        }).then(result => {
                            sendResponse(result);
                        });
                        return true; // Keep channel open for async response
                    } else {
                        sendResponse({ selected: false, error: 'Element picker not available' });
                    }
                    break;

                case 'EXTRACT_ELEMENTS':
                    // Handle remote extraction request from another tab
                    const { selector, attribute, multiple, trim } = message.payload;
                    let resultValue = '';

                    try {
                        const getVal = (el) => {
                            let val = '';
                            if (attribute) {
                                val = el.getAttribute(attribute) || '';
                            } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                                val = el.value;
                            } else if (el.tagName === 'IMG') {
                                val = el.src;
                            } else if (el.tagName === 'A' && !attribute) {
                                val = el.href;
                            } else {
                                val = el.textContent || '';
                            }

                            if (trim) {
                                if (trim === 'yes' || trim === 'true') val = val.trim();
                                else if (trim === 'left') val = val.trimStart();
                                else if (trim === 'right') val = val.trimEnd();
                            }
                            return val;
                        };

                        if (multiple) {
                            const elements = document.querySelectorAll(selector);
                            // Return as array if possible/serializable, but string is safer for simple text expansion
                            // The executor expects a string return usually, but let's return comma-joined for now
                            // consistent with local behavior I implemented
                            resultValue = Array.from(elements).map(getVal).join(', ');
                        } else {
                            const element = document.querySelector(selector);
                            if (element) {
                                resultValue = getVal(element);
                            }
                        }

                        sendResponse({ value: resultValue });
                    } catch (e) {
                        console.error('[TextFlow] Extraction error:', e);
                        sendResponse({ value: '', error: e.message });
                    }
                    break;
            }
            return true;
        });
    }

    // =========================================
    // INITIALIZE
    // =========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Debug access
    window.__TextFlow = {
        snippets: () => snippets,
        isEnabled: () => isEnabled,
        buffer: () => inputBuffer.toString(),
        bufferStream: () => [...inputBuffer.stream],
        toggleOmnibar,
        recentSnippets: () => recentSnippets,
        // New debug utilities
        EditorDetector,
        FocusStateManager,
        getActiveElement,
        isEditable,
        isIMEComposing: () => isIMEComposing,
        inputBuffer,
    };

})();
