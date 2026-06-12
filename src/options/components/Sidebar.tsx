import React from 'react';
import { motion } from 'framer-motion';
import {
    Folder,
    FolderOpen,
    Mail,
    Code,
    Briefcase,
    User,
    Star,
    Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Category } from '@/lib/types';

const iconMap: Record<string, React.ReactNode> = {
    'folder': <Folder className="w-4 h-4" />,
    'folder-open': <FolderOpen className="w-4 h-4" />,
    'mail': <Mail className="w-4 h-4" />,
    'code': <Code className="w-4 h-4" />,
    'briefcase': <Briefcase className="w-4 h-4" />,
    'user': <User className="w-4 h-4" />,
    'star': <Star className="w-4 h-4" />,
};

interface SidebarProps {
    categories: Category[];
    activeCategory: string;
    onCategoryChange: (categoryId: string) => void;
    categoryCounts: Record<string, number>;
}

export function Sidebar({
    categories,
    activeCategory,
    onCategoryChange,
    categoryCounts
}: SidebarProps) {
    return (
        <div className="space-y-6">
            {/* Categories */}
            <div>
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider px-3 mb-3">
                    Categories
                </h3>

                <nav className="space-y-1">
                    {categories.map(category => {
                        const isActive = activeCategory === category.id;
                        const count = categoryCounts[category.id] || 0;

                        return (
                            <motion.button
                                key={category.id}
                                whileHover={{ x: 2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onCategoryChange(category.id)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                                    'text-left transition-all duration-200',
                                    isActive
                                        ? 'bg-primary-500/15 text-primary-400 border-l-2 border-primary-500'
                                        : 'text-white/60 hover:text-white hover:bg-white/5'
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex-shrink-0 transition-colors',
                                        isActive ? 'text-primary-400' : 'text-white/40'
                                    )}
                                    style={category.color && !isActive ? { color: category.color } : undefined}
                                >
                                    {iconMap[category.icon || 'folder'] || <Hash className="w-4 h-4" />}
                                </span>

                                <span className="flex-1 text-sm font-medium truncate">
                                    {category.name}
                                </span>

                                {count > 0 && (
                                    <span className={cn(
                                        'text-xs px-1.5 py-0.5 rounded',
                                        isActive
                                            ? 'bg-primary-500/20 text-primary-300'
                                            : 'bg-white/10 text-white/50'
                                    )}>
                                        {count}
                                    </span>
                                )}
                            </motion.button>
                        );
                    })}
                </nav>
            </div>

            {/* Quick tips */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-white/[0.06]">
                <h4 className="text-sm font-medium text-white mb-2">
                    💡 Quick Tip
                </h4>
                <p className="text-xs text-white/60 leading-relaxed">
                    Use <code className="px-1.5 py-0.5 bg-white/10 rounded text-accent-400">|cursor|</code> in your snippet to position the cursor after expansion.
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    label="Total Snippets"
                    value={categoryCounts['all'] || 0}
                    color="primary"
                />
                <StatCard
                    label="Categories"
                    value={Object.keys(categoryCounts).length - 1}
                    color="accent"
                />
            </div>
        </div>
    );
}

interface StatCardProps {
    label: string;
    value: number;
    color: 'primary' | 'accent';
}

function StatCard({ label, value, color }: StatCardProps) {
    return (
        <div className={cn(
            'p-3 rounded-xl border',
            color === 'primary'
                ? 'bg-primary-500/5 border-primary-500/20'
                : 'bg-accent-500/5 border-accent-500/20'
        )}>
            <div className={cn(
                'text-2xl font-bold',
                color === 'primary' ? 'text-primary-400' : 'text-accent-400'
            )}>
                {value}
            </div>
            <div className="text-xs text-white/50 mt-1">{label}</div>
        </div>
    );
}
