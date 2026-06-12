// Snippet types
export interface Snippet {
    id?: string;
    shortcut: string;
    content: string;
    name?: string;
    category?: string;
    createdAt?: number;
    updatedAt?: number;
}

export interface SnippetMap {
    [shortcut: string]: Snippet;
}

// Settings types
export interface Settings {
    enabled: boolean;
    triggerKey: 'any' | 'space' | 'tab' | 'none';
    showPreview: boolean;
    soundEnabled: boolean;
    syncEnabled: boolean;
    theme: 'dark' | 'light' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    compactMode: boolean;
    caseSensitive: boolean;
    dateFormat: string;
    timeFormat: '12h' | '24h';
}

export const DEFAULT_SETTINGS: Settings = {
    enabled: true,
    triggerKey: 'any',
    showPreview: true,
    soundEnabled: false,
    syncEnabled: true,
    theme: 'dark',
    fontSize: 'medium',
    compactMode: false,
    caseSensitive: false,
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
};

// Variable types for dynamic content
export type VariableType =
    | 'date'
    | 'time'
    | 'clipboard'
    | 'url'
    | 'title'
    | 'cursor'
    | 'selection'
    | 'custom';

export interface Variable {
    type: VariableType;
    value: string;
    displayLabel: string;
    icon?: string;
}

export const BUILT_IN_VARIABLES: Variable[] = [
    { type: 'date', value: '{date}', displayLabel: 'Current Date', icon: 'calendar' },
    { type: 'time', value: '{time}', displayLabel: 'Current Time', icon: 'clock' },
    { type: 'clipboard', value: '{clipboard}', displayLabel: 'Clipboard', icon: 'clipboard' },
    { type: 'url', value: '{url}', displayLabel: 'Page URL', icon: 'link' },
    { type: 'title', value: '{title}', displayLabel: 'Page Title', icon: 'file-text' },
    { type: 'cursor', value: '|cursor|', displayLabel: 'Cursor Position', icon: 'text-cursor' },
    { type: 'selection', value: '{selection}', displayLabel: 'Selected Text', icon: 'text-select' },
];

// Editor detection types
export interface EditorData {
    isGoogleDocs: boolean;
    isNotion: boolean;
    isSlack: boolean;
    isContentEditable: boolean;
    isInput: boolean;
    isTextarea: boolean;
    requiresClipboard: boolean;
    isIntegrated: boolean;
    editorType: string;
}

// Message types for Chrome messaging
export type MessageType =
    | 'GET_SNIPPETS'
    | 'GET_SNIPPET'
    | 'SAVE_SNIPPET'
    | 'DELETE_SNIPPET'
    | 'EXPAND_SNIPPET'
    | 'GET_SETTINGS'
    | 'SAVE_SETTINGS'
    | 'TOGGLE_ENABLED'
    | 'SNIPPETS_UPDATED'
    | 'SETTINGS_UPDATED'
    | 'SET_CLIPBOARD'
    | 'GET_CLIPBOARD'
    | 'RESTORE_CLIPBOARD';

export interface Message {
    type: MessageType;
    payload?: unknown;
}

// Toast types
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

// Category for organizing snippets
export interface Category {
    id: string;
    name: string;
    icon?: string;
    color?: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
    { id: 'all', name: 'All Snippets', icon: 'folder' },
    { id: 'work', name: 'Work', icon: 'briefcase', color: '#3B82F6' },
    { id: 'email', name: 'Email', icon: 'mail', color: '#10B981' },
    { id: 'code', name: 'Code', icon: 'code', color: '#8B5CF6' },
    { id: 'personal', name: 'Personal', icon: 'user', color: '#F59E0B' },
];
