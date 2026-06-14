import KeySimulator from './keySimulator'
import FrameManager from './frameManager'

interface AutopilotAction {
  type: 'click' | 'type' | 'key' | 'wait' | 'tab' | 'focus'
  selector?: string
  xpath?: string
  text?: string
  key?: string
  delay?: number
  direction?: 'next' | 'prev'
}

export const Autopilot = {
  async execute(action: AutopilotAction): Promise<boolean> {
    switch (action.type) {
      case 'click': return this.click(action.selector, action.xpath, action.delay)
      case 'type': return this.type(action.selector, action.text || '', action.delay)
      case 'key': return this.pressKey(action.key)
      case 'wait': return this.wait(action.delay || 1)
      case 'tab': return this.tab(action.direction || 'next')
      case 'focus': return this.focusElement(action.selector)
      default: return false
    }
  },

  async click(selector?: string, xpath?: string, timeout = 10): Promise<boolean> {
    if (!selector && !xpath) return false

    const start = Date.now()
    const deadline = start + timeout * 1000

    while (Date.now() < deadline) {
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

      if (!element && FrameManager.getShadowEditableElements(document).length > 0) {
        const shadowRoots = this.findAllShadowRoots(document.body)
        for (const root of shadowRoots) {
          if (selector) element = root.querySelector(selector)
          if (element) break
        }
      }

      if (element) {
        try {
          ;(element as HTMLElement).focus()
          element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }))
          element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, composed: true }))
          ;(element as HTMLElement).click()
          element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }))
        } catch {
          try {
            ;(element as HTMLElement).click()
          } catch {
            return false
          }
        }
        return true
      }

      await new Promise(r => setTimeout(r, 100))
    }

    return false
  },

  async type(selector?: string, text?: string, delayMs = 10): Promise<boolean> {
    let target: Element | null = null

    if (selector) {
      target = document.querySelector(selector)
      if (!target) {
        const shadowRoots = this.findAllShadowRoots(document.body)
        for (const root of shadowRoots) {
          target = root.querySelector(selector)
          if (target) break
        }
      }
    } else {
      target = document.activeElement
    }

    if (!target) return false
    ;(target as HTMLElement).focus()
    await KeySimulator.simulateTyping(target, text || '', delayMs)
    return true
  },

  async pressKey(key?: string): Promise<boolean> {
    if (!key) return false
    const target = document.activeElement
    if (!target) return false
    await KeySimulator.dispatchKey(target, { key })
    return true
  },

  async wait(seconds: number): Promise<boolean> {
    await new Promise(r => setTimeout(r, seconds * 1000))
    return true
  },

  async tab(direction: 'next' | 'prev'): Promise<boolean> {
    const target = document.activeElement
    if (!target) return false

    await KeySimulator.dispatchKey(target, {
      key: 'Tab',
      shift: direction === 'prev',
    })
    return true
  },

  async focusElement(selector?: string): Promise<boolean> {
    if (!selector) return false
    const el = document.querySelector(selector) as HTMLElement
    if (el) {
      el.focus()
      return true
    }
    const shadowRoots = this.findAllShadowRoots(document.body)
    for (const root of shadowRoots) {
      const shadowEl = root.querySelector(selector) as HTMLElement
      if (shadowEl) {
        shadowEl.focus()
        return true
      }
    }
    return false
  },

  findAllShadowRoots(root: Element): ShadowRoot[] {
    const results: ShadowRoot[] = []
    if (root.shadowRoot) results.push(root.shadowRoot)
    for (const child of root.children) {
      results.push(...this.findAllShadowRoots(child))
    }
    return results
  },

  async simulateClick(selector: string, xpath?: string, maxDelay = 10): Promise<boolean> {
    return this.click(selector, xpath, maxDelay)
  },

  async navigateFrames(direction: 'next' | 'prev'): Promise<boolean> {
    const iframes = document.querySelectorAll('iframe')
    const currentIndex = Array.from(iframes).findIndex(f => {
      try { return f.contentDocument?.hasFocus() } catch { return false }
    })

    const nextIndex = direction === 'next'
      ? (currentIndex + 1) % iframes.length
      : (currentIndex - 1 + iframes.length) % iframes.length

    if (iframes[nextIndex]) {
      try {
        iframes[nextIndex].focus()
        const body = iframes[nextIndex].contentDocument?.body
        if (body) {
          const editables = body.querySelectorAll(
            'input:not([type="hidden"]), textarea, [contenteditable="true"]'
          )
          if (editables.length > 0) {
            ;(editables[0] as HTMLElement).focus()
          }
        }
        return true
      } catch {
        return false
      }
    }
    return false
  },
}

export default Autopilot
