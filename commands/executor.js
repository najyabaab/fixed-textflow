/**
 * TextFlow Command Executor v2.0
 * Executes all dynamic commands with full functionality
 */

(function () {
    'use strict';

    // =========================================
    // PERFORMANCE MONITOR
    // =========================================
    const PerformanceMonitor = {
        timings: [],
        maxSamples: 100,

        measure(label, fn) {
            const start = performance.now();
            const result = fn();
            const duration = performance.now() - start;

            this.timings.push({ label, duration, timestamp: Date.now() });
            if (this.timings.length > this.maxSamples) this.timings.shift();

            if (duration > 50) {
                console.warn(`[TextFlow] Slow operation: ${label} took ${duration.toFixed(2)}ms`);
            }

            return result;
        },

        async measureAsync(label, fn) {
            const start = performance.now();
            const result = await fn();
            const duration = performance.now() - start;

            this.timings.push({ label, duration, timestamp: Date.now() });
            if (this.timings.length > this.maxSamples) this.timings.shift();

            if (duration > 50) {
                console.warn(`[TextFlow] Slow async operation: ${label} took ${duration.toFixed(2)}ms`);
            }

            return result;
        },

        getStats() {
            if (!this.timings.length) return null;
            const durations = this.timings.map(t => t.duration);
            return {
                avg: durations.reduce((a, b) => a + b, 0) / durations.length,
                max: Math.max(...durations),
                min: Math.min(...durations),
                p95: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]
            };
        }
    };

    class CommandExecutor {
        constructor() {
            // Cursor marker - unique token unlikely to appear in user text
            this.CURSOR_MARKER = '\u200B\u200C\u200D'; // Zero-width spaces

            this.context = {
                site: {},
                user: {},
                snippets: {},
                formValues: {},
                variables: {},
                rootSnippet: null,      // Metadata for initially-triggered snippet
                currentSnippet: null,   // Current snippet being executed
                currentTrigger: null,   // Exact text typed by user to trigger
                importDepth: 0,         // Track nested import depth
                importChain: new Set()  // Track imported snippet shortcuts for circular detection
            };
        }

        /**
         * Set execution context
         */
        setContext(ctx) {
            Object.assign(this.context, ctx);
        }

        /**
         * Reset execution context to complete default state
         */
        reset() {
            this.context = {
                site: {},
                user: {},
                snippets: {},
                formValues: {},
                variables: {},
                rootSnippet: null,
                currentSnippet: null,
                currentTrigger: null,
                importDepth: 0,
                importChain: new Set()  // Track imported snippet shortcuts for circular detection
            };
        }

        /**
         * Set form values from user input
         */
        setFormValues(values) {
            this.context.formValues = values || {};
        }

        /**
         * Main execution entry point
         */
        async execute(text, options = {}) {
            const parser = window.TextFlowParser;
            if (!parser) {
                return { content: text, requiresForm: false, formFields: [] };
            }

            // Extract form fields first
            const formFields = parser.extractFormFields(text);
            const hasFormValues = Object.keys(this.context.formValues).length > 0;

            // If there are form fields and no values yet, return for form collection
            if (formFields.length > 0 && !hasFormValues) {
                return {
                    content: text,
                    requiresForm: true,
                    formFields,
                    cursorPosition: -1
                };
            }

            // Validate singleton cursor constraint BEFORE processing
            this.validateSingletonCursor(text);

            // Initialize clipboard content in context variables for formula access
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                    const response = await chrome.runtime.sendMessage({ type: 'GET_CLIPBOARD' });
                    this.context.variables.clipboard = response?.text || '';
                } else if (navigator.clipboard) {
                    this.context.variables.clipboard = await navigator.clipboard.readText();
                }
            } catch (e) {
                // Silently fail if clipboard access is denied
                this.context.variables.clipboard = '';
            }

            // Process block commands first (they can contain nested commands)
            let result = await this.processBlocks(text, options);

            // Then process inline commands
            result = await this.processInlineCommands(result, options);

            // Clean up note markers from final output UNLESS in preview mode
            if (!options.preview) {
                result = this.cleanupNoteMarkers(result);
            }

            // Find cursor position using the marker
            const cursorIndex = result.indexOf(this.CURSOR_MARKER);
            const cursorPosition = cursorIndex >= 0 ? cursorIndex : -1;

            // Remove cursor marker from result
            result = result.replace(this.CURSOR_MARKER, '');

            return {
                content: result,
                requiresForm: false,
                formFields: [],
                cursorPosition
            };
        }

        /**
         * Validate that only one {cursor} command exists in the text
         * Throws an error if multiple cursor commands are found
         */
        validateSingletonCursor(text) {
            const pattern = /\{cursor(?::[^}]*)?\}/gi;
            const matches = text.match(pattern);

            if (matches && matches.length > 1) {
                throw new Error(
                    `Validation Error: Only one {cursor} command is allowed per snippet. ` +
                    `Found ${matches.length} cursor commands.`
                );
            }
        }

        /**
         * Process block commands (if, repeat, formtoggle, etc.)
         */
        async processBlocks(text, options = {}) {
            const parser = window.TextFlowParser;
            let result = text;

            // Process from innermost to outermost
            let blocks = parser.parseBlocks(result);

            // Sort by nesting depth (process innermost first)
            blocks.sort((a, b) => b.start - a.start);

            for (const block of blocks) {
                const replacement = await this.executeBlock(block, options);

                // Apply trim logic for block commands
                let start = block.start;
                let end = block.end;

                if (block.args.named.trim) {
                    const trimMode = block.args.named.trim;
                    if (trimMode === 'yes' || trimMode === 'true' || trimMode === 'left') {
                        // Trim left: expand start to include preceding whitespace
                        while (start > 0 && /\s/.test(result[start - 1])) {
                            start--;
                        }
                    }
                    if (trimMode === 'yes' || trimMode === 'true' || trimMode === 'right') {
                        // Trim right: expand end to include succeeding whitespace
                        while (end < result.length && /\s/.test(result[end])) {
                            end++;
                        }
                    }
                }

                result = result.substring(0, start) + replacement + result.substring(end);
            }

            return result;
        }

        /**
         * Execute a block command
         */
        async executeBlock(block, options = {}) {
            switch (block.command) {
                case 'if':
                    return this.executeIf(block);

                case 'repeat':
                    return this.executeRepeat(block, options);

                case 'formtoggle':
                    return this.executeFormToggle(block);

                case 'link':
                    return this.executeLink(block);

                case 'note':
                    return this.executeNote(block);

                case 'run':
                    await this.evaluateWithSandbox(block.content);
                    return ''; // Run produces no output

                default:
                    return block.fullMatch;
            }
        }

        /**
         * Execute if/else/elseif block
         */
        async executeIf(block) {
            // Check main condition
            const condition = block.args.positional[0] || block.args.raw;
            const isTrue = await this.evaluateCondition(condition);

            if (isTrue) {
                return block.content;
            }

            // Check elseifs if present
            if (block.elseifs && block.elseifs.length > 0) {
                for (const elseif of block.elseifs) {
                    const elseifTrue = await this.evaluateCondition(elseif.condition);
                    if (elseifTrue) {
                        return elseif.content;
                    }
                }
            }

            // Fallback to else
            return block.elseContent || '';
        }

        /**
         * Execute repeat block
         */
        async executeRepeat(block, options = {}) {
            const arg = block.args.positional[0] || block.args.raw;

            // Check for "for item in list" syntax
            const forMatch = arg.match(/for\s+(\w+)\s+in\s+(.+)/i);

            if (forMatch) {
                const itemName = forMatch[1];
                const listExpr = forMatch[2];
                const list = await this.evaluateWithSandbox(listExpr);

                if (Array.isArray(list)) {
                    let result = '';
                    let idx = 0;
                    for (const item of list) {
                        this.context.variables[itemName] = item;
                        this.context.variables['i'] = idx;
                        this.context.variables['index'] = idx + 1;
                        result += await this.processInlineCommands(block.content, options);
                        idx++;
                    }
                    return result;
                }
                return '';
            }

            // Normal repeat count
            let count = parseInt(arg);
            if (isNaN(count)) {
                // Try to evaluate as variable or expression
                const val = await this.evaluateWithSandbox(arg);
                count = parseInt(val) || 0;
            }

            if (count > 0) {
                // Check against reasonable limit
                if (count > 100) count = 100;

                let result = '';
                try {
                    for (let n = 0; n < count; n++) {
                        this.context.variables['i'] = n;
                        this.context.variables['index'] = n + 1;
                        result += await this.processInlineCommands(block.content, options);
                    }
                } finally {
                    delete this.context.variables['i'];
                    delete this.context.variables['index'];
                }
                return result;
            }

            return '';
        }

        /**
         * Execute formtoggle block
         */
        executeFormToggle(block) {
            const name = block.args.named.name || 'toggle';
            const value = this.context.formValues[name];

            if (value === true || value === 'yes' || value === 'true') {
                return block.content;
            }
            return '';
        }

        /**
         * Execute link block
         */
        executeLink(block) {
            const url = block.args.positional[0] || block.args.raw;
            const text = block.content;
            // For plain text output, just return the text
            // In HTML context, this would create an anchor
            return text;
        }

        /**
         * Execute note block
         * Notes are internal comments/instructions visible during preview but excluded from final output
         * 
         * Parameters:
         * - preview (yes/no, default: yes) - Show in form preview  
         * - insert (yes/no, default: no) - Include in final output
         * - color (none/red/green/yellow/blue, default: none) - Visual styling in preview
         * - trim (yes/no/left/right, default: no) - Whitespace handling
         */
        executeNote(block) {
            // Parse parameters with defaults
            const preview = block.args.named.preview !== 'no'; // Default: yes
            const insert = block.args.named.insert === 'yes';   // Default: no
            const color = block.args.named.color || 'none';

            // If insert=yes, just return the content (rare case)
            if (insert) {
                return block.content;
            }

            // If preview=yes, return a marker that can be detected in form preview
            // The marker will be stripped from final output but shown in preview
            if (preview) {
                return `[[NOTE:${color}]]${block.content}[[/NOTE]]`;
            }

            // If preview=no, suppress entirely (hidden comment)
            return '';
        }

        /**
         * Clean up note markers from final output
         * Note markers are used during preview generation but removed from actual inserted text
         */
        cleanupNoteMarkers(text) {
            const notePattern = /\[\[NOTE:\w+\]\].*?\[\[\/NOTE\]\]/gs;
            return text.replace(notePattern, '');
        }

        /**
         * Process all inline commands
         */
        async processInlineCommands(text, options = {}) {
            const parser = window.TextFlowParser;
            let result = text;

            // Get all commands and process from end to start (to preserve positions)
            let commands = parser.parseAll(result);
            commands.sort((a, b) => b.start - a.start);

            for (const cmd of commands) {
                // Skip block end tags
                if (cmd.command.startsWith('end')) continue;
                if (cmd.command === 'else' || cmd.command === 'elseif') continue;

                const replacement = await this.executeCommand(cmd, options);

                // Handle trim
                let start = cmd.start;
                let end = cmd.end;

                if (cmd.args.named.trim) {
                    const trimMode = cmd.args.named.trim;
                    if (trimMode === 'yes' || trimMode === 'true' || trimMode === 'left') {
                        // Trim left (expand start to include preceding whitespace)
                        while (start > 0 && /\s/.test(result[start - 1])) {
                            start--;
                        }
                    }
                    if (trimMode === 'yes' || trimMode === 'true' || trimMode === 'right') {
                        // Trim right (expand end to include succeeding whitespace)
                        while (end < result.length && /\s/.test(result[end])) {
                            end++;
                        }
                    }
                }

                result = result.substring(0, start) + replacement + result.substring(end);
            }

            return result;
        }

        /**
         * Execute a single command
         */
        async executeCommand(cmd, options = {}) {
            const handler = this.getHandler(cmd.command);

            if (handler) {
                try {
                    return await handler.call(this, cmd, options);
                } catch (e) {
                    console.error(`[TextFlow] Error executing ${cmd.command}:`, e);
                    return cmd.fullMatch;
                }
            } else {
                // Try variable assignment if command is not known
                // Case 1: {x = 10} -> command="x", args raw="= 10"
                if (cmd.args.raw && cmd.args.raw.trim().startsWith('=')) {
                    const varName = cmd.command;
                    // Remove leading =
                    const expr = cmd.args.raw.trim().substring(1);
                    await this.handleAssignment(varName, expr);
                    return ''; // No output for assignment
                }
            }

            return cmd.fullMatch;
        }

        /**
         * Get handler for command
         */
        getHandler(command) {
            const handlers = {
                // Form commands
                'textfield': this.handletextfield,
                'formparagraph': this.handleFormParagraph,
                'dropdown': this.handledropdown,
                'formdate': this.handleFormDate,
                'formtoggle': this.handleFormToggleInline,

                // Date/Time
                'time': this.handleTime,

                // Clipboard & Cursor
                'clipboard': this.handleClipboard,
                'cursor': this.handleCursor,

                // Formula
                '=': this.handleFormula,

                // Site data
                'site': this.handleSite,

                // Include snippet
                'import': this.handleImport,
                'snippet': this.handleSnippetInfo,

                // User data
                'user': this.handleUser,

                // Automation
                'key': this.handleKey,
                'wait': this.handleWait,
                'click': this.handleClick,

                'key': this.handleKey,
                'wait': this.handleWait,
                'click': this.handleClick,
                'run': this.handleRunInline,

                // Error handling
                'error': this.handleError,

                // Explicit assignment command {set: x=10} (optional, but good to have)
                'set': this.handleSetCommand
            };

            return handlers[command];
        }

        // ========== CORE EVALUATOR ==========

        /**
         * Evaluate a formula expression using a sandboxed environment
         * Replaces the old safeEval/parseExpression
         */
        async evaluateWithSandbox(expr) {
            if (!expr) return '';

            // Resolve standard logic operators
            let jsExpr = expr
                .replace(/\band\b/gi, '&&')
                .replace(/\bor\b/gi, '||')
                .replace(/\bnot\b/gi, '!')
                .replace(/\s*<>\s*/g, ' !== '); // = is handled by JS equality

            // Prepare context variables
            const contextVars = { ...this.context.formValues, ...this.context.variables };
            const varNames = Object.keys(contextVars);
            const varValues = Object.values(contextVars);

            // Add helper functions
            const helpers = this.getSandboxFunctions();
            const helperNames = Object.keys(helpers);
            const helperValues = Object.values(helpers);

            try {
                // Create a function with all variables and helpers in scope
                const func = new Function(...varNames, ...helperNames, `
                    "use strict";
                    return (${jsExpr});
                `);

                const result = func(...varValues, ...helperValues);
                return result;
            } catch (e) {
                console.warn('[TextFlow] Sandbox eval error:', e.message);
                // Fallback: try safe math evaluator (works on CSP-restricted pages)
                const mathResult = this.safeEvalMath(expr);
                if (mathResult !== null) return mathResult;
                return expr;
            }
        }

        /**
         * Safe math expression evaluator (no eval/new Function needed).
         * Handles +, -, *, /, %, parentheses, and decimal numbers.
         * Returns null if expression cannot be evaluated safely.
         */
        safeEvalMath(expr) {
            if (!expr || typeof expr !== 'string') return null;
            const trimmed = expr.trim();
            if (!trimmed) return null;

            // Only allow digits, spaces, basic operators, parens, and decimal points
            if (!/^[\d\s+\-*/().%]+$/.test(trimmed)) return null;

            try {
                // Use a simple recursive descent parser for arithmetic
                let pos = 0;
                const input = trimmed.replace(/\s+/g, '');

                const peek = () => input[pos] || '';
                const consume = () => input[pos++] || '';

                const parsePrimary = () => {
                    if (peek() === '(') {
                        consume(); // '('
                        const val = parseExpression();
                        consume(); // ')'
                        return val;
                    }
                    let numStr = '';
                    while (/[\d.]/.test(peek())) numStr += consume();
                    if (numStr === '') return null;
                    return parseFloat(numStr);
                };

                const parseMulDiv = () => {
                    let left = parsePrimary();
                    if (left === null) return null;
                    while (peek() === '*' || peek() === '/' || peek() === '%') {
                        const op = consume();
                        const right = parsePrimary();
                        if (right === null) return null;
                        if (op === '*') left *= right;
                        else if (op === '/') left /= right;
                        else if (op === '%') left %= right;
                    }
                    return left;
                };

                const parseExpression = () => {
                    let left = parseMulDiv();
                    if (left === null) return null;
                    while (peek() === '+' || peek() === '-') {
                        const op = consume();
                        const right = parseMulDiv();
                        if (right === null) return null;
                        if (op === '+') left += right;
                        else left -= right;
                    }
                    return left;
                };

                const result = parseExpression();
                if (result === null || pos !== input.length) return null;
                return result;
            } catch {
                return null;
            }
        }

        /**
         * Get all available functions for the sandbox
         */
        getSandboxFunctions() {
            return {
                // Math
                round: Math.round,
                floor: Math.floor,
                ceil: Math.ceil,
                sqrt: Math.sqrt,
                abs: Math.abs,
                min: (...args) => Math.min(...args),
                max: (...args) => Math.max(...args),
                random: Math.random,

                // String
                upper: s => String(s).toUpperCase(),
                lower: s => String(s).toLowerCase(),
                trim: s => String(s).trim(),
                len: s => (Array.isArray(s) || typeof s === 'string') ? s.length : 0,
                left: (s, n) => String(s).substring(0, n),
                right: (s, n) => String(s).slice(-n),
                mid: (s, start, len) => String(s).substring(start, start + len),
                replace: (s, find, repl) => String(s).replace(new RegExp(find, 'g'), repl),
                contains: (s, find) => String(s).includes(find),

                // List / Array
                count: arr => Array.isArray(arr) ? arr.length : 0,
                sum: arr => Array.isArray(arr) ? arr.reduce((a, b) => a + Number(b), 0) : 0,
                join: (arr, sep) => Array.isArray(arr) ? arr.join(sep) : '',
                split: (s, sep) => String(s).split(sep),

                // Advanced List
                map: (arr, fn) => Array.isArray(arr) ? arr.map(fn) : [],
                filter: (arr, fn) => Array.isArray(arr) ? arr.filter(fn) : [],
                reduce: (arr, fn, init) => Array.isArray(arr) ? arr.reduce(fn, init) : init,
                sort: (arr) => Array.isArray(arr) ? [...arr].sort() : arr,
                first: (arr) => Array.isArray(arr) ? arr[0] : arr,
                last: (arr) => Array.isArray(arr) ? arr[arr.length - 1] : arr,

                // Regex
                testregex: (text, pattern) => new RegExp(pattern).test(text),
                extractregex: (text, pattern) => {
                    const match = String(text).match(new RegExp(pattern));
                    if (!match) {
                        throw new Error('No match found');
                    }
                    // Return captured group if exists, otherwise return full match
                    return match[1] !== undefined ? match[1] : match[0];
                },
                replaceregex: (text, pattern, repl) => String(text).replace(new RegExp(pattern, 'g'), repl),

                // Error handling
                catch: (tryExpression, catchValue) => {
                    // This is a special function that catches errors from formulas
                    // Note: Since we're in a sandbox, the actual error handling
                    // happens at the formula evaluation level
                    try {
                        if (tryExpression === null || tryExpression === undefined || tryExpression === '') {
                            return catchValue;
                        }
                        return tryExpression;
                    } catch (e) {
                        return catchValue;
                    }
                },

                // Date Parts
                year: (d) => (d ? new Date(d) : new Date()).getFullYear(),
                month: (d) => (d ? new Date(d) : new Date()).getMonth() + 1,
                day: (d) => (d ? new Date(d) : new Date()).getDate(),
                weekday: (d) => (d ? new Date(d) : new Date()).toLocaleString('en', { weekday: 'long' }),
                today: () => new Date().toISOString().split('T')[0],
                now: () => new Date().toISOString(),

                // JSON
                json: (obj) => JSON.stringify(obj),
                fromjson: (str) => { try { return JSON.parse(str); } catch (e) { return null; } },

                // Conditional
                if: (cond, a, b) => cond ? a : b
            };
        }

        // ========== FORM HANDLERS ==========

        async handletextfield(cmd) {
            const name = cmd.args.named.name || cmd.args.positional[0] || 'field';
            let value = this.context.formValues[name];

            // Handle required validation
            const isRequired = cmd.args.named.required === 'yes' || cmd.args.named.required === 'true';
            if (isRequired && (value === undefined || value === null || String(value).trim() === '')) {
                throw new Error(`Field '${name}' is required`);
            }

            if (value !== undefined) {
                return await this.applyFormatter(value, cmd.args.named.formatter);
            }
            return cmd.args.named.default || '';
        }

        async handleFormParagraph(cmd) {
            const name = cmd.args.named.name || cmd.args.positional[0] || 'field';
            let value = this.context.formValues[name];

            // Handle required validation
            const isRequired = cmd.args.named.required === 'yes' || cmd.args.named.required === 'true';
            if (isRequired && (value === undefined || value === null || String(value).trim() === '')) {
                throw new Error(`Field '${name}' is required`);
            }

            if (value !== undefined) {
                return await this.applyFormatter(value, cmd.args.named.formatter);
            }
            return cmd.args.named.default || '';
        }

        async handledropdown(cmd) {
            const name = cmd.args.named.name || 'choice';
            const value = this.context.formValues[name];
            const itemFormatter = cmd.args.named.itemformatter;
            const listFormatter = cmd.args.named.formatter;

            if (value !== undefined) {
                if (Array.isArray(value)) {
                    // Apply itemformatter to each item
                    let processed = value;
                    if (itemFormatter) {
                        processed = await this.applyItemFormatter(value, itemFormatter);
                    }
                    // Apply formatter to the final list
                    if (listFormatter) {
                        return await this.applyListFormatter(processed, listFormatter);
                    }
                    return processed.join(', ');
                }

                // Single value
                let processed = value;
                if (itemFormatter) {
                    // Treat single value as one item in a list [val]
                    const res = await this.applyItemFormatter([value], itemFormatter);
                    processed = res[0];
                }

                return await this.applyFormatter(processed, cmd.args.named.formatter);
            }
            return cmd.args.named.default || cmd.args.positional[0] || '';
        }

        handleFormDate(cmd) {
            const name = cmd.args.named.name || 'date';
            const format = cmd.args.positional[0] || 'YYYY-MM-DD';
            const value = this.context.formValues[name];

            if (value) {
                const date = new Date(value);
                return this.formatDate(date, format);
            }

            // Use default or now
            let defaultVal = cmd.args.named.default;
            let dateToFormat = new Date();

            if (defaultVal) {
                // Check for relative default (e.g. +1d)
                if (/^[<>]?[+-]?\d*[A-Za-z]+$/.test(defaultVal)) {
                    dateToFormat = this.applyDateShift(new Date(), defaultVal);
                } else {
                    dateToFormat = new Date(defaultVal);
                }
            }

            return this.formatDate(dateToFormat, format);
        }

        handleFormToggleInline(cmd) {
            const name = cmd.args.named.name || 'toggle';
            const value = this.context.formValues[name];
            const formatter = cmd.args.named.formatter;

            const isOn = value === true || value === 'yes' || value === 'true';

            if (formatter) {
                return isOn ? 'yes' : 'no';
            }

            return isOn ? 'yes' : 'no';
        }

        // ========== DATE/TIME HANDLER ==========

        handleTime(cmd) {
            // Use raw args string to preserve commas in date format (e.g. "MMMM Do, YYYY")
            const format = cmd.args.raw || cmd.args.positional[0] || 'YYYY-MM-DD HH:mm:ss';
            const shift = cmd.args.named.shift;
            const atDate = cmd.args.named.at;
            const locale = cmd.args.named.locale || 'en';

            let date = atDate ? new Date(atDate) : new Date();

            // Apply shift modifier
            if (shift) {
                date = this.applyDateShift(date, shift);
            }

            return this.formatDate(date, format, locale);
        }

        /**
         * Apply date shift modifier
         */
        applyDateShift(date, shift) {
            const result = new Date(date);

            // Parse shift like +5D, -2W, +1M, +1Y, +3H, +30m, >MON, <FRI
            const match = shift.match(/^([<>]?)([+-]?)(\d*)([DWMYHms]|MON|TUE|WED|THU|FRI|SAT|SUN)?$/i);

            if (!match) return result;

            const [, direction, sign, amount, unit] = match;
            const num = parseInt(amount) || 1;
            const multiplier = sign === '-' ? -1 : 1;

            // Handle day of week navigation (>MON, <FRI)
            if (direction === '>' || direction === '<') {
                const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
                const targetDay = days.indexOf(unit?.toUpperCase());

                if (targetDay >= 0) {
                    const currentDay = result.getDay();
                    let diff = targetDay - currentDay;

                    if (direction === '>') {
                        if (diff <= 0) diff += 7;
                    } else {
                        if (diff >= 0) diff -= 7;
                    }

                    result.setDate(result.getDate() + diff);
                    return result;
                }
            }

            // Handle standard shifts
            switch (unit?.toUpperCase()) {
                case 'D':
                    result.setDate(result.getDate() + (num * multiplier));
                    break;
                case 'W':
                    result.setDate(result.getDate() + (num * 7 * multiplier));
                    break;
                case 'M':
                    result.setMonth(result.getMonth() + (num * multiplier));
                    break;
                case 'Y':
                    result.setFullYear(result.getFullYear() + (num * multiplier));
                    break;
                case 'H':
                    result.setHours(result.getHours() + (num * multiplier));
                    break;
                case 'S':
                case 'SECONDS':
                    result.setSeconds(result.getSeconds() + (num * multiplier));
                    break;
                case 'MIN':
                case 'MINS':
                    result.setMinutes(result.getMinutes() + (num * multiplier));
                    break;
                default:
                    if (unit === 'm') {
                        result.setMinutes(result.getMinutes() + (num * multiplier));
                    }
                    break;
            }

            return result;
        }

        /**
         * Format date with given format string
         */
        formatDate(date, format, locale = 'en') {
            if (!(date instanceof Date) || isNaN(date)) {
                date = new Date();
            }

            const tokens = {
                'YYYY': () => String(date.getFullYear()),
                'YY': () => String(date.getFullYear()).slice(-2),
                'MMMM': () => date.toLocaleString(locale, { month: 'long' }),
                'MMM': () => date.toLocaleString(locale, { month: 'short' }),
                'MM': () => String(date.getMonth() + 1).padStart(2, '0'),
                'M': () => date.getMonth() + 1,
                'DDDD': () => date.toLocaleString(locale, { weekday: 'long' }),
                'DDD': () => date.toLocaleString(locale, { weekday: 'short' }),
                'dddd': () => date.toLocaleString(locale, { weekday: 'long' }),
                'ddd': () => date.toLocaleString(locale, { weekday: 'short' }),
                'DD': () => String(date.getDate()).padStart(2, '0'),
                'Do': () => this.getOrdinal(date.getDate()),
                'D': () => date.getDate(),
                'HH': () => String(date.getHours()).padStart(2, '0'),
                'H': () => date.getHours(),
                'hh': () => String(date.getHours() % 12 || 12).padStart(2, '0'),
                'h': () => date.getHours() % 12 || 12,
                'mm': () => String(date.getMinutes()).padStart(2, '0'),
                'm': () => date.getMinutes(),
                'ss': () => String(date.getSeconds()).padStart(2, '0'),
                's': () => date.getSeconds(),
                'A': () => date.getHours() >= 12 ? 'PM' : 'AM',
                'a': () => date.getHours() >= 12 ? 'pm' : 'am',
                'X': () => Math.floor(date.getTime() / 1000),
                'x': () => date.getTime()
            };

            // Sort tokens by length (longest first) for longest-match-first scanning
            const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);

            // Parse format left-to-right, matching longest token first.
            // This avoids corrupting output values with later short-token regex matches
            // (e.g. 'h' in ordinal suffix "12th" must NOT be replaced by hour token)
            let result = '';
            let i = 0;
            while (i < format.length) {
                let matched = false;
                for (const token of sortedTokens) {
                    if (format.substring(i, i + token.length) === token) {
                        result += String(tokens[token]());
                        i += token.length;
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    result += format[i];
                    i++;
                }
            }

            return result;
        }

        /**
         * Get ordinal suffix for number
         */
        getOrdinal(n) {
            const s = ['th', 'st', 'nd', 'rd'];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        }

        // ========== CLIPBOARD & CURSOR ==========

        async handleClipboard() {
            try {
                // Try to use background service worker for clipboard access
                if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                    const response = await chrome.runtime.sendMessage({ type: 'GET_CLIPBOARD' });
                    return response?.text || '';
                }

                // Fallback to direct clipboard access (for non-extension contexts)
                const text = await navigator.clipboard.readText();
                return text || '';
            } catch (e) {
                console.warn('[TextFlow] Clipboard access denied:', e);
                return '';
            }
        }

        handleCursor(cmd) {
            // Return the cursor marker that will be used to calculate position
            // The trim logic is automatically handled by processInlineCommands
            // which processes the trim parameter for all commands
            return this.CURSOR_MARKER;
        }

        // ========== FORMULA & ASSIGNMENT ==========

        async handleFormula(cmd) {
            const expression = cmd.args.raw || cmd.args.positional.join(' ');
            const result = await this.evaluateWithSandbox(expression);
            return String(result);
        }

        async handleAssignment(name, expr) {
            const value = await this.evaluateWithSandbox(expr);
            this.context.variables[name] = value;
        }

        async handleSetCommand(cmd) {
            const raw = cmd.args.raw;
            const eqIndex = raw.indexOf('=');
            if (eqIndex > 0) {
                const name = raw.substring(0, eqIndex).trim();
                const expr = raw.substring(eqIndex + 1).trim();
                await this.handleAssignment(name, expr);
            }
            return '';
        }

        /**
         * Evaluate a condition
         */
        async evaluateCondition(condition) {
            const result = await this.evaluateWithSandbox(condition);
            return result === true || result === 'true' ||
                (typeof result === 'number' && result !== 0) ||
                (typeof result === 'string' && result !== '' && result !== 'false') ||
                (Array.isArray(result) && result.length > 0) ||
                (typeof result === 'object' && result !== null);
        }

        // ========== SITE DATA ==========

        async handleSite(cmd) {
            const selector = cmd.args.named.selector || cmd.args.positional[0] || (cmd.args.raw ? cmd.args.raw : 'url');
            const attribute = cmd.args.named.attribute;
            const pagePattern = cmd.args.named.page;
            const multiple = cmd.args.named.multiple === 'yes' || cmd.args.named.multiple === 'true';
            const trim = cmd.args.named.trim;

            // XPath check
            const isXPath = selector.startsWith('xpath:') || selector.startsWith('//') || selector.startsWith('(');

            // If page pattern is specified and doesn't explicitly match current page only,
            // we need to delegate to background script for cross-tab extraction
            if (pagePattern) {
                try {
                    const result = await chrome.runtime.sendMessage({
                        type: 'EXTRACT_SITE_DATA',
                        payload: {
                            selector,
                            attribute,
                            pagePattern,
                            multiple,
                            trim,
                            group: cmd.args.named.group,
                            selectValue: cmd.args.named.select,
                            isXPath
                        }
                    });
                    return result || '';
                } catch (e) {
                    console.warn('[TextFlow] Remote site extraction failed:', e);
                    // Fallback to local if possible, or return empty
                    return '';
                }
            }

            // Local execution (current tab)

            // 1. Handle built-in non-selector types
            const builtIns = {
                'url': () => window.location.href,
                'title': () => document.title,
                'domain': () => window.location.hostname,
                'protocol': () => window.location.protocol.replace(':', ''),
                'path': () => window.location.pathname,
                'query': () => window.location.search,
                'hash': () => window.location.hash,
                'selection': () => window.getSelection()?.toString() || ''
            };

            const lowerSelector = selector.toLowerCase();
            if (builtIns[lowerSelector] && !cmd.args.named.selector && !isXPath) {
                return builtIns[lowerSelector]();
            }

            // 2. Selector Extraction
            try {
                let textResult = '';

                if (isXPath) {
                    const xpath = selector.replace(/^xpath:/i, '');
                    const nodes = this.evaluateXPath(xpath);

                    if (multiple) {
                        return nodes.map(n => n.textContent.trim()).join(', ');
                    } else {
                        return nodes.length > 0 ? nodes[0].textContent.trim() : '';
                    }
                }

                if (multiple) {
                    const elements = document.querySelectorAll(selector);
                    const values = Array.from(elements).map(el => this.extractElementValue(el, attribute, trim));
                    return values.join(', ');
                } else {
                    const element = document.querySelector(selector);
                    if (!element) return '';
                    textResult = this.extractElementValue(element, attribute, trim);
                }

                return textResult;

            } catch (e) {
                console.warn('[TextFlow] Local site extraction failed:', e);
                return '';
            }
        }

        extractElementValue(element, attribute, trim) {
            let value = '';

            if (attribute) {
                value = element.getAttribute(attribute) || '';
            } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
                value = element.value;
            } else if (element.tagName === 'IMG' && !attribute) {
                value = element.src;
            } else if (element.tagName === 'A' && !attribute) {
                value = element.href;
            } else {
                value = element.textContent || '';
            }

            // Handle trimming
            if (trim) {
                if (trim === 'yes' || trim === 'true') value = value.trim();
                else if (trim === 'left') value = value.trimStart();
                else if (trim === 'right') value = value.trimEnd();
            }

            return value;
        }

        evaluateXPath(xpath) {
            const results = [];
            try {
                const query = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < query.snapshotLength; i++) {
                    results.push(query.snapshotItem(i));
                }
            } catch (e) {
                console.warn('[TextFlow] XPath error:', e);
            }
            return results;
        }

        /**
         * Smart element selector
         * Supports:
         * - text="Login" (exact match)
         * - text~="Log" (partial/regex match)
         * - xpath="//div"
         * - .class, #id (standard CSS)
         */
        async getElementBySelector(selector) {
            if (!selector) return null;

            // Handle text selectors: text="Value" or text~="Value"
            const textMatch = selector.match(/^text(~?=)(.+)/);
            if (textMatch) {
                const isPartial = textMatch[1] === '~=';
                const text = textMatch[2].replace(/^["']|["']$/g, ''); // Unquote if needed

                // Use XPath to find elements containing text
                const xpath = isPartial
                    ? `//*[contains(text(), "${text}")]`
                    : `//*[text()="${text}"]`;

                const nodes = this.evaluateXPath(xpath);
                // Return the first visible one preferably, or just first one
                return nodes.length > 0 ? nodes[0] : null;
            }

            // Handle explicit XPath
            if (selector.startsWith('xpath:')) {
                const xpath = selector.replace(/^xpath:/, '');
                const nodes = this.evaluateXPath(xpath);
                return nodes.length > 0 ? nodes[0] : null;
            }

            // Standard CSS selector
            return document.querySelector(selector);
        }

        // ========== SNIPPET IMPORT ==========

        async handleImport(cmd) {
            const MAX_IMPORT_DEPTH = 10;
            this.context.importDepth = (this.context.importDepth || 0) + 1;

            // Initialize importChain if needed
            if (!this.context.importChain) {
                this.context.importChain = new Set();
            }

            if (this.context.importDepth > MAX_IMPORT_DEPTH) {
                this.context.importDepth--;
                return '[Import limit reached]';
            }

            const shortcut = cmd.args.positional[0] || cmd.args.raw;

            // SECURITY: Circular import detection
            // Check if this shortcut is already in the current import chain
            if (this.context.importChain.has(shortcut)) {
                console.warn(`[TextFlow] Circular import detected: ${shortcut} is already in the import chain`);
                this.context.importDepth--;
                return `[Circular import: ${shortcut}]`;
            }

            const snippet = this.context.snippets?.[shortcut];

            let result = '';
            if (snippet?.content) {
                // Add current shortcut to import chain before processing
                this.context.importChain.add(shortcut);

                // Preserve rootSnippet during import to maintain correct introspection
                // The {snippet} command should always reference the initially-triggered snippet
                // rootSnippet is set ONCE when first import happens, never overwritten
                const savedCurrentSnippet = this.context.currentSnippet;
                const savedRootSnippet = this.context.rootSnippet;

                // Only set rootSnippet if not already set (first import in chain)
                if (!this.context.rootSnippet) {
                    this.context.rootSnippet = savedCurrentSnippet;
                }
                this.context.currentSnippet = snippet;

                const execResult = await this.execute(snippet.content);
                result = execResult.content;

                // Restore previous state
                this.context.currentSnippet = savedCurrentSnippet;
                // Don't restore rootSnippet - it should persist until complete execution ends

                // Remove shortcut from import chain (allow re-import in separate branches)
                this.context.importChain.delete(shortcut);
            }

            this.context.importDepth--;
            return result;
        }

        /**
         * Handle {snippet} command - Snippet introspection
         * Returns metadata about the current snippet
         * 
         * Properties:
         * - id: Unique snippet identifier
         * - shortcut: The snippet's trigger shortcut
         * - trigger: The exact text typed by user (case-sensitive)
         * - name: Snippet name (optional, for backwards compatibility)
         * 
         * Inheritance Rule:
         * - Always references the ROOT snippet (initially triggered)
         * - Even when called from imported snippets
         */
        handleSnippetInfo(cmd) {
            // Get property and trim whitespace
            const rawProperty = cmd.args.positional[0] || cmd.args.raw || 'name';
            const property = rawProperty.trim();

            // Use rootSnippet if available (for import scenarios), otherwise currentSnippet
            const snippet = this.context.rootSnippet || this.context.currentSnippet;

            if (!snippet) return '';

            // Property names MUST be lowercase - return empty for invalid cases
            const lowerProperty = property.toLowerCase();
            if (lowerProperty !== property) {
                // Property name contains uppercase - invalid, return empty
                return '';
            }

            switch (lowerProperty) {
                case 'id':
                    return snippet.id || '';
                case 'shortcut':
                    return snippet.shortcut || '';
                case 'trigger':
                    // Return the exact trigger text as typed by user (case-sensitive)
                    return this.context.currentTrigger || snippet.shortcut || '';
                case 'name':
                    return snippet.name || '';
                default:
                    return '';
            }
        }

        // ========== USER DATA ==========

        handleUser(cmd) {
            const property = cmd.args.positional[0] || cmd.args.raw;
            return this.context.user?.[property] || '';
        }

        // ========== AUTOMATION ==========

        async handleKey(cmd, options = {}) {
            if (options.preview) return ''; // Skip keys in preview

            const keyArg = cmd.args.positional[0] || cmd.args.raw;
            const count = parseInt(cmd.args.named.count) || 1;
            const delay = parseInt(cmd.args.named.delay) || 0;

            try {
                // Optional selector to focus first
                if (cmd.args.named.selector) {
                    const el = await this.getElementBySelector(cmd.args.named.selector);
                    if (el) el.focus();
                }

                const activeEl = document.activeElement;
                if (!activeEl) return '';

                const keyParts = keyArg.toLowerCase().split('+');
                const keyName = keyParts[keyParts.length - 1];

                const keyMap = {
                    'enter': 'Enter', 'tab': 'Tab', 'esc': 'Escape', 'space': ' ',
                    'backspace': 'Backspace', 'delete': 'Delete',
                    'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight',
                    'home': 'Home', 'end': 'End', 'pageup': 'PageUp', 'pagedown': 'PageDown',
                    'ins': 'Insert', 'insert': 'Insert',
                    'capslock': 'CapsLock', 'printscreen': 'PrintScreen',
                    'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4', 'f5': 'F5', 'f6': 'F6',
                    'f7': 'F7', 'f8': 'F8', 'f9': 'F9', 'f10': 'F10', 'f11': 'F11', 'f12': 'F12',
                    'win': 'Meta', 'cmd': 'Meta', 'command': 'Meta', 'meta': 'Meta',
                    'ctrl': 'Control', 'control': 'Control', 'shift': 'Shift', 'alt': 'Alt'
                };

                const finalKey = keyMap[keyName] || keyName;

                const eventOptions = {
                    key: finalKey, code: finalKey, keyCode: 0,
                    ctrlKey: keyParts.includes('ctrl') || keyParts.includes('control'),
                    shiftKey: keyParts.includes('shift'),
                    altKey: keyParts.includes('alt'),
                    metaKey: keyParts.includes('meta') || keyParts.includes('cmd') || keyParts.includes('win'),
                    bubbles: true, cancelable: true, view: window
                };

                // Repeat key press count times
                for (let i = 0; i < count; i++) {
                    activeEl.dispatchEvent(new KeyboardEvent('keydown', eventOptions));

                    if (finalKey.length === 1) {
                        activeEl.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
                    }

                    activeEl.dispatchEvent(new KeyboardEvent('keyup', eventOptions));

                    if (finalKey.length === 1 && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                        activeEl.dispatchEvent(new InputEvent('input', {
                            inputType: 'insertText', data: finalKey, bubbles: true, cancelable: true
                        }));
                    }

                    if (delay > 0 && i < count - 1) {
                        await new Promise(r => setTimeout(r, delay));
                    }
                }

            } catch (e) {
                console.warn('[TextFlow] Key simulation failed:', e);
            }

            return '';
        }

        /**
         * Parse delay string to milliseconds
         * Supports: "10s", "2s", "500ms", "1m", "1h"
         * Default: 1000ms (1s)
         */
        parseDelayToMs(delay) {
            // If no delay provided, default to 1 second
            if (!delay || delay.trim() === '') {
                return 1000;
            }

            // If it's a plain number, treat as milliseconds for backward compatibility
            const plainNum = parseInt(delay);
            if (!isNaN(plainNum) && String(plainNum) === String(delay).trim()) {
                return plainNum;
            }

            // Parse time-based syntax (e.g., "10s", "500ms", "2m")
            const match = String(delay).trim().match(/^([+-]?)(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/);

            if (!match) {
                // Invalid format, return default
                return 1000;
            }

            const sign = match[1] === '-' ? -1 : 1;
            const amount = parseFloat(match[2]);
            const unit = match[3].toLowerCase();

            let milliseconds = 0;

            switch (unit) {
                case 's':
                case 'sec':
                case 'secs':
                case 'second':
                case 'seconds':
                    milliseconds = amount * 1000;
                    break;
                case 'ms':
                case 'millisecond':
                case 'milliseconds':
                    milliseconds = amount;
                    break;
                case 'm':
                case 'min':
                case 'mins':
                case 'minute':
                case 'minutes':
                    milliseconds = amount * 60 * 1000;
                    break;
                case 'h':
                case 'hr':
                case 'hrs':
                case 'hour':
                case 'hours':
                    milliseconds = amount * 60 * 60 * 1000;
                    break;
                default:
                    // Unknown unit, return default
                    return 1000;
            }

            return Math.max(0, milliseconds * sign); // Ensure non-negative
        }

        async handleWait(cmd, options = {}) {
            if (options.preview) return ''; // Skip wait in preview

            const arg = cmd.args.positional[0] || cmd.args.raw;

            // Try to parse as delay (number or time-based string)
            const ms = this.parseDelayToMs(arg);

            // If we got a valid millisecond value and arg looks like a delay (not a selector)
            // Check if arg is numeric or contains time units
            const looksLikeDelay = !arg || /^[+-]?\d+(?:\.\d+)?\s*([a-zA-Z]+)?$/.test(String(arg).trim());

            if (looksLikeDelay) {
                // Time-based wait
                await new Promise(resolve => setTimeout(resolve, ms));
                return '';
            } else {
                // Element selector wait
                await this.waitForElement(arg);
                return '';
            }
        }

        async waitForElement(selector, timeout = 5000) {
            return new Promise(resolve => {
                // Try immediate check
                this.getElementBySelector(selector).then(el => {
                    if (el) return resolve(el);

                    const observer = new MutationObserver(async () => {
                        const el = await this.getElementBySelector(selector);
                        if (el) {
                            resolve(el);
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                    setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
                });
            });
        }

        async handleClick(cmd, options = {}) {
            if (options.preview) return ''; // Skip clicks in preview

            const selector = cmd.args.positional[0] || cmd.args.raw;
            try {
                // Use smart selector
                const element = await this.getElementBySelector(selector);

                if (element) {
                    // Scroll into view if needed
                    element.scrollIntoView({ behavior: 'auto', block: 'center' });

                    const mouseEventInit = { view: window, bubbles: true, cancelable: true, buttons: 1 };
                    element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
                    element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
                    element.click(); // Native click

                    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') element.focus();
                } else {
                    console.warn(`[TextFlow] Click element not found: ${selector}`);
                }
            } catch (e) { console.warn('[TextFlow] Click failed:', e); }
            return '';
        }

        // ========== ERROR HANDLING ==========

        handleError(cmd) {
            const message = cmd.args.positional[0] || cmd.args.raw || 'Validation error';
            const block = cmd.args.named.block;

            if (block === 'no' || block === 'false') {
                return message;
            }

            throw new Error(message);
        }

        async handleRunInline(cmd) {
            const code = cmd.args.positional[0] || cmd.args.raw;
            await this.evaluateWithSandbox(code);
            return '';
        }

        // ========== UTILITIES ==========

        async applyFormatter(value, formatter) {
            if (!formatter) return value;

            // Standard built-ins
            switch (formatter.toLowerCase()) {
                case 'upper': return String(value).toUpperCase();
                case 'lower': return String(value).toLowerCase();
                case 'title': return String(value).replace(/\b\w/g, c => c.toUpperCase());
                case 'trim': return String(value).trim();
            }

            // Custom expression
            // Save potential collision
            const oldVal = this.context.variables['value'];
            this.context.variables['value'] = value;

            try {
                return await this.evaluateWithSandbox(formatter);
            } finally {
                // Restore
                if (oldVal === undefined) delete this.context.variables['value'];
                else this.context.variables['value'] = oldVal;
            }
        }

        async applyItemFormatter(items, formatter) {
            const results = [];
            // Save state
            const oldItem = this.context.variables['item'];
            const oldText = this.context.variables['text'];
            const oldIdx = this.context.variables['index'];
            const oldI = this.context.variables['i'];

            try {
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    this.context.variables['item'] = item;
                    this.context.variables['text'] = item;
                    this.context.variables['index'] = i + 1;
                    this.context.variables['i'] = i;

                    results.push(await this.evaluateWithSandbox(formatter));
                }
            } finally {
                // Restore state
                if (oldItem === undefined) delete this.context.variables['item']; else this.context.variables['item'] = oldItem;
                if (oldText === undefined) delete this.context.variables['text']; else this.context.variables['text'] = oldText;
                if (oldIdx === undefined) delete this.context.variables['index']; else this.context.variables['index'] = oldIdx;
                if (oldI === undefined) delete this.context.variables['i']; else this.context.variables['i'] = oldI;
            }

            return results;
        }

        async applyListFormatter(items, formatter) {
            // Save state
            const oldValues = this.context.variables['values'];
            this.context.variables['values'] = items;

            try {
                return await this.evaluateWithSandbox(formatter);
            } finally {
                // Restore
                if (oldValues === undefined) delete this.context.variables['values'];
                else this.context.variables['values'] = oldValues;
            }
        }
    }

    // Export
    window.TextFlowExecutor = new CommandExecutor();
})();
