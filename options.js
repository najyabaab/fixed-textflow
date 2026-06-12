/**
 * TextFlow Dashboard - Clean Implementation
 * All-in-one script with smooth drag & drop
 */

(function () {
    'use strict';

    // ===== STATE =====
    let snippets = {};
    let collections = [
        { id: 'personal', name: 'Personal', color: 'green' },
        { id: 'work', name: 'Work', color: 'blue' },
        { id: 'coding', name: 'Coding', color: 'orange' },
        { id: 'support', name: 'Support', color: 'pink' },
    ];
    let deletedSnippets = [];
    let deletedCollections = [];
    let activeFilter = 'all';
    let activeCollection = null;
    let collectionsCollapsed = false;
    let editingSnippet = null;
    let isCreating = false;
    let deletedSnippet = null;
    let selectedColor = 'green';
    let editingCollectionId = null;
    let richTextEditor = null; // RichTextEditor instance

    // Drag state
    let dragState = {
        isDragging: false,
        snippet: null,
        ghost: null,
        startX: 0,
        startY: 0
    };

    // ===== DOM CACHE =====
    const $ = id => document.getElementById(id);
    const el = {
        libraryNav: $('library-nav'),
        collectionsNav: $('collections-nav'),
        categoryName: $('category-name'),
        searchInput: $('search-input'),
        snippetList: $('snippet-list'),
        emptyState: $('empty-state'),
        addSnippetBtn: $('add-snippet-btn'),
        addCollectionBtn: $('add-collection-btn'),
        createNewBtn: $('create-new-btn'),
        editorPlaceholder: $('editor-placeholder'),
        editorContainer: $('editor-container'),
        editorTitle: $('editor-title'),
        inputName: $('input-name'),
        inputShortcut: $('input-shortcut'),
        inputCollection: $('input-collection'),
        inputContent: $('input-content'),
        previewBox: $('preview-box'),
        saveBtn: $('save-btn'),
        cancelBtn: $('cancel-btn'),
        deleteBtn: $('delete-btn'),
        toast: $('toast'),
        toastMessage: $('toast-message'),
        toastAction: $('toast-action'),
        countAll: $('count-all'),
        collectionModal: $('collection-modal'),
        modalClose: $('modal-close'),
        modalCancel: $('modal-cancel'),
        modalCreate: $('modal-create'),
        modalTitle: document.querySelector('.modal-title'),
        collectionNameInput: $('collection-name-input'),
        colorPicker: $('color-picker'),
        trashDropZone: $('trash-drop-zone'),
    };

    // ===== INIT =====
    async function init() {
        await loadSnippets();
        initRichTextEditor();
        bindEvents();
        render();
        console.log('TextFlow Dashboard loaded');
    }



    // Initialize the rich text editor (WYSIWYG)
    function initRichTextEditor() {
        const container = $('rich-editor-container');
        if (container && window.RichTextEditor && !richTextEditor) {
            richTextEditor = new window.RichTextEditor(container, {
                placeholder: 'Type your rich text content here...',
                onCommandInsert: () => {
                    // Open command configurator picker if available
                    if (window.CommandConfigurator) {
                        window.CommandConfigurator.showPicker().then(result => {
                            if (result && richTextEditor) {
                                richTextEditor.insertCommandToken(result);
                            }
                        }).catch(() => { });
                    }
                },
                onContentChange: (content) => {
                    // Update character count
                    const charCount = $('char-count');
                    if (charCount) {
                        const text = content.replace(/<[^>]*>/g, '').trim();
                        charCount.textContent = `${text.length} chars`;
                    }
                }
            });
        }
    }

    // ===== LOAD DATA =====
    async function loadSnippets() {
        try {
            const res = await chrome.runtime.sendMessage({ type: 'GET_SNIPPETS' });
            snippets = res?.snippets || {};
        } catch (e) {
            // Demo data
            snippets = {
                '/welcome': { shortcut: '/welcome', name: 'Welcome Email', content: 'Hello!\n\nThank you for reaching out. How can I help you today?\n\nBest regards', collection: 'work', favorite: true, createdAt: Date.now(), updatedAt: Date.now() },
                '/zoom': { shortcut: '/zoom', name: 'Zoom Link', content: 'Join our meeting: https://zoom.us/j/123456789\n\nMeeting ID: 123 456 789\nPasscode: abc123', collection: 'work', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
                '/sig': { shortcut: '/sig', name: 'Email Signature', content: 'Best regards,\nJohn Doe\njohn@example.com', collection: 'personal', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
                '/thanks': { shortcut: '/thanks', name: 'Thank You', content: 'Thank you so much! I really appreciate your help.', collection: 'personal', favorite: true, createdAt: Date.now(), updatedAt: Date.now() },
                '/code': { shortcut: '/code', name: 'Code Review', content: 'Great work on this PR! A few suggestions:\n\n1. Consider adding error handling\n2. Add unit tests\n3. Update documentation', collection: 'coding', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
            };
        }
    }

    // ===== EVENT BINDINGS =====
    function bindEvents() {
        // Navigation
        el.libraryNav?.addEventListener('click', e => {
            const item = e.target.closest('.nav-item');
            if (item) setFilter(item.dataset.filter);
        });

        el.collectionsNav?.addEventListener('click', e => {
            const item = e.target.closest('.collection-item');
            if (item && !dragState.isDragging) setCollection(item.dataset.collection);
        });

        // Right-click delete collection (soft delete to recycle bin)
        // Right-click context menu
        const ctxMenu = $('collection-context-menu');
        let ctxTargetId = null;

        el.collectionsNav?.addEventListener('contextmenu', e => {
            const item = e.target.closest('.collection-item');
            if (!item || dragState.isDragging) return;
            e.preventDefault();

            ctxTargetId = item.dataset.collection;

            // Position menu
            if (ctxMenu) {
                // Ensure menu doesn't go off-screen
                const x = Math.min(e.clientX, window.innerWidth - 160);
                const y = Math.min(e.clientY, window.innerHeight - 80);

                ctxMenu.style.left = `${x}px`;
                ctxMenu.style.top = `${y}px`;
                ctxMenu.classList.add('visible');
            }
        });

        // Hide context menu on global click
        document.addEventListener('click', e => {
            if (ctxMenu && !e.target.closest('.context-menu')) {
                ctxMenu.classList.remove('visible');
            }
        });

        // Context Menu Actions
        $('ctx-delete')?.addEventListener('click', () => {
            if (ctxTargetId) {
                if (confirm('Move this collection to Trash?')) {
                    softDeleteCollection(ctxTargetId);
                }
            }
            if (ctxMenu) ctxMenu.classList.remove('visible');
        });

        $('ctx-edit')?.addEventListener('click', () => {
            if (ctxTargetId) {
                openModal(ctxTargetId);
            }
            if (ctxMenu) ctxMenu.classList.remove('visible');
        });

        // Search
        el.searchInput?.addEventListener('input', render);

        // Snippet buttons
        el.addSnippetBtn?.addEventListener('click', createNew);
        el.createNewBtn?.addEventListener('click', createNew);

        // Collection modal
        el.addCollectionBtn?.addEventListener('click', () => openModal());
        el.modalClose?.addEventListener('click', closeModal);
        el.modalCancel?.addEventListener('click', closeModal);
        el.modalCreate?.addEventListener('click', createCollection);
        el.collectionModal?.addEventListener('click', e => {
            if (e.target === el.collectionModal) closeModal();
        });
        el.colorPicker?.addEventListener('click', e => {
            const opt = e.target.closest('.color-option');
            if (opt) {
                selectedColor = opt.dataset.color;
                el.colorPicker.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
            }
        });

        // Collections collapse toggle (click on header, but not on "+" button)
        const collectionsSection = document.getElementById('collections-section');
        const collectionsHeader = collectionsSection?.querySelector('.section-header');
        collectionsHeader?.addEventListener('click', e => {
            if (e.target.closest('#add-collection-btn')) return;
            toggleCollectionsCollapsed();
        });

        // Editor
        el.saveBtn?.addEventListener('click', save);
        el.cancelBtn?.addEventListener('click', closeEditor);
        $('cancel-btn-back')?.addEventListener('click', closeEditor);
        el.deleteBtn?.addEventListener('click', () => editingSnippet && del(editingSnippet.shortcut));

        el.toastAction?.addEventListener('click', undoDel);

        // Variable pills with command configurator (legacy support)
        document.querySelectorAll('.variable-pill').forEach(pill => {
            pill.addEventListener('click', async () => {
                const cmdType = pill.dataset.cmd;
                if (cmdType && window.CommandConfigurator) {
                    const command = await window.CommandConfigurator.show(cmdType);
                    if (command && richTextEditor) {
                        richTextEditor.insertCommandToken(command);
                    }
                } else if (pill.dataset.var && richTextEditor) {
                    // Fallback for old data-var attributes
                    richTextEditor.insertCommandToken(pill.dataset.var);
                }
            });
        });

        // New command list items
        document.querySelectorAll('.commands-item').forEach(item => {
            item.addEventListener('click', async () => {
                const cmdType = item.dataset.cmd;
                if (cmdType && window.CommandConfigurator) {
                    const command = await window.CommandConfigurator.show(cmdType);
                    if (command && richTextEditor) {
                        richTextEditor.insertCommandToken(command);
                    }
                }
            });
            // Keyboard support
            item.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.click();
                }
            });
        });

        // Command search functionality
        const cmdSearch = $('cmd-search');
        const cmdList = $('cmd-list');
        if (cmdSearch && cmdList) {
            cmdSearch.addEventListener('input', () => {
                const q = cmdSearch.value.toLowerCase().trim();
                cmdList.querySelectorAll('.commands-item').forEach(item => {
                    // Search in all text content of the item
                    const text = item.textContent.toLowerCase();
                    const match = !q || text.includes(q);
                    item.style.display = match ? '' : 'none';
                });
                // Hide category labels if all items in category are hidden
                cmdList.querySelectorAll('.cmd-category').forEach(category => {
                    const items = category.querySelectorAll('.commands-item');
                    let hasVisibleItems = false;
                    items.forEach(item => {
                        if (item.style.display !== 'none') {
                            hasVisibleItems = true;
                        }
                    });
                    category.style.display = hasVisibleItems || !q ? '' : 'none';
                });
            });
        }

        // Sidebar collapse/expand toggle
        const sidebar = $('main-sidebar');
        const sidebarToggle = $('sidebar-toggle');
        const sidebarExpandBtn = $('sidebar-expand-btn');

        if (sidebar && (sidebarToggle || sidebarExpandBtn)) {
            // Check saved state (initial load)
            const savedSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

            // Smart Helper: Check if we should auto-collapse based on screen size
            const shouldAutoCollapse = window.innerWidth < 1024;

            if (savedSidebarCollapsed || shouldAutoCollapse) {
                sidebar.classList.add('collapsed');
            }

            function toggleSidebar(forceState = null) {
                if (forceState !== null) {
                    sidebar.classList.toggle('collapsed', !forceState); // forceState true = expand, false = collapse. Toggle true = add class (collapse)
                    // Wait, classList.toggle(token, force): if force is true, adds token. If false, removes.
                    // So if forceState is TRUE (Expand), we want 'collapsed' REMOVED. -> toggle('collapsed', false)
                    // If forceState is FALSE (Collapse), we want 'collapsed' ADDED. -> toggle('collapsed', true)
                    sidebar.classList.toggle('collapsed', !forceState);
                } else {
                    sidebar.classList.toggle('collapsed');
                }

                const isCollapsed = sidebar.classList.contains('collapsed');
                localStorage.setItem('sidebarCollapsed', isCollapsed);
            }

            if (sidebarToggle) sidebarToggle.addEventListener('click', () => toggleSidebar());
            if (sidebarExpandBtn) sidebarExpandBtn.addEventListener('click', () => toggleSidebar());

            // 1. Responsive Auto-Collapse
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const width = entry.contentRect.width;
                    if (width < 1024 && !sidebar.classList.contains('collapsed')) {
                        toggleSidebar(false); // Collapse
                    }
                }
            });
            resizeObserver.observe(document.body);

            // 2. Zen Mode (Focus Collapse)
            // We'll attach this to the editor container focus
            const editorContainer = $('rich-editor-container');
            if (editorContainer) {
                editorContainer.addEventListener('focusin', () => {
                    if (!sidebar.classList.contains('collapsed')) {
                        toggleSidebar(false); // Collapse on focus
                    }
                });
            }

            // 3. Dynamic Drawer: Expand on Interaction
            // Clicking anything in the sidebar should expand it
            sidebar.addEventListener('click', (e) => {
                // If we're clicking the toggle button itself, don't double-trigger (it has its own listener)
                if (e.target.closest('#sidebar-toggle')) return;

                // If we're interacting with the sidebar content and it's collapsed, expand it
                if (sidebar.classList.contains('collapsed')) {
                    // But maybe we don't want to expand if just clicking empty space?
                    // Let's expand if clicking nav items
                    if (e.target.closest('.nav-item') || e.target.closest('.collection-item') || e.target.closest('.user-profile')) {
                        toggleSidebar(true); // Force expand
                    }
                }
            });

            // 4. Dynamic Drawer: Collapse on Selection
            // When a snippet is picked from the list, collapse sidebar (zen mode)
            const snippetList = $('snippet-list');
            if (snippetList) {
                snippetList.addEventListener('click', (e) => {
                    if (e.target.closest('.snippet-card')) {
                        // Collapse sidebar to focus on the selected snippet
                        toggleSidebar(false);
                    }
                });
            }
        }
    }

    function showShortcutsModal() {
        toast('⌨️ Shortcuts: Ctrl+N (New), Ctrl+S (Save), Esc (Cancel)');
    }

    // =========================================
    // SECURITY: IMPORT SANITIZATION
    // =========================================

    /**
     * Sanitize snippet content to prevent XSS attacks
     * Removes script tags, event handlers, and dangerous protocols
     */
    function sanitizeSnippetContent(content) {
        if (typeof content !== 'string') return '';

        return content
            // Remove script tags and their contents
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            // Remove event handlers (onclick, onerror, etc.)
            .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '')
            // Remove javascript: protocol
            .replace(/javascript\s*:/gi, '')
            // Remove data: text/html protocol (can execute scripts)
            .replace(/data\s*:\s*text\/html/gi, 'data:text/plain')
            // Remove vbscript: protocol
            .replace(/vbscript\s*:/gi, '');
    }

    /**
     * Validate and sanitize a single imported snippet
     */
    function validateImportedSnippet(snippet, shortcut) {
        if (!snippet || typeof snippet !== 'object') return null;

        return {
            shortcut: String(shortcut || snippet.shortcut || '').slice(0, 100),
            name: String(snippet.name || '').slice(0, 200),
            content: sanitizeSnippetContent(snippet.content || ''),
            collection: String(snippet.collection || '').slice(0, 50),
            favorite: Boolean(snippet.favorite),
            isRichText: Boolean(snippet.isRichText),
            createdAt: Number(snippet.createdAt) || Date.now(),
            updatedAt: Date.now()
        };
    }

    /**
     * Validate import file schema
     */
    function validateImportSchema(data) {
        const errors = [];

        if (!data || typeof data !== 'object') {
            errors.push('Invalid import file format');
            return { valid: false, errors, snippets: {} };
        }

        // Handle both direct snippet objects and wrapped format
        let snippetsObj = data.snippets || data;
        if (typeof snippetsObj !== 'object') {
            errors.push('Missing or invalid snippets object');
            return { valid: false, errors, snippets: {} };
        }

        const validatedSnippets = {};
        let validCount = 0;
        let invalidCount = 0;

        for (const [key, snippet] of Object.entries(snippetsObj)) {
            if (!snippet.shortcut && !key) {
                errors.push(`Skipped snippet without shortcut`);
                invalidCount++;
                continue;
            }

            const validated = validateImportedSnippet(snippet, key);
            if (validated && validated.shortcut) {
                validatedSnippets[validated.shortcut] = validated;
                validCount++;
            } else {
                invalidCount++;
            }
        }

        if (invalidCount > 0) {
            errors.push(`${invalidCount} snippet(s) were invalid and skipped`);
        }

        return {
            valid: validCount > 0,
            errors,
            snippets: validatedSnippets,
            validCount,
            invalidCount
        };
    }

    function importSnippets() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async e => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const imported = JSON.parse(text);

                // Validate and sanitize imported data
                const result = validateImportSchema(imported);

                if (!result.valid) {
                    toast(`Import failed: ${result.errors.join(', ')}`, 'error');
                    return;
                }

                // Merge sanitized snippets
                Object.assign(snippets, result.snippets);
                render();

                // Show success with warnings if any
                if (result.errors.length > 0) {
                    toast(`Imported ${result.validCount} snippets (${result.errors.join(', ')})`, 'success');
                } else {
                    toast(`Imported ${result.validCount} snippets!`, 'success');
                }
            } catch (err) {
                console.error('[TextFlow] Import error:', err);
                toast('Failed to import file: Invalid JSON format', 'error');
            }
        };
        input.click();
    }

    function exportSnippets() {
        const data = JSON.stringify(snippets, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'textflow-snippets.json';
        a.click();
        URL.revokeObjectURL(url);
        toast('Snippets exported!');
    }

    // ===== NAVIGATION =====
    function setFilter(filter) {
        activeFilter = filter;
        activeCollection = null;
        updateNavUI();
        render();
    }

    function setCollection(collection) {
        activeCollection = collection;
        activeFilter = null;
        updateNavUI();
        render();
    }

    function updateNavUI() {
        el.libraryNav?.querySelectorAll('.nav-item').forEach(i =>
            i.classList.toggle('active', i.dataset.filter === activeFilter));
        el.collectionsNav?.querySelectorAll('.collection-item').forEach(i =>
            i.classList.toggle('active', i.dataset.collection === activeCollection));

        const names = {
            all: 'All Snippets',
            favorites: 'Favorites',
            recent: 'Recently Used',
            trash: 'Trash'
        };
        const col = collections.find(c => c.id === activeCollection);
        if (el.categoryName) {
            el.categoryName.textContent = col?.name || names[activeFilter] || 'All Snippets';
        }
    }

    // ===== RENDER =====
    function render() {
        if (activeFilter === 'trash') {
            renderTrash();
            return;
        }
        const q = el.searchInput?.value?.toLowerCase().trim() || '';
        let arr = Object.values(snippets);

        if (activeCollection) arr = arr.filter(s => s.collection === activeCollection);
        if (activeFilter === 'favorites') arr = arr.filter(s => s.favorite);
        if (activeFilter === 'recent') arr = arr.slice(0, 10);
        if (q) arr = arr.filter(s =>
            s.shortcut?.includes(q) || s.content?.includes(q) || s.name?.toLowerCase().includes(q)
        );

        arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        if (el.countAll) el.countAll.textContent = Object.keys(snippets).length;

        if (arr.length === 0) {
            el.snippetList?.classList.add('hidden');
            el.emptyState?.classList.remove('hidden');
            return;
        }

        el.snippetList?.classList.remove('hidden');
        el.emptyState?.classList.add('hidden');

        if (el.snippetList) {
            el.snippetList.innerHTML = arr.map(s => `
                <div class="snippet-card ${editingSnippet?.shortcut === s.shortcut ? 'selected' : ''}" data-shortcut="${esc(s.shortcut)}">
                    <div class="drag-handle">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                            <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                        </svg>
                    </div>
                    <div class="snippet-content">
                        <div class="snippet-name">${esc(s.name || s.shortcut)}${s.isRichText ? '<span class="rich-text-indicator" title="Rich Text">✨</span>' : ''}</div>
                        <div class="snippet-meta">
                            <span class="shortcut-badge">${esc(s.shortcut)}</span>
                            ${s.collection ? `<span class="category-badge">${esc(s.collection)}</span>` : ''}
                        </div>
                    </div>
                    <button class="favorite-btn ${s.favorite ? 'active' : ''}" data-action="fav">
                        <svg viewBox="0 0 24 24" fill="${s.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </button>
                </div>
            `).join('');

            // Attach handlers
            el.snippetList.querySelectorAll('.snippet-card').forEach(card => {
                const sc = card.dataset.shortcut;

                card.addEventListener('click', e => {
                    if (e.target.closest('.favorite-btn')) {
                        toggleFav(sc);
                    } else if (!e.target.closest('.drag-handle')) {
                        select(sc);
                    }
                });

                // Drag start
                card.addEventListener('mousedown', e => {
                    if (e.target.closest('.favorite-btn')) return;

                    dragState.startX = e.clientX;
                    dragState.startY = e.clientY;
                    dragState.snippet = sc;

                    const onMove = ev => {
                        const dx = Math.abs(ev.clientX - dragState.startX);
                        const dy = Math.abs(ev.clientY - dragState.startY);

                        if (dx > 5 || dy > 5) {
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                            startDrag(sc, card, ev);
                        }
                    };

                    const onUp = () => {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    };

                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            });
        }
    }

    // ===== DRAG AND DROP =====
    function startDrag(shortcut, card, e) {
        const s = snippets[shortcut];
        if (!s) return;

        dragState.isDragging = true;
        dragState.snippet = shortcut;

        // Create ghost
        dragState.ghost = document.createElement('div');
        dragState.ghost.className = 'drag-ghost';
        dragState.ghost.innerHTML = `
            <div class="ghost-name">${esc(s.name || shortcut)}</div>
            <span class="ghost-badge">${esc(shortcut)}</span>
        `;
        document.body.appendChild(dragState.ghost);
        moveGhost(e.clientX, e.clientY);

        // Mark card as dragging
        card.classList.add('dragging');

        // Show targets
        el.trashDropZone?.classList.add('visible');
        el.collectionsNav?.querySelectorAll('.collection-item').forEach(c => c.classList.add('drop-target'));

        // Listeners
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);

        // Haptic
        if (navigator.vibrate) navigator.vibrate(10);
    }

    function onDragMove(e) {
        if (!dragState.isDragging) return;
        moveGhost(e.clientX, e.clientY);

        // Highlight targets
        const elem = document.elementFromPoint(e.clientX, e.clientY);

        el.collectionsNav?.querySelectorAll('.collection-item').forEach(c => {
            c.classList.toggle('drop-hover', c.contains(elem) || c === elem);
        });

        el.trashDropZone?.classList.toggle('drop-hover',
            el.trashDropZone.contains(elem) || el.trashDropZone === elem);
    }

    function onDragEnd(e) {
        if (!dragState.isDragging) return;

        const elem = document.elementFromPoint(e.clientX, e.clientY);

        // Check drop on collection
        const collectionItem = elem?.closest('.collection-item');
        if (collectionItem && dragState.snippet) {
            const newCol = collectionItem.dataset.collection;
            moveToCollection(dragState.snippet, newCol);
        }

        // Check drop on trash
        if (el.trashDropZone?.contains(elem) || el.trashDropZone === elem) {
            if (dragState.snippet) del(dragState.snippet);
        }

        endDrag();
    }

    function moveGhost(x, y) {
        if (dragState.ghost) {
            dragState.ghost.style.left = (x + 12) + 'px';
            dragState.ghost.style.top = (y + 12) + 'px';
        }
    }

    function endDrag() {
        dragState.isDragging = false;

        // Remove ghost
        dragState.ghost?.remove();
        dragState.ghost = null;

        // Clean up UI
        document.querySelectorAll('.snippet-card.dragging').forEach(c => c.classList.remove('dragging'));
        el.trashDropZone?.classList.remove('visible', 'drop-hover');
        el.collectionsNav?.querySelectorAll('.collection-item').forEach(c =>
            c.classList.remove('drop-target', 'drop-hover'));

        // Remove listeners
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);

        dragState.snippet = null;
    }

    async function moveToCollection(shortcut, newCollection) {
        const s = snippets[shortcut];
        if (!s) return;

        s.collection = newCollection;
        s.updatedAt = Date.now();

        try {
            await chrome.runtime.sendMessage({ type: 'SAVE_SNIPPET', payload: s });
        } catch (e) { }

        const col = collections.find(c => c.id === newCollection);
        toast(`Moved to "${col?.name || newCollection}"`);

        render();

        // Animate
        setTimeout(() => {
            const card = document.querySelector(`[data-shortcut="${shortcut}"]`);
            if (card) {
                card.classList.add('drop-success');
                setTimeout(() => card.classList.remove('drop-success'), 400);
            }
        }, 50);
    }

    // ===== MODALS =====
    function openModal(editingId = null) {
        editingCollectionId = editingId;
        el.collectionModal?.classList.remove('hidden');
        el.collectionNameInput?.focus();

        if (editingId) {
            // Edit Mode
            const col = collections.find(c => c.id === editingId);
            if (col) {
                if (el.modalTitle) el.modalTitle.textContent = 'Edit Collection';
                if (el.modalCreate) el.modalCreate.textContent = 'Update Collection';
                if (el.collectionNameInput) el.collectionNameInput.value = col.name;
                selectedColor = col.color || 'green';
            }
        } else {
            // Create Mode
            if (el.modalTitle) el.modalTitle.textContent = 'New Collection';
            if (el.modalCreate) el.modalCreate.textContent = 'Create Collection';
            if (el.collectionNameInput) el.collectionNameInput.value = '';
            selectedColor = 'green';
        }

        // Set color selection
        el.colorPicker?.querySelectorAll('.color-option').forEach(o =>
            o.classList.toggle('selected', o.dataset.color === selectedColor));
    }

    function closeModal() {
        el.collectionModal?.classList.add('hidden');
        editingCollectionId = null;
    }

    function createCollection() {
        const name = el.collectionNameInput?.value.trim();
        if (!name) { toast('Enter a name', 'error'); return; }

        if (editingCollectionId) {
            // Update existing
            const col = collections.find(c => c.id === editingCollectionId);
            if (col) {
                // Check if name is taken by ANOTHER collection
                // (We allow keeping same name if only color changed)
                // Actually, duplicate names are allowed for different IDs, 
                // but usually we want unique names. But let's check duplicates
                const duplicate = collections.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingCollectionId);
                if (duplicate) { toast('Name already exists', 'error'); return; }

                col.name = name;
                col.color = selectedColor;

                // We keep the same ID for stability

                renderCollections();
                updateCollectionDropdown();
                closeModal();
                toast(`Updated "${name}"`);
            }
        } else {
            // Create new
            const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            if (collections.some(c => c.id === id)) { toast('Already exists', 'error'); return; }

            collections.push({ id, name, color: selectedColor });
            renderCollections();
            updateCollectionDropdown();
            closeModal();
            toast(`Created "${name}"`);
        }
    }

    function renderCollections() {
        if (!el.collectionsNav) return;
        el.collectionsNav.innerHTML = collections.map(c => `
            <button class="collection-item ${activeCollection === c.id ? 'active' : ''}" data-collection="${esc(c.id)}" data-tooltip="${esc(c.name)}">
                <span class="collection-dot ${c.color}"></span>
                <span>${esc(c.name)}</span>
            </button>
        `).join('');
    }

    function updateCollectionDropdown() {
        if (!el.inputCollection) return;
        el.inputCollection.innerHTML = '<option value="">No collection</option>' +
            collections.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    }

    function toggleCollectionsCollapsed() {
        const section = document.getElementById('collections-section');
        if (!section) return;
        collectionsCollapsed = !collectionsCollapsed;
        section.classList.toggle('collapsed', collectionsCollapsed);
    }

    // ===== TRASH / RECYCLE BIN =====
    function renderTrash() {
        if (!el.snippetList) return;

        el.emptyState?.classList.add('hidden');
        el.snippetList.classList.remove('hidden');

        const hasDeletedCollections = deletedCollections.length > 0;
        const hasDeletedSnippets = deletedSnippets.length > 0;

        if (!hasDeletedCollections && !hasDeletedSnippets) {
            el.snippetList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🗑️</div>
                    <div class="empty-title">Trash is empty</div>
                    <div class="empty-desc">Deleted snippets and collections will appear here.</div>
                </div>
            `;
            return;
        }

        el.snippetList.innerHTML = `
            <div class="trash-header">
                <span class="category-name">Trash</span>
                <button class="btn btn-secondary" id="empty-trash-btn">
                    Empty Trash
                </button>
            </div>
            ${hasDeletedCollections ? `
                <div class="trash-section-title">Deleted Collections</div>
                ${deletedCollections.map(c => `
                    <div class="snippet-card" data-trash-collection="${esc(c.id)}">
                        <div class="snippet-content">
                            <div class="snippet-name">
                                ${esc(c.name)} <span class="trash-badge">Collection</span>
                            </div>
                            <div class="snippet-meta">
                                <span class="shortcut-badge">${esc(c.id)}</span>
                                ${Array.isArray(c.snippetShortcuts) && c.snippetShortcuts.length
                ? `<span class="category-badge">${c.snippetShortcuts.length} snippet${c.snippetShortcuts.length > 1 ? 's' : ''}</span>`
                : ''}
                            </div>
                        </div>
                        <div class="editor-actions">
                            <button class="btn btn-secondary" data-action="restore-collection">Restore</button>
                            <button class="btn btn-danger" data-action="delete-collection">Delete</button>
                        </div>
                    </div>
                `).join('')}
            ` : ''}

            ${hasDeletedSnippets ? `
                <div class="trash-section-title">Deleted Snippets</div>
                ${deletedSnippets.map(s => `
                    <div class="snippet-card" data-trash-snippet="${esc(s.shortcut)}">
                        <div class="snippet-content">
                            <div class="snippet-name">
                                ${esc(s.name || s.shortcut)} <span class="trash-badge">Snippet</span>
                            </div>
                            <div class="snippet-meta">
                                <span class="shortcut-badge">${esc(s.shortcut)}</span>
                                ${s.collection ? `<span class="category-badge">${esc(s.collection)}</span>` : ''}
                            </div>
                        </div>
                        <div class="editor-actions">
                            <button class="btn btn-secondary" data-action="restore-snippet">Restore</button>
                            <button class="btn btn-danger" data-action="delete-snippet">Delete</button>
                        </div>
                    </div>
                `).join('')}
            ` : ''}
        `;

        // Wire actions
        const emptyBtn = el.snippetList.querySelector('#empty-trash-btn');
        emptyBtn?.addEventListener('click', () => {
            if (!confirm('Permanently delete all items in Trash?')) return;
            deletedSnippets = [];
            deletedCollections = [];
            renderTrash();
            toast('Trash emptied');
        });

        el.snippetList.querySelectorAll('[data-trash-snippet]').forEach(card => {
            const sc = card.getAttribute('data-trash-snippet');
            card.querySelector('[data-action="restore-snippet"]')?.addEventListener('click', () => {
                restoreSnippetFromTrash(sc);
            });
            card.querySelector('[data-action="delete-snippet"]')?.addEventListener('click', () => {
                deleteSnippetForever(sc);
            });
        });

        el.snippetList.querySelectorAll('[data-trash-collection]').forEach(card => {
            const id = card.getAttribute('data-trash-collection');
            card.querySelector('[data-action="restore-collection"]')?.addEventListener('click', () => {
                restoreCollectionFromTrash(id);
            });
            card.querySelector('[data-action="delete-collection"]')?.addEventListener('click', () => {
                deleteCollectionForever(id);
            });
        });
    }

    async function restoreSnippetFromTrash(shortcut) {
        if (!shortcut) return;
        const idx = deletedSnippets.findIndex(s => s.shortcut === shortcut);
        if (idx === -1) return;
        const snippet = deletedSnippets[idx];
        try {
            await chrome.runtime.sendMessage({ type: 'SAVE_SNIPPET', payload: snippet });
        } catch (e) { }
        snippets[shortcut] = snippet;
        deletedSnippets.splice(idx, 1);
        renderTrash();
        toast(`Restored "${snippet.name || shortcut}"`);
    }

    function deleteSnippetForever(shortcut) {
        if (!shortcut) return;
        deletedSnippets = deletedSnippets.filter(s => s.shortcut !== shortcut);
        renderTrash();
    }

    function restoreCollectionFromTrash(id) {
        if (!id) return;
        const idx = deletedCollections.findIndex(c => c.id === id);
        if (idx === -1) return;
        const col = deletedCollections[idx];
        // Restore collection
        collections.push({ id: col.id, name: col.name, color: col.color });

        // Restore snippet collection assignments if snippets still exist
        if (Array.isArray(col.snippetShortcuts)) {
            col.snippetShortcuts.forEach(sc => {
                if (snippets[sc]) {
                    snippets[sc].collection = id;
                }
            });
        }

        deletedCollections.splice(idx, 1);
        renderCollections();
        updateCollectionDropdown();
        renderTrash();
        toast(`Restored collection "${col.name || id}"`);
    }

    function deleteCollectionForever(id) {
        if (!id) return;
        deletedCollections = deletedCollections.filter(c => c.id !== id);
        renderTrash();
    }

    // ===== EDITOR =====
    function select(shortcut) {
        editingSnippet = snippets[shortcut];
        isCreating = false;
        showEditor();
    }

    function createNew() {
        editingSnippet = null;
        isCreating = true;
        showEditor();
    }

    // Helper to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showEditor() {
        el.editorPlaceholder?.classList.add('hidden');
        el.editorContainer?.classList.remove('hidden');

        // Determine if we should use rich text mode
        const useRichText = editingSnippet?.isRichText || false;

        if (isCreating) {
            if (el.editorTitle) el.editorTitle.textContent = 'New Snippet';
            if (el.inputName) el.inputName.value = '';
            if (el.inputShortcut) { el.inputShortcut.value = ''; el.inputShortcut.disabled = false; }
            if (el.inputCollection) el.inputCollection.value = activeCollection || '';

            // Clear content
            if (richTextEditor) {
                richTextEditor.setContent('');
            }

            // Show delete button but disable it for new snippets
            if (el.deleteBtn) {
                el.deleteBtn.classList.remove('hidden');
                el.deleteBtn.disabled = true;
                el.deleteBtn.style.opacity = '0.5';
                el.deleteBtn.style.cursor = 'not-allowed';
            }
        } else if (editingSnippet) {
            // Enable delete button FIRST to ensure it's active regardless of editor errors
            if (el.deleteBtn) {
                el.deleteBtn.classList.remove('hidden');
                el.deleteBtn.disabled = false;
                el.deleteBtn.style.opacity = '1';
                el.deleteBtn.style.cursor = 'pointer';
            }

            if (el.editorTitle) el.editorTitle.textContent = 'Edit Snippet';
            if (el.inputName) el.inputName.value = editingSnippet.name || '';
            if (el.inputShortcut) { el.inputShortcut.value = editingSnippet.shortcut; el.inputShortcut.disabled = false; }
            if (el.inputCollection) el.inputCollection.value = editingSnippet.collection || '';

            // Set content to rich editor
            if (!richTextEditor) initRichTextEditor();
            if (richTextEditor) {
                let content = editingSnippet.content || '';
                // If content doesn't look like HTML and isn't marked as rich, wrap in paragraph
                if (!editingSnippet.isRichText && !content.includes('<')) {
                    content = `<p>${escapeHtml(content).replace(/\n/g, '</p><p>')}</p>`;
                }
                // Set content synchronously to avoid race conditions
                try {
                    richTextEditor.setContent(content);
                } catch (e) {
                    console.error('Error setting editor content:', e);
                }
            }
        }

        el.inputName?.focus();
        render();
    }

    function closeEditor() {
        el.editorPlaceholder?.classList.remove('hidden');
        el.editorContainer?.classList.add('hidden');
        editingSnippet = null;
        isCreating = false;
        render();
    }





    async function save() {
        const sc = el.inputShortcut?.value.trim();

        // Get content from the active editor
        let content = '';
        const isRichText = true;

        if (richTextEditor) {
            content = richTextEditor.getContent();
        }

        const name = el.inputName?.value.trim();

        if (!sc) { toast('Shortcut required', 'error'); el.inputShortcut?.focus(); return; }
        if (sc.length < 2) { toast('Shortcut too short', 'error'); return; }
        if (!content) { toast('Content required', 'error'); return; }

        // Check if shortcut already exists (but not if it's the same snippet being edited)
        const oldShortcut = editingSnippet?.shortcut;
        if (snippets[sc] && sc !== oldShortcut) {
            toast('Shortcut already exists', 'error');
            return;
        }

        const snippet = {
            shortcut: sc,
            content,
            name: name || undefined,
            collection: el.inputCollection?.value || undefined,
            favorite: editingSnippet?.favorite || false,
            isRichText: isRichText, // NEW: Flag for rich text content
            createdAt: editingSnippet?.createdAt || Date.now(),
            updatedAt: Date.now(),
        };

        // If editing and shortcut changed, delete the old one first
        if (oldShortcut && oldShortcut !== sc) {
            try { await chrome.runtime.sendMessage({ type: 'DELETE_SNIPPET', payload: oldShortcut }); } catch (e) { }
            delete snippets[oldShortcut];
        }

        try { await chrome.runtime.sendMessage({ type: 'SAVE_SNIPPET', payload: snippet }); } catch (e) { }
        snippets[sc] = snippet;
        toast(`Saved "${name || sc}"`);
        closeEditor();
    }

    async function toggleFav(sc) {
        const s = snippets[sc];
        if (!s) return;
        s.favorite = !s.favorite;
        s.updatedAt = Date.now();
        try { await chrome.runtime.sendMessage({ type: 'SAVE_SNIPPET', payload: s }); } catch (e) { }
        render();
    }

    async function del(sc) {
        const s = snippets[sc];
        if (!s) return;
        deletedSnippet = { ...s };

        // Push into recycle bin
        deletedSnippets.push({
            ...s,
            deletedAt: Date.now(),
        });

        try { await chrome.runtime.sendMessage({ type: 'DELETE_SNIPPET', payload: sc }); } catch (e) { }
        delete snippets[sc];
        closeEditor();
        toast(`Moved "${s.name || sc}" to Trash`, 'success', true);
    }

    async function undoDel() {
        if (!deletedSnippet) return;
        try { await chrome.runtime.sendMessage({ type: 'SAVE_SNIPPET', payload: deletedSnippet }); } catch (e) { }
        snippets[deletedSnippet.shortcut] = deletedSnippet;
        // Remove from recycle bin if present
        deletedSnippets = deletedSnippets.filter(s => s.shortcut !== deletedSnippet.shortcut);
        render();
        hideToast();
        deletedSnippet = null;
    }

    // ===== TOAST =====
    function toast(msg, type = 'success', undo = false) {
        if (el.toastMessage) el.toastMessage.textContent = msg;
        el.toast?.classList.remove('hidden', 'error');
        if (type === 'error') el.toast?.classList.add('error');
        el.toastAction?.classList.toggle('hidden', !undo);
        setTimeout(hideToast, undo ? 5000 : 3000);
    }

    function hideToast() { el.toast?.classList.add('hidden'); }

    // ===== UTILS =====
    function softDeleteCollection(id) {
        if (!id) return;
        const colIndex = collections.findIndex(c => c.id === id);
        if (colIndex === -1) return;
        const col = collections[colIndex];
        const name = col.name || id;

        // Soft delete into recycle bin
        const attachedSnippets = Object.values(snippets)
            .filter(s => s.collection === id)
            .map(s => s.shortcut);

        deletedCollections.push({
            ...col,
            deletedAt: Date.now(),
            snippetShortcuts: attachedSnippets,
        });

        collections.splice(colIndex, 1);
        Object.values(snippets).forEach(s => {
            if (s.collection === id) {
                delete s.collection;
            }
        });
        if (activeCollection === id) {
            activeCollection = null;
        }
        renderCollections();
        updateCollectionDropdown();
        render();
        toast(`Moved "${name}" to Trash`);
    }

    function esc(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ===== START =====
    init();
})();
