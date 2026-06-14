export interface CommandArgs {
  positional: string[]
  named: Record<string, string>
  raw: string
}

export interface Command {
  fullMatch: string
  command: string
  args: CommandArgs
  start: number
  end: number
}

export interface BlockCommand {
  command: string
  args: CommandArgs
  content: string
  elseContent: string | null
  elseifs: { condition: string; content: string }[]
  fullMatch: string
  start: number
  end: number
}

export interface FormField {
  type: 'text' | 'paragraph' | 'menu' | 'date' | 'toggle' | 'button'
  name: string
  label: string
  default: string | boolean
  placeholder?: string
  required?: boolean
  cols?: number
  rows?: number
  options?: string[]
  multiple?: boolean
  format?: string
  start?: string
  end?: string
  formatter?: string
  itemformatter?: string
  hasBlock?: boolean
  content?: string
  command?: Command
}

const BLOCK_COMMANDS: Record<string, string> = {
  formtoggle: 'endformtoggle',
  if: 'endif',
  repeat: 'endrepeat',
  link: 'endlink',
  note: 'endnote',
  run: 'endrun',
}

const ALL_COMMANDS = new Set([
  'time', 'date', 'datetime', 'cursor', 'clipboard', 'set', 'import',
  'formtext', 'textfield', 'formparagraph', 'formmenu', 'dropdown',
  'formdate', 'formtoggle', 'formparagraph',
  'button', 'click', 'error', 'key', 'wait', 'site', 'snippet', 'user',
  'run', 'if', 'repeat', 'link', 'note',
])

