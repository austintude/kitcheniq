<div id="kiq-dashboard" class="kiq-dashboard">
    <!-- Notifications Container -->
    <div id="kiq-notifications" class="kiq-notifications"></div>

    <!-- Tab Navigation -->
    <div class="kiq-nav-tabs">
        <button data-tab="onboarding" class="active">👋 Setup</button>
        <button data-tab="inventory">📦 Pantry</button>
        <button data-tab="dashboard">🍽️ Meals</button>
        <button data-tab="history">📋 History</button>
        <button data-tab="settings">⚙️ Settings</button>
    </div>

    <!-- SETUP TAB -->
    <div data-content="onboarding" style="display: block;">
        <div style="max-width: 600px; margin: 0 auto;">
            <h2>Welcome to KitchenIQ! 👨‍🍳</h2>
            <p style="color: #666; line-height: 1.6;">
                Let's get to know your household. This will help us suggest meals you'll love!
            </p>

            <form id="kiq-onboarding-form" class="kiq-onboarding-form">
                <div class="kiq-form-group">
                    <label for="household_size">How many people in your household?</label>
                    <select id="household_size" name="household_size" required>
                        <option value="">Select...</option>
                        <option value="1">1 person</option>
                        <option value="2">2 people</option>
                        <option value="3">3 people</option>
                        <option value="4">4 people</option>
                        <option value="5">5+ people</option>
                    </select>
                </div>

                <div class="kiq-form-group">
                    <label>Dietary restrictions?</label>
                    <div class="kiq-checkbox-group">
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
                    <label for="cooking_skill">What's your cooking skill level?</label>
                    <select id="cooking_skill" name="cooking_skill" required>
                        <option value="beginner">Beginner - Simple recipes please!</option>
                        <option value="intermediate" selected>Intermediate - I know my way around</option>
                        <option value="advanced">Advanced - Challenge me!</option>
                    </select>
                </div>

                <div class="kiq-form-group">
                    <label for="budget_level">Budget preference?</label>
                    <select id="budget_level" name="budget_level" required>
                        <option value="budget">Budget-friendly</option>
                        <option value="moderate" selected>Moderate</option>
                        <option value="premium">Premium ingredients OK</option>
                    </select>
                </div>

                <div class="kiq-form-group">
                    <label for="time_per_meal">How much time to spend cooking?</label>
                    <select id="time_per_meal" name="time_per_meal" required>
                        <option value="quick">Quick (< 20 mins)</option>
                        <option value="moderate" selected>Moderate (20-45 mins)</option>
                        <option value="leisurely">Leisurely (45+ mins)</option>
                    </select>
                </div>

                <div class="kiq-form-group">
                    <label for="dislikes">What foods do you dislike? (comma-separated)</label>
                    <textarea id="dislikes" name="dislikes" placeholder="e.g. mushrooms, spicy food, seafood"></textarea>
                </div>

                <div class="kiq-form-group">
                    <label>What cooking appliances do you have?</label>
                    <div class="kiq-checkbox-group">
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

                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px;">
                    Let's Get Started! 🚀
                </button>
            </form>
        </div>
    </div>

    <!-- INVENTORY TAB -->
    <div data-content="inventory">
        <h2>📦 Your Pantry</h2>

        <div class="kiq-inventory-controls">
            <button id="kiq-camera-btn" class="btn btn-primary kiq-camera-btn">
                📸 Scan with Camera
            </button>
            <input type="file" id="kiq-camera-input" accept="image/*" capture="environment" style="display: none;" />
        </div>

        <div id="kiq-inventory-list" class="kiq-inventory-list">
            <p class="text-muted">Your inventory will appear here after scanning</p>
        </div>
    </div>

    <!-- DASHBOARD/MEALS TAB -->
    <div data-content="dashboard">
        <h2>🍽️ Generate Your Meals</h2>

        <div class="kiq-meals-generator">
            <div class="kiq-generator-controls">
                <div class="kiq-form-group">
                    <label for="kiq-plan-type">Type of meal plan:</label>
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

                <button id="kiq-generate-meals-btn" class="btn btn-primary">
                    ✨ Generate Meals
                </button>
            </div>
        </div>

        <div id="kiq-meal-results" class="kiq-meal-results">
            <p class="text-muted">Click "Generate Meals" to see suggestions</p>
        </div>
    </div>

    <!-- HISTORY TAB -->
    <div data-content="history">
        <h2>📋 Meal History</h2>
        <p style="color: #999;">Track all the meals you've generated and your ratings.</p>
        <!-- TODO: Implement meal history view -->
        <p class="text-muted">Coming soon...</p>
    </div>

    <!-- SETTINGS TAB -->
    <div data-content="settings">
        <h2>⚙️ Settings</h2>
        
        <div style="max-width: 600px;">
            <h3>Your Profile</h3>
            <p id="kiq-profile-summary" style="color: #666;"></p>

            <h3>Usage</h3>
            <div id="kiq-usage-stats" style="background: #f9f9f9; padding: 16px; border-radius: 4px; margin: 12px 0;">
                <!-- Usage will be loaded here -->
            </div>

            <h3>Account</h3>
            <p style="font-size: 13px; color: #999;">
                Logged in as <strong id="current-user"></strong>
            </p>
        </div>
    </div>
</div>

<script>
    // Profile summary
    document.addEventListener('DOMContentLoaded', function() {
        const profile = window.kitcheniq?.profile || {};
        const summary = document.getElementById('kiq-profile-summary');
        if (summary && profile) {
            summary.textContent = `${profile.household_size || 2} person household | ${profile.cooking_skill || 'unknown'} cook | ${profile.budget_level || 'moderate'} budget`;
        }
    });
</script>
