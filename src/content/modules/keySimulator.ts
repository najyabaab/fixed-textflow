export interface KeySpec {
  key: string
  code?: string
  keyCode?: number
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  isComposing?: boolean
}

const KEY_MAP: Record<string, { code: string; keyCode: number }> = {
  'Enter': { code: 'Enter', keyCode: 13 },
  'Return': { code: 'Enter', keyCode: 13 },
  'Tab': { code: 'Tab', keyCode: 9 },
  'Space': { code: 'Space', keyCode: 32 },
  ' ': { code: 'Space', keyCode: 32 },
  'Backspace': { code: 'Backspace', keyCode: 8 },
  'Delete': { code: 'Delete', keyCode: 46 },
  'Escape': { code: 'Escape', keyCode: 27 },
  'Esc': { code: 'Escape', keyCode: 27 },
  'ArrowUp': { code: 'ArrowUp', keyCode: 38 },
  'ArrowDown': { code: 'ArrowDown', keyCode: 40 },
  'ArrowLeft': { code: 'ArrowLeft', keyCode: 37 },
  'ArrowRight': { code: 'ArrowRight', keyCode: 39 },
  'Home': { code: 'Home', keyCode: 36 },
  'End': { code: 'End', keyCode: 35 },
  'PageUp': { code: 'PageUp', keyCode: 33 },
  'PageDown': { code: 'PageDown', keyCode: 34 },
  'Insert': { code: 'Insert', keyCode: 45 },
}

function charToKeyCode(c: string): number {
  return c.toUpperCase().charCodeAt(0)
}

function charToCode(c: string): string {
  if (c >= 'a' && c <= 'z') return 'Key' + c.toUpperCase()
  if (c >= 'A' && c <= 'Z') return 'Key' + c
  if (c >= '0' && c <= '9') return 'Digit' + c
  if (c === ' ') return 'Space'
  if (c === ',') return 'Comma'
  if (c === '.') return 'Period'
  if (c === '-') return 'Minus'
  if (c === '=') return 'Equal'
  if (c === ';') return 'Semicolon'
  if (c === "'") return 'Quote'
  if (c === '`') return 'Backquote'
  if (c === '[') return 'BracketLeft'
  if (c === ']') return 'BracketRight'
  if (c === '\\') return 'Backslash'
  if (c === '/') return 'Slash'
  return c
}

function isCharKey(key: string): boolean {
  return key.length === 1 || key === 'Space' || key === ' '
}

function isSpecialKey(key: string): boolean {
  return ['Enter', 'Return', 'Tab', 'Backspace', 'Delete', 'Escape', 'Esc'].includes(key)
}

function isNavigationKey(key: string): boolean {
  return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(key)
}

export const KeySimulator = {
  async dispatchKey(target: Element | null, spec: KeySpec): Promise<void> {
    if (!target) return

    const el = target
    const key = spec.key
    const mapped = KEY_MAP[key]
    const code = spec.code || mapped?.code || charToCode(key)
    const keyCode = spec.keyCode || mapped?.keyCode || (key.length === 1 ? charToKeyCode(key) : 0)
    const keyEventInit: KeyboardEventInit = {
      key,
      code,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
      ctrlKey: spec.ctrl || false,
      altKey: spec.alt || false,
      shiftKey: spec.shift || false,
      metaKey: spec.meta || false,
      repeat: false,
      isComposing: spec.isComposing || false,
      location: 0,
    }

    const view = el.ownerDocument?.defaultView || window
    Object.defineProperty(keyEventInit, 'view', { value: view, writable: false })

    el.dispatchEvent(new KeyboardEvent('keydown', keyEventInit))

    if (isCharKey(key) || isSpecialKey(key)) {
      const keypressInit = { ...keyEventInit, keyCode: key === ' ' ? 32 : isSpecialKey(key) ? keyCode : key.charCodeAt(0) }
      el.dispatchEvent(new KeyboardEvent('keypress', keypressInit))
    }

    if (key === 'Enter' || key === 'Return') {
      el.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'insertParagraph',
        bubbles: true,
        cancelable: true,
        composed: true,
        data: null,
      }))
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    } else if (key === 'Backspace') {
      el.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'deleteContentBackward',
        bubbles: true,
        cancelable: true,
        composed: true,
        data: null,
      }))
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        document.execCommand('delete', false)
      } else {
        el.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      }
    } else if (key === 'Delete') {
      el.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'deleteContentForward',
        bubbles: true,
        cancelable: true,
        composed: true,
        data: null,
      }))
      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    } else if (isCharKey(key) && !keyEventInit.ctrlKey && !keyEventInit.altKey && !keyEventInit.metaKey) {
      const char = key === ' ' ? ' ' : key
      el.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: char,
        bubbles: true,
        cancelable: true,
        composed: true,
      }))

      const textEvent = new InputEvent('textInput', {
        data: char,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
      })
      el.dispatchEvent(textEvent)

      if (el.isContentEditable || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        document.execCommand('insertText', false, char)
      }

      el.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    }

    el.dispatchEvent(new KeyboardEvent('keyup', keyEventInit))
  },

  simulateTyping(target: Element | null, text: string, delayMs = 5): Promise<void> {
    return new Promise(async (resolve) => {
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        await this.dispatchKey(target, { key: char })
        if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs))
      }
      resolve()
    })
  },

  async simulateBackspaces(target: Element | null, count: number, delayMs = 5): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.dispatchKey(target, { key: 'Backspace' })
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs))
    }
  },

  async compositionSequence(target: Element | null, text: string, delayMs = 10): Promise<void> {
    if (!target) return

    const doc = target.ownerDocument || document
    const win = doc.defaultView || window

    target.dispatchEvent(new CompositionEvent('compositionstart', {
      bubbles: true,
      cancelable: false,
      composed: true,
    }))

    let currentText = ''
    for (let i = 0; i < text.length; i++) {
      currentText += text[i]
      await this.dispatchKey(target, { key: text[i], isComposing: true })

      target.dispatchEvent(new CompositionEvent('compositionupdate', {
        data: currentText,
        bubbles: true,
        cancelable: false,
        composed: true,
      }))

      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs))
    }

    target.dispatchEvent(new CompositionEvent('compositionend', {
      data: text,
      bubbles: true,
      cancelable: false,
      composed: true,
    }))
  },
}

export default KeySimulator
