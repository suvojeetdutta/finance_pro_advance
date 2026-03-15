// sync.js — Supabase Cloud Sync for FinancePro
// Credentials loaded from config.js (gitignored) or localStorage fallback
if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') {
    var SUPABASE_URL = localStorage.getItem('supabase_url') || '';
    var SUPABASE_KEY = localStorage.getItem('supabase_key') || '';
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        // One-time setup prompt
        setTimeout(() => {
            const url = prompt('Sync Setup (1/2): Paste your Supabase Project URL:');
            const key = prompt('Sync Setup (2/2): Paste your Supabase anon key:');
            if (url && key) {
                localStorage.setItem('supabase_url', url.trim());
                localStorage.setItem('supabase_key', key.trim());
                location.reload();
            }
        }, 1000);
    }
}

class SyncManager {
    constructor() {
        this.online = navigator.onLine;
        this.pendingOps = JSON.parse(localStorage.getItem('sync_pending') || '[]');
        window.addEventListener('online', () => { this.online = true; this.flushPending(); });
        window.addEventListener('offline', () => { this.online = false; this.updateIndicator('offline'); });
    }

    get headers() {
        return {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
        };
    }

    async req(table, method = 'GET', body = null, query = '') {
        const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
        const opts = { method, headers: { ...this.headers } };
        if (method === 'GET') delete opts.headers['Prefer'];
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(`Sync ${method} ${table}: ${res.status}`);
        return method === 'GET' ? res.json() : null;
    }

    // ---- Push individual records ----

    async pushExpense(exp) {
        const row = {
            id: exp.id, expense_date: exp.date, expense_type: exp.type || 'Daily',
            major: exp.major, sub: exp.sub, amount: exp.amount,
            description: exp.desc || '', deleted: false, updated_at: new Date().toISOString()
        };
        if (!this.online) { this.queueOp('upsert_expense', row); return; }
        try { await this.req('expenses', 'POST', [row]); this.updateIndicator('synced'); }
        catch (e) { this.queueOp('upsert_expense', row); this.updateIndicator('error'); }
    }

    async softDeleteExpense(id) {
        const patch = { deleted: true, updated_at: new Date().toISOString() };
        if (!this.online) { this.queueOp('delete_expense', { id, ...patch }); return; }
        try { await this.req('expenses', 'PATCH', patch, `?id=eq.${id}`); this.updateIndicator('synced'); }
        catch (e) { this.queueOp('delete_expense', { id, ...patch }); }
    }

    async pushIncome(inc, monthKey) {
        const row = {
            id: String(inc.id), income_date: inc.date, income_type: inc.type,
            amount: inc.amount, description: inc.desc || '', month_key: monthKey,
            deleted: false, updated_at: new Date().toISOString()
        };
        if (!this.online) { this.queueOp('upsert_income', row); return; }
        try { await this.req('incomes', 'POST', [row]); this.updateIndicator('synced'); }
        catch (e) { this.queueOp('upsert_income', row); }
    }

    async softDeleteIncome(id) {
        const patch = { deleted: true, updated_at: new Date().toISOString() };
        if (!this.online) { this.queueOp('delete_income', { id: String(id), ...patch }); return; }
        try { await this.req('incomes', 'PATCH', patch, `?id=eq.${String(id)}`); this.updateIndicator('synced'); }
        catch (e) { this.queueOp('delete_income', { id: String(id), ...patch }); }
    }

    async pushBudgets(budgets) {
        const rows = Object.entries(budgets).map(([category, amount]) => ({
            category, amount, updated_at: new Date().toISOString()
        }));
        if (!this.online || !rows.length) return;
        try { await this.req('budgets', 'POST', rows); this.updateIndicator('synced'); }
        catch (e) { console.error('Budget sync failed:', e); }
    }

    // ---- Pull from cloud ----

