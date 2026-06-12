import React from 'react';
import { motion } from 'framer-motion';
import {
    Calendar,
    Clock,
    Clipboard,
    Link,
    FileText,
    TextCursor,
    MousePointer,
    X,
    Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VariableType } from '@/lib/types';

const iconMap: Record<VariableType, React.ReactNode> = {
    date: <Calendar className="w-3 h-3" />,
    time: <Clock className="w-3 h-3" />,
    clipboard: <Clipboard className="w-3 h-3" />,
    url: <Link className="w-3 h-3" />,
    title: <FileText className="w-3 h-3" />,
    cursor: <TextCursor className="w-3 h-3" />,
    selection: <MousePointer className="w-3 h-3" />,
    custom: <Hash className="w-3 h-3" />,
};

const colorMap: Record<VariableType, string> = {
    date: 'bg-primary-500/15 text-primary-400 border-primary-500/25 hover:bg-primary-500/25',
    time: 'bg-primary-500/15 text-primary-400 border-primary-500/25 hover:bg-primary-500/25',
    clipboard: 'bg-success-500/15 text-success-400 border-success-500/25 hover:bg-success-500/25',
    url: 'bg-accent-500/15 text-accent-400 border-accent-500/25 hover:bg-accent-500/25',
    title: 'bg-accent-500/15 text-accent-400 border-accent-500/25 hover:bg-accent-500/25',
    cursor: 'bg-warning-500/15 text-warning-400 border-warning-500/25 hover:bg-warning-500/25',
    selection: 'bg-purple-500/15 text-purple-400 border-purple-500/25 hover:bg-purple-500/25',
    custom: 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20',
};

interface VariablePillProps {
    type: VariableType;
    displayLabel: string;
    value?: string;
    onClick?: () => void;
    onRemove?: () => void;
    isRemovable?: boolean;
    size?: 'sm' | 'md';
}

export function VariablePill({
    type,
    displayLabel,
    value,
    onClick,
    onRemove,
    isRemovable = false,
    size = 'sm',
}: VariablePillProps) {
    const sizeStyles = size === 'sm'
        ? 'px-2 py-1 text-xs gap-1.5'
        : 'px-3 py-1.5 text-sm gap-2';

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={cn(
                'inline-flex items-center rounded-full border',
                'font-medium transition-colors duration-200',
                'cursor-pointer',
                colorMap[type],
                sizeStyles
            )}
        >
            <span className="flex-shrink-0">
                {iconMap[type]}
            </span>
            <span>{displayLabel}</span>

            {isRemovable && onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="flex-shrink-0 p-0.5 -mr-0.5 hover:bg-black/20 rounded-full transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </motion.button>
    );
}

// Inline pill for rendering in content
interface InlineVariablePillProps {
    value: string;
    onRemove?: () => void;
    onEdit?: () => void;
}

export function InlineVariablePill({ value, onRemove, onEdit }: InlineVariablePillProps) {
    // Determine type from value
    const getType = (v: string): VariableType => {
        if (v.includes('date')) return 'date';
        if (v.includes('time')) return 'time';
        if (v.includes('clipboard')) return 'clipboard';
        if (v.includes('url')) return 'url';
        if (v.includes('title')) return 'title';
        if (v.includes('cursor')) return 'cursor';
        if (v.includes('selection')) return 'selection';
        return 'custom';
    };

    const type = getType(value);
    const displayLabel = value.replace(/[{}|]/g, '');

    return (
        <span
            contentEditable={false}
            className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded',
                'text-xs font-medium select-none cursor-pointer',
                'border align-middle',
                colorMap[type]
            )}
            onClick={onEdit}
        >
            {iconMap[type]}
            <span>{displayLabel}</span>
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="ml-0.5 p-0.5 hover:bg-black/20 rounded-full transition-colors"
                >
                    <X className="w-2.5 h-2.5" />
                </button>
            )}
        </span>
    );
}
