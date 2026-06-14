/**
 * EditorDetector - Smart Text Expander
 * Detects which type of editor is active to apply correct insertion strategy.
 * Supports plain textareas, inputs, contenteditable, ACE/CodeMirror/Monaco,
 * ProseMirror/TipTap, Google Docs, Notion, Gmail, Slack, canvas editors, and more.
 */

import type { EditorData } from '@/lib/types';

type EditorFramework =
    | 'plain'
    | 'ace'
    | 'codemirror'
    | 'monaco'
    | 'prosemirror'
    | 'tiptap'
    | 'slate'
    | 'quill'
    | 'tinymce'
    | 'ckeditor'
    | 'froala'
    | 'draftjs'
    | 'lexical'
    | 'google-docs'
    | 'notion'
    | 'gmail'
    | 'slack'
    | 'wordpress'
    | 'markdown'
    | 'unknown';

type SiteCategory =
    | 'notepad'
    | 'code-editor'
    | 'rich-text'
    | 'canvas'
    | 'spreadsheet'
    | 'presentation'
    | 'email'
    | 'chat'
    | 'cms'
    | 'form'
    | 'search'
    | 'terminal'
    | 'unknown';

const codeEditorSelectors = [
    '.ace_editor', '.ace_text-input',
    '.CodeMirror', '.CodeMirror-code',
    '.monaco-editor', '.monaco-inputbox',
    '.cm-editor', '.cm-content',
];

const richTextSelectors = [
    '[data-slate-editor]',
    '[data-lexical-editor]',
    '.DraftEditor-root',
    '.notion-editor',
    '.tox-edit-area',
    '.ck-editor__editable',
    '.fr-box',
    '.ql-editor',
];

const markdownSelectors = [
    '.markdown-editor', '.md-editor',
    '.CodeMirror-wrap',
    '.editor-preview',
    '.simplemde-editor',
    '.easymde-wrapper',
    '.bytemd',
];

const proxiedTextareaSelectors = [
    'textarea.ace_text-input',
    'textarea.CodeMirror',
    'textarea.cm-editor',
    '.monaco-editor textarea',
    '.npm-monaco textarea',
];

