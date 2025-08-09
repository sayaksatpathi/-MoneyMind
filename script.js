// IIFE to avoid global scope pollution
(function() {
    
    const { jsPDF } = window.jspdf;
    
    const _ = {
        get: (selector) => document.querySelector(selector),
        getAll: (selector) => document.querySelectorAll(selector),
        create: (tagName, options = {}) => {
            const el = document.createElement(tagName);
            Object.entries(options).forEach(([key, value]) => el[key] = value);
            return el;
        },
        formatCurrency: (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount),
        hashPassword: async (p) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p)))).map(b => b.toString(16).padStart(2, '0')).join(''),
        generateId: () => Date.now().toString(36) + Math.random().toString(36).substring(2)
    };

    const App = {
        State: {
            currentUser: null,
            calendar: null
        },
        DB: {
            get: () => JSON.parse(localStorage.getItem('MoneyMindDB_v7')) || { users: [] },
            save: (db) => localStorage.setItem('MoneyMindDB_v7', JSON.stringify(db))
        },
        Auth: {
            getDefaultUserData(isStudent = false) {
                const studentCategories = [
                    { id: _.generateId(), name: 'Pocket Money', budget: 0, color: '#2ecc71', icon: 'fas fa-wallet' },
                    { id: _.generateId(), name: 'Food & Canteen', budget: 2000, color: '#3498db', icon: 'fas fa-utensils' },
                    { id: _.generateId(), name: 'Stationery & Books', budget: 1000, color: '#9b59b6', icon: 'fas fa-book' },
                    { id: _.generateId(), name: 'Transport', budget: 500, color: '#e67e22', icon: 'fas fa-bus' },
                    { id: _.generateId(), name: 'Entertainment', budget: 1000, color: '#e74c3c', icon: 'fas fa-film' }
                ];
                const defaultCategories = [
                    { id: _.generateId(), name: 'Income', budget: 0, color: '#2ecc71', icon: 'fas fa-briefcase' },
                    { id: _.generateId(), name: 'Food & Dining', budget: 15000, color: '#3498db', icon: 'fas fa-utensils' },
                    { id: _.generateId(), name: 'Transportation', budget: 5000, color: '#e74c3c', icon: 'fas fa-car' },
                    { id: _.generateId(), name: 'Housing', budget: 25000, color: '#9b59b6', icon: 'fas fa-home' },
                ];
                const defaultAccountId = _.generateId();
                return {
                    transactions: [],
                    goals: [],
                    accounts: [{ id: defaultAccountId, name: 'Cash', type: 'General', balance: 0 }],
                    categories: isStudent ? studentCategories : defaultCategories,
                    settings: {
                        currency: 'INR',
                        defaultAccount: defaultAccountId,
                    }
                };
            },
            async login(email, pass) {
                const db = App.DB.get();
                const user = db.users.find(u => u.email === email);
                if (user && user.password === await _.hashPassword(pass)) {
                    App.State.currentUser = user;
                    localStorage.setItem('moneyMindUserEmail', email);
                    App.UI.initApp();
                } else { App.UI.showToast('Invalid credentials.', 'error'); }
            },
            async register(name, email, pass) {
                if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(pass)) {
                    return App.UI.showToast('Password must be 8+ chars with 1 uppercase & 1 number.', 'warning');
                }
                const db = App.DB.get();
                if (db.users.some(u => u.email === email)) return App.UI.showToast('Email already registered.', 'error');
                
                const isStudent = _.get('#isStudentCheck').checked;
                const newUser = {
                    id: _.generateId(), name, email,
                    password: await _.hashPassword(pass),
                    ...this.getDefaultUserData(isStudent)
                };
                db.users.push(newUser);
                App.DB.save(db);
                App.UI.showToast('Registration successful! Please log in.', 'success');
                App.UI.showLoginForm();
                _.get('#email').value = email;
            },
            logout() {
                App.UI.showConfirm("Confirm Logout", "Are you sure you want to log out?", () => {
                    localStorage.removeItem('moneyMindUserEmail');
                    location.reload();
                });
            },
            handleGoogleSignIn(response) {
                try {
                    const userData = JSON.parse(atob(response.credential.split('.')[1]));
                    if (!userData || !userData.email) {
                        console.error("Google sign-in response is invalid:", response);
                        App.UI.showToast("Google sign-in failed. Invalid data received.", "error");
                        return;
                    }

                    const db = App.DB.get();
                    let user = db.users.find(u => u.email === userData.email);

                    if (!user) { // Auto-register for Google users
                        console.log("Creating new user for:", userData.email);
                        user = {
                            id: _.generateId(),
                            name: userData.name || userData.email.split('@')[0], 
                            email: userData.email,
                            password: 'google-user',
                            ...this.getDefaultUserData()
                        };
                        db.users.push(user);
                        App.DB.save(db);
                    }

                    App.State.currentUser = user;
                    localStorage.setItem('moneyMindUserEmail', user.email);
                    App.UI.initApp();

                } catch (error) {
                    console.error("Error during handleGoogleSignIn:", error);
                    App.UI.showToast("An error occurred during Google sign-in. Check the console.", "error");
                }
            },
        },
        Logic: {
            saveUserData() {
                const db = App.DB.get();
                const userIndex = db.users.findIndex(u => u.id === App.State.currentUser.id);
                if (userIndex > -1) {
                    db.users[userIndex] = App.State.currentUser;
                    App.DB.save(db);
                }
            },
            addOrUpdate(type, data) {
                if(type === 'transactions') return this.addOrUpdateTransaction(data);
                
                const collection = App.State.currentUser[type];
                const index = collection.findIndex(item => item.id === data.id);
                if (index > -1) {
                    if (type === 'accounts') data.balance = collection[index].balance;
                    collection[index] = { ...collection[index], ...data };
                } else {
                    collection.push({ ...data, id: _.generateId() });
                }
                this.saveUserData();
                App.UI.refresh();
                App.UI.closeModal('#formModal');
            },
            deleteItem(type, id) {
                if(type === 'transactions') return this.deleteTransaction(id);

                if (type === 'accounts') {
                    if (App.State.currentUser.transactions.some(t => t.accountId === id)) {
                        return App.UI.showToast('Cannot delete account with existing transactions.', 'error');
                    }
                    if (App.State.currentUser.accounts.length === 1) {
                        return App.UI.showToast('Cannot delete your only account.', 'error');
                    }
                    if (App.State.currentUser.settings.defaultAccount === id) {
                        App.State.currentUser.settings.defaultAccount = App.State.currentUser.accounts.find(acc => acc.id !== id)?.id || null;
                    }
                }

                App.UI.showConfirm(`Delete ${type.slice(0, -1)}?`, "This action cannot be undone.", () => {
                    App.State.currentUser[type] = App.State.currentUser[type].filter(item => item.id !== id);
                    this.saveUserData();
                    App.UI.refresh();
                    App.UI.showToast(`${type.slice(0, -1)} deleted.`, 'success');
                });
            },
            addOrUpdateTransaction(data) {
                const { accounts, transactions } = App.State.currentUser;
                const account = accounts.find(a => a.id === data.accountId);
                if (!account) return App.UI.showToast('Invalid account selected.', 'error');
                
                let originalTransaction = null;
                if(data.id){
                    originalTransaction = transactions.find(t => t.id === data.id);
                    if (originalTransaction) {
                        const originalAccount = accounts.find(a => a.id === originalTransaction.accountId);
                        if (originalAccount) {
                            const originalEffect = originalTransaction.type === 'income' ? -originalTransaction.amount : originalTransaction.amount;
                            originalAccount.balance += originalEffect;
                        }
                    }
                }

                const newEffect = data.type === 'income' ? data.amount : -data.amount;
                account.balance += newEffect;
                
                if(originalTransaction){
                   Object.assign(originalTransaction, data);
                } else {
                    transactions.push({ ...data, id: _.generateId() });
                }

                this.saveUserData();
                App.UI.refresh();
                App.UI.closeModal('#formModal');
            },
            deleteTransaction(id){
                App.UI.showConfirm("Delete Transaction?", "This will update your account balance and cannot be undone.", () => {
                    const { accounts, transactions } = App.State.currentUser;
                    const index = transactions.findIndex(t => t.id === id);
                    if (index === -1) return;

                    const transaction = transactions[index];
                    const account = accounts.find(a => a.id === transaction.accountId);

                    if (account) {
                        const effect = transaction.type === 'income' ? -transaction.amount : transaction.amount;
                        account.balance += effect;
                    }

                    transactions.splice(index, 1);
                    this.saveUserData();
                    App.UI.refresh();
                    App.UI.showToast('Transaction deleted.', 'success');
                });
            },
            searchItems(query, gridSelector, cardSelector, nameSelector) {
                const q = query.toLowerCase();
                _.getAll(cardSelector).forEach(card => {
                    const name = card.querySelector(nameSelector).textContent.toLowerCase();
                    card.style.display = name.includes(q) ? 'flex' : 'none';
                });
            },
            resetUserData() {
                App.UI.showConfirm(
                    'Confirm Data Reset', 
                    'Are you absolutely sure? All your accounts, transactions, and goals will be permanently deleted.', 
                    () => {
                        const defaults = App.Auth.getDefaultUserData();
                        Object.assign(App.State.currentUser, defaults);
                        this.saveUserData();
                        location.reload();
                    }
                );
            },
            exportCSV() {
                const { transactions, categories, accounts } = App.State.currentUser;
                if(transactions.length === 0) return App.UI.showToast("No transactions to export.", "warning");
                
                const headers = ['Date', 'Description', 'Amount', 'Type', 'Method', 'Category', 'Account'];
                const rows = transactions.map(t => {
                    const category = categories.find(c => c.id === t.categoryId)?.name || 'N/A';
                    const account = accounts.find(a => a.id === t.accountId)?.name || 'N/A';
                    return [t.date, `"${t.description.replace(/"/g, '""')}"`, t.amount, t.type, t.method || 'online', category, account].join(',');
                });

                const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = _.create('a', { href: encodedUri, download: `MoneyMind_Report_${new Date().toISOString().split('T')[0]}.csv`, className: 'hidden'});
                document.body.appendChild(link);
                link.click();
                link.remove();
                App.UI.closeModal('#exportModal');
            },
            generatePDF() {
                const { transactions, categories, accounts, name, settings } = App.State.currentUser;
                if(transactions.length === 0) return App.UI.showToast("No transactions to export.", "warning");
                
                const doc = new jsPDF();
                const head = [['Date', 'Description', 'Method', 'Category', 'Account', 'Amount']];
                const body = transactions.map(t => {
                    const category = categories.find(c => c.id === t.categoryId)?.name || 'N/A';
                    const account = accounts.find(a => a.id === t.accountId)?.name || 'N/A';
                    const amountStr = (t.type === 'income' ? '+' : '-') + _.formatCurrency(t.amount, settings.currency);
                    return [t.date, t.description, t.method || 'online', category, account, amountStr];
                });

                doc.setFontSize(18);
                doc.text("Financial Report", 14, 22);
                doc.setFontSize(11);
                doc.text(`User: ${name}`, 14, 30);
                doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, 30);

                doc.autoTable({ startY: 40, head, body, theme: 'grid' });
                doc.save(`MoneyMind_Report_${new Date().toISOString().split('T')[0]}.pdf`);
                App.UI.closeModal('#exportModal');
            }
        },
        UI: {
            // ✅ NEW: List of icons for the picker
            iconOptions: [
                'fas fa-shopping-cart', 'fas fa-utensils', 'fas fa-bus', 'fas fa-home', 'fas fa-film', 'fas fa-gas-pump',
                'fas fa-tshirt', 'fas fa-pills', 'fas fa-heartbeat', 'fas fa-plane', 'fas fa-gift', 'fas fa-graduation-cap',
                'fas fa-tag', 'fas fa-dollar-sign', 'fas fa-credit-card', 'fas fa-receipt', 'fas fa-book', 'fas fa-briefcase'
            ],
            initApp() {
                App.State.currentUser = App.State.currentUser || {};
                if (!App.State.currentUser.settings || !App.State.currentUser.accounts || !App.State.currentUser.goals) {
                    const defaults = App.Auth.getDefaultUserData();
                    App.State.currentUser = { ...defaults, ...App.State.currentUser };
                    App.Logic.saveUserData();
                }
                App.UI.closeModal('#loginModal');
                _.get('#appContainer').classList.add('show');
                _.get('#userName').textContent = App.State.currentUser.name;
                _.get('#userEmail').textContent = App.State.currentUser.email;
                _.get('#userAvatar').textContent = App.State.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
                this.initializeCalendar();
                this.refresh();
            },
            refresh() {
                this.renderDashboard();
                this.renderAccounts();
                this.renderCategories();
                this.renderGoals();
                this.renderSettings();
                this.updateCalendarEvents();
            },
            renderDashboard() {
                const { accounts, transactions, settings } = App.State.currentUser;
                const currency = settings.currency;
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                
                const monthlyTransactions = transactions.filter(t => new Date(t.date) >= startOfMonth);
                const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
                const monthlyIncome = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
                const monthlyExpensesGroup = monthlyTransactions.filter(t => t.type === 'expense');
                const totalMonthlyExpenses = monthlyExpensesGroup.reduce((sum, t) => sum + t.amount, 0);

                const monthlyOnlineExpenses = monthlyExpensesGroup.filter(t => t.method !== 'cash').reduce((sum, t) => sum + t.amount, 0);
                const monthlyCashExpenses = monthlyExpensesGroup.filter(t => t.method === 'cash').reduce((sum, t) => sum + t.amount, 0);
                
                const netSavings = monthlyIncome - totalMonthlyExpenses;
                const savingsRate = monthlyIncome > 0 ? ((netSavings / monthlyIncome) * 100) : 0;
                
                _.get('#totalBalance').textContent = _.formatCurrency(totalBalance, currency);
                const changeEl = _.get('#monthlyChange');
                changeEl.textContent = `${netSavings >= 0 ? '↑' : '↓'} ${_.formatCurrency(Math.abs(netSavings), currency)} this month`;
                changeEl.className = `monthly-change ${netSavings >= 0 ? 'positive' : 'negative'}`;

                _.get('#monthlyIncomeStat').textContent = _.formatCurrency(monthlyIncome, currency);
                _.get('#monthlyExpensesStat').textContent = _.formatCurrency(totalMonthlyExpenses, currency);
                _.get('#savingsRateStat').textContent = `${savingsRate.toFixed(1)}%`;

                const spendingMethodEl = _.get('#spendingMethodStat');
                spendingMethodEl.innerHTML = `
                    <div style="font-size: 1.2rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; align-items: center;">
                        <span style="opacity: 0.8; font-size: 0.8rem;">Online</span>
                        <span style="opacity: 0.8; font-size: 0.8rem;">Cash</span>
                        <span style="font-weight: 600;">${_.formatCurrency(monthlyOnlineExpenses, currency)}</span>
                        <span style="font-weight: 600;">${_.formatCurrency(monthlyCashExpenses, currency)}</span>
                    </div>
                `;
            },
            renderAccounts() {
                const { accounts, transactions, categories, settings } = App.State.currentUser;
                const grid = _.get('#accountsGrid');
                grid.innerHTML = '';
                if (accounts.length === 0) {
                    grid.innerHTML = '<p>No accounts found. Add one to get started!</p>';
                } else {
                    accounts.forEach(acc => {
                        const card = _.create('div', { className: 'account-card' });
                        card.innerHTML = `
                            <div class="account-info">
                                <h5>${acc.name} (${acc.type})</h5>
                                <div class="amount">${_.formatCurrency(acc.balance, settings.currency)}</div>
                            </div>
                            <div class="account-actions">
                                <button class="edit-account-btn" data-id="${acc.id}" title="Edit"><i class="fas fa-edit"></i></button>
                                <button class="delete-account-btn" data-id="${acc.id}" title="Delete"><i class="fas fa-trash"></i></button>
                            </div>
                        `;
                        grid.appendChild(card);
                    });
                }

                const tableBody = _.get('#recentTransactionsTable tbody');
                tableBody.innerHTML = '';
                const recentTransactions = [...transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
                if(recentTransactions.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; opacity: 0.7;">No transactions yet.</td></tr>`;
                } else {
                    recentTransactions.forEach(t => {
                        const category = categories.find(c => c.id === t.categoryId)?.name || 'N/A';
                        const account = accounts.find(a => a.id === t.accountId)?.name || 'N/A';
                        const methodIcon = (t.method === 'cash') 
                            ? '<i class="fas fa-money-bill-wave" title="Cash"></i>' 
                            : '<i class="fas fa-credit-card" title="Online"></i>';
                        const row = _.create('tr');
                        row.style.cursor = 'pointer';
                        row.title = "Click to edit this transaction";
                        row.dataset.id = t.id;
                        row.classList.add('transaction-row');
                        row.innerHTML = `
                            <td>${new Date(t.date).toLocaleDateString()}</td>
                            <td>${t.description}</td>
                            <td>${category}</td>
                            <td>${account}</td>
                            <td class="method-icon">${methodIcon}</td>
                            <td style="color: ${t.type === 'income' ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                                ${t.type === 'income' ? '+' : '-'}${_.formatCurrency(t.amount, settings.currency)}
                            </td>
                        `;
                        tableBody.appendChild(row);
                    });
                }
            },
            renderCategories() {
                const grid = _.get('#categoriesGrid');
                grid.innerHTML = '';
                const { categories, transactions, settings } = App.State.currentUser;
                categories.forEach(cat => {
                    if (cat.name.toLowerCase() === 'income') return;
                    const spent = transactions.filter(t => t.categoryId === cat.id && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
                    const progress = cat.budget > 0 ? (spent / cat.budget) * 100 : 0;
                    const card = _.create('div', { className: 'category-card' });
                    card.innerHTML = `
                        <div class="category-header">
                            <div class="category-icon" style="background-color: ${cat.color};"><i class="${cat.icon}"></i></div>
                            <span class="category-name">${cat.name}</span>
                            <div class="category-actions">
                                <button class="edit-cat-btn" data-id="${cat.id}" title="Edit"><i class="fas fa-edit"></i></button>
                                <button class="delete-cat-btn" data-id="${cat.id}" title="Delete"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${Math.min(100, progress)}%; background-color: ${cat.color};"></div></div>
                        <div class="progress-labels">
                            <span>${_.formatCurrency(spent, settings.currency)} spent</span>
                            <span>${_.formatCurrency(cat.budget, settings.currency)} budget</span>
                        </div>`;
                    grid.appendChild(card);
                });
            },
            renderGoals() {
                const grid = _.get('#goalsGrid');
                grid.innerHTML = '';
                const { goals, settings } = App.State.currentUser;
                goals.forEach(goal => {
                    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                    const card = _.create('div', { className: 'category-card' });
                    card.innerHTML = `
                        <div class="category-header">
                            <div class="category-icon" style="background-color: ${goal.color || '#00b894'};"><i class="fas fa-bullseye"></i></div>
                            <span class="goal-name">${goal.name}</span>
                            <div class="category-actions">
                                <button class="edit-goal-btn" data-id="${goal.id}" title="Edit"><i class="fas fa-edit"></i></button>
                                <button class="delete-goal-btn" data-id="${goal.id}" title="Delete"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${Math.min(100, progress)}%; background-color: ${goal.color || '#00b894'};"></div></div>
                        <div class="progress-labels">
                            <span>${_.formatCurrency(goal.currentAmount, settings.currency)} saved</span>
                            <span>${_.formatCurrency(goal.targetAmount, settings.currency)} goal</span>
                        </div>`;
                    grid.appendChild(card);
                });
            },
            renderSettings() {
                const { settings, accounts } = App.State.currentUser;
                _.get('#currencySelector').value = settings.currency;
                const defaultAccountSelector = _.get('#defaultAccountSelector');
                defaultAccountSelector.innerHTML = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
                if (settings.defaultAccount) {
                    defaultAccountSelector.value = settings.defaultAccount;
                }
            },
            initializeCalendar() { 
                if (App.State.calendar) return;
                const calendarEl = _.get('#calendar-container');
                App.State.calendar = new FullCalendar.Calendar(calendarEl, {
                    timeZone: 'Asia/Kolkata',
                    initialView: 'dayGridMonth',
                    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
                    events: [],
                    eventClick: (info) => this.showForm('transaction', info.event.id),
                    dateClick: (info) => this.showForm('transaction', null, { date: info.dateStr }),
                    height: '100%'
                });
                App.State.calendar.render();
            },
            updateCalendarEvents() {
                if (!App.State.calendar) return;
                const { transactions, settings } = App.State.currentUser;
                const events = transactions.map(t => ({
                    id: t.id,
                    title: `${t.description} (${_.formatCurrency(t.amount, settings.currency)})`,
                    start: t.date,
                    backgroundColor: t.type === 'income' ? 'var(--success)' : 'var(--danger)',
                    borderColor: t.type === 'income' ? 'var(--success)' : 'var(--danger)'
                }));
                App.State.calendar.getEventSources().forEach(s => s.remove());
                App.State.calendar.addEventSource(events);
            },
            showForm(type, id = null, defaults = {}) {
                let title, content;
                const { categories, goals, accounts, settings } = App.State.currentUser;
                const accountOptions = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
                const categoryOptions = categories.filter(c => c.name.toLowerCase() !== 'income').map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                
                const collectionName = type === 'category' ? 'categories' : type + 's';
                const item = id ? App.State.currentUser[collectionName]?.find(i => i.id === id) : {};
                const formData = { ...defaults, ...item };

                switch(type) {
                    case 'transaction':
                        title = id ? 'Edit Transaction' : 'Add Transaction';
                        content = `
                            <input type="hidden" id="formId" value="${formData.id || ''}">
                            <div class="form-group"><label for="t_type">Type</label><select id="t_type"><option value="expense">Expense</option><option value="income">Income</option></select></div>
                            <div class="form-group"><label for="t_desc">Description</label><input type="text" id="t_desc" value="${formData.description || ''}" required></div>
                            <div class="form-group"><label for="t_amount">Amount</label><input type="number" id="t_amount" step="0.01" min="0.01" value="${formData.amount || ''}" required></div>
                            <div class="form-group"><label for="t_date">Date</label><input type="date" id="t_date" value="${formData.date || new Date().toISOString().split('T')[0]}" required></div>
                            <div class="form-group" id="t_category_group"><label for="t_category">Category</label><select id="t_category">${categoryOptions}</select></div>
                            <div class="form-group"><label for="t_account">Account</label><select id="t_account">${accountOptions}</select></div>
                            <div class="form-group">
                                <label>Payment Method</label>
                                <div style="display: flex; gap: 1rem;">
                                    <label style="display:flex; align-items:center; gap: 0.5rem; font-weight:normal;"><input type="radio" name="t_method" value="online" ${formData.method !== 'cash' ? 'checked' : ''} style="width:auto; height:auto;"> Online</label>
                                    <label style="display:flex; align-items:center; gap: 0.5rem; font-weight:normal;"><input type="radio" name="t_method" value="cash" ${formData.method === 'cash' ? 'checked' : ''} style="width:auto; height:auto;"> Cash</label>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary" style="width:100%">Save Transaction</button>
                        `;
                        break;
                    case 'account':
                        title = id ? 'Edit Account' : 'Add Account';
                        content = `
                            <input type="hidden" id="formId" value="${formData.id || ''}">
                            <div class="form-group"><label for="a_name">Account Name</label><input type="text" id="a_name" value="${formData.name || ''}" required></div>
                            <div class="form-group"><label for="a_type">Account Type (e.g., Savings, Checking)</label><input type="text" id="a_type" value="${formData.type || ''}" required></div>
                            <div class="form-group"><label for="a_balance">Starting Balance</label><input type="number" id="a_balance" step="0.01" value="${formData.balance || 0}" ${id ? 'disabled' : ''} required></div>
                            <p style="font-size: 0.8rem; opacity: 0.7; margin-top: -1rem; margin-bottom: 1rem;">${id ? 'Balance is updated via transactions.' : 'Set the initial balance for this account.'}</p>
                            <button type="submit" class="btn btn-primary" style="width:100%">Save Account</button>
                        `;
                        break;
                    case 'category':
                        // ✅ MODIFIED: Create the icon picker HTML from the options array
                        const iconPickerHTML = this.iconOptions.map(iconClass => `
                            <button type="button" class="icon-picker-btn" data-icon="${iconClass}">
                                <i class="${iconClass}"></i>
                            </button>
                        `).join('');

                        title = id ? 'Edit Category' : 'Add Category';
                        content = `
                            <input type="hidden" id="formId" value="${formData.id || ''}">
                            <div class="form-group"><label for="c_name">Name</label><input type="text" id="c_name" value="${formData.name || ''}" required></div>
                            <div class="form-group"><label for="c_budget">Budget (for expenses)</label><input type="number" id="c_budget" value="${formData.budget || ''}"></div>
                            <div class="form-group"><label for="c_color">Color</label><input type="color" id="c_color" value="${formData.color || '#3498db'}"></div>
                            
                            <div class="form-group">
                                <label>Icon</label>
                                <input type="hidden" id="c_icon" value="${formData.icon || 'fas fa-tag'}">
                                <div class="icon-picker-grid">${iconPickerHTML}</div>
                            </div>

                            <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
                        `;
                        break;
                    case 'goal':
                        title = id ? 'Edit Goal' : 'Add Goal';
                        content = `
                            <input type="hidden" id="formId" value="${formData.id || ''}">
                            <div class="form-group"><label for="g_name">Name</label><input type="text" id="g_name" value="${formData.name || ''}" required></div>
                            <div class="form-group"><label for="g_target">Target Amount</label><input type="number" id="g_target" value="${formData.targetAmount || 1000}" required></div>
                            <div class="form-group"><label for="g_current">Current Amount</label><input type="number" id="g_current" value="${formData.currentAmount || 0}"></div>
                            <div class="form-group"><label for="g_color">Color</label><input type="color" id="g_color" value="${formData.color || '#00b894'}"></div>
                            <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
                        `;
                        break;
                }
                const modalContent = _.get('#formModalContent');
                modalContent.innerHTML = `<button class="close-modal" title="Close">&times;</button><h3>${title}</h3><form id="dynamicForm">${content}</form>`;
                
                if (type === 'transaction') {
                    _.get('#t_account').value = formData.accountId || settings.defaultAccount;
                    const typeSelect = _.get('#t_type');
                    const categoryGroup = _.get('#t_category_group');
                    const toggleCategory = () => {
                        if (typeSelect.value === 'income') {
                            categoryGroup.style.display = 'none';
                        } else {
                            categoryGroup.style.display = 'block';
                        }
                    };
                    typeSelect.addEventListener('change', toggleCategory);
                    if (formData.type) {
                        typeSelect.value = formData.type;
                    }
                    if (formData.categoryId && formData.type === 'expense') {
                         _.get('#t_category').value = formData.categoryId;
                    }
                    toggleCategory();
                }

                this.openModal('#formModal');
                
                // ✅ ADDED: After the modal is open, set the active state for the current icon
                if (type === 'category') {
                    const currentIcon = _.get('#c_icon').value;
                    const activeButton = _.get(`.icon-picker-btn[data-icon="${currentIcon}"]`);
                    if (activeButton) {
                        activeButton.classList.add('active');
                    }
                }
                
                _.get('#dynamicForm').addEventListener('submit', (e) => this.handleFormSubmit(e, type));
            },
            handleFormSubmit(e, type) {
                e.preventDefault();
                let data;
                const form = e.target;
                const formId = form.querySelector('#formId').value;

                const amountInputs = ['#t_amount', '#a_balance', '#c_budget', '#g_target', '#g_current'];
                for (const selector of amountInputs) {
                    const input = form.querySelector(selector);
                    if (input) {
                        const value = parseFloat(input.value);
                        if (input.value !== '' && (isNaN(value) || value < 0)) {
                            return App.UI.showToast('Please enter a valid, non-negative number for amounts.', 'error');
                        }
                    }
                }

                switch(type) {
                    case 'transaction': 
                        const typeValue = form.querySelector('#t_type').value;
                        const incomeCategory = App.State.currentUser.categories.find(c => c.name.toLowerCase() === 'income');
                        const categoryId = typeValue === 'income' ? incomeCategory.id : form.querySelector('#t_category').value;
                        data = { 
                            id: formId, 
                            accountId: form.querySelector('#t_account').value, 
                            description: form.querySelector('#t_desc').value, 
                            amount: parseFloat(form.querySelector('#t_amount').value), 
                            date: form.querySelector('#t_date').value, 
                            categoryId: categoryId, 
                            type: typeValue, 
                            method: form.querySelector('input[name="t_method"]:checked').value 
                        }; 
                        break;
                    case 'account': data = { id: formId, name: form.querySelector('#a_name').value, type: form.querySelector('#a_type').value, balance: parseFloat(form.querySelector('#a_balance').value || 0) }; break;
                    case 'category': data = { id: formId, name: form.querySelector('#c_name').value, budget: parseFloat(form.querySelector('#c_budget').value || 0), color: form.querySelector('#c_color').value, icon: form.querySelector('#c_icon').value }; break;
                    case 'goal': data = { id: formId, name: form.querySelector('#g_name').value, targetAmount: parseFloat(form.querySelector('#g_target').value), currentAmount: parseFloat(form.querySelector('#g_current').value || 0), color: form.querySelector('#g_color').value }; break;
                }
                if (data) {
                    const collectionName = type === 'category' ? 'categories' : type + 's';
                    App.Logic.addOrUpdate(collectionName, data);
                }
            },
            openModal(id) { _.get(id).classList.add('show'); },
            closeModal(id) { _.get(id).classList.remove('show'); },
            showConfirm(title, text, onConfirm) {
                _.get('#confirmModalTitle').textContent = title;
                _.get('#confirmModalText').textContent = text;
                const confirmBtn = _.get('#confirmModalConfirm');
                const newConfirmBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

                newConfirmBtn.addEventListener('click', () => {
                    onConfirm();
                    this.closeModal('#confirmModal');
                });
                this.openModal('#confirmModal');
            },
            showToast(message, type = 'info', duration = 4000) {
                const container = _.get('#toastContainer');
                const toast = _.create('div', { className: `toast ${type}`, innerHTML: `<div>${message}</div><button class="toast-close">&times;</button>` });
                container.appendChild(toast);
                setTimeout(() => toast.classList.add('show'), 10);
                const removeToast = () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); };
                const timer = setTimeout(removeToast, duration);
                toast.querySelector('.toast-close').addEventListener('click', () => {
                    clearTimeout(timer);
                    removeToast();
                });
            },
            showLoginForm() { _.get('#registerForm').classList.add('hidden'); _.get('#loginForm').classList.remove('hidden'); },
            showRegisterForm() { _.get('#loginForm').classList.add('hidden'); _.get('#registerForm').classList.remove('hidden'); },
        },
        setupEventListeners() {
            _.get('#loginForm').addEventListener('submit', (e) => { e.preventDefault(); App.Auth.login(_.get('#email').value, _.get('#password').value); });
            _.get('#registerForm').addEventListener('submit', (e) => { e.preventDefault(); App.Auth.register(_.get('#regName').value, _.get('#regEmail').value, _.get('#regPassword').value); });
            _.get('#showRegisterBtn').addEventListener('click', App.UI.showRegisterForm);
            _.get('#showLoginBtn').addEventListener('click', App.UI.showLoginForm);
            
            document.addEventListener('click', (e) => {
                const target = e.target;
                const navLink = target.closest('.nav-link');
                if(navLink) {
                    e.preventDefault();
                    _.getAll('.nav-link').forEach(l => l.classList.remove('active'));
                    navLink.classList.add('active');
                    _.getAll('.content-section').forEach(s => s.classList.remove('active'));
                    const sectionId = navLink.dataset.section;
                    const sectionEl = _.get(`#${sectionId}-section`);
                    sectionEl.classList.add('active');

                    if (sectionId === 'calendar' && App.State.calendar) {
                        setTimeout(() => App.State.calendar.updateSize(), 50);
                    }
                    if (sectionId === 'settings') App.UI.renderSettings();
                }

                // ✅ ADDED: Event listener for the new icon picker buttons
                const iconBtn = target.closest('.icon-picker-btn');
                if(iconBtn) {
                    e.preventDefault();
                    const selectedIcon = iconBtn.dataset.icon;
                    _.get('#c_icon').value = selectedIcon; // Update hidden input
                    // Update active state
                    _.getAll('.icon-picker-btn').forEach(btn => btn.classList.remove('active'));
                    iconBtn.classList.add('active');
                }

                if(target.closest('#logoutBtn')) App.Auth.logout();
                if(target.closest('#addTransactionBtn')) App.UI.showForm('transaction');
                if(target.closest('#addAccountBtn')) App.UI.showForm('account');
                if(target.closest('.edit-account-btn')) App.UI.showForm('account', target.closest('[data-id]').dataset.id);
                if(target.closest('.delete-account-btn')) App.Logic.deleteItem('accounts', target.closest('[data-id]').dataset.id);
                if(target.closest('#addCategoryBtn')) App.UI.showForm('category');
                if(target.closest('.edit-cat-btn')) App.UI.showForm('category', target.closest('[data-id]').dataset.id);
                if(target.closest('.delete-cat-btn')) App.Logic.deleteItem('categories', target.closest('[data-id]').dataset.id);
                if(target.closest('#addGoalBtn')) App.UI.showForm('goal');
                if(target.closest('.edit-goal-btn')) App.UI.showForm('goal', target.closest('[data-id]').dataset.id);
                if(target.closest('.delete-goal-btn')) App.Logic.deleteItem('goals', target.closest('[data-id]').dataset.id);
                if(target.closest('.transaction-row')) App.UI.showForm('transaction', target.closest('[data-id]').dataset.id);
                if(target.closest('#exportDataBtn')) App.UI.openModal('#exportModal');
                if(target.closest('#modalExportCsvBtn')) App.Logic.exportCSV();
                if(target.closest('#modalGeneratePdfBtn')) App.Logic.generatePDF();
                if(target.closest('#getAiInsightsBtn')) App.UI.showToast('AI features are coming soon!', 'info');
                if(target.closest('#resetDataBtn')) App.Logic.resetUserData();
                if(target.closest('.close-modal')) {
                    const modal = target.closest('.modal');
                    if (modal) App.UI.closeModal('#' + modal.id);
                }
                if(target.closest('#confirmModalCancel')) App.UI.closeModal('#confirmModal');
            });
            
            _.get('#categorySearchInput').addEventListener('keyup', (e) => App.Logic.searchItems(e.target.value, '#categoriesGrid', '.category-card', '.category-name'));
            _.get('#currencySelector').addEventListener('change', (e) => { App.State.currentUser.settings.currency = e.target.value; App.Logic.saveUserData(); App.UI.refresh(); });
            _.get('#defaultAccountSelector').addEventListener('change', (e) => { App.State.currentUser.settings.defaultAccount = e.target.value; App.Logic.saveUserData(); });
        },
        init() {
            this.setupEventListeners();
            const loggedInEmail = localStorage.getItem('moneyMindUserEmail');
            if (loggedInEmail) {
                const db = this.DB.get();
                this.State.currentUser = db.users.find(u => u.email === loggedInEmail);
                if (this.State.currentUser) {
                    this.UI.initApp();
                } else { this.UI.openModal('#loginModal'); }
            } else { this.UI.openModal('#loginModal'); }
        }
    };

    window.App = App;
    document.addEventListener('DOMContentLoaded', () => App.init());
})();
