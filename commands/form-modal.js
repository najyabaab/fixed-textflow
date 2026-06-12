/**
 * TextFlow Form Modal v2.0
 * Premium form UI for collecting user input from dynamic commands
 */

(function () {
    'use strict';

    class FormModal {
        constructor() {
            this.modal = null;
            this.resolvePromise = null;
            this.formFields = [];
            this.values = {};
        }

        /**
         * Show form modal with fields
         */
        show(fields, snippetName = 'Snippet', actionCallback = null) {
            return new Promise((resolve) => {
                this.resolvePromise = resolve;
                this.formFields = fields;
                this.values = {};
                this.actionCallback = actionCallback; // Callback for button actions

                // Initialize default values
                for (const field of fields) {
                    if (field.type !== 'button') {
                        this.values[field.name] = field.default || '';
                    }
                }

                this.render(snippetName);
            });
        }

        /**
         * Render the modal
         */
        render(snippetName) {
            this.destroy();

            this.modal = document.createElement('div');
            this.modal.className = 'tf-form-modal';
            this.modal.innerHTML = `
                <div class="tf-form-backdrop"></div>
                <div class="tf-form-container">
                    <div class="tf-form-header">
                        <div class="tf-form-title-section">
                            <div class="tf-form-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                    <path d="M2 17l10 5 10-5"/>
                                    <path d="M2 12l10 5 10-5"/>
                                </svg>
                            </div>
                            <div>
                                <h2 class="tf-form-title">${this.escapeHtml(snippetName)}</h2>
                                <p class="tf-form-subtitle">Fill in the fields below</p>
                            </div>
                        </div>
                        <button class="tf-form-close" aria-label="Close">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="tf-form-body">
                        <div class="tf-form-fields">
                            ${this.renderFields()}
                        </div>
                        
                        <div class="tf-form-preview">
                            <div class="tf-preview-header">
                                <span class="tf-preview-label">Preview</span>
                                <button class="tf-preview-copy" title="Copy preview">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="tf-preview-content" id="tf-preview-content">
                                ${this.escapeHtml(this.generatePreview())}
                            </div>
                        </div>
                    </div>
                    
                    <div class="tf-form-footer">
                        <div class="tf-form-hint">
                            <kbd>Tab</kbd> to navigate • <kbd>Enter</kbd> to insert
                        </div>
                        <div class="tf-form-actions">
                            <button class="tf-btn tf-btn-secondary tf-cancel">Cancel</button>
                            <button class="tf-btn tf-btn-primary tf-submit">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Insert
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(this.modal);
            this.attachStyles();
            this.attachEvents();

            // Animate in
            requestAnimationFrame(() => {
                this.modal.classList.add('tf-form-visible');
            });

            // Focus first field
            setTimeout(() => {
                const firstInput = this.modal.querySelector('input, textarea, select');
                if (firstInput) firstInput.focus();
            }, 100);
        }

        /**
         * Render all form fields
         */
        renderFields() {
            return this.formFields.map((field, index) => {
                const id = `tf-field-${index}`;

                switch (field.type) {
                    case 'text':
                        return this.renderTextField(field, id);
                    case 'paragraph':
                        return this.renderParagraphField(field, id);
                    case 'menu':
                        return this.renderMenuField(field, id);
                    case 'date':
                        return this.renderDateField(field, id);
                    case 'toggle':
                        return this.renderToggleField(field, id);
                    case 'button':
                        return this.renderButtonField(field, id);
                    default:
                        return '';
                }
            }).join('');
        }

        renderTextField(field, id) {
            return `
                <div class="tf-field">
                    <label class="tf-field-label" for="${id}">
                        ${this.escapeHtml(field.label)}
                    </label>
                    <input 
                        type="text" 
                        id="${id}"
                        class="tf-input"
                        data-field="${field.name}"
                        value="${this.escapeHtml(field.default || '')}"
                        placeholder="${this.escapeHtml(field.placeholder || '')}"
                        style="width: ${field.cols ? field.cols + 'ch' : '100%'}"
                    />
                </div>
            `;
        }

        renderParagraphField(field, id) {
            return `
                <div class="tf-field">
                    <label class="tf-field-label" for="${id}">
                        ${this.escapeHtml(field.label)}
                    </label>
                    <textarea 
                        id="${id}"
                        class="tf-textarea"
                        data-field="${field.name}"
                        rows="${field.rows || 4}"
                        placeholder="${this.escapeHtml(field.placeholder || '')}"
                        style="width: ${field.cols ? field.cols + 'ch' : '100%'}"
                    >${this.escapeHtml(field.default || '')}</textarea>
                </div>
            `;
        }

        renderMenuField(field, id) {
            const options = field.options || [];
            const multiple = field.multiple ? 'multiple' : '';
            const colsStyle = field.cols ? `width: ${field.cols}ch` : 'width: 100%';

            return `
                <div class="tf-field">
                    <label class="tf-field-label" for="${id}">
                        ${this.escapeHtml(field.label)}
                    </label>
                    <div class="tf-select-wrapper" style="${colsStyle}">
                        <select 
                            id="${id}"
                            class="tf-select"
                            data-field="${field.name}"
                            ${multiple}
                        >
                            ${options.map(opt => `
                                <option value="${this.escapeHtml(opt)}" 
                                    ${opt === field.default ? 'selected' : ''}>
                                    ${this.escapeHtml(opt)}
                                </option>
                            `).join('')}
                        </select>
                        <svg class="tf-select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </div>
                </div>
            `;
        }

        renderDateField(field, id) {
            const defaultDate = field.default || new Date().toISOString().split('T')[0];

            return `
                <div class="tf-field">
                    <label class="tf-field-label" for="${id}">
                        ${this.escapeHtml(field.label)}
                        <span class="tf-field-format">${this.escapeHtml(field.format)}</span>
                    </label>
                    <input 
                        type="date" 
                        id="${id}"
                        class="tf-input tf-date-input"
                        data-field="${field.name}"
                        data-format="${this.escapeHtml(field.format)}"
                        value="${defaultDate}"
                        ${field.start ? `min="${field.start}"` : ''}
                        ${field.end ? `max="${field.end}"` : ''}
                    />
                </div>
            `;
        }

        renderToggleField(field, id) {
            const checked = field.default ? 'checked' : '';

            return `
                <div class="tf-field tf-field-toggle">
                    <label class="tf-toggle-wrapper">
                        <input 
                            type="checkbox" 
                            id="${id}"
                            class="tf-toggle-input"
                            data-field="${field.name}"
                            ${checked}
                        />
                        <span class="tf-toggle-switch"></span>
                        <span class="tf-toggle-label">${this.escapeHtml(field.label)}</span>
                    </label>
                </div>
            `;
        }

        renderButtonField(field, id) {
            return `
                <div class="tf-field">
                    <button 
                        type="button"
                        id="${id}"
                        class="tf-btn tf-btn-secondary tf-action-btn"
                        data-action-index="${this.formFields.indexOf(field)}"
                        style="width: 100%; justify-content: center;"
                    >
                        ${this.escapeHtml(field.label)}
                    </button>
                    <div class="tf-field-format" style="text-align: center; margin-top: 4px;">
                        Runs code block
                    </div>
                </div>
            `;
        }

        /**
         * Attach event listeners
         */
        attachEvents() {
            const backdrop = this.modal.querySelector('.tf-form-backdrop');
            const closeBtn = this.modal.querySelector('.tf-form-close');
            const cancelBtn = this.modal.querySelector('.tf-cancel');
            const submitBtn = this.modal.querySelector('.tf-submit');
            const copyBtn = this.modal.querySelector('.tf-preview-copy');

            backdrop.addEventListener('click', () => this.cancel());
            closeBtn.addEventListener('click', () => this.cancel());
            cancelBtn.addEventListener('click', () => this.cancel());
            submitBtn.addEventListener('click', () => this.submit());
            copyBtn?.addEventListener('click', () => this.copyPreview());

            // Field change handlers
            this.modal.querySelectorAll('[data-field]').forEach(input => {
                input.addEventListener('input', () => this.handleFieldChange(input));
                input.addEventListener('change', () => this.handleFieldChange(input));
            });

            // Button actions
            this.modal.querySelectorAll('.tf-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleButtonAction(btn);
                });
            });

            // Keyboard shortcuts
            this.keyHandler = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancel();
                } else if (e.key === 'Enter' && !e.target.matches('textarea')) {
                    e.preventDefault();
                    this.submit();
                }
            };
            document.addEventListener('keydown', this.keyHandler);
        }

        /**
         * Handle field value change
         */
        handleFieldChange(input) {
            const fieldName = input.dataset.field;

            if (input.type === 'checkbox') {
                this.values[fieldName] = input.checked;
            } else if (input.multiple) {
                const selected = Array.from(input.selectedOptions).map(o => o.value);
                this.values[fieldName] = selected;
            } else {
                this.values[fieldName] = input.value;
            }

            this.updatePreview();
        }

        /**
         * Handle button action
         */
        async handleButtonAction(btn) {
            if (!this.actionCallback) return;

            const index = parseInt(btn.dataset.actionIndex);
            const field = this.formFields[index];

            if (field && field.code) {
                // Show loading state
                const originalText = btn.textContent;
                btn.textContent = 'Running...';
                btn.disabled = true;

                try {
                    const newValues = await this.actionCallback(field.code, this.values);

                    if (newValues) {
                        this.updateFormValues(newValues);
                    }
                } catch (e) {
                    console.error('Button action failed:', e);
                    btn.textContent = 'Error';
                    setTimeout(() => btn.textContent = originalText, 2000);
                } finally {
                    if (btn.textContent === 'Running...') {
                        btn.textContent = originalText;
                    }
                    btn.disabled = false;
                }
            }
        }

        /**
         * Update form values from external source
         */
        updateFormValues(newValues) {
            this.values = { ...this.values, ...newValues };

            // Update UI
            for (const [name, value] of Object.entries(this.values)) {
                const elements = this.modal.querySelectorAll(`[data-field="${name}"]`);
                elements.forEach(el => {
                    if (el.type === 'checkbox') {
                        el.checked = value === true || value === 'true';
                    } else if (el.type !== 'file') {
                        el.value = value;
                    }
                });
            }

            this.updatePreview();
        }

        /**
         * Update preview
         */
        updatePreview() {
            const previewEl = this.modal.querySelector('#tf-preview-content');
            if (previewEl) {
                previewEl.textContent = this.generatePreview();
            }
        }

        /**
         * Generate preview text
         * Note: This shows form field values only, not executed snippet content.
         * Notes ({note}...{endnote}) are only visible when the snippet is fully executed.
         */
        generatePreview() {
            // Simple preview showing field values
            let preview = this.formFields.map(field => {
                const value = this.values[field.name];
                if (field.type === 'toggle') {
                    return `${field.label}: ${value ? 'Yes' : 'No'}`;
                }
                if (field.type === 'button') {
                    return ''; // Don't show buttons in preview
                }
                return `${field.label}: ${value || '(empty)'}`;
            }).filter(line => line).join('\n');

            // Process note markers for visual rendering (if present in executed content)
            preview = this.processNoteMarkers(preview);
            return preview;
        }

        /**
         * Process note markers and render them with visual styling
         * Converts [[NOTE:color]]content[[/NOTE]] to color-coded notes
         */
        processNoteMarkers(text) {
            const notePattern = /\[\[NOTE:(\w+)\]\](.*?)\[\[\/NOTE\]\]/gs;

            return text.replace(notePattern, (match, color, content) => {
                // Color to emoji mapping for visual distinction
                const colorMap = {
                    'red': '🔴',
                    'green': '🟢',
                    'yellow': '🟡',
                    'blue': '🔵',
                    'none': 'ℹ️'
                };

                const icon = colorMap[color.toLowerCase()] || 'ℹ️';
                return `${icon} NOTE: ${content.trim()}`;
            });
        }

        /**
         * Copy preview to clipboard
         */
        async copyPreview() {
            try {
                await navigator.clipboard.writeText(this.generatePreview());
                const copyBtn = this.modal.querySelector('.tf-preview-copy');
                copyBtn.classList.add('tf-copied');
                setTimeout(() => copyBtn.classList.remove('tf-copied'), 1500);
            } catch (e) {
                console.warn('Copy failed:', e);
            }
        }

        /**
         * Submit form
         */
        submit() {
            // Collect all values
            this.modal.querySelectorAll('[data-field]').forEach(input => {
                const fieldName = input.dataset.field;

                if (input.type === 'checkbox') {
                    this.values[fieldName] = input.checked;
                } else if (input.multiple) {
                    const selected = Array.from(input.selectedOptions).map(o => o.value);
                    this.values[fieldName] = selected;
                } else {
                    this.values[fieldName] = input.value;
                }
            });

            this.destroy();

            if (this.resolvePromise) {
                this.resolvePromise({
                    submitted: true,
                    values: this.values
                });
            }
        }

        /**
         * Cancel form
         */
        cancel() {
            this.destroy();

            if (this.resolvePromise) {
                this.resolvePromise({
                    submitted: false,
                    values: {}
                });
            }
        }

        /**
         * Destroy modal
         */
        destroy() {
            if (this.keyHandler) {
                document.removeEventListener('keydown', this.keyHandler);
            }
            if (this.modal) {
                this.modal.classList.remove('tf-form-visible');
                setTimeout(() => {
                    this.modal?.remove();
                    this.modal = null;
                }, 200);
            }
        }

        /**
         * Attach modal styles
         */
        attachStyles() {
            if (document.getElementById('tf-form-modal-styles')) return;

            const styles = document.createElement('style');
            styles.id = 'tf-form-modal-styles';
            styles.textContent = `
                .tf-form-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 2147483647;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                
                .tf-form-modal.tf-form-visible {
                    opacity: 1;
                }
                
                .tf-form-backdrop {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                }
                
                .tf-form-container {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) scale(0.95);
                    width: 90%;
                    max-width: 520px;
                    max-height: 85vh;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    box-shadow: 
                        0 25px 80px rgba(0, 0, 0, 0.5),
                        0 0 1px rgba(255, 255, 255, 0.1);
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                
                .tf-form-visible .tf-form-container {
                    transform: translate(-50%, -50%) scale(1);
                }
                
                /* Header */
                .tf-form-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                
                .tf-form-title-section {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                
                .tf-form-icon {
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 12px;
                }
                
                .tf-form-icon svg {
                    width: 24px;
                    height: 24px;
                }
                
                .tf-form-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                }
                
                .tf-form-subtitle {
                    margin: 2px 0 0;
                    font-size: 13px;
                    opacity: 0.8;
                }
                
                .tf-form-close {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.15);
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                
                .tf-form-close:hover {
                    background: rgba(255, 255, 255, 0.25);
                }
                
                .tf-form-close svg {
                    width: 18px;
                    height: 18px;
                    color: white;
                }
                
                /* Body */
                .tf-form-body {
                    padding: 24px;
                    overflow-y: auto;
                    flex: 1;
                }
                
                .tf-form-fields {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }
                
                .tf-field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                
                .tf-field-label {
                    font-size: 13px;
                    font-weight: 500;
                    color: #e5e7eb;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .tf-field-format {
                    font-size: 11px;
                    color: #9ca3af;
                    font-weight: 400;
                }
                
                .tf-input,
                .tf-textarea,
                .tf-select {
                    padding: 12px 14px;
                    background: rgba(255, 255, 255, 0.06);
                    border: 1.5px solid rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    color: white;
                    font-size: 14px;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                
                .tf-input:focus,
                .tf-textarea:focus,
                .tf-select:focus {
                    outline: none;
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
                }
                
                .tf-input::placeholder,
                .tf-textarea::placeholder {
                    color: rgba(255, 255, 255, 0.35);
                }
                
                .tf-textarea {
                    resize: vertical;
                    min-height: 80px;
                }
                
                .tf-select-wrapper {
                    position: relative;
                }
                
                .tf-select {
                    width: 100%;
                    appearance: none;
                    cursor: pointer;
                    padding-right: 40px;
                }
                
                .tf-select option {
                    background: #1a1a2e;
                    color: white;
                }
                
                .tf-select-arrow {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 16px;
                    height: 16px;
                    color: #9ca3af;
                    pointer-events: none;
                }
                
                .tf-date-input {
                    cursor: pointer;
                }
                
                .tf-date-input::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                    cursor: pointer;
                }
                
                /* Toggle */
                .tf-field-toggle {
                    flex-direction: row;
                }
                
                .tf-toggle-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                }
                
                .tf-toggle-input {
                    display: none;
                }
                
                .tf-toggle-switch {
                    position: relative;
                    width: 48px;
                    height: 26px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 13px;
                    transition: background 0.2s;
                }
                
                .tf-toggle-switch::after {
                    content: '';
                    position: absolute;
                    top: 3px;
                    left: 3px;
                    width: 20px;
                    height: 20px;
                    background: #9ca3af;
                    border-radius: 50%;
                    transition: transform 0.2s, background 0.2s;
                }
                
                .tf-toggle-input:checked + .tf-toggle-switch {
                    background: #667eea;
                }
                
                .tf-toggle-input:checked + .tf-toggle-switch::after {
                    transform: translateX(22px);
                    background: white;
                }
                
                .tf-toggle-label {
                    font-size: 14px;
                    color: #e5e7eb;
                }
                
                /* Preview */
                .tf-form-preview {
                    margin-top: 20px;
                    padding: 14px;
                    background: rgba(0, 0, 0, 0.25);
                    border-radius: 12px;
                }
                
                .tf-preview-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                
                .tf-preview-label {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #9ca3af;
                }
                
                .tf-preview-copy {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .tf-preview-copy:hover {
                    background: rgba(255, 255, 255, 0.15);
                }
                
                .tf-preview-copy svg {
                    width: 14px;
                    height: 14px;
                    color: #9ca3af;
                }
                
                .tf-preview-copy.tf-copied {
                    background: #10b981;
                }
                
                .tf-preview-copy.tf-copied svg {
                    color: white;
                }
                
                .tf-preview-content {
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 12px;
                    color: #a5b4fc;
                    white-space: pre-wrap;
                    word-break: break-word;
                    max-height: 100px;
                    overflow-y: auto;
                }
                
                /* Footer */
                .tf-form-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 24px;
                    background: rgba(0, 0, 0, 0.2);
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }
                
                .tf-form-hint {
                    font-size: 12px;
                    color: #6b7280;
                }
                
                .tf-form-hint kbd {
                    display: inline-block;
                    padding: 2px 6px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    font-size: 11px;
                }
                
                .tf-form-actions {
                    display: flex;
                    gap: 10px;
                }
                
                .tf-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 18px;
                    border: none;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .tf-btn svg {
                    width: 16px;
                    height: 16px;
                }
                
                .tf-btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: #d1d5db;
                }
                
                .tf-btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.15);
                    color: white;
                }
                
                .tf-btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                
                .tf-btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
                }
                
                /* Responsive */
                @media (max-width: 480px) {
                    .tf-form-container {
                        width: 95%;
                        max-height: 90vh;
                    }
                    
                    .tf-form-header,
                    .tf-form-body,
                    .tf-form-footer {
                        padding-left: 16px;
                        padding-right: 16px;
                    }
                    
                    .tf-form-footer {
                        flex-direction: column;
                        gap: 12px;
                    }
                    
                    .tf-form-actions {
                        width: 100%;
                    }
                    
                    .tf-btn {
                        flex: 1;
                        justify-content: center;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        /**
         * Escape HTML
         */
        escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    }

    // Export
    window.TextFlowFormModal = new FormModal();
})();
