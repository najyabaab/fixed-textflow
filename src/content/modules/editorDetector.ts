/**
 * EditorDetector - Smart Text Expander
 * Detects which type of editor is active to apply correct insertion strategy
 */

import type { EditorData } from '@/lib/types';

export const EditorDetector = {
    /**
     * Get comprehensive editor data for the given element
     */
    getEditorData(element: Element | null): EditorData {
        if (!element) {
            return this.getDefaultData();
        }

        const editorData: EditorData = {
            isGoogleDocs: false,
            isNotion: false,
            isSlack: false,
            isContentEditable: false,
            isInput: false,
            isTextarea: false,
            requiresClipboard: false,
            isIntegrated: false,
            editorType: 'unknown',
        };

        const tagName = element.tagName?.toLowerCase();
        const hostname = window.location.hostname;

        // Standard input types
        if (tagName === 'input') {
            const type = (element as HTMLInputElement).type;
            if (['text', 'search', 'email', 'url', 'tel', 'password'].includes(type)) {
                editorData.isInput = true;
                editorData.editorType = 'input';
                return editorData;
            }
        }

        if (tagName === 'textarea') {
            editorData.isTextarea = true;
            editorData.editorType = 'textarea';
            return editorData;
        }

        // ContentEditable detection
        const isContentEditable =
            element.getAttribute('contenteditable') === 'true' ||
            (element as HTMLElement).isContentEditable;

        if (isContentEditable) {
            editorData.isContentEditable = true;
            editorData.editorType = 'contenteditable';
        }

        // Google Docs detection
        if (this.isGoogleDocsEditor(element)) {
            editorData.isGoogleDocs = true;
            editorData.requiresClipboard = true;
            editorData.editorType = 'google-docs';
            return editorData;
        }

        // Notion detection
        if (this.isNotionEditor(element)) {
            editorData.isNotion = true;
            editorData.requiresClipboard = true;
            editorData.editorType = 'notion';
            return editorData;
        }

        // Slack detection
        if (hostname.includes('slack.com') || hostname.includes('app.slack')) {
            editorData.isSlack = true;
            editorData.isIntegrated = true;
            editorData.editorType = 'slack';
            return editorData;
        }

        // Gmail detection
        if (this.isGmailEditor(element)) {
            editorData.isIntegrated = true;
            editorData.editorType = 'gmail';
            return editorData;
        }

        // Other complex editors
        if (this.isComplexEditor(element)) {
            editorData.requiresClipboard = true;
            editorData.editorType = 'complex';
        }

        return editorData;
    },

    getDefaultData(): EditorData {
        return {
            isGoogleDocs: false,
            isNotion: false,
            isSlack: false,
            isContentEditable: false,
            isInput: false,
            isTextarea: false,
            requiresClipboard: false,
            isIntegrated: false,
            editorType: 'unknown',
        };
    },

    /**
     * Check if element is part of Google Docs
     */
    isGoogleDocsEditor(element: Element): boolean {
        const hostname = window.location.hostname;

        if (!hostname.includes('docs.google.com')) {
            return false;
        }

        // Check for Google Docs specific elements
        const docsCanvas = element.closest('.kix-canvas-tile-content');
        const docsIframe = element.closest('iframe.docs-texteventtarget-iframe');
        const docsParagraph = element.closest('.kix-paragraphrenderer');

        if (docsCanvas || docsIframe || docsParagraph) {
            return true;
        }

        // Check for Google Docs class patterns
        if (element.className && typeof element.className === 'string') {
            if (element.className.includes('kix-') || element.className.includes('docs-')) {
                return true;
            }
        }

        return false;
    },

    /**
     * Check if element is part of Notion editor
     */
    isNotionEditor(element: Element): boolean {
        const hostname = window.location.hostname;

        if (!hostname.includes('notion.so') && !hostname.includes('notion.site')) {
            return false;
        }

        // Notion specific patterns
        const notionPage = element.closest('.notion-page-content');
        const notionBlock = element.closest('[data-block-id]');
        const notionEditor = element.closest('[contenteditable="true"]');

        return !!(notionPage || notionBlock || notionEditor);
    },

    /**
     * Check if element is Gmail compose
     */
    isGmailEditor(element: Element): boolean {
        const hostname = window.location.hostname;

        if (!hostname.includes('mail.google.com')) {
            return false;
        }

        // Gmail compose area detection
        const gmailEditor = element.closest('[role="textbox"][aria-label]');
        const gmailCompose = element.closest('.Am.Al.editable');
        const gmailBody = element.closest('[g_editable="true"]');

        return !!(gmailEditor || gmailCompose || gmailBody);
    },

    /**
     * Check if element is a complex editor requiring clipboard-based insertion
     */
    isComplexEditor(element: Element): boolean {
        const hostname = window.location.hostname;

        // Canvas-based editors
        const hasCanvas = !!element.closest('canvas');

        // Editors with shadow DOM
        const hasShadowRoot = !!(element as HTMLElement).shadowRoot;

        // Check for editContext API (modern web editors)
        const hasEditContext = 'editContext' in element;

        // Common complex editor patterns
        const complexPatterns = [
            'notion.so', 'notion.site',
            'figma.com',
            'miro.com',
            'linear.app',
            'coda.io',
            'airtable.com',
            'monday.com',
            'clickup.com',
        ];

        const isComplexSite = complexPatterns.some(p => hostname.includes(p));

        return hasCanvas || hasShadowRoot || hasEditContext || isComplexSite;
    },

    /**
     * Check if element is editable
     */
    isEditable(element: Element | null): boolean {
        if (!element) return false;

        const tagName = element.tagName?.toLowerCase();

        // Standard inputs
        if (tagName === 'input') {
            const type = (element as HTMLInputElement).type;
            return ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(type);
        }

        if (tagName === 'textarea') {
            return true;
        }

        // ContentEditable
        if (element.getAttribute('contenteditable') === 'true') {
            return true;
        }

        if ((element as HTMLElement).isContentEditable) {
            return true;
        }

        // Check for role=textbox
        if (element.getAttribute('role') === 'textbox') {
            return true;
        }

        return false;
    },

    /**
     * Get the true editable element (handles iframes)
     */
    getTrueEditableElement(element: Element): Element {
        // Check if we're in an iframe
        const iframe = element.closest('iframe');
        if (iframe) {
            try {
                const iframeDoc = iframe.contentDocument;
                if (iframeDoc) {
                    const activeEl = iframeDoc.activeElement;
                    if (activeEl && this.isEditable(activeEl)) {
                        return activeEl;
                    }
                }
            } catch {
                // Cross-origin iframe, can't access
            }
        }

        return element;
    },
};

// Export for use in content script
export default EditorDetector;
