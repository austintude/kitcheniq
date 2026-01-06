/**
 * KitchenIQ Dashboard - Main JavaScript
 */

class KitchenIQDashboard {
    constructor() {
        this.apiRoot = kitcheniqData.restRoot;
        this.nonce = kitcheniqData.nonce;
        this.currentUser = kitcheniqData.currentUser;
        this.currentTab = 'onboarding';
        this.profile = null;
        this.inventory = null;
        this.mealPlan = null;
        this.selectedMealIndex = null;
        // Live assist state
        this.liveStream = null;
        this.liveVideoEl = null;
        this.liveStatusEl = null;
        this.liveThreadEl = null;
        this.liveRecognizer = null;
        this.liveRecognizing = false;
        this.liveSessionActive = false;
        this.liveAutoFrameInterval = null;
        this.liveUsingRearCamera = true;
        this.liveTtsEnabled = false;
        this.liveLatestFrame = null;
        this.lastStoreData = null;
        this.stapleItems = [
            'salt',
            'pepper',
            'black pepper',
            'sea salt',
            'kosher salt',
            'olive oil',
            'vegetable oil',
            'cooking spray',
            'nonstick spray',
            'water',
        ];

        // PWA: register service worker (best-effort)
        this.registerServiceWorker();
        
        this.init();
    }

    async registerServiceWorker() {
        try {
            if (!('serviceWorker' in navigator)) return;
            // Service workers require secure context (HTTPS) except localhost.
            if (!window.isSecureContext && location.hostname !== 'localhost') return;

            // First, unregister any old service workers from the plugin path to avoid conflicts.
            await this.unregisterOldServiceWorkers();

            const swUrl = (kitcheniqData && kitcheniqData.pwaSw) ? kitcheniqData.pwaSw : '/app/kitcheniq-sw.js';
            const scope = '/app/';

            navigator.serviceWorker.register(swUrl, { scope });
        } catch (e) {
            // no-op
        }
    }

