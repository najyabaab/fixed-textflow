/**
 * Enhanced Popup Script - TextFlow
 * Clean, minimal implementation
 */

(function () {
  'use strict';

  // ===== State =====
  let state = {
    snippets: {},
    filteredSnippets: [],
    selectedIndex: 0,
    isEnabled: true,
    deletedSnippet: null,
  };

  // ===== DOM Elements =====
  const el = {
    statusBadge: document.getElementById('status-badge'),
    searchInput: document.getElementById('search-input'),
    content: document.getElementById('content'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('empty-state'),
    snippetsList: document.getElementById('snippets-list'),
    settingsBtn: document.getElementById('settings-btn'),
    dashboardBtn: document.getElementById('dashboard-btn'),
    newBtn: document.getElementById('new-btn'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
    toastAction: document.getElementById('toast-action'),
  };

  // ===== Utilities =====
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function truncate(str, length) {
    if (!str) return '';
    const clean = str.replace(/\n/g, ' ').trim();
    return clean.length > length ? clean.slice(0, length) + '...' : clean;
  }

  // ===== Data Loading =====
  async function loadData() {
    try {
      const [snippetsRes, settingsRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_SNIPPETS' }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
      ]);

      state.snippets = snippetsRes?.snippets || {};
      state.isEnabled = settingsRes?.settings?.enabled !== false;

      updateStatusUI();
      filterAndRender();
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load snippets', 'error');
    } finally {
      el.loading.classList.add('hidden');
    }
  }

  // ===== UI Updates =====
  function updateStatusUI() {
    const badge = el.statusBadge;
    if (state.isEnabled) {
      badge.innerHTML = '<span class="status-dot"></span>Active';
      badge.style.background = 'rgba(34, 197, 94, 0.1)';
      badge.style.borderColor = 'rgba(34, 197, 94, 0.2)';
      badge.style.color = '#4ade80';
    } else {
      badge.innerHTML = '<span class="status-dot"></span>Paused';
      badge.style.background = 'rgba(251, 146, 60, 0.1)';
      badge.style.borderColor = 'rgba(251, 146, 60, 0.2)';
      badge.style.color = '#fb923c';
    }
  }

  function filterAndRender() {
    const query = el.searchInput.value.toLowerCase().trim();
    const snippetArray = Object.values(state.snippets);

    if (query) {
      state.filteredSnippets = snippetArray.filter(s =>
        s.shortcut.toLowerCase().includes(query) ||
        s.content.toLowerCase().includes(query) ||
        (s.name && s.name.toLowerCase().includes(query))
      );
    } else {
      state.filteredSnippets = snippetArray;
    }

    // Sort by most recent
    state.filteredSnippets.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    state.selectedIndex = 0;

    renderSnippets();
  }

  function renderSnippets() {
    // No snippets at all
    if (Object.keys(state.snippets).length === 0) {
      el.snippetsList.classList.add('hidden');
      el.emptyState.classList.remove('hidden');
      return;
    }

    // Has snippets
    el.emptyState.classList.add('hidden');
    el.snippetsList.classList.remove('hidden');

    // No results for search
    if (state.filteredSnippets.length === 0) {
      el.snippetsList.innerHTML = `
        <div class="empty-state" style="height: auto; padding: 40px 20px;">
          <div class="empty-title" style="font-size: 14px;">No matches found</div>
          <div class="empty-desc" style="font-size: 13px;">Try a different search term</div>
        </div>
      `;
      return;
    }

    el.snippetsList.innerHTML = state.filteredSnippets.map((snippet, index) => `
      <div class="snippet-card ${index === state.selectedIndex ? 'selected' : ''}" 
           data-shortcut="${escapeHtml(snippet.shortcut)}"
           data-index="${index}">
        <span class="snippet-shortcut">${escapeHtml(snippet.shortcut)}</span>
        <div class="snippet-info">
          <div class="snippet-name">${escapeHtml(snippet.name || snippet.shortcut)}</div>
          <div class="snippet-preview">${escapeHtml(truncate(snippet.content, 40))}</div>
        </div>
        <div class="snippet-actions">
          <button class="snippet-action copy-btn" title="Copy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button class="snippet-action delete delete-btn" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // Add click handlers
    el.snippetsList.querySelectorAll('.snippet-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const shortcut = card.dataset.shortcut;
        if (e.target.closest('.delete-btn')) {
          deleteSnippet(shortcut);
        } else {
          copySnippet(shortcut);
        }
      });
    });
  }

  function updateSelection() {
    const cards = el.snippetsList.querySelectorAll('.snippet-card');
    cards.forEach((card, i) => {
      card.classList.toggle('selected', i === state.selectedIndex);
      if (i === state.selectedIndex) {
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  // ===== Actions =====
  async function copySnippet(shortcut) {
    const snippet = state.snippets[shortcut];
    if (!snippet) return;

    try {
      await navigator.clipboard.writeText(snippet.content);
      showToast(`Copied "${shortcut}"`, 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  }

  async function deleteSnippet(shortcut) {
    const snippet = state.snippets[shortcut];
    if (!snippet) return;

    state.deletedSnippet = { ...snippet };

    try {
      await chrome.runtime.sendMessage({ type: 'DELETE_SNIPPET', payload: shortcut });
      delete state.snippets[shortcut];
      filterAndRender();
      showToast(`Deleted "${shortcut}"`, 'success', true);
    } catch {
      showToast('Failed to delete', 'error');
      state.deletedSnippet = null;
    }
  }

  async function undoDelete() {
    if (!state.deletedSnippet) return;

    try {
      await chrome.runtime.sendMessage({ type: 'SAVE_SNIPPET', payload: state.deletedSnippet });
      state.snippets[state.deletedSnippet.shortcut] = state.deletedSnippet;
      filterAndRender();
      hideToast();
      showToast('Restored', 'success');
    } catch {
      showToast('Failed to restore', 'error');
    } finally {
      state.deletedSnippet = null;
    }
  }

  // ===== Toast =====
  let toastTimeout;

  function showToast(message, type = 'success', showUndo = false) {
    clearTimeout(toastTimeout);
    el.toastMessage.textContent = message;
    el.toastAction.classList.toggle('hidden', !showUndo);
    el.toast.classList.add('show');
    toastTimeout = setTimeout(hideToast, showUndo ? 5000 : 3000);
  }

  function hideToast() {
    el.toast.classList.remove('show');
    clearTimeout(toastTimeout);
  }

  // ===== Keyboard Navigation =====
  function handleKeydown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        state.selectedIndex = Math.min(state.selectedIndex + 1, state.filteredSnippets.length - 1);
        updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
        updateSelection();
        break;

      case 'Enter':
        if (state.filteredSnippets[state.selectedIndex]) {
          e.preventDefault();
          copySnippet(state.filteredSnippets[state.selectedIndex].shortcut);
        }
        break;

      case 'Escape':
        window.close();
        break;

      case '/':
        if (document.activeElement !== el.searchInput) {
          e.preventDefault();
          el.searchInput.focus();
          el.searchInput.select();
        }
        break;
    }
  }

  // ===== Event Listeners =====
  function setupEventListeners() {
    el.searchInput.addEventListener('input', filterAndRender);
    document.addEventListener('keydown', handleKeydown);

    el.settingsBtn?.addEventListener('click', () => chrome.runtime.openOptionsPage());
    el.dashboardBtn?.addEventListener('click', () => chrome.runtime.openOptionsPage());
    el.newBtn?.addEventListener('click', () => chrome.runtime.openOptionsPage());
    el.toastAction?.addEventListener('click', undoDelete);
  }

  // ===== Init =====
  async function init() {
    setupEventListeners();
    await loadData();
    el.searchInput.focus();
  }

  init();
})();
