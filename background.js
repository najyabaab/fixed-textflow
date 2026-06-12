/**
 * Background Service Worker - Smart Text Expander
 */

// Default settings
const DEFAULT_SETTINGS = {
    enabled: true,
    triggerKey: 'any',      // Expansion trigger: any, space, tab, none
    showPreview: true,
    soundEnabled: false,
    syncEnabled: true,
    // Appearance settings
    theme: 'dark',          // dark, light, system
    fontSize: 'medium',     // small, medium, large
    compactMode: false,
    // Snippet settings
    caseSensitive: false,
    // Variable formats
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',      // 24h, 12h
};

// Keep service worker alive
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[ServiceWorker] Installed:', details.reason);

    if (details.reason === 'install') {
        chrome.storage.sync.set({
            settings: DEFAULT_SETTINGS,
            snippets: {},
        });
    }
});

// Handle keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command) => {
    console.log('[ServiceWorker] Command received:', command);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    switch (command) {
        case 'toggle-omnibar':
            // Send message to content script to toggle omnibar
            chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OMNIBAR' }).catch(() => { });
            break;
    }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
        .then(sendResponse)
        .catch((error) => {
            console.error('[ServiceWorker] Error:', error);
            sendResponse({ error: error.message });
        });
    return true;
});

async function handleMessage(message, sender) {
    switch (message.type) {
        case 'GET_SNIPPETS':
            return { snippets: await getSnippets() };

        case 'GET_SNIPPET':
            return { snippet: await getSnippet(message.payload) };

        case 'SAVE_SNIPPET':
            return await saveSnippet(message.payload);

        case 'DELETE_SNIPPET':
            return await deleteSnippet(message.payload);

        case 'GET_SETTINGS':
            return { settings: await getSettings() };

        case 'SAVE_SETTINGS':
            return await saveSettings(message.payload);

        case 'TOGGLE_ENABLED':
            return await toggleEnabled(message.payload);

        case 'EXPAND_SNIPPET':
            return await expandSnippet(
                message.payload.shortcut,
                message.payload.context,
                sender.tab
            );

        case 'IMPORT_SNIPPETS':
            return await importSnippets(message.payload.snippets, message.payload.merge);

        case 'EXPORT_SNIPPETS':
            return { data: await exportSnippets() };

        case 'INCREMENT_USAGE':
            return await incrementSnippetUsage(message.payload.shortcut);

        case 'OPEN_OPTIONS':
            chrome.runtime.openOptionsPage();
            return { success: true };

        case 'EXTRACT_SITE_DATA':
            return await extractSiteData(message.payload);

        case 'MIGRATE_STORAGE':
            return await migrateStorage(message.payload.toSync);

        default:
            return { error: 'Unknown message type' };
    }
}

// Site Data Extraction
async function extractSiteData(payload) {
    const { selector, attribute, pagePattern, multiple, selectValue, group } = payload;

    // 1. Find matching tabs
    const regex = globToRegex(pagePattern);
    const tabs = await chrome.tabs.query({});
    const matches = tabs.filter(tab => tab.url && regex.test(tab.url));

    if (matches.length === 0) {
        return { error: 'No matching tabs found', value: '' };
    }

    // 2. Select target tab
    let targetTab = matches[0];

    // Prefer active tab if it matches
    const activeMatch = matches.find(t => t.active);
    if (activeMatch) {
        targetTab = activeMatch;
    }

    // Logic for 'select' parameter (placeholder for UI picker)
    if (matches.length > 1 && (selectValue === 'yes' || selectValue === 'ifneeded')) {
        // TODO: Implement tab picker UI
        // For now, we default to the most likely candidate (active or first)
        console.log('[TextFlow] Multiple tabs match, defaulting to:', targetTab.title);
    }

    // 3. Execute extraction in target tab
    try {
        const result = await chrome.tabs.sendMessage(targetTab.id, {
            type: 'EXTRACT_ELEMENTS',
            payload: {
                selector,
                attribute,
                multiple,
                trim: payload.trim
            }
        });

        return result.value || '';

    } catch (e) {
        console.log('[TextFlow] Extraction failed, attempting script injection...', e);

        try {
            await chrome.scripting.executeScript({
                target: { tabId: targetTab.id },
                files: [
                    'commands/parser.js',
                    'commands/executor.js',
                    'element-picker.js',
                    'content.js'
                ]
            });

            // Wait a moment for script to init
            await new Promise(r => setTimeout(r, 100));

            // Retry sending message
            const result = await chrome.tabs.sendMessage(targetTab.id, {
                type: 'EXTRACT_ELEMENTS',
                payload: {
                    selector,
                    attribute,
                    multiple,
                    trim: payload.trim
                }
            });

            return result.value || '';

        } catch (retryError) {
            console.error('[TextFlow] Injection and retry failed:', retryError);
            return '';
        }
    }
}

