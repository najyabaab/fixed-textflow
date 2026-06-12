import React from 'react';
import { motion } from 'framer-motion';
import { Edit3, Trash2, Copy, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncate } from '@/lib/utils';

export interface SnippetCardProps {
    shortcut: string;
    content: string;
    name?: string;
    category?: string;
    isSelected?: boolean;
    isCompact?: boolean;
    showActions?: boolean;
    onClick?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onCopy?: () => void;
}

export function SnippetCard({
    shortcut,
    content,
    name,
    category,
    isSelected = false,
    isCompact = false,
    showActions = true,
    onClick,
    onEdit,
    onDelete,
    onCopy,
}: SnippetCardProps) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className={cn(
                'group relative',
                'flex items-center gap-3',
                isCompact ? 'p-3' : 'p-4',
                'bg-surface-100 border border-white/[0.08] rounded-xl',
                'cursor-pointer transition-all duration-200',
                'hover:bg-surface-200 hover:border-primary-500/30',
                'hover:shadow-lg hover:shadow-primary-500/5',
                isSelected && 'bg-primary-500/10 border-primary-500/40 ring-1 ring-primary-500/20'
            )}
        >
            {/* Selection indicator */}
            {isSelected && (
                <motion.div
                    layoutId="selection-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-500 rounded-r-full"
                />
            )}

            {/* Shortcut badge */}
            <div className="flex-shrink-0">
                <span className={cn(
                    'inline-flex items-center',
                    'font-mono text-sm font-semibold',
                    'px-2.5 py-1 rounded-lg',
                    'bg-accent-500/15 text-accent-400',
                    'border border-accent-500/25',
                    'min-w-[60px] justify-center'
                )}>
                    {shortcut}
                </span>
            </div>

            {/* Content preview */}
            <div className="flex-1 min-w-0">
                {name && (
                    <h4 className="text-sm font-medium text-white truncate">
                        {name}
                    </h4>
                )}
                <p className={cn(
                    'text-xs text-white/50 truncate',
                    name ? 'mt-0.5' : ''
                )}>
                    {truncate(content.replace(/\n/g, ' '), isCompact ? 40 : 60)}
                </p>
            </div>

            {/* Category badge */}
            {category && !isCompact && (
                <span className="flex-shrink-0 px-2 py-0.5 text-2xs font-medium text-white/40 bg-white/5 rounded">
                    {category}
                </span>
            )}

            {/* Action buttons - visible on hover */}
            {showActions && (
                <div className={cn(
                    'flex-shrink-0 flex items-center gap-1',
                    'opacity-0 group-hover:opacity-100',
                    'transition-opacity duration-200'
                )}>
                    {onCopy && (
                        <ActionButton
                            icon={<Copy className="w-3.5 h-3.5" />}
                            onClick={(e) => { e.stopPropagation(); onCopy(); }}
                            label="Copy"
                        />
                    )}
                    {onEdit && (
                        <ActionButton
                            icon={<Edit3 className="w-3.5 h-3.5" />}
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            label="Edit"
                        />
                    )}
                    {onDelete && (
                        <ActionButton
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            label="Delete"
                            variant="danger"
                        />
                    )}
                </div>
            )}
        </motion.div>
    );
}

// Small action button for card actions
interface ActionButtonProps {
    icon: React.ReactNode;
    onClick: (e: React.MouseEvent) => void;
    label: string;
    variant?: 'default' | 'danger';
}

function ActionButton({ icon, onClick, label, variant = 'default' }: ActionButtonProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            title={label}
            className={cn(
                'p-1.5 rounded-lg transition-colors',
                variant === 'default' && 'text-white/50 hover:text-white hover:bg-white/10',
                variant === 'danger' && 'text-white/50 hover:text-danger-400 hover:bg-danger-500/10'
            )}
        >
            {icon}
        </motion.button>
    );
}

// Empty state component
export function EmptySnippets({
    onAdd
}: {
    onAdd?: () => void
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 px-4 text-center"
        >
            <div className="w-16 h-16 mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                <span className="text-3xl">✨</span>
            </div>

            <h3 className="text-lg font-semibold text-white mb-2">
                No snippets yet
            </h3>

            <p className="text-sm text-white/50 mb-6 max-w-[240px]">
                Create your first snippet to start expanding text faster than ever.
            </p>

            {onAdd && (
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onAdd}
                    className="btn-primary px-6"
                >
                    Create Snippet
                </motion.button>
            )}
        </motion.div>
    );
}

// No results component
export function NoResults({ query }: { query: string }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-8 px-4 text-center"
        >
            <div className="w-12 h-12 mb-3 rounded-xl bg-white/5 flex items-center justify-center">
                <span className="text-2xl">🔍</span>
            </div>

            <h4 className="text-sm font-medium text-white mb-1">
                No results found
            </h4>

            <p className="text-xs text-white/50">
                No snippets match "{query}"
            </p>
        </motion.div>
    );
}
