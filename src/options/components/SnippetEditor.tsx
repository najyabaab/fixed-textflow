import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Save,
    Trash2,
    X,
    Calendar,
    Clock,
    Clipboard,
    MousePointer,
    Type,
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    Link,
    Image,
    Maximize2,
    ChevronDown,
    Search
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Snippet, Variable } from '@/lib/types';
import { BUILT_IN_VARIABLES, DEFAULT_CATEGORIES } from '@/lib/types';

interface SnippetEditorProps {
    snippet?: Snippet;
    onSave: (snippet: Snippet) => void;
    onCancel: () => void;
    onDelete?: () => void;
}

export function SnippetEditor({ snippet, onSave, onCancel, onDelete }: SnippetEditorProps) {
    const [shortcut, setShortcut] = useState(snippet?.shortcut || '');
    const [name, setName] = useState(snippet?.name || '');
    const [content, setContent] = useState(snippet?.content || '');
    const [category, setCategory] = useState(snippet?.category || 'uncategorized');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [variableSearch, setVariableSearch] = useState('');

    const contentRef = useRef<HTMLTextAreaElement>(null);
    const isEditing = !!snippet;

    // Reset form when snippet changes
    useEffect(() => {
        setShortcut(snippet?.shortcut || '');
        setName(snippet?.name || '');
        setContent(snippet?.content || '');
        setCategory(snippet?.category || 'uncategorized');
        setErrors({});
    }, [snippet]);

    // Validate form
    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!shortcut.trim()) {
            newErrors.shortcut = 'Shortcut is required';
        } else if (shortcut.length < 2) {
            newErrors.shortcut = 'Min 2 chars';
        }

        if (!content.trim()) {
            newErrors.content = 'Content is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle save
    const handleSave = () => {
        if (!validate()) return;

        onSave({
            shortcut: shortcut.trim(),
            content,
            name: name.trim() || undefined,
            category: category || undefined,
            createdAt: snippet?.createdAt || Date.now(),
            updatedAt: Date.now(),
        });
    };

    // Insert variable
    const insertVariable = (variable: Variable) => {
        const textarea = contentRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.slice(0, start) + variable.value + content.slice(end);

        setContent(newContent);

        setTimeout(() => {
            textarea.focus();
            const newPos = start + variable.value.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    const essentials = [
        { icon: Calendar, label: 'Current Date', desc: "Insert today's date", value: '{date}', color: 'text-blue-400' },
        { icon: Clock, label: 'Current Time', desc: 'Insert current time', value: '{time}', color: 'text-yellow-400' },
    ];

    const interactive = [
        { icon: Clipboard, label: 'Clipboard Content', desc: 'Paste clipboard • Supports trim & formulas', value: '{clipboard}', color: 'text-green-500' },
        { icon: MousePointer, label: 'Cursor Position', desc: 'Set cursor placement', value: '{cursor}', color: 'text-purple-500' },
        { icon: Type, label: 'Text Field', desc: 'Prompt for input', value: '{text}', color: 'text-pink-500' },
    ];

    const filterVariables = (items: any[]) => {
        if (!variableSearch) return items;
        return items.filter(item =>
            item.label.toLowerCase().includes(variableSearch.toLowerCase()) ||
            item.desc.toLowerCase().includes(variableSearch.toLowerCase())
        );
    };

    return (
        <div className="h-[calc(100vh-140px)] flex gap-6">
            {/* Main Editor Column */}
            <div className="flex-1 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            onClick={onCancel}
                            className="text-white/50 hover:text-white px-0"
                        >
                            <span className="mr-2">←</span>
                        </Button>
                        <h2 className="text-2xl font-bold text-white">
                            {isEditing ? 'Edit Snippet' : 'New Snippet'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            onClick={onCancel}
                            className="text-white/70 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-primary-600 hover:bg-primary-500 text-white px-6"
                            leftIcon={<Save className="w-4 h-4" />}
                            onClick={handleSave}
                        >
                            Save Snippet
                        </Button>
                    </div>
                </div>

                {/* Meta Fields Box */}
                <div className="bg-[#141416] border border-white/[0.08] rounded-xl p-5 grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider">
                            Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Weekly Report Template"
                            className="w-full bg-[#1a1a1c] border border-white/[0.08] rounded-lg px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider">
                            Trigger
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-mono text-lg">/</span>
                            <input
                                type="text"
                                value={shortcut.replace(/^\//, '')}
                                onChange={(e) => setShortcut(e.target.value)}
                                placeholder="report"
                                className={cn(
                                    "w-full bg-[#1a1a1c] border border-white/[0.08] rounded-lg pl-8 pr-4 py-3 text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all",
                                    errors.shortcut && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                                )}
                            />
                        </div>
                        {errors.shortcut && (
                            <p className="text-xs text-red-500 mt-1">{errors.shortcut}</p>
                        )}
                    </div>

                    <div className="col-span-2 space-y-2">
                        <label className="text-[11px] font-bold text-white/40 uppercase tracking-wider">
                            Collection
                        </label>
                        <div className="relative">
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-[#1a1a1c] border border-white/[0.08] rounded-lg pl-4 pr-10 py-3 text-white appearance-none focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/50 transition-all cursor-pointer"
                            >
                                <option value="uncategorized">● Uncategorized</option>
                                {DEFAULT_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                                    <option key={cat.id} value={cat.id}>● {cat.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Editor Box */}
                <div className="flex-1 bg-[#141416] border border-white/[0.08] rounded-xl flex flex-col overflow-hidden">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                        <div className="flex items-center gap-1">
                            <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-md transition-colors"><Bold className="w-4 h-4" /></button>
                            <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-md transition-colors"><Italic className="w-4 h-4" /></button>
                            <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-md transition-colors"><Underline className="w-4 h-4" /></button>
                            <div className="w-px h-4 bg-white/10 mx-2" />
                            <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-md transition-colors"><List className="w-4 h-4" /></button>
                            <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-md transition-colors"><ListOrdered className="w-4 h-4" /></button>
                            <div className="w-px h-4 bg-white/10 mx-2" />
                            <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-md transition-colors"><Link className="w-4 h-4" /></button>
                            <button className="p-2 text-white/50 hover:text-white hover:bg-white/5 rounded-md transition-colors"><Image className="w-4 h-4" /></button>
                        </div>

                        <Button size="xs" variant="secondary" leftIcon={<Zap className="w-3 h-3" />} className="bg-primary-500/10 text-primary-400 border-primary-500/20 hover:bg-primary-500/20">
                            ACTIONS
                        </Button>
                    </div>

                    {/* Textarea */}
                    <textarea
                        ref={contentRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Start typing your snippet content here..."
                        className="flex-1 bg-transparent border-none p-6 text-white placeholder:text-white/20 resize-none focus:ring-0 font-mono text-sm leading-relaxed"
                        spellCheck={false}
                    />

                    {/* Footer */}
                    <div className="px-4 py-2 border-t border-white/[0.08] bg-[#1a1a1c] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-orange-400">
                            <span className="w-3 h-3 rounded-full border border-orange-400/50 flex items-center justify-center text-[8px]">!</span>
                            Supports standard rich text.
                        </div>
                        <div className="text-xs text-white/30">
                            {content.length} characters
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar */}
            <div className="w-80 flex flex-col gap-4">
                <div className="bg-[#141416] border border-white/[0.08] rounded-xl flex flex-col h-full overflow-hidden">
                    <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
                        <h3 className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Dynamic Data</h3>
                        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/30 border border-white/5">ESC to focus</span>
                    </div>

                    <div className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                type="text"
                                value={variableSearch}
                                onChange={(e) => setVariableSearch(e.target.value)}
                                placeholder="Filter variables..."
                                className="w-full bg-[#1a1a1c] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary-500/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
                        {filterVariables(essentials).length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Essentials</h4>
                                <div className="space-y-1">
                                    {filterVariables(essentials).map((item) => (
                                        <button
                                            key={item.label}
                                            onClick={() => insertVariable({ type: 'date', value: item.value, displayLabel: item.label })}
                                            className="w-full flex items-start gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors group text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-[#1a1a1c] border border-white/[0.08] flex items-center justify-center group-hover:border-primary-500/30 group-hover:bg-primary-500/10 transition-colors">
                                                <item.icon className={cn("w-4 h-4", item.color)} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white/90 group-hover:text-white">{item.label}</div>
                                                <div className="text-xs text-white/40">{item.desc}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {filterVariables(interactive).length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Interactive</h4>
                                <div className="space-y-1">
                                    {filterVariables(interactive).map((item) => (
                                        <button
                                            key={item.label}
                                            onClick={() => insertVariable({ type: 'custom', value: item.value, displayLabel: item.label })}
                                            className="w-full flex items-start gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors group text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-[#1a1a1c] border border-white/[0.08] flex items-center justify-center group-hover:border-primary-500/30 group-hover:bg-primary-500/10 transition-colors">
                                                <item.icon className={cn("w-4 h-4", item.color)} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white/90 group-hover:text-white">{item.label}</div>
                                                <div className="text-xs text-white/40">{item.desc}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-white/[0.08] bg-[#1a1a1c]">
                        <p className="text-[10px] text-white/30 text-center">
                            Variables are processed at insertion time. <span className="text-primary-400 cursor-pointer hover:underline">Learn syntax</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Zap({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
    )
}
