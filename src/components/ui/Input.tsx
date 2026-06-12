import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    onClear?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({
        className,
        label,
        error,
        hint,
        leftIcon,
        rightIcon,
        onClear,
        type = 'text',
        ...props
    }, ref) => {
        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label className="block text-sm font-medium text-white/70">
                        {label}
                    </label>
                )}

                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                            {leftIcon}
                        </div>
                    )}

                    <input
                        ref={ref}
                        type={type}
                        className={cn(
                            'w-full px-4 py-2.5',
                            'bg-white/5 border border-white/10 rounded-lg',
                            'text-white text-sm placeholder:text-white/40',
                            'transition-all duration-200',
                            'focus:outline-none focus:border-primary-500/50 focus:bg-primary-500/5',
                            'focus:ring-2 focus:ring-primary-500/20',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            leftIcon && 'pl-10',
                            (rightIcon || onClear) && 'pr-10',
                            error && 'border-danger-500/50 focus:border-danger-500 focus:ring-danger-500/20',
                            className
                        )}
                        {...props}
                    />

                    {(rightIcon || onClear) && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {onClear && props.value ? (
                                <button
                                    type="button"
                                    onClick={onClear}
                                    className="text-white/40 hover:text-white/80 transition-colors p-0.5 rounded hover:bg-white/10"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            ) : (
                                <span className="text-white/40 pointer-events-none">{rightIcon}</span>
                            )}
                        </div>
                    )}
                </div>

                {error && (
                    <p className="text-xs text-danger-400 mt-1">{error}</p>
                )}

                {hint && !error && (
                    <p className="text-xs text-white/40 mt-1">{hint}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

// Search input variant
export interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'type'> {
    onSearch?: (value: string) => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
    ({ placeholder = 'Search snippets...', onSearch, onChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(e);
            onSearch?.(e.target.value);
        };

        return (
            <Input
                ref={ref}
                type="search"
                placeholder={placeholder}
                leftIcon={<Search className="w-4 h-4" />}
                onChange={handleChange}
                {...props}
            />
        );
    }
);

SearchInput.displayName = 'SearchInput';

// Textarea
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, label, error, hint, ...props }, ref) => {
        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label className="block text-sm font-medium text-white/70">
                        {label}
                    </label>
                )}

                <textarea
                    ref={ref}
                    className={cn(
                        'w-full px-4 py-3 min-h-[120px] resize-y',
                        'bg-white/5 border border-white/10 rounded-lg',
                        'text-white text-sm placeholder:text-white/40',
                        'transition-all duration-200',
                        'focus:outline-none focus:border-primary-500/50 focus:bg-primary-500/5',
                        'focus:ring-2 focus:ring-primary-500/20',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        error && 'border-danger-500/50 focus:border-danger-500 focus:ring-danger-500/20',
                        className
                    )}
                    {...props}
                />

                {error && (
                    <p className="text-xs text-danger-400 mt-1">{error}</p>
                )}

                {hint && !error && (
                    <p className="text-xs text-white/40 mt-1">{hint}</p>
                )}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';
