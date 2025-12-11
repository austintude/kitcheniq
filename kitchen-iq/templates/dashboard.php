<div id="kiq-app" class="kiq-app">
    <svg aria-hidden="true" class="kiq-icon-sprite">
        <symbol id="kiq-icon-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9.5 12 3l9 6.5" />
            <path d="M5 10.5V21h5.5v-5.5h3V21H19V10.5" />
        </symbol>
        <symbol id="kiq-icon-box" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
            <path d="M3 7.5v9l9 4.5 9-4.5v-9" />
            <path d="M12 12v9" />
        </symbol>
        <symbol id="kiq-icon-meal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 14a7 7 0 0 1 14 0" />
            <path d="M4 14h16" />
            <path d="M6 18h12" />
            <path d="M12 7V5" />
        </symbol>
        <symbol id="kiq-icon-history" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="7.5" />
            <path d="M12 8v4l3 2" />
        </symbol>
        <symbol id="kiq-icon-settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
            <path d="M4.8 12a7.2 7.2 0 0 1 .1-1.1l-1.7-1.3 1.5-2.6 2 .5a7.2 7.2 0 0 1 1.9-1.1l.3-2.1h3l.3 2.1a7.2 7.2 0 0 1 1.9 1.1l2-.5 1.5 2.6-1.7 1.3a7.2 7.2 0 0 1 0 2.2l1.7 1.3-1.5 2.6-2-.5a7.2 7.2 0 0 1-1.9 1.1l-.3 2.1h-3l-.3-2.1a7.2 7.2 0 0 1-1.9-1.1l-2 .5-1.5-2.6 1.7-1.3a7.2 7.2 0 0 1-.1-1.1Z" />
        </symbol>
        <symbol id="kiq-icon-camera" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 7.5h3l1.2-2h5.6l1.2 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
            <circle cx="12" cy="12" r="3.3" />
        </symbol>
        <symbol id="kiq-icon-arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
        </symbol>
        <symbol id="kiq-icon-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3.5 13.8 8 18.5 9.8 13.8 11.6 12 16.1 10.2 11.6 5.5 9.8 10.2 8Z" />
        </symbol>
    </svg>
    <header class="kiq-topbar">
        <div class="kiq-topbar-left">
            <button id="kiq-menu-toggle" class="kiq-icon-btn" aria-label="Toggle menu">
                <span class="kiq-icon-bar"></span>
                <span class="kiq-icon-bar"></span>
                <span class="kiq-icon-bar"></span>
            </button>
            <div class="kiq-logo">
                <div class="kiq-logo-mark">KIQ</div>
                <div class="kiq-logo-text">
                    <span class="kiq-logo-title">KitchenIQ</span>
                    <span class="kiq-logo-sub">Cook smarter. Waste less.</span>
                </div>
            </div>
        </div>
        <div class="kiq-topbar-actions">
            <a href="/" class="kiq-back-link">← Back to site</a>
            <button id="kiq-sync-btn" class="btn btn-ghost">Sync</button>
        </div>
    </header>

    <nav id="kiq-top-nav" class="kiq-top-nav">
        <div class="kiq-nav-tabs">
            <button data-tab="onboarding" class="active">
                <span class="kiq-tab-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-home"></use></svg></span>
                <span class="kiq-tab-label">Setup</span>
            </button>
            <button data-tab="inventory">
                <span class="kiq-tab-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-box"></use></svg></span>
                <span class="kiq-tab-label">Pantry</span>
            </button>
            <button data-tab="dashboard">
                <span class="kiq-tab-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-meal"></use></svg></span>
                <span class="kiq-tab-label">Meals</span>
            </button>
            <button data-tab="history">
                <span class="kiq-tab-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-history"></use></svg></span>
                <span class="kiq-tab-label">History</span>
            </button>
            <button data-tab="settings">
                <span class="kiq-tab-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-settings"></use></svg></span>
                <span class="kiq-tab-label">Settings</span>
            </button>
        </div>
    </nav>

    <div class="kiq-shell">
        <aside class="kiq-sidebar" aria-label="Primary navigation">
            <div class="kiq-sidebar-head">
                <div class="kiq-sidebar-brand">KitchenIQ</div>
                <div class="kiq-sidebar-note">Guided setup • Smart pantry • AI meals</div>
            </div>
            <nav class="kiq-side-nav">
                <button data-tab="onboarding" class="kiq-side-btn active">
                    <span class="kiq-side-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-home"></use></svg></span>
                    <span>Setup</span>
                </button>
                <button data-tab="inventory" class="kiq-side-btn">
                    <span class="kiq-side-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-box"></use></svg></span>
                    <span>Pantry</span>
                </button>
                <button data-tab="dashboard" class="kiq-side-btn">
                    <span class="kiq-side-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-meal"></use></svg></span>
                    <span>Meals</span>
                </button>
                <button data-tab="history" class="kiq-side-btn">
                    <span class="kiq-side-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-history"></use></svg></span>
                    <span>History</span>
                </button>
                <button data-tab="settings" class="kiq-side-btn">
                    <span class="kiq-side-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-settings"></use></svg></span>
                    <span>Settings</span>
                </button>
            </nav>
            <div class="kiq-sidebar-foot">
                <div class="kiq-pill">Better planning, less waste</div>
                <p class="kiq-muted">Use Setup first for tailored meals.</p>
            </div>
        </aside>

        <section class="kiq-main">
            <div class="kiq-section">
                <div id="kiq-notifications" class="kiq-notifications"></div>

                <!-- SETUP TAB -->
                <div data-content="onboarding" class="kiq-content" style="display: block;">
                    <div class="kiq-section-header">
                        <div>
                            <p class="kiq-eyebrow">Setup</p>
                            <h1>Welcome to KitchenIQ</h1>
                            <p class="kiq-muted">Tell us about your household so we can tailor pantry insights and meal ideas.</p>
                        </div>
                        <div class="kiq-chip-row">
                            <span class="kiq-chip">3 steps</span>
                            <span class="kiq-chip kiq-chip-soft">Autosaves as you go</span>
                        </div>
                    </div>

                    <form id="kiq-onboarding-form" class="kiq-onboarding-form">
                        <div class="onboard-step" data-step="1">
                            <div class="kiq-grid">
                                <div class="kiq-form-group">
                                    <label for="household_size">Household size</label>
                                    <select id="household_size" name="household_size" required>
                                        <option value="">Select...</option>
                                        <option value="1">1 person</option>
                                        <option value="2">2 people</option>
                                        <option value="3">3 people</option>
                                        <option value="4">4 people</option>
                                        <option value="5">5 people</option>
                                        <option value="6">6 people</option>
                                        <option value="7">7 people</option>
                                        <option value="8">8 people</option>
                                        <option value="9">9+ people</option>
                                    </select>
                                </div>

                                <div class="kiq-form-group">
                                    <label for="cooking_skill">Cooking confidence</label>
                                    <select id="cooking_skill" name="cooking_skill" required>
                                        <option value="beginner">Beginner — Simple recipes, please</option>
                                        <option value="intermediate" selected>Intermediate — Comfortable cooking</option>
                                        <option value="advanced">Advanced — Happy to be challenged</option>
                                    </select>
                                </div>
                            </div>

                            <div class="kiq-form-group kiq-card-surface">
                                <div class="kiq-card-header">
                                    <div>
                                        <p class="kiq-eyebrow">Household members</p>
                                        <h3>Who are we cooking for?</h3>
                                        <p class="kiq-muted">Set appetite (1-5), age, allergies, intolerances, and dislikes.</p>
                                    </div>
                                </div>
                                <div id="kiq-members-container" class="kiq-members"></div>
                            </div>
                        </div>

                        <div class="onboard-step hidden" data-step="2">
                            <div class="kiq-grid">
                                <div class="kiq-form-group">
                                    <label>Dietary restrictions</label>
                                    <div class="kiq-checkbox-grid">
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="dietary_restrictions" value="vegetarian" />
                                            Vegetarian
                                        </label>
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="dietary_restrictions" value="vegan" />
                                            Vegan
                                        </label>
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="dietary_restrictions" value="gluten-free" />
                                            Gluten-free
                                        </label>
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="dietary_restrictions" value="dairy-free" />
                                            Dairy-free
                                        </label>
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="dietary_restrictions" value="nut-allergy" />
                                            Nut allergy
                                        </label>
                                    </div>
                                </div>

                                <div class="kiq-form-group">
                                    <label>Cooking appliances</label>
                                    <div class="kiq-checkbox-grid">
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="appliances" value="oven" checked />
                                            Oven
                                        </label>
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="appliances" value="microwave" checked />
                                            Microwave
                                        </label>
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="appliances" value="stovetop" checked />
                                            Stovetop
                                        </label>
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="appliances" value="grill" />
                                            Grill
                                        </label>
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="appliances" value="air_fryer" />
                                            Air fryer
                                        </label>
                                        <label class="kiq-checkbox-item">
                                            <input type="checkbox" name="appliances" value="instant_pot" />
                                            Instant Pot
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="onboard-step hidden" data-step="3">
                            <div class="kiq-grid">
                                <div class="kiq-form-group">
                                    <label for="budget_level">Budget preference</label>
                                    <select id="budget_level" name="budget_level" required>
                                        <option value="budget">Budget-friendly</option>
                                        <option value="moderate" selected>Moderate</option>
                                        <option value="premium">Premium ingredients OK</option>
                                    </select>
                                </div>

                                <div class="kiq-form-group">
                                    <label for="time_per_meal">Time per meal</label>
                                    <select id="time_per_meal" name="time_per_meal" required>
                                        <option value="quick">Quick (under 20 mins)</option>
                                        <option value="moderate" selected>Moderate (20-45 mins)</option>
                                        <option value="leisurely">Leisurely (45+ mins)</option>
                                    </select>
                                </div>
                            </div>

                            <div class="kiq-form-group">
                                <label for="dislikes">Foods to avoid</label>
                                <textarea id="dislikes" name="dislikes" placeholder="e.g. mushrooms, spicy food, seafood"></textarea>
                                <small class="kiq-muted">Comma separated. We will keep these out of your suggestions.</small>
                            </div>
                        </div>

                        <div class="kiq-form-step-controls">
                            <div class="kiq-stepper">
                                <div class="kiq-stepper-bar"></div>
                            </div>
                            <div class="kiq-step-actions">
                                <button type="button" id="kiq-step-prev" class="btn btn-secondary hidden">Previous</button>
                                <button type="button" id="kiq-step-next" class="btn btn-primary">Next</button>
                                <span id="kiq-saved-indicator" class="kiq-saved-indicator">Saved</span>
                            </div>
                        </div>
                    </form>
                </div>

                <!-- INVENTORY TAB -->
                <div data-content="inventory" class="kiq-content">
                    <div class="kiq-section-header">
                        <div>
                            <p class="kiq-eyebrow">Pantry</p>
                            <h1>Your pantry, organized</h1>
                            <p class="kiq-muted">Scan your shelves or add items manually. We’ll use what you have before suggesting new buys.</p>
                        </div>
                        <div class="kiq-chip kiq-chip-soft">Better results when pantry is up to date</div>
                    </div>

                    <div class="kiq-action-bar">
                        <button id="kiq-camera-btn" class="btn btn-primary">
                            <span class="kiq-btn-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-camera"></use></svg></span>
                            Scan with camera
                        </button>
                        <button id="kiq-skip-scan-btn" class="btn btn-secondary">
                            <span class="kiq-btn-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-arrow-right"></use></svg></span>
                            Skip & go to meals
                        </button>
                        <input type="file" id="kiq-camera-input" accept="image/*" capture="environment" style="display: none;" />
                    </div>

                    <div class="kiq-card-surface kiq-inventory-form">
                        <div class="kiq-card-header">
                            <div>
                                <p class="kiq-eyebrow">Manual update</p>
                                <h3>Add pantry or fridge item</h3>
                                <p class="kiq-muted">Keep things accurate by logging items by hand. Great for quick edits after shopping.</p>
                            </div>
                        </div>
                        <form id="kiq-inventory-form" class="kiq-inline-form">
                            <div class="kiq-form-group">
                                <label for="kiq-item-name">Item name</label>
                                <input id="kiq-item-name" name="name" placeholder="e.g. eggs, chicken thighs" required />
                            </div>
                            <div class="kiq-form-group">
                                <label for="kiq-item-quantity">Quantity</label>
                                <input id="kiq-item-quantity" name="quantity" type="number" min="0" step="0.25" value="1" />
                            </div>
                            <div class="kiq-form-group">
                                <label for="kiq-item-category">Category</label>
                                <select id="kiq-item-category" name="category">
                                    <option value="pantry">Pantry</option>
                                    <option value="fridge">Fridge</option>
                                    <option value="freezer">Freezer</option>
                                    <option value="produce">Produce</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div class="kiq-form-group">
                                <label for="kiq-item-status">Status</label>
                                <select id="kiq-item-status" name="status">
                                    <option value="fresh">Fresh</option>
                                    <option value="low">Low</option>
                                    <option value="out">Out</option>
                                </select>
                            </div>
                            <div class="kiq-form-actions">
                                <button type="submit" class="btn btn-primary">Add item</button>
                            </div>
                        </form>
                    </div>

                    <div id="kiq-inventory-list" class="kiq-inventory-list">
                        <div class="kiq-empty">
                            <h3>No items yet</h3>
                            <p class="kiq-muted">Scan your pantry or jump straight to meal ideas.</p>
                        </div>
                    </div>
                </div>

                <!-- DASHBOARD/MEALS TAB -->
                <div data-content="dashboard" class="kiq-content">
                    <div class="kiq-section-header">
                        <div>
                            <p class="kiq-eyebrow">Meals</p>
                            <h1>Generate your meals</h1>
                            <p class="kiq-muted">Personalized suggestions that respect your pantry, preferences, and time.</p>
                        </div>
                        <div class="kiq-chip-row">
                            <span class="kiq-chip">Live</span>
                            <span class="kiq-chip kiq-chip-soft">Uses your latest profile</span>
                        </div>
                    </div>

                    <div class="kiq-card-surface">
                        <div class="kiq-card-header">
                            <div>
                                <p class="kiq-eyebrow">Inputs</p>
                                <h3>Tell us what you’re in the mood for</h3>
                            </div>
                            <button id="kiq-update-pantry-btn" class="btn btn-ghost">
                                <span class="kiq-btn-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-box"></use></svg></span>
                                Update pantry first
                            </button>
                        </div>
                        <div class="kiq-generator-controls">
                            <div class="kiq-form-group">
                                <label for="kiq-plan-type">Meal plan style</label>
                                <select id="kiq-plan-type">
                                    <option value="balanced">Balanced</option>
                                    <option value="quick">Quick & Easy</option>
                                    <option value="healthy">Healthy</option>
                                    <option value="budget">Budget-Friendly</option>
                                </select>
                            </div>

                            <div class="kiq-form-group">
                                <label for="kiq-mood">Any specific mood? (optional)</label>
                                <input type="text" id="kiq-mood" placeholder="e.g. comfort food, Asian-inspired" />
                            </div>

                            <div class="kiq-generator-actions">
                                <button id="kiq-generate-meals-btn" class="btn btn-primary">
                                    <span class="kiq-btn-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-spark"></use></svg></span>
                                    Generate meals
                                </button>
                                <button id="kiq-more-ideas-btn" class="btn btn-outline">
                                    <span class="kiq-btn-icon" aria-hidden="true"><svg class="kiq-icon"><use href="#kiq-icon-arrow-right"></use></svg></span>
                                    More ideas
                                </button>
                            </div>
                        </div>
                    </div>

                    <div id="kiq-meal-results" class="kiq-meal-results">
                        <div class="kiq-empty">
                            <h3>Ready when you are</h3>
                            <p class="kiq-muted">Pick your plan style and generate personalized meals.</p>
                        </div>
                    </div>
                    <div id="kiq-selected-ingredients" class="kiq-selected-ingredients"></div>
                </div>

                <!-- HISTORY TAB -->
                <div data-content="history" class="kiq-content">
                    <div class="kiq-section-header">
                        <div>
                            <p class="kiq-eyebrow">History</p>
                            <h1>Meal history</h1>
                            <p class="kiq-muted">Track what you’ve made and how you rated it.</p>
                        </div>
                        <div class="kiq-chip kiq-chip-soft">Coming soon</div>
                    </div>
                    <div class="kiq-empty">
                        <h3>History is on the way</h3>
                        <p class="kiq-muted">We’ll surface your cooked meals, favorites, and ratings here.</p>
                    </div>
                </div>

                <!-- SETTINGS TAB -->
                <div data-content="settings" class="kiq-content">
                    <div class="kiq-section-header">
                        <div>
                            <p class="kiq-eyebrow">Settings</p>
                            <h1>Your profile</h1>
                            <p class="kiq-muted">Keep your account, usage, and household details in sync.</p>
                        </div>
                    </div>

                    <div class="kiq-panel-grid">
                        <div class="kiq-card-surface">
                            <div class="kiq-card-header">
                                <div>
                                    <p class="kiq-eyebrow">Profile</p>
                                    <h3>Household snapshot</h3>
                                </div>
                            </div>
                            <p id="kiq-profile-summary" class="kiq-muted"></p>
                        </div>

                        <div class="kiq-card-surface">
                            <div class="kiq-card-header">
                                <div>
                                    <p class="kiq-eyebrow">Usage</p>
                                    <h3>Activity</h3>
                                </div>
                            </div>
                            <div id="kiq-usage-stats" class="kiq-usage"></div>
                        </div>

                        <div class="kiq-card-surface">
                            <div class="kiq-card-header">
                                <div>
                                    <p class="kiq-eyebrow">Account</p>
                                    <h3>Current user</h3>
                                </div>
                            </div>
                            <p class="kiq-muted">Logged in as <strong id="current-user"></strong></p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </div>

    <nav class="kiq-bottom-nav" aria-label="Main">
        <button class="kiq-bottom-btn" data-route="inventory">
            <svg class="kiq-icon" aria-hidden="true"><use href="#kiq-icon-box"></use></svg>
            <span>Pantry</span>
        </button>
        <button class="kiq-bottom-btn active" data-route="onboarding">
            <svg class="kiq-icon" aria-hidden="true"><use href="#kiq-icon-home"></use></svg>
            <span>Setup</span>
        </button>
        <button class="kiq-bottom-btn" data-route="dashboard">
            <svg class="kiq-icon" aria-hidden="true"><use href="#kiq-icon-meal"></use></svg>
            <span>Meals</span>
        </button>
        <button class="kiq-bottom-btn" data-route="history">
            <svg class="kiq-icon" aria-hidden="true"><use href="#kiq-icon-history"></use></svg>
            <span>History</span>
        </button>
        <button class="kiq-bottom-btn" data-route="settings">
            <svg class="kiq-icon" aria-hidden="true"><use href="#kiq-icon-settings"></use></svg>
            <span>Settings</span>
        </button>
    </nav>
</div>