    async pullAll() {
        if (!this.online) { this.updateIndicator('offline'); return null; }
        this.updateIndicator('syncing');
        try {
            const [expenses, incomes, budgets] = await Promise.all([
                this.req('expenses', 'GET', null, '?deleted=eq.false&order=expense_date.asc'),
                this.req('incomes', 'GET', null, '?deleted=eq.false&order=income_date.asc'),
                this.req('budgets')
            ]);
            this.updateIndicator('synced');
            return { expenses, incomes, budgets };
        } catch (e) {
            console.error('Pull failed:', e);
            this.updateIndicator('error');
            return null;
        }
    }

    // ---- Initial seed: push all local data to cloud ----

    async pushAll(expenses, incomes, budgets) {
        if (!this.online) return;
        this.updateIndicator('syncing');
        try {
            // Expenses in batches of 100
            if (expenses.length) {
                const rows = expenses.map(e => ({
                    id: e.id, expense_date: e.date, expense_type: e.type || 'Daily',
                    major: e.major, sub: e.sub, amount: e.amount,
                    description: e.desc || '', deleted: false, updated_at: new Date().toISOString()
                }));
                for (let i = 0; i < rows.length; i += 100)
                    await this.req('expenses', 'POST', rows.slice(i, i + 100));
            }
            // Incomes
            const incRows = [];
            Object.entries(incomes).forEach(([month, arr]) => {
                if (Array.isArray(arr)) arr.forEach(inc => incRows.push({
                    id: String(inc.id), income_date: inc.date, income_type: inc.type,
                    amount: inc.amount, description: inc.desc || '', month_key: month,
                    deleted: false, updated_at: new Date().toISOString()
                }));
            });
            if (incRows.length) await this.req('incomes', 'POST', incRows);
            // Budgets
            if (budgets && Object.keys(budgets).length) await this.pushBudgets(budgets);

            localStorage.setItem('sync_initial_done', 'true');
            this.updateIndicator('synced');
        } catch (e) {
            console.error('Initial push failed:', e);
            this.updateIndicator('error');
        }
    }

    // ---- Offline queue ----

    queueOp(type, data) {
        this.pendingOps.push({ type, data, time: Date.now() });
        localStorage.setItem('sync_pending', JSON.stringify(this.pendingOps));
        this.updateIndicator('pending');
    }

    async flushPending() {
        if (!this.pendingOps.length) return;
        const ops = [...this.pendingOps];
        this.pendingOps = [];
        localStorage.setItem('sync_pending', '[]');
        for (const op of ops) {
            try {
                if (op.type === 'upsert_expense') await this.req('expenses', 'POST', [op.data]);
                else if (op.type === 'delete_expense') await this.req('expenses', 'PATCH', { deleted: true, updated_at: op.data.updated_at }, `?id=eq.${op.data.id}`);
                else if (op.type === 'upsert_income') await this.req('incomes', 'POST', [op.data]);
                else if (op.type === 'delete_income') await this.req('incomes', 'PATCH', { deleted: true, updated_at: op.data.updated_at }, `?id=eq.${op.data.id}`);
            } catch (e) { this.pendingOps.push(op); }
        }
        localStorage.setItem('sync_pending', JSON.stringify(this.pendingOps));
        this.updateIndicator(this.pendingOps.length ? 'pending' : 'synced');
    }

    // ---- UI indicator ----

    updateIndicator(status) {
        const el = document.getElementById('syncIndicator');
        if (!el) return;
        const map = {
            synced:  { icon: 'fa-check',              text: 'Synced',    cls: 'sync-ok' },
            syncing: { icon: 'fa-rotate fa-spin',     text: 'Syncing…',  cls: 'sync-active' },
            offline: { icon: 'fa-cloud-slash',         text: 'Offline',   cls: 'sync-off' },
            pending: { icon: 'fa-cloud-arrow-up',      text: 'Pending',   cls: 'sync-pending' },
            error:   { icon: 'fa-triangle-exclamation', text: 'Error',    cls: 'sync-err' }
        };
        const s = map[status] || map.error;
        el.className = `sync-indicator ${s.cls}`;
        el.innerHTML = `<i class="fa-solid ${s.icon}"></i><span>${s.text}</span>`;
    }
}

const syncManager = new SyncManager();
