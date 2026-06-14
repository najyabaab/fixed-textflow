import CommandParser from './commandParser'
import KeySimulator from './keySimulator'
import type { Command, CommandArgs, BlockCommand, FormField } from './commandParser'

export interface ExecutorContext {
  formValues: Record<string, string | boolean | string[]>
  variables: Record<string, unknown>
  snippets: Record<string, { content: string; shortcut: string; name?: string }>
  currentSnippetShortcut?: string
  clipboardText?: string
  siteData: Record<string, string>
  userData: Record<string, string>
}

export interface ExecutorResult {
  content: string
  requiresForm: boolean
  formFields: FormField[]
  cursorPosition: number
}

const CURSOR_MARKER = '\u200B\u200C\u200D'

const SANDBOX_FUNCTIONS: Record<string, (...args: unknown[]) => unknown> = {
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sqrt: Math.sqrt,
  abs: Math.abs,
  min: (...args: number[]) => Math.min(...args),
  max: (...args: number[]) => Math.max(...args),
  random: Math.random,
  upper: (s: unknown) => String(s).toUpperCase(),
  lower: (s: unknown) => String(s).toLowerCase(),
  trim: (s: unknown) => String(s).trim(),
  len: (s: unknown) => (Array.isArray(s) || typeof s === 'string') ? s.length : 0,
  left: (s: unknown, n: number) => String(s).substring(0, n),
  right: (s: unknown, n: number) => String(s).slice(-n),
  mid: (s: unknown, start: number, len: number) => String(s).substring(start, start + len),
  replace: (s: unknown, find: string, repl: string) => String(s).replace(new RegExp(find, 'g'), repl),
  contains: (s: unknown, find: string) => String(s).includes(find),
  count: (arr: unknown) => Array.isArray(arr) ? arr.length : 0,
  sum: (arr: unknown[]) => Array.isArray(arr) ? arr.reduce((a, b) => a + Number(b), 0) : 0,
  join: (arr: unknown[], sep: string) => Array.isArray(arr) ? arr.join(sep) : '',
  split: (s: unknown, sep: string) => String(s).split(sep),
  map: (arr: unknown[], fn: (x: unknown) => unknown) => Array.isArray(arr) ? arr.map(fn) : [],
  filter: (arr: unknown[], fn: (x: unknown) => boolean) => Array.isArray(arr) ? arr.filter(fn) : [],
  sort: (arr: unknown[]) => Array.isArray(arr) ? [...arr].sort() : arr,
  first: (arr: unknown[]) => Array.isArray(arr) ? arr[0] : arr,
  last: (arr: unknown[]) => Array.isArray(arr) ? arr[arr.length - 1] : arr,
  testregex: (text: string, pattern: string) => new RegExp(pattern).test(text),
  extractregex: (text: string, pattern: string) => {
    const m = String(text).match(new RegExp(pattern))
    if (!m) throw new Error('No match found')
    return m[1] !== undefined ? m[1] : m[0]
  },
  replaceregex: (text: string, pattern: string, repl: string) => String(text).replace(new RegExp(pattern, 'g'), repl),
  year: (d?: string) => (d ? new Date(d) : new Date()).getFullYear(),
  month: (d?: string) => (d ? new Date(d) : new Date()).getMonth() + 1,
  day: (d?: string) => (d ? new Date(d) : new Date()).getDate(),
  weekday: (d?: string) => (d ? new Date(d) : new Date()).toLocaleString('en', { weekday: 'long' }),
  today: () => new Date().toISOString().split('T')[0],
  now: () => new Date().toISOString(),
  json: (obj: unknown) => JSON.stringify(obj),
  fromjson: (str: string) => { try { return JSON.parse(str) } catch { return null } },
  if: (cond: unknown, a: unknown, b: unknown) => cond ? a : b,
}

