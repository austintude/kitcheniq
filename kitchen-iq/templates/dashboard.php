<div id="kiq-app" class="kiq-app">
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
            <button id="kiq-sync-btn" class="btn btn-ghost">Sync</button>
        </div>
    </header>

    <nav id="kiq-top-nav" class="kiq-top-nav">
        <div class="kiq-nav-tabs">
            <button data-tab="onboarding" class="active">
                <span class="kiq-tab-icon" aria-hidden="true">🏠</span>
                Setup
            </button>
            <button data-tab="inventory">
                <span class="kiq-tab-icon" aria-hidden="true">📦</span>
                Pantry
            </button>
            <button data-tab="dashboard">
                <span class="kiq-tab-icon" aria-hidden="true">🍽️</span>
                Meals
            </button>
            <button data-tab="history">
                <span class="kiq-tab-icon" aria-hidden="true">🗂️</span>
                History
            </button>
            <button data-tab="settings">
                <span class="kiq-tab-icon" aria-hidden="true">⚙️</span>
                Settings
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
                    <span class="kiq-side-dot"></span>
                    <span>Setup</span>
                </button>
                <button data-tab="inventory" class="kiq-side-btn">
                    <span class="kiq-side-dot"></span>
                    <span>Pantry</span>
                </button>
                <button data-tab="dashboard" class="kiq-side-btn">
                    <span class="kiq-side-dot"></span>
                    <span>Meals</span>
                </button>
                <button data-tab="history" class="kiq-side-btn">
                    <span class="kiq-side-dot"></span>
                    <span>History</span>
                </button>
                <button data-tab="settings" class="kiq-side-btn">
                    <span class="kiq-side-dot"></span>
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
                            Scan with camera
                        </button>
                        <button id="kiq-skip-scan-btn" class="btn btn-secondary">
                            Skip & go to meals
                        </button>
                        <input type="file" id="kiq-camera-input" accept="image/*" capture="environment" style="display: none;" />
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
                                    Generate meals
                                </button>
                                <button id="kiq-more-ideas-btn" class="btn btn-outline">
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
        <button class="kiq-bottom-btn" data-route="inventory">Pantry</button>
        <button class="kiq-bottom-btn active" data-route="onboarding">Setup</button>
        <button class="kiq-bottom-btn" data-route="dashboard">Meals</button>
        <button class="kiq-bottom-btn" data-route="history">History</button>
        <button class="kiq-bottom-btn" data-route="settings">Settings</button>
    </nav>
</div>
