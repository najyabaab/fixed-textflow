/**
 * Background Service Worker - Smart Text Expander
 * Handles messaging, storage, clipboard operations, and snippet evaluation
 */

// Import types
import type { Snippet, SnippetMap, Settings, Message } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';

// Clipboard cache for restoration
let clipboardCache: { text: string; html?: string } | null = null;

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[ServiceWorker] Installed:', details.reason);

    if (details.reason === 'install') {
        // Set default settings
        chrome.storage.sync.set({
            settings: DEFAULT_SETTINGS,
            snippets: {},
        });
    }
});

// Keep service worker alive via port connections
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'keepalive') {
        port.onMessage.addListener(() => {
            // Respond to keepalive pings
        });
    }
});

// Main message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
        .then(sendResponse)
        .catch((error) => {
            console.error('[ServiceWorker] Message error:', error);
            sendResponse({ error: error.message });
        });

    return true; // Keep channel open for async response
});

/**
 * Handle incoming messages
 */
async function handleMessage(message: Message, sender: chrome.runtime.MessageSender): Promise<unknown> {
    switch (message.type) {
        case 'GET_SNIPPETS':
            return { snippets: await getSnippets() };

        case 'GET_SNIPPET':
            return { snippet: await getSnippet(message.payload as string) };

        case 'SAVE_SNIPPET':
            return await saveSnippet(message.payload as Snippet);

        case 'DELETE_SNIPPET':
            return await deleteSnippet(message.payload as string);

        case 'GET_SETTINGS':
            return { settings: await getSettings() };

        case 'SAVE_SETTINGS':
            return await saveSettings(message.payload as Partial<Settings>);

        case 'TOGGLE_ENABLED':
            return await toggleEnabled(message.payload as boolean);

        case 'EXPAND_SNIPPET':
            return await expandSnippet(
                (message.payload as { shortcut: string; context: Record<string, string> }).shortcut,
                (message.payload as { shortcut: string; context: Record<string, string> }).context,
                sender.tab
            );

        case 'SET_CLIPBOARD':
            return await setClipboard(message.payload as { text: string; html?: string });

        case 'RESTORE_CLIPBOARD':
            return await restoreClipboard();

        case 'GET_CLIPBOARD':
            return { text: await getClipboardText() };

        case 'INJECT_REMAPPER':
            if (sender.tab?.id) {
                return await injectRemapper(sender.tab.id);
            }
            return { error: 'No tab ID' };

        case 'IMPORT_SNIPPETS':
            const { snippets: newSnippets, merge } = message.payload as {
                snippets: SnippetMap;
                merge: boolean
            };
            return await importSnippets(newSnippets, merge);

        case 'EXPORT_SNIPPETS':
            return { data: await exportSnippets() };

        default:
            return { error: 'Unknown message type' };
    }
}

// ============ Storage Operations ============

async function getSnippets(): Promise<SnippetMap> {
    try {
        const result = await chrome.storage.sync.get('snippets');
        return result.snippets || {};
    } catch {
        const localResult = await chrome.storage.local.get('snippets');
        return localResult.snippets || {};
    }
}

async function getSnippet(shortcut: string): Promise<Snippet | null> {
    const snippets = await getSnippets();
    return snippets[shortcut] || null;
}

