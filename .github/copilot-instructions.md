# AI Coding Guidelines for TextFlow - Smart Text Expander

## Overview
TextFlow is a Chrome extension (Manifest V3) that enables text snippet expansion with dynamic commands, variable substitution, and editor detection. It uses Vite + React for UI and modular TypeScript for content/background scripts.

## Architecture & Data Flow

### Three-Layer Extension Architecture
1. **Background Service Worker** (`src/background/service-worker.ts`): Message router, clipboard handler, snippet/settings storage manager
2. **Content Script** (`src/content/content.ts`): Typing stream detector, editor detection, text insertion orchestrator
3. **UI Layers**: Popup (`src/popup/`) and Options/Dashboard (`src/options/`) for snippet management

### Text Expansion Pipeline
1. **TypingStream** (`src/content/modules/typingStream.ts`) — Captures keystrokes and detects shortcut patterns
2. **EditorDetector** (`src/content/modules/editorDetector.ts`) — Identifies editor type (input, textarea, contenteditable, Google Docs, Notion, Slack)
3. **TextExpander** (`src/content/modules/textExpander.ts`) — Routes insertion (clipboard vs. direct) based on editor constraints
4. **CursorManager** (`src/content/modules/cursorManager.ts`) — Positions cursor at `{|}` placeholders after insertion

**Key insight**: Different editors require different insertion strategies—clipboard for Google Docs, direct DOM manipulation for inputs, clipboard/mutation for contenteditable.

### State Management
- **Zustand stores** (`src/stores/index.ts`): `useSnippetStore`, `useSettingsStore`, `useUIStore` for client-side UI state
- **Chrome Storage API** (`src/lib/storage.ts`): Dual-layer (sync → local fallback) for snippets and settings, broadcast messages to sync tabs
- **Type-safe contracts**: All data shaped by `Snippet`, `Settings`, `EditorData`, `Message` interfaces in `src/lib/types.ts`

## Build & Development

### Essential Commands
- `npm run dev` — Vite dev server (HMR on port 5173)
- `npm run build` — Type-check + Vite bundle (output: `dist/`)
- `npm run lint` — ESLint strict mode (no warnings allowed)

### Vite + CRX Build
- **CRX plugin** auto-generates `dist/manifest.json` from `src/manifest.ts`
- **Entry points**: `popup.html`, `options.html` (defined in `vite.config.ts`)
- **HMR caveat**: Content scripts don't hot-reload; requires extension reload in Chrome

## Project-Specific Patterns

### 1. Message Protocol
All cross-boundary communication uses a structured message format:
```typescript
// In background worker
type Message = { type: 'GET_SNIPPETS' | 'SAVE_SNIPPET' | ...; payload?: any }
// Always `sendResponse({ error? | data })` and return `true` to keep channel open
```
**Convention**: Prefix console logs with scope `[ServiceWorker]`, `[ContentScript]`, `[TypingStream]` for debugging.

### 2. Editor-Aware Insertion
Three insertion methods determined by `EditorDetector.getEditorData()`:
- **Standard (`<input>`, `<textarea>`)**: Direct DOM manipulation
- **ContentEditable + Google Docs**: Clipboard + special handling (paste event tricks, mutation observation)
- **IME-safe**: Debounce detects IME composition, skip premature triggers

See `src/content/modules/textExpander.ts` — expansion routes via `insertViaClipboard()`, `insertInStandardInput()`, `insertInContentEditable()`.

### 3. Storage Fallback Strategy
Chrome sync storage has 100KB limit per item; code automatically falls back to local storage:
```typescript
try {
    await chrome.storage.sync.set({ snippets });
} catch {
    await chrome.storage.local.set({ snippets }); // fallback
}
```
**Important**: Always broadcast updates (`storage.broadcastUpdate()`) to keep popup/options in sync.

### 4. Component Structure
- **Shared components** (`src/components/shared/`): `SnippetCard`, `EmptySnippets` — reused in popup + options
- **UI atoms** (`src/components/ui/`): `Button`, `Input`, `Toast` — styled with Tailwind, use Framer Motion for animations
- **Page containers**: `Dashboard.tsx` (options), `Popup.tsx` (action popup) — orchestrate store + messaging

### 5. TypeScript & Paths
- **Path alias** `@/` → `src/` configured in `tsconfig.json` and `vite.config.ts`
- **Strict mode enabled**: No implicit `any`, unused params flagged
- **Chrome types**: `@types/chrome` provides intellisense for extension APIs

## Common Development Tasks

### Adding a New Snippet Feature
1. Update `Snippet` interface in `src/lib/types.ts`
2. Add storage/retrieval logic in `src/lib/storage.ts`
3. Update message handler in `src/background/service-worker.ts`
4. Modify `SnippetEditor.tsx` UI in `src/options/components/`
5. Test in options page + popup simultaneously

### Supporting a New Editor Type
1. Add detection case in `EditorDetector.getEditorData()` (check hostname, class patterns)
2. Test insertion method preference in `TextExpander.expand()`
3. Verify cursor positioning works with `CursorManager.moveCursor()`
4. Add test case documenting the detection logic

### Debugging Content Script Issues
- Content script logs prefix: `[SmartTextExpander]`
- Use Chrome DevTools on target page (right-click → Inspect)
- Watch `TypingStream.stream` array to verify keystroke capture
- Check `EditorDetector.getEditorData(element)` output to confirm editor type detection

## Testing & Quality

- **Linting**: Must pass ESLint (strict, no unused vars/params)
- **Manual testing**: Install dev build via `chrome://extensions` (Developer mode), test on diverse sites (Gmail, Notion, Slack, etc.)
- **CONNECTIVITY-REPORT.md**: Documents known integration issues with specific services

---

**Last updated**: Based on v3.0.0 architecture. Extension runs on all URLs (`<all_urls>` host permission).