function globToRegex(glob) {
    // Escape special regex chars except *
    const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Convert * to .*
    const pattern = escaped.replace(/\*/g, '.*');
    // Anchor to start/end for full matching if distinct, otherwise loose
    // The user example *gmail.com* implies loose matching allowed
    return new RegExp(`^${pattern}$`, 'i');
}

// Storage operations
// Helper to get the right storage based on syncEnabled setting
async function getSnippetStorage() {
    const result = await chrome.storage.sync.get('settings');
    const settings = { ...DEFAULT_SETTINGS, ...result.settings };
    return settings.syncEnabled ? chrome.storage.sync : chrome.storage.local;
}

async function getSnippets() {
    const storage = await getSnippetStorage();
    try {
        const result = await storage.get('snippets');
        return result.snippets || {};
    } catch {
        // Fallback to local if sync fails
        const localResult = await chrome.storage.local.get('snippets');
        return localResult.snippets || {};
    }
}

async function getSnippet(shortcut) {
    const snippets = await getSnippets();
    return snippets[shortcut] || null;
}

async function saveSnippet(snippet) {
    const storage = await getSnippetStorage();
    const snippets = await getSnippets();
    snippet.updatedAt = Date.now();
    if (!snippet.createdAt) snippet.createdAt = Date.now();

    // Calculate snippet size for quota checking
    const snippetJson = JSON.stringify(snippet);
    const snippetSize = new Blob([snippetJson]).size;

    // Chrome sync storage limits: 8KB per item, 100KB total for sync
    const SYNC_ITEM_LIMIT = 8192;
    const SYNC_TOTAL_LIMIT = 102400;
    const LOCAL_TOTAL_LIMIT = 5242880; // 5MB for local

    if (snippetSize > SYNC_ITEM_LIMIT) {
        console.warn(`[TextFlow] Snippet "${snippet.shortcut}" exceeds 8KB limit (${(snippetSize / 1024).toFixed(1)}KB)`);
        // Fall back to local storage for large snippets
        const localSnippets = (await chrome.storage.local.get('largeSnippets')).largeSnippets || {};
        localSnippets[snippet.shortcut] = snippet;
        await chrome.storage.local.set({ largeSnippets: localSnippets });
        broadcastToTabs({ type: 'SNIPPETS_UPDATED', payload: { ...snippets, ...localSnippets } });
        return { success: true, warning: 'Snippet stored locally due to size' };
    }

    snippets[snippet.shortcut] = snippet;

    // Check total storage size
    const totalSnippetsJson = JSON.stringify(snippets);
    const totalSize = new Blob([totalSnippetsJson]).size;
    const isSyncStorage = storage === chrome.storage.sync;
    const quotaLimit = isSyncStorage ? SYNC_TOTAL_LIMIT : LOCAL_TOTAL_LIMIT;

    // Warn if approaching limit (above 80%)
    if (totalSize > quotaLimit * 0.8) {
        console.warn(`[TextFlow] Storage usage: ${(totalSize / quotaLimit * 100).toFixed(1)}% of ${isSyncStorage ? 'sync' : 'local'} quota`);
    }

    // Reject if over limit
    if (totalSize > quotaLimit) {
        return {
            success: false,
            error: `Storage quota exceeded. Delete unused snippets or ${isSyncStorage ? 'disable sync in settings' : 'export and clear data'}.`
        };
    }

    try {
        await storage.set({ snippets });
    } catch (e) {
        console.error('[TextFlow] Storage error, falling back to local:', e);
        await chrome.storage.local.set({ snippets });
    }

    broadcastToTabs({ type: 'SNIPPETS_UPDATED', payload: snippets });
    return { success: true };
}

