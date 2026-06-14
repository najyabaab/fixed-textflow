import EditorDetector from './editorDetector'
import CursorManager, { CURSOR_PLACEHOLDER } from './cursorManager'
import CommandEngine from './commandEngine'
import FormModal from './formModal'
import KeySimulator from './keySimulator'
import FrameManager from './frameManager'
import HtmlBuilder from './htmlBuilder'
import type { EngineOptions } from './commandEngine'
import type { EditorData, Snippet } from '@/lib/types'

interface ExpansionResult {
  success: boolean
  error?: string
}

export const TextExpander = {
  async expand(
    element: Element,
    shortcut: string,
    snippet: Snippet,
    allSnippets?: Record<string, { content: string; shortcut: string; name?: string }>,
    userData?: Record<string, string>
  ): Promise<ExpansionResult> {
    const editorData = EditorDetector.getEditorData(element)

    console.log(`[TextExpander] Expanding "${shortcut}" in ${editorData.editorType}`)

    const snippetMap: Record<string, { content: string; shortcut: string; name?: string }> = {}
    if (allSnippets) {
      for (const [key, s] of Object.entries(allSnippets)) {
        snippetMap[key.toLowerCase()] = { ...s, shortcut: key }
      }
    }
    snippetMap[shortcut.toLowerCase()] = { ...snippet, shortcut }

    const engineOptions: EngineOptions = {
      currentShortcut: shortcut,
      currentTrigger: shortcut,
      url: window.location.href,
      title: document.title,
      selection: window.getSelection()?.toString() || '',
      snippets: snippetMap,
      userData: userData || {},
      siteData: {
        url: window.location.href,
        domain: window.location.hostname,
        host: window.location.host,
        path: window.location.pathname,
        protocol: window.location.protocol,
        title: document.title,
      },
    }

    try {
      const hasCommands = CommandEngine.hasCommands(snippet.content)

      if (hasCommands) {
        const result = await CommandEngine.processContent(snippet.content, engineOptions)

        if (result.formFields && result.formFields.length > 0) {
          const formValues = await this.showFormModal(result.formFields, snippet.name || shortcut)

          if (!formValues) {
            return { success: false, error: 'Form cancelled' }
          }

          const finalResult = await CommandEngine.processWithFormValues(
            snippet.content,
            formValues,
            engineOptions
          )

          if (finalResult.cursorPosition >= 0) {
            const contentWithMarker = CursorManager.insertWithPlaceholderAndPosition(
              finalResult.content, finalResult.cursorPosition
            )
            await this.insertContent(contentWithMarker, shortcut.length, element, editorData)
            CursorManager.positionAtPlaceholder(element, CURSOR_PLACEHOLDER)
          } else {
            await this.insertContent(finalResult.content, shortcut.length, element, editorData)
          }

          return { success: true }
        }

        if (result.cursorPosition >= 0) {
          const contentWithMarker = CursorManager.insertWithPlaceholderAndPosition(
            result.content, result.cursorPosition
          )
          await this.insertContent(contentWithMarker, shortcut.length, element, editorData)
          CursorManager.positionAtPlaceholder(element, CURSOR_PLACEHOLDER)
        } else {
          await this.insertContent(result.content, shortcut.length, element, editorData)
        }

        return { success: true }
      }

      const { cleanContent, cursorOffset } = CursorManager.findCursorPlaceholder(
        snippet.content
      )

      if (cursorOffset >= 0) {
        const contentWithMarker = CursorManager.insertWithPlaceholderAndPosition(
          cleanContent, cursorOffset
        )
        await this.insertContent(contentWithMarker, shortcut.length, element, editorData)
        CursorManager.positionAtPlaceholder(element, CURSOR_PLACEHOLDER)
      } else {
        await this.insertContent(cleanContent, shortcut.length, element, editorData)
      }

      return { success: true }
    } catch (error) {
      console.error('[TextExpander] Expansion failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  },

  async insertContent(
    text: string,
    shortcutLength: number,
    element: Element,
    editorData: EditorData
  ): Promise<void> {
    if (editorData.isGoogleDocs) {
      await this.insertViaClipboard(text, shortcutLength, element, editorData)
    } else if (editorData.requiresClipboard) {
      await this.insertViaClipboard(text, shortcutLength, element, editorData)
    } else if (editorData.isInput || editorData.isTextarea) {
      await this.insertInStandardInput(text, shortcutLength, element as HTMLInputElement)
    } else if (editorData.isContentEditable || editorData.isIntegrated) {
      await this.insertInContentEditable(text, shortcutLength, element, editorData)
    } else {
      await this.insertInStandardInput(text, shortcutLength, element as HTMLInputElement)
    }
  },

  async insertInStandardInput(
    text: string,
    shortcutLength: number,
    element: HTMLInputElement | HTMLTextAreaElement
  ): Promise<void> {
    const start = element.selectionStart ?? 0
    const end = element.selectionEnd ?? 0
    const value = element.value

    const beforeShortcut = value.slice(0, start - shortcutLength)
    const afterCursor = value.slice(end)
    const newValue = beforeShortcut + text + afterCursor

    element.focus()
    element.setSelectionRange(start - shortcutLength, end)

    const success = document.execCommand('insertText', false, text)

    if (!success) {
      element.value = newValue
      const newPos = beforeShortcut.length + text.length
      element.setSelectionRange(newPos, newPos)
    }

    element.dispatchEvent(new Event('input', { bubbles: true }))
  },

  async insertInContentEditable(
    text: string,
    shortcutLength: number,
    element: Element,
    editorData: EditorData
  ): Promise<void> {
    await this.clearShortcut(shortcutLength, element, editorData)

    const useHtml = editorData.isRichTextEditor || text.includes('\n') || text.includes('<')
    const html = HtmlBuilder.textToHtml(text)

    if (useHtml) {
      const sel = window.getSelection()
      const range = sel?.getRangeAt(0)
      if (range) {
        try {
          range.deleteContents()
          const fragment = range.createContextualFragment(html)
          range.insertNode(fragment)
          range.collapse(false)
          sel?.removeAllRanges()
          sel?.addRange(range)
          element.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
          return
        } catch {
          // fall through to execCommand
        }
      }
    }

    const success = document.execCommand('insertText', false, text)
    if (!success) {
      document.execCommand('insertHTML', false, html)
    }

    element.dispatchEvent(new Event('input', { bubbles: true }))
  },

  async insertViaClipboard(
    text: string,
    shortcutLength: number,
    element: Element,
    editorData: EditorData
  ): Promise<void> {
    try {
      const clipData = HtmlBuilder.buildClipboardData(text, element)
      await chrome.runtime.sendMessage({
        type: 'SET_CLIPBOARD',
        payload: clipData,
      })

      await this.clearShortcut(shortcutLength, element, editorData)

      if (editorData.isGoogleDocs) {
        await this.pasteInGoogleDocs(element, text)
      } else {
        document.execCommand('paste')
      }

      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'RESTORE_CLIPBOARD' }).catch(() => { })
      }, 100)
    } catch (error) {
      console.error('[TextExpander] Clipboard insertion failed:', error)
      throw error
    }
  },

  async clearShortcut(
    length: number,
    element: Element,
    _editorData: EditorData
  ): Promise<void> {
    const selection = window.getSelection()

    if (selection && selection.rangeCount > 0 && !_editorData.isCodeEditor) {
      try {
        const range = selection.getRangeAt(0)
        for (let i = 0; i < length; i++) {
          selection.modify('extend', 'backward', 'character')
        }
        document.execCommand('delete', false)
        return
      } catch {
        // fall through
      }
    }

    await this.simulateBackspaces(length, element)
  },

  async simulateBackspaces(count: number, element: Element): Promise<void> {
    await KeySimulator.simulateBackspaces(element, count, 5)
  },

  async pasteInGoogleDocs(element: Element, text: string): Promise<void> {
    const id = Math.random().toString(36).substring(2, 11)

    const result = await new Promise<boolean>((resolve) => {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail
        if (detail?.id === id) {
          document.removeEventListener('TextFlow_Res', handler)
          resolve(detail.success === true)
        }
      }
      document.addEventListener('TextFlow_Res', handler)

      document.dispatchEvent(new CustomEvent('TextFlow_Req', {
        detail: { id, type: 'paste', payload: { text, isRichText: false } },
        bubbles: true,
        composed: true,
      }))

      setTimeout(() => {
        document.removeEventListener('TextFlow_Res', handler)
        resolve(false)
      }, 2000)
    })

    if (!result) {
      window.postMessage({
        type: 'SMART_TEXT_EXPANDER_PASTE',
        target: 'main',
      }, '*')
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  },

  textToHtml(text: string): string {
    return HtmlBuilder.textToHtml(text)
  },

  escapeHtml(text: string): string {
    return HtmlBuilder.escapeHtml(text)
  },

  async showFormModal(
    fields: import('./commandParser').FormField[],
    snippetName: string
  ): Promise<Record<string, string | boolean | string[]> | null> {
    const formResult = await FormModal.show(fields, snippetName)
    if (formResult.submitted) {
      return formResult.values
    }
    return null
  },
}

export default TextExpander