export const CommandParser = {
  hasCommands(text: string): boolean {
    return /\{[a-zA-Z=]+(?::[^}]*)?\}|\{=[^}]*\}/.test(text)
  },

  parseAll(text: string): Command[] {
    const commands: Command[] = []
    const commandPattern = /\{([a-zA-Z=]+)(?::([^}]*))?\}/g

    let match: RegExpExecArray | null
    while ((match = commandPattern.exec(text)) !== null) {
      const [fullMatch, cmd, argsString] = match
      commands.push({
        fullMatch,
        command: cmd.toLowerCase() === 'formmenu' ? 'formmenu' : cmd.toLowerCase(),
        args: this.parseArgs(argsString || ''),
        start: match.index,
        end: match.index + fullMatch.length,
      })
    }

    const formulaPattern = /\{=([^}]*)\}/g
    while ((match = formulaPattern.exec(text)) !== null) {
      const expression = (match[1] || '').trim()
      commands.push({
        fullMatch: match[0],
        command: '=',
        args: this.parseArgs(expression),
        start: match.index,
        end: match.index + match[0].length,
      })
    }

    commands.sort((a, b) => a.start - b.start)
    return commands
  },

  parseArgs(argsString: string): CommandArgs {
    if (!argsString || !argsString.trim()) {
      return { positional: [], named: {}, raw: '' }
    }

    const result: CommandArgs = {
      positional: [],
      named: {},
      raw: argsString.trim(),
    }

    const parts = this.splitBySemicolon(argsString)
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue

      // Split by commas at depth 0 to handle multiple name=value pairs separated by commas
      const commaParts = this.splitByComma(trimmed)
      for (const sub of commaParts) {
        const subTrimmed = sub.trim()
        if (!subTrimmed) continue
        const eqIndex = this.findUnquotedEquals(subTrimmed)
        if (eqIndex > 0) {
          const name = subTrimmed.substring(0, eqIndex).trim().toLowerCase()
          const value = subTrimmed.substring(eqIndex + 1).trim()
          result.named[name] = this.unquote(value)
        } else {
          result.positional.push(this.unquote(subTrimmed))
        }
      }
    }

    return result
  },

  splitBySemicolon(str: string): string[] {
    const parts: string[] = []
    let current = ''
    let depth = 0
    let inQuote = false
    let quoteChar = ''

    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      if ((char === '"' || char === "'") && str[i - 1] !== '\\') {
        if (!inQuote) { inQuote = true; quoteChar = char }
        else if (char === quoteChar) { inQuote = false }
      }
      if (!inQuote) {
        if (char === '{') depth++
        if (char === '}') depth--
      }
      if (char === ';' && depth === 0 && !inQuote) {
        parts.push(current)
        current = ''
      } else {
        current += char
      }
    }
    if (current) parts.push(current)
    return parts
  },

  splitByComma(str: string): string[] {
    const parts: string[] = []
    let current = ''
    let depth = 0
    let inQuote = false
    let quoteChar = ''

    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      if ((char === '"' || char === "'") && str[i - 1] !== '\\') {
        if (!inQuote) { inQuote = true; quoteChar = char }
        else if (char === quoteChar) { inQuote = false }
      }
      if (!inQuote) {
        if (char === '(' || char === '{') depth++
        if (char === ')' || char === '}') depth--
      }
      if (char === ',' && depth === 0 && !inQuote) {
        const trimmed = current.trim()
        if (trimmed) parts.push(trimmed)
        current = ''
      } else {
        current += char
      }
    }
    const trimmed = current.trim()
    if (trimmed) parts.push(trimmed)
    return parts
  },

  findUnquotedEquals(str: string): number {
    let inQuote = false
    let quoteChar = ''
    for (let i = 0; i < str.length; i++) {
      const char = str[i]
      if ((char === '"' || char === "'") && str[i - 1] !== '\\') {
        if (!inQuote) { inQuote = true; quoteChar = char }
        else if (char === quoteChar) { inQuote = false }
      }
      if (char === '=' && !inQuote) return i
    }
    return -1
  },

  unquote(str: string): string {
    if ((str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1)
    }
    return str
  },

  findBracedTagEnd(text: string, startPos: number): number {
    // From startPos, scan past {cmd:...} or {cmd} tracking brace depth
    // Returns position after the closing }
    let i = startPos
    if (i >= text.length || text[i] !== '{') return startPos
    i++ // skip {
    while (i < text.length && text[i] !== ':' && text[i] !== '}') i++
    if (i >= text.length) return startPos
    if (text[i] === '}') return i + 1 // {cmd}
    // text[i] === ':'
    let depth = 1
    i++ // skip :
    while (i < text.length) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') {
        depth--
        if (depth === 0) return i + 1
      }
      i++
    }
    return startPos
  },

  findMatchingEndTag(text: string, startCmd: string, endCmd: string, startPos: number): number | null {
    let depth = 1
    let pos = startPos

    // Advance past the start tag
    pos = this.findBracedTagEnd(text, pos)
    if (pos === startPos) return null

    while (pos < text.length) {
      if (text[pos] !== '{') { pos++; continue }

      const maxLen = Math.max(startCmd.length, endCmd.length)
      const afterBrace = text.substring(pos + 1, pos + 1 + maxLen)

      // Check if this is a start cmd tag
      if (afterBrace.startsWith(startCmd) && (text[pos + 1 + startCmd.length] === ':' || text[pos + 1 + startCmd.length] === '}')) {
        depth++
        pos = this.findBracedTagEnd(text, pos)
        if (pos === startPos) return null
        continue
      }

      // Check if this is an end cmd tag
      if (afterBrace.startsWith(endCmd) && text[pos + 1 + endCmd.length] === '}') {
        depth--
        if (depth === 0) return pos
        pos += 1 + endCmd.length + 1 // skip {endCmd}
        continue
      }

      pos++
    }

    return null
  },

  parseBlocks(text: string): BlockCommand[] {
    const blocks: BlockCommand[] = []

    for (const [startCmd, endCmd] of Object.entries(BLOCK_COMMANDS)) {
      let pos = 0
      while (pos < text.length) {
        const braceIdx = text.indexOf('{', pos)
        if (braceIdx === -1) break

        const afterBrace = text.substring(braceIdx + 1, braceIdx + 1 + startCmd.length)
        if (afterBrace !== startCmd) { pos = braceIdx + 1; continue }
        const nextChar = text[braceIdx + 1 + startCmd.length]
        if (nextChar !== ':' && nextChar !== '}') { pos = braceIdx + 1; continue }

        const startPos = braceIdx
        const tagEnd = this.findBracedTagEnd(text, startPos)
        const startTag = text.substring(startPos, tagEnd)
        const argsRaw = nextChar === ':' ? text.substring(startPos + startCmd.length + 2, tagEnd - 1) : ''
        const args = this.parseArgs(argsRaw)

        const endPos = this.findMatchingEndTag(text, startCmd, endCmd, startPos)

        if (endPos !== null) {
          let elseContent: string | null = null
          const elseifs: { condition: string; content: string }[] = []
          let contentEnd = endPos

          if (startCmd === 'if') {
            const innerText = text.substring(startPos + startTag.length, endPos)
            const branches = this.parseIfBranches(innerText)
            if (branches.length > 0) {
              contentEnd = startPos + startTag.length + branches[0].length
              for (let i = 1; i < branches.length; i++) {
                const branch = branches[i]
                if (branch.type === 'else') {
                  elseContent = branch.content
                } else if (branch.type === 'elseif') {
                  elseifs.push({ condition: branch.condition, content: branch.content })
                }
              }
            }
          }

          blocks.push({
            command: startCmd,
            args,
            content: text.substring(startPos + startTag.length, contentEnd),
            elseContent,
            elseifs,
            fullMatch: text.substring(startPos, endPos + endCmd.length + 2),
            start: startPos,
            end: endPos + endCmd.length + 2,
          })
          pos = endPos + endCmd.length + 2
        } else {
          pos = tagEnd
        }
        continue
      }
    }

    blocks.sort((a, b) => a.start - b.start)
    return blocks
  },

  parseIfBranches(text: string): { type: string; content: string; length: number; condition?: string }[] {
    const branches: { type: string; content: string; length: number; condition?: string }[] = []
    const pattern = /\{(elseif|else)(?::([^}]*))?\}/gi
    let lastIndex = 0
    let branchMatch: RegExpExecArray | null

    while ((branchMatch = pattern.exec(text)) !== null) {
      const content = text.substring(lastIndex, branchMatch.index)

      if (branches.length === 0) {
        branches.push({ type: 'main', content, length: content.length })
      } else {
        // Assign content to the previous conditional entry
        const prev = branches[branches.length - 1]
        if (prev.type === 'elseif' || prev.type === 'else') {
          prev.content = content
          prev.length = content.length
        }
      }

      const type = branchMatch[1].toLowerCase()
      const cond = branchMatch[2]

      if (type === 'elseif') {
        branches.push({ type: 'elseif', condition: cond, content: '', length: 0 })
      } else {
        branches.push({ type: 'else', content: '', length: 0 })
      }

      lastIndex = branchMatch.index + branchMatch[0].length
    }

    if (branches.length === 0) {
      branches.push({ type: 'main', content: text, length: text.length })
    } else {
      const tail = text.substring(lastIndex)
      const last = branches[branches.length - 1]
      if (last.type === 'elseif' || last.type === 'else') {
        last.content = tail
        last.length = tail.length
      } else {
        // If only main branch exists (no elseif/else), set tail as main
        last.content = tail
        last.length = tail.length
      }
    }

    return branches
  },

  extractFormFields(text: string): FormField[] {
    const fields: FormField[] = []
    const formCommands = ['formtext', 'formparagraph', 'formmenu', 'formdate', 'formtoggle', 'button']

    const commands = this.parseAll(text)
    const blocks = this.parseBlocks(text)

    for (const cmd of commands) {
      if (formCommands.includes(cmd.command)) {
        const field = this.createFormField(cmd)
        if (field) fields.push(field)
      }
    }

    for (const block of blocks) {
      if (block.command === 'formtoggle') {
        fields.push({
          type: 'toggle',
          name: block.args.named.name || 'toggle',
          label: block.args.named.name || 'Toggle',
          default: block.args.named.default === 'yes' || block.args.named.default === 'true',
          hasBlock: true,
          content: block.content,
        })
      }
    }

    return fields
  },

  createFormField(cmd: Command): FormField | null {
    const { args } = cmd
    const name = args.named.name || args.positional[0] || 'field'

    switch (cmd.command) {
      case 'formtext':
      case 'textfield':
        return {
          type: 'text',
          name,
          label: args.named.name || name,
          default: args.named.default || '',
          placeholder: args.named.placeholder || '',
          required: args.named.required === 'yes' || args.named.required === 'true',
          cols: parseInt(args.named.cols) || undefined,
          formatter: args.named.formatter,
        }

      case 'formparagraph':
        return {
          type: 'paragraph',
          name,
          label: args.named.name || name,
          default: args.named.default || '',
          placeholder: args.named.placeholder || '',
          required: args.named.required === 'yes' || args.named.required === 'true',
          rows: parseInt(args.named.rows) || 4,
          cols: parseInt(args.named.cols) || undefined,
          formatter: args.named.formatter,
        }

      case 'formmenu':
      case 'dropdown':
        return {
          type: 'menu',
          name: args.named.name || 'choice',
          label: args.named.name || 'Select',
          options: args.positional,
          default: args.named.default || args.positional[0] || '',
          multiple: args.named.multiple === 'yes',
          cols: parseInt(args.named.cols) || undefined,
          formatter: args.named.formatter,
          itemformatter: args.named.itemformatter,
        }

      case 'formdate':
        return {
          type: 'date',
          name: args.named.name || 'date',
          label: args.named.name || 'Date',
          format: args.positional[0] || 'YYYY-MM-DD',
          default: args.named.default || '',
          start: args.named.start,
          end: args.named.end,
        }

      case 'button':
        return {
          type: 'button',
          name: args.named.name || name,
          label: args.named.name || 'Button',
          default: args.named.default || args.named.value || '',
          content: args.raw || args.named.label || 'Click',
          formatter: args.named.action || args.named.onclick,
        }

      default:
        return null
    }
  },
}

export default CommandParser
