import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for merging Tailwind classes
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Debounce utility
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;

    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

// Throttle utility
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;

    return (...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            fn(...args);
        }
    };
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    }
}

// Format date with pattern
export function formatDate(date: Date, format: string): string {
    const pad = (n: number) => n.toString().padStart(2, '0');

    const replacements: Record<string, string> = {
        'YYYY': date.getFullYear().toString(),
        'YY': date.getFullYear().toString().slice(-2),
        'MM': pad(date.getMonth() + 1),
        'M': (date.getMonth() + 1).toString(),
        'DD': pad(date.getDate()),
        'D': date.getDate().toString(),
        'HH': pad(date.getHours()),
        'H': date.getHours().toString(),
        'hh': pad(date.getHours() % 12 || 12),
        'h': (date.getHours() % 12 || 12).toString(),
        'mm': pad(date.getMinutes()),
        'm': date.getMinutes().toString(),
        'ss': pad(date.getSeconds()),
        's': date.getSeconds().toString(),
        'A': date.getHours() >= 12 ? 'PM' : 'AM',
        'a': date.getHours() >= 12 ? 'pm' : 'am',
    };

    return Object.entries(replacements).reduce(
        (result, [pattern, replacement]) => result.replace(pattern, replacement),
        format
    );
}

// Parse variables in snippet content
export function parseVariables(content: string, context?: Record<string, string>): string {
    const now = new Date();

    const builtInVars: Record<string, string> = {
        '{date}': formatDate(now, 'YYYY-MM-DD'),
        '{time}': formatDate(now, 'HH:mm'),
        '{datetime}': formatDate(now, 'YYYY-MM-DD HH:mm'),
        '{clipboard}': context?.clipboard || '[clipboard]',
        '{url}': context?.url || '[url]',
        '{title}': context?.title || '[title]',
        '{selection}': context?.selection || '',
    };

    let result = content;

    // Replace built-in variables
    for (const [pattern, value] of Object.entries(builtInVars)) {
        result = result.replace(new RegExp(escapeRegex(pattern), 'gi'), value);
    }

    // Handle date format patterns like {date:YYYY/MM/DD}
    result = result.replace(/\{date:([^}]+)\}/gi, (_, format) => formatDate(now, format));

    return result;
}

// Escape special regex characters
export function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Escape HTML entities
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

// Format relative time
export function formatRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return new Date(timestamp).toLocaleDateString();
}

// Generate unique ID
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Highlight search match in text
export function highlightMatch(text: string, query: string): React.ReactNode {
    if (!query) return text;

    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
        regex.test(part)
            ? <mark key={ i } className = "bg-primary-500/30 text-primary-300 rounded px-0.5" > { part } </mark>
      : part
    );
}
