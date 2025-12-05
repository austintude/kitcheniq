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
        } catch (error) {
            console.error('Failed to load inventory:', error);
        }
    }

    attachEventListeners() {
        // Tab switching
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showTab(btn.dataset.tab);
            });
        });

        // Bottom nav (app-like) routing
        document.querySelectorAll('.kiq-bottom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const route = btn.dataset.route;
                this.showTab(route);
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

        // Meal generation
        const mealGenBtn = document.getElementById('kiq-generate-meals-btn');
        if (mealGenBtn) {
            mealGenBtn.addEventListener('click', () => this.generateMeals());
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
                const topNav = document.getElementById('kiq-top-nav');
                if (topNav) topNav.classList.toggle('hidden');
            });
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
    }

    onboardNext() {
        const total = document.querySelectorAll('.onboard-step').length;
        if (this.onboardStep >= total) {
            // final - submit form
            const form = document.getElementById('kiq-onboarding-form');
            this.handleOnboarding(new Event('submit', { cancelable: true, bubbles: true, target: form }));
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
        };

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

        // Load data if needed
        if (tabName === 'dashboard') {
            this.loadInventory();
        }
    }

    async handleOnboarding(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        
        const profile = {
            household_size: parseInt(formData.get('household_size')),
            dietary_restrictions: formData.getAll('dietary_restrictions'),
            cooking_skill: formData.get('cooking_skill'),
            budget_level: formData.get('budget_level'),
            time_per_meal: formData.get('time_per_meal'),
            dislikes: formData.get('dislikes').split(',').map(d => d.trim()),
            appliances: formData.getAll('appliances'),
        };

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
            const response = await fetch(`${this.apiRoot}kitcheniq/v1/meals`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': this.nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ plan_type: planType, mood: mood }),
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
            container.innerHTML = '<p>No items in inventory. Try scanning with your camera!</p>';
            return;
        }

        const itemsHtml = this.inventory.map(item => `
            <div class="kiq-inventory-item">
                <div class="kiq-item-name">${item.name}</div>
                <div class="kiq-item-details">
                    <span class="kiq-category">${item.category || 'general'}</span>
                    <span class="kiq-status ${item.status || 'fresh'}">${item.status || 'Fresh'}</span>
                </div>
                ${item.expiry_estimate ? `<div class="kiq-expiry">Expires: ${item.expiry_estimate}</div>` : ''}
            </div>
        `).join('');

        container.innerHTML = itemsHtml;
    }

    renderMealPlan() {
        const container = document.getElementById('kiq-meal-results');
        if (!container || !this.mealPlan) return;

        const meals = this.mealPlan.meals || [];
        const shopping = this.mealPlan.shopping_list || {};

        const mealsHtml = meals.map((meal, idx) => `
            <div class="kiq-meal-card">
                <h3>${meal.meal_name}</h3>
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
                    <p>${meal.instructions}</p>
                </div>

                <div class="kiq-meal-actions">
                    <button onclick="kitcheniq.rateMeal('${meal.meal_name}', ${idx})" class="btn btn-primary">
                        ⭐ Rate this meal
                    </button>
                </div>
            </div>
        `).join('');

        const shoppingHtml = shopping.missing_items?.length ? `
            <div class="kiq-shopping-list">
                <h3>Shopping List</h3>
                <ul>
                    ${shopping.missing_items.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        ` : '';

        container.innerHTML = mealsHtml + shoppingHtml;
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