async function saveSnippet(snippet: Snippet): Promise<{ success: boolean }> {
    const snippets = await getSnippets();

    snippet.updatedAt = Date.now();
    if (!snippet.createdAt) {
        snippet.createdAt = Date.now();
    }

    // Generate unique ID for new snippets
    if (!snippet.id) {
        snippet.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    snippets[snippet.shortcut] = snippet;

    try {
        await chrome.storage.sync.set({ snippets });
    } catch {
        await chrome.storage.local.set({ snippets });
    }

    broadcastToTabs({ type: 'SNIPPETS_UPDATED', payload: snippets });
    return { success: true };
}

async function deleteSnippet(shortcut: string): Promise<{ success: boolean }> {
    const snippets = await getSnippets();
    delete snippets[shortcut];

    try {
        await chrome.storage.sync.set({ snippets });
    } catch {
        await chrome.storage.local.set({ snippets });
    }

    broadcastToTabs({ type: 'SNIPPETS_UPDATED', payload: snippets });
    return { success: true };
}

async function getSettings(): Promise<Settings> {
    const result = await chrome.storage.sync.get('settings');
    return { ...DEFAULT_SETTINGS, ...result.settings };
}

async function saveSettings(updates: Partial<Settings>): Promise<{ success: boolean }> {
    const current = await getSettings();
    const updated = { ...current, ...updates };
    await chrome.storage.sync.set({ settings: updated });
    broadcastToTabs({ type: 'SETTINGS_UPDATED', payload: updated });
    return { success: true };
}

async function toggleEnabled(enabled: boolean): Promise<{ success: boolean }> {
    await chrome.storage.local.set({ enabled });
    broadcastToTabs({ type: 'TOGGLE_ENABLED', payload: enabled });
    return { success: true };
}

async function importSnippets(newSnippets: SnippetMap, merge: boolean): Promise<{ count: number }> {
    let snippets = merge ? await getSnippets() : {};
    const now = Date.now();
    let count = 0;

    for (const [shortcut, snippet] of Object.entries(newSnippets)) {
        snippets[shortcut] = {
            ...snippet,
            shortcut,
            createdAt: snippet.createdAt || now,
            updatedAt: now,
        };
        count++;
    }

    try {
        await chrome.storage.sync.set({ snippets });
    } catch {
        await chrome.storage.local.set({ snippets });
    }

    broadcastToTabs({ type: 'SNIPPETS_UPDATED', payload: snippets });
    return { count };
}

async function exportSnippets(): Promise<string> {
    const snippets = await getSnippets();
    const settings = await getSettings();

    return JSON.stringify({
        version: '3.0.0',
        exportedAt: new Date().toISOString(),
        snippets,
        settings,
    }, null, 2);
}

// ============ Snippet Expansion ============

async function expandSnippet(
    shortcut: string,
    context: Record<string, string>,
    tab?: chrome.tabs.Tab
): Promise<{ expanded: string }> {
    const snippet = await getSnippet(shortcut);
    if (!snippet) {
        return { expanded: '' };
    }

    let content = snippet.content;

    // Process built-in variables
    const now = new Date();

    const replacements: Record<string, string> = {
        '{date}': formatDate(now, 'YYYY-MM-DD'),
        '{time}': formatDate(now, 'HH:mm'),
        '{datetime}': formatDate(now, 'YYYY-MM-DD HH:mm'),
        '{url}': context.url || tab?.url || '',
        '{title}': context.title || tab?.title || '',
        '{clipboard}': await getClipboardText(),
        '{selection}': context.selection || '',
    };

    for (const [pattern, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(escapeRegex(pattern), 'gi'), value);
    }

    // Handle date format patterns like {date:YYYY/MM/DD}
    content = content.replace(/\{date:([^}]+)\}/gi, (_, format) => formatDate(now, format));

    return { expanded: content };
}

// ============ Clipboard Operations ============

async function setClipboard(data: { text: string; html?: string }): Promise<{ success: boolean }> {
    // Cache current clipboard first
    try {
        clipboardCache = {
            text: await getClipboardText(),
        };
    } catch {
        clipboardCache = null;
    }

    // Set new clipboard content
    await writeToClipboard(data.text, data.html);
    return { success: true };
}

async function restoreClipboard(): Promise<{ success: boolean }> {
    if (clipboardCache) {
        await writeToClipboard(clipboardCache.text);
        clipboardCache = null;
    }
    return { success: true };
}

async function getClipboardText(): Promise<string> {
    try {
        // Ensure offscreen document exists
        await ensureOffscreenDocument();

        // Request clipboard read from offscreen document
        const response = await chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'READ_CLIPBOARD',
        });

        return response?.text || '';
    } catch (error) {
        console.warn('[ServiceWorker] Clipboard read failed:', error);
        return '';
    }
}

async function writeToClipboard(text: string, html?: string): Promise<void> {
    // Use offscreen document for clipboard write
    try {
        await ensureOffscreenDocument();
        await chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'WRITE_CLIPBOARD',
            data: { text, html },
        });
    } catch {
        console.warn('[ServiceWorker] Clipboard write failed');
    }
}

async function ensureOffscreenDocument(): Promise<void> {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT as any],
    });

    if (existingContexts.length > 0) {
        return;
    }

    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: [chrome.offscreen.Reason.CLIPBOARD as any],
            justification: 'Clipboard access for text expansion',
        });
    } catch {
        // Document might already exist
    }
}

// ============ Script Injection ============

async function injectRemapper(tabId: number): Promise<{ success: boolean }> {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            files: ['src/content/paste-helper.ts'],
        });
        return { success: true };
    } catch (error) {
        console.error('[ServiceWorker] Remapper injection failed:', error);
        return { success: false };
    }
}

// ============ Utilities ============

function broadcastToTabs(message: { type: string; payload: unknown }): void {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {
                    // Tab might not have content script
                });
            }
        });
    });
}

function formatDate(date: Date, format: string): string {
    const pad = (n: number) => n.toString().padStart(2, '0');

    const replacements: Record<string, string> = {
        'YYYY': date.getFullYear().toString(),
        'YY': date.getFullYear().toString().slice(-2),
        'MM': pad(date.getMonth() + 1),
        'M': (date.getMonth() + 1).toString(),
        'DD': pad(date.getDate()),
        'D': date.getDate().toString(),
        'HH': pad(date.getHours()),
        'H': date.getHours().toString(),
        'hh': pad(date.getHours() % 12 || 12),
        'h': (date.getHours() % 12 || 12).toString(),
        'mm': pad(date.getMinutes()),
        'm': date.getMinutes().toString(),
        'ss': pad(date.getSeconds()),
        's': date.getSeconds().toString(),
        'A': date.getHours() >= 12 ? 'PM' : 'AM',
        'a': date.getHours() >= 12 ? 'pm' : 'am',
    };

    return Object.entries(replacements).reduce(
        (result, [pattern, replacement]) => result.replace(pattern, replacement),
        format
    );
}

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log('[SmartTextExpander] Background service worker initialized');
