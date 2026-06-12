/**
 * CursorManager - Smart Text Expander
 * Handles cursor positioning after text insertion
 */

export const CursorManager = {
    /**
     * Get current caret position coordinates
     */
    getCaretPosition(element: Element): DOMRect | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);

        // Try to get rect from range
        let rect = range.getBoundingClientRect();

        // If range rect is zero-sized (collapsed), use fallback
        if (rect.width === 0 && rect.height === 0) {
            return this.getCaretRectFallback(range, element);
        }

        return rect;
    },

    /**
     * Fallback method to get caret rect using temporary span
     */
    getCaretRectFallback(range: Range, element: Element): DOMRect | null {
        try {
            const span = document.createElement('span');
            span.textContent = '\u200B'; // Zero-width space

            const clonedRange = range.cloneRange();
            clonedRange.collapse(false);
            clonedRange.insertNode(span);

            const rect = span.getBoundingClientRect();
            span.remove();

            return rect;
        } catch {
            return null;
        }
    },

    /**
     * Get caret position for input/textarea elements
     */
    getCaretPositionForInput(element: HTMLInputElement | HTMLTextAreaElement): number {
        return element.selectionStart ?? 0;
    },

    /**
     * Move cursor backwards by a number of characters
     * Uses arrow key simulation for complex editors
     */
    async moveCursorBackwards(direction: 'ltr' | 'rtl', count: number): Promise<void> {
        const key = direction === 'ltr' ? 'ArrowLeft' : 'ArrowRight';

        for (let i = 0; i < count; i++) {
            const event = new KeyboardEvent('keydown', {
                key,
                code: key,
                bubbles: true,
                cancelable: true,
            });
            document.activeElement?.dispatchEvent(event);

            // Small delay between key presses
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    },

    /**
     * Position cursor at a specific offset in a contenteditable
     */
    positionCursorInDOM(
        element: Element,
        offset: number
    ): boolean {
        try {
            const selection = window.getSelection();
            if (!selection) return false;

            // Find the text node and offset
            const { node, offset: actualOffset } = this.findTextNodeAtOffset(element, offset);

            if (node) {
                const range = document.createRange();
                range.setStart(node, actualOffset);
                range.collapse(true);

                selection.removeAllRanges();
                selection.addRange(range);
                return true;
            }
        } catch (error) {
            console.error('[CursorManager] Failed to position cursor:', error);
        }

        return false;
    },

    /**
     * Find text node at a given character offset
     */
    findTextNodeAtOffset(
        element: Element,
        targetOffset: number
    ): { node: Node | null; offset: number } {
        let currentOffset = 0;

        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null
        );

        let node: Text | null;
        while ((node = walker.nextNode() as Text)) {
            const nodeLength = node.textContent?.length ?? 0;

            if (currentOffset + nodeLength >= targetOffset) {
                return {
                    node,
                    offset: targetOffset - currentOffset,
                };
            }

            currentOffset += nodeLength;
        }

        // Return last position if offset exceeds content
        return { node: null, offset: 0 };
    },

    /**
     * Calculate text offset from HTML content
     */
    calculateOffsetFromHTML(html: string, htmlOffset: number): number {
        // Strip HTML tags and count characters
        const beforeOffset = html.slice(0, htmlOffset);
        const textContent = beforeOffset.replace(/<[^>]*>/g, '');
        return textContent.length;
    },

    /**
     * Move cursor after insertion
     * Main entry point for cursor positioning
     */
    async moveCursor(
        cursorOffset: number,
        element: Element,
        direction: 'ltr' | 'rtl',
        isIntegrated: boolean,
        contentLength: number
    ): Promise<void> {
        if (cursorOffset <= 0) {
            return;
        }

        // Calculate how far back from end we need to move
        const moveBackCount = contentLength - cursorOffset;

        if (moveBackCount <= 0) {
            return;
        }

        if (isIntegrated) {
            // For integrated editors, use arrow key simulation
            await this.moveCursorBackwards(direction, moveBackCount);
        } else {
            // For standard inputs, try DOM-based positioning
            const tagName = element.tagName.toLowerCase();

            if (tagName === 'input' || tagName === 'textarea') {
                const input = element as HTMLInputElement | HTMLTextAreaElement;
                const currentPos = input.selectionStart ?? input.value.length;
                const newPos = Math.max(0, currentPos - moveBackCount);
                input.setSelectionRange(newPos, newPos);
            } else {
                // ContentEditable - try DOM positioning first, fall back to arrow keys
                const success = this.positionCursorInDOM(element, cursorOffset);
                if (!success) {
                    await this.moveCursorBackwards(direction, moveBackCount);
                }
            }
        }
    },

    /**
     * Get text direction from element
     */
    getTextDirection(element: Element): 'ltr' | 'rtl' {
        const computed = window.getComputedStyle(element);
        return computed.direction as 'ltr' | 'rtl';
    },

    /**
     * Handle |cursor| placeholder positioning
     * Returns the offset where cursor should be placed, or -1 if no placeholder
     */
    findCursorPlaceholder(content: string): {
        cleanContent: string;
        cursorOffset: number;
    } {
        const placeholder = '|cursor|';
        const index = content.indexOf(placeholder);

        if (index === -1) {
            return { cleanContent: content, cursorOffset: -1 };
        }

        const cleanContent = content.replace(placeholder, '');
        return { cleanContent, cursorOffset: index };
    },
};

export default CursorManager;
