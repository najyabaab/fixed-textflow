// Settings Page JavaScript
// All event listeners use IDs for Chrome extension CSP compliance

document.addEventListener('DOMContentLoaded', function () {
    console.log('Settings page loaded');

    // Cache DOM elements
    const elements = {
        // Navigation
        navGeneral: document.getElementById('nav-general'),
        navAppearance: document.getElementById('nav-appearance'),
        navShortcuts: document.getElementById('nav-shortcuts'),
        navBackup: document.getElementById('nav-backup'),
        navPrivacy: document.getElementById('nav-privacy'),
        navAbout: document.getElementById('nav-about'),

        // Tabs
        tabGeneral: document.getElementById('tab-general'),
        tabAppearance: document.getElementById('tab-appearance'),
        tabShortcuts: document.getElementById('tab-shortcuts'),
        tabBackup: document.getElementById('tab-backup'),
        tabPrivacy: document.getElementById('tab-privacy'),
        tabAbout: document.getElementById('tab-about'),

        // Header
        pageTitle: document.getElementById('pageTitle'),
        pageDescription: document.getElementById('pageDescription'),

        // Settings inputs
        enableExpansion: document.getElementById('enableExpansion'),
        caseMatching: document.getElementById('caseMatching'),
        soundEffects: document.getElementById('soundEffects'),
        triggerKey: document.getElementById('triggerKey'),
        expansionDelay: document.getElementById('expansionDelay'),
        fontSize: document.getElementById('fontSize'),
        compactMode: document.getElementById('compactMode'),
        analytics: document.getElementById('analytics'),
        crashReports: document.getElementById('crashReports'),

        // Sync toggle
        syncEnabled: document.getElementById('syncEnabled'),
        syncStatusBadge: document.getElementById('sync-status-badge'),

        // Buttons
        btnSave: document.getElementById('btn-save'),
        btnReset: document.getElementById('btn-reset'),
        btnExport: document.getElementById('btn-export'),
        btnImport: document.getElementById('btn-import'),
        btnClearStart: document.getElementById('btn-clear-start'),
        btnClear: document.getElementById('btn-clear'),
        deleteConfirmInput: document.getElementById('delete-confirm-input'),
        deleteConfirmPanel: document.getElementById('delete-confirm-panel'),
        btnCancelClear: document.getElementById('btn-cancel-clear'),

        // Theme options
        themeLight: document.getElementById('theme-light'),
        themeDark: document.getElementById('theme-dark'),
        themeSystem: document.getElementById('theme-system'),

        // Stats
        totalSnippets: document.getElementById('totalSnippets'),
        totalExpansions: document.getElementById('totalExpansions'),
        timeSaved: document.getElementById('timeSaved'),

        // Toast
        toast: document.getElementById('toast'),

        // About links
        aboutWebsite: document.getElementById('about-link-website'),
        aboutDocs: document.getElementById('about-link-docs'),
        aboutGitHub: document.getElementById('about-link-github'),
    };

    // Tab configuration
    const tabs = {
        general: {
            title: 'General Settings',
            desc: 'Configure text expansion behavior and preferences',
            nav: elements.navGeneral,
            content: elements.tabGeneral
        },
        appearance: {
            title: 'Appearance',
            desc: 'Customize the look and feel of TextFlow',
            nav: elements.navAppearance,
            content: elements.tabAppearance
        },
        shortcuts: {
            title: 'Keyboard Shortcuts',
            desc: 'View and customize keyboard shortcuts',
            nav: elements.navShortcuts,
            content: elements.tabShortcuts
        },
        backup: {
            title: 'Backup & Sync',
            desc: 'Export and import your data',
            nav: elements.navBackup,
            content: elements.tabBackup
        },
        privacy: {
            title: 'Privacy',
            desc: 'Manage your privacy settings and data',
            nav: elements.navPrivacy,
            content: elements.tabPrivacy
        },
        about: {
            title: 'About',
            desc: 'Information about TextFlow Expander',
            nav: elements.navAbout,
            content: elements.tabAbout
        }
    };


    // Stats counters (no heavy animations for better performance)
    async function animateCounters() {
        const counters = document.querySelectorAll('.counter');
        if (counters.length === 0) return;

        let totalSnippets = 0;
        let expansions = 0;

        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                // Add timeout to prevent hanging if background script is asleep/slow
                const fetchStats = new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ type: 'GET_SNIPPETS' }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(response);
                        }
                    });
                });

                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000));

                const res = await Promise.race([fetchStats, timeout]);
                const map = res?.snippets || {};
                const arr = Object.values(map);
                totalSnippets = arr.length;
                expansions = arr.reduce((sum, s) => sum + (s.usageCount || 0), 0);
            }
        } catch (e) {
            console.warn('Failed to load snippet stats from background (using fallback):', e);
        }

        // Fallback to legacy localStorage data if extension messaging is unavailable or timed out
        if (!totalSnippets && !expansions) {
            const lsSnippets = JSON.parse(localStorage.getItem('textflow-snippets') || '[]');
            const stats = JSON.parse(localStorage.getItem('textflow-stats') || '{"expansions": 0, "savedTime": 0}');
            totalSnippets = lsSnippets.length;
            expansions = stats.expansions || 0;
        }

        // Calculate hours: savedTime is not stored per snippet, so estimate
        const hours = (expansions * 5) / 3600; // 5 seconds saved per expansion
        const hoursText = hours.toFixed(1);

        if (counters[0]) counters[0].innerText = totalSnippets;
        if (counters[1]) counters[1].innerText = expansions;
        if (counters[2]) counters[2].innerText = hoursText;
    }

    // Switch tab function
    function switchTab(tabName) {
        console.log('Switching to tab:', tabName);

        // Remove active from all nav items and tabs
        Object.values(tabs).forEach(tab => {
            if (tab.nav) tab.nav.classList.remove('active');
            if (tab.content) tab.content.classList.remove('active');
        });

        // Add active to selected tab
        const selectedTab = tabs[tabName];
        if (selectedTab) {
            if (selectedTab.nav) selectedTab.nav.classList.add('active');
            if (selectedTab.content) selectedTab.content.classList.add('active');
            if (elements.pageTitle) elements.pageTitle.textContent = selectedTab.title;
            if (elements.pageDescription) elements.pageDescription.textContent = selectedTab.desc;

            // Trigger animation if about tab
            if (tabName === 'about') {
                setTimeout(animateCounters, 100);
            }
        }
    }

    // Add click listeners to navigation
    Object.entries(tabs).forEach(([tabName, tab]) => {
        if (tab.nav) {
            tab.nav.addEventListener('click', function () {
                switchTab(tabName);
            });
        }
    });

    // Theme selection
    function setTheme(theme) {
        console.log('Setting theme:', theme);

        [elements.themeLight, elements.themeDark, elements.themeSystem].forEach(el => {
            if (el) el.classList.remove('active');
        });

        if (theme === 'light' && elements.themeLight) elements.themeLight.classList.add('active');
        if (theme === 'dark' && elements.themeDark) elements.themeDark.classList.add('active');
        if (theme === 'system' && elements.themeSystem) elements.themeSystem.classList.add('active');

        localStorage.setItem('textflow-theme', theme);
        showToast('Theme updated to ' + theme + '!');
    }

    // Theme click listeners
    if (elements.themeLight) {
        elements.themeLight.addEventListener('click', function () {
            setTheme('light');
        });
    }
    if (elements.themeDark) {
        elements.themeDark.addEventListener('click', function () {
            setTheme('dark');
        });
    }
    if (elements.themeSystem) {
        elements.themeSystem.addEventListener('click', function () {
            setTheme('system');
        });
    }

    // About links
    if (elements.aboutWebsite) {
        elements.aboutWebsite.addEventListener('click', function (e) {
            e.preventDefault();
            // Treat "Website" as the main dashboard / options page
            if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                showToast('Website not available in this build.', 'error');
            }
        });
    }

    if (elements.aboutDocs) {
        elements.aboutDocs.addEventListener('click', function (e) {
            e.preventDefault();
            // Open local COMMANDS.md as documentation if present
            if (chrome && chrome.runtime && chrome.runtime.getURL) {
                const url = chrome.runtime.getURL('COMMANDS.md');
                chrome.tabs && chrome.tabs.create
                    ? chrome.tabs.create({ url })
                    : window.open(url, '_blank');
            } else {
                showToast('Documentation not available in this build.', 'error');
            }
        });
    }

    if (elements.aboutGitHub) {
        elements.aboutGitHub.addEventListener('click', function (e) {
            e.preventDefault();
            // No GitHub URL baked into this local build
            showToast('Source is this local project. GitHub link not configured.', 'success');
        });
    }

    // Save settings via background script
    async function saveSettings() {
        console.log('Saving settings...');

        const settings = {
            enabled: elements.enableExpansion ? elements.enableExpansion.checked : true,
            caseSensitive: elements.caseMatching ? elements.caseMatching.checked : true,
            soundEnabled: elements.soundEffects ? elements.soundEffects.checked : false,
            triggerKey: elements.triggerKey ? elements.triggerKey.value : 'tab',
            expansionDelay: elements.expansionDelay ? parseInt(elements.expansionDelay.value) || 0 : 0,
        };

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SAVE_SETTINGS',
                payload: settings
            });

            if (response && response.success) {
                showToast('Settings saved successfully!', 'success');
            } else {
                showToast('Failed to save settings', 'error');
            }
        } catch (e) {
            console.error('Error saving settings:', e);
            showToast('Error saving settings', 'error');
        }
    }

    // Load settings from chrome.storage via background script
    async function loadSettings() {
        console.log('Loading settings...');

        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });

            if (response && response.settings) {
                const settings = response.settings;

                if (elements.enableExpansion && settings.enabled !== undefined)
                    elements.enableExpansion.checked = settings.enabled;
                if (elements.caseMatching && settings.caseSensitive !== undefined)
                    elements.caseMatching.checked = settings.caseSensitive;
                if (elements.soundEffects && settings.soundEnabled !== undefined)
                    elements.soundEffects.checked = settings.soundEnabled;
                if (elements.triggerKey && settings.triggerKey)
                    elements.triggerKey.value = settings.triggerKey;
                if (elements.expansionDelay && settings.expansionDelay !== undefined)
                    elements.expansionDelay.value = settings.expansionDelay;
                if (elements.syncEnabled && settings.syncEnabled !== undefined)
                    elements.syncEnabled.checked = settings.syncEnabled;

                console.log('Settings loaded:', settings);
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }

    // Reset settings to defaults
    async function resetSettings() {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            console.log('Resetting settings...');

            // Reset UI to defaults
            if (elements.enableExpansion) elements.enableExpansion.checked = true;
            if (elements.caseMatching) elements.caseMatching.checked = true;
            if (elements.soundEffects) elements.soundEffects.checked = false;
            if (elements.triggerKey) elements.triggerKey.value = 'tab';
            if (elements.expansionDelay) elements.expansionDelay.value = '0';
            if (elements.syncEnabled) elements.syncEnabled.checked = true;

            // Save default settings to storage
            await saveSettings();
            showToast('Settings reset to default', 'success');
        }
    }

    // Export data
    function exportData() {
        console.log('Exporting data...');

        const data = {
            settings: localStorage.getItem('textflow-settings'),
            theme: localStorage.getItem('textflow-theme'),
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'textflow-backup-' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Data exported successfully!', 'success');
    }

    // Import data
    function importData() {
        console.log('Import data clicked');

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        const data = JSON.parse(e.target.result);
                        if (data.settings) {
                            localStorage.setItem('textflow-settings', data.settings);
                        }
                        if (data.theme) {
                            localStorage.setItem('textflow-theme', data.theme);
                        }
                        loadSettings();
                        showToast('Data imported successfully!', 'success');
                    } catch (err) {
                        showToast('Error importing data: Invalid file format', 'error');
                    }
                };
                reader.readAsText(file);
            }
        };

        input.click();
    }

    // Clear all data - show modal
    function clearAllData() {
        var modal = document.getElementById('delete-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // Actually perform the data clearing
    function performDataClear() {
        console.log('Clearing all data...');

        localStorage.removeItem('textflow-settings');
        localStorage.removeItem('textflow-theme');

        // Reset to defaults without confirmation
        if (elements.enableExpansion) elements.enableExpansion.checked = true;
        if (elements.caseMatching) elements.caseMatching.checked = true;
        if (elements.soundEffects) elements.soundEffects.checked = false;
        if (elements.triggerKey) elements.triggerKey.value = 'tab';
        if (elements.expansionDelay) elements.expansionDelay.value = '0';
        if (elements.fontSize) elements.fontSize.value = 'medium';
        if (elements.compactMode) elements.compactMode.checked = false;
        if (elements.analytics) elements.analytics.checked = false;
        if (elements.crashReports) elements.crashReports.checked = true;

        // Reset theme
        [elements.themeLight, elements.themeDark, elements.themeSystem].forEach(el => {
            if (el) el.classList.remove('active');
        });
        if (elements.themeDark) elements.themeDark.classList.add('active');

        // Reset delete confirmation panel to initial state
        if (elements.deleteConfirmInput) {
            elements.deleteConfirmInput.value = '';
            elements.deleteConfirmInput.style.borderColor = 'var(--border-color)';
            elements.deleteConfirmInput.style.boxShadow = 'none';
        }
        if (elements.btnClear) {
            elements.btnClear.disabled = true;
            elements.btnClear.style.opacity = '0.5';
            elements.btnClear.style.cursor = 'not-allowed';
        }
        if (elements.deleteConfirmPanel) {
            elements.deleteConfirmPanel.style.display = 'none';
        }
        if (elements.btnClearStart) {
            elements.btnClearStart.style.display = 'inline-flex';
        }

        // Hide modal
        var modal = document.getElementById('delete-modal');
        if (modal) modal.style.display = 'none';

        showToast('All data has been cleared', 'success');
    }

    // Close delete modal
    function closeDeleteModal() {
        var modal = document.getElementById('delete-modal');
        if (modal) modal.style.display = 'none';
    }

    // Modal button handlers
    var btnExportThenDelete = document.getElementById('btn-export-then-delete');
    var btnDeleteOnly = document.getElementById('btn-delete-only');
    var btnCancelDelete = document.getElementById('btn-cancel-delete');
    var deleteModal = document.getElementById('delete-modal');

    if (btnExportThenDelete) {
        btnExportThenDelete.addEventListener('click', function () {
            exportData();
            // Small delay to ensure export completes
            setTimeout(function () {
                performDataClear();
            }, 500);
        });
    }

    if (btnDeleteOnly) {
        btnDeleteOnly.addEventListener('click', function () {
            performDataClear();
        });
    }

    if (btnCancelDelete) {
        btnCancelDelete.addEventListener('click', closeDeleteModal);
    }

    // Close modal when clicking outside
    if (deleteModal) {
        deleteModal.addEventListener('click', function (e) {
            if (e.target === deleteModal) {
                closeDeleteModal();
            }
        });
    }

    // Toast notification
    function showToast(message, type) {
        type = type || 'success';
        console.log('Toast:', message, type);

        if (elements.toast) {
            const toastMessage = elements.toast.querySelector('.toast-message');
            const toastIcon = elements.toast.querySelector('.toast-icon');

            if (toastMessage) toastMessage.textContent = message;
            elements.toast.className = 'toast show ' + type;
            if (toastIcon) toastIcon.textContent = type === 'success' ? 'check_circle' : 'error';

            setTimeout(function () {
                elements.toast.classList.remove('show');
            }, 3000);
        }
    }

    // Button event listeners
    if (elements.btnSave) {
        elements.btnSave.addEventListener('click', saveSettings);
        console.log('Save button listener attached');
    }

    if (elements.btnReset) {
        elements.btnReset.addEventListener('click', resetSettings);
        console.log('Reset button listener attached');
    }

    if (elements.btnExport) {
        elements.btnExport.addEventListener('click', exportData);
        console.log('Export button listener attached');
    }

    if (elements.btnImport) {
        elements.btnImport.addEventListener('click', importData);
        console.log('Import button listener attached');
    }

    if (elements.btnClear) {
        elements.btnClear.addEventListener('click', clearAllData);
        console.log('Clear button listener attached');
    }

    // Show confirmation panel when clicking "Clear All Data" button
    if (elements.btnClearStart && elements.deleteConfirmPanel) {
        elements.btnClearStart.addEventListener('click', function () {
            elements.btnClearStart.style.display = 'none';
            elements.deleteConfirmPanel.style.display = 'block';
            if (elements.deleteConfirmInput) {
                elements.deleteConfirmInput.focus();
            }
        });
        console.log('Clear start button listener attached');
    }

    // Cancel button - hide panel and show initial button
    if (elements.btnCancelClear && elements.deleteConfirmPanel && elements.btnClearStart) {
        elements.btnCancelClear.addEventListener('click', function () {
            elements.deleteConfirmPanel.style.display = 'none';
            elements.btnClearStart.style.display = 'inline-flex';
            // Reset input
            if (elements.deleteConfirmInput) {
                elements.deleteConfirmInput.value = '';
                elements.deleteConfirmInput.style.borderColor = 'var(--border-color)';
                elements.deleteConfirmInput.style.boxShadow = 'none';
            }
            if (elements.btnClear) {
                elements.btnClear.disabled = true;
                elements.btnClear.style.opacity = '0.5';
                elements.btnClear.style.cursor = 'not-allowed';
            }
        });
        console.log('Cancel clear button listener attached');
    }

    // Delete confirmation input handler
    if (elements.deleteConfirmInput && elements.btnClear) {
        elements.deleteConfirmInput.addEventListener('input', function () {
            var inputValue = this.value.toUpperCase().trim();
            if (inputValue === 'DELETE') {
                elements.btnClear.disabled = false;
                elements.btnClear.style.opacity = '1';
                elements.btnClear.style.cursor = 'pointer';
                this.style.borderColor = 'var(--danger)';
                this.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.2)';
            } else {
                elements.btnClear.disabled = true;
                elements.btnClear.style.opacity = '0.5';
                elements.btnClear.style.cursor = 'not-allowed';
                this.style.borderColor = 'var(--border-color)';
                this.style.boxShadow = 'none';
            }
        });
        console.log('Delete confirmation input listener attached');
    }

    // Load stats
    if (elements.totalSnippets) elements.totalSnippets.textContent = '24';
    if (elements.totalExpansions) elements.totalExpansions.textContent = '156';
    if (elements.timeSaved) elements.timeSaved.textContent = '2.5h';

    // Load saved settings
    loadSettings();

    // Initialize sync toggle from Chrome storage
    async function initSyncToggle() {
        if (!elements.syncEnabled) return;

        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
                    if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                    else resolve(res);
                });
            });

            const syncEnabled = response?.settings?.syncEnabled ?? true;
            elements.syncEnabled.checked = syncEnabled;
            updateSyncBadge(syncEnabled);
        } catch (e) {
            console.warn('Could not load sync setting:', e);
        }
    }

    function updateSyncBadge(enabled) {
        if (elements.syncStatusBadge) {
            elements.syncStatusBadge.textContent = enabled ? 'Enabled' : 'Local Only';
            elements.syncStatusBadge.style.background = enabled
                ? 'var(--success-light, rgba(34, 197, 94, 0.1))'
                : 'var(--bg-tertiary)';
            elements.syncStatusBadge.style.color = enabled
                ? 'var(--success, #22c55e)'
                : 'var(--text-muted)';
        }
    }

    // Sync toggle event handler
    if (elements.syncEnabled) {
        elements.syncEnabled.addEventListener('change', async function () {
            const newValue = this.checked;
            updateSyncBadge(newValue);

            try {
                // Save the setting
                await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        { type: 'SAVE_SETTINGS', payload: { syncEnabled: newValue } },
                        (res) => {
                            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                            else resolve(res);
                        }
                    );
                });

                // Migrate data to new storage
                const migrationResult = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        { type: 'MIGRATE_STORAGE', payload: { toSync: newValue } },
                        (res) => {
                            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                            else resolve(res);
                        }
                    );
                });

                if (migrationResult?.success) {
                    const msg = newValue
                        ? 'Sync enabled! Your snippets will sync across devices.'
                        : 'Sync disabled. Snippets will stay on this device only.';
                    showToast(msg, 'success');
                    console.log('[Settings] Migration complete:', migrationResult);
                }
            } catch (e) {
                console.error('Failed to update sync setting:', e);
                showToast('Failed to update sync setting', 'error');
                // Revert toggle
                this.checked = !newValue;
                updateSyncBadge(!newValue);
            }
        });
        console.log('Sync toggle listener attached');
    }

    // Initialize sync toggle
    initSyncToggle();

    console.log('Settings page initialization complete');
});
