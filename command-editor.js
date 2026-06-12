/**
 * Command Editor - Rich Text Editor for Snippet Commands
 * Renders commands as colorful, editable inline buttons
 */

(function () {
    'use strict';

    // Command definitions with icons and types
    const COMMAND_DEFS = {
        // Time/Date
        time: { icon: '🕐', label: 'time', color: 'time' },
        formdate: { icon: '📅', label: 'formdate', color: 'formdate' },

        // Form inputs
        textfield: { icon: '📝', label: 'textfield', color: 'textfield' },
        formparagraph: { icon: '📄', label: 'formparagraph', color: 'formparagraph' },
        dropdown: { icon: '☰', label: 'dropdown', color: 'dropdown' },
        formtoggle: { icon: '⚡', label: 'formtoggle', color: 'formtoggle' },

        // Clipboard/cursor
        clipboard: { icon: '📋', label: 'clipboard', color: 'clipboard' },
        cursor: { icon: '▌', label: 'cursor', color: 'cursor' },

        // Web
        site: { icon: '🌐', label: 'site', color: 'site' },
        click: { icon: '👆', label: 'click', color: 'click' },
        key: { icon: '⌨️', label: 'key', color: 'key' },
        wait: { icon: '⏳', label: 'wait', color: 'wait' },
        link: { icon: '🔗', label: 'link', color: 'link' },

        // Logic
        if: { icon: '❓', label: 'if', color: 'if' },
        repeat: { icon: '🔁', label: 'repeat', color: 'repeat' },

        // Formula
        '=': { icon: '🧮', label: '=', color: 'formula' },

        // Advanced
        import: { icon: '📥', label: 'import', color: 'import' },
        snippet: { icon: '📑', label: 'snippet', color: 'snippet' },
        run: { icon: '▶️', label: 'run', color: 'run' },
        note: { icon: '📌', label: 'note', color: 'note' },
        user: { icon: '👤', label: 'user', color: 'user' },
        error: { icon: '⚠️', label: 'error', color: 'error' },

        // End tokens
        endif: { icon: '✓', label: 'endif', color: 'end', isEnd: true },
        endformtoggle: { icon: '✓', label: 'endformtoggle', color: 'end', isEnd: true },
        endrepeat: { icon: '✓', label: 'endrepeat', color: 'end', isEnd: true },
        endlink: { icon: '✓', label: 'endlink', color: 'end', isEnd: true },
        endrun: { icon: '✓', label: 'endrun', color: 'end', isEnd: true },
        endnote: { icon: '✓', label: 'endnote', color: 'end', isEnd: true },
        else: { icon: '↔️', label: 'else', color: 'end', isEnd: true },
    };

    // Regex to match commands: {command} or {command: params}
    const CMD_REGEX = /\{([a-zA-Z=][a-zA-Z0-9]*?)(?::\s*([^}]*))?\}/g;

    class CommandEditor {
        constructor(textarea, options = {}) {
            this.textarea = textarea;
            this.options = {
                placeholder: textarea.placeholder || 'Type your snippet content here...',
                ...options
            };

            this.editor = null;
            this.hiddenTextarea = null;
            this.isUpdating = false;

            // Saved cursor position for command insertion
            this.savedRange = null;

            this.init();
        }

        init() {
            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'cmd-editor-wrapper';

            // Create contenteditable editor
            this.editor = document.createElement('div');
            this.editor.className = 'cmd-editor';
            this.editor.contentEditable = 'true';
            this.editor.setAttribute('data-placeholder', this.options.placeholder);
            this.editor.spellcheck = false;

            // Create hidden textarea for form submission
            this.hiddenTextarea = document.createElement('textarea');
            this.hiddenTextarea.className = 'cmd-editor-hidden';
            this.hiddenTextarea.name = this.textarea.name;
            this.hiddenTextarea.id = this.textarea.id;

            // Insert into DOM
            this.textarea.parentNode.insertBefore(wrapper, this.textarea);
            wrapper.appendChild(this.editor);
            wrapper.appendChild(this.hiddenTextarea);
            this.textarea.remove();

            // Keep reference to hidden textarea
            this.textarea = this.hiddenTextarea;

            // Bind events
            this.bindEvents();

            // Initial render if there's content
            if (this.hiddenTextarea.value) {
                this.setContent(this.hiddenTextarea.value);
            }
        }

        bindEvents() {
            // Input handling
            this.editor.addEventListener('input', () => {
                if (!this.isUpdating) {
                    this.syncToHidden();
                }
            });

            // Paste handling - convert to plain text and parse
            this.editor.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                this.insertTextAtCursor(text);
            });

            // Click on command tokens
            this.editor.addEventListener('click', (e) => {
                const token = e.target.closest('.cmd-token');
                if (token) {
                    e.stopPropagation();
                    token.classList.add('selected');
                    setTimeout(() => token.classList.remove('selected'), 300);
                }
            });

            // Double-click to edit command
            this.editor.addEventListener('dblclick', (e) => {
                const token = e.target.closest('.cmd-token');
                if (token) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.editCommand(token);
                }
            });

            // Handle backspace/delete for tokens
            this.editor.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        const node = e.key === 'Backspace'
                            ? this.getAdjacentNode(range, 'before')
                            : this.getAdjacentNode(range, 'after');

                        if (node && node.classList && node.classList.contains('cmd-token')) {
                            e.preventDefault();
                            node.remove();
                            this.syncToHidden();
                        }
                    }
                }
            });

            // Focus/blur effects
            this.editor.addEventListener('focus', () => {
                this.editor.classList.add('focused');
            });

            this.editor.addEventListener('blur', () => {
                this.editor.classList.remove('focused');
                this.syncToHidden();
                // Save cursor position before losing focus
                this.saveCursorPosition();
            });

            // Track cursor position on selection changes
            this.editor.addEventListener('mouseup', () => {
                this.saveCursorPosition();
            });

            this.editor.addEventListener('keyup', () => {
                this.saveCursorPosition();
            });
        }

        getAdjacentNode(range, direction) {
            if (!range.collapsed) return null;

            let node = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE) {
                if (direction === 'before' && range.startOffset === 0) {
                    node = node.previousSibling;
                } else if (direction === 'after' && range.startOffset === node.length) {
                    node = node.nextSibling;
                } else {
                    return null;
                }
            }

            return node;
        }

        editCommand(token) {
            const rawCmd = token.getAttribute('data-raw');
            if (!rawCmd) return;

            // Extract command type
            const match = rawCmd.match(/^\{([a-zA-Z=][a-zA-Z0-9]*?)(?::|})/);
            if (!match) return;

            const cmdType = match[1].toLowerCase();

            // Check if CommandConfigurator is available
            if (window.CommandConfigurator && typeof window.CommandConfigurator.show === 'function') {
                token.classList.add('editing');

                window.CommandConfigurator.show(cmdType).then(result => {
                    token.classList.remove('editing');
                    if (result) {
                        this.replaceToken(token, result);
                    }
                }).catch(() => {
                    token.classList.remove('editing');
                });
            } else {
                // Fallback: inline editing
                this.inlineEditToken(token, rawCmd);
            }
        }

        inlineEditToken(token, rawCmd) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'cmd-inline-edit';
            input.value = rawCmd;

            token.replaceWith(input);
            input.focus();
            input.select();

            const finishEdit = () => {
                const newCmd = input.value.trim();
                if (newCmd) {
                    const newTokens = this.parseAndCreateTokens(newCmd);
                    if (newTokens.length > 0) {
                        input.replaceWith(...newTokens);
                    } else {
                        input.replaceWith(document.createTextNode(newCmd));
                    }
                } else {
                    input.remove();
                }
                this.syncToHidden();
            };

            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                } else if (e.key === 'Escape') {
                    const tokens = this.parseAndCreateTokens(rawCmd);
                    if (tokens.length > 0) {
                        input.replaceWith(...tokens);
                    }
                    this.syncToHidden();
                }
            });
        }

        replaceToken(token, newCommand) {
            const newTokens = this.parseAndCreateTokens(newCommand);
            if (newTokens.length > 0) {
                token.replaceWith(...newTokens);
                this.syncToHidden();
            }
        }

        setContent(rawText) {
            this.isUpdating = true;
            this.editor.innerHTML = '';

            const fragment = this.parseTextToNodes(rawText);
            this.editor.appendChild(fragment);

            this.hiddenTextarea.value = rawText;
            this.isUpdating = false;
        }

        getContent() {
            return this.nodesToText(this.editor);
        }

        parseTextToNodes(text) {
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;

            CMD_REGEX.lastIndex = 0;

            while ((match = CMD_REGEX.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    const textBefore = text.slice(lastIndex, match.index);
                    fragment.appendChild(document.createTextNode(textBefore));
                }

                const token = this.createToken(match[0], match[1], match[2]);
                fragment.appendChild(token);

                lastIndex = match.index + match[0].length;
            }

            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
            }

            return fragment;
        }

        parseAndCreateTokens(text) {
            const tokens = [];
            let match;

            CMD_REGEX.lastIndex = 0;

            while ((match = CMD_REGEX.exec(text)) !== null) {
                tokens.push(this.createToken(match[0], match[1], match[2]));
            }

            return tokens;
        }

        createToken(rawCmd, cmdName, params) {
            const cmdKey = cmdName.toLowerCase();
            const def = COMMAND_DEFS[cmdKey] || {
                icon: '⚙️',
                label: cmdName,
                color: 'unknown'
            };

            const token = document.createElement('span');
            token.className = `cmd-token cmd-${def.color}${def.isEnd ? ' cmd-end' : ''}`;
            token.setAttribute('data-raw', rawCmd);
            token.setAttribute('contenteditable', 'false');
            token.title = 'Double-click to edit';

            // Icon
            const iconSpan = document.createElement('span');
            iconSpan.className = 'cmd-icon';
            iconSpan.textContent = def.icon;
            token.appendChild(iconSpan);

            // Label
            const labelSpan = document.createElement('span');
            labelSpan.className = 'cmd-label';
            labelSpan.textContent = def.label;
            token.appendChild(labelSpan);

            // Parameters
            if (params && params.trim()) {
                const paramsSpan = document.createElement('span');
                paramsSpan.className = 'cmd-params';
                paramsSpan.textContent = ': ' + params.trim();
                token.appendChild(paramsSpan);
            }

            return token;
        }

        nodesToText(container) {
            let text = '';

            for (const node of container.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    text += node.textContent;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList.contains('cmd-token')) {
                        text += node.getAttribute('data-raw') || '';
                    } else if (node.tagName === 'BR') {
                        text += '\n';
                    } else if (node.tagName === 'DIV' || node.tagName === 'P') {
                        if (text.length > 0 && !text.endsWith('\n')) {
                            text += '\n';
                        }
                        text += this.nodesToText(node);
                    } else {
                        text += this.nodesToText(node);
                    }
                }
            }

            return text;
        }

        syncToHidden() {
            this.hiddenTextarea.value = this.getContent();
        }

        insertTextAtCursor(text) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            range.deleteContents();

            const fragment = this.parseTextToNodes(text);
            range.insertNode(fragment);

            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);

            this.syncToHidden();
        }

        insertCommand(cmdText) {
            // Restore saved cursor position or place at end
            this.editor.focus();

            const selection = window.getSelection();

            if (this.savedRange) {
                // Restore the saved cursor position
                selection.removeAllRanges();
                selection.addRange(this.savedRange.cloneRange());
            } else if (!selection.rangeCount || !this.editor.contains(selection.anchorNode)) {
                // No saved position and cursor not in editor - place at end
                const range = document.createRange();
                range.selectNodeContents(this.editor);
                range.collapse(false); // Collapse to end
                selection.removeAllRanges();
                selection.addRange(range);
            }

            this.insertTextAtCursor(cmdText);

            // Save new position after insert
            this.saveCursorPosition();
        }

        saveCursorPosition() {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && this.editor.contains(selection.anchorNode)) {
                this.savedRange = selection.getRangeAt(0).cloneRange();
            }
        }

        focus() {
            this.editor.focus();
        }

        getTextarea() {
            return this.hiddenTextarea;
        }
    }

    // Export
    window.CommandEditor = CommandEditor;

})();
