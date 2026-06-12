import { create } from 'zustand';
import type { Snippet, SnippetMap, Settings, Toast } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';

// Snippet Store
interface SnippetState {
    snippets: SnippetMap;
    isLoading: boolean;
    selectedShortcut: string | null;
    searchQuery: string;
    activeCategory: string;

    // Actions
    setSnippets: (snippets: SnippetMap) => void;
    setLoading: (loading: boolean) => void;
    setSelectedShortcut: (shortcut: string | null) => void;
    setSearchQuery: (query: string) => void;
    setActiveCategory: (category: string) => void;
    addSnippet: (snippet: Snippet) => void;
    updateSnippet: (shortcut: string, updates: Partial<Snippet>) => void;
    deleteSnippet: (shortcut: string) => void;

    // Computed
    getFilteredSnippets: () => Snippet[];
}

export const useSnippetStore = create<SnippetState>((set, get) => ({
    snippets: {},
    isLoading: true,
    selectedShortcut: null,
    searchQuery: '',
    activeCategory: 'all',

    setSnippets: (snippets) => set({ snippets }),
    setLoading: (isLoading) => set({ isLoading }),
    setSelectedShortcut: (selectedShortcut) => set({ selectedShortcut }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setActiveCategory: (activeCategory) => set({ activeCategory }),

    addSnippet: (snippet) => set((state) => ({
        snippets: { ...state.snippets, [snippet.shortcut]: snippet }
    })),

    updateSnippet: (shortcut, updates) => set((state) => ({
        snippets: {
            ...state.snippets,
            [shortcut]: { ...state.snippets[shortcut], ...updates }
        }
    })),

    deleteSnippet: (shortcut) => set((state) => {
        const { [shortcut]: _, ...rest } = state.snippets;
        return {
            snippets: rest,
            selectedShortcut: state.selectedShortcut === shortcut ? null : state.selectedShortcut
        };
    }),

    getFilteredSnippets: () => {
        const { snippets, searchQuery, activeCategory } = get();
        let filtered = Object.values(snippets);

        // Filter by category
        if (activeCategory !== 'all') {
            filtered = filtered.filter(s => s.category === activeCategory);
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(s =>
                s.shortcut.toLowerCase().includes(query) ||
                s.content.toLowerCase().includes(query) ||
                s.name?.toLowerCase().includes(query)
            );
        }

        // Sort by most recent
        return filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },
}));

// Settings Store
interface SettingsState {
    settings: Settings;
    isEnabled: boolean;

    setSettings: (settings: Settings) => void;
    updateSettings: (updates: Partial<Settings>) => void;
    setEnabled: (enabled: boolean) => void;
    toggleEnabled: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    settings: DEFAULT_SETTINGS,
    isEnabled: true,

    setSettings: (settings) => set({ settings }),
    updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
    })),
    setEnabled: (isEnabled) => set({ isEnabled }),
    toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),
}));

// Toast Store
interface ToastState {
    toasts: Toast[];

    addToast: (toast: Omit<Toast, 'id'>) => string;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],

    addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
            toasts: [...state.toasts, { ...toast, id }]
        }));

        // Auto-remove after duration
        const duration = toast.duration ?? 3000;
        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter(t => t.id !== id)
                }));
            }, duration);
        }

        return id;
    },

    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
    })),

    clearToasts: () => set({ toasts: [] }),
}));

// UI Store for modals, sidebars, etc.
interface UIState {
    isSidebarOpen: boolean;
    isEditorOpen: boolean;
    isDarkMode: boolean;

    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    setEditorOpen: (open: boolean) => void;
    setDarkMode: (dark: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    isSidebarOpen: true,
    isEditorOpen: false,
    isDarkMode: true,

    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
    setEditorOpen: (isEditorOpen) => set({ isEditorOpen }),
    setDarkMode: (isDarkMode) => set({ isDarkMode }),
}));
