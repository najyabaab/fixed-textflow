/**
 * Offscreen Document - Smart Text Expander
 * Handles clipboard read/write operations
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return;

    switch (message.type) {
        case 'WRITE_CLIPBOARD':
            writeToClipboard(message.data)
                .then(() => sendResponse({ success: true }))
                .catch((error) => sendResponse({ error: error.message }));
            return true;

        case 'READ_CLIPBOARD':
            readFromClipboard()
                .then((text) => sendResponse({ text }))
                .catch((error) => sendResponse({ error: error.message }));
            return true;
    }
});

async function writeToClipboard(data: { text: string; html?: string }) {
    if (data.html) {
        // Write both plain text and HTML
        const blob = new Blob([data.html], { type: 'text/html' });
        const textBlob = new Blob([data.text], { type: 'text/plain' });

        await navigator.clipboard.write([
            new ClipboardItem({
                'text/html': blob,
                'text/plain': textBlob,
            }),
        ]);
    } else {
        await navigator.clipboard.writeText(data.text);
    }
}

async function readFromClipboard(): Promise<string> {
    return await navigator.clipboard.readText();
}

console.log('[Offscreen] Document ready');
