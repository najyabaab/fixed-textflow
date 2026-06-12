/**
 * TypingStream - Smart Text Expander
 * Manages typing detection and shortcut matching with proper target tracking
 */

import EditorDetector from './editorDetector';
import type { SnippetMap } from '@/lib/types';

interface StreamEntry {
    char: string;
    timestamp: number;
}

type ShortcutCallback = (element: Element, shortcut: string) => void;

export const TypingStream = {
    stream: [] as StreamEntry[],
    baseResetTimeout: 2000,
    resetTimeout: 2000,
    timer: null as ReturnType<typeof setTimeout> | null,
    previousTarget: null as Element | null,
    shortcutCallback: null as ShortcutCallback | null,
    isIMEHandling: false,
    snippets: {} as SnippetMap,

    /**
     * Initialize the typing stream
     */
    init() {
        console.log('[TypingStream] Initialized');
        this.setupListeners();
    },

    /**
     * Set snippets for lookup
     */
    setSnippets(snippets: SnippetMap) {
        this.snippets = snippets;
    },

    /**
     * Set the reset timeout (minimum 800ms)
     */
    setResetTimeout(ms: number) {
        this.resetTimeout = Math.max(800, ms);
        this.baseResetTimeout = this.resetTimeout;
    },

    /**
     * Reset the auto-clear timer
     */
    resetTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
            this.empty('timeout');
        }, this.resetTimeout);
    },

    /**
     * Add a character to the stream
     */
    add(target: Element, key: string, isComposition = false) {
        // Check target change
        if (!this.checkTarget(target)) {
            return;
        }

        // Add to stream
        this.stream.push({
            char: key,
            timestamp: Date.now(),
        });

        // Keep stream reasonably sized
        if (this.stream.length > 100) {
            this.stream.shift();
        }

        this.resetTimer();

        // Check for shortcuts
        if (!isComposition) {
            this.lookupShortcuts(target);
        }
    },

    /**
     * Check and update target tracking
     */
    checkTarget(target: Element): boolean {
        if (this.previousTarget && this.previousTarget !== target) {
            this.empty('target-change');
        }

        this.previousTarget = target;
        return EditorDetector.isEditable(target);
    },

    /**
     * Remove last character (backspace)
     */
    pop(target: Element) {
        if (!this.checkTarget(target)) {
            return;
        }

        if (this.stream.length > 0) {
            this.stream.pop();
        }

        this.resetTimer();
    },

    /**
     * Clear the stream
     */
    empty(reason: string = 'manual') {
        if (this.stream.length > 0) {
            console.log(`[TypingStream] Cleared (${reason})`);
        }
        this.stream = [];
        this.previousTarget = null;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    },

    /**
     * Get current stream as string
     */
    toString(): string {
        return this.stream.map(e => e.char).join('');
    },

    /**
     * Get the buffer string (alias)
     */
    getBuffer(): string {
        return this.toString();
    },

    /**
     * Clear the buffer (alias)
     */
    clearBuffer() {
        this.empty('clear');
    },

    /**
     * Register shortcut callback
     */
    onShortcutMatch(callback: ShortcutCallback) {
        this.shortcutCallback = callback;
    },

    /**
     * Look up shortcuts in current stream
     */
    lookupShortcuts(target: Element) {
        const buffer = this.toString();

        if (buffer.length < 2) {
            return;
        }

        // Find matching shortcut
        for (const shortcut of Object.keys(this.snippets)) {
            if (buffer.endsWith(shortcut)) {
                console.log(`[TypingStream] Matched: ${shortcut}`);

                if (this.shortcutCallback) {
                    this.shortcutCallback(target, shortcut);
                }

                // Clear stream after match
                this.empty('matched');
                return;
            }
        }
    },

    /**
     * Check if element is editable
     */
    isEditable(element: Element): boolean {
        return EditorDetector.isEditable(element);
    },

    /**
     * Setup event listeners
     */
    setupListeners() {
        // Keydown for special keys
        document.addEventListener('keydown', (e) => this.handleKeydown(e), true);

        // Keypress for character input (non-IME)
        document.addEventListener('keypress', (e) => this.handleKeypress(e), true);

        // BeforeInput for modern input API
        document.addEventListener('beforeinput', (e) => this.handleBeforeInput(e), true);

        // Composition for IME input
        document.addEventListener('compositionend', (e) => this.handleCompositionEnd(e), true);

        // Composition start - flag IME handling
        document.addEventListener('compositionstart', () => {
            this.isIMEHandling = true;
        }, true);
    },

    /**
     * Handle keydown events
     */
    handleKeydown(e: KeyboardEvent) {
        const target = e.target as Element;

        if (!this.isEditable(target)) {
            return;
        }

        // Backspace - remove last char
        if (e.key === 'Backspace') {
            this.pop(target);
            return;
        }

        // Navigation/special keys clear the buffer
        if ([
            'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
            'Home', 'End', 'PageUp', 'PageDown',
            'Tab', 'Escape'
        ].includes(e.key)) {
            this.empty('navigation');
            return;
        }

        // Enter can be trigger
        if (e.key === 'Enter') {
            this.empty('enter');
            return;
        }
    },

    /**
     * Handle keypress events (character input, non-IME)
     */
    handleKeypress(e: KeyboardEvent) {
        if (this.isIMEHandling) {
            return;
        }

        const target = e.target as Element;

        if (!this.isEditable(target)) {
            return;
        }

        if (e.key && e.key.length === 1) {
            this.add(target, e.key);
        }
    },

    /**
     * Handle beforeinput events (modern input API)
     */
    handleBeforeInput(e: InputEvent) {
        const target = e.target as Element;

        if (!this.isEditable(target)) {
            return;
        }

        // Handle insertText
        if (e.inputType === 'insertText' && e.data) {
            // Single character inserts
            if (e.data.length === 1 && !this.isIMEHandling) {
                this.add(target, e.data);
            }
        }

        // Handle deletions
        if (e.inputType === 'deleteContentBackward') {
            this.pop(target);
        }

        // Handle paste/drop - clear buffer
        if (e.inputType.includes('paste') || e.inputType.includes('drop')) {
            this.empty('paste');
        }
    },

    /**
     * Handle composition end (IME finalization)
     */
    handleCompositionEnd(e: CompositionEvent) {
        this.isIMEHandling = false;

        const target = e.target as Element;

        if (!this.isEditable(target)) {
            return;
        }

        // Add the final composed text
        if (e.data) {
            for (const char of e.data) {
                this.add(target, char, true);
            }
            // Check for shortcuts after full composition
            this.lookupShortcuts(target);
        }
    },
};

export default TypingStream;
