/**
 * Rich Text Editor - WYSIWYG Editor for Snippet Content
 * Provides formatting toolbar with Bold, Italic, Links, Lists, Colors, and Command integration
 */

(function () {
    'use strict';

    // Allowed HTML tags for sanitization
    const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'del', 'a',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'p', 'br',
        'span', 'div', 'blockquote'];
    const ALLOWED_ATTRS = ['href', 'target', 'style', 'class'];
    const ALLOWED_STYLE_PROPS = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration'];

    // Color palette for text colors
    const COLOR_PALETTE = [
        { name: 'Default', value: 'inherit' },
        { name: 'Red', value: '#ef4444' },
        { name: 'Orange', value: '#f97316' },
        { name: 'Yellow', value: '#eab308' },
        { name: 'Green', value: '#22c55e' },
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Purple', value: '#a855f7' },
        { name: 'Pink', value: '#ec4899' },
        { name: 'Gray', value: '#6b7280' },
    ];

    class RichTextEditor {
        constructor(container, options = {}) {
            this.container = container;
            this.options = {
                placeholder: 'Type your snippet content here...',
                onContentChange: null,
                onCommandInsert: null,
                ...options
            };

            this.editor = null;
            this.toolbar = null;
            this.hiddenTextarea = null;
            this.colorPicker = null;
            this.linkModal = null;
            this.savedRange = null; // Save cursor position for command insertion

            this.init();
        }

        init() {
            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'rte-wrapper';

            // Create toolbar
            this.toolbar = this.createToolbar();
            wrapper.appendChild(this.toolbar);

            // Create editor
            this.editor = document.createElement('div');
            this.editor.className = 'rte-editor';
            this.editor.contentEditable = 'true';
            this.editor.setAttribute('data-placeholder', this.options.placeholder);
            this.editor.spellcheck = true;
            wrapper.appendChild(this.editor);

            // Create warning notice
            const warning = document.createElement('div');
            warning.className = 'rte-warning';
            warning.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                </svg>
                <span>Rich formatting works in Gmail, Docs, Notion, etc. Plain text fields will show text only.</span>
            `;
            wrapper.appendChild(warning);

            // Create hidden textarea for form submission
            this.hiddenTextarea = document.createElement('textarea');
            this.hiddenTextarea.className = 'rte-hidden';
            this.hiddenTextarea.style.display = 'none';
            wrapper.appendChild(this.hiddenTextarea);

            // Insert into container
            this.container.innerHTML = '';
            this.container.appendChild(wrapper);

            // Bind events
            this.bindEvents();
        }

        createToolbar() {
            const toolbar = document.createElement('div');
            toolbar.className = 'rte-toolbar';

            // Format buttons group (compact B/I/U)
            const formatGroup = this.createButtonGroup([
                { cmd: 'bold', icon: 'B', title: 'Bold (Ctrl+B)', style: 'font-weight: bold' },
                { cmd: 'italic', icon: 'I', title: 'Italic (Ctrl+I)', style: 'font-style: italic' },
                { cmd: 'underline', icon: 'U', title: 'Underline (Ctrl+U)', style: 'text-decoration: underline' },
            ]);
            formatGroup.classList.add('rte-format-group');
            toolbar.appendChild(formatGroup);

            // Separator
            toolbar.appendChild(this.createSeparator());

            // Link button
            const linkBtn = this.createButton({
                cmd: 'link',
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>`,
                title: 'Insert Link (Ctrl+K)',
                isHTML: true
            });
            toolbar.appendChild(linkBtn);

            // Separator
            toolbar.appendChild(this.createSeparator());

            // List dropdown button
            const listBtn = document.createElement('div');
            listBtn.className = 'rte-list-dropdown';
            listBtn.innerHTML = `
                <button type="button" class="rte-btn rte-list-btn" title="Insert List">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <circle cx="4" cy="6" r="1" fill="currentColor"></circle>
                        <circle cx="4" cy="12" r="1" fill="currentColor"></circle>
                        <circle cx="4" cy="18" r="1" fill="currentColor"></circle>
                    </svg>
                    <svg class="rte-dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="rte-list-menu">
                    <button type="button" class="rte-list-option" data-cmd="insertUnorderedList">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <line x1="8" y1="6" x2="21" y2="6"></line>
                            <line x1="8" y1="12" x2="21" y2="12"></line>
                            <line x1="8" y1="18" x2="21" y2="18"></line>
                            <circle cx="4" cy="6" r="1" fill="currentColor"></circle>
                            <circle cx="4" cy="12" r="1" fill="currentColor"></circle>
                            <circle cx="4" cy="18" r="1" fill="currentColor"></circle>
                        </svg>
                        <span>Bullet List</span>
                    </button>
                    <button type="button" class="rte-list-option" data-cmd="insertOrderedList">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <line x1="10" y1="6" x2="21" y2="6"></line>
                            <line x1="10" y1="12" x2="21" y2="12"></line>
                            <line x1="10" y1="18" x2="21" y2="18"></line>
                            <text x="2" y="7" font-size="6" fill="currentColor">1</text>
                            <text x="2" y="13" font-size="6" fill="currentColor">2</text>
                            <text x="2" y="19" font-size="6" fill="currentColor">3</text>
                        </svg>
                        <span>Numbered List</span>
                    </button>
                </div>
            `;

            // List dropdown toggle
            const listToggle = listBtn.querySelector('.rte-list-btn');
            const listMenu = listBtn.querySelector('.rte-list-menu');
            listToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                listBtn.classList.toggle('open');
            });

            // List option clicks
            listBtn.querySelectorAll('.rte-list-option').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.preventDefault();
                    const cmd = opt.dataset.cmd;
                    this.editor.focus();
                    document.execCommand(cmd, false, null);
                    this.syncToHidden();
                    listBtn.classList.remove('open');
                });
            });

            // Close dropdown on outside click
            document.addEventListener('click', (e) => {
                if (!listBtn.contains(e.target)) {
                    listBtn.classList.remove('open');
                }
            });

            toolbar.appendChild(listBtn);

            // Separator
            toolbar.appendChild(this.createSeparator());

            // Color picker button
            const colorBtn = document.createElement('button');
            colorBtn.type = 'button';
            colorBtn.className = 'rte-btn rte-color-btn';
            colorBtn.title = 'Text Color';
            colorBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M4 20h16"></path>
                    <path d="M6 16l6-12 6 12"></path>
                    <path d="M8 12h8"></path>
                </svg>
                <span class="rte-color-indicator"></span>
            `;
            colorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleColorPicker(colorBtn);
            });
            toolbar.appendChild(colorBtn);

            // Spacer to push command button to right
            const spacer = document.createElement('div');
            spacer.className = 'rte-toolbar-spacer';
            toolbar.appendChild(spacer);

            // Command insert button (prominent, right-aligned)
            const cmdBtn = document.createElement('button');
            cmdBtn.type = 'button';
            cmdBtn.className = 'rte-btn rte-cmd-btn';
            cmdBtn.title = 'Insert Dynamic Variable';
            cmdBtn.innerHTML = `
                <span class="rte-cmd-icon">⚡</span>
                <span class="rte-cmd-text">Insert Variable</span>
            `;
            cmdBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.insertCommand();
            });
            toolbar.appendChild(cmdBtn);

            return toolbar;
        }

        createButtonGroup(buttons) {
            const group = document.createElement('div');
            group.className = 'rte-btn-group';

            buttons.forEach(btn => {
                group.appendChild(this.createButton(btn));
            });

            return group;
        }

        createButton(config) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rte-btn';
            btn.title = config.title;
            btn.setAttribute('data-cmd', config.cmd);

            if (config.style) {
                btn.style.cssText = config.style;
            }

            if (config.isHTML) {
                btn.innerHTML = config.icon;
            } else {
                btn.textContent = config.icon;
            }

            btn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent focus loss
            });

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.execCommand(config.cmd, config.custom);
            });

            return btn;
        }

        createSeparator() {
            const sep = document.createElement('div');
            sep.className = 'rte-separator';
            return sep;
        }

        bindEvents() {
            // Input handling
            this.editor.addEventListener('input', () => {
                this.syncToHidden();
                this.updateToolbarState();
                if (this.options.onContentChange) {
                    this.options.onContentChange(this.getContent());
                }
            });

            // Paste handling - sanitize pasted HTML
            this.editor.addEventListener('paste', (e) => {
                e.preventDefault();
                const html = e.clipboardData.getData('text/html');
                const text = e.clipboardData.getData('text/plain');

                if (html) {
                    const sanitized = this.sanitizeHTML(html);
                    document.execCommand('insertHTML', false, sanitized);
                } else {
                    document.execCommand('insertText', false, text);
                }
                this.syncToHidden();
            });

            // Keyboard shortcuts
            this.editor.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    switch (e.key.toLowerCase()) {
                        case 'b':
                            e.preventDefault();
                            this.execCommand('bold');
                            break;
                        case 'i':
                            e.preventDefault();
                            this.execCommand('italic');
                            break;
                        case 'u':
                            e.preventDefault();
                            this.execCommand('underline');
                            break;
                        case 'k':
                            e.preventDefault();
                            this.showLinkModal();
                            break;
                    }
                }
            });

            // Selection change to update toolbar
            document.addEventListener('selectionchange', () => {
                if (this.editor.contains(document.activeElement)) {
                    this.updateToolbarState();
                }
            });

            // Focus/blur
            this.editor.addEventListener('focus', () => {
                this.editor.classList.add('focused');
            });

            this.editor.addEventListener('blur', () => {
                this.editor.classList.remove('focused');
                // Save cursor position when editor loses focus
                this.saveCursorPosition();
            });

            // Close color picker on click outside
            document.addEventListener('click', (e) => {
                if (this.colorPicker && !this.colorPicker.contains(e.target) &&
                    !e.target.closest('.rte-color-btn')) {
                    this.hideColorPicker();
                }
            });
        }

        execCommand(cmd, isCustom = false) {
            this.editor.focus();

            if (isCustom) {
                switch (cmd) {
                    case 'heading1':
                        document.execCommand('formatBlock', false, 'h1');
                        break;
                    case 'heading2':
                        document.execCommand('formatBlock', false, 'h2');
                        break;
                }
            } else if (cmd === 'link') {
                this.showLinkModal();
            } else {
                document.execCommand(cmd, false, null);
            }

            this.syncToHidden();
            this.updateToolbarState();
        }

        updateToolbarState() {
            const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];

            commands.forEach(cmd => {
                const btn = this.toolbar.querySelector(`[data-cmd="${cmd}"]`);
                if (btn) {
                    try {
                        if (document.queryCommandState(cmd)) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    } catch (e) {
                        // Ignore errors for unsupported commands
                    }
                }
            });
        }

        toggleColorPicker(anchorBtn) {
            if (this.colorPicker) {
                this.hideColorPicker();
                return;
            }

            this.colorPicker = document.createElement('div');
            this.colorPicker.className = 'rte-color-picker';

            COLOR_PALETTE.forEach(color => {
                const swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = 'rte-color-swatch';
                swatch.title = color.name;
                swatch.style.backgroundColor = color.value === 'inherit' ? 'transparent' : color.value;
                if (color.value === 'inherit') {
                    swatch.innerHTML = '✕';
                }
                swatch.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.applyColor(color.value);
                    this.hideColorPicker();
                });
                this.colorPicker.appendChild(swatch);
            });

            const rect = anchorBtn.getBoundingClientRect();
            const toolbarRect = this.toolbar.getBoundingClientRect();
            this.colorPicker.style.top = `${rect.bottom - toolbarRect.top + 5}px`;
            this.colorPicker.style.left = `${rect.left - toolbarRect.left}px`;

            this.toolbar.appendChild(this.colorPicker);
        }

        hideColorPicker() {
            if (this.colorPicker) {
                this.colorPicker.remove();
                this.colorPicker = null;
            }
        }

        applyColor(color) {
            this.editor.focus();
            if (color === 'inherit') {
                document.execCommand('removeFormat', false, null);
            } else {
                document.execCommand('foreColor', false, color);
            }
            this.syncToHidden();
        }

        showLinkModal() {
            // Save current selection
            const selection = window.getSelection();
            const savedRange = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
            const selectedText = savedRange ? savedRange.toString() : '';

            // Check if already a link
            let existingUrl = '';
            const anchorNode = selection.anchorNode;
            if (anchorNode) {
                const anchor = anchorNode.parentElement?.closest('a');
                if (anchor) {
                    existingUrl = anchor.href;
                }
            }

            // Create modal
            this.linkModal = document.createElement('div');
            this.linkModal.className = 'rte-link-modal';
            this.linkModal.innerHTML = `
                <div class="rte-link-modal-content">
                    <div class="rte-link-modal-header">
                        <span>Insert Link</span>
                        <button type="button" class="rte-link-modal-close">×</button>
                    </div>
                    <div class="rte-link-modal-body">
                        <label class="rte-link-label">
                            URL
                            <input type="url" class="rte-link-input" placeholder="https://example.com" value="${existingUrl}">
                        </label>
                        <label class="rte-link-label">
                            Text
                            <input type="text" class="rte-link-text" placeholder="Link text" value="${selectedText}">
                        </label>
                    </div>
                    <div class="rte-link-modal-footer">
                        <button type="button" class="rte-link-btn rte-link-btn-remove" ${!existingUrl ? 'style="display:none"' : ''}>Remove Link</button>
                        <button type="button" class="rte-link-btn rte-link-btn-cancel">Cancel</button>
                        <button type="button" class="rte-link-btn rte-link-btn-insert">Insert</button>
                    </div>
                </div>
            `;

            document.body.appendChild(this.linkModal);

            const urlInput = this.linkModal.querySelector('.rte-link-input');
            const textInput = this.linkModal.querySelector('.rte-link-text');

            urlInput.focus();

            // Event handlers
            const closeModal = () => {
                this.linkModal.remove();
                this.linkModal = null;
                this.editor.focus();
                if (savedRange) {
                    selection.removeAllRanges();
                    selection.addRange(savedRange);
                }
            };

            const insertLink = () => {
                const url = urlInput.value.trim();
                const text = textInput.value.trim() || url;

                if (url) {
                    this.editor.focus();
                    if (savedRange) {
                        selection.removeAllRanges();
                        selection.addRange(savedRange);
                    }

                    if (text && (!savedRange || savedRange.collapsed)) {
                        document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${text}</a>`);
                    } else {
                        document.execCommand('createLink', false, url);
                        // Set target blank
                        const newLink = this.editor.querySelector(`a[href="${url}"]`);
                        if (newLink) newLink.target = '_blank';
                    }
                    this.syncToHidden();
                }
                this.linkModal.remove();
                this.linkModal = null;
            };

            const removeLink = () => {
                this.editor.focus();
                if (savedRange) {
                    selection.removeAllRanges();
                    selection.addRange(savedRange);
                }
                document.execCommand('unlink', false, null);
                this.syncToHidden();
                this.linkModal.remove();
                this.linkModal = null;
            };

            this.linkModal.querySelector('.rte-link-modal-close').addEventListener('click', closeModal);
            this.linkModal.querySelector('.rte-link-btn-cancel').addEventListener('click', closeModal);
            this.linkModal.querySelector('.rte-link-btn-insert').addEventListener('click', insertLink);
            this.linkModal.querySelector('.rte-link-btn-remove').addEventListener('click', removeLink);

            urlInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    insertLink();
                } else if (e.key === 'Escape') {
                    closeModal();
                }
            });

            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    insertLink();
                } else if (e.key === 'Escape') {
                    closeModal();
                }
            });
        }

        insertCommand() {
            // Check if CommandConfigurator is available
            if (this.options.onCommandInsert) {
                this.options.onCommandInsert();
            } else if (window.CommandConfigurator) {
                // Save cursor position
                const selection = window.getSelection();
                const savedRange = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

                // Show command picker (you can customize which command to show)
                window.CommandConfigurator.showPicker().then(result => {
                    if (result) {
                        this.editor.focus();
                        if (savedRange) {
                            selection.removeAllRanges();
                            selection.addRange(savedRange);
                        }
                        // Insert as a special command span
                        this.insertCommandToken(result);
                    }
                }).catch(() => { });
            }
        }

        insertCommandToken(cmdText) {
            // Focus editor and restore saved cursor position
            this.editor.focus();
            this.restoreCursorPosition();

            // Create a visual token for the command
            const match = cmdText.match(/^\{([a-zA-Z=][a-zA-Z0-9]*?)(?::\s*([^}]*))?\}$/);
            if (!match) {
                document.execCommand('insertText', false, cmdText);
                this.syncToHidden();
                return;
            }

            const cmdName = match[1];
            const params = match[2];

            // Insert the raw command text with special styling
            const span = document.createElement('span');
            span.className = 'rte-command-token';
            span.setAttribute('data-cmd', cmdText);
            span.contentEditable = 'false';
            span.innerHTML = `<span class="rte-cmd-icon">⚡</span>${cmdName}${params ? `: ${params}` : ''}`;

            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(span);

                // Move cursor after the token
                range.setStartAfter(span);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);

                // Save the new cursor position
                this.saveCursorPosition();
            }

            this.syncToHidden();
        }

        saveCursorPosition() {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && this.editor.contains(selection.anchorNode)) {
                this.savedRange = selection.getRangeAt(0).cloneRange();
            }
        }

        restoreCursorPosition() {
            const selection = window.getSelection();
            if (this.savedRange) {
                try {
                    selection.removeAllRanges();
                    selection.addRange(this.savedRange.cloneRange());
                } catch (e) {
                    // If restore fails, place cursor at end
                    this.placeCursorAtEnd();
                }
            } else {
                // No saved position - place cursor at end
                this.placeCursorAtEnd();
            }
        }

        placeCursorAtEnd() {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(this.editor);
            range.collapse(false); // Collapse to end
            selection.removeAllRanges();
            selection.addRange(range);
        }

        clearFormatting() {
            this.editor.focus();
            document.execCommand('removeFormat', false, null);
            document.execCommand('formatBlock', false, 'p');
            this.syncToHidden();
            this.updateToolbarState();
        }

        sanitizeHTML(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const sanitizeNode = (node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toLowerCase();

                    if (!ALLOWED_TAGS.includes(tagName)) {
                        // Replace with contents
                        const fragment = document.createDocumentFragment();
                        while (node.firstChild) {
                            sanitizeNode(node.firstChild);
                            fragment.appendChild(node.firstChild);
                        }
                        node.replaceWith(fragment);
                        return;
                    }

                    // Remove disallowed attributes
                    const attrs = Array.from(node.attributes);
                    attrs.forEach(attr => {
                        if (!ALLOWED_ATTRS.includes(attr.name)) {
                            node.removeAttribute(attr.name);
                        } else if (attr.name === 'style') {
                            // Sanitize style
                            const styles = attr.value.split(';').filter(s => {
                                const prop = s.split(':')[0]?.trim().toLowerCase();
                                return ALLOWED_STYLE_PROPS.includes(prop);
                            });
                            if (styles.length > 0) {
                                node.setAttribute('style', styles.join(';'));
                            } else {
                                node.removeAttribute('style');
                            }
                        } else if (attr.name === 'href') {
                            // Sanitize href
                            const url = attr.value.trim();
                            if (!url.match(/^https?:\/\//i) && !url.startsWith('mailto:')) {
                                node.removeAttribute('href');
                            }
                        }
                    });

                    // Sanitize children
                    Array.from(node.childNodes).forEach(sanitizeNode);
                }
            };

            // Sanitize each child of body, not the body itself (body is not in ALLOWED_TAGS 
            // and would be removed, making doc.body null)
            Array.from(doc.body.childNodes).forEach(sanitizeNode);
            return doc.body.innerHTML;
        }

        setContent(html) {
            if (html) {
                this.editor.innerHTML = this.sanitizeHTML(html);
            } else {
                this.editor.innerHTML = '';
            }
            this.hiddenTextarea.value = this.editor.innerHTML;
        }

        getContent() {
            // Convert command tokens back to raw text
            const clone = this.editor.cloneNode(true);
            clone.querySelectorAll('.rte-command-token').forEach(token => {
                const cmdText = token.getAttribute('data-cmd') || token.textContent;
                token.replaceWith(document.createTextNode(cmdText));
            });
            return clone.innerHTML;
        }

        getPlainText() {
            return this.editor.textContent || '';
        }

        syncToHidden() {
            this.hiddenTextarea.value = this.getContent();
        }

        focus() {
            this.editor.focus();
        }

        destroy() {
            if (this.colorPicker) this.colorPicker.remove();
            if (this.linkModal) this.linkModal.remove();
            this.container.innerHTML = '';
        }
    }

    // Export
    window.RichTextEditor = RichTextEditor;

})();
