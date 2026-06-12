/**
 * TextFlow Command Parser v2.0
 * Parses dynamic commands with full syntax support:
 * {command: positionalArg; name=value; name2=value2}
 */

(function () {
    'use strict';

    class CommandParser {
        constructor() {
            // Command patterns for different command types
            this.commandPattern = /\{([a-zA-Z=]+)(?::([^}]*))?\}/g;
            this.formulaPattern = /\{=([^}]*)\}/g;
            this.allCommandsPattern = /\{[a-zA-Z=]+(?::[^}]*)?\}|\{=[^}]*\}/g;
            this.blockCommands = {
                'formtoggle': 'endformtoggle',
                'if': 'endif',
                'repeat': 'endrepeat',
                'link': 'endlink',
                'note': 'endnote',
                'run': 'endrun'
            };
        }

        /**
         * Check if text contains any commands
         */
        hasCommands(text) {
            this.allCommandsPattern.lastIndex = 0;
            return this.allCommandsPattern.test(text);
        }

        /**
         * Parse all commands from text
         * Returns array of command objects with positions
         */
        parseAll(text) {
            const commands = [];
            let match;

            // Reset regexes
            this.commandPattern.lastIndex = 0;

            // Pattern A: standard commands {command: args}
            while ((match = this.commandPattern.exec(text)) !== null) {
                const [fullMatch, command, argsString] = match;

                commands.push({
                    fullMatch,
                    command: command.toLowerCase(),
                    args: this.parseArgs(argsString || ''),
                    start: match.index,
                    end: match.index + fullMatch.length
                });
            }

            // Pattern B: formula commands {= expression}
            this.formulaPattern.lastIndex = 0;
            while ((match = this.formulaPattern.exec(text)) !== null) {
                const expression = (match[1] || '').trim();
                commands.push({
                    fullMatch: match[0],
                    command: '=',
                    args: this.parseArgs(expression),
                    start: match.index,
                    end: match.index + match[0].length
                });
            }

            // Sort by position to maintain left-to-right order
            commands.sort((a, b) => a.start - b.start);

            return commands;
        }

        /**
         * Parse command arguments
         * Supports: positional args, named args (name=value), comma-separated lists
         */
        parseArgs(argsString) {
            if (!argsString || !argsString.trim()) {
                return { positional: [], named: {} };
            }

            const result = {
                positional: [],
                named: {},
                raw: argsString.trim()
            };

            // Split by semicolon for main parts
            const parts = this.splitBySemicolon(argsString);

            for (const part of parts) {
                const trimmed = part.trim();
                if (!trimmed) continue;

                // Check if it's a named parameter (contains = but not inside quotes)
                const eqIndex = this.findUnquotedEquals(trimmed);

                if (eqIndex > 0) {
                    const name = trimmed.substring(0, eqIndex).trim().toLowerCase();
                    const value = trimmed.substring(eqIndex + 1).trim();
                    result.named[name] = this.unquote(value);
                } else {
                    // It's positional - could be comma-separated list
                    if (trimmed.includes(',')) {
                        const items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
                        result.positional.push(...items);
                    } else {
                        result.positional.push(trimmed);
                    }
                }
            }

            return result;
        }

        /**
         * Split by semicolon, respecting quotes and nested braces
         */
        splitBySemicolon(str) {
            const parts = [];
            let current = '';
            let depth = 0;
            let inQuote = false;
            let quoteChar = '';

            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                const prevChar = str[i - 1];

                // Handle quotes
                if ((char === '"' || char === "'") && prevChar !== '\\') {
                    if (!inQuote) {
                        inQuote = true;
                        quoteChar = char;
                    } else if (char === quoteChar) {
                        inQuote = false;
                    }
                }

                // Handle nested braces
                if (!inQuote) {
                    if (char === '{') depth++;
                    if (char === '}') depth--;
                }

                // Split on semicolon only at top level
                if (char === ';' && depth === 0 && !inQuote) {
                    parts.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }

            if (current) parts.push(current);
            return parts;
        }

        /**
         * Find first equals sign not inside quotes
         */
        findUnquotedEquals(str) {
            let inQuote = false;
            let quoteChar = '';

            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                const prevChar = str[i - 1];

                if ((char === '"' || char === "'") && prevChar !== '\\') {
                    if (!inQuote) {
                        inQuote = true;
                        quoteChar = char;
                    } else if (char === quoteChar) {
                        inQuote = false;
                    }
                }

                if (char === '=' && !inQuote) {
                    return i;
                }
            }

            return -1;
        }

        /**
         * Remove surrounding quotes from a string
         */
        unquote(str) {
            if ((str.startsWith('"') && str.endsWith('"')) ||
                (str.startsWith("'") && str.endsWith("'"))) {
                return str.slice(1, -1);
            }
            return str;
        }

        /**
         * Parse block commands (commands with end tags)
         */
        parseBlocks(text) {
            const blocks = [];

            for (const [startCmd, endCmd] of Object.entries(this.blockCommands)) {
                const startPattern = new RegExp(`\\{${startCmd}(?::([^}]*))?\\}`, 'gi');
                let match;

                while ((match = startPattern.exec(text)) !== null) {
                    const startPos = match.index;
                    const startTag = match[0];
                    const args = this.parseArgs(match[1] || '');

                    // Find matching end tag
                    const endPattern = new RegExp(`\\{${endCmd}\\}`, 'gi');
                    endPattern.lastIndex = startPos + startTag.length;

                    // Simple nested tag support would require counting, but for now we assume non-nested or basic matching
                    // Better approach: find next endTag that balances
                    // We'll stick to regex search for simplicity but it fails on nesting
                    const endMatch = endPattern.exec(text);

                    if (endMatch) {
                        // Handle IF-ELSEIF-ELSE structure
                        let elseContent = null;
                        const elseifs = [];
                        let contentEnd = endMatch.index;

                        if (startCmd === 'if') {
                            // Search for {else} and {elseif} inside the block
                            const innerText = text.substring(startPos + startTag.length, endMatch.index);

                            // Parse inner structure for branches
                            // This is a simple split logic
                            const branches = this.parseIfBranches(innerText);

                            // The first branch is the main content
                            // Subsequent are elseifs or else
                            if (branches.length > 0) {
                                contentEnd = startPos + startTag.length + branches[0].length;

                                for (let i = 1; i < branches.length; i++) {
                                    const branch = branches[i];
                                    if (branch.type === 'else') {
                                        elseContent = branch.content;
                                    } else if (branch.type === 'elseif') {
                                        elseifs.push({
                                            condition: branch.condition,
                                            content: branch.content
                                        });
                                    }
                                }
                            }
                        }

                        // For parsing purposes we just want the outer block range
                        // The executor will handle internal branching if we pass the whole structure or we structure it here
                        // Let's structure it here

                        blocks.push({
                            command: startCmd,
                            args,
                            content: text.substring(startPos + startTag.length, contentEnd),
                            elseContent,
                            elseifs,
                            fullMatch: text.substring(startPos, endMatch.index + endMatch[0].length),
                            start: startPos,
                            end: endMatch.index + endMatch[0].length
                        });
                    }
                }
            }

            // Sort by position
            blocks.sort((a, b) => a.start - b.start);
            return blocks;
        }

        /**
         * Helper: Parse branches in an if block
         */
        parseIfBranches(text) {
            const branches = [];
            const pattern = /\{(elseif|else)(?::([^}]*))?\}/gi;
            let lastIndex = 0;
            let match;

            // Warning: this simple regex split doesn't handle nested if/else well
            // A robust parser would need tokenization. 

            while ((match = pattern.exec(text)) !== null) {
                // Content before this tag is the previous branch
                branches.push({
                    type: branches.length === 0 ? 'main' : 'branch',
                    content: text.substring(lastIndex, match.index),
                    condition: null
                });

                // This tag starts a new branch
                const type = match[1].toLowerCase(); // elseif or else
                const args = match[2];

                if (type === 'elseif') {
                    // We'll update the content of this branch in the next iteration
                    // Store metadata for now
                    branches.push({
                        type: 'elseif',
                        condition: args,
                        content: '' // to be filled
                    });
                } else {
                    branches.push({
                        type: 'else',
                        content: ''
                    });
                }

                lastIndex = match.index + match[0].length;
            }

            // Add the final chunk
            if (branches.length === 0) {
                branches.push({ type: 'main', content: text, length: text.length });
            } else {
                // Update the last branch's content
                branches[branches.length - 1].content = text.substring(lastIndex);
            }

            return branches;
        }

        /**
         * Extract form fields from text
         */
        extractFormFields(text) {
            const fields = [];
            const formCommands = ['textfield', 'formparagraph', 'dropdown', 'formdate', 'formtoggle', 'button'];

            const commands = this.parseAll(text);
            const blocks = this.parseBlocks(text);

            for (const cmd of commands) {
                if (formCommands.includes(cmd.command)) {
                    const field = this.createFormField(cmd);
                    if (field) fields.push(field);
                }
            }

            // Also check block commands (formtoggle with endformtoggle)
            for (const block of blocks) {
                if (block.command === 'formtoggle') {
                    const field = this.createFormFieldFromBlock(block);
                    if (field) fields.push(field);
                }
            }

            return fields;
        }

        /**
         * Create form field definition from command
         */
        createFormField(cmd) {
            const { args } = cmd;
            const name = args.named.name || args.positional[0] || 'field';

            switch (cmd.command) {
                case 'textfield':
                    return {
                        type: 'text',
                        name,
                        label: args.named.name || name,
                        default: args.named.default || '',
                        cols: parseInt(args.named.cols) || 30,
                        placeholder: args.named.placeholder || '',
                        required: args.named.required === 'yes' || args.named.required === 'true',
                        required: args.named.required === 'yes' || args.named.required === 'true',
                        formatter: args.named.formatter,
                        trim: args.named.trim,
                        command: cmd
                    };

                case 'formparagraph':
                    return {
                        type: 'paragraph',
                        name,
                        label: args.named.name || name,
                        default: args.named.default || '',
                        rows: parseInt(args.named.rows) || 4,
                        cols: parseInt(args.named.cols) || 40,
                        placeholder: args.named.placeholder || '',
                        required: args.named.required === 'yes' || args.named.required === 'true',
                        required: args.named.required === 'yes' || args.named.required === 'true',
                        formatter: args.named.formatter,
                        trim: args.named.trim,
                        command: cmd
                    };

                case 'dropdown':
                    return {
                        type: 'menu',
                        name: args.named.name || 'choice',
                        label: args.named.name || 'Select',
                        options: args.positional,
                        default: args.named.default || args.positional[0] || '',
                        multiple: args.named.multiple === 'yes',
                        multiple: args.named.multiple === 'yes',
                        cols: parseInt(args.named.cols) || null,
                        formatter: args.named.formatter,
                        itemformatter: args.named.itemformatter,
                        trim: args.named.trim,
                        command: cmd
                    };

                case 'formdate':
                    return {
                        type: 'date',
                        name: args.named.name || 'date',
                        label: args.named.name || 'Date',
                        format: args.positional[0] || 'YYYY-MM-DD',
                        default: args.named.default || '',
                        start: args.named.start,
                        end: args.named.end,
                        cols: parseInt(args.named.cols) || 20,
                        command: cmd
                    };

                case 'formtoggle':
                    return {
                        type: 'toggle',
                        name: args.named.name || 'toggle',
                        label: args.named.name || 'Toggle',
                        default: args.named.default === 'yes' || args.named.default === 'true',
                        formatter: args.named.formatter,
                        hasBlock: false,
                        command: cmd
                    };

                case 'button':
                    return {
                        type: 'button',
                        label: args.named.label || args.named.name || 'Button',
                        code: args.raw || '',
                        command: cmd
                    };

                default:
                    return null;
            }
        }

        /**
         * Create form field from block command
         */
        createFormFieldFromBlock(block) {
            const { args } = block;

            return {
                type: 'toggle',
                name: args.named.name || 'toggle',
                label: args.named.name || 'Toggle',
                default: args.named.default === 'yes' || args.named.default === 'true',
                formatter: args.named.formatter,
                hasBlock: true,
                content: block.content,
                command: block
            };
        }
    }

    // Export
    window.TextFlowParser = new CommandParser();
})();
