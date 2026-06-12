/**
 * TextFlow Element Picker v1.0
 * Visual element selector - no more manual CSS selectors!
 * Click on any element to get its selector automatically.
 */

(function () {
    'use strict';

    class ElementPicker {
        constructor() {
            this.isActive = false;
            this.overlay = null;
            this.highlight = null;
            this.tooltip = null;
            this.resolvePromise = null;
            this.hoveredElement = null;
            this.boundMouseMove = this.handleMouseMove.bind(this);
            this.boundClick = this.handleClick.bind(this);
            this.boundKeydown = this.handleKeydown.bind(this);
            this.boundScroll = this.handleScroll.bind(this);
        }

        /**
         * Start element picker and return promise with selected selector
         */
        pick(options = {}) {
            return new Promise((resolve) => {
                this.resolvePromise = resolve;
                this.options = {
                    title: options.title || 'Click on an element',
                    filter: options.filter || null, // e.g., 'button, a, input'
                    showPreview: options.showPreview !== false,
                    ...options
                };
                this.activate();
            });
        }

        /**
         * Activate the picker
         */
        activate() {
            if (this.isActive) return;
            this.isActive = true;

            this.createOverlay();
            this.attachEvents();

            // Animate in
            requestAnimationFrame(() => {
                this.overlay.classList.add('tf-picker-active');
            });
        }

        /**
         * Create overlay elements
         */
        createOverlay() {
            // Main overlay (blocks interaction with page)
            this.overlay = document.createElement('div');
            this.overlay.className = 'tf-picker-overlay';
            this.overlay.innerHTML = `
                <div class="tf-picker-instructions">
                    <div class="tf-picker-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5.52 19l2.92-9.2c.24-.75 1.32-.79 1.61-.06l3.43 8.7a.9.9 0 0 0 1.51.3l2.97-2.97"/>
                            <path d="M9 3.5V2m0 1.5V5m0-1.5H7.5M9 3.5H10.5"/>
                        </svg>
                    </div>
                    <div class="tf-picker-text">
                        <strong>${this.options.title}</strong>
                        <span>Press ESC to cancel</span>
                    </div>
                </div>
            `;

            // Highlight box (follows cursor)
            this.highlight = document.createElement('div');
            this.highlight.className = 'tf-picker-highlight';

            // Tooltip showing element info
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'tf-picker-tooltip';

            document.body.appendChild(this.overlay);
            document.body.appendChild(this.highlight);
            document.body.appendChild(this.tooltip);

            this.injectStyles();
        }

        /**
         * Inject picker styles
         */
        injectStyles() {
            if (document.getElementById('tf-picker-styles')) return;

            const styles = document.createElement('style');
            styles.id = 'tf-picker-styles';
            styles.textContent = `
                .tf-picker-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 2147483640;
                    cursor: crosshair;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                
                .tf-picker-overlay.tf-picker-active {
                    opacity: 1;
                }
                
                .tf-picker-instructions {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 20px;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 14px;
                    box-shadow: 
                        0 10px 40px rgba(0, 0, 0, 0.4),
                        0 0 1px rgba(255, 255, 255, 0.1);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    z-index: 2147483645;
                    animation: tf-picker-slide-in 0.3s ease;
                }
                
                @keyframes tf-picker-slide-in {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
                
                .tf-picker-icon {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 10px;
                }
                
                .tf-picker-icon svg {
                    width: 22px;
                    height: 22px;
                    color: white;
                }
                
                .tf-picker-text {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .tf-picker-text strong {
                    color: white;
                    font-size: 14px;
                    font-weight: 600;
                }
                
                .tf-picker-text span {
                    color: #9ca3af;
                    font-size: 12px;
                }
                
                .tf-picker-highlight {
                    position: fixed;
                    pointer-events: none;
                    z-index: 2147483642;
                    border: 2px solid #667eea;
                    background: rgba(102, 126, 234, 0.1);
                    border-radius: 4px;
                    transition: all 0.1s ease;
                    opacity: 0;
                    box-shadow: 
                        0 0 0 2px rgba(102, 126, 234, 0.3),
                        inset 0 0 20px rgba(102, 126, 234, 0.1);
                }
                
                .tf-picker-highlight.tf-picker-visible {
                    opacity: 1;
                }
                
                .tf-picker-tooltip {
                    position: fixed;
                    pointer-events: none;
                    z-index: 2147483646;
                    padding: 8px 12px;
                    background: #1a1a2e;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 11px;
                    color: #10b981;
                    max-width: 350px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.15s ease;
                }
                
                .tf-picker-tooltip.tf-picker-visible {
                    opacity: 1;
                }
                
                .tf-picker-tooltip .tf-tag {
                    color: #818cf8;
                }
                
                .tf-picker-tooltip .tf-id {
                    color: #f59e0b;
                }
                
                .tf-picker-tooltip .tf-class {
                    color: #22d3ee;
                }
                
                /* Dimming effect on page elements */
                .tf-picker-overlay::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.1);
                }
            `;
            document.head.appendChild(styles);
        }

        /**
         * Attach event listeners
         */
        attachEvents() {
            document.addEventListener('mousemove', this.boundMouseMove, true);
            document.addEventListener('click', this.boundClick, true);
            document.addEventListener('keydown', this.boundKeydown, true);
            document.addEventListener('scroll', this.boundScroll, true);
        }

        /**
         * Remove event listeners
         */
        removeEvents() {
            document.removeEventListener('mousemove', this.boundMouseMove, true);
            document.removeEventListener('click', this.boundClick, true);
            document.removeEventListener('keydown', this.boundKeydown, true);
            document.removeEventListener('scroll', this.boundScroll, true);
        }

        /**
         * Handle mouse movement
         */
        handleMouseMove(e) {
            // Get element under cursor (skip our overlay elements)
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            let target = null;

            for (const el of elements) {
                if (el.classList.contains('tf-picker-overlay') ||
                    el.classList.contains('tf-picker-highlight') ||
                    el.classList.contains('tf-picker-tooltip') ||
                    el.classList.contains('tf-picker-instructions')) {
                    continue;
                }

                // Apply filter if specified
                if (this.options.filter) {
                    if (el.matches(this.options.filter)) {
                        target = el;
                        break;
                    }
                } else {
                    target = el;
                    break;
                }
            }

            if (target && target !== this.hoveredElement) {
                this.hoveredElement = target;
                this.updateHighlight(target);
                this.updateTooltip(target, e);
            } else if (target) {
                // Just update tooltip position
                this.positionTooltip(e);
            } else if (!target && this.hoveredElement) {
                this.hoveredElement = null;
                this.hideHighlight();
            }
        }

        /**
         * Update highlight position
         */
        updateHighlight(element) {
            const rect = element.getBoundingClientRect();

            this.highlight.style.left = `${rect.left}px`;
            this.highlight.style.top = `${rect.top}px`;
            this.highlight.style.width = `${rect.width}px`;
            this.highlight.style.height = `${rect.height}px`;
            this.highlight.classList.add('tf-picker-visible');
        }

        /**
         * Update tooltip content and position
         */
        updateTooltip(element, e) {
            const selector = this.getSelector(element);
            const displayText = this.formatSelectorDisplay(element);

            this.tooltip.innerHTML = displayText;
            this.tooltip.classList.add('tf-picker-visible');
            this.positionTooltip(e);
        }

        /**
         * Position tooltip near cursor
         */
        positionTooltip(e) {
            const offset = 15;
            let x = e.clientX + offset;
            let y = e.clientY + offset;

            // Keep tooltip on screen
            const rect = this.tooltip.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) {
                x = e.clientX - rect.width - offset;
            }
            if (y + rect.height > window.innerHeight) {
                y = e.clientY - rect.height - offset;
            }

            this.tooltip.style.left = `${x}px`;
            this.tooltip.style.top = `${y}px`;
        }

        /**
         * Hide highlight and tooltip
         */
        hideHighlight() {
            this.highlight.classList.remove('tf-picker-visible');
            this.tooltip.classList.remove('tf-picker-visible');
        }

        /**
         * Handle scroll - update highlight position
         */
        handleScroll() {
            if (this.hoveredElement) {
                this.updateHighlight(this.hoveredElement);
            }
        }

        /**
         * Handle element click
         */
        handleClick(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (!this.hoveredElement) {
                return;
            }

            const selector = this.getSelector(this.hoveredElement);
            const element = this.hoveredElement;

            this.deactivate();

            if (this.resolvePromise) {
                this.resolvePromise({
                    selected: true,
                    selector: selector,
                    element: {
                        tagName: element.tagName.toLowerCase(),
                        id: element.id,
                        className: element.className,
                        text: element.textContent?.trim().substring(0, 50) || '',
                        type: element.type || null,
                        name: element.name || null,
                        value: element.value || null
                    }
                });
            }
        }

        /**
         * Handle keyboard events
         */
        handleKeydown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancel();
            }
        }

        /**
         * Cancel selection
         */
        cancel() {
            this.deactivate();

            if (this.resolvePromise) {
                this.resolvePromise({
                    selected: false,
                    selector: null,
                    element: null
                });
            }
        }

        /**
         * Deactivate picker
         */
        deactivate() {
            this.isActive = false;
            this.removeEvents();

            // Animate out
            if (this.overlay) {
                this.overlay.classList.remove('tf-picker-active');
                setTimeout(() => {
                    this.overlay?.remove();
                    this.highlight?.remove();
                    this.tooltip?.remove();
                    this.overlay = null;
                    this.highlight = null;
                    this.tooltip = null;
                }, 200);
            }

            this.hoveredElement = null;
        }

        /**
         * Generate optimal CSS selector for element
         */
        getSelector(element) {
            // Priority 1: ID
            if (element.id) {
                return `#${CSS.escape(element.id)}`;
            }

            // Priority 2: Unique combination of tag + classes
            const tag = element.tagName.toLowerCase();

            // Priority 3: data-* attributes (common in modern frameworks)
            for (const attr of element.attributes) {
                if (attr.name.startsWith('data-') && attr.value) {
                    const selector = `${tag}[${attr.name}="${CSS.escape(attr.value)}"]`;
                    if (this.isUnique(selector)) {
                        return selector;
                    }
                }
            }

            // Priority 4: Name attribute (for form elements)
            if (element.name) {
                const selector = `${tag}[name="${CSS.escape(element.name)}"]`;
                if (this.isUnique(selector)) {
                    return selector;
                }
            }

            // Priority 5: Type attribute for inputs
            if (element.type && tag === 'input') {
                const selector = `input[type="${element.type}"]`;
                const matches = document.querySelectorAll(selector);
                if (matches.length === 1) {
                    return selector;
                }
            }

            // Priority 6: Class combinations
            if (element.className && typeof element.className === 'string') {
                const classes = element.className.trim().split(/\s+/).filter(c => c && !c.startsWith('tf-'));

                // Try single most specific class first
                for (const cls of classes) {
                    const selector = `${tag}.${CSS.escape(cls)}`;
                    if (this.isUnique(selector)) {
                        return selector;
                    }
                }

                // Try combinations of classes
                if (classes.length > 1) {
                    const selector = `${tag}.${classes.map(c => CSS.escape(c)).join('.')}`;
                    if (this.isUnique(selector)) {
                        return selector;
                    }
                }
            }

            // Priority 7: nth-child with parent context
            const parent = element.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children);
                const index = siblings.indexOf(element) + 1;
                const parentSelector = this.getParentSelector(parent);

                if (parentSelector) {
                    return `${parentSelector} > ${tag}:nth-child(${index})`;
                }
            }

            // Fallback: Build path
            return this.buildPath(element);
        }

        /**
         * Get a short selector for parent
         */
        getParentSelector(element) {
            if (element.id) {
                return `#${CSS.escape(element.id)}`;
            }

            const tag = element.tagName.toLowerCase();

            if (element.className && typeof element.className === 'string') {
                const classes = element.className.trim().split(/\s+/).filter(c => c && !c.startsWith('tf-'));
                if (classes.length > 0) {
                    const selector = `${tag}.${CSS.escape(classes[0])}`;
                    if (this.isUnique(selector)) {
                        return selector;
                    }
                }
            }

            return null;
        }

        /**
         * Build full path selector
         */
        buildPath(element, maxDepth = 3) {
            const path = [];
            let current = element;
            let depth = 0;

            while (current && current !== document.body && depth < maxDepth) {
                const tag = current.tagName.toLowerCase();

                if (current.id) {
                    path.unshift(`#${CSS.escape(current.id)}`);
                    break;
                }

                const parent = current.parentElement;
                if (parent) {
                    const siblings = Array.from(parent.children).filter(
                        c => c.tagName === current.tagName
                    );
                    if (siblings.length > 1) {
                        const index = siblings.indexOf(current) + 1;
                        path.unshift(`${tag}:nth-of-type(${index})`);
                    } else {
                        path.unshift(tag);
                    }
                } else {
                    path.unshift(tag);
                }

                current = parent;
                depth++;
            }

            return path.join(' > ');
        }

        /**
         * Check if selector matches only one element
         */
        isUnique(selector) {
            try {
                return document.querySelectorAll(selector).length === 1;
            } catch {
                return false;
            }
        }

        /**
         * Format selector for display in tooltip
         */
        formatSelectorDisplay(element) {
            const tag = element.tagName.toLowerCase();
            let html = `<span class="tf-tag">${tag}</span>`;

            if (element.id) {
                html += `<span class="tf-id">#${element.id}</span>`;
            }

            if (element.className && typeof element.className === 'string') {
                const classes = element.className.trim().split(/\s+/)
                    .filter(c => c && !c.startsWith('tf-'))
                    .slice(0, 3);
                if (classes.length > 0) {
                    html += `<span class="tf-class">.${classes.join('.')}</span>`;
                }
            }

            return html;
        }
    }

    // Export
    window.TextFlowElementPicker = new ElementPicker();
})();
