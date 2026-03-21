// Global Supabase credentials (loaded from sync.js)
var SUPABASE_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
var SUPABASE_KEY = typeof SUPABASE_KEY !== 'undefined' ? SUPABASE_KEY : '';

class ExpenseTrackerApp {
    constructor() {
        this.expenses = [];
        this.incomes = [];
        this.currentView = 'dashboard';
        this.currentChart = null;
        this.lineChart = null;
        this.currentUser = null;
        
        // Initialize dark mode
        this.initDarkMode();
        
        // Initialize authentication
        this.initAuth();
        
        // Check if user is already logged in
        if (this.isLoggedIn()) {
            this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
            
            // Set user ID in sync manager for Supabase user_id
            if (typeof syncManager !== 'undefined' && this.currentUser) {
                syncManager.setUserId(this.currentUser.mobile);
            }
            
            this.showApp();
            // Ensure data exists
            this.initData();
            this.initDOM();
            this.bindEvents();
            // Render initial view
            this.render();
            // Async cloud sync after local init
            this.syncFromCloud();
        } else {
            // Show auth screen
            this.showAuth();
        }
    }
    
    // Dark Mode Methods
    initDarkMode() {
        // Try header toggle first, then sidebar toggle
        let toggle = document.getElementById('darkModeToggle');
        if (!toggle) toggle = document.getElementById('darkModeToggleSidebar');
        if (!toggle) return;
        
        // Check saved preference
        const isDark = localStorage.getItem('darkMode') === 'true';
        if (isDark) {
            document.body.classList.add('dark-mode');
            const icon = toggle.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-sun';
        }
        
        toggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const dark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', dark);
            const icon = toggle.querySelector('i');
            if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            
            // Re-render all charts with new colors
            this.render();
        });
    }
    
    // Authentication Methods
    initAuth() {
        // Get DOM elements
        this.authContainer = document.getElementById('authContainer');
        this.loginForm = document.getElementById('loginForm');
        this.signupForm = document.getElementById('signupForm');
        this.loginBtn = document.getElementById('loginBtn');
        this.signupBtn = document.getElementById('signupBtn');
        this.showSignupLink = document.getElementById('showSignup');
        this.showLoginLink = document.getElementById('showLogin');
        
        // Bind authentication events
        this.bindAuthEvents();
    }
    
    bindAuthEvents() {
        // Login events
        this.loginBtn.addEventListener('click', () => this.handleLogin());
        document.getElementById('loginMobile').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        
        // Signup events
        this.signupBtn.addEventListener('click', () => this.handleSignup());
        document.getElementById('signupMobile').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSignup();
        });
        document.getElementById('signupPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSignup();
        });
        document.getElementById('signupConfirmPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSignup();
        });
        
        // Toggle form events
        this.showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showSignupForm();
        });
        this.showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });
        
        // Logout event
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }
    
    isLoggedIn() {
        const currentUser = localStorage.getItem('currentUser');
        const token = localStorage.getItem('authToken');
        return currentUser && token;
    }
    
    showLoginForm() {
        this.loginForm.classList.remove('hidden');
        this.signupForm.classList.add('hidden');
        document.getElementById('loginError').classList.add('hidden');
        document.getElementById('signupError').classList.add('hidden');
        document.getElementById('signupSuccess').classList.add('hidden');
    }
    
    showSignupForm() {
        this.signupForm.classList.remove('hidden');
        this.loginForm.classList.add('hidden');
        document.getElementById('loginError').classList.add('hidden');
        document.getElementById('signupError').classList.add('hidden');
        document.getElementById('signupSuccess').classList.add('hidden');
    }
    
    showApp() {
        this.authContainer.classList.add('hidden');
        document.querySelector('nav.sidebar').classList.remove('hidden');
        document.querySelector('main.main-content').classList.remove('hidden');
    }
    
    showAuth() {
        this.authContainer.classList.remove('hidden');
        document.querySelector('nav.sidebar').classList.add('hidden');
        document.querySelector('main.main-content').classList.add('hidden');
    }
    
    async handleLogin() {
        // Check Supabase credentials first
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            if (typeof setupSupabaseCredentials === 'function') {
                setupSupabaseCredentials();
            } else {
                alert('Please enter Supabase credentials first. Click OK to set up.');
                window.open('https://supabase.com/dashboard', '_blank');
            }
            return;
        }
        
        const mobile = document.getElementById('loginMobile').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        console.log('Login attempt for:', mobile);
        
        // Validate
        if (!mobile || !password) {
            this.showError('loginError', 'Please enter mobile number and password');
            return;
        }
        
        if (!this.validateMobile(mobile)) {
            this.showError('loginError', 'Please enter a valid 10-digit mobile number');
            return;
        }
        
        this.setLoading('login', true);
        
        try {
            // Check Supabase first
            let user = null;
            let passwordMatch = false;
            
            console.log('Checking Supabase for user...');
            const result = await syncManager.loginUser(mobile);
            console.log('Login result:', result);
            
            if (result.success && result.user) {
                user = result.user;
                passwordMatch = this.verifyPassword(password, user.password_hash);
            }
            
            // Fallback to localStorage if not found in Supabase
            if (!user) {
                console.log('User not found in Supabase, checking local...');
                user = this.findUser(mobile);
                if (user) {
                    passwordMatch = this.verifyPassword(password, user.password);
                }
            }
            
            if (!user) {
                throw new Error('User not found. Please sign up first.');
            }
            
            if (!passwordMatch) {
                throw new Error('Incorrect password');
            }
            
            console.log('Login successful for:', user.mobile);
            
            // Login successful
            const token = this.generateToken();
            localStorage.setItem('currentUser', JSON.stringify({ id: user.mobile, mobile: user.mobile }));
            localStorage.setItem('authToken', token);
            
            this.currentUser = { id: user.mobile, mobile: user.mobile };
            
            // Set user ID in sync manager for Supabase user_id
            if (typeof syncManager !== 'undefined') {
                syncManager.setUserId(user.mobile);
            }
            
            // Show the app
            this.showApp();
            
            // Initialize data
            this.initData();
            this.initDOM();
            this.bindEvents();
            this.render();
            
            // Sync from cloud
            this.syncFromCloud();
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError('loginError', error.message);
        } finally {
            this.setLoading('login', false);
        }
    }
    
    async handleSignup() {
        // Check Supabase credentials first
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            if (typeof setupSupabaseCredentials === 'function') {
                setupSupabaseCredentials();
            } else {
                alert('Please enter Supabase credentials first. Click OK to set up.');
                window.open('https://supabase.com/dashboard', '_blank');
            }
            return;
        }
        
        const mobile = document.getElementById('signupMobile').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;
        
        console.log('Signup attempt for:', mobile);
        
        // Validate
        if (!mobile || !password || !confirmPassword) {
            this.showError('signupError', 'Please fill all fields');
            return;
        }
        
        if (!this.validateMobile(mobile)) {
            this.showError('signupError', 'Please enter a valid 10-digit mobile number');
            return;
        }
        
        if (password.length < 4) {
            this.showError('signupError', 'Password must be at least 4 characters');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showError('signupError', 'Passwords do not match');
            return;
        }
        
        this.setLoading('signup', true);
        
        try {
            // Try to check if user exists in Supabase first
            console.log('Checking Supabase for existing user...');
            const loginResult = await syncManager.loginUser(mobile);
            
            if (loginResult.success && loginResult.user) {
                // User exists in Supabase
                throw new Error('Mobile number already registered in cloud. Please login.');
            }
            
            // Create user object
            const user = {
                mobile: mobile,
                password: this.hashPassword(password),
                createdAt: new Date().toISOString()
            };
            
            // Save to Supabase
            console.log('Creating user in Supabase...');
            const signupResult = await syncManager.signupUser(mobile, user.password);
            console.log('Signup result:', signupResult);
            
            if (!signupResult.success) {
                // Check if it's a duplicate key error (user already exists)
                if (signupResult.error && signupResult.error.includes('duplicate')) {
                    throw new Error('Mobile number already registered in cloud.');
                }
                console.log('Supabase signup note:', signupResult.error);
            }
            
            // Also save to localStorage as backup
            this.saveUser(user);
            
            // Show success message
            document.getElementById('signupSuccess').textContent = 'Account created successfully! Please login.';
            document.getElementById('signupSuccess').classList.remove('hidden');
            
            // Clear form
            document.getElementById('signupMobile').value = '';
            document.getElementById('signupPassword').value = '';
            document.getElementById('signupConfirmPassword').value = '';
            
            // Switch to login form after delay
            setTimeout(() => {
                this.showLoginForm();
            }, 2000);
            
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('signupError', error.message);
        } finally {
            this.setLoading('signup', false);
        }
    }
    
    validateMobile(mobile) {
        const mobileRegex = /^[6-9]\d{9}$/;
        return mobileRegex.test(mobile);
    }
    
    hashPassword(password) {
        // Simple hash function (for demo purposes only)
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
    
    verifyPassword(password, hashedPassword) {
        return this.hashPassword(password) === hashedPassword;
    }
    
    findUser(mobile) {
        const users = JSON.parse(localStorage.getItem('expense_tracker_users') || '[]');
        return users.find(user => user.mobile === mobile);
    }
    
    saveUser(user) {
        const users = JSON.parse(localStorage.getItem('expense_tracker_users') || '[]');
        users.push(user);
        localStorage.setItem('expense_tracker_users', JSON.stringify(users));
    }
    
    generateToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    }
    
    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }
    
    setLoading(type, loading = true) {
        const btnText = document.getElementById(`${type}BtnText`);
        const spinner = document.getElementById(`${type}Spinner`);
        const btn = document.getElementById(`${type}Btn`);
        
        if (loading) {
            btnText.textContent = 'Processing...';
            spinner.classList.remove('hidden');
            btn.disabled = true;
        } else {
            btnText.textContent = type === 'login' ? 'Login' : 'Sign Up';
            spinner.classList.add('hidden');
            btn.disabled = false;
        }
    }
    
    logout() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        this.currentUser = null;
        this.showAuth();
        this.expenses = [];
        this.incomes = [];
    }
    
    async syncFromCloud() {
        if (typeof syncManager === 'undefined') return;

        // First-time: push local data to cloud
        if (!localStorage.getItem('sync_initial_done')) {
            const budgets = JSON.parse(localStorage.getItem('expense-tracker-budgets') || '{}');
            await syncManager.pushAll(this.expenses, this.incomes, budgets);
            return;
        }

        // Pull from cloud & merge
        await syncManager.flushPending();
        const cloud = await syncManager.pullAll();
        if (!cloud) return;

        // Merge expenses (cloud wins on ID match)
        if (cloud.expenses && cloud.expenses.length) {
            const cloudMap = new Map(cloud.expenses.map(e => [e.id, e]));
            const localMap = new Map(this.expenses.map(e => [e.id, e]));
            // Start with cloud data
            const merged = cloud.expenses.map(e => ({
                id: e.id, date: e.expense_date, type: e.expense_type,
                major: e.major, sub: e.sub, amount: Number(e.amount), desc: e.description || ''
            }));
            // Add local-only records & push them to cloud
            this.expenses.forEach(e => {
                if (!cloudMap.has(e.id)) {
                    merged.push(e);
                    syncManager.pushExpense(e);
                }
            });
            this.expenses = merged;
            localStorage.setItem('expenses', JSON.stringify(this.expenses));
        }

        // Merge incomes
        if (cloud.incomes && cloud.incomes.length) {
            const cloudIncomes = {};
            cloud.incomes.forEach(i => {
                const mk = i.month_key;
                if (!cloudIncomes[mk]) cloudIncomes[mk] = [];
                cloudIncomes[mk].push({
                    id: i.id, type: i.income_type, amount: Number(i.amount),
                    desc: i.description || '', date: i.income_date
                });
            });
            // Merge local-only incomes
            Object.entries(this.incomes).forEach(([month, arr]) => {
                if (!Array.isArray(arr)) return;
                arr.forEach(inc => {
                    const exists = cloudIncomes[month]?.some(c => String(c.id) === String(inc.id));
                    if (!exists) {
                        if (!cloudIncomes[month]) cloudIncomes[month] = [];
                        cloudIncomes[month].push(inc);
                        syncManager.pushIncome(inc, month);
                    }
                });
            });
            this.incomes = cloudIncomes;
            localStorage.setItem('expense-tracker-incomes', JSON.stringify(this.incomes));
        }

        // Merge budgets
        if (cloud.budgets && cloud.budgets.length) {
            const budgets = {};
            cloud.budgets.forEach(b => { budgets[b.category] = Number(b.amount); });
            localStorage.setItem('expense-tracker-budgets', JSON.stringify(budgets));
        }

        this.render();
    }

    async manualSync() {
        await this.syncFromCloud();
    }

    initData() {
        // Load expenses
        const storedExpenses = localStorage.getItem("expenses");
        this.expenses = (!storedExpenses || storedExpenses === "null") ? [] : JSON.parse(storedExpenses);
        
        // Ensure all expenses have IDs and types
        let migrated = false;
        this.expenses.forEach(e => {
            if (!e.id) {
                e.id = 'exp_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                migrated = true;
            }
            if (!e.type) {
                if (e.desc && (e.desc.includes('EMI') || e.desc.includes('Prepayment') || e.desc.includes('Parents') || e.desc.includes('Netflix') || e.desc.includes('Google One') || e.desc.includes('Bill') || e.desc.includes('Maintenance') || e.desc.includes('Zerodha') || e.desc.includes('Broadband'))) {
                    e.type = 'Fixed';
                } else {
                    e.type = 'Daily';
                }
                migrated = true;
            }
        });
        
        // Merge PRELOADED_EXPENSES if January/February data is missing
        if (typeof PRELOADED_EXPENSES !== 'undefined') {
            const hasJanType = this.expenses.some(e => e.date.startsWith('2026-01') && e.type);
            if (!hasJanType || migrated) {
                // If it's missing Jan, or we just migrated, forcibly sync PRELOADED to override any bad old data
                const preloadedSignatures = new Set(PRELOADED_EXPENSES.map(e => e.date + e.desc + e.amount));
                this.expenses = this.expenses.filter(e => !preloadedSignatures.has(e.date + e.desc + e.amount));
                // Add preloaded with IDs
                const preppedPreloaded = PRELOADED_EXPENSES.map(e => ({
                    ...e,
                    id: e.id || ('exp_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now())
                }));
                this.expenses = [...this.expenses, ...preppedPreloaded];
                // Deduplicate if needed
                this.expenses = this.expenses.filter((v,i,a)=>a.findIndex(t=>(t.desc === v.desc && t.date === v.date && t.amount===v.amount))===i);
                localStorage.setItem("expenses", JSON.stringify(this.expenses));
            }
        }

        // Load incomes
        const storedIncomes = localStorage.getItem("expense-tracker-incomes");
        this.incomes = (!storedIncomes) ? {} : JSON.parse(storedIncomes);
        
        // Ensure all incomes have IDs
        Object.keys(this.incomes).forEach(m => {
            if (!Array.isArray(this.incomes[m])) this.incomes[m] = [];
            this.incomes[m].forEach(inc => {
                if (!inc.id || inc.id === 'undefined') {
                    inc.id = 'inc_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                    migrated = true;
                }
            });
        });

        // Merge PRELOADED_INCOMES if missing
        if (typeof PRELOADED_INCOMES !== 'undefined') {
            let updated = false;
            Object.keys(PRELOADED_INCOMES).forEach(month => {
                if (!this.incomes[month] || this.incomes[month].length === 0) {
                    this.incomes[month] = PRELOADED_INCOMES[month].map(inc => ({
                        ...inc,
                        id: inc.id || ('inc_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now())
                    }));
                    updated = true;
                }
            });
            if (updated) {
                localStorage.setItem("expense-tracker-incomes", JSON.stringify(this.incomes));
            }
        }
        
        if (migrated) {
            localStorage.setItem("expenses", JSON.stringify(this.expenses));
            localStorage.setItem("expense-tracker-incomes", JSON.stringify(this.incomes));
        }

        // Preload customized subcategories
        this.subcategories = typeof SUBCATEGORIES !== 'undefined' ? {...SUBCATEGORIES} : {
            "Need": ["Housing", "Parents Expenses", "Utilities", "Subscriptions & Fees", "Groceries", "Health & Medicine", "Grooming", "Transport", "Recharge", "Other"],
            "Want": ["Dining", "Habits", "Subscriptions", "Snacks", "Misc", "Shopping", "Entertainment", "Gifts"],
            "Save": ["Investment", "Emergency Fund", "Other"]
        };
        const customSubs = JSON.parse(localStorage.getItem("customSubcategories") || "{}");
        Object.keys(customSubs).forEach(major => {
            if (this.subcategories[major]) {
                this.subcategories[major] = [...new Set([...this.subcategories[major], ...customSubs[major]])];
            }
        });
    }

    initDOM() {
        // Elements
        this.els = {
            navLinks: document.querySelectorAll('.nav-links li'),
            views: document.querySelectorAll('.view'),
            themeBtn: document.getElementById('themeToggleBtn'),
            pageTitle: document.getElementById('pageTitle'),
            currentDateDisplay: document.getElementById('currentDateDisplay'),
            
            // Modals
            expenseModal: document.getElementById('expenseModal'),
            incomeModal: document.getElementById('incomeModal'),
            closeBtns: document.querySelectorAll('.close-modal'),
            
            // Forms
            expenseMajor: document.getElementById('expenseMajor'),
            expenseSub: document.getElementById('expenseSub'),
            customSubGroup: document.getElementById('customSubGroup'),
            expenseType: document.getElementById('expenseType'),
            
            // Filters
            yearSelect: document.getElementById('historyYearSelect'),
            monthSelect: document.getElementById('historyMonthSelect'),
            dashYearSelect: document.getElementById('dashYearSelect'),
            dashMonthSelect: document.getElementById('dashMonthSelect'),
            incYearSelect: document.getElementById('incomeYearSelect'),
            incMonthSelect: document.getElementById('incomeMonthSelect'),
            budYearSelect: document.getElementById('budgetYearSelect'),
            budMonthSelect: document.getElementById('budgetMonthSelect'),
            insYearSelect: document.getElementById('insightsYearSelect'),
            insMonthSelect: document.getElementById('insightsMonthSelect'),
            insSubFilter: document.getElementById('insightsSubFilter'),
            insTrendCat: document.getElementById('insightsTrendCat'),
            
            // Budget Editing
            budgetModal: document.getElementById('budgetModal'),
            editBudgetsBtn: document.getElementById('editBudgetsBtn'),
            saveBudgetsBtn: document.getElementById('saveBudgetsBtn'),
            budgetEditList: document.getElementById('budgetEditList'),
            
            // Mobile Menu
            mobileMenuBtn: document.getElementById('mobileMenuBtn'),
            sidebar: document.querySelector('.sidebar')
        };

        // Insights chart instances
        this.insCharts = {};

        // Set Date display
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.els.currentDateDisplay.textContent = today.toLocaleDateString('en-US', options);

        // Populate dynamic selects
        this.populateSubcategories();
        
        // Modal dates
        document.getElementById('expenseDate').value = today.toISOString().split('T')[0];
        document.getElementById('incomeDateInput').value = today.toISOString().split('T')[0];
    }

    // Helper method to get color for month index
    getMonthColor(i) {
        if (i < this.BASE_MONTH_COLORS.length) return this.BASE_MONTH_COLORS[i];
        const total = i + 1;
        const hue = Math.round((i / total) * 360);
        return `hsl(${hue}, 85%, 55%)`;
    }

    bindEvents() {
        // Navigation
        this.els.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
                this.els.navLinks.forEach(l => l.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                // Close mobile menu if open
                if (this.els.sidebar && this.els.sidebar.classList.contains('mobile-menu-open')) {
                    this.els.sidebar.classList.remove('mobile-menu-open');
                    const icon = this.els.mobileMenuBtn.querySelector('i');
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                }
            });
        });

        // Mobile Menu Toggle
        if (this.els.mobileMenuBtn && this.els.sidebar) {
            this.els.mobileMenuBtn.addEventListener('click', () => {
                const isOpen = this.els.sidebar.classList.toggle('mobile-menu-open');
                const icon = this.els.mobileMenuBtn.querySelector('i');
                if (isOpen) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-xmark');
                } else {
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                }
            });

            // Close sidebar when clicking on the backdrop (the ::after pseudo element area)
            document.addEventListener('click', (e) => {
                if (this.els.sidebar.classList.contains('mobile-menu-open') &&
                    !this.els.sidebar.contains(e.target) &&
                    !this.els.mobileMenuBtn.contains(e.target)) {
                    this.els.sidebar.classList.remove('mobile-menu-open');
                    const icon = this.els.mobileMenuBtn.querySelector('i');
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                }
            });
        }

        // Theme Toggle Removed


        // Amount visibility toggle
        document.querySelectorAll('.toggle-visibility').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                const targetEl = document.getElementById(targetId);
                const hiddenSpan = targetEl.querySelector('.amount-hidden');
                const actualValue = targetEl.dataset.actualValue;
                const icon = e.currentTarget.querySelector('i');
                
                if (hiddenSpan) {
                    // Currently hidden - show value
                    hiddenSpan.textContent = actualValue;
                    hiddenSpan.classList.remove('amount-hidden');
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                } else {
                    // Currently shown - hide value
                    const valueText = targetEl.firstChild.textContent.trim();
                    if (valueText && valueText !== '₹***') {
                        targetEl.dataset.actualValue = valueText;
                    }
                    targetEl.innerHTML = '<span class="amount-hidden">₹***</span>';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
            });
        });

        // Modals
        document.getElementById('openAddExpenseBtn').addEventListener('click', () => {
            this.resetExpenseModal();
            this.prefillModalDate('expenseDate');
            this.els.expenseModal.classList.add('show');
        });
        document.getElementById('openAddIncomeBtn').addEventListener('click', () => {
            this.resetIncomeModal();
            this.prefillModalDate('incomeDateInput');
            this.els.incomeModal.classList.add('show');
        });

        this.els.closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.els.expenseModal.classList.remove('show');
                this.els.incomeModal.classList.remove('show');
                if (this.els.budgetModal) this.els.budgetModal.classList.remove('show');
            });
        });

        // Close on clicking outside modal
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('show');
                }
            });
        });

        // Forms actions
        this.els.expenseMajor.addEventListener('change', () => this.populateSubcategories());
        this.els.expenseSub.addEventListener('change', (e) => {
            if (e.target.value === '___ADD_NEW___') {
                this.els.customSubGroup.classList.remove('hidden');
            } else {
                this.els.customSubGroup.classList.add('hidden');
            }
        });

        // Save actions
        document.getElementById('saveExpenseBtn').addEventListener('click', () => this.saveExpense());
        document.getElementById('saveIncomeBtn').addEventListener('click', () => this.saveIncome());
        
        // History Filters
        this.els.yearSelect.addEventListener('change', () => {
            this.populateMonthSelect(this.els.yearSelect.value);
            this.renderHistory();
        });
        this.els.monthSelect.addEventListener('change', () => this.renderHistory());
        
        // Dashboard Filters
        this.els.dashYearSelect.addEventListener('change', () => {
            this.populateDashMonthSelect(this.els.dashYearSelect.value);
            this.renderDashboard();
        });
        this.els.dashMonthSelect.addEventListener('change', () => this.renderDashboard());

        // Budget Filters
        if(this.els.budYearSelect) {
            this.els.budYearSelect.addEventListener('change', () => {
                this.populateBudgetMonthSelect(this.els.budYearSelect.value);
                this.renderBudgets();
            });
            this.els.budMonthSelect.addEventListener('change', () => this.renderBudgets());
        }

        // Income Filters
        if(this.els.incYearSelect) {
            this.els.incYearSelect.addEventListener('change', () => {
                this.populateIncomeMonthSelect(this.els.incYearSelect.value);
                this.renderIncome();
            });
            this.els.incMonthSelect.addEventListener('change', () => this.renderIncome());
        }
        // Budget Editing
        if (this.els.editBudgetsBtn) {
            this.els.editBudgetsBtn.addEventListener('click', () => this.openBudgetModal());
        }
        if (this.els.saveBudgetsBtn) {
            this.els.saveBudgetsBtn.addEventListener('click', () => this.saveBudgets());
        }

        // Backup & Restore
        const exportBtn = document.getElementById('exportDataBtn');
        const importBtn = document.getElementById('importDataBtn');
        const importFileInput = document.getElementById('importFile');

        if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
        if (importBtn) importBtn.addEventListener('click', () => importFileInput.click());
        if (importFileInput) importFileInput.addEventListener('change', (e) => this.importData(e));
    }

    /* Theme methods removed */


    switchView(view) {
        this.currentView = view;
        this.els.views.forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');
        
        const titles = {
            'dashboard': 'Overview',
            'history': 'History',
            'budget': 'Budgets',
            'income': 'Income',
            'insights': 'Insights',
            'analytics': 'Analytics'
        };
        this.els.pageTitle.textContent = titles[view];
        this.render();
    }

    render() {
        switch(this.currentView) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'history':
                this.initHistoryFilters();
                this.renderHistory();
                break;
            case 'budget':
                this.renderBudgets();
                break;
            case 'income':
                this.renderIncome();
                break;
            case 'insights':
                this.renderInsights();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
        }
    }

    /* ---------------- Dashboard ---------------- */
    initDashboardFilters() {
        if (!this.els.dashYearSelect || !this.els.dashMonthSelect) return;
        
        const expYears = this.expenses.map(e => e.date.substring(0,4));
        const incYears = Object.keys(this.incomes).map(ym => ym.substring(0,4));
        const years = [...new Set([...expYears, ...incYears])].sort().reverse();
        if (years.length === 0) years.push(new Date().getFullYear().toString());
        
        // Only populate if empty so we don't reset user choice
        if (!this.els.dashYearSelect.options.length) {
            this.els.dashYearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
            this.populateDashMonthSelect(years[0]);
        }
    }

    populateDashMonthSelect(year) {
        if (!this.els.dashMonthSelect) return;
        
        const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        let html = '';
        months.forEach((m, idx) => {
            const ym = `${year}-${m}`;
            const hasData = this.expenses.some(e => e.date.startsWith(ym)) || (this.incomes[ym] && this.incomes[ym].length > 0);
            html += `<option value="${m}" ${!hasData ? 'disabled' : ''}>${monthNames[idx]}</option>`;
        });
        this.els.dashMonthSelect.innerHTML = html;
        
        // Select logic
        const now = new Date();
        if (now.getFullYear().toString() === year) {
            const currentM = String(now.getMonth() + 1).padStart(2,'0');
            const targetOpt = [...this.els.dashMonthSelect.options].find(o => o.value === currentM);
            if(targetOpt && !targetOpt.disabled) targetOpt.selected = true;
            else {
                const availableOpt = [...this.els.dashMonthSelect.options].reverse().find(o => !o.disabled);
                if (availableOpt) availableOpt.selected = true;
            }
        } else {
            const availableOpt = [...this.els.dashMonthSelect.options].reverse().find(o => !o.disabled);
            if (availableOpt) availableOpt.selected = true;
        }
    }

    renderDashboard() {
        this.initDashboardFilters();
        
        let yearMonth;
        
        if (this.els.dashYearSelect && this.els.dashYearSelect.value && this.els.dashMonthSelect && this.els.dashMonthSelect.value) {
            yearMonth = `${this.els.dashYearSelect.value}-${this.els.dashMonthSelect.value}`;
        } else {
            // Default to current month, fallback to latest available month
            const now = new Date();
            yearMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            
            const expMonths = this.expenses.map(e => e.date.substring(0,7));
            const incMonths = Object.keys(this.incomes);
            const availableMonths = [...new Set([...expMonths, ...incMonths])].sort().reverse();
            
            const hasDataForSetYM = this.expenses.some(e => e.date.startsWith(yearMonth)) || (this.incomes[yearMonth] && this.incomes[yearMonth].length > 0);
            
            if (!hasDataForSetYM && availableMonths.length > 0) {
                yearMonth = availableMonths[0]; // fallback to latest month with data
            }
        }

        const currExpenses = this.expenses.filter(e => e.date.startsWith(yearMonth));
        let need = 0, want = 0, save = 0;
        let fixedSum = 0, dailySum = 0;
        
        currExpenses.forEach(e => {
            if (e.major === 'Need') need += e.amount;
            else if (e.major === 'Want') want += e.amount;
            else if (e.major === 'Save') save += e.amount;

            if (e.type === 'Fixed') fixedSum += e.amount;
            else dailySum += e.amount;
        });
        
        const total = need + want + save;
        
        const currentYear = yearMonth.substring(0,4);
        const yearExpenses = this.expenses.filter(e => e.date.startsWith(currentYear));

        const monthIncomes = this.incomes[yearMonth] || [];
        const incomeTotal = monthIncomes.reduce((s, c) => s + c.amount, 0);
        const balance = incomeTotal - total;
        
        const dashIncEl = document.getElementById('dashIncomeTotal');
        const dashBalEl = document.getElementById('dashBalanceTotal');
        if (dashIncEl) {
            dashIncEl.dataset.actualValue = `₹${incomeTotal.toLocaleString()}`;
            // Keep hidden by default
            if (!dashIncEl.querySelector('.amount-hidden')) {
                dashIncEl.innerHTML = '<span class="amount-hidden">₹***</span>';
            }
        }
        if (dashBalEl) {
            dashBalEl.dataset.actualValue = `₹${balance.toLocaleString()}`;
            dashBalEl.style.color = balance >= 0 ? 'var(--success-color)' : '#ef4444';
            // Keep hidden by default
            if (!dashBalEl.querySelector('.amount-hidden')) {
                dashBalEl.innerHTML = '<span class="amount-hidden">₹***</span>';
            }
        }

        const needsEl = document.getElementById('dashNeedsTotal');
        const wantsEl = document.getElementById('dashWantsTotal');
        const savesEl = document.getElementById('dashSavesTotal');
        if (needsEl) {
            needsEl.dataset.actualValue = `₹${need.toLocaleString()}`;
            if (!needsEl.querySelector('.amount-hidden')) {
                needsEl.innerHTML = '<span class="amount-hidden">₹***</span>';
            }
        }
        if (wantsEl) {
            wantsEl.dataset.actualValue = `₹${want.toLocaleString()}`;
            if (!wantsEl.querySelector('.amount-hidden')) {
                wantsEl.innerHTML = '<span class="amount-hidden">₹***</span>';
            }
        }
        if (savesEl) {
            savesEl.dataset.actualValue = `₹${save.toLocaleString()}`;
            if (!savesEl.querySelector('.amount-hidden')) {
                savesEl.innerHTML = '<span class="amount-hidden">₹***</span>';
            }
        }
        
        document.getElementById('dashNeedsPct').textContent = total ? `${Math.round(need/total*100)}% of total` : '0% of total';
        document.getElementById('dashWantsPct').textContent = total ? `${Math.round(want/total*100)}% of total` : '0% of total';
        document.getElementById('dashSavesPct').textContent = total ? `${Math.round(save/total*100)}% of total` : '0% of total';

        this.renderDashboardCharts(yearExpenses, currExpenses);
    }

    renderDashboardCharts(yearlyData, dailyDataStore) {
        const textColor = document.body.classList.contains('dark-mode') ? '#e4e4e7' : '#2c3e50';
        const gridColor = document.body.classList.contains('dark-mode') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

        // Monthly Fixed Expenses Bar Chart
        const barCtx = document.getElementById('dashboardBarChart');
        if (this.currentChart) this.currentChart.destroy();
        
        const monthlyFixed = {};
        const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
        months.forEach(m => monthlyFixed[m] = 0);

        // Color palette for charts - defined as class property for use in all methods
        this.BASE_MONTH_COLORS = [
            '#FF3B3B', '#FF7A00', '#F5C800', '#7ED321', 
            '#00C853', '#00BCD4', '#0077FF', '#3D5AFE', 
            '#7C4DFF', '#D500F9', '#FF4081', '#FF1744'
        ];

        yearlyData.forEach(e => {
            if (e.type === 'Fixed') {
                const m = e.date.substring(5,7);
                monthlyFixed[m] = (monthlyFixed[m] || 0) + e.amount;
            }
        });

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyValues = months.map(m => monthlyFixed[m]);

        // Reuse the same vibrant month colors and dynamic generator
        this.currentChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: monthNames,
                datasets: [{
                    label: 'Fixed Expenses',
                    data: monthlyValues,
                    backgroundColor: monthlyValues.map((_, i) => this.getMonthColor(i)),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { ticks: { color: textColor }, grid: { color: 'rgba(0,0,0,0.05)' } }
                }
            }
        });

        // Day-wise Expenses Bar Chart (Monthly Totals)
        const lineCtx = document.getElementById('dashboardLineChart');
        if (this.lineChart) this.lineChart.destroy();

        // Calculate total day-wise expenses per month
        const monthlyDailyTotals = {};
        months.forEach(m => monthlyDailyTotals[m] = 0);

        yearlyData.forEach(e => {
            if (e.type !== 'Fixed') {
                const m = e.date.substring(5,7);
                monthlyDailyTotals[m] = (monthlyDailyTotals[m] || 0) + e.amount;
            }
        });

        const dailyValues = months.map(m => monthlyDailyTotals[m]);

        this.lineChart = new Chart(lineCtx, {
            type: 'bar',
            data: {
                labels: monthNames,
                datasets: [{
                    label: 'Day-wise Expenses Per Month',
                    data: dailyValues,
                    backgroundColor: dailyValues.map((_, i) => this.getMonthColor(i)),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { ticks: { color: textColor }, grid: { color: 'rgba(0,0,0,0.05)' } }
                }
            }
        });
    }

    /* ---------------- History ---------------- */
    initHistoryFilters() {
        const expYears = this.expenses.map(e => e.date.substring(0,4));
        const incYears = Object.keys(this.incomes).map(ym => ym.substring(0,4));
        const years = [...new Set([...expYears, ...incYears])].sort().reverse();
        if(years.length === 0) years.push(new Date().getFullYear().toString());
        
        this.els.yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
        this.populateMonthSelect(years[0]);
    }

    populateMonthSelect(year) {
        const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        let html = '';
        months.forEach((m, idx) => {
            const ym = `${year}-${m}`;
            const hasData = this.expenses.some(e => e.date.startsWith(ym)) || (this.incomes[ym] && this.incomes[ym].length > 0);
            html += `<option value="${m}" ${!hasData ? 'disabled' : ''}>${monthNames[idx]}</option>`;
        });
        this.els.monthSelect.innerHTML = html;
        
        // Select logic
        const now = new Date();
        if (now.getFullYear().toString() === year) {
            const currentM = String(now.getMonth() + 1).padStart(2,'0');
            const targetOpt = [...this.els.monthSelect.options].find(o => o.value === currentM);
            if(targetOpt && !targetOpt.disabled) targetOpt.selected = true;
            else {
                const availableOpt = [...this.els.monthSelect.options].reverse().find(o => !o.disabled);
                if (availableOpt) availableOpt.selected = true;
            }
        } else {
            const availableOpt = [...this.els.monthSelect.options].reverse().find(o => !o.disabled);
            if (availableOpt) availableOpt.selected = true;
        }
    }

    renderHistory() {
        const container = document.getElementById('historyListContainer');
        const ym = `${this.els.yearSelect.value}-${this.els.monthSelect.value}`;
        const filtered = this.expenses.filter(e => e.date.startsWith(ym)).sort((a,b) => a.date.localeCompare(b.date));

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">No expenses found for this month.</div>';
            return;
        }

        // Group by Date
        const grouped = {};
        filtered.forEach(e => {
            if(!grouped[e.date]) grouped[e.date] = [];
            grouped[e.date].push(e);
        });

        let html = '';
        Object.keys(grouped).sort((a,b) => a.localeCompare(b)).forEach(date => {
            html += `
            <div class="date-group">
                <div class="date-divider" onclick="this.parentElement.classList.toggle('expanded')">
                    <i class="fa-regular fa-calendar-days"></i> ${date}
                    <i class="fa-solid fa-chevron-down fold-icon" style="margin-left: auto;"></i>
                </div>
                <div class="date-entries">
            `;
            grouped[date].forEach(ex => {
                let badgeClass = ex.major === 'Need' ? 'badge-need' : ex.major === 'Want' ? 'badge-want' : 'badge-save';
                let iconClass = ex.major === 'Need' ? 'fa-cart-shopping' : ex.major === 'Want' ? 'fa-gift' : 'fa-piggy-bank';
                let amtClass = ex.major.toLowerCase();
                
                html += `
                <div class="history-item">
                    <div class="item-left">
                        <div class="item-badge ${badgeClass}"><i class="fa-solid ${iconClass}"></i></div>
                        <div class="item-info">
                            <strong>${ex.sub}</strong>
                            <span>${ex.desc || ex.major}</span>
                        </div>
                    </div>
                    <div class="item-amount amount-${amtClass}">
                        ₹${ex.amount.toLocaleString()}
                    </div>
                    <div class="item-actions">
                        <button class="action-btn edit-btn" onclick="window.expenseApp.openEditExpense('${ex.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="action-btn delete-btn" onclick="window.expenseApp.deleteExpense('${ex.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                `;
            });
            html += `</div></div>`;
        });
        container.innerHTML = html;
    }

    /* ---------------- Add Logic ---------------- */
    populateSubcategories() {
        const major = this.els.expenseMajor.value;
        const subs = this.subcategories[major] || [];
        let html = '';
        subs.forEach(sub => html += `<option value="${sub}">${sub}</option>`);
        html += '<option value="___ADD_NEW___">+ Add Custom</option>';
        this.els.expenseSub.innerHTML = html;
        this.els.customSubGroup.classList.add('hidden');
    }

    saveExpense() {
        const id = document.getElementById('expenseId').value;
        const major = this.els.expenseMajor.value;
        let sub = this.els.expenseSub.value;
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const desc = document.getElementById('expenseDesc').value;
        const date = document.getElementById('expenseDate').value;
        const type = this.els.expenseType.value;
        
        if (sub === '___ADD_NEW___') {
            const customSub = document.getElementById('expenseCustomSub').value.trim();
            if (!customSub) return alert("Enter custom subcategory.");
            sub = customSub;
            
            if(!this.subcategories[major].includes(customSub)){
                this.subcategories[major].push(customSub);
                const customSubs = JSON.parse(localStorage.getItem("customSubcategories") || "{}");
                if (!customSubs[major]) customSubs[major] = [];
                customSubs[major].push(customSub);
                localStorage.setItem("customSubcategories", JSON.stringify(customSubs));
            }
        }

        if(!sub || !amount || !date) return alert("Fill all required fields.");

        if (id) {
            // Update
            const idx = this.expenses.findIndex(e => e.id == id);
            if (idx !== -1) this.expenses[idx] = { id, date, type, major, sub, amount, desc };
        } else {
            // Create
            const newId = 'exp_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            this.expenses.push({ id: newId, date, type, major, sub, amount, desc });
        }

        localStorage.setItem("expenses", JSON.stringify(this.expenses));
        // Sync to cloud
        const saved = id ? this.expenses.find(e => e.id == id) : this.expenses[this.expenses.length - 1];
        if (saved && typeof syncManager !== 'undefined') syncManager.pushExpense(saved);
        this.els.expenseModal.classList.remove('show');
        this.render();
    }

    deleteExpense(id) {
        if (!confirm('Are you sure you want to delete this expense?')) return;
        this.expenses = this.expenses.filter(e => e.id != id);
        localStorage.setItem("expenses", JSON.stringify(this.expenses));
        if (typeof syncManager !== 'undefined') syncManager.softDeleteExpense(id);
        this.render();
    }

    openEditExpense(id) {
        const exp = this.expenses.find(e => e.id == id);
        if (!exp) return;

        document.getElementById('expenseModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Expense';
        document.getElementById('saveExpenseBtn').textContent = 'Update Expense';
        document.getElementById('expenseId').value = exp.id;
        document.getElementById('expenseDate').value = exp.date;
        this.els.expenseMajor.value = exp.major;
        this.populateSubcategories();
        this.els.expenseSub.value = exp.sub;
        this.els.expenseType.value = exp.type;
        document.getElementById('expenseAmount').value = exp.amount;
        document.getElementById('expenseDesc').value = exp.desc || '';
        
        this.els.expenseModal.classList.add('show');
    }

    resetExpenseModal() {
        document.getElementById('expenseModalTitle').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add Expense';
        document.getElementById('saveExpenseBtn').textContent = 'Save Expense';
        document.getElementById('expenseId').value = '';
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseDesc').value = '';
    }

    /* ---------------- Income Logic ---------------- */
    saveIncome() {
        const id = document.getElementById('incomeId').value;
        const type = document.getElementById('incomeType').value;
        const amount = parseFloat(document.getElementById('incomeAmountInput').value);
        const desc = document.getElementById('incomeDescInput').value;
        const date = document.getElementById('incomeDateInput').value;
        
        if(!type || !amount || !date) return alert("Fill all required fields.");
        
        const month = date.substring(0,7);
        
        if (id) {
            // Update - might have changed month, so search everywhere
            Object.keys(this.incomes).forEach(m => {
                this.incomes[m] = this.incomes[m].filter(inc => {
                    return inc.id != id && String(inc.id) !== String(id);
                });
            });
            if(!this.incomes[month]) this.incomes[month] = [];
            this.incomes[month].push({ id, type, amount, desc, date });
        } else {
            // Create
            if(!this.incomes[month]) this.incomes[month] = [];
            this.incomes[month].push({ id: 'inc_' + Date.now(), type, amount, desc, date });
        }

        localStorage.setItem("expense-tracker-incomes", JSON.stringify(this.incomes));
        // Sync to cloud
        const savedInc = (this.incomes[month] || []).find(i => String(i.id) === String(id)) || this.incomes[month]?.[this.incomes[month].length - 1];
        if (savedInc && typeof syncManager !== 'undefined') syncManager.pushIncome(savedInc, month);
        this.els.incomeModal.classList.remove('show');
        this.render();
    }

    deleteIncome(id) {
        if (!confirm('Are you sure you want to delete this income?')) return;
        Object.keys(this.incomes).forEach(m => {
            this.incomes[m] = this.incomes[m].filter(inc => {
                return inc.id != id && String(inc.id) !== String(id);
            });
        });
        localStorage.setItem("expense-tracker-incomes", JSON.stringify(this.incomes));
        if (typeof syncManager !== 'undefined') syncManager.softDeleteIncome(id);
        this.render();
    }

    openEditIncome(id) {
        let income = null;
        Object.keys(this.incomes).forEach(m => {
            const found = this.incomes[m].find(inc => inc.id == id || String(inc.id) === String(id));
            if (found) income = found;
        });
        if (!income) return;

        document.getElementById('incomeModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Income';
        document.getElementById('saveIncomeBtn').textContent = 'Update Income';
        document.getElementById('incomeId').value = income.id;
        document.getElementById('incomeDateInput').value = income.date;
        document.getElementById('incomeType').value = income.type;
        document.getElementById('incomeAmountInput').value = income.amount;
        document.getElementById('incomeDescInput').value = income.desc || '';
        
        this.els.incomeModal.classList.add('show');
    }

    resetIncomeModal() {
        document.getElementById('incomeModalTitle').innerHTML = '<i class="fa-solid fa-hand-holding-dollar"></i> Add Income';
        document.getElementById('saveIncomeBtn').textContent = 'Save Income';
        document.getElementById('incomeId').value = '';
        document.getElementById('incomeAmountInput').value = '';
        document.getElementById('incomeDescInput').value = '';
    }

    initIncomeFilters() {
        if (!this.els.incYearSelect || !this.els.incMonthSelect) return;
        const expYears = this.expenses.map(e => e.date.substring(0,4));
        const incYears = Object.keys(this.incomes).map(ym => ym.substring(0,4));
        const years = [...new Set([...expYears, ...incYears])].sort().reverse();
        if(years.length === 0) years.push(new Date().getFullYear().toString());
        
        if (!this.els.incYearSelect.options.length) {
            this.els.incYearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
            this.populateIncomeMonthSelect(years[0]);
        }
    }

    populateIncomeMonthSelect(year) {
        if (!this.els.incMonthSelect) return;
        const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let html = '';
        months.forEach((m, idx) => {
            const ym = `${year}-${m}`;
            const hasData = this.expenses.some(e => e.date.startsWith(ym)) || (this.incomes[ym] && this.incomes[ym].length > 0);
            html += `<option value="${m}" ${!hasData ? 'disabled' : ''}>${monthNames[idx]}</option>`;
        });
        this.els.incMonthSelect.innerHTML = html;
        
        const now = new Date();
        if (now.getFullYear().toString() === year) {
            const currentM = String(now.getMonth() + 1).padStart(2,'0');
            const targetOpt = [...this.els.incMonthSelect.options].find(o => o.value === currentM);
            if(targetOpt && !targetOpt.disabled) targetOpt.selected = true;
            else {
                const availableOpt = [...this.els.incMonthSelect.options].reverse().find(o => !o.disabled);
                if (availableOpt) availableOpt.selected = true;
            }
        } else {
            const availableOpt = [...this.els.incMonthSelect.options].reverse().find(o => !o.disabled);
            if (availableOpt) availableOpt.selected = true;
        }
    }

    renderIncome() {
        this.initIncomeFilters();
        
        let ym;
        
        if (this.els.incYearSelect && this.els.incYearSelect.value && this.els.incMonthSelect && this.els.incMonthSelect.value) {
            ym = `${this.els.incYearSelect.value}-${this.els.incMonthSelect.value}`;
        } else {
            const now = new Date();
            ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            const availableMonthsExp = [...new Set(this.expenses.map(e => e.date.substring(0,7)))].sort().reverse();
            if (!this.expenses.some(e => e.date.startsWith(ym)) && availableMonthsExp.length > 0) {
                ym = availableMonthsExp[0];
            }
        }
        
        const monthIncomes = this.incomes[ym] || [];
        const monthTotal = monthIncomes.reduce((s, c) => s + c.amount, 0);
        
        const monthlyExpenses = this.expenses.filter(e => e.date.startsWith(ym));
        const expenseTotal = monthlyExpenses.reduce((s, e) => s + e.amount, 0);
        
        const balance = monthTotal - expenseTotal;
        
        document.getElementById('incomeTotalDisplay').textContent = `₹${monthTotal.toLocaleString()}`;
        const balanceDisplay = document.getElementById('balanceTotalDisplay');
        balanceDisplay.textContent = `₹${balance.toLocaleString()}`;
        balanceDisplay.style.color = balance >= 0 ? 'var(--success-color)' : '#ef4444';

        const container = document.getElementById('incomeListContainer');
        if (monthIncomes.length === 0) {
            container.innerHTML = '<div class="empty-state">No income records found for this month.</div>';
            return;
        }

        let html = '';
        monthIncomes.sort((a,b) => b.date.localeCompare(a.date)).forEach(inc => {
            html += `
            <div class="history-item">
                <div class="item-left">
                    <div class="item-badge badge-income"><i class="fa-solid fa-arrow-trend-up"></i></div>
                    <div class="item-info">
                        <strong>${inc.type}</strong>
                        <span>${inc.date} ${inc.desc ? ` - ${inc.desc}` : ''}</span>
                    </div>
                </div>
                <div class="item-amount amount-income">
                    +₹${inc.amount.toLocaleString()}
                </div>
                <div class="item-actions">
                    <button class="action-btn edit-btn" onclick="window.expenseApp.openEditIncome('${inc.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="action-btn delete-btn" onclick="window.expenseApp.deleteIncome('${inc.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    }

    /* ---------------- Budget Logic ---------------- */
    initBudgetFilters() {
        if (!this.els.budYearSelect || !this.els.budMonthSelect) return;
        const expYears = this.expenses.map(e => e.date.substring(0,4));
        const incYears = Object.keys(this.incomes).map(ym => ym.substring(0,4));
        const years = [...new Set([...expYears, ...incYears])].sort().reverse();
        if(years.length === 0) years.push(new Date().getFullYear().toString());
        
        if (!this.els.budYearSelect.options.length) {
            this.els.budYearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
            this.populateBudgetMonthSelect(years[0]);
        }
    }

    populateBudgetMonthSelect(year) {
        if (!this.els.budMonthSelect) return;
        const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let html = '';
        months.forEach((m, idx) => {
            const ym = `${year}-${m}`;
            const hasData = this.expenses.some(e => e.date.startsWith(ym)) || (this.incomes[ym] && this.incomes[ym].length > 0);
            html += `<option value="${m}" ${!hasData ? 'disabled' : ''}>${monthNames[idx]}</option>`;
        });
        this.els.budMonthSelect.innerHTML = html;
        
        const now = new Date();
        if (now.getFullYear().toString() === year) {
            const currentM = String(now.getMonth() + 1).padStart(2,'0');
            const targetOpt = [...this.els.budMonthSelect.options].find(o => o.value === currentM);
            if(targetOpt && !targetOpt.disabled) targetOpt.selected = true;
            else {
                const availableOpt = [...this.els.budMonthSelect.options].reverse().find(o => !o.disabled);
                if (availableOpt) availableOpt.selected = true;
            }
        } else {
            const availableOpt = [...this.els.budMonthSelect.options].reverse().find(o => !o.disabled);
            if (availableOpt) availableOpt.selected = true;
        }
    }

    getBudgets() {
        const defaultBudgets = {
            'Housing': 70000, 'Parents Expenses': 15000, 'Groceries': 5000, 'Transport': 3000, 
            'Dining': 6000, 'Health & Medicine': 3000, 'Habits': 4000, 'Subscriptions': 1000,
            'Shopping': 3000, 'Snacks': 1500
        };
        try {
            const stored = JSON.parse(localStorage.getItem('expense-tracker-budgets'));
            if (!stored || typeof stored !== 'object') return defaultBudgets;
            
            const sanitized = {};
            for (let [cat, val] of Object.entries(stored)) {
                if (typeof val === 'object' && val !== null) {
                    sanitized[cat] = Number(val.amount) || Number(val.limit) || Number(val.target) || 0;
                } else {
                    sanitized[cat] = Number(val) || 0;
                }
            }
            // Persist sanitized version
            localStorage.setItem('expense-tracker-budgets', JSON.stringify(sanitized));
            return sanitized;
        } catch(e) {
            return defaultBudgets;
        }
    }

    openBudgetModal() {
        const budgets = this.getBudgets();
        let html = '';
        Object.keys(budgets).forEach(cat => {
            html += `
            <div class="budget-edit-row">
                <div class="budget-edit-label">
                    <i class="fa-solid ${this.getBudgetIcon(cat)}"></i>
                    <span>${cat}</span>
                </div>
                <div class="budget-edit-controls">
                    <span class="budget-currency">₹</span>
                    <input type="number" data-cat="${cat}" class="budget-input" value="${budgets[cat]}">
                    <button class="budget-delete-btn" onclick="this.closest('.budget-edit-row').remove()" title="Remove budget">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>`;
        });
        
        html += `
        <div class="budget-edit-row budget-add-new">
            <div class="budget-edit-label">
                <i class="fa-solid fa-plus"></i>
                <input type="text" id="newBudgetCat" placeholder="New Category" class="budget-new-input">
            </div>
            <div class="budget-edit-controls">
                <span class="budget-currency">₹</span>
                <input type="number" id="newBudgetAmount" placeholder="0" class="budget-input">
            </div>
        </div>`;
            
        this.els.budgetEditList.innerHTML = html;
        this.els.budgetModal.classList.add('show');
    }

    saveBudgets() {
        const budgets = {};
        const inputs = document.querySelectorAll('.budget-input[data-cat]');
        
        inputs.forEach(input => {
            const cat = input.dataset.cat;
            const val = parseFloat(input.value);
            if (!isNaN(val) && val > 0) {
                budgets[cat] = val;
            }
        });

        const newCat = document.getElementById('newBudgetCat').value.trim();
        const newVal = parseFloat(document.getElementById('newBudgetAmount').value);
        if (newCat && !isNaN(newVal) && newVal > 0) {
            budgets[newCat] = newVal;
        }

        localStorage.setItem('expense-tracker-budgets', JSON.stringify(budgets));
        if (typeof syncManager !== 'undefined') syncManager.pushBudgets(budgets);
        this.els.budgetModal.classList.remove('show');
        this.renderBudgets();
    }

    getBudgetIcon(cat) {
        const iconMap = {
            'Housing': 'fa-house', 'Parents Expenses': 'fa-heart', 'Groceries': 'fa-basket-shopping',
            'Transport': 'fa-car', 'Dining': 'fa-utensils', 'Health & Medicine': 'fa-heart-pulse',
            'Habits': 'fa-smoking', 'Subscriptions': 'fa-tv', 'Subscriptions & Fees': 'fa-receipt',
            'Shopping': 'fa-bag-shopping', 'Snacks': 'fa-cookie-bite', 'Entertainment': 'fa-gamepad',
            'Utilities': 'fa-bolt', 'Investment': 'fa-chart-line', 'Grooming': 'fa-scissors',
            'Recharge': 'fa-mobile-screen', 'Gifts': 'fa-gift', 'Misc': 'fa-ellipsis'
        };
        return iconMap[cat] || 'fa-tag';
    }

    getBudgetStatusColor(pct) {
        if (pct >= 100) return { bar: 'linear-gradient(90deg, #ef4444, #f87171)', text: '#ef4444', label: 'Over Budget' };
        if (pct >= 80) return { bar: 'linear-gradient(90deg, #f59e0b, #fbbf24)', text: '#f59e0b', label: 'Near Limit' };
        if (pct >= 50) return { bar: 'linear-gradient(90deg, #3b82f6, #60a5fa)', text: '#3b82f6', label: 'On Track' };
        return { bar: 'linear-gradient(90deg, #10b981, #34d399)', text: '#10b981', label: 'Under Budget' };
    }

    renderBudgets() {
        this.initBudgetFilters();
        const budgets = this.getBudgets();
        
        let ym;
        
        if (this.els.budYearSelect && this.els.budYearSelect.value && this.els.budMonthSelect && this.els.budMonthSelect.value) {
            ym = `${this.els.budYearSelect.value}-${this.els.budMonthSelect.value}`;
        } else {
            const now = new Date();
            ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            const availableMonthsExp = [...new Set(this.expenses.map(e => e.date.substring(0,7)))].sort().reverse();
            if (!this.expenses.some(e => e.date.startsWith(ym)) && availableMonthsExp.length > 0) {
                ym = availableMonthsExp[0];
            }
        }

        const currExpenses = this.expenses.filter(e => e.date.startsWith(ym));
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthLabel = monthNames[parseInt(ym.split('-')[1]) - 1] + ' ' + ym.split('-')[0];

        // Calculate summary totals
        let totalBudgeted = 0, totalSpent = 0;
        const budgetData = [];
        
        Object.entries(budgets).forEach(([cat, limit]) => {
            let spent = currExpenses.filter(e => e.sub === cat || e.major === cat).reduce((s,c) => s+c.amount, 0);
            totalBudgeted += limit;
            totalSpent += spent;
            budgetData.push({ cat, limit, spent });
        });

        const totalRemaining = totalBudgeted - totalSpent;
        const overallPct = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

        // Render summary section
        const summaryContainer = document.getElementById('budgetSummaryCards');
        if (summaryContainer) {
            summaryContainer.innerHTML = `
                <div class="glass-card stat-card">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #6366f1, #818cf8);">
                        <i class="fa-solid fa-bullseye"></i>
                    </div>
                    <div class="stat-details">
                        <p>Total Budgeted</p>
                        <h3>₹${totalBudgeted.toLocaleString()}</h3>
                        <small>${monthLabel}</small>
                    </div>
                </div>
                <div class="glass-card stat-card">
                    <div class="stat-icon" style="background: linear-gradient(135deg, ${overallPct >= 100 ? '#ef4444, #f87171' : overallPct >= 80 ? '#f59e0b, #fbbf24' : '#f97316, #fb923c'});">
                        <i class="fa-solid fa-fire"></i>
                    </div>
                    <div class="stat-details">
                        <p>Total Spent</p>
                        <h3>₹${totalSpent.toLocaleString()}</h3>
                        <small>${Math.round(overallPct)}% of budget used</small>
                    </div>
                </div>
                <div class="glass-card stat-card">
                    <div class="stat-icon" style="background: linear-gradient(135deg, ${totalRemaining >= 0 ? '#10b981, #34d399' : '#ef4444, #f87171'});">
                        <i class="fa-solid ${totalRemaining >= 0 ? 'fa-wallet' : 'fa-triangle-exclamation'}"></i>
                    </div>
                    <div class="stat-details">
                        <p>${totalRemaining >= 0 ? 'Remaining' : 'Over Budget'}</p>
                        <h3 style="color: ${totalRemaining >= 0 ? 'var(--success-color)' : '#ef4444'};">₹${Math.abs(totalRemaining).toLocaleString()}</h3>
                        <small>${totalRemaining >= 0 ? 'Available to spend' : 'Exceeded budget!'}</small>
                    </div>
                </div>
            `;
        }

        // Render budget items
        const container = document.getElementById('budgetsListContainer');
        let html = '';

        if (budgetData.length === 0) {
            html = '<div class="empty-state" style="grid-column: 1 / -1;">No budgets set. Click Edit to create one.</div>';
        }

        // Sort: over-budget first, then by percentage descending
        budgetData.sort((a, b) => {
            const pctA = a.limit > 0 ? (a.spent / a.limit) * 100 : 0;
            const pctB = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
            return pctB - pctA;
        });

        budgetData.forEach(({cat, limit, spent}) => {
            let pct = limit > 0 ? (spent/limit)*100 : 0;
            const status = this.getBudgetStatusColor(pct);
            const remaining = limit - spent;
            const icon = this.getBudgetIcon(cat);

            html += `
            <div class="budget-card ${pct >= 100 ? 'budget-over' : pct >= 80 ? 'budget-warn' : 'budget-ok'}">
                <div class="budget-card-header">
                    <div class="budget-card-title">
                        <div class="budget-icon" style="color: ${status.text};">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div>
                            <strong>${cat}</strong>
                            <span class="budget-status-label" style="color: ${status.text};">${status.label}</span>
                        </div>
                    </div>
                    <div class="budget-card-amounts">
                        <span class="budget-spent">₹${spent.toLocaleString()}</span>
                        <span class="budget-limit">/ ₹${limit.toLocaleString()}</span>
                    </div>
                </div>
                <div class="budget-progress-track">
                    <div class="budget-progress-fill" style="width: ${Math.min(pct, 100)}%; background: ${status.bar};"></div>
                </div>
                <div class="budget-card-footer">
                    <span class="budget-pct" style="color: ${status.text};">${Math.round(pct)}% used</span>
                    <span class="budget-remaining" style="color: ${remaining >= 0 ? 'var(--success-color)' : '#ef4444'};">
                        ${remaining >= 0 ? '₹' + remaining.toLocaleString() + ' left' : '₹' + Math.abs(remaining).toLocaleString() + ' over'}
                    </span>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
    }

    /* ---------------- Insights Logic ---------------- */
    initInsightsFilters() {
        if (!this.els.insYearSelect || !this.els.insMonthSelect) return;
        const expYears = this.expenses.map(e => e.date.substring(0,4));
        const incYears = Object.keys(this.incomes).map(ym => ym.substring(0,4));
        const years = [...new Set([...expYears, ...incYears])].sort().reverse();
        if(years.length === 0) years.push(new Date().getFullYear().toString());
        if (!this.els.insYearSelect.options.length) {
            this.els.insYearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
            this.populateInsightsMonthSelect(years[0]);
            // Bind events once
            this.els.insYearSelect.addEventListener('change', () => {
                this.populateInsightsMonthSelect(this.els.insYearSelect.value);
                this.renderInsights();
            });
            this.els.insMonthSelect.addEventListener('change', () => this.renderInsights());
            if(this.els.insSubFilter) this.els.insSubFilter.addEventListener('change', () => this.renderInsights());
            if(this.els.insTrendCat) this.els.insTrendCat.addEventListener('change', () => this.renderInsightsTrend());
        }
    }

    populateInsightsMonthSelect(year) {
        if (!this.els.insMonthSelect) return;
        const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];
        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        let html = '';
        months.forEach((m, idx) => {
            const ym = `${year}-${m}`;
            const hasData = this.expenses.some(e => e.date.startsWith(ym)) || (this.incomes[ym] && this.incomes[ym].length > 0);
            html += `<option value="${m}" ${!hasData ? 'disabled' : ''}>${monthNames[idx]}</option>`;
        });
        this.els.insMonthSelect.innerHTML = html;
        const now = new Date();
        if (now.getFullYear().toString() === year) {
            const cm = String(now.getMonth()+1).padStart(2,'0');
            const t = [...this.els.insMonthSelect.options].find(o => o.value === cm);
            if(t && !t.disabled) t.selected = true;
            else { const a = [...this.els.insMonthSelect.options].reverse().find(o => !o.disabled); if(a) a.selected = true; }
        } else {
            const a = [...this.els.insMonthSelect.options].reverse().find(o => !o.disabled); if(a) a.selected = true;
        }
    }

    getInsightsYM() {
        if (this.els.insYearSelect?.value && this.els.insMonthSelect?.value)
            return `${this.els.insYearSelect.value}-${this.els.insMonthSelect.value}`;
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }

    destroyChart(key) { if(this.insCharts[key]) { this.insCharts[key].destroy(); this.insCharts[key] = null; } }

    renderInsights() {
        this.initInsightsFilters();
        const ym = this.getInsightsYM();
        const textColor = document.body.classList.contains('dark-mode') ? '#e4e4e7' : '#2c3e50';
        const gridColor = document.body.classList.contains('dark-mode') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
        const curr = this.expenses.filter(e => e.date.startsWith(ym));

        // 1. Pie Chart - Major Categories
        let need=0, want=0, save=0;
        curr.forEach(e => { if(e.major==='Need') need+=e.amount; else if(e.major==='Want') want+=e.amount; else save+=e.amount; });
        const total = need+want+save;

        this.destroyChart('pie');
        this.insCharts.pie = new Chart(document.getElementById('insightsPieChart'), {
            type: 'doughnut',
            data: {
                labels: ['Need','Want','Save'],
                datasets: [{ data: [need,want,save], backgroundColor: ['#f59e0b','#ec4899','#3b82f6'], borderWidth: 0, hoverOffset: 8 }]
            },
            options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ color:textColor, padding:15 } } } }
        });

        // Major cat summary cards
        document.getElementById('majorCatCards').innerHTML = [
            {label:'Needs', amt:need, pct:total?Math.round(need/total*100):0, color:'#f59e0b', icon:'fa-cart-shopping'},
            {label:'Wants', amt:want, pct:total?Math.round(want/total*100):0, color:'#ec4899', icon:'fa-gift'},
            {label:'Savings', amt:save, pct:total?Math.round(save/total*100):0, color:'#3b82f6', icon:'fa-piggy-bank'}
        ].map(c => `
            <div class="insight-stat-row">
                <div class="insight-stat-icon" style="background:${c.color}"><i class="fa-solid ${c.icon}"></i></div>
                <div class="insight-stat-info"><strong>${c.label}</strong><span>₹${c.amt.toLocaleString()}</span></div>
                <div class="insight-stat-pct" style="color:${c.color}">${c.pct}%</div>
            </div>
        `).join('');

        // 2. Subcategory Bar Chart
        const subFilter = this.els.insSubFilter?.value || 'All';
        const subTotals = {};
        curr.filter(e => subFilter==='All' || e.major===subFilter).forEach(e => { subTotals[e.sub] = (subTotals[e.sub]||0) + e.amount; });
        const sortedSubs = Object.entries(subTotals).sort((a,b) => b[1]-a[1]).slice(0,10);

        this.destroyChart('bar');
        this.insCharts.bar = new Chart(document.getElementById('insightsBarChart'), {
            type: 'bar',
            data: {
                labels: sortedSubs.map(s=>s[0]),
                datasets: [{ data: sortedSubs.map(s=>s[1]), backgroundColor: '#818cf8', borderRadius: 6 }]
            },
            options: {
                indexAxis: 'y', responsive:true, maintainAspectRatio:false,
                plugins:{ legend:{display:false} },
                scales:{ x:{ticks:{color:textColor},grid:{color:gridColor}}, y:{ticks:{color:textColor},grid:{display:false}} }
            }
        });

        // 3. Fixed vs Daily
        let fixedSum=0, dailySum=0;
        curr.forEach(e => { if(e.type==='Fixed') fixedSum+=e.amount; else dailySum+=e.amount; });
        
        // Calculate days in current month and average daily spend
        const [yr, mo] = ym.split('-');
        const daysInMonth = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        const today = new Date().getDate();
        const currentDay = (parseInt(yr) === new Date().getFullYear() && parseInt(mo) === new Date().getMonth() + 1) ? today : daysInMonth;
        const avgDaily = currentDay > 0 ? Math.round(total / currentDay) : 0;
        
        document.getElementById('fixedVsDailyCards').innerHTML = `
            <div class="glass-card stat-card">
                <div class="stat-icon" style="background:linear-gradient(135deg,#8b5cf6,#a78bfa)"><i class="fa-solid fa-thumbtack"></i></div>
                <div class="stat-details"><p>Fixed Expenses</p><h3>₹${fixedSum.toLocaleString()}</h3><small>${total?Math.round(fixedSum/total*100):0}% of total</small></div>
            </div>
            <div class="glass-card stat-card">
                <div class="stat-icon" style="background:linear-gradient(135deg,#06b6d4,#22d3ee)"><i class="fa-solid fa-calendar-day"></i></div>
                <div class="stat-details"><p>Daily Expenses</p><h3>₹${dailySum.toLocaleString()}</h3><small>${total?Math.round(dailySum/total*100):0}% of total</small></div>
            </div>
            <div class="glass-card stat-card">
                <div class="stat-icon" style="background:linear-gradient(135deg,#f97316,#fb923c)"><i class="fa-solid fa-coins"></i></div>
                <div class="stat-details"><p>Total Spend</p><h3>₹${total.toLocaleString()}</h3><small>${curr.length} transactions</small></div>
            </div>
            <div class="glass-card stat-card">
                <div class="stat-icon" style="background:linear-gradient(135deg,#ec4899,#f472b6)"><i class="fa-solid fa-chart-line"></i></div>
                <div class="stat-details"><p>Avg Daily Spend</p><h3>₹${avgDaily.toLocaleString()}</h3><small>${currentDay} days</small></div>
            </div>
        `;

        // 4. Month-over-Month
        const prevMo = parseInt(mo)===1 ? '12' : String(parseInt(mo)-1).padStart(2,'0');
        const prevYr = parseInt(mo)===1 ? String(parseInt(yr)-1) : yr;
        const prevYM = `${prevYr}-${prevMo}`;
        const prev = this.expenses.filter(e => e.date.startsWith(prevYM));

        const allCats = [...new Set([...curr,...prev].map(e=>e.sub))];
        const currByCat = {}, prevByCat = {};
        allCats.forEach(c => { currByCat[c]=0; prevByCat[c]=0; });
        curr.forEach(e => currByCat[e.sub]+=e.amount);
        prev.forEach(e => prevByCat[e.sub]+=e.amount);
        const topCats = allCats.sort((a,b)=>(currByCat[b]+prevByCat[b])-(currByCat[a]+prevByCat[a])).slice(0,8);

        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        this.destroyChart('mom');
        this.insCharts.mom = new Chart(document.getElementById('insightsMoMChart'), {
            type: 'bar',
            data: {
                labels: topCats,
                datasets: [
                    { label: monthNames[parseInt(prevMo)-1], data: topCats.map(c=>prevByCat[c]), backgroundColor:'#64748b', borderRadius:4 },
                    { label: monthNames[parseInt(mo)-1], data: topCats.map(c=>currByCat[c]), backgroundColor:'#818cf8', borderRadius:4 }
                ]
            },
            options: {
                responsive:true, maintainAspectRatio:false,
                plugins:{ legend:{ labels:{color:textColor} } },
                scales:{ x:{ticks:{color:textColor},grid:{display:false}}, y:{ticks:{color:textColor},grid:{color:gridColor}} }
            }
        });

        // 5. Top 10 Spenders
        const top10 = [...curr].sort((a,b)=>b.amount-a.amount).slice(0,10);
        document.getElementById('topSpendersTable').innerHTML = `
            <thead><tr><th>#</th><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>${top10.map((e,i) => `<tr>
                <td>${i+1}</td><td>${e.date}</td><td><span class="badge-sm badge-${e.major.toLowerCase()}">${e.sub}</span></td>
                <td>${e.desc||'-'}</td><td class="amt-col">₹${e.amount.toLocaleString()}</td>
            </tr>`).join('')}</tbody>
        `;

        // 6. Trend chart - populate selector & render
        const uniqueSubs = [...new Set(this.expenses.map(e=>e.sub))].sort();
        const currentVal = this.els.insTrendCat?.value;
        this.els.insTrendCat.innerHTML = uniqueSubs.map(s => `<option value="${s}" ${s===currentVal?'selected':''}>${s}</option>`).join('');
        this.renderInsightsTrend();
    }

    renderInsightsTrend() {
        const cat = this.els.insTrendCat?.value;
        if(!cat) return;
        const textColor = document.body.classList.contains('dark-mode') ? '#e4e4e7' : '#2c3e50';
        const gridColor = document.body.classList.contains('dark-mode') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

        const allMonths = [...new Set(this.expenses.map(e=>e.date.substring(0,7)))].sort();
        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const labels = allMonths.map(m => monthNames[parseInt(m.split('-')[1])-1] + ' ' + m.split('-')[0].slice(2));
        const data = allMonths.map(m => this.expenses.filter(e=>e.date.startsWith(m) && e.sub===cat).reduce((s,e)=>s+e.amount,0));

        this.destroyChart('trend');
        this.insCharts.trend = new Chart(document.getElementById('insightsTrendChart'), {
            type: 'line',
            data: {
                labels,
                datasets: [{ label: cat, data, borderColor:'#818cf8', backgroundColor:'rgba(129,140,248,0.1)', fill:true, tension:0.4, pointRadius:5, pointBackgroundColor:'#818cf8' }]
            },
            options: {
                responsive:true, maintainAspectRatio:false,
                plugins:{ legend:{display:false} },
                scales:{ x:{ticks:{color:textColor},grid:{display:false}}, y:{beginAtZero:true, ticks:{color:textColor},grid:{color:gridColor}} }
            }
        });
    }

    /* ---------------- Analytics ---------------- */
    initAnalyticsFilters() {
        const yearSelect = document.getElementById('analyticsYearSelect');
        if (!yearSelect) return;
        
        const expYears = this.expenses.map(e => e.date.substring(0,4));
        const incYears = Object.keys(this.incomes).map(ym => ym.substring(0,4));
        let years = [...new Set([...expYears, ...incYears])].sort().reverse();
        
        // Ensure at least one year exists
        if (years.length === 0) {
            years = [new Date().getFullYear().toString()];
        }
        
        if (!yearSelect.options.length) {
            yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
        }
        
        // Remove old listener if exists
        if (this._analyticsYearChange) {
            yearSelect.removeEventListener('change', this._analyticsYearChange);
        }
        this._analyticsYearChange = () => this.renderAnalytics();
        yearSelect.addEventListener('change', this._analyticsYearChange);
    }

    renderAnalytics() {
        this.initAnalyticsFilters();
        const yearSelect = document.getElementById('analyticsYearSelect');
        const year = yearSelect?.value;
        if (!year) {
            console.log('Analytics: No year selected');
            return;
        }
        
        const textColor = document.body.classList.contains('dark-mode') ? '#e4e4e7' : '#2c3e50';
        const gridColor = document.body.classList.contains('dark-mode') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        
        // Get all years for comparison
        const allYears = [...new Set(this.expenses.map(e => e.date.substring(0,4)))].sort();
        
        // 1. Year Summary Cards
        const yearExp = this.expenses.filter(e => e.date.startsWith(year));
        const yearInc = Object.entries(this.incomes).filter(([ym]) => ym.startsWith(year));
        const totalExp = yearExp.reduce((s, e) => s + e.amount, 0);
        const totalInc = yearInc.reduce((s, [, arr]) => s + arr.reduce((a, b) => a + b.amount, 0), 0);
        const balance = totalInc - totalExp;
        
        // Calculate savings rate and average daily spend
        const savingsRate = totalInc > 0 ? ((balance / totalInc) * 100).toFixed(1) : 0;
        // Calculate actual calendar days passed in the year
        const now = new Date();
        const currentYear = now.getFullYear();
        const selectedYear = parseInt(year);
        let daysPassed = 0;
        if (selectedYear < currentYear) {
            // Full year - calculate days from Jan 1 to Dec 31
            daysPassed = (new Date(selectedYear, 11, 31) - new Date(selectedYear, 0, 0)) / (1000 * 60 * 60 * 24);
        } else if (selectedYear === currentYear) {
            // Current year - days from Jan 1 to today
            daysPassed = (now - new Date(currentYear, 0, 0)) / (1000 * 60 * 60 * 24);
        } else {
            daysPassed = 0;
        }
        const avgDailyYear = daysPassed > 0 ? Math.round(totalExp / daysPassed) : 0;
        
        document.getElementById('yearSummaryCards').innerHTML = `
            <div class="glass-card stat-card">
                <div class="stat-icon" style="background:linear-gradient(135deg,#3b82f6,#60a5fa)"><i class="fa-solid fa-arrow-up"></i></div>
                <div class="stat-details"><p>Income</p><h3>₹${totalInc.toLocaleString()}</h3></div>
            </div>
            <div class="glass-card stat-card">
                <div class="stat-icon" style="background:linear-gradient(135deg,#ef4444,#f87171)"><i class="fa-solid fa-arrow-down"></i></div>
                <div class="stat-details"><p>Expenses</p><h3>₹${totalExp.toLocaleString()}</h3></div>
            </div>
            <div class="glass-card stat-card">
                <div class="stat-icon" style="background:linear-gradient(135deg,${balance >= 0 ? '#10b981,#34d399' : '#ef4444,#f87171'})"><i class="fa-solid fa-wallet"></i></div>
                <div class="stat-details"><p>Balance</p><h3 style="color:${balance >= 0 ? 'var(--success-color)' : '#ef4444'}">₹${balance.toLocaleString()}</h3></div>
            </div>
            <div class="glass-card stat-card">
                <div class="stat-icon" style="background:linear-gradient(135deg,${savingsRate >= 0 ? '#8b5cf6,#a78bfa' : '#ef4444,#f87171'})"><i class="fa-solid fa-piggy-bank"></i></div>
                <div class="stat-details"><p>Savings Rate</p><h3 style="color:${savingsRate >= 0 ? 'var(--success-color)' : '#ef4444'}">${savingsRate}%</h3></div>
            </div>
            <div class="glass-card stat-card">
                <div class="stat-icon" style="background:linear-gradient(135deg,#ec4899,#f472b6)"><i class="fa-solid fa-chart-line"></i></div>
                <div class="stat-details"><p>Avg Daily</p><h3>₹${avgDailyYear.toLocaleString()}</h3><small>per day estimate</small></div>
            </div>
        `;
        
        // 2. Year-over-Year Comparison Chart - commented out
        /*
        const yoyChartContainer = document.getElementById('analyticsYoYChart').parentElement;
        if (allYears.length < 2) {
            yoyChartContainer.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-secondary)"><i class="fa-solid fa-chart-column" style="font-size:3rem;margin-bottom:1rem;opacity:0.5"></i><p>Add data from more years to see year-over-year comparison</p></div>';
        } else {
            const yoyData = allYears.map(y => {
                return this.expenses.filter(e => e.date.startsWith(y)).reduce((s, e) => s + e.amount, 0);
            });
            
            this.destroyChart('analyticsYoY');
            this.insCharts.analyticsYoY = new Chart(document.getElementById('analyticsYoYChart'), {
                type: 'bar',
                data: {
                    labels: allYears,
                    datasets: [{
                        label: 'Total Expenses',
                        data: yoyData,
                        backgroundColor: allYears.map((_, i) => this.getMonthColor(i)),
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { 
                            ticks: { color: textColor }, 
                            grid: { display: false },
                            categoryPercentage: 0.6,
                            barPercentage: 0.7
                        },
                        y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
                    }
                }
            });
        }
        */
        
        // 3. Monthly Spending Trend for Selected Year
        const monthlyData = [];
        for (let m = 1; m <= 12; m++) {
            const monthStr = String(m).padStart(2, '0');
            const moExp = yearExp.filter(e => e.date.substring(5,7) === monthStr);
            monthlyData.push(moExp.reduce((s, e) => s + e.amount, 0));
        }
        
        this.destroyChart('analyticsMonthly');
        this.insCharts.analyticsMonthly = new Chart(document.getElementById('analyticsMonthlyChart'), {
            type: 'line',
            data: {
                labels: monthNames,
                datasets: [{
                    label: 'Monthly Expenses',
                    data: monthlyData,
                    borderColor: '#818cf8',
                    backgroundColor: 'rgba(129,140,248,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#818cf8'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { display: false } },
                    y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
                }
            }
        });
        
        // 3b. Income vs Expenses Chart
        const monthlyIncomeData = [];
        for (let m = 1; m <= 12; m++) {
            const monthStr = String(m).padStart(2, '0');
            const monthKey = `${year}-${monthStr}`;
            const moInc = this.incomes[monthKey];
            monthlyIncomeData.push(moInc ? moInc.reduce((s, e) => s + e.amount, 0) : 0);
        }
        
        this.destroyChart('analyticsIncomeExpense');
        this.insCharts.analyticsIncomeExpense = new Chart(document.getElementById('analyticsIncomeExpenseChart'), {
            type: 'bar',
            data: {
                labels: monthNames,
                datasets: [
                    {
                        label: 'Income',
                        data: monthlyIncomeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 4
                    },
                    {
                        label: 'Expenses',
                        data: monthlyData,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: true, position: 'top', labels: { color: textColor, padding: 15 } }
                },
                scales: {
                    x: { 
                        ticks: { color: textColor }, 
                        grid: { display: false },
                        categoryPercentage: 0.6,
                        barPercentage: 0.7
                    },
                    y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
                }
            }
        });
        
        // 4. Category Breakdown for Selected Year
        const catTotals = {};
        yearExp.forEach(e => {
            catTotals[e.sub] = (catTotals[e.sub] || 0) + e.amount;
        });
        const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 10);
        
        this.destroyChart('analyticsCategory');
        this.insCharts.analyticsCategory = new Chart(document.getElementById('analyticsCategoryChart'), {
            type: 'bar',
            data: {
                labels: sortedCats.map(c => c[0]),
                datasets: [{
                    label: 'Amount',
                    data: sortedCats.map(c => c[1]),
                    backgroundColor: sortedCats.map((_, i) => this.getMonthColor(i)),
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor }, grid: { display: false } }
                }
            }
        });
    }

    prefillModalDate(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        let y, m;
        // Try to get from active view filters
        if (this.currentView === 'dashboard' && this.els.dashYearSelect?.value) {
            y = this.els.dashYearSelect.value;
            m = this.els.dashMonthSelect.value;
        } else if (this.currentView === 'budget' && this.els.budYearSelect?.value) {
            y = this.els.budYearSelect.value;
            m = this.els.budMonthSelect.value;
        } else if (this.currentView === 'insights' && this.els.insYearSelect?.value) {
            y = this.els.insYearSelect.value;
            m = this.els.insMonthSelect.value;
        }

        const now = new Date();
        const currentY = now.getFullYear().toString();
        const currentM = String(now.getMonth() + 1).padStart(2, '0');

        if (y && m) {
            // If the filtered month is the current real month, use today's date
            if (y === currentY && m === currentM) {
                input.value = now.toISOString().split('T')[0];
            } else {
                // Otherwise, default to the 1st of that filtered month
                input.value = `${y}-${m}-01`;
            }
        } else {
            input.value = now.toISOString().split('T')[0];
        }
    }

    /* ---------------- Backup & Restore Logic ---------------- */
    exportData() {
        try {
            const data = {
                expenses: this.expenses,
                incomes: this.incomes,
                budgets: JSON.parse(localStorage.getItem('expense-tracker-budgets') || '{}'),
                theme: localStorage.getItem('theme') || 'light',
                exportDate: new Date().toISOString(),
                app: 'FinancePro'
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `finance_pro_backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Export failed: ' + err.message);
        }
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Compatibility check
                if (!data.expenses || !data.incomes) {
                    throw new Error('Not a valid FinancePro backup file.');
                }

                if (confirm('Importing this backup will REPLACEx your current data. Do you want to continue?')) {
                    // Update main data objects
                    this.expenses = data.expenses;
                    this.incomes = data.incomes;
                    
                    // Save to localStorage
                    localStorage.setItem('expenses', JSON.stringify(this.expenses));
                    localStorage.setItem('expense-tracker-incomes', JSON.stringify(this.incomes));
                    
                    if (data.budgets) {
                        localStorage.setItem('expense-tracker-budgets', JSON.stringify(data.budgets));
                    }
                    if (data.theme) {
                        localStorage.setItem('theme', data.theme);
                    }

                    // Sync imported data to Supabase
                    const budgets = data.budgets || {};
                    if (typeof syncManager !== 'undefined' && syncManager.online) {
                        // Mark as initial sync done so it pushes instead of pulls
                        localStorage.setItem('sync_initial_done', 'true');
                        syncManager.pushAll(this.expenses, this.incomes, budgets).then(() => {
                            alert('Successfully imported and synced! App will now refresh.');
                            window.location.reload();
                        }).catch(err => {
                            console.error('Sync after import failed:', err);
                            alert('Imported but sync failed. App will refresh.');
                            window.location.reload();
                        });
                        return; // Return early, reload happens in promise
                    }

                    alert('Successfully imported! App will now refresh.');
                    window.location.reload();
                }
            } catch (err) {
                alert('Import failed: ' + err.message);
            }
            // Clear input for next time
            event.target.value = '';
        };
        reader.onerror = () => alert('Error reading file.');
        reader.readAsText(file);
    }
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
    window.expenseApp = new ExpenseTrackerApp();
});