export const CommandExecutor = {
  CURSOR_MARKER,

  async execute(
    text: string,
    context: ExecutorContext,
    options: { preview?: boolean } = {}
  ): Promise<ExecutorResult> {
    const formFields = CommandParser.extractFormFields(text)
    const hasFormValues = Object.keys(context.formValues).length > 0

    if (formFields.length > 0 && !hasFormValues) {
      return { content: text, requiresForm: true, formFields, cursorPosition: -1 }
    }

    this.validateSingletonCursor(text)

    if (!context.clipboardText) {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          const response = await chrome.runtime.sendMessage({ type: 'GET_CLIPBOARD' })
          context.clipboardText = (response as { text?: string })?.text || ''
        }
      } catch {
        context.clipboardText = ''
      }
      if (!context.clipboardText && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          context.clipboardText = await navigator.clipboard.readText()
        } catch {
          // silent
        }
      }
    }

    // Pre-process set commands so variables are available during block evaluation
    const setPreCommands = CommandParser.parseAll(text)
    for (const cmd of setPreCommands) {
      if (cmd.command === 'set') {
        await this.executeCommand(cmd, context, options)
      }
    }

    let result = await this.processBlocks(text, context, options)
    result = await this.processInlineCommands(result, context, options)

    const cursorIndex = result.indexOf(CURSOR_MARKER)
    const cursorPosition = cursorIndex >= 0 ? cursorIndex : -1
    result = result.replace(CURSOR_MARKER, '')

    return { content: result, requiresForm: false, formFields: [], cursorPosition }
  },

  validateSingletonCursor(text: string): void {
    const pattern = /\{cursor(?::[^}]*)?\}/gi
    const matches = text.match(pattern)
    if (matches && matches.length > 1) {
      throw new Error(
        `Only one {cursor} command is allowed per snippet. Found ${matches.length} cursor commands.`
      )
    }
  },

  async processBlocks(text: string, context: ExecutorContext, options: { preview?: boolean }): Promise<string> {
    let result = text
    const blocks = CommandParser.parseBlocks(result)
    blocks.sort((a, b) => b.start - a.start)

    for (const block of blocks) {
      const replacement = await this.executeBlock(block, context, options)

      let start = block.start
      let end = block.end

      if (block.args.named.trim) {
        const trim = block.args.named.trim
        if (trim === 'yes' || trim === 'true' || trim === 'left') {
          while (start > 0 && /\s/.test(result[start - 1])) start--
        }
        if (trim === 'yes' || trim === 'true' || trim === 'right') {
          while (end < result.length && /\s/.test(result[end])) end++
        }
      }

      result = result.substring(0, start) + replacement + result.substring(end)
    }

    return result
  },

  async executeBlock(block: BlockCommand, context: ExecutorContext, options: { preview?: boolean }): Promise<string> {
    switch (block.command) {
      case 'if':
        return this.executeIfBlock(block, context, options)
      case 'repeat':
        return this.executeRepeatBlock(block, context, options)
      case 'formtoggle':
        return this.executeFormToggleBlock(block, context)
      case 'run':
        return await this.executeRunBlock(block, context, options)
      case 'note': {
        const insert = block.args.named.insert === 'yes'
        if (insert) {
          return `📝 ${block.content}`
        }
        return ''
      }
      case 'link': {
        const url = block.args.named.url || block.args.named.href || ''
        if (url) {
          return `<a href="${url.replace(/"/g, '&quot;')}">${block.content}</a>`
        }
        return block.content
      }
      default:
        return block.content
    }
  },

  async executeIfBlock(block: BlockCommand, context: ExecutorContext, options: { preview?: boolean }): Promise<string> {
    const condition = block.args.positional[0] || block.args.raw
    const isTrue = await this.evaluateCondition(condition, context)

    if (isTrue) {
      let content = await this.processBlocks(block.content, context, options)
      return await this.processInlineCommands(content, context, options)
    }

    if (block.elseifs && block.elseifs.length > 0) {
      for (const elseif of block.elseifs) {
        const elseifTrue = await this.evaluateCondition(elseif.condition, context)
        if (elseifTrue) {
          let content = await this.processBlocks(elseif.content, context, options)
          return await this.processInlineCommands(content, context, options)
        }
      }
    }

    const elseContent = block.elseContent
    if (elseContent) {
      let content = await this.processBlocks(elseContent, context, options)
      return await this.processInlineCommands(content, context, options)
    }
    return ''
  },

  async executeRepeatBlock(block: BlockCommand, context: ExecutorContext, options: { preview?: boolean }): Promise<string> {
    const arg = block.args.positional[0] || block.args.raw
    const forMatch = arg.match(/for\s+(\w+)\s+in\s+(.+)/i)

    if (forMatch) {
      const itemName = forMatch[1]
      const listExpr = forMatch[2]
      const list = await this.evaluateWithSandbox(listExpr, context)

      if (Array.isArray(list)) {
        let result = ''
        const baseContent = block.content
        for (let idx = 0; idx < list.length; idx++) {
          context.variables[itemName] = list[idx]
          context.variables.i = idx
          context.variables.index = idx + 1
          let content = await this.processBlocks(baseContent, context, options)
          result += await this.processInlineCommands(content, context, options)
        }
        return result
      }
      return ''
    }

    let count = parseInt(arg)
    if (isNaN(count)) {
      const val = await this.evaluateWithSandbox(arg, context)
      count = parseInt(String(val)) || 0
    }

    if (count > 0) {
      if (count > 100) count = 100
      let result = ''
      for (let n = 0; n < count; n++) {
        context.variables.i = n
        context.variables.index = n + 1
        let content = block.content
        content = content.replace(/@index\b/g, String(n + 1))
        content = content.replace(/@i\b/g, String(n))
        context.variables['@index'] = n + 1
        context.variables['@i'] = n
        content = await this.processBlocks(content, context, options)
        result += await this.processInlineCommands(content, context, options)
      }
      return result
    }

    return ''
  },

  async executeRunBlock(block: BlockCommand, context: ExecutorContext, options: { preview?: boolean }): Promise<string> {
    const code = block.args.positional[0] || block.args.raw || block.content
    if (!code) return ''

    const resolvedCode = await this.processInlineCommands(code, context, options)

    const lines = resolvedCode.split(/[;\n]/).map(s => s.trim()).filter(Boolean)
    for (const line of lines) {
      const assignMatch = line.match(/^\s*(\w+)\s*=\s*(.+)/)
      if (assignMatch) {
        const [, name, expr] = assignMatch
        const value = await this.evaluateWithSandbox(expr.trim(), context)
        context.variables[name] = value
      } else {
        await this.evaluateWithSandbox(line, context)
      }
    }

    return ''
  },

  executeFormToggleBlock(block: BlockCommand, context: ExecutorContext): string {
    const name = block.args.named.name || 'toggle'
    const value = context.formValues[name]
    if (value === true || value === 'yes' || value === 'true') {
      return block.content
    }
    return ''
  },

  async processInlineCommands(text: string, context: ExecutorContext, options: { preview?: boolean }): Promise<string> {
    let result = text
    const commands = CommandParser.parseAll(result)

    // First pass: execute set commands silently to populate variables first
    for (const cmd of commands) {
      if (cmd.command === 'set') {
        await this.executeCommand(cmd, context, options)
      }
    }

    // Second pass: execute ALL commands in descending order (RTL preserves positions)
    const allCommands = [...commands].sort((a, b) => b.start - a.start)

    for (const cmd of allCommands) {
      if (cmd.command.startsWith('end')) continue
      if (cmd.command === 'else' || cmd.command === 'elseif') continue

      const replacement = await this.executeCommand(cmd, context, options)

      let start = cmd.start
      let end = cmd.end

      if (cmd.args.named.trim) {
        const trim = cmd.args.named.trim
        if (trim === 'yes' || trim === 'true' || trim === 'left') {
          while (start > 0 && /\s/.test(result[start - 1])) start--
        }
        if (trim === 'yes' || trim === 'true' || trim === 'right') {
          while (end < result.length && /\s/.test(result[end])) end++
        }
      }

      result = result.substring(0, start) + replacement + result.substring(end)
    }

    return result
  },

  async executeCommand(cmd: Command, context: ExecutorContext, options: { preview?: boolean }): Promise<string> {
    const { command, args } = cmd

    switch (command) {
      case 'time':
      case 'datetime':
      case 'date':
        return this.handleTime(args, context)
      case 'cursor':
        return CURSOR_MARKER
      case 'clipboard':
        return context.clipboardText || ''
      case 'formtext':
      case 'textfield':
        return this.handleFormText(args, context)
      case 'formparagraph':
        return this.handleFormParagraph(args, context)
      case 'formmenu':
      case 'dropdown':
        return this.handleFormMenu(args, context)
      case 'formdate':
        return this.handleFormDate(args, context)
      case 'formtoggle':
        return this.handleFormToggleInline(args, context)
      case '=': {
        const expr = args.positional.join(' ') || args.named.formula || args.raw
        const result = await this.evaluateWithSandbox(expr, context)
        if (args.named.silent === 'yes' || args.named.silent === 'true') return ''
        if (args.named.format) {
          const num = Number(result)
          if (!isNaN(num)) {
            try {
              return new Intl.NumberFormat('en', {}).format(num)
            } catch {
              return String(num)
            }
          }
        }
        return String(result)
      }
      case 'set': {
        const raw = args.raw
        const eqIdx = raw.indexOf('=')
        if (eqIdx > 0) {
          const name = raw.substring(0, eqIdx).trim()
          const expr = raw.substring(eqIdx + 1).trim()
          context.variables[name] = await this.evaluateWithSandbox(expr, context)
        }
        return ''
      }
      case 'import':
        return await this.handleImport(args, context, options)
      case 'button':
        return ''
      case 'click':
        return await this.handleClick(args, options)
      case 'error':
        return this.handleError(args)
      case 'key':
        return await this.handleKey(args, options)
      case 'wait':
        return await this.handleWait(args)
      case 'site':
        return this.handleSite(args, context)
      case 'snippet':
        return this.handleSnippet(args, context)
      case 'user':
        return this.handleUser(args, context)
      default: {
        if (args.raw?.trim().startsWith('=')) {
          const varName = command
          const expr = args.raw.trim().substring(1)
          context.variables[varName] = await this.evaluateWithSandbox(expr, context)
          return ''
        }
        return cmd.fullMatch
      }
    }
  },

  handleTime(args: CommandArgs, _context: ExecutorContext): string {
    const format = args.raw || args.positional[0] || 'YYYY-MM-DD HH:mm:ss'
    const shift = args.named.shift
    const atDate = args.named.at
    const locale = args.named.locale || 'en'

    let date = atDate ? new Date(atDate) : new Date()
    if (shift) {
      date = this.applyDateShift(date, shift)
    }

    return this.formatDate(date, format, locale)
  },

  applyDateShift(date: Date, shift: string): Date {
    const result = new Date(date)
    const match = shift.match(/^([<>]?)([+-]?)(\d*)([DWMYHms]|MON|TUE|WED|THU|FRI|SAT|SUN)?$/i)
    if (!match) return result

    const [, direction, sign, amount, unit] = match
    const num = parseInt(amount) || 1
    const multiplier = sign === '-' ? -1 : 1

    if (direction === '>' || direction === '<') {
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
      const targetDay = days.indexOf(unit?.toUpperCase())
      if (targetDay >= 0) {
        const currentDay = result.getDay()
        let diff = targetDay - currentDay
        if (direction === '>') { if (diff <= 0) diff += 7 }
        else { if (diff >= 0) diff -= 7 }
        result.setDate(result.getDate() + diff)
        return result
      }
    }

    switch (unit?.toUpperCase()) {
      case 'D': result.setDate(result.getDate() + num * multiplier); break
      case 'W': result.setDate(result.getDate() + num * 7 * multiplier); break
      case 'M': result.setMonth(result.getMonth() + num * multiplier); break
      case 'Y': result.setFullYear(result.getFullYear() + num * multiplier); break
      case 'H': result.setHours(result.getHours() + num * multiplier); break
      case 'S': result.setSeconds(result.getSeconds() + num * multiplier); break
      case 'MIN': result.setMinutes(result.getMinutes() + num * multiplier); break
      default:
        if (unit === 'm') result.setMinutes(result.getMinutes() + num * multiplier)
        break
    }

    return result
  },

  formatDate(date: Date, format: string, _locale = 'en'): string {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      date = new Date()
    }

    const tokens: Record<string, () => string> = {
      'YYYY': () => String(date.getFullYear()),
      'YY': () => String(date.getFullYear()).slice(-2),
      'MMMM': () => date.toLocaleString('en', { month: 'long' }),
      'MMM': () => date.toLocaleString('en', { month: 'short' }),
      'MM': () => String(date.getMonth() + 1).padStart(2, '0'),
      'M': () => String(date.getMonth() + 1),
      'DDDD': () => date.toLocaleString('en', { weekday: 'long' }),
      'DDD': () => date.toLocaleString('en', { weekday: 'short' }),
      'dddd': () => date.toLocaleString('en', { weekday: 'long' }),
      'ddd': () => date.toLocaleString('en', { weekday: 'short' }),
      'DD': () => String(date.getDate()).padStart(2, '0'),
      'Do': () => this.getOrdinal(date.getDate()),
      'D': () => String(date.getDate()),
      'HH': () => String(date.getHours()).padStart(2, '0'),
      'H': () => String(date.getHours()),
      'hh': () => String(date.getHours() % 12 || 12).padStart(2, '0'),
      'h': () => String(date.getHours() % 12 || 12),
      'mm': () => String(date.getMinutes()).padStart(2, '0'),
      'm': () => String(date.getMinutes()),
      'ss': () => String(date.getSeconds()).padStart(2, '0'),
      's': () => String(date.getSeconds()),
      'A': () => date.getHours() >= 12 ? 'PM' : 'AM',
      'a': () => date.getHours() >= 12 ? 'pm' : 'am',
      'X': () => String(Math.floor(date.getTime() / 1000)),
      'x': () => String(date.getTime()),
    }

    const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length)
    let result = ''
    let i = 0
    while (i < format.length) {
      let matched = false
      for (const token of sortedTokens) {
        if (format.substring(i, i + token.length) === token) {
          result += tokens[token]()
          i += token.length
          matched = true
          break
        }
      }
      if (!matched) {
        result += format[i]
        i++
      }
    }

    return result
  },

  getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  },

  handleFormText(args: CommandArgs, context: ExecutorContext): string {
    const name = args.named.name || args.positional[0] || 'field'
    const value = context.formValues[name]
    const isRequired = args.named.required === 'yes' || args.named.required === 'true'
    if (isRequired && (value === undefined || value === null || String(value).trim() === '')) {
      throw new Error(`Field '${name}' is required`)
    }
    if (value !== undefined) {
      return this.applyFormatter(String(value), args.named.formatter)
    }
    return args.named.default || ''
  },

  handleFormParagraph(args: CommandArgs, context: ExecutorContext): string {
    const name = args.named.name || args.positional[0] || 'field'
    const value = context.formValues[name]
    const isRequired = args.named.required === 'yes' || args.named.required === 'true'
    if (isRequired && (value === undefined || value === null || String(value).trim() === '')) {
      throw new Error(`Field '${name}' is required`)
    }
    if (value !== undefined) {
      return this.applyFormatter(String(value), args.named.formatter)
    }
    return args.named.default || ''
  },

  handleFormMenu(args: CommandArgs, context: ExecutorContext): string {
    const name = args.named.name || 'choice'
    const value = context.formValues[name]
    const itemFormatter = args.named.itemformatter

    if (value !== undefined) {
      if (Array.isArray(value)) {
        let processed = value.map(String)
        if (itemFormatter) {
          processed = processed.map(v => this.applyFormatter(v, itemFormatter))
        }
        return processed.join(', ')
      }
      let processed = String(value)
      if (itemFormatter) {
        processed = this.applyFormatter(processed, itemFormatter)
      }
      return this.applyFormatter(processed, args.named.formatter)
    }
    return args.named.default || args.positional[0] || ''
  },

  handleFormDate(args: CommandArgs, context: ExecutorContext): string {
    const name = args.named.name || 'date'
    const format = args.positional[0] || 'YYYY-MM-DD'
    const value = context.formValues[name]

    if (value) {
      const date = new Date(String(value))
      return this.formatDate(date, format)
    }

    const defaultVal = args.named.default
    let dateToFormat = new Date()

    if (defaultVal) {
      if (/^[<>]?[+-]?\d*[A-Za-z]+$/.test(defaultVal)) {
        dateToFormat = this.applyDateShift(new Date(), defaultVal)
      } else {
        dateToFormat = new Date(defaultVal)
      }
    }

    return this.formatDate(dateToFormat, format)
  },

  handleFormToggleInline(args: CommandArgs, context: ExecutorContext): string {
    const name = args.named.name || 'toggle'
    const value = context.formValues[name]
    const isOn = value === true || value === 'yes' || value === 'true'
    return isOn ? 'yes' : 'no'
  },

  async handleImport(args: CommandArgs, context: ExecutorContext, options: { preview?: boolean }): Promise<string> {
    const shortcut = args.positional[0] || args.raw
    const snippet = context.snippets[shortcut]
    if (snippet?.content) {
      const importChain = context.variables.__importChain as Set<string> | undefined
      if (importChain?.has(shortcut)) {
        console.warn(`[Executor] Circular import detected: ${shortcut}`)
        return `{import:${shortcut}}`
      }
      const chain = importChain || new Set<string>()
      chain.add(shortcut)
      context.variables.__importChain = chain
      const result = await this.execute(snippet.content, context, options)
      chain.delete(shortcut)
      if (chain.size === 0) delete context.variables.__importChain
      return result.content
    }
    return ''
  },

  applyFormatter(value: string, formatter?: string): string {
    if (!formatter) return value

    switch (formatter.toLowerCase()) {
      case 'upper': return value.toUpperCase()
      case 'lower': return value.toLowerCase()
      case 'title': return value.replace(/\b\w/g, c => c.toUpperCase())
      case 'trim': return value.trim()
    }

    return value
  },

  async handleClick(args: CommandArgs, options: { preview?: boolean }): Promise<string> {
    if (options.preview) return ''
    const selector = args.named.selector
    const xpath = args.named.xpath
    const delay = Math.min(parseInt(args.named.maxdelay) || 10, 60)

    if (!selector && !xpath) return ''

    try {
      let element: Element | null = null

      if (xpath) {
        const result = document.evaluate(
          xpath, document, null,
          XPathResult.FIRST_ORDERED_NODE_TYPE, null
        )
        element = result.singleNodeValue as Element | null
      } else if (selector) {
        element = document.querySelector(selector)
      }

      if (!element) {
        if (delay > 0) {
          const start = Date.now()
          while (Date.now() - start < delay * 1000) {
            await new Promise(r => setTimeout(r, 100))
            if (xpath) {
              const result = document.evaluate(
                xpath, document, null,
                XPathResult.FIRST_ORDERED_NODE_TYPE, null
              )
              element = result.singleNodeValue as Element | null
            } else {
              element = document.querySelector(selector)
            }
            if (element) break
          }
        }
      }

      if (element) {
        element.dispatchEvent(new CustomEvent('TB_customClick', {
          bubbles: true, cancelable: false, composed: true
        }))
        ;(element as HTMLElement).click?.()
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      }
    } catch {
      // silent
    }
    return ''
  },

  handleError(args: CommandArgs): string {
    const message = args.positional[0] || args.raw
    throw new Error(message || 'Error')
  },

  async handleKey(args: CommandArgs, options: { preview?: boolean }): Promise<string> {
    if (options.preview) return ''
    const keySpec = (args.named.win || args.named.mac || args.named.linux || args.named.cros || args.positional[0] || args.raw).toLowerCase()
    if (!keySpec) return ''

    const parts = keySpec.split('+')
    const keyName = parts.pop() || ''

    const keyMap: Record<string, string> = {
      'enter': 'Enter', 'return': 'Enter',
      'tab': 'Tab', 'space': ' ',
      'backspace': 'Backspace', 'delete': 'Delete',
      'escape': 'Escape', 'esc': 'Escape',
      'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight',
      'home': 'Home', 'end': 'End', 'pageup': 'PageUp', 'pagedown': 'PageDown',
      'insert': 'Insert',
    }

    const key = keyMap[keyName] || (keyName.length === 1 ? keyName : '')
    if (!key) return ''

    const el = document.activeElement
    if (!el) return ''

    try {
      await KeySimulator.dispatchKey(el, {
        key,
        ctrl: parts.includes('ctrl') || parts.includes('control'),
        alt: parts.includes('alt') || parts.includes('option'),
        shift: parts.includes('shift'),
        meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
      })
    } catch {
      // silent
    }
    return ''
  },

  async handleWait(args: CommandArgs): Promise<string> {
    const raw = args.named.delay || args.positional[0] || '1s'
    const match = raw.match(/^(\d+(?:\.\d+)?)\s*(s|sec|seconds|m|min|minutes)?$/i)
    let seconds = 1
    if (match) {
      const num = parseFloat(match[1])
      const unit = (match[2] || 's').toLowerCase()
      seconds = unit.startsWith('m') ? num * 60 : num
    }
    if (seconds > 0) {
      await new Promise(resolve => setTimeout(resolve, seconds * 1000))
    }
    return ''
  },

  handleSite(args: CommandArgs, context: ExecutorContext): string {
    const dataType = (args.positional[0] || args.raw || '').toLowerCase()
    if (!dataType) return ''

    const selector = args.named.selector || args.named.css
    const xpath = args.named.xpath

    if (selector) {
      const el = document.querySelector(selector)
      return el?.textContent?.trim() || el?.getAttribute('value') || ''
    }

    if (xpath) {
      const result = document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null)
      return result.stringValue || ''
    }

    const result = this.getSiteData(dataType, context)
    if (context.siteData[dataType]) {
      return context.siteData[dataType] as string
    }
    return result
  },

  getSiteData(dataType: string, context: ExecutorContext): string {
    if (context.siteData[dataType]) return context.siteData[dataType]

    if (typeof window === 'undefined') return ''
    const loc = window.location
    const d = document

    switch (dataType) {
      case 'url': return loc.href
      case 'domain': return loc.hostname
      case 'host': return loc.host
      case 'path': return loc.pathname
      case 'protocol': return loc.protocol
      case 'query': return loc.search.replace(/^\?/, '')
      case 'hash': return loc.hash.replace(/^#/, '')
      case 'title': return d.title
      case 'text': return d.body?.textContent?.substring(0, 1000) || ''
      case 'html': return d.body?.innerHTML?.substring(0, 1000) || ''
      case 'selection': return window.getSelection()?.toString() || ''
      default: return ''
    }
  },

  handleSnippet(args: CommandArgs, context: ExecutorContext): string {
    const property = args.positional[0] || args.raw || ''
    if (!property) return ''

    const currentSnippet = context.currentSnippetShortcut
      ? context.snippets[context.currentSnippetShortcut]
      : undefined

    switch (property.toLowerCase()) {
      case 'shortcut':
        return currentSnippet?.shortcut || context.currentSnippetShortcut || ''
      case 'name':
        return currentSnippet?.name || ''
      case 'guid':
      case 'id':
        return ''
      default:
        return ''
    }
  },

  handleUser(args: CommandArgs, context: ExecutorContext): string {
    const property = args.positional[0] || args.raw || ''
    if (!property) return ''

    if (property in context.userData) {
      return String(context.userData[property])
    }

    switch (property.toLowerCase()) {
      case 'os':
        return navigator.platform || ''
      case 'browser':
        return navigator.userAgent || ''
      case 'language':
      case 'lang':
        return navigator.language || ''
      case 'timezone':
        return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      default:
        return ''
    }
  },

  async evaluateCondition(condition: string, context: ExecutorContext): Promise<boolean> {
    if (!condition || condition.trim() === '') return false

    const result = await this.evaluateWithSandbox(condition, context)
    return result === true || result === 'true' ||
      (typeof result === 'number' && result !== 0) ||
      (typeof result === 'string' && result !== '' && result !== 'false')
  },

  async evaluateWithSandbox(expr: string, context: ExecutorContext): Promise<unknown> {
    if (!expr) return ''
    const contextVars: Record<string, unknown> = { ...context.formValues, ...context.variables }
    const result = this.evalExpression(expr, contextVars)
    return result
  },

  evalExpression(input: string, vars: Record<string, unknown>, helpers?: Record<string, (...args: unknown[]) => unknown>): unknown {
    if (!input) return ''
    input = input.trim()
    const allHelpers = helpers || SANDBOX_FUNCTIONS

    // Convert single = to == for TextExpander-style comparisons
    input = input.replace(/(?<![<>!=])=(?!=)/g, '==')

    const tokenize = (s: string): { type: string; value: string }[] => {
      const tokens: { type: string; value: string }[] = []
      let i = 0
      while (i < s.length) {
        if (/\s/.test(s[i])) { i++; continue }
        // Single-char operators
        if ('()+-*/%,?:=!<>&|'.includes(s[i])) {
          if (s[i] === '=' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '==' }); i += 2; continue }
          if (s[i] === '!' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '!=' }); i += 2; continue }
          if (s[i] === '!' && s[i + 1] !== '=') { tokens.push({ type: 'op', value: '!' }); i++; continue }
          if (s[i] === '<' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '<=' }); i += 2; continue }
          if (s[i] === '>' && s[i + 1] === '=') { tokens.push({ type: 'op', value: '>=' }); i += 2; continue }
          if (s[i] === '&' && s[i + 1] === '&') { tokens.push({ type: 'op', value: '&&' }); i += 2; continue }
          if (s[i] === '|' && s[i + 1] === '|') { tokens.push({ type: 'op', value: '||' }); i += 2; continue }
          tokens.push({ type: 'op', value: s[i] }); i++; continue
        }
        if (/[\d.]/.test(s[i])) {
          let num = ''
          while (i < s.length && /[\d.eE]/.test(s[i])) num += s[i++]
          if (s[i] === 'x' || s[i] === 'X') { num += s[i++]; while (i < s.length && /[\da-fA-F]/.test(s[i])) num += s[i++] }
          tokens.push({ type: 'num', value: num }); continue
        }
        if ((s[i] === '"' || s[i] === "'") && s[i] === s[i]) {
          const quote = s[i++]; let str = ''
          while (i < s.length && s[i] !== quote) { if (s[i] === '\\') i++; str += s[i++] }
          i++ // skip closing quote
          tokens.push({ type: 'str', value: str }); continue
        }
        if (/[a-zA-Z_$@]/.test(s[i])) {
          let id = ''
          while (i < s.length && /[\w$@]/.test(s[i])) id += s[i++]
          if (id === 'true') { tokens.push({ type: 'num', value: '1' }); continue }
          if (id === 'false') { tokens.push({ type: 'num', value: '0' }); continue }
          if (id === 'null') { tokens.push({ type: 'null', value: 'null' }); continue }
          tokens.push({ type: 'id', value: id }); continue
        }
        return []
      }
      return tokens
    }

    let tokens = tokenize(input)
    if (tokens.length === 0) {
      const mathVal = this.safeEvalMath(input)
      return mathVal !== null ? mathVal : input
    }

    let pos = 0
    const peek = () => pos < tokens.length ? tokens[pos].value : ''
    const consume = () => pos < tokens.length ? tokens[pos++].value : ''
    const peekType = () => pos < tokens.length ? tokens[pos].type : ''

    const parseExpr = (): unknown => parseCond()

    const parseCond = (): unknown => {
      let left = parseOr()
      if (peek() === '?') {
        consume()
        const trueVal = parseExpr()
        if (peek() === ':') { consume(); const falseVal = parseExpr(); return left ? trueVal : falseVal }
      }
      return left
    }

    const parseOr = (): unknown => {
      let left = parseAnd()
      while (peek() === '||') { consume(); const right = parseAnd(); left = left || right }
      return left
    }

    const parseAnd = (): unknown => {
      let left = parseCompare()
      while (peek() === '&&') { consume(); const right = parseCompare(); left = left && right }
      return left
    }

    const parseCompare = (): unknown => {
      let left = parseAddSub()
      while (['==', '!=', '<', '>', '<=', '>='].includes(peek())) {
        const op = consume()
        const right = parseAddSub()
        if (op === '==') left = left == right
        else if (op === '!=') left = left != right
        else if (op === '<') left = (left as number) < (right as number)
        else if (op === '>') left = (left as number) > (right as number)
        else if (op === '<=') left = (left as number) <= (right as number)
        else if (op === '>=') left = (left as number) >= (right as number)
      }
      return left
    }

    const parseAddSub = (): unknown => {
      let left = parseMulDiv()
      while (peek() === '+' || peek() === '-') {
        const op = consume()
        const right = parseMulDiv()
        if (op === '+') left = (left as number) + (right as number)
        else left = (left as number) - (right as number)
      }
      return left
    }

    const parseMulDiv = (): unknown => {
      let left = parseUnary()
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        const op = consume()
        const right = parseUnary()
        if (op === '*') left = (left as number) * (right as number)
        else if (op === '/') left = (left as number) / (right as number)
        else if (op === '%') left = (left as number) % (right as number)
      }
      return left
    }

    const parseUnary = (): unknown => {
      if (peek() === '-') { consume(); return -(parseUnary() as number) }
      if (peek() === '!') { consume(); return !parseUnary() }
      return parsePrimary()
    }

    const parsePrimary = (): unknown => {
      if (peek() === '(') {
        consume()
        const val = parseExpr()
        if (peek() === ')') consume()
        return val
      }
      if (peekType() === 'num') return parseFloat(consume())
      if (peekType() === 'str') return consume()
      if (peekType() === 'null') { consume(); return null }
      if (peekType() === 'id') {
        const name = consume()
        if (peek() === '(') {
          consume() // (
          const args: unknown[] = []
          if (peek() !== ')') {
            args.push(parseExpr())
            while (peek() === ',') { consume(); args.push(parseExpr()) }
          }
          if (peek() === ')') consume()
          const fn = allHelpers[name] || (name.startsWith('$') ? allHelpers[name] : undefined)
          if (fn) return fn(...args)
          return name
        }
        // Variable lookup
        if (name in vars) return vars[name]
        if (name.startsWith('@')) {
          const baseName = name.substring(1)
          if (baseName in vars) return vars[baseName]
        }
        return name
      }
      return ''
    }

    try {
      const result = parseExpr()
      return result === undefined ? '' : result
    } catch {
      const mathVal = this.safeEvalMath(input)
      return mathVal !== null ? mathVal : input
    }
  },

  safeEvalMath(expr: string): number | null {
    if (!expr || typeof expr !== 'string') return null
    const trimmed = expr.trim()
    if (!trimmed) return null
    if (!/^[\d\s+\-*/().%]+$/.test(trimmed)) return null

    try {
      let pos = 0
      const input = trimmed.replace(/\s+/g, '')

      const peek = () => input[pos] || ''
      const consume = () => input[pos++] || ''

      const parsePrimary = (): number | null => {
        if (peek() === '(') {
          consume()
          const val = parseExpression()
          consume()
          return val
        }
        let numStr = ''
        while (/[\d.]/.test(peek())) numStr += consume()
        if (numStr === '') return null
        return parseFloat(numStr)
      }

      const parseMulDiv = (): number | null => {
        let left = parsePrimary()
        if (left === null) return null
        while (peek() === '*' || peek() === '/' || peek() === '%') {
          const op = consume()
          const right = parsePrimary()
          if (right === null) return null
          if (op === '*') left *= right
          else if (op === '/') left /= right
          else if (op === '%') left %= right
        }
        return left
      }

      const parseExpression = (): number | null => {
        let left = parseMulDiv()
        if (left === null) return null
        while (peek() === '+' || peek() === '-') {
          const op = consume()
          const right = parseMulDiv()
          if (right === null) return null
          if (op === '+') left += right
          else left -= right
        }
        return left
      }

      const result = parseExpression()
      if (result === null || pos !== input.length) return null
      return result
    } catch {
      return null
    }
  },
}

export default CommandExecutor
