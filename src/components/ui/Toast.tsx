import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore } from '@/stores';
import type { ToastType } from '@/lib/types';

const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-success-400" />,
    error: <AlertCircle className="w-5 h-5 text-danger-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning-400" />,
    info: <Info className="w-5 h-5 text-primary-400" />,
};

const bgMap: Record<ToastType, string> = {
    success: 'bg-success-500/10 border-success-500/20',
    error: 'bg-danger-500/10 border-danger-500/20',
    warning: 'bg-warning-500/10 border-warning-500/20',
    info: 'bg-primary-500/10 border-primary-500/20',
};

export function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
            <AnimatePresence mode="popLayout">
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.95 }}
                        transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 30,
                            mass: 1
                        }}
                        className={`
              flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl
              shadow-lg shadow-black/20 ${bgMap[toast.type]}
            `}
                    >
                        <div className="flex-shrink-0 mt-0.5">
                            {iconMap[toast.type]}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/90 font-medium">
                                {toast.message}
                            </p>

                            {toast.action && (
                                <button
                                    onClick={() => {
                                        toast.action?.onClick();
                                        removeToast(toast.id);
                                    }}
                                    className="mt-2 text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors"
                                >
                                    {toast.action.label}
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => removeToast(toast.id)}
                            className="flex-shrink-0 p-1 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-lg transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

// Hook for easy toast creation
export function useToast() {
    const addToast = useToastStore((state) => state.addToast);

    return {
        success: (message: string, action?: { label: string; onClick: () => void }) =>
            addToast({ message, type: 'success', action }),
        error: (message: string, action?: { label: string; onClick: () => void }) =>
            addToast({ message, type: 'error', action, duration: 5000 }),
        warning: (message: string, action?: { label: string; onClick: () => void }) =>
            addToast({ message, type: 'warning', action }),
        info: (message: string, action?: { label: string; onClick: () => void }) =>
            addToast({ message, type: 'info', action }),
    };
}