async function deleteSnippet(shortcut) {
    const storage = await getSnippetStorage();
    const snippets = await getSnippets();
    delete snippets[shortcut];

    try {
        await storage.set({ snippets });
    } catch {
        await chrome.storage.local.set({ snippets });
    }

    broadcastToTabs({ type: 'SNIPPETS_UPDATED', payload: snippets });
    return { success: true };
}

async function getSettings() {
    const result = await chrome.storage.sync.get('settings');
    return { ...DEFAULT_SETTINGS, ...result.settings };
}

async function saveSettings(updates) {
    const current = await getSettings();
    const updated = { ...current, ...updates };
    await chrome.storage.sync.set({ settings: updated });
    broadcastToTabs({ type: 'SETTINGS_UPDATED', payload: updated });
    return { success: true };
}

async function toggleEnabled(enabled) {
    await chrome.storage.local.set({ enabled });
    broadcastToTabs({ type: 'TOGGLE_ENABLED', payload: enabled });
    return { success: true };
}

async function incrementSnippetUsage(shortcut) {
    const storage = await getSnippetStorage();
    const snippets = await getSnippets();
    if (snippets[shortcut]) {
        snippets[shortcut].usageCount = (snippets[shortcut].usageCount || 0) + 1;
        snippets[shortcut].lastUsed = Date.now();
        try {
            await storage.set({ snippets });
        } catch {
            await chrome.storage.local.set({ snippets });
        }
    }
    return { success: true };
}

async function importSnippets(newSnippets, merge) {
    const storage = await getSnippetStorage();
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
        await storage.set({ snippets });
    } catch {
        await chrome.storage.local.set({ snippets });
    }

    broadcastToTabs({ type: 'SNIPPETS_UPDATED', payload: snippets });
    return { count };
}

// Migrate snippets between local and sync storage
async function migrateStorage(toSync) {
    const source = toSync ? chrome.storage.local : chrome.storage.sync;
    const dest = toSync ? chrome.storage.sync : chrome.storage.local;

    try {
        const { snippets } = await source.get('snippets');
        if (snippets && Object.keys(snippets).length > 0) {
            await dest.set({ snippets });
            console.log('[TextFlow] Migrated', Object.keys(snippets).length, 'snippets to', toSync ? 'sync' : 'local');
        }
        return { success: true, count: snippets ? Object.keys(snippets).length : 0 };
    } catch (error) {
        console.error('[TextFlow] Migration failed:', error);
        return { success: false, error: error.message };
    }
}

async function exportSnippets() {
    const snippets = await getSnippets();
    const settings = await getSettings();

    return JSON.stringify({
        version: '3.0.0',
        exportedAt: new Date().toISOString(),
        snippets,
        settings,
    }, null, 2);
}

// Snippet expansion with variables
async function expandSnippet(shortcut, context, tab) {
    const snippet = await getSnippet(shortcut);
    if (!snippet) return { expanded: '' };

    let content = snippet.content;
    const now = new Date();

    const replacements = {
        '{date}': formatDate(now, 'YYYY-MM-DD'),
        '{time}': formatDate(now, 'HH:mm'),
        '{datetime}': formatDate(now, 'YYYY-MM-DD HH:mm'),
        '{url}': context.url || tab?.url || '',
        '{title}': context.title || tab?.title || '',
        '{selection}': context.selection || '',
    };

    for (const [pattern, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(escapeRegex(pattern), 'gi'), value);
    }

    // Custom date formats
    content = content.replace(/\{date:([^}]+)\}/gi, (_, format) => formatDate(now, format));

    return { expanded: content };
}

// Utilities
function broadcastToTabs(message) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, message).catch(() => { });
            }
        });
    });
}

function formatDate(date, format) {
    const pad = (n) => n.toString().padStart(2, '0');

    const replacements = {
        'YYYY': date.getFullYear().toString(),
        'YY': date.getFullYear().toString().slice(-2),
        'MM': pad(date.getMonth() + 1),
        'DD': pad(date.getDate()),
        'HH': pad(date.getHours()),
        'mm': pad(date.getMinutes()),
        'ss': pad(date.getSeconds()),
    };

    return Object.entries(replacements).reduce(
        (result, [pattern, replacement]) => result.replace(pattern, replacement),
        format
    );
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log('[SmartTextExpander] Background service worker initialized');
