// Settings Navigation Fix
// Add this script to settings.html if navigation is not working

(function () {
    'use strict';

    const $ = id => document.getElementById(id);

    // Fix navigation
    function fixNavigation() {
        console.log('[Settings Fix] Fixing navigation...');

        const navItems = document.querySelectorAll('.nav-item');
        console.log(`[Settings Fix] Found ${navItems.length} nav items`);

        navItems.forEach(item => {
            const section = item.getAttribute('data-section');
            console.log(`[Settings Fix] Setting up nav item: ${section}`);

            item.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                console.log(`[Settings Fix] Clicked: ${section}`);

                // Update active state
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                this.classList.add('active');

                // Hide all pages
                document.querySelectorAll('.settings-page, section[id^="page-"]').forEach(p => {
                    p.classList.add('hidden');
                    p.style.display = 'none';
                });

                // Show target page
                const pageId = `page-${section}`;
                const targetPage = document.getElementById(pageId);

                console.log(`[Settings Fix] Looking for page: ${pageId}`, targetPage);

                if (targetPage) {
                    targetPage.classList.remove('hidden');
                    targetPage.style.display = 'block';
                    console.log(`[Settings Fix] Showed page: ${pageId}`);
                } else {
                    console.error(`[Settings Fix] Page not found: ${pageId}`);
                }
            });
        });
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixNavigation);
    } else {
        fixNavigation();
    }

    console.log('[Settings Fix] Script loaded');
})();
