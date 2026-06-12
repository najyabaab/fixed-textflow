/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        './src/**/*.{ts,tsx}',
        './*.html',
    ],
    theme: {
        extend: {
            colors: {
                // Primary - Interstellar Blue
                primary: {
                    50: '#EEF2FF',
                    100: '#E0E7FF',
                    200: '#C7D2FE',
                    300: '#A5B4FC',
                    400: '#818CF8',
                    500: '#3B82F6',
                    600: '#4F46E5',
                    700: '#4338CA',
                    800: '#3730A3',
                    900: '#312E81',
                },
                // Accent - Cyan
                accent: {
                    300: '#67E8F9',
                    400: '#22D3EE',
                    500: '#06B6D4',
                    600: '#0891B2',
                },
                // Dark mode surfaces
                surface: {
                    0: '#FFFFFF',
                    50: '#F8FAFC',
                    100: '#1A1A2E',
                    150: '#1F1F38',
                    200: '#252542',
                    300: '#2D2D4A',
                    900: '#0F0F1A',
                    950: '#0A0A12',
                },
                // Semantic colors
                success: {
                    400: '#34D399',
                    500: '#10B981',
                    600: '#059669',
                },
                warning: {
                    400: '#FBBF24',
                    500: '#F59E0B',
                    600: '#D97706',
                },
                danger: {
                    400: '#F87171',
                    500: '#EF4444',
                    600: '#DC2626',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
                mono: ['JetBrains Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
            },
            fontSize: {
                '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
            },
            boxShadow: {
                'glow': '0 0 20px rgba(59, 130, 246, 0.3)',
                'glow-accent': '0 0 20px rgba(34, 211, 238, 0.3)',
                'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
                'card-hover': '0 8px 24px rgba(0, 0, 0, 0.12)',
                'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            },
            borderRadius: {
                '4xl': '2rem',
            },
            animation: {
                'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                'fade-in': 'fadeIn 0.2s ease-out',
                'fade-out': 'fadeOut 0.2s ease-out',
                'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideInRight: {
                    '0%': { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                fadeOut: {
                    '0%': { opacity: '1' },
                    '100%': { opacity: '0' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)' },
                    '50%': { boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            backdropBlur: {
                xs: '2px',
            },
            transitionTimingFunction: {
                'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
            },
        },
    },
    plugins: [],
};
