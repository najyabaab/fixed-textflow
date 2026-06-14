export const FrameManager = {
  findEditableElementInFrames(): Element | null {
    const active = document.activeElement
    if (active && this.isEditable(active)) return active

    const iframes = document.querySelectorAll('iframe')
    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (!doc) continue
        const iframeActive = doc.activeElement
        if (iframeActive && this.isEditable(iframeActive)) return iframeActive
        const editables = doc.querySelectorAll(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"], [contenteditable=""]'
        )
        for (const el of editables) {
          if (this.isElementVisible(el)) return el
        }
      } catch {
        // cross-origin iframe, skip
      }
    }

    return active && this.isEditable(active) ? active : null
  },

  findActiveFrame(): Window | null {
    const iframes = document.querySelectorAll('iframe')
    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (!doc) continue
        if (doc.hasFocus()) return iframe.contentWindow
        const childWin = this.findActiveFrameInWindow(iframe.contentWindow)
        if (childWin) return childWin
      } catch {
        // cross-origin
      }
    }
    return null
  },

  findActiveFrameInWindow(win: Window): Window | null {
    try {
      const doc = win.document
      if (doc.hasFocus()) return win
      const iframes = doc.querySelectorAll('iframe')
      for (const iframe of iframes) {
        try {
          const childWin = iframe.contentWindow
          if (!childWin) continue
          const result = this.findActiveFrameInWindow(childWin)
          if (result) return result
        } catch {
          // cross-origin
        }
      }
    } catch {
      // cross-origin
    }
    return null
  },

  isEditable(element: Element): boolean {
    if (!element || !(element instanceof Element)) return false
    const tag = element.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea') {
      const input = element as HTMLInputElement
      return !input.disabled && input.type !== 'hidden'
    }
    if (element.getAttribute('contenteditable') === 'true' ||
        element.getAttribute('contenteditable') === '') return true
    if ((element as HTMLElement).isContentEditable) return true
    if (element.getAttribute('role') === 'textbox') return true
    return false
  },

  isElementVisible(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return false
    if (element.offsetWidth === 0 && element.offsetHeight === 0) return false
    const style = window.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    return true
  },

  getShadowEditableElements(root: Element | Document | ShadowRoot): Element[] {
    const results: Element[] = []
    const editables = root.querySelectorAll(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), [contenteditable="true"], [contenteditable=""]'
    )
    for (const el of editables) {
      if (this.isElementVisible(el)) results.push(el)
    }

    if (root instanceof Element && root.shadowRoot) {
      results.push(...this.getShadowEditableElements(root.shadowRoot))
    }

    const hostElements = root.querySelectorAll('*')
    for (const el of hostElements) {
      if (el.shadowRoot) {
        results.push(...this.getShadowEditableElements(el.shadowRoot))
      }
    }

    return results
  },

  focusElementInFrame(targetFrame: Window | null, selector: string): boolean {
    if (!targetFrame) return false
    try {
      const el = targetFrame.document.querySelector(selector) as HTMLElement
      if (el) {
        el.focus()
        return true
      }
    } catch {
      // cross-origin
    }
    return false
  },

  getActiveEditTarget(): Element | null {
    const standard = document.activeElement
    if (standard && this.isEditable(standard) && this.isElementVisible(standard as HTMLElement)) {
      return standard
    }

    const iframes = document.querySelectorAll('iframe')
    for (const iframe of iframes) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (!doc) continue
        const iframeActive = doc.activeElement
        if (iframeActive && this.isEditable(iframeActive)) {
          return iframeActive
        }
      } catch {
        // cross-origin, skip
      }
    }

    const shadowEditables = this.getShadowEditableElements(document)
    if (shadowEditables.length > 0) return shadowEditables[0]

    return standard && this.isEditable(standard) ? standard : null
  },
}

export default FrameManager
