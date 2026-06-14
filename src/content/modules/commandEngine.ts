import CommandParser from './commandParser'
import CommandExecutor from './commandExecutor'
import type { ExecutorContext, ExecutorResult } from './commandExecutor'
import type { FormField } from './commandParser'

export interface EngineSnippet {
  content: string
  shortcut: string
  name?: string
}

export interface EngineOptions {
  clipboardText?: string
  url?: string
  title?: string
  selection?: string
  siteData?: Record<string, string>
  userData?: Record<string, string>
  snippets?: Record<string, EngineSnippet>
  currentShortcut?: string
  currentTrigger?: string
}

export interface EngineResult {
  content: string
  cursorPosition: number
  formFields?: FormField[]
}

export const CommandEngine = {
  async processContent(
    content: string,
    options: EngineOptions
  ): Promise<EngineResult> {
    const snippetMap: Record<string, { content: string; shortcut: string; name?: string }> = {}
    if (options.snippets) {
      for (const [key, s] of Object.entries(options.snippets)) {
        snippetMap[key.toLowerCase()] = s
      }
    }

    const variables: Record<string, unknown> = {
      url: options.url || '',
      title: options.title || '',
      selection: options.selection || '',
    }

    if (options.currentTrigger) {
      variables.trigger = options.currentTrigger
    }

    const context: ExecutorContext = {
      formValues: {},
      variables,
      snippets: snippetMap,
      clipboardText: options.clipboardText,
      currentSnippetShortcut: options.currentShortcut,
      siteData: options.siteData || {},
      userData: options.userData || {},
    }

    let result: ExecutorResult

    try {
      result = await CommandExecutor.execute(content, context)
    } catch (error) {
      console.error('[CommandEngine] Execution error:', error)
      return { content, cursorPosition: -1 }
    }

    if (result.requiresForm) {
      return {
        content: result.content,
        cursorPosition: -1,
        formFields: result.formFields,
      }
    }

    return {
      content: result.content,
      cursorPosition: result.cursorPosition,
    }
  },

  async processWithFormValues(
    content: string,
    formValues: Record<string, string | boolean | string[]>,
    options: EngineOptions
  ): Promise<EngineResult> {
    const snippetMap: Record<string, { content: string; shortcut: string; name?: string }> = {}
    if (options.snippets) {
      for (const [key, s] of Object.entries(options.snippets)) {
        snippetMap[key.toLowerCase()] = s
      }
    }

    const variables: Record<string, unknown> = {
      url: options.url || '',
      title: options.title || '',
      selection: options.selection || '',
    }

    if (options.currentTrigger) {
      variables.trigger = options.currentTrigger
    }

    const context: ExecutorContext = {
      formValues,
      variables,
      snippets: snippetMap,
      clipboardText: options.clipboardText,
      currentSnippetShortcut: options.currentShortcut,
      siteData: options.siteData || {},
      userData: options.userData || {},
    }

    let result: ExecutorResult
    try {
      result = await CommandExecutor.execute(content, context)
    } catch (error) {
      console.error('[CommandEngine] Execution error with form values:', error)
      return { content, cursorPosition: -1 }
    }

    return {
      content: result.content,
      cursorPosition: result.cursorPosition,
    }
  },

  hasCommands(text: string): boolean {
    return CommandParser.hasCommands(text)
  },

  extractFormFields(text: string): FormField[] {
    return CommandParser.extractFormFields(text)
  },
}

export default CommandEngine
