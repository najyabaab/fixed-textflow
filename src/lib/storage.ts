import type { Snippet, SnippetMap, Settings, DEFAULT_SETTINGS } from './types';

// Chrome storage API wrapper
export const storage = {
    // Get all snippets
    async getSnippets(): Promise<SnippetMap> {
        try {
            const result = await chrome.storage.sync.get('snippets');
            return result.snippets || {};
        } catch (error) {
            console.error('[Storage] Error getting snippets:', error);
            // Fallback to local storage for large data
            const localResult = await chrome.storage.local.get('snippets');
            return localResult.snippets || {};
        }
    },

    // Get single snippet
    async getSnippet(shortcut: string): Promise<Snippet | null> {
        const snippets = await this.getSnippets();
        return snippets[shortcut] || null;
    },

    // Save snippet
    async saveSnippet(snippet: Snippet): Promise<void> {
        const snippets = await this.getSnippets();

        // Add timestamps
        const now = Date.now();
        snippet.updatedAt = now;
        if (!snippet.createdAt) {
            snippet.createdAt = now;
        }

        snippets[snippet.shortcut] = snippet;

        try {
            await chrome.storage.sync.set({ snippets });
        } catch (error) {
            // If sync storage is full, use local storage
            console.warn('[Storage] Sync storage full, using local storage');
            await chrome.storage.local.set({ snippets });
        }

        // Broadcast update to all tabs
        this.broadcastUpdate('SNIPPETS_UPDATED', snippets);
    },

    // Delete snippet
    async deleteSnippet(shortcut: string): Promise<void> {
        const snippets = await this.getSnippets();
        delete snippets[shortcut];

        try {
            await chrome.storage.sync.set({ snippets });
        } catch {
            await chrome.storage.local.set({ snippets });
        }

        this.broadcastUpdate('SNIPPETS_UPDATED', snippets);
    },

    // Get settings
    async getSettings(): Promise<Settings> {
        const result = await chrome.storage.sync.get('settings');
        return { ...DEFAULT_SETTINGS, ...result.settings };
    },

    // Save settings
    async saveSettings(settings: Partial<Settings>): Promise<void> {
        const current = await this.getSettings();
        const updated = { ...current, ...settings };
        await chrome.storage.sync.set({ settings: updated });
        this.broadcastUpdate('SETTINGS_UPDATED', updated);
    },

    // Get enabled state
    async getEnabled(): Promise<boolean> {
        const result = await chrome.storage.local.get('enabled');
        return result.enabled !== false; // Default to true
    },

    // Set enabled state
    async setEnabled(enabled: boolean): Promise<void> {
        await chrome.storage.local.set({ enabled });
        this.broadcastUpdate('TOGGLE_ENABLED', enabled);
    },

    // Import snippets
    async importSnippets(newSnippets: SnippetMap, merge = true): Promise<number> {
        let snippets = merge ? await this.getSnippets() : {};
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

        this.broadcastUpdate('SNIPPETS_UPDATED', snippets);
        return count;
    },

    // Export snippets
    async exportSnippets(): Promise<string> {
        const snippets = await this.getSnippets();
        const settings = await this.getSettings();

        return JSON.stringify({
            version: '3.0.0',
            exportedAt: new Date().toISOString(),
            snippets,
            settings,
        }, null, 2);
    },

    // Broadcast update to all tabs
    broadcastUpdate(type: string, payload: unknown): void {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
                if (tab.id) {
                    chrome.tabs.sendMessage(tab.id, { type, payload }).catch(() => {
                        // Tab might not have content script
                    });
                }
            });
        });
    },

    // =========================================
    // STORAGE QUOTA MONITORING
    // =========================================

    /**
     * Get current storage usage statistics
     * Returns bytes used, total quota, and percentage
     */
    async getStorageUsage(): Promise<{ used: number, quota: number, percentage: number, warning: string | null }> {
        try {
            const used = await chrome.storage.sync.getBytesInUse();
            const quota = chrome.storage.sync.QUOTA_BYTES || 102400; // ~100KB default
            const percentage = (used / quota) * 100;

            let warning: string | null = null;
            if (percentage >= 90) {
                warning = 'critical'; // 90%+ - urgent action needed
            } else if (percentage >= 75) {
                warning = 'warning';  // 75-90% - approaching limit
            }

            return { used, quota, percentage, warning };
        } catch (error) {
            console.error('[Storage] Error getting usage:', error);
            return { used: 0, quota: 102400, percentage: 0, warning: null };
        }
    },

    /**
     * Check if storage is approaching quota
     * Returns warning level or null if OK
     */
    async checkStorageWarning(): Promise<string | null> {
        const { warning } = await this.getStorageUsage();
        return warning;
    },

    /**
     * Get human-readable storage usage string
     */
    async getStorageUsageDisplay(): Promise<string> {
        const { used, quota, percentage } = await this.getStorageUsage();
        const usedKB = (used / 1024).toFixed(1);
        const quotaKB = (quota / 1024).toFixed(0);
        return `${usedKB}KB / ${quotaKB}KB (${percentage.toFixed(1)}%)`;
    },
};

// Helper to generate unique ID
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to escape HTML
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper to truncate text
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

// Helper to format relative time
export function formatRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return new Date(timestamp).toLocaleDateString();
}
