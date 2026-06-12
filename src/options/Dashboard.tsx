import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Plus,
    Download,
    Upload,
    Settings,
    Zap,
    Folder,
    FolderOpen,
    Mail,
    Code,
    Briefcase,
    User,
    ChevronRight,
    Moon,
    Sun
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { SnippetEditor } from './components/SnippetEditor';
import { SnippetCard, EmptySnippets, NoResults } from '@/components/shared/SnippetCard';
import { SearchInput } from '@/components/ui/Input';
import { Button, IconButton } from '@/components/ui/Button';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import { useSnippetStore, useSettingsStore, useUIStore } from '@/stores';
import type { Snippet, Category } from '@/lib/types';
import { DEFAULT_CATEGORIES } from '@/lib/types';

export function Dashboard() {
    const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const {
        snippets,
        setSnippets,
        searchQuery,
        setSearchQuery,
        activeCategory,
        setActiveCategory,
        isLoading,
        setLoading
    } = useSnippetStore();

    const { settings, setSettings, isEnabled, setEnabled } = useSettingsStore();
    const { isDarkMode, setDarkMode } = useUIStore();
    const toast = useToast();

    // Load data on mount
    useEffect(() => {
        loadData();
        checkHashNavigation();
    }, []);

    const loadData = async () => {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SNIPPETS' });
            if (response?.snippets) {
                setSnippets(response.snippets);
            }

            const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            if (settingsResponse?.settings) {
                setSettings(settingsResponse.settings);
                setEnabled(settingsResponse.settings.enabled !== false);
            }
        } catch (error) {
            console.error('[Dashboard] Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Check URL hash for navigation (e.g., #edit/;hello)
    const checkHashNavigation = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#edit/')) {
            const shortcut = decodeURIComponent(hash.slice(6));
            const snippet = snippets[shortcut];
            if (snippet) {
                setEditingSnippet(snippet);
            }
        } else if (hash === '#new') {
            setIsCreating(true);
        }
    };

    // Filter snippets
    const filteredSnippets = React.useMemo(() => {
        let list = Object.values(snippets);

        // Filter by category
        if (activeCategory !== 'all') {
            list = list.filter(s => s.category === activeCategory);
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            list = list.filter(s =>
                s.shortcut.toLowerCase().includes(query) ||
                s.content.toLowerCase().includes(query) ||
                s.name?.toLowerCase().includes(query)
            );
        }

        // Sort by most recent
        return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [snippets, searchQuery, activeCategory]);

    // Category counts
    const categoryCounts = React.useMemo(() => {
        const counts: Record<string, number> = { all: Object.keys(snippets).length };
        Object.values(snippets).forEach(s => {
            if (s.category) {
                counts[s.category] = (counts[s.category] || 0) + 1;
            }
        });
        return counts;
    }, [snippets]);

    // Save snippet
    const handleSave = async (snippet: Snippet) => {
        try {
            await chrome.runtime.sendMessage({ type: 'SAVE_SNIPPET', payload: snippet });
            setSnippets({ ...snippets, [snippet.shortcut]: snippet });
            setEditingSnippet(null);
            setIsCreating(false);
            toast.success(`Saved "${snippet.shortcut}"`);
        } catch (error) {
            toast.error('Failed to save snippet');
        }
    };

    // Delete snippet
    const handleDelete = async (shortcut: string) => {
        const snippet = snippets[shortcut];
        try {
            await chrome.runtime.sendMessage({ type: 'DELETE_SNIPPET', payload: shortcut });
            const newSnippets = { ...snippets };
            delete newSnippets[shortcut];
            setSnippets(newSnippets);

            if (editingSnippet?.shortcut === shortcut) {
                setEditingSnippet(null);
            }

            toast.success(`Deleted "${shortcut}"`, {
                label: 'Undo',
                onClick: async () => {
                    await chrome.runtime.sendMessage({ type: 'SAVE_SNIPPET', payload: snippet });
                    setSnippets({ ...newSnippets, [shortcut]: snippet });
                }
            });
        } catch (error) {
            toast.error('Failed to delete snippet');
        }
    };

    // Import snippets
    const handleImport = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (data.snippets) {
                    await chrome.runtime.sendMessage({
                        type: 'IMPORT_SNIPPETS',
                        payload: { snippets: data.snippets, merge: true }
                    });
                    await loadData();
                    toast.success(`Imported ${Object.keys(data.snippets).length} snippets`);
                }
            } catch (error) {
                toast.error('Failed to import snippets');
            }
        };
        input.click();
    };

    // Export snippets
    const handleExport = async () => {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'EXPORT_SNIPPETS' });

            const blob = new Blob([response.data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `snippets-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            toast.success('Snippets exported successfully');
        } catch (error) {
            toast.error('Failed to export snippets');
        }
    };

    return (
        <div className="min-h-screen bg-surface-950 text-white">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-surface-950/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold">Smart Text Expander</h1>
                                <p className="text-xs text-white/50">Dashboard</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                leftIcon={<Upload className="w-4 h-4" />}
                                onClick={handleImport}
                            >
                                Import
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                leftIcon={<Download className="w-4 h-4" />}
                                onClick={handleExport}
                            >
                                Export
                            </Button>
                            <div className="w-px h-6 bg-white/10" />
                            <IconButton
                                icon={isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                label="Toggle theme"
                                onClick={() => setDarkMode(!isDarkMode)}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="flex gap-6">
                    {(editingSnippet || isCreating) ? (
                        <div className="w-full">
                            <SnippetEditor
                                snippet={isCreating ? undefined : editingSnippet || undefined}
                                onSave={handleSave}
                                onCancel={() => {
                                    setEditingSnippet(null);
                                    setIsCreating(false);
                                }}
                                onDelete={editingSnippet ? () => handleDelete(editingSnippet.shortcut) : undefined}
                            />
                        </div>
                    ) : (
                        <>
                            {/* Sidebar */}
                            <aside className="w-64 flex-shrink-0">
                                <Sidebar
                                    categories={DEFAULT_CATEGORIES}
                                    activeCategory={activeCategory}
                                    onCategoryChange={setActiveCategory}
                                    categoryCounts={categoryCounts}
                                />
                            </aside>

                            {/* Content area */}
                            <main className="flex-1 min-w-0">
                                {/* Toolbar */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="flex-1">
                                        <SearchInput
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onClear={() => setSearchQuery('')}
                                            placeholder="Search snippets..."
                                        />
                                    </div>
                                    <Button
                                        variant="primary"
                                        leftIcon={<Plus className="w-4 h-4" />}
                                        onClick={() => {
                                            setEditingSnippet(null);
                                            setIsCreating(true);
                                        }}
                                    >
                                        New Snippet
                                    </Button>
                                </div>

                                {/* Snippet List Only */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-sm font-medium text-white/70">
                                            {activeCategory === 'all' ? 'All Snippets' : DEFAULT_CATEGORIES.find(c => c.id === activeCategory)?.name}
                                        </h2>
                                        <span className="text-xs text-white/40">
                                            {filteredSnippets.length} snippets
                                        </span>
                                    </div>

                                    <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                                        {isLoading ? (
                                            <div className="flex items-center justify-center py-12">
                                                <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                                            </div>
                                        ) : filteredSnippets.length === 0 ? (
                                            searchQuery ? (
                                                <NoResults query={searchQuery} />
                                            ) : (
                                                <EmptySnippets onAdd={() => setIsCreating(true)} />
                                            )
                                        ) : (
                                            <AnimatePresence mode="popLayout">
                                                {filteredSnippets.map(snippet => (
                                                    <SnippetCard
                                                        key={snippet.shortcut}
                                                        shortcut={snippet.shortcut}
                                                        content={snippet.content}
                                                        name={snippet.name}
                                                        category={snippet.category}
                                                        isSelected={false}
                                                        onClick={() => {
                                                            setEditingSnippet(snippet);
                                                            setIsCreating(false);
                                                        }}
                                                        onEdit={() => {
                                                            setEditingSnippet(snippet);
                                                            setIsCreating(false);
                                                        }}
                                                        onDelete={() => handleDelete(snippet.shortcut)}
                                                    />
                                                ))}
                                            </AnimatePresence>
                                        )}
                                    </div>
                                </div>
                            </main>
                        </>
                    )}
                </div>
            </div>

            {/* Toast container */}
            <ToastContainer />
        </div>
    );
}
