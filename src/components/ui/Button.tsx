import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const variantStyles = {
    primary: `
    bg-gradient-to-r from-primary-500 to-primary-600
    text-white shadow-lg shadow-primary-500/25
    hover:shadow-xl hover:shadow-primary-500/30
    hover:-translate-y-0.5
  `,
    secondary: `
    bg-white/5 border border-white/10
    text-white/70 hover:text-white
    hover:bg-white/10 hover:border-white/20
  `,
    ghost: `
    text-white/60 hover:text-white
    hover:bg-white/10
  `,
    danger: `
    bg-danger-500/10 border border-danger-500/20
    text-danger-400 hover:text-danger-300
    hover:bg-danger-500/20 hover:border-danger-500/30
  `,
    icon: `
    text-white/50 hover:text-white
    hover:bg-white/10
  `,
};

const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
    md: 'px-4 py-2.5 text-sm rounded-lg gap-2',
    lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
};

const iconSizeStyles = {
    sm: 'p-1.5 rounded-md',
    md: 'p-2 rounded-lg',
    lg: 'p-3 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({
        className,
        variant = 'primary',
        size = 'md',
        isLoading,
        leftIcon,
        rightIcon,
        disabled,
        children,
        ...props
    }, ref) => {
        const isIconOnly = variant === 'icon';

        return (
            <motion.button
                ref={ref}
                whileTap={{ scale: 0.98 }}
                className={cn(
                    'inline-flex items-center justify-center font-medium',
                    'transition-all duration-200 ease-spring',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
                    'disabled:opacity-50 disabled:pointer-events-none',
                    variantStyles[variant],
                    isIconOnly ? iconSizeStyles[size] : sizeStyles[size],
                    className
                )}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {!isIconOnly && <span>Loading...</span>}
                    </>
                ) : (
                    <>
                        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
                        {children}
                        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
                    </>
                )}
            </motion.button>
        );
    }
);

Button.displayName = 'Button';

// Icon button wrapper
export interface IconButtonProps extends Omit<ButtonProps, 'variant' | 'leftIcon' | 'rightIcon'> {
    icon: React.ReactNode;
    label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ icon, label, className, ...props }, ref) => {
        return (
            <Button
                ref={ref}
                variant="icon"
                className={cn('relative group', className)}
                aria-label={label}
                title={label}
                {...props}
            >
                {icon}
            </Button>
        );
    }
);

IconButton.displayName = 'IconButton';