    async unregisterOldServiceWorkers() {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
                const scriptUrl = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
                // Unregister anything not from /app/kitcheniq-sw.js
                if (scriptUrl && !scriptUrl.includes('/app/kitcheniq-sw.js')) {
                    await reg.unregister();
                    console.log('Unregistered old service worker:', scriptUrl);
                }
            }
        } catch (e) {
            console.warn('Failed to unregister old service workers', e);
        }
    }

    async init() {
        // Load user profile
        await this.loadProfile();

        // Preload inventory so meal shopping lists can be accurate even before navigating to Pantry
        await this.loadInventory();
        
        // Decide initial view from URL ?view= or fallback to onboarding/dashboard
        const params = new URLSearchParams(window.location.search);
        const initialView = params.get('view');
        if (initialView) {
            this.showTab(initialView);
        } else if (this.profile && Object.keys(this.profile).length > 0) {
            this.showTab('dashboard');
        } else {
            this.showTab('onboarding');
        }

        // If onboarding form present, initialize stepper state
        this.initOnboardingStepper();

        // Attach event listeners
        this.attachEventListeners();

        // If we have a loaded profile, prefill household size and render members
        try {
            if (this.profile && Object.keys(this.profile).length > 0) {
                this.populateFormFromProfile();
            }
            this.renderMemberInputs();
            // update profile summary area in settings
            this.updateProfileSummary();
        } catch (err) {
            // ignore if DOM not ready
        }

        // PWA registration now happens in constructor via registerServiceWorker()

        // Inject Store Mode button (floating action) for quick access
        this.injectStoreModeButton();

        // Restore Store Mode overlay state if user left it open
        try {
            if (localStorage.getItem('kiq_store_overlay_open') === 'true') {
                this.openStoreMode();
            }
        } catch (e) {
            // ignore storage errors
        }
    }

    async loadProfile() {
        try {
            const response = await fetch(`${this.apiRoot}kitcheniq/v1/profile`, {
                headers: {
                    'X-WP-Nonce': this.nonce,
                },
            });
            const data = await response.json();
            this.profile = data.profile || {};
                    // If profile loaded successfully, populate form fields
                    if (Object.keys(this.profile).length > 0) {
                        setTimeout(() => this.populateFormFromProfile(), 100);
                    }
        } catch (error) {
            console.error('Failed to load profile:', error);
        }
    }

    async loadInventory() {
        try {
            const response = await fetch(`${this.apiRoot}kitcheniq/v1/inventory`, {
                headers: {
                    'X-WP-Nonce': this.nonce,
                },
            });
            const data = await response.json();
            this.inventory = this.postProcessInventory(data.inventory || []);
            this.renderInventory();
            if (this.mealPlan) {
                this.renderMealPlan();
            }
        } catch (error) {
            console.error('Failed to load inventory:', error);
        }
    }

    async saveInventory({ silent = false } = {}) {
        try {
            const response = await fetch(`${this.apiRoot}kitcheniq/v1/inventory`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': this.nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ items: this.inventory || [] }),
            });
            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error || data.message || `Error: ${response.status}`);
            }
            this.inventory = data.inventory || this.inventory;
            if (!silent) this.showNotification('Inventory updated', 'success');
            this.renderInventory();
            if (this.mealPlan) {
                this.renderMealPlan();
                if (this.selectedMealIndex !== null) {
                    this.showMealIngredients(this.selectedMealIndex);
                }
            }
        } catch (err) {
            console.error('Save inventory error:', err);
            if (!silent) this.showNotification('Could not update inventory', 'error');
        }
    }

    attachEventListeners() {
        // Navigation: make the sidebar the canonical control.
        // Top tabs and bottom nav will delegate to the sidebar where possible.

        // Sidebar buttons (canonical)
        document.querySelectorAll('.kiq-side-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = btn.dataset.tab;
                if (!tab) return;
                this.showTab(tab);
                // update sidebar active state (showTab will handle top/bottom states)
                document.querySelectorAll('.kiq-side-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // if small screen and sidebar is open, close it to reveal content
                if (window.innerWidth <= 768) {
                    this.closeSidebar();
                }
            });
        });

        // Accessibility & keyboard nav for sidebar
        const sideButtons = Array.from(document.querySelectorAll('.kiq-side-btn'));
        if (sideButtons.length) {
            sideButtons.forEach((b, idx, arr) => {
                // ensure focusable and announceable
                b.setAttribute('tabindex', b.getAttribute('tabindex') || '0');
                b.setAttribute('role', 'button');

                b.addEventListener('keydown', (ev) => {
                    const key = ev.key;
                    if (key === 'ArrowDown' || key === 'ArrowRight') {
                        ev.preventDefault();
                        const next = arr[(idx + 1) % arr.length];
                        next.focus();
                    } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
                        ev.preventDefault();
                        const prev = arr[(idx - 1 + arr.length) % arr.length];
                        prev.focus();
                    } else if (key === 'Home') {
                        ev.preventDefault();
                        arr[0].focus();
                    } else if (key === 'End') {
                        ev.preventDefault();
                        arr[arr.length - 1].focus();
                    } else if (key === 'Enter' || key === ' ') {
                        ev.preventDefault();
                        b.click();
                    }
                });
            });
        }

        // Top tabs delegate to sidebar if a matching side button exists, otherwise show directly
        document.querySelectorAll('[data-tab]:not(.kiq-side-btn)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = btn.dataset.tab;
                console.log('Top nav button clicked, tab:', tab);
                const side = document.querySelector(`.kiq-side-btn[data-tab="${tab}"]`);
                if (side) {
                    console.log('Found sidebar button, clicking it');
                    side.click();
                } else {
                    console.log('No sidebar button found, calling showTab directly');
                    this.showTab(tab);
                }
            });
        });

        // Bottom nav delegate to sidebar if possible
        document.querySelectorAll('.kiq-bottom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const route = btn.dataset.route;
                const side = document.querySelector(`.kiq-side-btn[data-tab="${route}"]`);
                if (side) {
                    side.click();
                } else {
                    this.showTab(route);
                }
                // update bottom nav active state
                document.querySelectorAll('.kiq-bottom-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Handle back/forward navigation
        window.addEventListener('popstate', (e) => {
            const params = new URLSearchParams(window.location.search);
            const view = params.get('view') || 'dashboard';
            this.showTab(view);
        });

        // Onboarding form
        const onboardingForm = document.getElementById('kiq-onboarding-form');
        if (onboardingForm) {
            onboardingForm.addEventListener('submit', (e) => this.handleOnboarding(e));
            // autosave on input changes (debounced)
            onboardingForm.querySelectorAll('input, select, textarea').forEach(el => {
                el.addEventListener('input', () => this.scheduleAutosave());
                el.addEventListener('change', () => this.scheduleAutosave());
            });
        }

        // When household size changes, render member inputs
        const householdSelect = document.getElementById('household_size');
        if (householdSelect) {
            householdSelect.addEventListener('change', () => this.renderMemberInputs());
        }

        // Meal generation
        const mealGenBtn = document.getElementById('kiq-generate-meals-btn');
        if (mealGenBtn) {
            mealGenBtn.addEventListener('click', () => this.generateMeals());
        }

        // More ideas button
        const moreBtn = document.getElementById('kiq-more-ideas-btn');
        if (moreBtn) {
            moreBtn.addEventListener('click', () => {
                const seed = String(Date.now());
                this.generateMealsWithOptions(seed);
            });
        }

        const mealResultsContainer = document.getElementById('kiq-meal-results');
        if (mealResultsContainer) {
            mealResultsContainer.addEventListener('click', (e) => {
                const addBtn = e.target.closest('[data-action="add-missing-item"]');
                if (addBtn) {
                    const mealIndex = parseInt(addBtn.dataset.mealIndex || '-1', 10);
                    const itemName = addBtn.dataset.missingName;
                    if (mealIndex >= 0 && itemName) {
                        this.addMissingItemToPantry(mealIndex, itemName);
                    }
                }
            });
        }

        const selectedIngredientsContainer = document.getElementById('kiq-selected-ingredients');
        if (selectedIngredientsContainer) {
            selectedIngredientsContainer.addEventListener('click', (e) => {
                const addBtn = e.target.closest('[data-action="add-missing-item"]');
                if (addBtn) {
                    const mealIndex = parseInt(addBtn.dataset.mealIndex || '-1', 10);
                    const itemName = addBtn.dataset.missingName;
                    if (mealIndex >= 0 && itemName) {
                        this.addMissingItemToPantry(mealIndex, itemName);
                    }
                }
            });
        }

        // Manual inventory form submit
        const inventoryForm = document.getElementById('kiq-inventory-form');
        if (inventoryForm) {
            inventoryForm.addEventListener('submit', (e) => this.addManualInventoryItem(e));
        }

        // Inventory inline edits/removals (delegated)
        const inventoryList = document.getElementById('kiq-inventory-list');
        if (inventoryList) {
            inventoryList.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('[data-action="remove-item"]');
                if (removeBtn) {
                    const idx = parseInt(removeBtn.closest('[data-index]')?.dataset.index || '-1', 10);
                    if (idx >= 0) this.removeInventoryItem(idx);
                    return;
                }

                // Phase 2: Confirm item button
                const confirmBtn = e.target.closest('[data-action="confirm-item"]');
                if (confirmBtn) {
                    const idx = parseInt(confirmBtn.closest('[data-index]')?.dataset.index || '-1', 10);
                    if (idx >= 0) this.confirmInventoryItem(idx);
                    return;
                }
            });

            inventoryList.addEventListener('change', (e) => {
                const parent = e.target.closest('[data-index]');
                if (!parent) return;
                const idx = parseInt(parent.dataset.index || '-1', 10);
                if (idx < 0 || !this.inventory || !this.inventory[idx]) return;

                if (e.target.dataset.action === 'qty') {
                    const val = parseFloat(e.target.value);
                    this.updateInventoryItem(idx, { quantity: isNaN(val) ? 0 : val });
                } else if (e.target.dataset.action === 'status') {
                    this.updateInventoryItem(idx, { status: e.target.value || 'fresh' });
                } else if (e.target.dataset.action === 'location') {
                    this.updateInventoryItem(idx, { location: e.target.value || 'pantry' });
                } else if (e.target.dataset.action === 'category') {
                    this.updateInventoryItem(idx, { category: e.target.value || 'other' });
                }
            });
        }

        // Camera upload
        const cameraBtn = document.getElementById('kiq-camera-btn');
        if (cameraBtn) {
            cameraBtn.addEventListener('click', () => this.triggerCameraUpload());
        }

        // Skip scan button (jump to meals tab)
        const skipScanBtn = document.getElementById('kiq-skip-scan-btn');
        if (skipScanBtn) {
            skipScanBtn.addEventListener('click', () => this.showTab('dashboard'));
        }

        // Update pantry button (jump to inventory tab)
        const updatePantryBtn = document.getElementById('kiq-update-pantry-btn');
        if (updatePantryBtn) {
            updatePantryBtn.addEventListener('click', () => this.showTab('inventory'));
        }

        // File input for camera (multi-photo)
        const fileInput = document.getElementById('kiq-camera-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleMultiImageSelect(e));
        }

        // Multi-photo gallery controls
        const addMoreBtn = document.getElementById('kiq-add-more-photos');
        if (addMoreBtn) {
            addMoreBtn.addEventListener('click', () => this.triggerCameraUpload());
        }

        const clearPhotosBtn = document.getElementById('kiq-clear-photos');
        if (clearPhotosBtn) {
            clearPhotosBtn.addEventListener('click', () => this.clearPhotoGallery());
        }

        const scanAllBtn = document.getElementById('kiq-scan-all-photos');
        if (scanAllBtn) {
            scanAllBtn.addEventListener('click', () => this.scanAllPhotos());
        }

        // Pantry search
        const searchInput = document.getElementById('kiq-pantry-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handlePantrySearch(e.target.value));
        }
        const searchClear = document.getElementById('kiq-search-clear');
        if (searchClear) {
            searchClear.addEventListener('click', () => this.clearPantrySearch());
        }

        // Video upload handlers
        const videoBtn = document.getElementById('kiq-video-btn');
        if (videoBtn) {
            videoBtn.addEventListener('click', () => this.triggerVideoUpload());
        }
        const videoInput = document.getElementById('kiq-video-input');
        if (videoInput) {
            videoInput.addEventListener('change', (e) => this.handleVideoSelect(e));
        }
        const clearVideoBtn = document.getElementById('kiq-clear-video');
        if (clearVideoBtn) {
            clearVideoBtn.addEventListener('click', () => this.clearVideo());
        }
        const scanVideoBtn = document.getElementById('kiq-scan-video');
        if (scanVideoBtn) {
            scanVideoBtn.addEventListener('click', () => this.scanVideo());
        }

        // Live assist controls
        const liveStartBtn = document.getElementById('kiq-live-start');
        if (liveStartBtn) {
            liveStartBtn.addEventListener('click', () => this.toggleLiveSession());
        }
        const liveStopBtn = document.getElementById('kiq-live-stop');
        if (liveStopBtn) {
            liveStopBtn.addEventListener('click', () => this.stopLiveSession());
        }
        const liveCaptureBtn = document.getElementById('kiq-live-capture');
        if (liveCaptureBtn) {
            liveCaptureBtn.addEventListener('click', () => this.toggleCameraFacing());
        }
        const livePttBtn = document.getElementById('kiq-live-ptt');
        if (livePttBtn) {
            livePttBtn.addEventListener('click', () => this.toggleLiveAudio());
        }
        const liveTtsToggle = document.getElementById('kiq-live-tts-toggle');
        if (liveTtsToggle) {
            liveTtsToggle.addEventListener('change', (e) => {
                this.liveTtsEnabled = e.target.checked;
            });
        }

        // Menu toggle
        const menuToggle = document.getElementById('kiq-menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                // On small screens, toggle an app-level class that shows the off-canvas sidebar.
                if (document.body.classList.contains('kiq-sidebar-open')) {
                    this.closeSidebar();
                } else {
                    this.openSidebar();
                }

                // Also toggle the top nav for slightly larger small screens where top nav is visible
                const topNav = document.getElementById('kiq-top-nav');
                if (topNav) topNav.classList.toggle('hidden');
            });
        }
    }

    injectStoreModeButton() {
        try {
            if (document.getElementById('kiq-store-mode-btn')) return;
            const btn = document.createElement('button');
            btn.id = 'kiq-store-mode-btn';
            btn.className = 'kiq-fab-store';
            btn.title = "I'm at the store";
            btn.ariaLabel = "I'm at the store";
            btn.textContent = '🛒';
            btn.addEventListener('click', () => this.openStoreMode());
            document.body.appendChild(btn);
        } catch (e) {
            // no-op
        }
    }

    async openStoreMode() {
        // Create overlay container if missing
        let overlay = document.getElementById('kiq-store-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'kiq-store-overlay';
            overlay.className = 'kiq-store-overlay';
            overlay.innerHTML = `
                <div class="kiq-store-panel">
                    <div class="kiq-store-header">
                        <h3>Store Mode</h3>
                        <div class="kiq-store-actions">
                            <button class="kiq-store-btn" id="kiq-store-copy" type="button">Copy list</button>
                            <button class="kiq-store-btn" id="kiq-store-csv" type="button">Download CSV</button>
                            <button class="kiq-store-close" aria-label="Close" type="button">✕</button>
                        </div>
                    </div>
                    <div class="kiq-store-content">
                        <div class="kiq-store-section">
                            <h4>Buy List</h4>
                            <div id="kiq-store-buy-list" class="kiq-store-list"></div>
                        </div>
                        <div class="kiq-store-section">
                            <h4>Use Soon (Prioritize)</h4>
                            <div id="kiq-store-prioritize" class="kiq-store-list"></div>
                        </div>
                        <div class="kiq-store-section">
                            <h4>Already in Pantry</h4>
                            <div id="kiq-store-in-pantry" class="kiq-store-list"></div>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            overlay.querySelector('.kiq-store-close')?.addEventListener('click', () => this.closeStoreOverlay());
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeStoreOverlay();
            });
            overlay.querySelector('#kiq-store-copy')?.addEventListener('click', () => this.copyBuyListToClipboard());
            overlay.querySelector('#kiq-store-csv')?.addEventListener('click', () => this.downloadBuyListCsv());
        }

        overlay.style.display = 'flex';
        try { localStorage.setItem('kiq_store_overlay_open', 'true'); } catch (e) {}
        await this.fetchAndRenderStoreRecommendations();
    }

    async fetchAndRenderStoreRecommendations() {
        try {
            const res = await fetch(`${this.apiRoot}kitcheniq/v1/store-mode/recommendations`, {
                headers: { 'X-WP-Nonce': this.nonce },
            });
            const data = await res.json();
            this.renderStoreRecommendations(data || {});
        } catch (e) {
            console.error('Store Mode fetch failed', e);
            this.showNotification('Could not load store recommendations', 'error');
        }
    }

    renderStoreRecommendations(data) {
        this.lastStoreData = data;
        const buyListEl = document.getElementById('kiq-store-buy-list');
        const priorEl   = document.getElementById('kiq-store-prioritize');
        const inPantryEl= document.getElementById('kiq-store-in-pantry');
        if (!buyListEl || !priorEl || !inPantryEl) return;

        const buy = Array.isArray(data.buy_list) ? data.buy_list : [];
        const pri = Array.isArray(data.prioritize) ? data.prioritize : [];
        const pan = Array.isArray(data.in_pantry) ? data.in_pantry : [];

        buyListEl.innerHTML = buy.length ? buy.map(item => {
            const subs = (item.substitutions || []).map(s => `<span class="kiq-badge kiq-badge-info">Use: ${this.escapeHtml(s.name)}</span>`).join(' ');
            const reason = item.reason === 'expired' ? 'Expired' : (item.reason === 'low' ? 'Low' : 'Missing');
            return `<div class="kiq-store-row">
                <div>
                    <div class="kiq-row-title">${this.escapeHtml(item.name)} ${item.quantity ? `<span class="kiq-pill-muted">x${item.quantity}</span>` : ''}</div>
                    <div class="kiq-row-sub">Reason: ${reason} ${subs ? `• ${subs}` : ''}</div>
                </div>
                <button class="kiq-add-to-list">Add</button>
            </div>`;
        }).join('') : '<div class="kiq-empty">No items to buy 🎉</div>';

        priorEl.innerHTML = pri.length ? pri.map(p => `<div class="kiq-store-row">
            <div>
                <div class="kiq-row-title">${this.escapeHtml(p.name)} <span class="kiq-badge kiq-badge-warning">⏰ ${Math.round(p.decay)}%</span></div>
                <div class="kiq-row-sub">${this.escapeHtml(p.location)} • ${this.escapeHtml(p.category)}</div>
            </div>
        </div>`).join('') : '<div class="kiq-empty">Nothing urgent</div>';

        inPantryEl.innerHTML = pan.length ? pan.map(p => `<div class="kiq-store-row">
            <div>
                <div class="kiq-row-title">${this.escapeHtml(p.name)} ${p.quantity ? `<span class=\"kiq-pill-muted\">x${p.quantity}</span>` : ''}</div>
                <div class="kiq-row-sub">${this.escapeHtml(p.location || 'pantry')}</div>
            </div>
        </div>`).join('') : '<div class="kiq-empty">No matches</div>';
    }

    closeStoreOverlay() {
        const overlay = document.getElementById('kiq-store-overlay');
        if (!overlay) return;
        overlay.style.display = 'none';
        try { localStorage.setItem('kiq_store_overlay_open', 'false'); } catch (e) {}
    }

    copyBuyListToClipboard() {
        const buy = (this.lastStoreData && Array.isArray(this.lastStoreData.buy_list)) ? this.lastStoreData.buy_list : [];
        if (!buy.length) {
            this.showNotification('No buy items to copy', 'info');
            return;
        }
        const lines = buy.map(item => `${item.name}${item.quantity ? ` x${item.quantity}` : ''}`);
        const text = lines.join('\n');
        navigator.clipboard.writeText(text)
            .then(() => this.showNotification('Buy list copied', 'success'))
            .catch(() => this.showNotification('Copy failed', 'error'));
    }

    downloadBuyListCsv() {
        const buy = (this.lastStoreData && Array.isArray(this.lastStoreData.buy_list)) ? this.lastStoreData.buy_list : [];
        if (!buy.length) {
            this.showNotification('No buy items to export', 'info');
            return;
        }
        const header = ['name', 'quantity', 'reason'];
        const rows = buy.map(item => [
            item.name ? `"${item.name.replace(/"/g, '""')}"` : '',
            item.quantity ?? '',
            item.reason ?? ''
        ]);
        const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'store-buy-list.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /* Members UI */
    renderMemberInputs() {
        const container = document.getElementById('kiq-members-container');
        if (!container) return;
        container.innerHTML = '';

        const householdSize = parseInt(document.getElementById('household_size')?.value || '2', 10);
        const target = householdSize >= 9 ? 9 : householdSize; // a cap shown in UI; allow manual add for more

        // If profile has members, prefer that
        const existing = (this.profile && Array.isArray(this.profile.members)) ? this.profile.members : [];

        for (let i = 0; i < target; i++) {
            const member = existing[i] || { name: '', appetite: 3, age: '', allergies: [], intolerances: [], dislikes: [] };
            const idx = i + 1;
            const el = document.createElement('div');
            el.className = 'kiq-member';
            el.dataset.index = i;

            // Header with name and remove button
            const header = document.createElement('div');
            header.className = 'kiq-member-header';

            const nameInput = document.createElement('input');
            nameInput.className = 'member-name';
            nameInput.placeholder = `Member ${idx} name`;
            nameInput.value = member.name || '';
            nameInput.style.border = 'none';
            nameInput.style.background = 'transparent';
            nameInput.style.flex = '1';

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'kiq-remove-member';
            removeBtn.textContent = '−';
            removeBtn.setAttribute('aria-label', 'Remove member');
            removeBtn.title = 'Remove member';

            header.appendChild(nameInput);
            header.appendChild(removeBtn);

            // Body with details
            const body = document.createElement('div');
            body.className = 'kiq-member-body';

            // Appetite and age row
            const row1 = document.createElement('div');
            row1.style.cssText = 'display:flex;gap:8px;align-items:center;';

            const appetiteLabel = document.createElement('label');
            appetiteLabel.style.fontSize = '12px';
            appetiteLabel.textContent = 'Appetite';

            const appetiteSelect = document.createElement('select');
            appetiteSelect.className = 'member-appetite';
            appetiteSelect.style.border = '1px solid var(--kiq-border)';
            appetiteSelect.style.borderRadius = '8px';
            appetiteSelect.style.padding = '6px 8px';
            [1,2,3,4,5].forEach(v => {
                const opt = document.createElement('option'); opt.value = String(v); opt.textContent = String(v);
                appetiteSelect.appendChild(opt);
            });
            appetiteSelect.value = String(member.appetite || 3);

            const ageInput = document.createElement('input');
            ageInput.className = 'member-age';
            ageInput.placeholder = 'Age';
            ageInput.value = member.age || '';
            ageInput.style.maxWidth = '80px';
            ageInput.style.border = '1px solid var(--kiq-border)';
            ageInput.style.borderRadius = '8px';
            ageInput.style.padding = '6px 8px';

            row1.appendChild(appetiteLabel);
            row1.appendChild(appetiteSelect);
            row1.appendChild(ageInput);

            // Allergies row
            const row2 = document.createElement('div');
            const allergiesInput = document.createElement('input');
            allergiesInput.className = 'member-allergies';
            allergiesInput.placeholder = 'Allergies (comma separated)';
            allergiesInput.style.width = '100%';
            allergiesInput.style.border = '1px solid var(--kiq-border)';
            allergiesInput.style.borderRadius = '8px';
            allergiesInput.style.padding = '6px 8px';
            allergiesInput.value = (member.allergies||[]).join(', ');
            row2.appendChild(allergiesInput);

            // Intolerances row
            const row3 = document.createElement('div');
            const intolerancesInput = document.createElement('input');
            intolerancesInput.className = 'member-intolerances';
            intolerancesInput.placeholder = 'Intolerances (comma separated)';
            intolerancesInput.style.width = '100%';
            intolerancesInput.style.border = '1px solid var(--kiq-border)';
            intolerancesInput.style.borderRadius = '8px';
            intolerancesInput.style.padding = '6px 8px';
            intolerancesInput.value = (member.intolerances||[]).join(', ');
            row3.appendChild(intolerancesInput);

            // Dislikes row
            const row4 = document.createElement('div');
            const dislikesInput = document.createElement('input');
            dislikesInput.className = 'member-dislikes';
            dislikesInput.placeholder = 'Dislikes (comma separated)';
            dislikesInput.style.width = '100%';
            dislikesInput.style.border = '1px solid var(--kiq-border)';
            dislikesInput.style.borderRadius = '8px';
            dislikesInput.style.padding = '6px 8px';
            dislikesInput.value = (member.dislikes||[]).join(', ');
            row4.appendChild(dislikesInput);

            body.appendChild(row1);
            body.appendChild(row2);
            body.appendChild(row3);
            body.appendChild(row4);

            // wire remove
            removeBtn.addEventListener('click', () => {
                el.remove();
                this.scheduleAutosave();
            });

            // attach change listeners to schedule autosave
            [nameInput, appetiteSelect, ageInput, allergiesInput, intolerancesInput, dislikesInput].forEach(inp => {
                inp.addEventListener('input', () => this.scheduleAutosave());
                inp.addEventListener('change', () => this.scheduleAutosave());
            });

            el.appendChild(header);
            el.appendChild(body);

            container.appendChild(el);
        }

        // If household size was 9+, offer an Add member button
        if (parseInt(document.getElementById('household_size')?.value || '2', 10) >= 9) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'btn btn-outline';
            addBtn.textContent = 'Add member';
            addBtn.style.marginTop = '8px';
            addBtn.addEventListener('click', () => {
                const el = document.createElement('div');
                el.className = 'kiq-member';
                el.innerHTML = `
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
                        <input class="member-name" placeholder="Member name" />
                        <label style="font-size:12px;">Appetite</label>
                        <select class="member-appetite">
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                        </select>
                        <input class="member-age" placeholder="age" />
                    </div>
                    <div style="display:flex;gap:8px;margin-bottom:10px;">
                        <input class="member-allergies" placeholder="Allergies (comma separated)" style="flex:1;" />
                        <input class="member-intolerances" placeholder="Intolerances (comma)" style="flex:1;" />
                    </div>
                    <div style="margin-bottom:12px;">
                        <input class="member-dislikes" placeholder="Dislikes (comma separated)" />
                    </div>
                `;
                el.querySelectorAll('input, select').forEach(inp => {
                    inp.addEventListener('input', () => this.scheduleAutosave());
                    inp.addEventListener('change', () => this.scheduleAutosave());
                });
                container.appendChild(el);
            });
            container.appendChild(addBtn);
        }
    }

    /* Onboarding stepper */
    initOnboardingStepper() {
        this.onboardStep = 1;
        const nextBtn = document.getElementById('kiq-step-next');
        const prevBtn = document.getElementById('kiq-step-prev');
        if (nextBtn) nextBtn.addEventListener('click', () => this.onboardNext());
        if (prevBtn) prevBtn.addEventListener('click', () => this.onboardPrev());
        this.showOnboardStep(this.onboardStep);
    }

    showOnboardStep(n) {
        document.querySelectorAll('.onboard-step').forEach(el => el.classList.add('hidden'));
        const stepEl = document.querySelector(`.onboard-step[data-step="${n}"]`);
        if (stepEl) stepEl.classList.remove('hidden');
        document.getElementById('kiq-step-prev').classList.toggle('hidden', n === 1);
        document.getElementById('kiq-step-next').textContent = n >= document.querySelectorAll('.onboard-step').length ? 'Save' : 'Next →';

        const bar = document.querySelector('.kiq-stepper-bar');
        if (bar) {
            const total = document.querySelectorAll('.onboard-step').length || 1;
            const pct = Math.min(100, Math.max(0, (n / total) * 100));
            bar.style.width = `${pct}%`;
        }
    }

    onboardNext() {
        const total = document.querySelectorAll('.onboard-step').length;
        if (this.onboardStep >= total) {
            // final - submit form
            const form = document.getElementById('kiq-onboarding-form');
            if (form) {
                // call handler directly with a synthetic event-like object that includes the form as target
                this.handleOnboarding({ preventDefault: () => {}, target: form });
            }
            return;
        }
        this.onboardStep += 1;
        this.showOnboardStep(this.onboardStep);
    }

    onboardPrev() {
        if (this.onboardStep <= 1) return;
        this.onboardStep -= 1;
        this.showOnboardStep(this.onboardStep);
    }

    /* Autosave for onboarding/profile (debounced) */
    scheduleAutosave() {
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => this.autosaveProfile(), 900);
    }

    async autosaveProfile() {
        const form = document.getElementById('kiq-onboarding-form');
        if (!form) return;
        const formData = new FormData(form);
        // Build payload to exactly match REST handler expectations
        const householdSizeRaw = formData.get('household_size');
        const household_size = householdSizeRaw ? parseInt(householdSizeRaw, 10) : 2;

        const dietary_restrictions = formData.getAll('dietary_restrictions') || [];
        const appliances = formData.getAll('appliances') || [];

        const cooking_skill = formData.get('cooking_skill') || 'intermediate';
        const budget_level = formData.get('budget_level') || 'moderate';
        const time_per_meal = formData.get('time_per_meal') || 'moderate';

        const dislikesRaw = formData.get('dislikes') || '';
        const dislikes = dislikesRaw.split(',').map(d => d.trim()).filter(Boolean);

        const profile = {
            household_size: household_size,
            dietary_restrictions: dietary_restrictions,
            cooking_skill: cooking_skill,
            budget_level: budget_level,
            time_per_meal: time_per_meal,
            dislikes: dislikes,
            appliances: appliances,
            members: [],
        };

        // Collect members from DOM
        const members = [];
        document.querySelectorAll('#kiq-members-container .kiq-member').forEach((mEl) => {
            const name = mEl.querySelector('.member-name')?.value || '';
            const appetite = parseInt(mEl.querySelector('.member-appetite')?.value || '3', 10);
            const age = parseInt(mEl.querySelector('.member-age')?.value || '') || null;
            const allergies = (mEl.querySelector('.member-allergies')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
            const intolerances = (mEl.querySelector('.member-intolerances')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
            const mdislikes = (mEl.querySelector('.member-dislikes')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
            members.push({ name, appetite, age, allergies, intolerances, dislikes: mdislikes });
        });

        if (members.length) profile.members = members;

        try {
            const response = await fetch(`${this.apiRoot}kitcheniq/v1/profile`, {
                method: 'POST',
                headers: { 'X-WP-Nonce': this.nonce, 'Content-Type': 'application/json' },
                body: JSON.stringify(profile),
            });
            if (response.ok) {
                this.showSavedIndicator();
            }
        } catch (err) {
            console.error('Autosave failed:', err);
        }
    }

    showSavedIndicator() {
        const el = document.getElementById('kiq-saved-indicator');
        if (!el) return;
        el.style.display = 'inline-block';
        clearTimeout(this._savedTimeout);
        this._savedTimeout = setTimeout(() => el.style.display = 'none', 1800);
    }

    populateFormFromProfile() {
        if (!this.profile || Object.keys(this.profile).length === 0) return;
        
        try {
            const form = document.getElementById('kiq-onboarding-form');
            if (!form) return;
            
            if (this.profile.household_size) {
                const hsInput = document.getElementById('household_size');
                if (hsInput) hsInput.value = this.profile.household_size;
            }
            if (this.profile.cooking_skill) {
                const csInput = document.getElementById('cooking_skill');
                if (csInput) csInput.value = this.profile.cooking_skill;
            }
            if (this.profile.budget_level) {
                const blInput = document.getElementById('budget_level');
                if (blInput) blInput.value = this.profile.budget_level;
            }
            if (this.profile.dietary_preferences) {
                const dpInput = document.getElementById('dietary_preferences');
                if (dpInput) dpInput.value = this.profile.dietary_preferences;
            }
            if (this.profile.allergies) {
                const aInput = document.getElementById('allergies');
                if (aInput) aInput.value = this.profile.allergies;
            }
            if (this.profile.dislikes) {
                const dInput = document.getElementById('dislikes');
                if (dInput) dInput.value = this.profile.dislikes;
            }
        } catch (err) {
            console.warn('populateFormFromProfile error:', err);
        }
    }

    updateProfileSummary() {
        try {
            const profile = this.profile || {};
            const summary = document.getElementById('kiq-profile-summary');
            if (summary) {
                summary.textContent = `${profile.household_size || 2} person household | ${profile.cooking_skill || 'unknown'} cook | ${profile.budget_level || 'moderate'} budget`;
            }
            const currentUserEl = document.getElementById('current-user');
            if (currentUserEl) {
                currentUserEl.textContent = String(this.currentUser || '');
            }
        } catch (err) {
            // ignore
        }
    }

    // Open the sidebar overlay and trap focus
    openSidebar() {
        if (document.body.classList.contains('kiq-sidebar-open')) return;

        // remember previous active element to restore focus on close
        this._prevActiveElement = document.activeElement;

        document.body.classList.add('kiq-sidebar-open');

        // insert overlay element if not present
        let overlay = document.querySelector('.kiq-sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'kiq-sidebar-overlay';
            document.body.appendChild(overlay);
        }

        // aria-hide the main content regions so screen readers ignore them
        const main = document.querySelector('.kiq-main');
        const bottom = document.querySelector('.kiq-bottom-nav');
        const topNav = document.getElementById('kiq-top-nav');
        if (main) main.setAttribute('aria-hidden', 'true');
        if (bottom) bottom.setAttribute('aria-hidden', 'true');
        if (topNav) topNav.setAttribute('aria-hidden', 'true');

        // focus the first focusable element inside the sidebar
        const sidebar = document.querySelector('.kiq-sidebar');
        if (sidebar) {
            const focusable = this._getFocusable(sidebar);
            if (focusable.length) {
                focusable[0].focus();
            } else {
                sidebar.setAttribute('tabindex', '-1');
                sidebar.focus();
            }
        }

        // click on overlay should close
        overlay.addEventListener('click', this._overlayClickHandler = (e) => {
            this.closeSidebar();
        });

        // keydown handler for Escape and focus trapping
        this._sidebarKeydownHandler = (ev) => {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                this.closeSidebar();
                return;
            }
            if (ev.key === 'Tab') {
                // focus trap
                const side = document.querySelector('.kiq-sidebar');
                const focusable = this._getFocusable(side);
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (ev.shiftKey && document.activeElement === first) {
                    ev.preventDefault();
                    last.focus();
                } else if (!ev.shiftKey && document.activeElement === last) {
                    ev.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', this._sidebarKeydownHandler);
    }

    // Close the sidebar and cleanup
    closeSidebar() {
        if (!document.body.classList.contains('kiq-sidebar-open')) return;

        document.body.classList.remove('kiq-sidebar-open');

        // remove aria-hidden from main regions
        const main = document.querySelector('.kiq-main');
        const bottom = document.querySelector('.kiq-bottom-nav');
        const topNav = document.getElementById('kiq-top-nav');
        if (main) main.removeAttribute('aria-hidden');
        if (bottom) bottom.removeAttribute('aria-hidden');
        if (topNav) topNav.removeAttribute('aria-hidden');

        // remove overlay click listener and element
        const overlay = document.querySelector('.kiq-sidebar-overlay');
        if (overlay) {
            overlay.removeEventListener('click', this._overlayClickHandler);
            // optionally remove from DOM
            overlay.parentNode && overlay.parentNode.removeChild(overlay);
        }

        // remove keydown listener
        if (this._sidebarKeydownHandler) {
            document.removeEventListener('keydown', this._sidebarKeydownHandler);
            this._sidebarKeydownHandler = null;
        }

        // restore focus to previously active element
        if (this._prevActiveElement && typeof this._prevActiveElement.focus === 'function') {
            this._prevActiveElement.focus();
        }
        this._prevActiveElement = null;
    }

    // Utility: return focusable elements inside container
    _getFocusable(container) {
        if (!container) return [];
        try {
            return Array.from(container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
                .filter(el => el.offsetParent !== null); // visible
        } catch (e) {
            return [];
        }
    }

    /* Deprecated: PWA registration now handled in constructor */

    /* Skeleton helpers */
    showSkeleton(containerId, count = 3, type = 'card') {
        const container = document.getElementById(containerId);
        if (!container) return;
        const html = new Array(count).fill(0).map(() => `<div class="kiq-skeleton" style="height:120px;margin-bottom:12px;"></div>`).join('');
        container.dataset.prevHtml = container.innerHTML;
        container.innerHTML = html;
    }

    hideSkeleton(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (container.dataset.prevHtml !== undefined) {
            container.innerHTML = container.dataset.prevHtml;
            delete container.dataset.prevHtml;
        }
    }

    showTab(tabName) {
        console.log('showTab called with:', tabName);
        
        // Hide all tabs
        document.querySelectorAll('[data-content]').forEach(el => {
            el.style.display = 'none';
        });

        // Remove active class from buttons
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        const tabContent = document.querySelector(`[data-content="${tabName}"]`);
        console.log('Found tab content for', tabName, ':', tabContent);
        if (tabContent) {
            tabContent.style.display = 'block';
        }

        // Add active class to button
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabBtn) {
            tabBtn.classList.add('active');
        }

        this.currentTab = tabName;

        // reflect in URL (shallow routing)
        try {
            const params = new URLSearchParams(window.location.search);
            params.set('view', tabName);
            const newUrl = window.location.pathname + '?' + params.toString();
            history.replaceState({}, '', newUrl);
        } catch (err) {
            // ignore
        }

        // update bottom nav active state if present
        document.querySelectorAll('.kiq-bottom-btn').forEach(b => b.classList.remove('active'));
        const bottomBtn = document.querySelector(`.kiq-bottom-btn[data-route="${tabName}"]`);
        if (bottomBtn) bottomBtn.classList.add('active');

        // update sidebar active state (sidebar is canonical nav)
        document.querySelectorAll('.kiq-side-btn').forEach(b => b.classList.remove('active'));
        const sideBtn = document.querySelector(`.kiq-side-btn[data-tab="${tabName}"]`);
        if (sideBtn) sideBtn.classList.add('active');
        // aria-current for assistive tech
        document.querySelectorAll('.kiq-side-btn').forEach(b => b.removeAttribute('aria-current'));
        if (sideBtn) sideBtn.setAttribute('aria-current', 'true');

        // Load data if needed
        if (tabName === 'dashboard' || tabName === 'inventory') {
            this.loadInventory();
        }

        // Initialize live tab helpers lazily
        if (tabName === 'live') {
            this.ensureLiveElements();
        }
    }

    ensureLiveElements() {
        if (!this.liveVideoEl) {
            this.liveVideoEl = document.getElementById('kiq-live-video');
        }
        if (!this.liveStatusEl) {
            this.liveStatusEl = document.getElementById('kiq-live-status');
        }
        if (!this.liveThreadEl) {
            this.liveThreadEl = document.getElementById('kiq-live-thread');
        }
    }

    setLiveStatus(text) {
        if (this.liveStatusEl) {
            this.liveStatusEl.textContent = text;
        }
    }

    async toggleLiveSession() {
        if (this.liveSessionActive) {
            this.stopLiveSession();
        } else {
            await this.startLiveSession();
        }
    }

    async startLiveSession() {
        try {
            this.ensureLiveElements();
            if (!navigator.mediaDevices?.getUserMedia) {
                this.setLiveStatus('Camera not supported on this device');
                return;
            }
            this.setLiveStatus('Requesting camera...');
            
            let stream = null;
            
            // Note: We do NOT request audio from getUserMedia here.
            // Web Speech API accesses the microphone independently and may conflict
            // if both try to use the same audio device. We only need video for frame capture.
            const constraints = {
                video: { 
                    facingMode: this.liveUsingRearCamera ? 'environment' : 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                console.log('Camera stream obtained (audio handled separately by Web Speech API)');
            } catch (err1) {
                console.warn('Failed with facingMode, trying without constraint', err1);
                // Fallback: Try video without facingMode
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
                    });
                    console.log('Camera stream obtained (fallback, no facingMode)');
                } catch (err2) {
                    // Complete failure
                    console.error('Camera request failed', err2);
                    throw err2;
                }
            }
            
            if (!stream) {
                this.setLiveStatus('Unable to access camera');
                return;
            }
            
            this.liveStream = stream;
            
            if (this.liveVideoEl) {
                this.liveVideoEl.srcObject = stream;
                await this.liveVideoEl.play();
            }
            
            this.liveSessionActive = true;
            this.liveRecognizing = false;
            
            this.setLiveStatus('Camera ready. Click "Talk" to start speaking.');
            
            // Update button text
            const startBtn = document.getElementById('kiq-live-start');
            if (startBtn) {
                startBtn.textContent = 'Stop Coach';
                startBtn.classList.add('btn-danger');
            }
            
        } catch (err) {
            console.error('Live session error:', err);
            this.liveSessionActive = false;
            
            let errorMsg = 'Camera unavailable';
            if (err.name === 'NotAllowedError') {
                errorMsg = 'Permission denied. Check browser camera settings.';
            } else if (err.name === 'NotFoundError') {
                errorMsg = 'No camera device found';
            } else if (err.name === 'NotReadableError') {
                errorMsg = 'Camera is in use by another app';
            }
            
            this.setLiveStatus(errorMsg);
        }
    }

    stopLiveSession() {
        if (this.liveStream) {
            this.liveStream.getTracks().forEach(t => t.stop());
            this.liveStream = null;
        }
        if (this.liveVideoEl) {
            this.liveVideoEl.srcObject = null;
        }
        this.liveSessionActive = false;
        this.liveRecognizing = false;
        if (this.liveAutoFrameInterval) {
            clearInterval(this.liveAutoFrameInterval);
            this.liveAutoFrameInterval = null;
        }
        this.setLiveStatus('Stopped');
        
        // Update button text
        const startBtn = document.getElementById('kiq-live-start');
        if (startBtn) {
            startBtn.textContent = 'Start Coach';
            startBtn.classList.remove('btn-danger');
        }
        
        const talkBtn = document.getElementById('kiq-live-ptt');
        if (talkBtn) {
            talkBtn.textContent = 'Talk to KitchenIQ Coach';
            talkBtn.classList.remove('listening');
        }
    }

    toggleCameraFacing() {
        // Toggle between rear and front camera without restarting
        if (!this.liveSessionActive) {
            this.setLiveStatus('Start camera first');
            return;
        }
        this.liveUsingRearCamera = !this.liveUsingRearCamera;
        const facingMode = this.liveUsingRearCamera ? 'rear' : 'front';
        this.setLiveStatus(`Switching to ${facingMode} camera...`);
        
        // Restart stream with new facing mode
        this.stopLiveSession();
        setTimeout(() => this.startLiveSession(), 300);
    }

    async captureLiveFrame() {
        try {
            this.ensureLiveElements();
            if (!this.liveVideoEl || !this.liveVideoEl.videoWidth) {
                this.setLiveStatus('Start camera first');
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = this.liveVideoEl.videoWidth;
            canvas.height = this.liveVideoEl.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.liveVideoEl, 0, 0, canvas.width, canvas.height);
            
            // Perform quality assessment on captured frame
            const quality = this.assessFrameQuality(canvas);
            console.log('Frame quality assessment:', quality);
            
            // Show quality badge if available
            if (quality.score < 0.6) {
                console.warn('Low frame quality:', quality.issues.join(', '));
                // Could prompt user but for now just log
            }
            
            this.liveLatestFrame = canvas.toDataURL('image/jpeg', 0.6);
            return this.liveLatestFrame;
        } catch (err) {
            console.error('Capture frame failed', err);
            return null;
        }
    }

    /**
     * Assess captured frame quality: brightness, blur, motion blur, etc.
     * Returns { score: 0-1, issues: [...], quality: 'good'|'warn'|'bad' }
     */
    assessFrameQuality(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const issues = [];
        let brightnesSum = 0;
        
        // Sample pixels (every 4th pixel for performance)
        const sampleCount = data.length / 16; // RGBA * 4
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            brightnesSum += (r + g + b) / 3;
        }
        
        const avgBrightness = brightnesSum / sampleCount;
        
        // Check for too dark
        if (avgBrightness < 50) {
            issues.push('too_dark');
        }
        
        // Check for too bright (blown out)
        if (avgBrightness > 230) {
            issues.push('too_bright');
        }
        
        // Simple blur detection via edge detection (Sobel-like)
        const edgeScore = this.estimateEdgeSharpness(canvas);
        if (edgeScore < 0.3) {
            issues.push('blurry');
        }
        
        // Calculate quality score
        let score = 1.0;
        if (avgBrightness < 50) score -= 0.3;
        if (avgBrightness > 230) score -= 0.2;
        if (edgeScore < 0.3) score -= 0.2;
        
        score = Math.max(0, Math.min(1, score));
        
        const quality = score >= 0.7 ? 'good' : score >= 0.4 ? 'warn' : 'bad';
        
        return { score, issues, quality };
    }

    /**
     * Estimate frame sharpness via edge detection
     */
    estimateEdgeSharpness(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let edgeSum = 0;
        let edgeCount = 0;
        
        // Sample edges (simple horizontal & vertical gradient check)
        for (let i = 0; i < data.length - 4 - canvas.width * 4; i += 16) {
            // Check horizontal gradient
            const dx = Math.abs(data[i] - data[i + 4]);
            // Check vertical gradient
            const dy = Math.abs(data[i] - data[i + canvas.width * 4]);
            
            edgeSum += (dx + dy) / 510;
            edgeCount++;
        }
        
        return edgeCount > 0 ? edgeSum / edgeCount : 0;
    }

    appendLiveMessage(role, text) {
        this.ensureLiveElements();
        if (!this.liveThreadEl) return;
        if (this.liveThreadEl.classList.contains('kiq-muted')) {
            this.liveThreadEl.classList.remove('kiq-muted');
            this.liveThreadEl.textContent = '';
        }
        const block = document.createElement('div');
        block.className = 'kiq-live-message';
        
        // Add role-specific class for styling
        if (role === 'You' || role === 'User') {
            block.classList.add('user');
        } else if (role === 'Coach') {
            block.classList.add('coach');
        } else if (role === 'System') {
            block.classList.add('system');
        }
        
        block.innerHTML = `
            <div class="kiq-live-message-sender">${role}</div>
            <div>${text}</div>
        `;
        this.liveThreadEl.appendChild(block);
        this.liveThreadEl.scrollTop = this.liveThreadEl.scrollHeight;
    }

    async toggleLiveAudio() {
        if (!this.liveSessionActive) {
            this.setLiveStatus('Start camera first');
            return;
        }

        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        // Toggle off if already listening
        if (this.liveRecognizing && this.liveRecognizer) {
            try {
                this.liveRecognizer.stop();
                if (this.liveAutoFrameInterval) {
                    clearInterval(this.liveAutoFrameInterval);
                    this.liveAutoFrameInterval = null;
                }
                this.setLiveStatus('Processing Coach response...');
            } catch (e) {
                console.error('Error stopping recognition:', e);
            }
            this.liveRecognizing = false;
            return;
        }

        // Fallback to text prompt if speech recognition is unavailable
        if (!Recognition) {
            console.warn('SpeechRecognition API not available');
            const transcript = window.prompt('Speech recognition not supported. Type your request for KIQ Coach:');
            if (transcript) {
                await this.sendLiveAssist(transcript);
            }
            return;
        }

        try {
            const recognizer = new Recognition();
            recognizer.continuous = true;  // Changed to true: don't auto-stop on pauses
            recognizer.interimResults = true;
            recognizer.lang = 'en-US';
            recognizer.maxAlternatives = 1;

            let finalTranscript = '';
            this.liveRecognizing = true;
            this.liveRecognizer = recognizer;
            this.setLiveStatus('Listening... (click "Stop listening" when done)');
            
            console.log('Speech recognition started in continuous mode');
            
            // Update button state
            const talkBtn = document.getElementById('kiq-live-ptt');
            if (talkBtn) {
                talkBtn.classList.add('listening');
                talkBtn.textContent = 'Stop listening';
            }

            // Start auto-frame capture every 8 seconds
            this.liveAutoFrameInterval = setInterval(async () => {
                await this.captureLiveFrame();
            }, 8000);

            recognizer.onstart = () => {
                console.log('Speech recognition onstart event fired');
            };

            recognizer.onresult = (event) => {
                console.log('onresult event:', event.results.length, 'results, isFinal:', event.results[event.results.length - 1]?.isFinal);
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript + ' ';
                    } else {
                        interim += result[0].transcript;
                    }
                }
                const heard = (finalTranscript + ' ' + interim).trim();
                if (heard) {
                    this.setLiveStatus(`Heard: ${heard}`);
                }
            };

            recognizer.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.liveRecognizing = false;
                if (this.liveAutoFrameInterval) {
                    clearInterval(this.liveAutoFrameInterval);
                    this.liveAutoFrameInterval = null;
                }
                
                let errorMsg = 'Microphone error';
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    errorMsg = 'Mic blocked - enable in browser settings';
                } else if (event.error === 'network') {
                    errorMsg = 'Network error - check connection';
                } else if (event.error === 'no-speech') {
                    errorMsg = 'No speech detected - try again';
                } else if (event.error === 'audio-capture') {
                    errorMsg = 'Mic not accessible - check permissions';
                }
                
                this.setLiveStatus(errorMsg);
                const talkBtn = document.getElementById('kiq-live-ptt');
                if (talkBtn) {
                    talkBtn.classList.remove('listening');
                    talkBtn.textContent = 'Talk to KitchenIQ Coach';
                }
            };

            recognizer.onend = async () => {
                console.log('Speech recognition onend event, finalTranscript:', finalTranscript);
                
                // Check if this was an unexpected stop (user didn't click stop button)
                const wasStillRecognizing = this.liveRecognizing;
                const text = (finalTranscript || '').trim();
                
                this.liveRecognizing = false;
                if (this.liveAutoFrameInterval) {
                    clearInterval(this.liveAutoFrameInterval);
                    this.liveAutoFrameInterval = null;
                }
                const talkBtn = document.getElementById('kiq-live-ptt');
                if (talkBtn) {
                    talkBtn.classList.remove('listening');
                    talkBtn.textContent = 'Talk to KitchenIQ Coach';
                }
                
                // If we have text, send it
                if (text) {
                    this.setLiveStatus('Sending to Coach...');
                    const frame = await this.captureLiveFrame();
                    await this.sendLiveAssist(text, frame);
                } else {
                    // No text captured
                    if (wasStillRecognizing) {
                        // Unexpected stop - likely browser timeout or interruption
                        this.setLiveStatus('Recognition stopped - click Talk to restart');
                        console.warn('Speech recognition stopped unexpectedly with no text');
                    } else {
                        // User manually stopped
                        this.setLiveStatus('No speech detected - try again');
                    }
                }
            };

            recognizer.start();
            console.log('Recognition.start() called');
        } catch (err) {
            console.error('Speech recognition exception:', err);
            this.liveRecognizing = false;
            const transcript = window.prompt('Error with speech recognition. Type your request for KIQ Coach:');
            if (transcript) {
                await this.sendLiveAssist(transcript);
            }
        }
    }

    /**
     * Stream voice input: sends transcript + frame to streaming /stream/voice endpoint
     * which returns SSE events with interim intents and suggestions.
     */
    async streamVoiceInput(transcript, frameDataUrl = null) {
        const frame = frameDataUrl || this.liveLatestFrame || '';
        
        console.log('streamVoiceInput: transcript length:', transcript?.length);
        
        this.appendLiveMessage('You', transcript || '(frame sent)');
        this.setLiveStatus('Processing voice...');
        
        try {
            const payload = { 
                transcript: transcript || '', 
                audio_chunk: frame // For Phase 1, frame can serve as interim; true audio chunks later
            };
            
            const res = await fetch(`${this.apiRoot}kitcheniq/v1/stream/voice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': this.nonce,
                },
                body: JSON.stringify(payload),
            });
            
            if (!res.ok) {
                const msg = `Voice stream error: ${res.status}`;
                this.setLiveStatus(msg);
                this.appendLiveMessage('Coach', msg);
                return;
            }
            
            // Handle Server-Sent Events
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let itemsDetected = [];
            let actions = [];
            let currentEvent = null;
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.substring(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6);
                        try {
                            const payload = JSON.parse(jsonStr);
                            const type = currentEvent || payload.event || '';

                            if (type === 'intent') {
                                itemsDetected = payload.items_detected || [];
                                actions = payload.actions || [];
                                if (itemsDetected.length > 0) {
                                    this.setLiveStatus(`Detected: ${itemsDetected.join(', ')}`);
                                }
                            } else if (type === 'suggestion') {
                                if (payload.message) this.appendLiveMessage('Coach', payload.message);
                            } else if (type === 'store_mode') {
                                this.appendLiveMessage('System', payload.message || 'Opening Store Mode…');
                                // Open Store Mode overlay
                                this.openStoreMode();
                            } else if (type === 'done') {
                                this.setLiveStatus('Voice processed');
                            }
                        } catch (parseErr) {
                            console.warn('Failed to parse SSE event:', jsonStr, parseErr);
                        }
                    }
                }
            }
            
            // Summarize detected items
            if (itemsDetected.length > 0) {
                const summary = `Coach heard: ${itemsDetected.join(', ')}`;
                this.appendLiveMessage('Coach', summary);
            } else {
                this.appendLiveMessage('Coach', 'Ready for more input');
            }
            
            this.setLiveStatus('Ready to talk');
            
        } catch (err) {
            console.error('Stream voice error:', err);
            this.setLiveStatus('Error streaming voice');
            this.appendLiveMessage('Coach', 'Stream error - try again');
        }
    }

    async sendLiveAssist(transcript, frameDataUrl = null) {
        // Use latest captured frame if not provided
        const frame = frameDataUrl || this.liveLatestFrame || '';
        
        console.log('sendLiveAssist called - transcript length:', transcript?.length, 'frame length:', frame?.length);
        
        this.setLiveStatus('Sending to Coach...');
        this.appendLiveMessage('You', transcript || '(frame sent)');
        try {
            const payload = { transcript: transcript || '', frame_jpeg: frame };
            console.log('Sending payload to /live-assist:', { 
                transcriptLength: payload.transcript.length, 
                frameLength: payload.frame_jpeg.length 
            });
            
            const res = await fetch(`${this.apiRoot}kitcheniq/v1/live-assist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': this.nonce,
                },
                body: JSON.stringify(payload),
            });
            
            console.log('Response status:', res.status, 'ok:', res.ok);
            
            const data = await res.json();
            console.log('Response data:', data);
            
            if (!res.ok || data.error) {
                const msg = data.message || data.error || 'Coach failed to respond';
                console.error('Coach error response:', msg);
                this.setLiveStatus(msg);
                this.appendLiveMessage('Coach', msg);
                return;
            }
            const msg = data.message || 'Received';
            console.log('Coach message:', msg);
            this.appendLiveMessage('Coach', msg);
            
            // Handle inventory updates from Coach
            if (data.inventory_updated && data.applied_changes) {
                console.log('Coach applied inventory changes:', data.applied_changes);
                
                // Show brief notification of changes
                const changesSummary = data.applied_changes.map(c => 
                    `${c.action === 'add' ? '➕' : c.action === 'remove' ? '➖' : '✏️'} ${c.name}`
                ).join(', ');
                
                this.appendLiveMessage('System', `Inventory updated: ${changesSummary}`);
                
                // Update local inventory state
                this.inventory = data.inventory || [];
                
                // Refresh inventory display if on that tab
                if (this.currentView === 'inventory') {
                    this.renderInventory();
                }
            }
            
            // Optionally play TTS if enabled
            if (this.liveTtsEnabled && 'speechSynthesis' in window) {
                try {
                    const utterance = new SpeechSynthesisUtterance(msg);
                    utterance.rate = 1.0;
                    utterance.pitch = 1.0;
                    speechSynthesis.cancel(); // Clear any pending utterances
                    speechSynthesis.speak(utterance);
                    console.log('TTS playback started');
                } catch (err) {
                    console.warn('TTS failed', err);
                }
            }
            
            this.setLiveStatus('Ready to talk');
        } catch (err) {
            console.error('Live assist error:', err);
            this.setLiveStatus('Error sending to Coach');
            this.appendLiveMessage('Coach', 'Error - please try again');
        }
    }

    async handleOnboarding(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        
        // Build profile payload similar to autosave
        const household_size = parseInt(formData.get('household_size')) || 2;
        const profile = {
            household_size: household_size,
            dietary_restrictions: formData.getAll('dietary_restrictions'),
            cooking_skill: formData.get('cooking_skill'),
            budget_level: formData.get('budget_level'),
            time_per_meal: formData.get('time_per_meal'),
            dislikes: (formData.get('dislikes') || '').split(',').map(d => d.trim()).filter(Boolean),
            appliances: formData.getAll('appliances'),
            members: [],
        };

        // collect members from DOM
        document.querySelectorAll('#kiq-members-container .kiq-member').forEach((mEl) => {
            const name = mEl.querySelector('.member-name')?.value || '';
            const appetite = parseInt(mEl.querySelector('.member-appetite')?.value || '3', 10);
            const age = parseInt(mEl.querySelector('.member-age')?.value || '') || null;
            const allergies = (mEl.querySelector('.member-allergies')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
            const intolerances = (mEl.querySelector('.member-intolerances')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
            const mdislikes = (mEl.querySelector('.member-dislikes')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
            profile.members.push({ name, appetite, age, allergies, intolerances, dislikes: mdislikes });
        });

        try {
            const response = await fetch(`${this.apiRoot}kitcheniq/v1/profile`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': this.nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(profile),
            });

            const data = await response.json();
            if (data.success) {
                this.profile = data.profile;
                this.showNotification('Profile saved! Let\'s scan your pantry.', 'success');
                this.showTab('inventory');
            } else {
                this.showNotification('Error saving profile', 'error');
            }
        } catch (error) {
            console.error('Onboarding error:', error);
            this.showNotification('Error saving profile', 'error');
        }
    }

    triggerCameraUpload() {
        const fileInput = document.getElementById('kiq-camera-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    // Multi-photo gallery state
    pendingPhotos = [];

    handleMultiImageSelect(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        // Convert files to data URLs and add to gallery
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                this.pendingPhotos.push({
                    dataUrl: event.target.result,
                    name: file.name,
                    id: Date.now() + Math.random()
                });
                this.renderPhotoGallery();
            };
            reader.readAsDataURL(file);
        });

        // Reset input so same files can be re-selected
        e.target.value = '';
    }

    renderPhotoGallery() {
        const previewContainer = document.getElementById('kiq-photo-preview');
        const gallery = document.getElementById('kiq-photo-gallery');
        const countEl = document.getElementById('kiq-photo-count');

        if (!previewContainer || !gallery) return;

        if (this.pendingPhotos.length === 0) {
            previewContainer.style.display = 'none';
            gallery.innerHTML = '';
            return;
        }

        previewContainer.style.display = 'block';
        countEl.textContent = this.pendingPhotos.length;

        gallery.innerHTML = this.pendingPhotos.map((photo, index) => `
            <div class="kiq-photo-item" data-photo-id="${photo.id}">
                <img src="${photo.dataUrl}" alt="Photo ${index + 1}" />
                <button type="button" class="kiq-photo-remove" data-photo-id="${photo.id}" aria-label="Remove photo" title="Remove photo">−</button>
                <span class="kiq-photo-label">${index + 1}</span>
            </div>
        `).join('');

        // Bind remove handlers
        gallery.querySelectorAll('.kiq-photo-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const photoId = parseFloat(e.target.dataset.photoId);
                this.pendingPhotos = this.pendingPhotos.filter(p => p.id !== photoId);
                this.renderPhotoGallery();
            });
        });
    }

    clearPhotoGallery() {
        this.pendingPhotos = [];
        this.renderPhotoGallery();
    }

    async scanAllPhotos() {
        if (this.pendingPhotos.length === 0) {
            this.showNotification('No photos to scan. Add some photos first.', 'error');
            return;
        }

        this.showSkeleton('kiq-inventory-list', 4, 'inventory');
        
        const btn = document.getElementById('kiq-scan-all-photos');
        const cameraBtn = document.getElementById('kiq-camera-btn');
        const originalText = btn?.textContent || 'Scan all photos';
        
        if (btn) {
            btn.textContent = `Scanning ${this.pendingPhotos.length} photos...`;
            btn.disabled = true;
        }
        if (cameraBtn) cameraBtn.disabled = true;

        try {
            const imageUrls = this.pendingPhotos.map(p => p.dataUrl);

            const response = await fetch(`${this.apiRoot}kitcheniq/v1/inventory-scan`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': this.nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image_urls: imageUrls }),
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.message || data.error || `Error: ${response.status}`;
                console.error('Multi-photo scan error:', response.status, data);
                this.showNotification(errorMsg, 'error');
                this.hideSkeleton('kiq-inventory-list');
            } else if (data.success) {
                this.inventory = this.postProcessInventory(data.inventory || []);
                this.hideSkeleton('kiq-inventory-list');
                this.renderInventory();
                this.showNotification(`Added ${data.items_added} items from ${this.pendingPhotos.length} photos`, 'success');
                this.clearPhotoGallery();
            } else {
                this.hideSkeleton('kiq-inventory-list');
                this.showNotification(data.error || 'Error processing photos', 'error');
            }
        } catch (error) {
            console.error('Multi-photo scan error:', error);
            this.showNotification('Error: ' + error.message, 'error');
            this.hideSkeleton('kiq-inventory-list');
        } finally {
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
            if (cameraBtn) cameraBtn.disabled = false;
        }
    }

    // Legacy single-image handler (kept for backwards compatibility)
    async handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        // Redirect to multi-photo flow
        this.handleMultiImageSelect(e);
    }

    // Video upload state
    pendingVideo = null;
    pendingVideoObjectUrl = null;

    triggerVideoUpload() {
        const videoInput = document.getElementById('kiq-video-input');
        if (videoInput) {
            videoInput.click();
        }
    }

    handleVideoSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('video/')) {
            this.showNotification('Please select a video file', 'error');
            return;
        }

        // Check file size (max 100MB for reasonable upload)
        const maxSizeMB = 100;
        if (file.size > maxSizeMB * 1024 * 1024) {
            this.showNotification(`Video must be under ${maxSizeMB}MB`, 'error');
            return;
        }

        this.pendingVideo = file;

        // Clean up any previous preview URL
        if (this.pendingVideoObjectUrl) {
            try { URL.revokeObjectURL(this.pendingVideoObjectUrl); } catch (e) {}
            this.pendingVideoObjectUrl = null;
        }

        // Create object URL for preview
        const videoUrl = URL.createObjectURL(file);
        this.pendingVideoObjectUrl = videoUrl;
        const videoPlayer = document.getElementById('kiq-video-player');
        const previewContainer = document.getElementById('kiq-video-preview');

        if (videoPlayer) {
            videoPlayer.src = videoUrl;
        }
        if (previewContainer) {
            previewContainer.style.display = 'block';
        }

        // Reset input for re-selection
        e.target.value = '';
    }

    clearVideo() {
        this.pendingVideo = null;
        if (this.pendingVideoObjectUrl) {
            try { URL.revokeObjectURL(this.pendingVideoObjectUrl); } catch (e) {}
        }
        this.pendingVideoObjectUrl = null;

        const videoPlayer = document.getElementById('kiq-video-player');
        const previewContainer = document.getElementById('kiq-video-preview');

        if (videoPlayer) {
            videoPlayer.src = '';
        }
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
    }

    async scanVideo() {
        if (!this.pendingVideo) {
            this.showNotification('No video selected. Record or select a video first.', 'error');
            return;
        }

        this.showSkeleton('kiq-inventory-list', 4, 'inventory');

        const btn = document.getElementById('kiq-scan-video');
        const videoBtn = document.getElementById('kiq-video-btn');
        const originalText = btn?.textContent || 'Scan video + audio';

        if (btn) {
            btn.textContent = 'Processing video...';
            btn.disabled = true;
        }
        if (videoBtn) videoBtn.disabled = true;

        try {
            console.log('Scanning video file:', {
                type: this.pendingVideo.type,
                sizeMB: Math.round((this.pendingVideo.size || 0) / 1024 / 1024 * 10) / 10,
                name: this.pendingVideo.name,
            });

            // First, upload video file for audio transcription
            const formData = new FormData();
            formData.append('video', this.pendingVideo);

            // First transcribe the audio
            let transcription = '';
            try {
                const transcribeResponse = await fetch(`${this.apiRoot}kitcheniq/v1/transcribe-audio`, {
                    method: 'POST',
                    headers: {
                        'X-WP-Nonce': this.nonce,
                    },
                    body: formData,
                });

                if (transcribeResponse.ok) {
                    const transcribeData = await transcribeResponse.json();
                    transcription = transcribeData.transcription || '';
                    if (transcription) {
                        console.log('Audio transcription:', transcription);
                    }
                }
            } catch (transcribeError) {
                console.warn('Audio transcription failed, continuing with video frames only:', transcribeError);
            }

            // Now scan the video frames via multipart (preferred; avoids huge base64 JSON payloads)
            const scanForm = new FormData();
            scanForm.append('video', this.pendingVideo);
            if (transcription) {
                scanForm.append('audio_transcription', transcription);
            }

            const response = await fetch(`${this.apiRoot}kitcheniq/v1/inventory-scan-video`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': this.nonce,
                },
                body: scanForm,
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.message || data.error || `Error: ${response.status}`;
                console.error('Video scan error:', response.status, data);
                // Show more details if available
                if (data.params_found) {
                    console.error('Params found by server:', data.params_found);
                }
                if (data.suggestion) {
                    this.showNotification(`${errorMsg}. ${data.suggestion}`, 'error');
                } else {
                    this.showNotification(errorMsg, 'error');
                }
                this.hideSkeleton('kiq-inventory-list');
            } else if (data.success) {
                this.inventory = this.postProcessInventory(data.inventory || []);
                this.hideSkeleton('kiq-inventory-list');
                this.renderInventory();
                const transcriptionNote = transcription ? ' (with audio)' : '';
                this.showNotification(`Added ${data.items_added} items from video${transcriptionNote}`, 'success');
                this.clearVideo();
            } else {
                this.hideSkeleton('kiq-inventory-list');
                this.showNotification(data.error || 'Error processing video', 'error');
            }
        } catch (error) {
            console.error('Video scan error:', error);
            this.showNotification('Error: ' + error.message, 'error');
            this.hideSkeleton('kiq-inventory-list');
        } finally {
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
            if (videoBtn) videoBtn.disabled = false;
        }
    }

    async generateMeals() {
        return this.generateMealsWithOptions();
    }

    async generateMealsWithOptions(moreSeed = null) {
        const planTypeSelect = document.getElementById('kiq-plan-type');
        const moodInput = document.getElementById('kiq-mood');
        
        const planType = planTypeSelect?.value || 'balanced';
        const mood = moodInput?.value || null;

        const btn = document.getElementById('kiq-generate-meals-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Generating meals...';
        btn.disabled = true;

        try {
            this.showSkeleton('kiq-meal-results', 3, 'meals');
            const body = { plan_type: planType, mood: mood };
            if (moreSeed) body.more_seed = moreSeed;

            const response = await fetch(`${this.apiRoot}kitcheniq/v1/meals`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': this.nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            
            // Better error handling - log the response
            if ( !response.ok ) {
                const errorMsg = data.message || data.error || 'Unknown error';
                console.error('Meals API error:', response.status, errorMsg, data);
                this.showNotification(errorMsg || 'Error generating meals', 'error');
                btn.textContent = originalText;
                btn.disabled = false;
                return;
            }
            
            if (data.success || data.meals) {
                this.mealPlan = data.meal_plan || data;
                this.hideSkeleton('kiq-meal-results');
                this.renderMealPlan();
                this.showNotification('Meals generated!', 'success');
            } else {
                this.hideSkeleton('kiq-meal-results');
                this.showNotification(data.error || 'Error generating meals', 'error');
            }
        } catch (error) {
            console.error('Meal generation error:', error);
            this.showNotification('Error generating meals', 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    renderInventory() {
        const container = document.getElementById('kiq-inventory-list');
        if (!container) return;

        const filteredItems = this.getFilteredInventory();
        const isSearching = this.currentSearchQuery && this.currentSearchQuery.length > 0;

        if (!this.inventory || this.inventory.length === 0) {
            container.innerHTML = `
                <div class="kiq-empty">
                    <h3>No items yet</h3>
                    <p class="kiq-muted">Scan your pantry or add items manually to keep meals accurate.</p>
                </div>`;
            return;
        }

        if (isSearching && filteredItems.length === 0) {
            container.innerHTML = `
                <div class="kiq-empty kiq-search-empty">
                    <h3>Not in your pantry</h3>
                    <p class="kiq-muted">No items match your search. You might need to buy this!</p>
                </div>`;
            return;
        }

        // **Phase 2: Group by location**
        const grouped = this.groupInventoryByLocation(filteredItems);

        let groupedHtml = '';
        for (const [location, items] of Object.entries(grouped)) {
            const locationLabel = this.getLocationLabel(location);
            const itemsWithIndices = items.map(item => ({
                item,
                originalIndex: this.inventory.indexOf(item)
            }));

            const itemsHtml = itemsWithIndices.map(({ item, originalIndex }) => {
                const statusLabel = (item.status || 'fresh').toString().toLowerCase();
                const decayScore = item.decay_score ?? 0;
                const confidence = item.confidence ?? 1.0;
                const badges = this.getInventoryBadges(item, decayScore, confidence);

                return `
                <div class="kiq-inventory-item" data-index="${originalIndex}">
                    <div class="kiq-item-top">
                        <div>
                            <div class="kiq-item-name">${item.name || 'Unnamed item'}</div>
                            <div class="kiq-item-details">
                                <span class="kiq-category">${item.category || 'other'}</span>
                                <span class="kiq-status kiq-status-${statusLabel}">${statusLabel}</span>
                                ${badges}
                            </div>
                            ${item.expiry_estimate ? `<div class="kiq-expiry">Expires: ${item.expiry_estimate}</div>` : ''}
                            ${item.best_by ? `<div class="kiq-expiry">Best by: ${new Date(item.best_by).toLocaleDateString()}</div>` : ''}
                        </div>
                        <div class="kiq-item-actions">
                            ${item.quantity ? `<span class="kiq-pill-muted">Qty: ${item.quantity}</span>` : ''}
                            <button type="button" class="kiq-confirm-btn" data-action="confirm-item" aria-label="Confirm ${item.name || 'item'}" title="Confirm freshness">✓</button>
                            <button type="button" class="kiq-remove-btn" data-action="remove-item" aria-label="Remove ${item.name || 'item'}" title="Remove item">−</button>
                        </div>
                    </div>

                    <div class="kiq-item-edit">
                        <label>Quantity
                            <input type="number" min="0" step="0.25" value="${item.quantity ?? 1}" data-action="qty" />
                        </label>
                        <label>Location
                            <select data-action="location">
                                <option value="pantry" ${item.location === 'pantry' ? 'selected' : ''}>Pantry</option>
                                <option value="fridge" ${item.location === 'fridge' ? 'selected' : ''}>Fridge</option>
                                <option value="freezer" ${item.location === 'freezer' ? 'selected' : ''}>Freezer</option>
                            </select>
                        </label>
                        <label>Category
                            <select data-action="category">
                                <option value="meats" ${item.category === 'meats' ? 'selected' : ''}>Meats</option>
                                <option value="veg" ${item.category === 'veg' ? 'selected' : ''}>Vegetables</option>
                                <option value="condiments" ${item.category === 'condiments' ? 'selected' : ''}>Condiments</option>
                                <option value="dry" ${item.category === 'dry' ? 'selected' : ''}>Dry Goods</option>
                                <option value="spices" ${item.category === 'spices' ? 'selected' : ''}>Spices</option>
                                <option value="drinks" ${item.category === 'drinks' ? 'selected' : ''}>Drinks</option>
                                <option value="prepared" ${item.category === 'prepared' ? 'selected' : ''}>Prepared</option>
                                <option value="other" ${item.category === 'other' ? 'selected' : ''}>Other</option>
                            </select>
                        </label>
                        <label>Status
                            <select data-action="status">
                                <option value="fresh" ${statusLabel === 'fresh' ? 'selected' : ''}>Fresh</option>
                                <option value="nearing" ${statusLabel === 'nearing' ? 'selected' : ''}>Expiring Soon</option>
                                <option value="expired" ${statusLabel === 'expired' ? 'selected' : ''}>Expired</option>
                                <option value="low" ${statusLabel === 'low' ? 'selected' : ''}>Low</option>
                                <option value="out" ${statusLabel === 'out' ? 'selected' : ''}>Out</option>
                            </select>
                        </label>
                    </div>
                </div>
            `}).join('');

            groupedHtml += `
                <div class="kiq-inventory-group">
                    <h3 class="kiq-group-header">
                        <span class="kiq-location-icon">${this.getLocationIcon(location)}</span>
                        ${locationLabel}
                        <span class="kiq-group-count">${items.length}</span>
                    </h3>
                    ${itemsHtml}
                </div>
            `;
        }

        container.innerHTML = groupedHtml;
    }

    groupInventoryByLocation(items) {
        const groups = {
            fridge: [],
            freezer: [],
            pantry: []
        };

        items.forEach(item => {
            const location = item.location || 'pantry';
            if (!groups[location]) {
                groups[location] = [];
            }
            groups[location].push(item);
        });

        // Remove empty groups
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) {
                delete groups[key];
            }
        });

        return groups;
    }

    getLocationLabel(location) {
        const labels = {
            fridge: 'Fridge',
            freezer: 'Freezer',
            pantry: 'Pantry'
        };
        return labels[location] || location;
    }

    getLocationIcon(location) {
        const icons = {
            fridge: '❄️',
            freezer: '🧊',
            pantry: '🗄️'
        };
        return icons[location] || '📦';
    }

    getInventoryBadges(item, decayScore, confidence) {
        const badges = [];

        // Expiring soon badge
        if (decayScore >= 70 && decayScore < 90) {
            badges.push('<span class="kiq-badge kiq-badge-warning">⏰ Expiring Soon</span>');
        }

        // Expired badge
        if (decayScore >= 90) {
            badges.push('<span class="kiq-badge kiq-badge-danger">⚠️ Expired</span>');
        }

        // Low confidence badge
        if (confidence < 0.7) {
            badges.push('<span class="kiq-badge kiq-badge-info">❓ Needs Confirm</span>');
        }

        // Needs confirmation (not confirmed in 7+ days)
        if (item.last_confirmed_at) {
            const daysSinceConfirm = (new Date() - new Date(item.last_confirmed_at)) / (1000 * 60 * 60 * 24);
            if (daysSinceConfirm > 7) {
                badges.push('<span class="kiq-badge kiq-badge-info">🔄 Check Status</span>');
            }
        } else if (item.added_at) {
            const daysSinceAdd = (new Date() - new Date(item.added_at)) / (1000 * 60 * 60 * 24);
            if (daysSinceAdd > 7) {
                badges.push('<span class="kiq-badge kiq-badge-info">🔄 Check Status</span>');
            }
        }

        return badges.length > 0 ? `<div class="kiq-badges">${badges.join('')}</div>` : '';
    }

    addManualInventoryItem(e) {
        e.preventDefault();
        const form = e.target;
        const name = form.name?.value?.trim();
        if (!name) {
            this.showNotification('Please enter an item name', 'error');
            return;
        }
        const quantity = parseFloat(form.quantity?.value || '1') || 1;
        const category = form.category?.value || 'pantry';
        const status = form.status?.value || 'fresh';

        if (!this.inventory) this.inventory = [];
        this.inventory.push({ name, quantity, category, status });
        this.renderInventory();
        this.saveInventory({ silent: true });
        form.reset();
        const qty = form.querySelector('#kiq-item-quantity');
        if (qty) qty.value = 1;
        this.showNotification('Item added to inventory', 'success');
    }

    updateInventoryItem(index, updates = {}) {
        if (!this.inventory || !this.inventory[index]) return;
        this.inventory[index] = { ...this.inventory[index], ...updates };
        this.saveInventory({ silent: true });
        this.renderInventory();
    }

    removeInventoryItem(index) {
        if (!this.inventory || !this.inventory[index]) return;
        this.inventory.splice(index, 1);
        this.saveInventory({ silent: true });
        this.renderInventory();
    }

    confirmInventoryItem(index) {
        if (!this.inventory || !this.inventory[index]) return;
        
        // Update local item
        const item = this.inventory[index];
        item.last_confirmed_at = new Date().toISOString();
        item.confidence = 1.0;
        
        // Save locally first
        this.saveInventory({ silent: true });
        
        // Call backend to recalculate decay score
        const itemId = item.id || item.name;
        fetch(`${this.apiRoot}kitcheniq/v1/inventory/bulk-confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': this.nonce
            },
            body: JSON.stringify({ item_ids: [itemId] })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                this.showNotification('Item confirmed fresh', 'success');
                // Reload inventory to get updated decay scores
                this.loadInventory();
            }
        })
        .catch(err => {
            console.error('Confirm item failed:', err);
        });
    }

    // Pantry search state
    currentSearchQuery = '';

    handlePantrySearch(query) {
        this.currentSearchQuery = query.trim().toLowerCase();
        const clearBtn = document.getElementById('kiq-search-clear');
        const resultsInfo = document.getElementById('kiq-search-results-info');
        
        if (clearBtn) {
            clearBtn.style.display = this.currentSearchQuery ? 'flex' : 'none';
        }

        this.renderInventory();

        // Show search results info
        if (resultsInfo) {
            if (this.currentSearchQuery && this.inventory?.length) {
                const matches = this.getFilteredInventory().length;
                const total = this.inventory.length;
                if (matches === 0) {
                    resultsInfo.innerHTML = `<span class="kiq-search-no-match">No items match "<strong>${this.escapeHtml(query)}</strong>"</span>`;
                    resultsInfo.style.display = 'block';
                } else {
                    resultsInfo.innerHTML = `Found <strong>${matches}</strong> of ${total} items`;
                    resultsInfo.style.display = 'block';
                }
            } else {
                resultsInfo.style.display = 'none';
            }
        }
    }

    clearPantrySearch() {
        const searchInput = document.getElementById('kiq-pantry-search');
        if (searchInput) {
            searchInput.value = '';
        }
        this.handlePantrySearch('');
    }

    getFilteredInventory() {
        if (!this.inventory || !this.currentSearchQuery) {
            return this.inventory || [];
        }
        const q = this.currentSearchQuery;
        return this.inventory.filter(item => {
            const name = (item.name || '').toLowerCase();
            const category = (item.category || '').toLowerCase();
            return name.includes(q) || category.includes(q);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Heuristic post-processing to merge duplicates and infer freshness/quantity
    postProcessInventory(items) {
        if (!Array.isArray(items)) return [];

        const normalizeName = (name) => {
            if (!name) return '';
            const n = name.toLowerCase().trim();
            // map common variants
            const maps = [
                [/^sparkling\s*water|^seltzer|^club\s*soda$/, 'sparkling water'],
                [/^soda$|^pop$/, 'soft drink'],
                [/^bbq\s*sweet\s*potato\s*chips?$/, 'sweet potato chips (bbq)'],
                [/^cherry\s*tomatoes?$/, 'cherry tomatoes'],
                [/^roma\s*tomatoes?$/, 'roma tomato'],
                [/^tomatoes?$/, 'tomato'],
            ];
            for (const [re, val] of maps) { if (re.test(n)) return val; }
            return n;
        };

        const inferQuantity = (name, qty) => {
            let q = parseFloat(qty); if (isNaN(q)) q = 1;
            const n = (name || '').toLowerCase();
            if (/(half|1\/2)\s*tomato/.test(n)) q = Math.max(q, 0.5);
            if (/pack|bag|box/.test(n) && q < 1) q = 1; // minimum one unit
            // bag fullness cues
            if (/bag.*(half|1\/2|partially|half\s*empty)/.test(n)) {
                q = Math.min(q, 0.5);
            }
            return q;
        };

        const inferStatus = (name, status) => {
            const base = (status || 'fresh').toLowerCase();
            const n = (name || '').toLowerCase();
            if (/(half|cut|opened|open|half\s*empty|wilt|bruised|soft)/.test(n)) {
                return 'low';
            }
            return base;
        };

        // Aggregate by normalized name
        const buckets = new Map();
        for (const item of items) {
            const norm = normalizeName(item.name);
            const key = norm;
            const qty = inferQuantity(item.name, item.quantity);
            const status = inferStatus(item.name, item.status);
            const category = item.category || this.mapCategory(norm);
            const existing = buckets.get(key);
            if (existing) {
                existing.quantity += qty;
                // degrade status if any are low
                if (status === 'low') existing.status = 'low';
            } else {
                buckets.set(key, {
                    name: norm || (item.name || 'item'),
                    quantity: qty,
                    category,
                    status,
                });
            }
        }

        // Round reasonable quantities
        return Array.from(buckets.values()).map(it => ({
            ...it,
            quantity: Number.isFinite(it.quantity) ? Math.round(it.quantity * 100) / 100 : 1,
        }));
    }

    mapCategory(normName) {
        const n = (normName || '').toLowerCase();
        if (n.includes('sparkling water')) return 'beverages.water';
        if (n.includes('soft drink')) return 'beverages.soda';
        if (n.includes('chips')) return 'snacks.chips';
        if (n.includes('tomato')) return 'produce';
        return 'pantry';
    }

    normalizeItemName(name) {
        return (name || '').toString().trim().toLowerCase();
    }

    escapeForRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    isStapleItem(name) {
        const normalized = this.normalizeItemName(name);
        if (!normalized) return false;
        return this.stapleItems.some((staple) => {
            const stapleNorm = this.escapeForRegex(this.normalizeItemName(staple));
            const pattern = new RegExp(`\\b${stapleNorm}\\b`, 'i');
            return pattern.test(normalized);
        });
    }

    inventoryHasItem(name) {
        const normalized = this.normalizeItemName(name);
        if (!normalized || !Array.isArray(this.inventory)) return false;
        return this.inventory.some((item) => this.normalizeItemName(item.name) === normalized);
    }

    getFilteredMissingItems(meal) {
        const items = (meal?.missing_items && meal.missing_items.length)
            ? meal.missing_items
            : this.deriveMissingFromIngredients(meal);
        const seen = new Set();
        return items.filter((entry) => {
            const normalized = this.normalizeItemName(entry.item);
            if (!normalized || seen.has(normalized)) return false;
            if (this.isStapleItem(normalized)) return false;
            if (this.inventoryHasItem(normalized)) return false;
            seen.add(normalized);
            return true;
        });
    }

    deriveMissingFromIngredients(meal) {
        const ingredients = meal?.ingredients_used || [];
        return ingredients
            .map((ing) => ing.ingredient || ing.item || ing.name || '')
            .filter(Boolean)
            .map((name) => ({ item: name, importance: 'needed' }));
    }

    cleanInstructionStep(step) {
        if (!step) return '';
        return step.replace(/^\s*(?:\d+[.)]\s*|[a-zA-Z]\)\s*|[\-\u2022•]\s+)?/, '').trim();
    }

    addMissingItemToPantry(mealIndex, itemName) {
        if (!itemName) return;
        const normalized = this.normalizeItemName(itemName);
        if (!normalized) return;

        if (!this.inventory) this.inventory = [];

        if (this.inventoryHasItem(normalized)) {
            this.removeMissingItemFromMeals(itemName);
            this.renderMealPlan();
            if (this.selectedMealIndex !== null) this.showMealIngredients(this.selectedMealIndex);
            this.showNotification(`${itemName} is already in your pantry`, 'info');
            return;
        }

        this.inventory.push({ name: itemName, quantity: 1, category: 'pantry', status: 'fresh' });
        this.saveInventory({ silent: true });
        this.removeMissingItemFromMeals(itemName);
        this.renderMealPlan();
        if (this.selectedMealIndex !== null) this.showMealIngredients(this.selectedMealIndex);
        this.showNotification(`${itemName} added to pantry`, 'success');
    }

    removeMissingItemFromMeals(itemName) {
        if (!this.mealPlan || !Array.isArray(this.mealPlan.meals)) return;
        const normalized = this.normalizeItemName(itemName);
        this.mealPlan.meals = this.mealPlan.meals.map((meal) => {
            const filteredMissing = (meal.missing_items || []).filter((entry) => this.normalizeItemName(entry.item) !== normalized);
            return { ...meal, missing_items: filteredMissing };
        });
    }

    formatInstructions(instructions) {
        if (!instructions) return [];

        // Prefer explicit line breaks; fallback to sentence splits if needed
        const lineSplit = instructions
            .replace(/\r\n/g, '\n')
            .split(/\n+/)
            .map(s => s.trim())
            .filter(Boolean);

        if (lineSplit.length > 1) {
            return lineSplit.map((step) => this.cleanInstructionStep(step)).filter(Boolean);
        }

        const sentenceSplit = instructions
            .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
            .map(s => s.trim())
            .filter(Boolean);

        const steps = sentenceSplit.length ? sentenceSplit : [instructions.trim()];
        return steps.map((step) => this.cleanInstructionStep(step)).filter(Boolean);
    }

    renderMealPlan() {
        const container = document.getElementById('kiq-meal-results');
        if (!container || !this.mealPlan) return;

        const meals = this.mealPlan.meals || [];

        const mealsHtml = meals.map((meal, idx) => {
            const filteredMissing = this.getFilteredMissingItems(meal);
            const missingList = filteredMissing.length
                ? filteredMissing.map(item => `
                    <li>
                        ${item.item} <small>(${item.importance || 'needed'})</small>
                        <button type="button" class="btn btn-link kiq-inline-add" data-action="add-missing-item" data-meal-index="${idx}" data-missing-name="${item.item}">Add to pantry</button>
                    </li>
                `).join('')
                : '<li class="kiq-no-items"><em>All covered by your pantry or staples</em></li>';

            return `
                <div class="kiq-meal-card">
                    <div class="kiq-meal-header">
                        <h3>${meal.meal_name}</h3>
                    </div>

                    <div class="kiq-meal-meta">
                        <div class="kiq-meta-pill">
                            <span class="kiq-meta-label">Course</span>
                            <span class="kiq-meta-value">${meal.meal_type || 'Meal'}</span>
                        </div>
                        <div class="kiq-meta-pill">
                            <span class="kiq-meta-label">Cook time</span>
                            <span class="kiq-meta-value">${meal.cooking_time_mins || '?'} mins</span>
                        </div>
                        <div class="kiq-meta-pill">
                            <span class="kiq-meta-label">Effort</span>
                            <span class="kiq-meta-value">${meal.difficulty || 'Medium'}</span>
                        </div>
                    </div>

                    <div class="kiq-ingredients">
                        <h4>Ingredients:</h4>
                        <ul>
                            ${(meal.ingredients_used || []).map(ing => `
                                <li>${ing.ingredient} - ${ing.quantity}</li>
                            `).join('')}
                        </ul>
                    </div>

                    <div class="kiq-missing">
                        <h4>Need to buy:</h4>
                        <ul>${missingList}</ul>
                    </div>

                    <div class="kiq-instructions">
                        <h4>Instructions:</h4>
                        ${(() => {
                            const steps = this.formatInstructions(meal.instructions);
                            return steps.length ? `<ol class="kiq-steps">${steps.map(step => `<li>${step}</li>`).join('')}</ol>` : '<p>No instructions provided.</p>';
                        })()}
                    </div>

                    <div class="kiq-meal-actions">
                        <button data-meal-index="${idx}" class="btn btn-primary kiq-select-meal">
                            Select this meal
                        </button>
                        <button onclick="kitcheniq.rateMeal('${meal.meal_name}', ${idx})" class="btn btn-secondary" style="margin-left:8px;">
                            Rate
                        </button>
                    </div>

                    <!-- Shopping list appears after selection -->
                    <div class="kiq-meal-shopping" style="display:none;">
                        <hr style="margin: 16px 0; border: none; border-top: 1px solid #e0e0e0;" />
                        <div class="kiq-shopping-list-inline">
                            <h4>Items to Consider Buying:</h4>
                            ${!this.inventory || this.inventory.length === 0 ? `
                                <p style="color: #d97706; font-size: 13px; margin: 0 0 12px 0; background-color: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 12px; border-radius: 4px;">
                                    💡 <strong>Scan your pantry</strong> to see what you already have and get accurate shopping recommendations.
                                </p>
                            ` : `
                                <p style="color: #666; font-size: 12px; margin: 0 0 12px 0; font-style: italic;">
                                    Based on common pantry items.
                                </p>
                            `}
                            <ul>
                                ${filteredMissing.length ? filteredMissing.map(item => `<li>${item.item}</li>`).join('') : '<li class="kiq-no-items"><em>No specific items flagged as missing for this meal</em></li>'}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = mealsHtml;

        // Wire select handlers to show shopping list and update selected ingredients area
        setTimeout(() => {
            document.querySelectorAll('.kiq-select-meal').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(btn.dataset.mealIndex, 10);
                    const card = btn.closest('.kiq-meal-card');
                    document.querySelectorAll('.kiq-meal-shopping').forEach(div => div.style.display = 'none');
                    const shoppingDiv = card?.querySelector('.kiq-meal-shopping');
                    if (shoppingDiv) {
                        shoppingDiv.style.display = 'block';
                    }
                    this.showMealIngredients(idx);
                });
            });
        }, 50);
    }

    showMealIngredients(index) {
        this.selectedMealIndex = typeof index === 'number' ? index : null;
        const sel = (this.mealPlan && this.mealPlan.meals) ? this.mealPlan.meals[index] : null;
        const container = document.getElementById('kiq-selected-ingredients');
        if (!container) return;
        if (!sel) {
            container.innerHTML = '';
            return;
        }

        const ingHtml = (sel.ingredients_used || []).map(i => `<li>${i.ingredient} - ${i.quantity}</li>`).join('');
        const filteredMissing = this.getFilteredMissingItems(sel);
        const missHtml = filteredMissing.map(m => `
            <li>
                ${m.item} (${m.importance || 'needed'})
                <button type="button" class="btn btn-link kiq-inline-add" data-action="add-missing-item" data-meal-index="${index}" data-missing-name="${m.item}">Add to pantry</button>
            </li>
        `).join('');

        container.innerHTML = `
            <div class="kiq-selected-meal">
                <h4>Ingredients for: ${sel.meal_name}</h4>
                <ul>${ingHtml || '<li>No ingredients listed</li>'}</ul>
                ${missHtml ? `<h5>Need to buy</h5><ul>${missHtml}</ul>` : '<p class="kiq-muted">Everything looks covered by your pantry or staples.</p>'}
            </div>
        `;
    }

    async rateMeal(mealName, index) {
        const stars = parseInt(prompt('Rate this meal (1-5):') || 0);
        if (stars < 1 || stars > 5) return;

        const preference = prompt('How often would you make this? (often/sometimes/rarely/never):') || 'sometimes';

        try {
            const response = await fetch(`${this.apiRoot}kitcheniq/v1/rate-meal`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': this.nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    meal_name: mealName,
                    stars: stars,
                    preference: preference,
                }),
            });

            const data = await response.json();
            if (data.success) {
                this.showNotification('Rating saved!', 'success');
            }
        } catch (error) {
            console.error('Rating error:', error);
            this.showNotification('Error saving rating', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('kiq-notifications');
        if (!container) return;

        const notif = document.createElement('div');
        notif.className = `kiq-notification kiq-${type}`;
        notif.textContent = message;
        
        container.appendChild(notif);
        
        setTimeout(() => notif.remove(), 5000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.kitcheniq = new KitchenIQDashboard();
});
