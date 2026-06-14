import TypingStream from './modules/typingStream'
import TextExpander from './modules/textExpander'
import EditorDetector from './modules/editorDetector'
import CommandEngine from './modules/commandEngine'
import type { Snippet, SnippetMap } from '@/lib/types'

let snippets: SnippetMap = {}
let isEnabled = true
let settings = {
  triggerKey: 'space',
  showPreview: true,
}

async function init() {
  console.log('[SmartTextExpander] Content script initializing...')

  await loadSnippets()
  await loadSettings()

  TypingStream.init()
  TypingStream.setSnippets(snippets)

  TypingStream.onShortcutMatch(handleShortcutMatch)

  setupMessageListener()
  setupEditorObserver()

  if (needsMainWorldInjection()) {
    requestMainWorldInjection()
  }

  console.log(`[SmartTextExpander] Ready with ${Object.keys(snippets).length} snippets`)
}

async function loadSnippets() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SNIPPETS' })
    if ((response as any)?.snippets) {
      snippets = (response as any).snippets
      TypingStream.setSnippets(snippets)
    }
  } catch (error) {
    console.error('[SmartTextExpander] Failed to load snippets:', error)
  }
}

async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })
    if ((response as any)?.settings) {
      settings = { ...settings, ...(response as any).settings }
      isEnabled = (response as any).settings.enabled !== false
    }
  } catch (error) {
    console.error('[SmartTextExpander] Failed to load settings:', error)
  }
}

async function handleShortcutMatch(element: Element, shortcut: string) {
  if (!isEnabled) {
    console.log('[SmartTextExpander] Disabled, ignoring match')
    return
  }

  const snippet = snippets[shortcut]
  if (!snippet) {
    console.log(`[SmartTextExpander] Snippet not found: ${shortcut}`)
    return
  }

  console.log(`[SmartTextExpander] Expanding: ${shortcut}`)

  let expandedSnippet: Snippet

  const hasCommands = CommandEngine.hasCommands(snippet.content)

  if (!hasCommands) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPAND_SNIPPET',
        payload: {
          shortcut,
          context: {
            url: window.location.href,
            title: document.title,
            selection: window.getSelection()?.toString() || '',
          },
        },
      })

      if ((response as any)?.expanded) {
        expandedSnippet = {
          ...snippet,
          content: (response as any).expanded,
        }
      } else {
        expandedSnippet = snippet
      }
    } catch {
      expandedSnippet = snippet
    }
  } else {
    expandedSnippet = snippet
  }

  const result = await TextExpander.expand(element, shortcut, expandedSnippet, snippets)

  if (!result.success) {
    console.error('[SmartTextExpander] Expansion failed:', result.error)
  }
}

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch ((message as any).type) {
      case 'SNIPPETS_UPDATED':
        snippets = (message as any).payload || {}
        TypingStream.setSnippets(snippets)
        console.log('[SmartTextExpander] Snippets updated')
        break

      case 'SETTINGS_UPDATED':
        settings = { ...settings, ...(message as any).payload }
        break

      case 'TOGGLE_ENABLED':
        isEnabled = (message as any).payload
        console.log(`[SmartTextExpander] ${isEnabled ? 'Enabled' : 'Disabled'}`)
        break

      case 'PING':
        sendResponse({ pong: true })
        break
    }

    return true
  })
}

function needsMainWorldInjection(): boolean {
  const hostname = window.location.hostname

  const sites = [
    'docs.google.com',
    'sheets.google.com',
    'slides.google.com',
    'notion.so',
    'notion.site',
    'figma.com',
  ]

  return sites.some(site => hostname.includes(site))
}

async function requestMainWorldInjection() {
  try {
    await chrome.runtime.sendMessage({ type: 'INJECT_REMAPPER' })
    console.log('[SmartTextExpander] MAIN world script requested')
  } catch (error) {
    console.warn('[SmartTextExpander] Failed to request MAIN world injection:', error)
  }
}

function setupEditorObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          const editables = node.querySelectorAll(
            'input, textarea, [contenteditable="true"]'
          )

          if (editables.length > 0 || EditorDetector.isEditable(node)) {
            console.log('[SmartTextExpander] New editable element detected')
          }
        }
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return

  if ((event.data as any)?.type === 'SMART_TEXT_EXPANDER_RESPONSE') {
    console.log('[SmartTextExpander] MAIN world response:', event.data)
  }
})

;(window as any).__SmartTextExpander = {
  snippets: () => snippets,
  isEnabled: () => isEnabled,
  settings: () => settings,
  TypingStream,
  TextExpander,
  EditorDetector,
}
