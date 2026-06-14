export const CURSOR_MARKER = '\u200B\u200C\u200D'
export const CURSOR_PLACEHOLDER = '\uFFFF'

export const CursorManager = {
  getCaretPosition(element: Element): DOMRect | null {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return null
    }

    const range = selection.getRangeAt(0)
    let rect = range.getBoundingClientRect()

    if (rect.width === 0 && rect.height === 0) {
      return this.getCaretRectFallback(range, element)
    }

    return rect
  },

  getCaretRectFallback(range: Range, _element: Element): DOMRect | null {
    try {
      const span = document.createElement('span')
      span.textContent = '\u200B'

      const clonedRange = range.cloneRange()
      clonedRange.collapse(false)
      clonedRange.insertNode(span)

      const rect = span.getBoundingClientRect()
      span.remove()

      return rect
    } catch {
      return null
    }
  },

  getCaretPositionForInput(element: HTMLInputElement | HTMLTextAreaElement): number {
    return element.selectionStart ?? 0
  },

  getTextBeforeCursor(): string | null {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent?.substring(0, range.startOffset) || null
    }
    return null
  },

  async moveCursorBackwards(direction: 'ltr' | 'rtl', count: number): Promise<void> {
    if (count <= 0) return
    const key = direction === 'ltr' ? 'ArrowLeft' : 'ArrowRight'
    const target = document.activeElement

    for (let i = 0; i < count; i++) {
      if (target) {
        target.dispatchEvent(new KeyboardEvent('keydown', {
          key, code: key, keyCode: 37,
          which: 37, bubbles: true, cancelable: true, composed: true,
        }))
        target.dispatchEvent(new KeyboardEvent('keyup', {
          key, code: key, keyCode: 37,
          which: 37, bubbles: true, cancelable: true, composed: true,
        }))
      }
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  },

  positionCursorInDOM(element: Element, offset: number): boolean {
    try {
      const selection = window.getSelection()
      if (!selection) return false

      const { node, offset: actualOffset } = this.findTextNodeAtOffset(element, offset)

      if (node) {
        const range = document.createRange()
        range.setStart(node, actualOffset)
        range.collapse(true)

        selection.removeAllRanges()
        selection.addRange(range)
        return true
      }
    } catch {
      // fall through
    }

    return false
  },

  findTextNodeAtOffset(element: Element, targetOffset: number): { node: Node | null; offset: number } {
    let currentOffset = 0

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    )

    let node: Text | null
    while ((node = walker.nextNode() as Text)) {
      const nodeLength = node.textContent?.length ?? 0

      if (currentOffset + nodeLength >= targetOffset) {
        return {
          node,
          offset: targetOffset - currentOffset,
        }
      }

      currentOffset += nodeLength
    }

    return { node: null, offset: 0 }
  },

  calculateOffsetFromHTML(html: string, htmlOffset: number): number {
    const beforeOffset = html.slice(0, htmlOffset)
    const textContent = beforeOffset.replace(/<[^>]*>/g, '')
    return textContent.length
  },

  positionAtPlaceholder(element: Element, placeholder: string): boolean {
    const treeWalker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    )

    let node: Text | null
    while ((node = treeWalker.nextNode() as Text | null)) {
      const idx = node.textContent?.indexOf(placeholder) ?? -1
      if (idx >= 0) {
        try {
          const selection = window.getSelection()
          if (!selection) return false

          const range = document.createRange()
          range.setStart(node, idx)
          range.collapse(true)

          selection.removeAllRanges()
          selection.addRange(range)

          node.textContent = node.textContent?.replace(placeholder, '') ?? ''
          return true
        } catch {
          return false
        }
      }
    }
    return false
  },

  insertWithPlaceholderAndPosition(
    content: string,
    cursorOffset: number
  ): string {
    if (cursorOffset < 0 || cursorOffset >= content.length) {
      return content
    }

    const before = content.slice(0, cursorOffset)
    const after = content.slice(cursorOffset)
    return before + CURSOR_PLACEHOLDER + after
  },

  async moveCursor(
    cursorOffset: number,
    element: Element,
    direction: 'ltr' | 'rtl',
    isIntegrated: boolean,
    contentLength: number
  ): Promise<void> {
    if (cursorOffset <= 0) return

    const moveBackCount = contentLength - cursorOffset
    if (moveBackCount <= 0) return

    if (isIntegrated) {
      await this.moveCursorBackwards(direction, moveBackCount)
    } else {
      const tagName = element.tagName.toLowerCase()

      if (tagName === 'input' || tagName === 'textarea') {
        const input = element as HTMLInputElement | HTMLTextAreaElement
        const currentPos = input.selectionStart ?? input.value.length
        const newPos = Math.max(0, currentPos - moveBackCount)
        input.setSelectionRange(newPos, newPos)
      } else {
        const success = this.positionCursorInDOM(element, cursorOffset)
        if (!success) {
          const placeholderSuccess = this.positionAtPlaceholder(element, CURSOR_PLACEHOLDER)
          if (!placeholderSuccess) {
            await this.moveCursorBackwards(direction, moveBackCount)
          }
        }
      }
    }
  },

  getTextDirection(element: Element): 'ltr' | 'rtl' {
    const computed = window.getComputedStyle(element)
    return computed.direction as 'ltr' | 'rtl'
  },

  findCursorPlaceholder(content: string): {
    cleanContent: string
    cursorOffset: number
  } {
    const oldPlaceholder = '|cursor|'
    const newPlaceholder = CURSOR_MARKER

    const oldIndex = content.indexOf(oldPlaceholder)
    const newIndex = content.indexOf(newPlaceholder)

    if (oldIndex >= 0) {
      const cleanContent = content.replace(oldPlaceholder, '')
      return { cleanContent, cursorOffset: oldIndex }
    }

    if (newIndex >= 0) {
      const cleanContent = content.replace(newPlaceholder, '')
      return { cleanContent, cursorOffset: newIndex }
    }

    return { cleanContent: content, cursorOffset: -1 }
  },
}

export default CursorManager
