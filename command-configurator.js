/**
 * Command Configurator v2.0
 * User-friendly modals for setting up dynamic commands with correct syntax
 */

class CommandConfigurator {
    constructor() {
        this.modal = null;
        this.resolvePromise = null;
    }

    show(commandType) {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.renderModal(commandType);
        });
    }

    showPicker() {
        return new Promise((resolve) => {
            // MVP Commands - Available now
            const mvpCommands = [
                {
                    name: 'Essential Commands',
                    icon: '⚡',
                    color: 'primary',
                    commands: [
                        { type: 'textfield', name: 'Text Field', desc: 'Single-line input' },
                        { type: 'dropdown', name: 'Dropdown Menu', desc: 'Select from options' },
                        { type: 'clipboard', name: 'Clipboard', desc: 'Paste from clipboard' },
                        { type: 'cursor', name: 'Cursor Position', desc: 'Where to place cursor' }
                    ]
                }
            ];

            // Coming Soon Commands
            const comingSoonCommands = [
                {
                    name: 'Coming Soon',
                    icon: '🚀',
                    color: 'muted',
                    disabled: true,
                    commands: [
                        { type: 'formparagraph', name: 'Paragraph', desc: 'Multi-line text area' },
                        { type: 'formdate', name: 'Date Picker', desc: 'Calendar date input' },
                        { type: 'formtoggle', name: 'Toggle Switch', desc: 'Yes/No checkbox' },
                        { type: 'time', name: 'Date & Time', desc: 'Insert formatted date/time' },
                        { type: 'if', name: 'If / Else', desc: 'Conditional content' },
                        { type: 'repeat', name: 'Repeat / Loop', desc: 'Repeat content N times' },
                        { type: 'formula', name: 'Formula / Math', desc: 'Calculate expressions' },
                        { type: 'site', name: 'Page Data', desc: 'URL, title, selection' },
                        { type: 'user', name: 'User Property', desc: 'Your saved info' },
                        { type: 'snippet', name: 'Import Snippet', desc: 'Embed another snippet' },
                        { type: 'link', name: 'Hyperlink', desc: 'Clickable link' },
                        { type: 'note', name: 'Note (Hidden)', desc: 'Comment, not output' },
                        { type: 'key', name: 'Key Press', desc: 'Simulate keyboard' },
                        { type: 'click', name: 'Click Element', desc: 'Click a UI element' },
                        { type: 'wait', name: 'Wait / Delay', desc: 'Pause execution' }
                    ]
                }
            ];

            const categories = [...mvpCommands, ...comingSoonCommands];

            const renderPickerModal = () => {
                this.destroy(); // Clean up if already exists

                this.modal = document.createElement('div');
                this.modal.className = 'cmd-config-modal';
                this.modal.innerHTML = `
                    <div class="cmd-config-backdrop"></div>
                    <div class="cmd-config-dialog">
                        <div class="cmd-config-header">
                            <h3 class="cmd-config-title">
                                <span>⚡</span> Choose Variable
                            </h3>
                            <button class="cmd-config-close" title="Close">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div class="cmd-config-body" style="padding: 0;">
                            <div style="padding: 12px 14px; position: sticky; top: 0; background: #1a1a2e; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.06);">
                                <div style="position: relative;">
                                    <svg style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: rgba(255,255,255,0.35);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <path d="m21 21-4.35-4.35"></path>
                                    </svg>
                                    <input type="text" id="cmd-picker-search" placeholder="Search variables..." style="width: 100%; padding: 10px 14px 10px 38px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: white; font-size: 13px; outline: none;">
                                </div>
                            </div>
                            <div id="cmd-picker-list" style="padding: 0 10px 14px; max-height: 400px; overflow-y: auto;">
                                ${categories.map(cat => `
                                    <div class="cmd-picker-cat${cat.disabled ? ' cmd-picker-cat-disabled' : ''}" style="margin-top: 12px;">
                                        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: ${cat.disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.4)'}; padding: 8px 6px 6px; display: flex; align-items: center; gap: 6px;">
                                            <span>${cat.icon}</span> ${cat.name}
                                        </div>
                                        ${cat.commands.map(cmd => `
                                            <div class="cmd-picker-item${cat.disabled ? ' cmd-picker-item-disabled' : ''}" data-type="${cmd.type}" data-disabled="${cat.disabled ? 'true' : 'false'}" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; cursor: ${cat.disabled ? 'not-allowed' : 'pointer'}; transition: all 0.2s; margin-bottom: 2px; opacity: ${cat.disabled ? '0.4' : '1'};">
                                                <div style="width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: rgba(255,255,255,0.05); color: ${cat.disabled ? 'rgba(255,255,255,0.3)' : 'white'}; flex-shrink: 0;">
                                                    ${this.getCommandIcon(cmd.type)}
                                                </div>
                                                <div style="flex: 1; min-width: 0;">
                                                    <div style="font-size: 13px; font-weight: 500; color: ${cat.disabled ? 'rgba(255,255,255,0.4)' : 'white'};">${cmd.name}</div>
                                                    <div style="font-size: 11px; color: rgba(255,255,255,0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cmd.desc}</div>
                                                </div>
                                                ${cat.disabled ? '<span style="font-size: 9px; padding: 2px 6px; background: rgba(255,255,255,0.1); border-radius: 4px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.05em;">Soon</span>' : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;

                document.body.appendChild(this.modal);

                // CSS for picker items
                const style = document.createElement('style');
                style.id = 'cmd-picker-styles';
                style.textContent = `
                    .cmd-picker-item:not(.cmd-picker-item-disabled):hover { background: rgba(255, 255, 255, 0.08) !important; }
                    .cmd-picker-item:not(.cmd-picker-item-disabled):active { transform: scale(0.98); }
                    .cmd-picker-item-disabled:hover { background: transparent !important; }
                `;
                document.head.appendChild(style);

                // Animate in
                requestAnimationFrame(() => {
                    this.modal.querySelector('.cmd-config-backdrop').classList.add('active');
                    this.modal.querySelector('.cmd-config-dialog').classList.add('active');
                });

                // Event Listeners
                const closeBtn = this.modal.querySelector('.cmd-config-close');
                closeBtn.onclick = () => {
                    this.destroy();
                    resolve(null);
                };

                const backdrop = this.modal.querySelector('.cmd-config-backdrop');
                backdrop.onclick = () => {
                    this.destroy();
                    resolve(null);
                };

                const searchInput = this.modal.querySelector('#cmd-picker-search');
                searchInput.oninput = (e) => {
                    const term = e.target.value.toLowerCase();
                    const items = this.modal.querySelectorAll('.cmd-picker-item');
                    const cats = this.modal.querySelectorAll('.cmd-picker-cat');

                    items.forEach(item => {
                        const text = item.textContent.toLowerCase();
                        item.style.display = text.includes(term) ? 'flex' : 'none';
                    });

                    cats.forEach(cat => {
                        const visibleItems = cat.querySelectorAll('.cmd-picker-item[style="display: flex;"]');
                        cat.style.display = visibleItems.length > 0 ? 'block' : 'none';
                    });
                };

                const items = this.modal.querySelectorAll('.cmd-picker-item');
                items.forEach(item => {
                    item.onclick = () => {
                        // Skip disabled (Coming Soon) items
                        if (item.getAttribute('data-disabled') === 'true') {
                            return;
                        }
                        const type = item.getAttribute('data-type');
                        this.destroy();
                        this.show(type).then(resolve);
                    };
                });

                searchInput.focus();
            };

            renderPickerModal();
        });
    }

    getCommandIcon(type) {
        const icons = {
            textfield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 15h4M13 15h4M7 11h10"></path></svg>',
            formparagraph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="7" y1="8" x2="17" y2="8"></line><line x1="7" y1="12" x2="17" y2="12"></line><line x1="7" y1="16" x2="13" y2="16"></line></svg>',
            dropdown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M3 6h18M3 12h18M3 18h18"></path><circle cx="6" cy="6" r="1" fill="currentColor"></circle><circle cx="6" cy="12" r="1" fill="currentColor"></circle><circle cx="6" cy="18" r="1" fill="currentColor"></circle></svg>',
            formdate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><circle cx="12" cy="15" r="2"></circle></svg>',
            formtoggle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><rect x="1" y="5" width="22" height="14" rx="7"></rect><circle cx="16" cy="12" r="4" fill="currentColor"></circle></svg>',
            time: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
            if: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M16 3h5v5M8 3H3v5M3 16v5h5M16 21h5v-5"></path><path d="M21 3L12 12M3 21l9-9"></path></svg>',
            repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M17 2l4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path></svg>',
            formula: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M12 3v18M3 12h18"></path><path d="M5 5l14 14M5 19L19 5"></path></svg>',
            site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
            clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
            user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
            snippet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
            cursor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M5.5 5.5L19 12l-5.5 2.5L11 20z"></path></svg>',
            link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
            note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M12 18v-6M9 15h6"></path></svg>',
            key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h8M6 16h12"></path></svg>',
            click: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M15 15l-2 5L9 9l11 4-5 2z"></path><path d="M22 22l-5-5"></path></svg>',
            wait: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
        };
        return icons[type] || '⚙️';
    }

    renderModal(commandType) {
        this.destroy();

        this.modal = document.createElement('div');
        this.modal.className = 'cmd-config-modal';
        this.modal.innerHTML = `
            <div class="cmd-config-backdrop"></div>
            <div class="cmd-config-dialog">
                <div class="cmd-config-header">
                    <h3 class="cmd-config-title">${this.getTitle(commandType)}</h3>
                    <button class="cmd-config-close" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="cmd-config-body">
                    ${this.getFormContent(commandType)}
                </div>
                <div class="cmd-config-footer">
                    <button class="cmd-config-btn cmd-config-btn-secondary cmd-cancel">Cancel</button>
                    <button class="cmd-config-btn cmd-config-btn-primary cmd-insert">Insert Command</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
        this.attachEvents(commandType);

        requestAnimationFrame(() => {
            this.modal.querySelector('.cmd-config-backdrop').classList.add('active');
            this.modal.querySelector('.cmd-config-dialog').classList.add('active');
        });

        setTimeout(() => {
            const firstInput = this.modal.querySelector('input, select, textarea');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    getTitle(type) {
        const titles = {
            'textfield': '📝 Text Input Field',
            'formparagraph': '📄 Paragraph Input',
            'dropdown': '📋 Dropdown Menu',
            'formdate': '📅 Date Picker',
            'formtoggle': '🔘 Toggle Switch',
            'time': '🕐 Date & Time',
            'if': '🔀 Conditional (If/Else)',
            'repeat': '🔄 Repeat Block',
            'formula': '🔢 Formula / Math',
            'site': '🌐 Page Data',
            'snippet': '📎 Import Snippet',
            'link': '🔗 Hyperlink',
            'note': '📝 Note (Hidden)',
            'clipboard': '📋 Clipboard Content',
            'cursor': '▎ Cursor Position',
            'key': '⌨️ Key Press',
            'wait': '⏱️ Wait/Delay',
            'click': '👆 Click Element',
            'user': '👤 User Property'
        };
        return titles[type] || 'Configure Command';
    }

    getFormContent(type) {
        switch (type) {
            case 'textfield':
                return `
                    <div class="cmd-field">
                        <label>Field Name <span class="required">*</span></label>
                        <input type="text" id="cmd-name" placeholder="e.g., Recipient, email, company" value="fieldName">
                        <span class="cmd-hint">Used as label and for referencing in formulas</span>
                    </div>
                    <div class="cmd-field">
                        <label>Default Value</label>
                        <input type="text" id="cmd-default" placeholder="e.g., John">
                    </div>
                    <div class="cmd-field">
                        <label>Width (columns)</label>
                        <input type="number" id="cmd-cols" placeholder="30" min="1" max="100">
                    </div>
                    <div class="cmd-field">
                        <label>Formatter</label>
                        <select id="cmd-formatter">
                            <option value="">None</option>
                            <option value="upper">UPPERCASE</option>
                            <option value="lower">lowercase</option>
                            <option value="title">Title Case</option>
                            <option value="trim">Trim whitespace</option>
                        </select>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{textfield: name=fieldName}</code>
                    </div>
                `;

            case 'formparagraph':
                return `
                    <div class="cmd-field">
                        <label>Field Name <span class="required">*</span></label>
                        <input type="text" id="cmd-name" placeholder="e.g., Notes, description" value="Notes">
                    </div>
                    <div class="cmd-field">
                        <label>Default Value</label>
                        <textarea id="cmd-default" rows="2" placeholder="Default text..."></textarea>
                    </div>
                    <div class="cmd-row">
                        <div class="cmd-field">
                            <label>Rows</label>
                            <input type="number" id="cmd-rows" value="4" min="1" max="20">
                        </div>
                        <div class="cmd-field">
                            <label>Columns</label>
                            <input type="number" id="cmd-cols" value="40" min="10" max="100">
                        </div>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{formparagraph: name=Notes; rows=4; cols=40}</code>
                    </div>
                `;

            case 'dropdown':
                return `
                    <div class="cmd-field">
                        <label>Menu Options <span class="required">*</span></label>
                        <div class="cmd-options-list" id="cmd-options-list">
                            <div class="cmd-option-item">
                                <input type="text" class="cmd-option" value="Option 1" placeholder="Option text">
                                <button class="cmd-option-remove" title="Remove">×</button>
                            </div>
                            <div class="cmd-option-item">
                                <input type="text" class="cmd-option" value="Option 2" placeholder="Option text">
                                <button class="cmd-option-remove" title="Remove">×</button>
                            </div>
                            <div class="cmd-option-item">
                                <input type="text" class="cmd-option" value="Option 3" placeholder="Option text">
                                <button class="cmd-option-remove" title="Remove">×</button>
                            </div>
                        </div>
                        <button class="cmd-add-option" id="cmd-add-option">+ Add Option</button>
                    </div>
                    <div class="cmd-field">
                        <label>Menu Name</label>
                        <input type="text" id="cmd-name" placeholder="e.g., Priority, status" value="Choice">
                    </div>
                    <div class="cmd-field">
                        <label>Default Selection</label>
                        <select id="cmd-default">
                            <option value="">First option</option>
                        </select>
                    </div>
                    <div class="cmd-field">
                        <label class="cmd-checkbox-label">
                            <input type="checkbox" id="cmd-multiple">
                            Allow multiple selections
                        </label>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{dropdown: Option 1, Option 2, Option 3; name=Choice}</code>
                    </div>
                `;

            case 'formdate':
                return `
                    <div class="cmd-field">
                        <label>Date Format</label>
                        <select id="cmd-format">
                            <option value="YYYY-MM-DD">2026-01-31 (YYYY-MM-DD)</option>
                            <option value="MM/DD/YYYY">01/31/2026 (MM/DD/YYYY)</option>
                            <option value="DD/MM/YYYY">31/01/2026 (DD/MM/YYYY)</option>
                            <option value="MMMM Do, YYYY">January 31st, 2026</option>
                            <option value="MMM D, YYYY">Jan 31, 2026</option>
                            <option value="DDDD, MMMM D">Friday, January 31</option>
                        </select>
                    </div>
                    <div class="cmd-field">
                        <label>Field Name</label>
                        <input type="text" id="cmd-name" placeholder="e.g., Meeting Date" value="Date">
                    </div>
                    <div class="cmd-field">
                        <label>Default Date</label>
                        <input type="date" id="cmd-default">
                    </div>
                    <div class="cmd-row">
                        <div class="cmd-field">
                            <label>Start Date (min)</label>
                            <input type="date" id="cmd-start">
                        </div>
                        <div class="cmd-field">
                            <label>End Date (max)</label>
                            <input type="date" id="cmd-end">
                        </div>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{formdate: YYYY-MM-DD; name=Date}</code>
                    </div>
                `;

            case 'formtoggle':
                return `
                    <div class="cmd-field">
                        <label>Toggle Name <span class="required">*</span></label>
                        <input type="text" id="cmd-name" placeholder="e.g., Include Signature" value="Toggle">
                    </div>
                    <div class="cmd-field">
                        <label>Default State</label>
                        <select id="cmd-default">
                            <option value="yes">On (yes)</option>
                            <option value="no">Off (no)</option>
                        </select>
                    </div>
                    <div class="cmd-field">
                        <label>Content when ON (optional)</label>
                        <textarea id="cmd-content" rows="3" placeholder="Content shown when toggle is ON...
Leave empty for simple yes/no output"></textarea>
                        <span class="cmd-hint">If provided, creates a block toggle with {endformtoggle}</span>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{formtoggle: name=Toggle; default=yes}</code>
                    </div>
                `;

            case 'time':
                return `
                    <div class="cmd-field">
                        <label>Format</label>
                        <select id="cmd-format">
                            <optgroup label="Date Formats">
                                <option value="YYYY-MM-DD">2026-01-31</option>
                                <option value="MM/DD/YYYY">01/31/2026</option>
                                <option value="DD/MM/YYYY">31/01/2026</option>
                                <option value="MMMM Do, YYYY">January 31st, 2026</option>
                                <option value="MMM D, YYYY">Jan 31, 2026</option>
                                <option value="DDDD, MMMM D">Friday, January 31</option>
                                <option value="dddd">Friday</option>
                            </optgroup>
                            <optgroup label="Time Formats">
                                <option value="h:mm A">2:30 PM</option>
                                <option value="HH:mm">14:30</option>
                                <option value="HH:mm:ss">14:30:45</option>
                            </optgroup>
                            <optgroup label="Date + Time">
                                <option value="MMMM D, YYYY h:mm A">January 31, 2026 2:30 PM</option>
                                <option value="YYYY-MM-DD HH:mm">2026-01-31 14:30</option>
                            </optgroup>
                        </select>
                    </div>
                    <div class="cmd-field">
                        <label>Custom Format (optional)</label>
                        <input type="text" id="cmd-custom" placeholder="e.g., dddd, MMMM Do at h:mm A">
                        <span class="cmd-hint">Tokens: YYYY, MM, DD, MMMM, dddd, HH, mm, ss, A</span>
                    </div>
                    <div class="cmd-field">
                        <label>Time Shift</label>
                        <div class="cmd-shift-builder">
                            <select id="cmd-shift-dir">
                                <option value="">No shift</option>
                                <option value="+">Add (+)</option>
                                <option value="-">Subtract (-)</option>
                                <option value=">">Next (>)</option>
                                <option value="<">Previous (<)</option>
                            </select>
                            <input type="number" id="cmd-shift-num" value="1" min="1" max="365" style="width: 60px">
                            <select id="cmd-shift-unit">
                                <option value="D">Days</option>
                                <option value="W">Weeks</option>
                                <option value="M">Months</option>
                                <option value="Y">Years</option>
                            </select>
                        </div>
                        <span class="cmd-hint">e.g., +5D = 5 days from now, >MON = next Monday</span>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{time: YYYY-MM-DD}</code>
                    </div>
                `;

            case 'if':
                return `
                    <div class="cmd-field">
                        <label>Condition <span class="required">*</span></label>
                        <input type="text" id="cmd-condition" placeholder="e.g., count > 10, fieldName = 'value'">
                        <span class="cmd-hint">Use field names, comparisons (=, <>, <, >, <=, >=), and logic (and, or, not)</span>
                    </div>
                    <div class="cmd-field">
                        <label>Content when TRUE</label>
                        <textarea id="cmd-true" rows="2" placeholder="Content shown when condition is true..."></textarea>
                    </div>
                    <div class="cmd-field">
                        <label>Content when FALSE (optional)</label>
                        <textarea id="cmd-false" rows="2" placeholder="Content shown when condition is false..."></textarea>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{if: condition}true content{else}false content{endif}</code>
                    </div>
                `;

            case 'repeat':
                return `
                    <div class="cmd-field">
                        <label>Repeat Type</label>
                        <select id="cmd-repeat-type">
                            <option value="count">Fixed count</option>
                            <option value="for">For each in list</option>
                        </select>
                    </div>
                    <div class="cmd-field" id="cmd-count-field">
                        <label>Number of Repetitions</label>
                        <input type="number" id="cmd-count" value="3" min="1" max="100">
                    </div>
                    <div class="cmd-field cmd-hidden" id="cmd-for-field">
                        <label>Variable Name</label>
                        <input type="text" id="cmd-var" placeholder="e.g., item">
                        <label style="margin-top: 8px">List Expression</label>
                        <input type="text" id="cmd-list" placeholder="e.g., split(fieldName, ',')">
                    </div>
                    <div class="cmd-field">
                        <label>Content to Repeat</label>
                        <textarea id="cmd-content" rows="2" placeholder="• Item {=index}
Use {=i} for 0-based index, {=index} for 1-based"></textarea>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{repeat: 3}• Item
{endrepeat}</code>
                    </div>
                `;

            case 'formula':
                return `
                    <div class="cmd-field">
                        <label>Expression <span class="required">*</span></label>
                        <input type="text" id="cmd-expression" placeholder="e.g., 100 * 1.08, upper(fieldName)" value="2 + 2">
                    </div>
                    <div class="cmd-info-box">
                        <strong>Available Operations:</strong>
                        <ul>
                            <li><code>+ - * / %</code> - Math operators</li>
                            <li><code>&</code> - String concatenation</li>
                            <li><code>= <> < > <= >=</code> - Comparisons</li>
                            <li><code>and or not</code> - Logic</li>
                        </ul>
                        <strong>Functions:</strong>
                        <ul>
                            <li><code>round(), floor(), ceiling(), sqrt(), abs(), min(), max()</code></li>
                            <li><code>upper(), lower(), trim(), len(), left(), right(), mid()</code></li>
                            <li><code>if(condition, trueVal, falseVal)</code></li>
                            <li><code>today(), now()</code></li>
                        </ul>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{= 2 + 2}</code>
                    </div>
                `;

            case 'site':
                return `
                    <div class="cmd-field">
                        <label>What to Extract</label>
                        <select id="cmd-selector">
                            <optgroup label="Page Info">
                                <option value="url">Page URL</option>
                                <option value="title">Page Title</option>
                                <option value="domain">Domain Name</option>
                                <option value="selection">Selected Text</option>
                            </optgroup>
                            <optgroup label="Extract from Element">
                                <option value="custom">Pick Element...</option>
                            </optgroup>
                        </select>
                    </div>
                    <div class="cmd-field cmd-hidden" id="cmd-custom-selector-field">
                        <label>Element Selector</label>
                        <div class="cmd-picker-row">
                            <input type="text" id="cmd-custom-selector" placeholder="Click 'Pick Element'" readonly>
                            <button type="button" class="cmd-picker-btn" id="cmd-pick-element">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M5.52 19l2.92-9.2c.24-.75 1.32-.79 1.61-.06l3.43 8.7a.9.9 0 0 0 1.51.3l2.97-2.97"/>
                                    <path d="M9 3.5V2m0 1.5V5m0-1.5H7.5M9 3.5H10.5"/>
                                </svg>
                                Pick
                            </button>
                        </div>
                        <div class="cmd-element-info cmd-hidden" id="cmd-element-info">
                            <div class="cmd-element-tag"></div>
                            <div class="cmd-element-text"></div>
                        </div>
                        <label style="margin-top: 12px">Extract</label>
                        <select id="cmd-attribute">
                            <option value="">Text content (default)</option>
                            <option value="value">Input value</option>
                            <option value="href">Link URL (href)</option>
                            <option value="src">Image source (src)</option>
                            <option value="data-*">Custom data attribute...</option>
                        </select>
                        <div class="cmd-field cmd-hidden" id="cmd-custom-attr-field">
                            <input type="text" id="cmd-custom-attr" placeholder="e.g., data-id, aria-label">
                        </div>
                    </div>
                    <div class="cmd-field cmd-hidden" id="cmd-page-field">
                        <label>Page Pattern (optional)</label>
                        <input type="text" id="cmd-page" placeholder="e.g., *gmail.com*, *github.com*">
                        <span class="cmd-hint">Only extract from pages matching this pattern</span>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{site: url}</code>
                    </div>
                `;

            case 'snippet':
                return `
                    <div class="cmd-field">
                        <label>Snippet Shortcut <span class="required">*</span></label>
                        <input type="text" id="cmd-shortcut" placeholder="e.g., /signature, /header">
                        <span class="cmd-hint">Enter the shortcut of another snippet to include</span>
                    </div>
                    <div class="cmd-info">
                        <div class="cmd-info-icon">💡</div>
                        <div class="cmd-info-text">
                            <strong>Tip:</strong>
                            <p>Form fields with the same name in both snippets will be linked together!</p>
                        </div>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{import: shortcut}</code>
                    </div>
                `;

            case 'link':
                return `
                    <div class="cmd-field">
                        <label>URL <span class="required">*</span></label>
                        <input type="text" id="cmd-url" placeholder="https://example.com" value="https://">
                    </div>
                    <div class="cmd-field">
                        <label>Link Text <span class="required">*</span></label>
                        <input type="text" id="cmd-text" placeholder="Click here" value="Link text">
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{link: https://}Link text{endlink}</code>
                    </div>
                `;

            case 'note':
                return `
                    <div class="cmd-field">
                        <label>Note Content</label>
                        <textarea id="cmd-note" rows="3" placeholder="This note won't appear in the final output..."></textarea>
                    </div>
                    <div class="cmd-info">
                        <div class="cmd-info-icon">📝</div>
                        <div class="cmd-info-text">
                            <strong>Notes are Hidden</strong>
                            <p>Notes appear in the snippet editor but are NOT inserted when the snippet expands. Use for documentation, reminders, or instructions.</p>
                        </div>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{note}Your note here{endnote}</code>
                    </div>
                `;

            case 'clipboard':
                return `
                    <div class="cmd-info">
                        <div class="cmd-info-icon">📋</div>
                        <div class="cmd-info-text">
                            <strong>Clipboard Content</strong>
                            <p>Inserts whatever you've copied when the snippet expands.</p>
                        </div>
                    </div>
                    <div class="cmd-field">
                        <label>Whitespace Trimming</label>
                        <select id="cmd-trim">
                            <option value="">Keep whitespace (default)</option>
                            <option value="yes">Trim both sides</option>
                            <option value="left">Trim left only</option>
                            <option value="right">Trim right only</option>
                        </select>
                        <span class="cmd-hint">Remove extra spaces before/after pasted content</span>
                    </div>
                    <div class="cmd-field">
                        <label>Extract specific part (optional)</label>
                        <select id="cmd-extract-type">
                            <option value="">Use entire clipboard</option>
                            <optgroup label="Common Patterns">
                                <option value="email">Email address</option>
                                <option value="phone">Phone number (US)</option>
                                <option value="url">Web address (URL)</option>
                                <option value="number">Just numbers</option>
                                <option value="firstline">First line only</option>
                                <option value="lastline">Last line only</option>
                            </optgroup>
                            <option value="custom">Custom pattern (advanced)...</option>
                        </select>
                        <span class="cmd-hint">Extract only a specific part from clipboard</span>
                    </div>
                    <div class="cmd-field cmd-hidden" id="cmd-custom-extract-field">
                        <label>Custom Regex Pattern</label>
                        <input type="text" id="cmd-custom-extract" placeholder="e.g., Name: ([^,]+)">
                        <span class="cmd-hint">Regex pattern - will extract first capture group</span>
                    </div>
                    <div class="cmd-field">
                        <label>Fallback if not found (optional)</label>
                        <input type="text" id="cmd-fallback" placeholder="e.g., Not provided">
                        <span class="cmd-hint">Shown if extraction pattern doesn't match</span>
                    </div>
                    <div class="cmd-info-box" style="background: rgba(76, 175, 80, 0.1); border-left: 3px solid #4CAF50; padding: 12px; margin: 12px 0; border-radius: 6px;">
                        <strong style="color: #4CAF50;">💡 Examples:</strong>
                        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12px;">
                            <li>Basic: <code>You copied: {clipboard}</code></li>
                            <li>Trimmed: <code>Clean text: {clipboard: trim=yes}</code></li>
                            <li>Extract email: Select "Email address" above</li>
                            <li>Extract phone: Select "Phone number (US)" above</li>
                        </ul>
                    </div>
                    <div class="cmd-preview">
                        <label>Command</label>
                        <code id="cmd-preview-code">{clipboard}</code>
                    </div>
                `;

            case 'cursor':
                return `
                    <div class="cmd-info">
                        <div class="cmd-info-icon">▎</div>
                        <div class="cmd-info-text">
                            <strong>Cursor Position</strong>
                            <p>After the snippet expands, the cursor will be positioned exactly where you place this command. Great for templates where you want to start typing immediately.</p>
                        </div>
                    </div>
                    <div class="cmd-field">
                        <label>Whitespace Trimming</label>
                        <select id="cmd-trim">
                            <option value="">No trimming (default)</option>
                            <option value="yes">Trim both sides</option>
                            <option value="left">Trim left only</option>
                            <option value="right">Trim right only</option>
                        </select>
                        <span class="cmd-hint">Control whitespace removal around the cursor position</span>
                    </div>
                    <div class="cmd-info-box" style="background: rgba(76, 175, 80, 0.1); border-left: 3px solid #4CAF50; padding: 12px; margin: 12px 0; border-radius: 6px;">
                        <strong style="color: #4CAF50;">💡 Usage Examples:</strong>
                        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12px;">
                            <li><code>Hello {cursor} World!</code> - Cursor between words</li>
                            <li><code>function() { {cursor: trim=yes} }</code> - Cursor in code block</li>
                            <li><code>{cursor}Start typing here...</code> - Cursor at beginning</li>
                        </ul>
                    </div>
                    <div class="cmd-preview">
                        <label>Command</label>
                        <code id="cmd-preview-code">{cursor}</code>
                    </div>
                `;

            case 'key':
                return `
                    <div class="cmd-field">
                        <label>Key or Combination</label>
                        <select id="cmd-key">
                            <optgroup label="Navigation">
                                <option value="tab">Tab</option>
                                <option value="enter">Enter</option>
                                <option value="escape">Escape</option>
                                <option value="backspace">Backspace</option>
                            </optgroup>
                            <optgroup label="Arrow Keys">
                                <option value="up">Up</option>
                                <option value="down">Down</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                            </optgroup>
                            <optgroup label="Combinations">
                                <option value="ctrl+c">Ctrl+C (Copy)</option>
                                <option value="ctrl+v">Ctrl+V (Paste)</option>
                                <option value="ctrl+a">Ctrl+A (Select All)</option>
                                <option value="ctrl+z">Ctrl+Z (Undo)</option>
                            </optgroup>
                            <option value="custom">Custom...</option>
                        </select>
                    </div>
                    <div class="cmd-field cmd-hidden" id="cmd-custom-key-field">
                        <label>Custom Key</label>
                        <input type="text" id="cmd-custom-key" placeholder="e.g., ctrl+shift+p">
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{key: tab}</code>
                    </div>
                `;

            case 'wait':
                return `
                    <div class="cmd-row">
                        <div class="cmd-field" style="flex: 2;">
                            <label>Wait Duration <span class="required">*</span></label>
                            <input type="number" id="cmd-delay" value="1" min="0" max="3600" step="0.1">
                        </div>
                        <div class="cmd-field" style="flex: 1;">
                            <label>Unit</label>
                            <select id="cmd-unit">
                                <option value="s" selected>Seconds (s)</option>
                                <option value="ms">Milliseconds (ms)</option>
                                <option value="m">Minutes (m)</option>
                                <option value="h">Hours (h)</option>
                            </select>
                        </div>
                    </div>
                    <div class="cmd-field">
                        <label>Whitespace Trimming</label>
                        <select id="cmd-trim">
                            <option value="">No trimming (default)</option>
                            <option value="yes">Trim both sides</option>
                            <option value="left">Trim left only</option>
                            <option value="right">Trim right only</option>
                        </select>
                        <span class="cmd-hint">Control whitespace removal around the command</span>
                    </div>
                    <div class="cmd-info">
                        <div class="cmd-info-icon">⏱️</div>
                        <div class="cmd-info-text">
                            <strong>Use Cases:</strong>
                            <p>Wait for page content to load after clicking a button, or add pauses between automation steps (Autopilot scripts).</p>
                            <p style="margin-top: 8px; font-size: 11px; opacity: 0.7;"><strong>Examples:</strong> <code>{wait: 2s}</code>, <code>{wait: 500ms}</code>, <code>{wait: 1m}</code></p>
                        </div>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{wait: 1s}</code>
                    </div>
                `;

            case 'click':
                return `
                    <div class="cmd-field">
                        <label>Element Selector <span class="required">*</span></label>
                        <div class="cmd-picker-row">
                            <input type="text" id="cmd-selector" placeholder="Click 'Pick Element' or enter selector" readonly>
                            <button type="button" class="cmd-picker-btn" id="cmd-pick-element">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M5.52 19l2.92-9.2c.24-.75 1.32-.79 1.61-.06l3.43 8.7a.9.9 0 0 0 1.51.3l2.97-2.97"/>
                                    <path d="M9 3.5V2m0 1.5V5m0-1.5H7.5M9 3.5H10.5"/>
                                </svg>
                                Pick Element
                            </button>
                        </div>
                    </div>
                    <div class="cmd-element-info cmd-hidden" id="cmd-element-info">
                        <div class="cmd-element-tag"></div>
                        <div class="cmd-element-text"></div>
                    </div>
                    <div class="cmd-info">
                        <div class="cmd-info-icon">✨</div>
                        <div class="cmd-info-text">
                            <strong>Just click!</strong>
                            <p>Click "Pick Element" then click on any element on the page. The selector will be automatically generated for you.</p>
                        </div>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{click: selector}</code>
                    </div>
                `;

            case 'user':
                return `
                    <div class="cmd-field">
                        <label>Property Name <span class="required">*</span></label>
                        <input type="text" id="cmd-property" placeholder="e.g., name, email, department">
                    </div>
                    <div class="cmd-info">
                        <div class="cmd-info-icon">👤</div>
                        <div class="cmd-info-text">
                            <strong>User Properties</strong>
                            <p>Access user-specific properties defined in settings. Useful for signatures, contact info, and personalization.</p>
                        </div>
                    </div>
                    <div class="cmd-preview">
                        <label>Preview</label>
                        <code id="cmd-preview-code">{user: propertyName}</code>
                    </div>
                `;

            default:
                return '<p>Unknown command type</p>';
        }
    }

    attachEvents(type) {
        const backdrop = this.modal.querySelector('.cmd-config-backdrop');
        const closeBtn = this.modal.querySelector('.cmd-config-close');
        const cancelBtn = this.modal.querySelector('.cmd-cancel');
        const insertBtn = this.modal.querySelector('.cmd-insert');

        backdrop.addEventListener('click', () => this.cancel());
        closeBtn.addEventListener('click', () => this.cancel());
        cancelBtn.addEventListener('click', () => this.cancel());
        insertBtn.addEventListener('click', () => this.submit(type));

        // Live preview updates
        this.modal.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('input', () => this.updatePreview(type));
            el.addEventListener('change', () => this.updatePreview(type));
        });

        // Type-specific event handlers
        this.attachTypeSpecificEvents(type);

        // Keyboard
        document.addEventListener('keydown', this.handleKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancel();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.submit(type);
            }
        });
    }

    attachTypeSpecificEvents(type) {
        // Dropdown menu: add/remove options
        if (type === 'dropdown') {
            this.modal.querySelector('#cmd-add-option')?.addEventListener('click', () => this.addMenuOption());
            this.modal.querySelector('#cmd-options-list')?.addEventListener('click', (e) => {
                if (e.target.classList.contains('cmd-option-remove')) {
                    e.target.closest('.cmd-option-item')?.remove();
                    this.updatePreview(type);
                    this.updateDefaultSelect();
                }
            });
            this.modal.querySelector('#cmd-options-list')?.addEventListener('input', () => {
                this.updatePreview(type);
                this.updateDefaultSelect();
            });
            this.updateDefaultSelect();
        }

        // Repeat type toggle
        if (type === 'repeat') {
            this.modal.querySelector('#cmd-repeat-type')?.addEventListener('change', (e) => {
                const countField = this.modal.querySelector('#cmd-count-field');
                const forField = this.modal.querySelector('#cmd-for-field');
                if (e.target.value === 'for') {
                    countField?.classList.add('cmd-hidden');
                    forField?.classList.remove('cmd-hidden');
                } else {
                    countField?.classList.remove('cmd-hidden');
                    forField?.classList.add('cmd-hidden');
                }
                this.updatePreview(type);
            });
        }

        // Site selector toggle + element picker
        if (type === 'site') {
            this.modal.querySelector('#cmd-selector')?.addEventListener('change', (e) => {
                const customField = this.modal.querySelector('#cmd-custom-selector-field');
                if (e.target.value === 'custom') {
                    customField?.classList.remove('cmd-hidden');
                } else {
                    customField?.classList.add('cmd-hidden');
                }
                this.updatePreview(type);
            });

            // Attribute selector toggle
            this.modal.querySelector('#cmd-attribute')?.addEventListener('change', (e) => {
                const customAttrField = this.modal.querySelector('#cmd-custom-attr-field');
                if (e.target.value === 'data-*') {
                    customAttrField?.classList.remove('cmd-hidden');
                } else {
                    customAttrField?.classList.add('cmd-hidden');
                }
                this.updatePreview(type);
            });

            // Element picker for site command
            this.modal.querySelector('#cmd-pick-element')?.addEventListener('click', async () => {
                await this.pickElement(type);
            });
        }

        // Key selector toggle
        if (type === 'key') {
            this.modal.querySelector('#cmd-key')?.addEventListener('change', (e) => {
                const customField = this.modal.querySelector('#cmd-custom-key-field');
                if (e.target.value === 'custom') {
                    customField?.classList.remove('cmd-hidden');
                } else {
                    customField?.classList.add('cmd-hidden');
                }
                this.updatePreview(type);
            });
        }

        // Element picker for click command
        if (type === 'click') {
            this.modal.querySelector('#cmd-pick-element')?.addEventListener('click', async () => {
                await this.pickElement(type);
            });
        }

        // Clipboard extract type toggle
        if (type === 'clipboard') {
            this.modal.querySelector('#cmd-extract-type')?.addEventListener('change', (e) => {
                const customField = this.modal.querySelector('#cmd-custom-extract-field');
                if (e.target.value === 'custom') {
                    customField?.classList.remove('cmd-hidden');
                } else {
                    customField?.classList.add('cmd-hidden');
                }
                this.updatePreview(type);
            });
        }
    }

    async pickElement(type) {
        // Hide the modal temporarily
        this.modal.style.display = 'none';

        try {
            // Use the element picker from content script via messaging
            const result = await new Promise((resolve) => {
                // For options page, we need to message the active tab
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, { type: 'PICK_ELEMENT' }, (response) => {
                            resolve(response || { selected: false });
                        });
                    } else {
                        resolve({ selected: false, error: 'No active tab' });
                    }
                });
            });

            // Show the modal again
            this.modal.style.display = '';

            if (result.selected && result.selector) {
                // Update the input
                const input = type === 'click'
                    ? this.modal.querySelector('#cmd-selector')
                    : this.modal.querySelector('#cmd-custom-selector');

                if (input) {
                    input.value = result.selector;
                    input.readOnly = false; // Allow manual editing now
                }

                // Show element info
                const infoBox = this.modal.querySelector('#cmd-element-info');
                if (infoBox && result.element) {
                    const tagEl = infoBox.querySelector('.cmd-element-tag');
                    const textEl = infoBox.querySelector('.cmd-element-text');

                    if (tagEl) {
                        tagEl.textContent = `<${result.element.tagName}>`;
                    }
                    if (textEl && result.element.text) {
                        textEl.textContent = result.element.text.length > 30
                            ? result.element.text.substring(0, 30) + '...'
                            : result.element.text;
                    }

                    infoBox.classList.remove('cmd-hidden');
                }

                this.updatePreview(type);
            } else if (result.error) {
                console.error('[CommandConfigurator] Element picker error:', result.error);
            }
        } catch (error) {
            console.error('[CommandConfigurator] Element picker failed:', error);
            this.modal.style.display = '';
        }
    }

    addMenuOption() {
        const list = this.modal.querySelector('#cmd-options-list');
        const count = list.querySelectorAll('.cmd-option-item').length + 1;
        const item = document.createElement('div');
        item.className = 'cmd-option-item';
        item.innerHTML = `
            <input type="text" class="cmd-option" value="Option ${count}" placeholder="Option text">
            <button class="cmd-option-remove" title="Remove">×</button>
        `;
        list.appendChild(item);
        item.querySelector('input').focus();
        this.updatePreview('dropdown');
        this.updateDefaultSelect();
    }

    updateDefaultSelect() {
        const options = Array.from(this.modal.querySelectorAll('.cmd-option'))
            .map(i => i.value).filter(v => v);
        const select = this.modal.querySelector('#cmd-default');
        if (select && select.tagName === 'SELECT') {
            const currentVal = select.value;
            select.innerHTML = '<option value="">First option</option>' +
                options.map(o => `<option value="${this.escapeHtml(o)}">${this.escapeHtml(o)}</option>`).join('');
            if (options.includes(currentVal)) {
                select.value = currentVal;
            }
        }
    }

    updatePreview(type) {
        const preview = this.modal.querySelector('#cmd-preview-code');
        if (!preview) return;
        preview.textContent = this.buildCommand(type);
    }

    buildCommand(type) {
        const getValue = (id) => this.modal.querySelector(`#${id}`)?.value || '';
        const getChecked = (id) => this.modal.querySelector(`#${id}`)?.checked || false;

        switch (type) {
            case 'textfield': {
                const name = getValue('cmd-name') || 'fieldName';
                const def = getValue('cmd-default');
                const cols = getValue('cmd-cols');
                const formatter = getValue('cmd-formatter');
                let cmd = `{textfield: name=${name}`;
                if (def) cmd += `; default=${def}`;
                if (cols) cmd += `; cols=${cols}`;
                if (formatter) cmd += `; formatter=${formatter}`;
                return cmd + '}';
            }

            case 'formparagraph': {
                const name = getValue('cmd-name') || 'Notes';
                const def = getValue('cmd-default');
                const rows = getValue('cmd-rows') || '4';
                const cols = getValue('cmd-cols') || '40';
                let cmd = `{formparagraph: name=${name}`;
                if (def) cmd += `; default=${def}`;
                cmd += `; rows=${rows}; cols=${cols}`;
                return cmd + '}';
            }

            case 'dropdown': {
                const options = Array.from(this.modal.querySelectorAll('.cmd-option'))
                    .map(i => i.value).filter(v => v);
                const name = getValue('cmd-name') || 'Choice';
                const def = getValue('cmd-default');
                const multiple = getChecked('cmd-multiple');
                let cmd = `{dropdown: ${options.join(', ')}; name=${name}`;
                if (def) cmd += `; default=${def}`;
                if (multiple) cmd += `; multiple=yes`;
                return cmd + '}';
            }

            case 'formdate': {
                const format = getValue('cmd-format') || 'YYYY-MM-DD';
                const name = getValue('cmd-name') || 'Date';
                const def = getValue('cmd-default');
                const start = getValue('cmd-start');
                const end = getValue('cmd-end');
                let cmd = `{formdate: ${format}; name=${name}`;
                if (def) cmd += `; default=${def}`;
                if (start) cmd += `; start=${start}`;
                if (end) cmd += `; end=${end}`;
                return cmd + '}';
            }

            case 'formtoggle': {
                const name = getValue('cmd-name') || 'Toggle';
                const def = getValue('cmd-default') || 'yes';
                const content = getValue('cmd-content');
                if (content) {
                    return `{formtoggle: name=${name}; default=${def}}${content}{endformtoggle}`;
                }
                return `{formtoggle: name=${name}; default=${def}}`;
            }

            case 'time': {
                const format = getValue('cmd-custom') || getValue('cmd-format') || 'YYYY-MM-DD';
                const shiftDir = getValue('cmd-shift-dir');
                const shiftNum = getValue('cmd-shift-num') || '1';
                const shiftUnit = getValue('cmd-shift-unit') || 'D';

                let cmd = `{time: ${format}`;
                if (shiftDir && shiftDir !== '>') {
                    cmd += `; shift=${shiftDir}${shiftNum}${shiftUnit}`;
                } else if (shiftDir === '>' || shiftDir === '<') {
                    cmd += `; shift=${shiftDir}${shiftUnit}`;
                }
                return cmd + '}';
            }

            case 'if': {
                const condition = getValue('cmd-condition') || 'condition';
                const trueContent = getValue('cmd-true') || 'true content';
                const falseContent = getValue('cmd-false');
                if (falseContent) {
                    return `{if: ${condition}}${trueContent}{else}${falseContent}{endif}`;
                }
                return `{if: ${condition}}${trueContent}{endif}`;
            }

            case 'repeat': {
                const repeatType = getValue('cmd-repeat-type');
                const content = getValue('cmd-content') || '• Item\n';
                if (repeatType === 'for') {
                    const varName = getValue('cmd-var') || 'item';
                    const list = getValue('cmd-list') || 'list';
                    return `{repeat: for ${varName} in ${list}}${content}{endrepeat}`;
                }
                const count = getValue('cmd-count') || '3';
                return `{repeat: ${count}}${content}{endrepeat}`;
            }

            case 'formula': {
                const expr = getValue('cmd-expression') || '2 + 2';
                return `{= ${expr}}`;
            }

            case 'clipboard': {
                const trim = getValue('cmd-trim');
                const extractType = getValue('cmd-extract-type');
                const fallback = getValue('cmd-fallback');

                // Map extract types to regex patterns
                const patterns = {
                    'email': '([\\w.+-]+@[\\w.-]+\\.[a-zA-Z]{2,})',
                    'phone': '(\\d{3}-\\d{3}-\\d{4})',
                    'url': '(https?://[^\\s]+)',
                    'number': '(\\d+)',
                    'firstline': '([^\\n]+)',
                    'lastline': '([^\\n]*$)'
                };

                if (extractType && extractType !== '' && extractType !== 'custom') {
                    // Preset pattern
                    const pattern = patterns[extractType];
                    let formula = `extractregex(clipboard, "${pattern}")`;
                    if (fallback) {
                        formula = `catch(${formula}, "${fallback}")`;
                    }
                    return `{= ${formula}}`;
                } else if (extractType === 'custom') {
                    // Custom regex pattern
                    const customPattern = getValue('cmd-custom-extract');
                    if (customPattern) {
                        let formula = `extractregex(clipboard, "${customPattern}")`;
                        if (fallback) {
                            formula = `catch(${formula}, "${fallback}")`;
                        }
                        return `{= ${formula}}`;
                    }
                }

                // Basic clipboard command
                if (trim) {
                    return `{clipboard: trim=${trim}}`;
                }
                return '{clipboard}';
            }

            case 'site': {
                const selector = getValue('cmd-selector');
                if (selector === 'custom') {
                    const customSel = getValue('cmd-custom-selector') || 'selector';
                    const attr = getValue('cmd-attribute');
                    if (attr) {
                        return `{site: ${customSel}; attribute=${attr}}`;
                    }
                    return `{site: ${customSel}}`;
                }
                return `{site: ${selector || 'url'}}`;
            }

            case 'snippet': {
                const shortcut = getValue('cmd-shortcut') || 'shortcut';
                return `{import: ${shortcut}}`;
            }

            case 'link': {
                const url = getValue('cmd-url') || 'https://example.com';
                const text = getValue('cmd-text') || 'Link text';
                return `{link: ${url}}${text}{endlink}`;
            }

            case 'note': {
                const note = getValue('cmd-note') || 'Your note here';
                return `{note}${note}{endnote}`;
            }

            case 'cursor': {
                const trim = getValue('cmd-trim');
                if (trim) {
                    return `{cursor: trim=${trim}}`;
                }
                return '{cursor}';
            }

            case 'key': {
                const key = getValue('cmd-key');
                if (key === 'custom') {
                    return `{key: ${getValue('cmd-custom-key') || 'key'}}`;
                }
                return `{key: ${key || 'tab'}}`;
            }

            case 'wait': {
                const delay = getValue('cmd-delay') || '1';
                const unit = getValue('cmd-unit') || 's';
                const trim = getValue('cmd-trim');

                let cmd = `{wait: ${delay}${unit}`;
                if (trim) {
                    cmd += `; trim=${trim}`;
                }
                cmd += '}';
                return cmd;
            }

            case 'click': {
                const selector = getValue('cmd-selector') || 'selector';
                return `{click: ${selector}}`;
            }

            case 'user': {
                const property = getValue('cmd-property') || 'name';
                return `{user: ${property}}`;
            }

            default:
                return '';
        }
    }

    submit(type) {
        const command = this.buildCommand(type);
        this.destroy();
        if (this.resolvePromise) {
            this.resolvePromise(command);
        }
    }

    cancel() {
        this.destroy();
        if (this.resolvePromise) {
            this.resolvePromise(null);
        }
    }

    destroy() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        if (this.handleKeydown) {
            document.removeEventListener('keydown', this.handleKeydown);
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Create singleton
const commandConfigurator = new CommandConfigurator();
window.CommandConfigurator = commandConfigurator;
