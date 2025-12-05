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
        
        // If profile exists, show dashboard, else show onboarding
        if (this.profile && Object.keys(this.profile).length > 0) {
            this.showTab('dashboard');
        } else {
            this.showTab('onboarding');
        }

        // Attach event listeners
        this.attachEventListeners();
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

        // Onboarding form
        const onboardingForm = document.getElementById('kiq-onboarding-form');
        if (onboardingForm) {
            onboardingForm.addEventListener('submit', (e) => this.handleOnboarding(e));
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
                if (data.success) {
                    this.inventory = data.inventory;
                    this.renderInventory();
                    this.showNotification(`Added ${data.items_added} items from image`, 'success');
                } else {
                    this.showNotification(data.error || 'Error processing image', 'error');
                }

                btn.textContent = originalText;
                btn.disabled = false;
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Image upload error:', error);
            this.showNotification('Error processing image', 'error');
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
            const response = await fetch(`${this.apiRoot}kitcheniq/v1/meals`, {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': this.nonce,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ plan_type: planType, mood: mood }),
            });

            const data = await response.json();
            if (data.success || data.meals) {
                this.mealPlan = data.meal_plan || data;
                this.renderMealPlan();
                this.showNotification('Meals generated!', 'success');
            } else {
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
