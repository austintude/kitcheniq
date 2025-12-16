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
                this.setLiveStatus('Camera not supported');
                return;
            }
            this.setLiveStatus('Requesting camera...');
            
            // Request rear (environment) camera by default, fall back to any camera
            const constraints = {
                video: { 
                    facingMode: this.liveUsingRearCamera ? 'environment' : 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true // Enable audio for unified flow
            };
            
            try {
                this.liveStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                // Fallback if facingMode not supported
                console.warn('FacingMode not supported, requesting any camera', err);
                this.liveStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            }
            
            if (this.liveVideoEl) {
                this.liveVideoEl.srcObject = this.liveStream;
                await this.liveVideoEl.play();
            }
            
            this.liveSessionActive = true;
            this.liveRecognizing = false;
            this.setLiveStatus('Camera on. Click "Talk" to start speaking.');
            
            // Update button text
            const startBtn = document.getElementById('kiq-live-start');
            if (startBtn) {
                startBtn.textContent = 'Stop Coach';
                startBtn.classList.add('btn-danger');
            }
            
        } catch (err) {
            console.error('Live session error', err);
            this.liveSessionActive = false;
            const errorMsg = err.name === 'NotAllowedError' ? 'Camera/mic blocked' : 'Camera/mic unavailable';
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
            this.liveLatestFrame = canvas.toDataURL('image/jpeg', 0.6);
            return this.liveLatestFrame;
        } catch (err) {
            console.error('Capture frame failed', err);
            return null;
        }
    }

    appendLiveMessage(role, text) {
        this.ensureLiveElements();
        if (!this.liveThreadEl) return;
        if (this.liveThreadEl.classList.contains('kiq-muted')) {
            this.liveThreadEl.classList.remove('kiq-muted');
            this.liveThreadEl.textContent = '';
        }
        const block = document.createElement('div');
        block.className = 'kiq-live-msg';
        block.innerHTML = `<strong>${role}:</strong> ${text}`;
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
                // ignore
            }
            this.liveRecognizing = false;
            return;
        }

        // Fallback to text prompt if speech recognition is unavailable
        if (!Recognition) {
            const transcript = window.prompt('Type your request for KIQ Coach');
            if (transcript) {
                await this.sendLiveAssist(transcript);
            }
            return;
        }

        try {
            const recognizer = new Recognition();
            recognizer.continuous = false;
            recognizer.interimResults = true;
            recognizer.lang = 'en-US';

            let finalTranscript = '';
            this.liveRecognizing = true;
            this.liveRecognizer = recognizer;
            this.setLiveStatus('Listening... (click again to stop)');
            
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

            recognizer.onresult = (event) => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript;
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
                this.liveRecognizing = false;
                if (this.liveAutoFrameInterval) {
                    clearInterval(this.liveAutoFrameInterval);
                    this.liveAutoFrameInterval = null;
                }
                const blocked = event.error === 'not-allowed' || event.error === 'service-not-allowed';
                this.setLiveStatus(blocked ? 'Mic blocked - enable in browser settings' : 'Mic error');
                const talkBtn = document.getElementById('kiq-live-ptt');
                if (talkBtn) {
                    talkBtn.classList.remove('listening');
                    talkBtn.textContent = 'Talk to KitchenIQ Coach';
                }
            };

            recognizer.onend = async () => {
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
                if (!text) {
                    this.setLiveStatus('No audio captured - try again');
                    return;
                }
                this.setLiveStatus('Sending to Coach...');
                // Capture final frame and send together
                const frame = await this.captureLiveFrame();
                await this.sendLiveAssist(text, frame);
            };

            recognizer.start();
        } catch (err) {
            console.error('Speech recognition failed', err);
            this.liveRecognizing = false;
            const transcript = window.prompt('Type your request for KIQ Coach');
            if (transcript) {
                await this.sendLiveAssist(transcript);
            }
        }
    }

    async sendLiveAssist(transcript, frameDataUrl = null) {
        // Use latest captured frame if not provided
        const frame = frameDataUrl || this.liveLatestFrame || '';
        
        this.setLiveStatus('Sending to Coach...');
        this.appendLiveMessage('You', transcript || '(frame sent)');
        try {
            const res = await fetch(`${this.apiRoot}kitcheniq/v1/live-assist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': this.nonce,
                },
                body: JSON.stringify({ transcript: transcript || '', frame_jpeg: frame }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                const msg = data.message || data.error || 'Coach failed to respond';
                this.setLiveStatus(msg);
                this.appendLiveMessage('Coach', msg);
                return;
            }
            const msg = data.message || 'Received';
            this.appendLiveMessage('Coach', msg);
            
            // Optionally play TTS if enabled
            if (this.liveTtsEnabled && 'speechSynthesis' in window) {
                try {
                    const utterance = new SpeechSynthesisUtterance(msg);
                    utterance.rate = 1.0;
                    utterance.pitch = 1.0;
                    speechSynthesis.cancel(); // Clear any pending utterances
                    speechSynthesis.speak(utterance);
                } catch (err) {
                    console.warn('TTS failed', err);
                }
            }
            
            this.setLiveStatus('Ready to talk');
        } catch (err) {
            console.error('Live assist error', err);
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

        // Map filtered items to their original indices for proper editing/removal
        const itemsWithIndices = filteredItems.map(item => ({
            item,
            originalIndex: this.inventory.indexOf(item)
        }));

        const itemsHtml = itemsWithIndices.map(({ item, originalIndex }) => {
            const statusLabel = (item.status || 'fresh').toString().toLowerCase();
            return `
            <div class="kiq-inventory-item" data-index="${originalIndex}">
                <div class="kiq-item-top">
                    <div>
                        <div class="kiq-item-name">${item.name || 'Unnamed item'}</div>
                        <div class="kiq-item-details">
                            <span class="kiq-category">${item.category || 'general'}</span>
                            <span class="kiq-status ${statusLabel}">${statusLabel}</span>
                        </div>
                        ${item.expiry_estimate ? `<div class="kiq-expiry">Expires: ${item.expiry_estimate}</div>` : ''}
                    </div>
                    <div class="kiq-item-actions">
                        ${item.quantity ? `<span class="kiq-pill-muted">Qty: ${item.quantity}</span>` : ''}
                        <button type="button" class="kiq-remove-btn" data-action="remove-item" aria-label="Remove ${item.name || 'item'}" title="Remove item">−</button>
                    </div>
                </div>

                <div class="kiq-item-edit">
                    <label>Quantity
                        <input type="number" min="0" step="0.25" value="${item.quantity ?? 1}" data-action="qty" />
                    </label>
                    <label>Status
                        <select data-action="status">
                            <option value="fresh" ${statusLabel === 'fresh' ? 'selected' : ''}>Fresh</option>
                            <option value="low" ${statusLabel === 'low' ? 'selected' : ''}>Low</option>
                            <option value="out" ${statusLabel === 'out' ? 'selected' : ''}>Out</option>
                        </select>
                    </label>
                </div>
            </div>
        `}).join('');

        container.innerHTML = itemsHtml;
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
