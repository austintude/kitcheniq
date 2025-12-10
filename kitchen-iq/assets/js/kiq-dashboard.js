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
        
        this.init();
    }

    async init() {
        // Load user profile
        await this.loadProfile();
        
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
            if (this.profile && this.profile.household_size) {
                const hs = document.getElementById('household_size');
                if (hs) hs.value = String(this.profile.household_size);
            }
            this.renderMemberInputs();
            // update profile summary area in settings
            this.updateProfileSummary();
        } catch (err) {
            // ignore if DOM not ready
        }

        // Attempt to register PWA artifacts (manifest + service worker)
        this.registerPWA();
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
            this.inventory = data.inventory || [];
            this.renderInventory();
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
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = btn.dataset.tab;
                const side = document.querySelector(`.kiq-side-btn[data-tab="${tab}"]`);
                if (side) {
                    side.click();
                } else {
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

        // File input for camera
        const fileInput = document.getElementById('kiq-camera-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleImageUpload(e));
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

            // Name / appetite / age row
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';

            const nameInput = document.createElement('input');
            nameInput.className = 'member-name';
            nameInput.placeholder = `Member ${idx} name`;
            nameInput.value = member.name || '';

            const appetiteLabel = document.createElement('label');
            appetiteLabel.style.fontSize = '12px';
            appetiteLabel.textContent = 'Appetite';

            const appetiteSelect = document.createElement('select');
            appetiteSelect.className = 'member-appetite';
            [1,2,3,4,5].forEach(v => {
                const opt = document.createElement('option'); opt.value = String(v); opt.textContent = String(v);
                appetiteSelect.appendChild(opt);
            });
            appetiteSelect.value = String(member.appetite || 3);

            const ageInput = document.createElement('input');
            ageInput.className = 'member-age';
            ageInput.placeholder = 'age';
            ageInput.value = member.age || '';

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn btn-outline kiq-remove-member';
            removeBtn.textContent = 'Remove';

            row.appendChild(nameInput);
            row.appendChild(appetiteLabel);
            row.appendChild(appetiteSelect);
            row.appendChild(ageInput);
            row.appendChild(removeBtn);

            // Allergies/intolerances row
            const row2 = document.createElement('div');
            row2.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;';
            const allergiesInput = document.createElement('input');
            allergiesInput.className = 'member-allergies';
            allergiesInput.placeholder = 'Allergies (comma separated)';
            allergiesInput.style.flex = '1';
            allergiesInput.value = (member.allergies||[]).join(', ');
            const intolerancesInput = document.createElement('input');
            intolerancesInput.className = 'member-intolerances';
            intolerancesInput.placeholder = 'Intolerances (comma)';
            intolerancesInput.style.flex = '1';
            intolerancesInput.value = (member.intolerances||[]).join(', ');
            row2.appendChild(allergiesInput);
            row2.appendChild(intolerancesInput);

            // Dislikes row
            const row3 = document.createElement('div');
            row3.style.cssText = 'margin-bottom:12px;';
            const dislikesInput = document.createElement('input');
            dislikesInput.className = 'member-dislikes';
            dislikesInput.placeholder = 'Dislikes (comma separated)';
            dislikesInput.style.width = '100%';
            dislikesInput.value = (member.dislikes||[]).join(', ');
            row3.appendChild(dislikesInput);

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

            el.appendChild(row);
            el.appendChild(row2);
            el.appendChild(row3);

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

    /* PWA registration (manifest injection + service worker) */
    registerPWA() {
        try {
            const pluginUrl = (window.kitcheniqData && window.kitcheniqData.pluginUrl) ? window.kitcheniqData.pluginUrl : (typeof kitcheniqData !== 'undefined' ? kitcheniqData.pluginUrl : '');
            if (!pluginUrl) return;

            // Inject manifest link if not present
            if (!document.querySelector('link[rel="manifest"]')) {
                const l = document.createElement('link');
                l.rel = 'manifest';
                l.href = pluginUrl + 'manifest.json';
                document.head.appendChild(l);
            }

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register(pluginUrl + 'service-worker.js')
                    .then(reg => console.log('KitchenIQ service worker registered', reg))
                    .catch(err => console.warn('KitchenIQ SW registration failed', err));
            }
        } catch (err) {
            console.warn('PWA registration error', err);
        }
    }

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

    async handleImageUpload(e) {
        this.showSkeleton('kiq-inventory-list', 4, 'inventory');
        const file = e.target.files[0];
        if (!file) return;

        // Show loading state
        const btn = document.getElementById('kiq-camera-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Processing image...';
        btn.disabled = true;

        try {
            // In real implementation, upload to WordPress media library first
            // Then get the URL to pass to AI
            
            // For now, use FileReader to create data URL
            const reader = new FileReader();
            reader.onload = async (event) => {
                const imageUrl = event.target.result;
                
                const response = await fetch(`${this.apiRoot}kitcheniq/v1/inventory-scan`, {
                    method: 'POST',
                    headers: {
                        'X-WP-Nonce': this.nonce,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ image_url: imageUrl }),
                });

                const data = await response.json();
                
                // Better error handling
                if ( !response.ok ) {
                    const errorMsg = data.message || data.error || `Error: ${response.status}`;
                    console.error('Inventory scan error:', response.status, data);
                    this.showNotification(errorMsg, 'error');
                    btn.textContent = originalText;
                    btn.disabled = false;
                    return;
                }
                
                if (data.success) {
                    this.inventory = data.inventory;
                    this.hideSkeleton('kiq-inventory-list');
                    this.renderInventory();
                    this.showNotification(`Added ${data.items_added} items from image`, 'success');
                } else {
                    this.hideSkeleton('kiq-inventory-list');
                    this.showNotification(data.error || 'Error processing image', 'error');
                }

                btn.textContent = originalText;
                btn.disabled = false;
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Image upload error:', error);
            this.showNotification('Error: ' + error.message, 'error');
            btn.textContent = originalText;
            btn.disabled = false;
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

        if (!this.inventory || this.inventory.length === 0) {
            container.innerHTML = `
                <div class="kiq-empty">
                    <h3>No items yet</h3>
                    <p class="kiq-muted">Scan your pantry or add items manually to keep meals accurate.</p>
                </div>`;
            return;
        }

        const itemsHtml = this.inventory.map((item, idx) => `
            <div class="kiq-inventory-item" data-index="${idx}">
                <div class="kiq-item-top">
                    <div>
                        <div class="kiq-item-name">${item.name || 'Unnamed item'}</div>
                        <div class="kiq-item-details">
                            <span class="kiq-category">${item.category || 'general'}</span>
                            <span class="kiq-status ${item.status || 'fresh'}">${(item.status || 'fresh')}</span>
                        </div>
                        ${item.expiry_estimate ? `<div class="kiq-expiry">Expires: ${item.expiry_estimate}</div>` : ''}
                    </div>
                    <div class="kiq-item-actions">
                        ${item.quantity ? `<span class="kiq-pill-muted">Qty: ${item.quantity}</span>` : ''}
                        <button type="button" class="kiq-remove-btn" data-action="remove-item" aria-label="Remove ${item.name || 'item'}">Remove</button>
                    </div>
                </div>

                <div class="kiq-item-edit">
                    <label>Quantity
                        <input type="number" min="0" step="0.25" value="${item.quantity ?? 1}" data-action="qty" />
                    </label>
                    <label>Status
                        <select data-action="status">
                            <option value="fresh" ${item.status === 'fresh' ? 'selected' : ''}>Fresh</option>
                            <option value="low" ${item.status === 'low' ? 'selected' : ''}>Low</option>
                            <option value="out" ${item.status === 'out' ? 'selected' : ''}>Out</option>
                        </select>
                    </label>
                </div>
            </div>
        `).join('');

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

    renderMealPlan() {
        const container = document.getElementById('kiq-meal-results');
        if (!container || !this.mealPlan) return;

        const meals = this.mealPlan.meals || [];
        const shopping = this.mealPlan.shopping_list || {};

        const mealsHtml = meals.map((meal, idx) => `
            <div class="kiq-meal-card">
                <div class="kiq-meal-header">
                    <h3>${meal.meal_name}</h3>
                </div>
                
                <div class="kiq-meal-meta">
                    <span class="kiq-meal-type">${meal.meal_type}</span>
                    <span class="kiq-cooking-time">${meal.cooking_time_mins || '?'} mins</span>
                    <span class="kiq-difficulty">${meal.difficulty || 'medium'}</span>
                </div>
                
                <div class="kiq-ingredients">
                    <h4>Ingredients:</h4>
                    <ul>
                        ${(meal.ingredients_used || []).map(ing => `
                            <li>${ing.ingredient} - ${ing.quantity}</li>
                        `).join('')}
                    </ul>
                </div>

                ${meal.missing_items?.length ? `
                    <div class="kiq-missing">
                        <h4>Need to buy:</h4>
                        <ul>
                            ${meal.missing_items.map(item => `
                                <li>${item.item} <small>(${item.importance})</small></li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}

                <div class="kiq-instructions">
                    <h4>Instructions:</h4>
                    <p>${meal.instructions}</p>
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
                            ${meal.missing_items?.length ? meal.missing_items.map(item => `<li>${item.item}</li>`).join('') : '<li class="kiq-no-items"><em>No specific items flagged as missing for this meal</em></li>'}
                        </ul>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = mealsHtml;

        // Wire select handlers to show shopping list and update selected ingredients area
        setTimeout(() => {
            document.querySelectorAll('.kiq-select-meal').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(btn.dataset.mealIndex, 10);
                    const card = btn.closest('.kiq-meal-card');
                    const shoppingDiv = card?.querySelector('.kiq-meal-shopping');
                    if (shoppingDiv) {
                        shoppingDiv.style.display = shoppingDiv.style.display === 'none' ? 'block' : 'none';
                    }
                    this.showMealIngredients(idx);
                });
            });
        }, 50);
    }

    showMealIngredients(index) {
        const sel = (this.mealPlan && this.mealPlan.meals) ? this.mealPlan.meals[index] : null;
        const container = document.getElementById('kiq-selected-ingredients');
        if (!container) return;
        if (!sel) {
            container.innerHTML = '';
            return;
        }

        const ingHtml = (sel.ingredients_used || []).map(i => `<li>${i.ingredient} - ${i.quantity}</li>`).join('');
        const missHtml = (sel.missing_items || []).map(m => `<li>${m.item} (${m.importance})</li>`).join('');

        container.innerHTML = `
            <div class="kiq-selected-meal">
                <h4>Ingredients for: ${sel.meal_name}</h4>
                <ul>${ingHtml || '<li>No ingredients listed</li>'}</ul>
                ${missHtml ? `<h5>Missing items</h5><ul>${missHtml}</ul>` : ''}
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
