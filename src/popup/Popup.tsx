import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Settings,
    Plus,
    Zap,
    ExternalLink,
    Power,
    Search,
    Command,
    ArrowUp,
    ArrowDown,
    CornerDownLeft
} from 'lucide-react';
import { SnippetCard, EmptySnippets, NoResults } from '@/components/shared/SnippetCard';
import { SearchInput } from '@/components/ui/Input';
import { Button, IconButton } from '@/components/ui/Button';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import { useSnippetStore, useSettingsStore } from '@/stores';
import { copyToClipboard, truncate } from '@/lib/utils';
import type { Snippet } from '@/lib/types';

export function Popup() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const { snippets, setSnippets, setLoading, isLoading } = useSnippetStore();
    const { isEnabled, setEnabled } = useSettingsStore();
    const toast = useToast();

    // Load snippets on mount
    useEffect(() => {
        loadData();
        // Focus search input immediately
        searchInputRef.current?.focus();
    }, []);

    const loadData = async () => {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SNIPPETS' });
            if (response?.snippets) {
                setSnippets(response.snippets);
            }

            const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            if (settingsResponse?.settings) {
                setEnabled(settingsResponse.settings.enabled !== false);
            }
        } catch (error) {
            console.error('[Popup] Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter snippets based on search
    const filteredSnippets = React.useMemo(() => {
        const snippetList = Object.values(snippets);

        if (!searchQuery) {
            return snippetList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        }

        const query = searchQuery.toLowerCase();
        return snippetList
            .filter(s =>
                s.shortcut.toLowerCase().includes(query) ||
                s.content.toLowerCase().includes(query) ||
                s.name?.toLowerCase().includes(query)
            )
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [snippets, searchQuery]);

    // Reset selection when filtered list changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [filteredSnippets.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filteredSnippets.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && filteredSnippets[selectedIndex]) {
                e.preventDefault();
                handleCopy(filteredSnippets[selectedIndex]);
            } else if (e.key === 'Escape') {
                window.close();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredSnippets, selectedIndex]);

    // Scroll selected item into view
    useEffect(() => {
        const list = listRef.current;
        if (!list) return;

        const selectedEl = list.querySelector(`[data-index="${selectedIndex}"]`);
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    // Copy snippet to clipboard
    const handleCopy = async (snippet: Snippet) => {
        const success = await copyToClipboard(snippet.content);
        if (success) {
            toast.success(`Copied "${snippet.shortcut}" to clipboard`);
        } else {
            toast.error('Failed to copy to clipboard');
        }
    };

    // Toggle enabled state
    const handleToggleEnabled = async () => {
        try {
            await chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED', payload: !isEnabled });
            setEnabled(!isEnabled);
        } catch (error) {
            console.error('[Popup] Error toggling enabled:', error);
        }
    };

    // Open options page
    const openOptions = () => {
        chrome.runtime.openOptionsPage();
    };

    // Open add snippet modal/options page
    const openAddSnippet = () => {
        chrome.runtime.openOptionsPage();
        // chrome.tabs.create({ url: chrome.runtime.getURL('options.html#new') });
    };

    const snippetCount = Object.keys(snippets).length;

    return (
        <div className="w-[380px] min-h-[500px] max-h-[600px] flex flex-col bg-surface-900 overflow-hidden">
            {/* Header */}
            <header className="relative px-5 py-4 bg-gradient-to-b from-primary-500/10 to-transparent border-b border-white/[0.06]">
                {/* Decorative glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary-500/20 rounded-full blur-3xl" />
                </div>

                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold text-white">Smart Text Expander</h1>
                            <p className="text-xs text-white/50">{snippetCount} snippets</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <IconButton
                            icon={<Settings className="w-4 h-4" />}
                            label="Settings"
                            onClick={openOptions}
                        />
                    </div>
                </div>
            </header>

            {/* Status toggle */}
            <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-white/70">Extension</span>
                    <span className={`
            px-2 py-0.5 text-xs font-medium rounded-full
            ${isEnabled
                            ? 'bg-success-500/15 text-success-400'
                            : 'bg-white/10 text-white/50'
                        }
          `}>
                        {isEnabled ? 'Active' : 'Paused'}
                    </span>
                </div>

                <button
                    onClick={handleToggleEnabled}
                    className={`
            relative w-11 h-6 rounded-full transition-colors duration-200
            ${isEnabled ? 'bg-primary-500' : 'bg-white/20'}
          `}
                >
                    <motion.div
                        animate={{ x: isEnabled ? 22 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-white/[0.06]">
                <SearchInput
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery('')}
                    placeholder="Search snippets... (⌘K)"
                />
            </div>

            {/* Snippets list */}
            <div
                ref={listRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
            >
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    </div>
                ) : filteredSnippets.length === 0 ? (
                    searchQuery ? (
                        <NoResults query={searchQuery} />
                    ) : (
                        <EmptySnippets onAdd={openAddSnippet} />
                    )
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredSnippets.map((snippet, index) => (
                            <div key={snippet.shortcut} data-index={index}>
                                <SnippetCard
                                    shortcut={snippet.shortcut}
                                    content={snippet.content}
                                    name={snippet.name}
                                    isSelected={index === selectedIndex}
                                    isCompact
                                    onClick={() => handleCopy(snippet)}
                                    onCopy={() => handleCopy(snippet)}
                                    onEdit={() => {
                                        chrome.tabs.create({
                                            url: chrome.runtime.getURL(`options.html#edit/${snippet.shortcut}`)
                                        });
                                    }}
                                    onDelete={async () => {
                                        try {
                                            await chrome.runtime.sendMessage({
                                                type: 'DELETE_SNIPPET',
                                                payload: snippet.shortcut
                                            });
                                            const newSnippets = { ...snippets };
                                            delete newSnippets[snippet.shortcut];
                                            setSnippets(newSnippets);
                                            toast.success(`Deleted "${snippet.shortcut}"`, {
                                                label: 'Undo',
                                                onClick: async () => {
                                                    await chrome.runtime.sendMessage({
                                                        type: 'SAVE_SNIPPET',
                                                        payload: snippet
                                                    });
                                                    setSnippets({ ...newSnippets, [snippet.shortcut]: snippet });
                                                }
                                            });
                                        } catch (error) {
                                            toast.error('Failed to delete snippet');
                                        }
                                    }}
                                />
                            </div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Footer */}
            <footer className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        className="flex-1"
                        leftIcon={<ExternalLink className="w-4 h-4" />}
                        onClick={openOptions}
                    >
                        Dashboard
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-1"
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={openAddSnippet}
                    >
                        New Snippet
                    </Button>
                </div>

                {/* Keyboard hints */}
                <div className="mt-3 flex items-center justify-center gap-4 text-2xs text-white/30">
                    <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/50">↑↓</kbd>
                        <span>Navigate</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/50">↵</kbd>
                        <span>Copy</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/50">esc</kbd>
                        <span>Close</span>
                    </div>
                </div>
            </footer>

            {/* Toast container */}
            <ToastContainer />
        </div>
    );
}
