import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
    manifest_version: 3,
    name: 'Smart Text Expander',
    version: '3.0.0',
    description: 'A powerful text expander with dynamic commands, forms, and world-class UX',

    permissions: [
        'storage',
        'activeTab',
        'tabs',
        'clipboardRead',
        'clipboardWrite',
        'offscreen',
        'scripting',
    ],

    host_permissions: ['<all_urls>'],

    action: {
        default_popup: 'popup.html',
        default_icon: {
            16: 'icons/icon16.png',
            48: 'icons/icon48.png',
            128: 'icons/icon128.png',
        },
    },

    icons: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png',
    },

    content_scripts: [
        {
            matches: ['<all_urls>'],
            js: ['src/content/content.ts'],
            css: ['src/content/styles/content.css'],
            run_at: 'document_idle',
            all_frames: true,
        },
    ],

    background: {
        service_worker: 'src/background/service-worker.ts',
        type: 'module',
    },

    options_page: 'options.html',

    web_accessible_resources: [
        {
            resources: ['src/content/paste-helper.ts'],
            matches: ['<all_urls>'],
        },
    ],
});