export const EditorDetector = {
    /**
     * Get comprehensive editor data for the given element
     */
    getEditorData(element: Element | null): EditorData {
        const data = this.getDefaultData();
        if (!element) return data;

        const tagName = element.tagName?.toLowerCase();
        const hostname = window.location.hostname;

        this.detectStandardInputs(element, tagName, data);
        this.detectContentEditable(element, data);
        this.detectGoogleDocs(element, hostname, data);
        this.detectNotion(element, hostname, data);
        this.detectSlack(hostname, data);
        this.detectGmail(element, hostname, data);
        this.detectCodeEditors(element, data);
        this.detectRichTextEditors(element, data);
        this.detectCanvas(element, data);

        data.siteCategory = this.getSiteCategory(hostname, data);

        return data;
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
            isCodeEditor: false,
            isRichTextEditor: false,
            isCanvasEditor: false,
            isMarkdownEditor: false,
            editorType: 'unknown',
            editorFramework: 'unknown',
            siteCategory: 'unknown',
        };
    },

    detectStandardInputs(element: Element, tagName: string, data: EditorData): void {
        if (tagName === 'input') {
            const type = (element as HTMLInputElement).type;
            if (['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(type)) {
                data.isInput = true;
                data.editorType = 'input';
                data.editorFramework = 'plain';
            }
            return;
        }

        if (tagName === 'textarea') {
            data.isTextarea = true;
            data.editorType = 'textarea';
            data.editorFramework = 'plain';

            if (this.isHiddenTextarea(element)) {
                const parentEditor = this.findVisibleEditorParent(element);
                if (parentEditor) {
                    data.editorFramework = this.detectFrameworkFromParent(parentEditor);
                    if (data.editorFramework !== 'unknown') {
                        data.isCodeEditor = true;
                        data.editorType = 'code-editor';
                    }
                }
            }
            return;
        }
    },

    detectContentEditable(element: Element, data: EditorData): void {
        const isContentEditable =
            element.getAttribute('contenteditable') === 'true' ||
            (element as HTMLElement).isContentEditable;

        if (isContentEditable && data.editorType === 'unknown') {
            data.isContentEditable = true;
            data.editorType = 'contenteditable';
            data.editorFramework = 'plain';

            const framework = this.detectFrameworkFromParent(element);
            if (framework !== 'unknown') {
                data.editorFramework = framework;
                data.isRichTextEditor = true;
            }
        }
    },

    detectGoogleDocs(element: Element, hostname: string, data: EditorData): void {
        if (!hostname.includes('docs.google.com')) return;

        const docsCanvas = element.closest('.kix-canvas-tile-content');
        const docsIframe = element.closest('iframe.docs-texteventtarget-iframe');
        const docsParagraph = element.closest('.kix-paragraphrenderer');
        const hasDocsClass = element.className && typeof element.className === 'string' &&
            (element.className.includes('kix-') || element.className.includes('docs-'));

        if (docsCanvas || docsIframe || docsParagraph || hasDocsClass) {
            data.isGoogleDocs = true;
            data.requiresClipboard = true;
            data.editorType = 'google-docs';
            data.editorFramework = 'google-docs';
            data.siteCategory = 'rich-text';
        }
    },

    detectNotion(element: Element, hostname: string, data: EditorData): void {
        if (!hostname.includes('notion.so') && !hostname.includes('notion.site')) return;

        const notionPage = element.closest('.notion-page-content');
        const notionBlock = element.closest('[data-block-id]');
        const notionEditor = element.closest('[contenteditable="true"]');

        if (notionPage || notionBlock || notionEditor) {
            data.isNotion = true;
            data.requiresClipboard = true;
            data.editorType = 'notion';
            data.editorFramework = 'notion';
            data.isRichTextEditor = true;
            data.siteCategory = 'rich-text';
        }
    },

    detectSlack(hostname: string, data: EditorData): void {
        if (hostname.includes('slack.com') || hostname.includes('app.slack')) {
            data.isSlack = true;
            data.isIntegrated = true;
            data.editorType = 'slack';
            data.editorFramework = 'slack';
        }
    },

    detectGmail(element: Element, hostname: string, data: EditorData): void {
        if (!hostname.includes('mail.google.com')) return;

        const gmailEditor = element.closest('[role="textbox"][aria-label]');
        const gmailCompose = element.closest('.Am.Al.editable');
        const gmailBody = element.closest('[g_editable="true"]');

        if (gmailEditor || gmailCompose || gmailBody) {
            data.isIntegrated = true;
            data.editorType = 'gmail';
            data.editorFramework = 'gmail';
            data.siteCategory = 'email';
        }
    },

    detectCodeEditors(element: Element, data: EditorData): void {
        if (data.editorType !== 'unknown' && data.editorType !== 'textarea') return;

        for (const selector of codeEditorSelectors) {
            const editor = element.closest(selector) || element.querySelector(selector);
            if (editor) {
                data.isCodeEditor = true;
                data.editorType = 'code-editor';
                data.editorFramework = this.detectFrameworkFromParent(editor);
                return;
            }
        }

        if (element.tagName?.toLowerCase() === 'textarea') {
            const parent = element.parentElement;
            if (parent) {
                for (const selector of codeEditorSelectors) {
                    if (parent.querySelector(selector)) {
                        data.isCodeEditor = true;
                        data.editorType = 'code-editor';
                        data.editorFramework = this.detectFrameworkFromParent(parent);
                        return;
                    }
                }
            }
        }
    },

    detectRichTextEditors(element: Element, data: EditorData): void {
        if (data.editorType !== 'unknown' && data.editorType !== 'contenteditable') return;

        for (const selector of richTextSelectors) {
            const editor = element.closest(selector) || element.querySelector(selector);
            if (editor) {
                data.isRichTextEditor = true;
                data.editorType = 'rich-text';
                data.editorFramework = this.detectFrameworkFromParent(editor);
                return;
            }
        }
    },

    detectCanvas(element: Element, data: EditorData): void {
        const hasCanvas = !!element.closest('canvas');
        if (hasCanvas) {
            data.isCanvasEditor = true;
            data.editorType = 'canvas';
            data.editorFramework = 'unknown';
            return;
        }

        if (data.editorType !== 'unknown') return;

        if ('editContext' in element) {
            data.isCanvasEditor = true;
            data.editorType = 'canvas';
        }
    },

    detectMarkdown(element: Element, data: EditorData): void {
        for (const selector of markdownSelectors) {
            const editor = element.closest(selector) || element.querySelector(selector);
            if (editor) {
                data.isMarkdownEditor = true;
                data.editorType = 'markdown';
                data.editorFramework = 'markdown';
                return;
            }
        }
    },

    getSiteCategory(hostname: string, data: EditorData): string {
        if (data.editorType === 'google-docs') return 'rich-text';
        if (data.editorType === 'notion') return 'rich-text';
        if (data.editorType === 'gmail') return 'email';
        if (data.editorType === 'slack') return 'chat';
        if (data.isCodeEditor) return 'code-editor';
        if (data.isRichTextEditor) return 'rich-text';
        if (data.isCanvasEditor) return 'canvas';
        if (data.isInput) return 'form';

        if (hostname.includes('github.com')) return 'code-editor';
        if (hostname.includes('stackoverflow.com')) return 'code-editor';
        if (hostname.includes('stackexchange.com')) return 'code-editor';
        if (hostname.includes('codepen.io')) return 'code-editor';
        if (hostname.includes('codesandbox.io')) return 'code-editor';
        if (hostname.includes('replit.com')) return 'code-editor';
        if (hostname.includes('pastebin.com')) return 'code-editor';
        if (hostname.includes('leetcode.com')) return 'code-editor';
        if (hostname.includes('hackerrank.com')) return 'code-editor';
        if (hostname.includes('medium.com')) return 'rich-text';
        if (hostname.includes('wordpress.com') || hostname.includes('wp-admin')) return 'cms';
        if (hostname.includes('wix.com')) return 'cms';
        if (hostname.includes('duckduckgo.com') || hostname.includes('google.com/search') || hostname.includes('bing.com')) return 'search';
        if (hostname.includes('messenger.com') || hostname.includes('web.whatsapp.com') || hostname.includes('web.telegram.org')) return 'chat';

        return 'unknown';
    },

    /**
     * Detect framework from parent element class names
     */
    detectFrameworkFromParent(element: Element): EditorFramework {
        const html = element.outerHTML || '';
        const cls = typeof element.className === 'string' ? element.className : '';
        const fullHtml = html + ' ' + cls;

        if (fullHtml.includes('ace_') || fullHtml.includes('ace_text-input')) return 'ace';
        if (fullHtml.includes('CodeMirror') || fullHtml.includes('codemirror')) return 'codemirror';
        if (fullHtml.includes('monaco') || fullHtml.includes('monaco-editor')) return 'monaco';
        if (fullHtml.includes('ProseMirror') || fullHtml.includes('ProseMirror')) return 'prosemirror';
        if (fullHtml.includes('tiptap') || fullHtml.includes('Tiptap')) return 'tiptap';
        if (fullHtml.includes('slate-editor') || element.hasAttribute('data-slate-editor')) return 'slate';
        if (fullHtml.includes('ql-editor') || fullHtml.includes('quill')) return 'quill';
        if (fullHtml.includes('DraftEditor') || fullHtml.includes('draftjs')) return 'draftjs';
        if (fullHtml.includes('lexical') || element.hasAttribute('data-lexical-editor')) return 'lexical';
        if (fullHtml.includes('tox-') || fullHtml.includes('tinymce')) return 'tinymce';
        if (fullHtml.includes('ck-') || fullHtml.includes('ckeditor')) return 'ckeditor';
        if (fullHtml.includes('fr-') || fullHtml.includes('froala')) return 'froala';
        if (fullHtml.includes('kix-') || fullHtml.includes('docs-')) return 'google-docs';
        if (fullHtml.includes('notion')) return 'notion';

        return 'unknown';
    },

    /**
     * Check if a textarea is likely a hidden proxy for a code editor
     */
    isHiddenTextarea(element: Element): boolean {
        if (element.tagName?.toLowerCase() !== 'textarea') return false;

        const rect = element.getBoundingClientRect();
        const isHidden = rect.width === 0 || rect.height === 0 ||
            rect.x < 0 || rect.y < 0 ||
            getComputedStyle(element).opacity === '0' ||
            getComputedStyle(element).visibility === 'hidden' ||
            getComputedStyle(element).display === 'none';

        if (!isHidden) return false;

        const cls = typeof element.className === 'string' ? element.className : '';
        for (const selector of proxiedTextareaSelectors) {
            const parts = selector.split(' ');
            if (parts.every(p => !p.startsWith('.') || cls.includes(p.substring(1)) || element.matches(p))) {
                return true;
            }
        }

        const parent = element.parentElement;
        if (!parent) return isHidden;

        for (const sel of codeEditorSelectors) {
            try {
                if (parent.querySelector(sel) || element.matches(sel)) return true;
            } catch { }
        }

        return isHidden;
    },

    /**
     * Find the visible parent editor element for a hidden proxy textarea
     */
    findVisibleEditorParent(element: Element): Element | null {
        if (!this.isHiddenTextarea(element)) return null;

        const parent = element.parentElement;
        if (!parent) return null;

        for (const selector of codeEditorSelectors) {
            try {
                const el = parent.querySelector(selector);
                if (el) return el;
            } catch { }
        }

        for (const selector of richTextSelectors) {
            try {
                const el = parent.querySelector(selector);
                if (el) return el;
            } catch { }
        }

        for (const selector of markdownSelectors) {
            try {
                const el = parent.querySelector(selector);
                if (el) return el;
            } catch { }
        }

        if (parent.querySelector('[contenteditable]')) {
            return parent.querySelector('[contenteditable]');
        }

        return parent;
    },

    /**
     * Get the best editable element to use, resolving proxy textareas
     */
    getActiveEditor(element: Element): Element {
        const trueEditable = this.getTrueEditableElement(element);

        if (trueEditable.tagName?.toLowerCase() === 'textarea' && this.isHiddenTextarea(trueEditable)) {
            const visible = this.findVisibleEditorParent(trueEditable);
            if (visible) return visible;
        }

        return trueEditable;
    },

    /**
     * Check if element is editable
     */
    isEditable(element: Element | null): boolean {
        if (!element) return false;

        const tagName = element.tagName?.toLowerCase();

        if (tagName === 'input') {
            const type = (element as HTMLInputElement).type;
            return ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(type);
        }

        if (tagName === 'textarea') return true;

        if (element.getAttribute('contenteditable') === 'true') return true;
        if ((element as HTMLElement).isContentEditable) return true;
        if (element.getAttribute('role') === 'textbox') return true;

        return false;
    },

    /**
     * Get the true editable element (handles iframes)
     */
    getTrueEditableElement(element: Element): Element {
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
            } catch { }
        }

        return element;
    },

    /**
     * Log detected editor info for debugging
     */
    logEditorInfo(element: Element | null): void {
        const data = this.getEditorData(element);
        console.log(`[EditorDetector] Type: ${data.editorType}, Framework: ${data.editorFramework}, Category: ${data.siteCategory}`);
        if (data.isCodeEditor) console.log('[EditorDetector] Code editor detected');
        if (data.isRichTextEditor) console.log('[EditorDetector] Rich text editor detected');
        if (data.isCanvasEditor) console.log('[EditorDetector] Canvas editor detected');
        if (element && element.tagName?.toLowerCase() === 'textarea' && this.isHiddenTextarea(element)) console.log('[EditorDetector] Hidden textarea (likely editor proxy)');
    },
};

// Export for use in content script
export default EditorDetector;
