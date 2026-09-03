/* REED admin — customer / sales analysis. */
(function (root) {
    var LS_SALES = 'reed_sales_ledger_v1';
    var LS_NOTES = 'reed_biz_notes_v1';
    var TZ = 'Asia/Yangon';
    var SUBJECTS = [
        { id: 'mm', name: 'Myanmar' },
        { id: 'en', name: 'English' },
        { id: 'math', name: 'Maths' },
        { id: 'phy', name: 'Physics' },
        { id: 'chem', name: 'Chemistry' },
        { id: 'bio', name: 'Biology' },
        { id: 'eco', name: 'Economics' }
    ];
    var TERMS = [
        { id: '1', label: '1 month' },
        { id: '3', label: '3 months' },
        { id: '6', label: '6 months' },
        { id: 'exam', label: 'Till exam' }
    ];
    var PRICES = {
        one: { '1': 2000, '3': 5500, '6': 10000, exam: 11000 },
        all: { '1': 10000, '3': 27000, '6': 53000, exam: 55000 }
    };
    var CONTENT_G12 = {
        mm: { mcq: 740, tf: 798, blank: 800, extra: 776, extraLabel: 'flash / other' },
        en: { mcq: 1476, tf: 0, blank: 564, extra: 2305, extraLabel: 'grammar / poems / Q&A' },
        math: { mcq: 947, tf: 0, blank: 0, extra: 0, extraLabel: '' },
        phy: { mcq: 1053, tf: 1529, blank: 1373, extra: 293, extraLabel: 'formulas / keys' },
        chem: { mcq: 834, tf: 1000, blank: 984, extra: 124, extraLabel: 'formulas / keys' },
        bio: { mcq: 637, tf: 778, blank: 921, extra: 0, extraLabel: '' },
        eco: { mcq: 1224, tf: 1148, blank: 1612, extra: 116, extraLabel: 'formulas / keys' }
    };
    var DEFAULT_NOTES = {
        persona: 'mixture',
        spend: '',
        explanations: true,
        fromSyllabus: true,
        grows: true,
        afterExpire: 'Paid chapters lock when the date ends. Progress and Rank stay. Daily Quiz (3/day) and Chapter 1 trial stay free. Renew by messaging @minaphayarkot with Telegram ID.',
        funnel: 'TikTok → Telegram channel @REED_education → Mini App in @reededucation_bot → free Daily Quiz + Chapter 1 trial → pay @minaphayarkot',
        trial: true,
        goal: ''
    };

    var sales = [];
    var notes = Object.assign({}, DEFAULT_NOTES);
    var syncMsg = '';

    function gasUrl() {
        return (typeof root.STATS_GAS_URL === 'string' && root.STATS_GAS_URL) || '';
    }

    function paidFromCache() {
        try { return JSON.parse(localStorage.getItem('cached_paid_users_v22') || '{}'); }
        catch (e) { return {}; }
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function ymd(iso) {
        try {
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
            }).format(iso ? new Date(iso) : new Date());
        } catch (e) {
            var d = iso ? new Date(iso) : new Date();
            return d.toISOString().slice(0, 10);
        }
    }

    function monthKey(iso) {
        return ymd(iso).slice(0, 7);
    }

    function monthLabel(key) {
        var p = String(key || '').split('-');
        var names = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        var m = parseInt(p[1], 10);
        if (!m) return key;
        var now = ymd();
        var tag = key === now.slice(0, 7) ? ' so far' : '';
        return names[m - 1] + ' ' + p[0] + tag;
    }

    function priceOf(pack, term) {
        var row = PRICES[pack === 'all' ? 'all' : 'one'] || PRICES.one;
        return row[term] || 0;
    }

    function loadLocalSales() {
        try {
            var raw = JSON.parse(localStorage.getItem(LS_SALES) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (e) { return []; }
    }

    function loadLocalNotes() {
        try {
            var raw = JSON.parse(localStorage.getItem(LS_NOTES) || '{}');
            return Object.assign({}, DEFAULT_NOTES, raw);
        } catch (e) { return Object.assign({}, DEFAULT_NOTES); }
    }

    function persistLocal() {
        localStorage.setItem(LS_SALES, JSON.stringify(sales));
        localStorage.setItem(LS_NOTES, JSON.stringify(notes));
    }

    function mergeSales(a, b) {
        var map = {};
        (a || []).concat(b || []).forEach(function (row) {
            if (!row || !row.id) return;
            var prev = map[row.id];
            if (!prev || String(row.savedAt || '') > String(prev.savedAt || '')) map[row.id] = row;
        });
        return Object.keys(map).map(function (k) { return map[k]; }).sort(function (x, y) {
            return String(y.date || '').localeCompare(String(x.date || ''));
        });
    }

    function analyze(list) {
        list = list || [];
        var users = {};
        var firstMonth = {};
        var revenue = 0;
        var pack = { one: 0, all: 0 };
        var packAmt = { one: 0, all: 0 };
        var term = { '1': 0, '3': 0, '6': 0, exam: 0 };
        var months = {};
        list.forEach(function (s) {
            var amt = parseInt(s.amount, 10) || 0;
            revenue += amt;
            var uid = String(s.userId || '').trim();
            if (uid) {
                users[uid] = 1;
                var mk = monthKey(s.date);
                if (!firstMonth[uid] || mk < firstMonth[uid]) firstMonth[uid] = mk;
            }
            var p = s.pack === 'all' ? 'all' : 'one';
            pack[p] += 1;
            packAmt[p] += amt;
            var t = TERMS.some(function (x) { return x.id === s.term; }) ? s.term : '1';
            term[t] += 1;
            var m = monthKey(s.date);
            if (!months[m]) months[m] = { sales: 0, revenue: 0 };
            months[m].sales += 1;
            months[m].revenue += amt;
        });
        var newUsers = {};
        Object.keys(firstMonth).forEach(function (uid) {
            var m = firstMonth[uid];
            newUsers[m] = (newUsers[m] || 0) + 1;
        });
        Object.keys(months).forEach(function (m) {
            months[m].newUsers = newUsers[m] || 0;
        });
        var n = list.length || 1;
        function pct(v) { return Math.round((v / n) * 100); }
        return {
            payingUsers: Object.keys(users).length,
            sales: list.length,
            revenue: revenue,
            pack: pack,
            packAmt: packAmt,
            packPct: { one: pct(pack.one), all: pct(pack.all) },
            term: term,
            termPct: {
                '1': pct(term['1']),
                '3': pct(term['3']),
                '6': pct(term['6']),
                exam: pct(term.exam)
            },
            months: months
        };
    }

    function liveUnlockCount(paid) {
        if (!paid || typeof paid !== 'object') return 0;
        var n = 0;
        Object.keys(paid).forEach(function (id) {
            if (!/^\d+$/.test(id)) return;
            var rec = paid[id];
            if (!rec || typeof rec !== 'object') return;
            var paidKey = Object.keys(rec).some(function (k) {
                if (k === 'vol' || k === 'isVolunteer') return false;
                return !!rec[k];
            });
            if (paidKey) n += 1;
        });
        return n;
    }

    function subjectTotal(row) {
        return (row.mcq || 0) + (row.tf || 0) + (row.blank || 0) + (row.extra || 0);
    }

    function ks(n) {
        return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' Ks';
    }

    function setSync(text) {
        syncMsg = text || '';
        var el = document.getElementById('cust-sync');
        if (el) el.textContent = syncMsg;
    }

    function postGas(body) {
        var url = gasUrl();
        if (!url) return Promise.resolve({ status: 'skip' });
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        }).then(function (res) { return res.text(); }).then(function (t) {
            try { return JSON.parse(t); } catch (e) { return { status: 'error', message: t }; }
        }).catch(function (e) { return { status: 'error', message: String(e && e.message || e) }; });
    }

    function getGas(action) {
        var url = gasUrl();
        if (!url) return Promise.resolve({ status: 'skip' });
        return fetch(url + '?action=' + encodeURIComponent(action) + '&cb=' + Date.now())
            .then(function (res) { return res.json(); })
            .catch(function () { return { status: 'error' }; });
    }

    function cloudSaveSale(row) {
        return postGas({ action: 'saveSale', sale: row });
    }

    function cloudDeleteSale(id) {
        return postGas({ action: 'deleteSale', id: id });
    }

    function cloudSaveNotes() {
        return postGas({ action: 'saveBizNotes', notes: notes });
    }

    function loadCloud() {
        return Promise.all([getGas('getSales'), getGas('getBizNotes')]).then(function (pair) {
            var sRes = pair[0] || {};
            var nRes = pair[1] || {};
            if (sRes.status === 'ok' && Array.isArray(sRes.sales)) {
                sales = mergeSales(sales, sRes.sales);
            }
            if (nRes.status === 'ok' && nRes.notes && typeof nRes.notes === 'object') {
                notes = Object.assign({}, DEFAULT_NOTES, notes, nRes.notes);
            }
            persistLocal();
            var ok = sRes.status === 'ok' || nRes.status === 'ok';
            var skip = sRes.status === 'skip';
            setSync(ok ? 'Saved on this phone and the stats sheet.' : (skip ? 'Saved on this phone.' : 'Saved on this phone. Sheet sync not ready — redeploy stats-Code.gs.'));
            paint();
        });
    }

    function addSaleFromForm() {
        var uid = (document.getElementById('cust-uid') || {}).value;
        var date = (document.getElementById('cust-date') || {}).value;
        var name = (document.getElementById('cust-name') || {}).value;
        var grade = (document.getElementById('cust-grade') || {}).value;
        var pack = (document.getElementById('cust-pack') || {}).value;
        var sub = (document.getElementById('cust-sub') || {}).value;
        var term = (document.getElementById('cust-term') || {}).value;
        var amount = parseInt((document.getElementById('cust-amt') || {}).value, 10);
        var note = (document.getElementById('cust-note') || {}).value;
        uid = String(uid || '').replace(/\D/g, '');
        if (!uid) {
            setSync('Telegram ID လိုအပ်သည်။');
            return;
        }
        if (!date) date = ymd();
        if (!(amount >= 0)) amount = priceOf(pack, term);
        var row = {
            id: Date.now() + '-' + Math.floor(Math.random() * 1e6),
            date: date,
            userId: uid,
            userName: String(name || '').trim(),
            grade: String(grade || '12'),
            pack: pack === 'all' ? 'all' : 'one',
            subject: pack === 'all' ? 'all' : (sub || 'phy'),
            term: term || '1',
            amount: amount,
            note: String(note || '').trim(),
            savedAt: new Date().toISOString()
        };
        sales = mergeSales([row], sales);
        persistLocal();
        paint();
        cloudSaveSale(row).then(function (res) {
            setSync(res && res.status === 'ok' ? 'Sale saved on phone + sheet.' : 'Sale saved on this phone.');
        });
        var uidEl = document.getElementById('cust-uid');
        var nameEl = document.getElementById('cust-name');
        var noteEl = document.getElementById('cust-note');
        if (uidEl) uidEl.value = '';
        if (nameEl) nameEl.value = '';
        if (noteEl) noteEl.value = '';
    }

    function removeSale(id) {
        sales = sales.filter(function (s) { return s.id !== id; });
        persistLocal();
        paint();
        cloudDeleteSale(id);
        setSync('Sale removed (saved).');
    }

    function readNotesFromForm() {
        var persona = (document.getElementById('cust-persona') || {}).value;
        var spend = (document.getElementById('cust-spend') || {}).value;
        var after = (document.getElementById('cust-after') || {}).value;
        var funnel = (document.getElementById('cust-funnel') || {}).value;
        var goal = (document.getElementById('cust-goal') || {}).value;
        var trial = document.getElementById('cust-trial');
        notes.persona = persona || notes.persona;
        notes.spend = spend == null ? notes.spend : spend;
        notes.afterExpire = after == null ? notes.afterExpire : after;
        notes.funnel = funnel == null ? notes.funnel : funnel;
        notes.goal = goal == null ? notes.goal : goal;
        notes.trial = trial ? !!trial.checked : notes.trial;
        notes.explanations = true;
        notes.fromSyllabus = true;
        notes.grows = true;
    }

    function saveNotes() {
        readNotesFromForm();
        persistLocal();
        cloudSaveNotes().then(function (res) {
            setSync(res && res.status === 'ok' ? 'Notes saved on phone + sheet.' : 'Notes saved on this phone.');
        });
        paint();
    }

    function fillAmount() {
        var pack = (document.getElementById('cust-pack') || {}).value;
        var term = (document.getElementById('cust-term') || {}).value;
        var amt = document.getElementById('cust-amt');
        if (amt) amt.value = String(priceOf(pack, term));
        var subWrap = document.getElementById('cust-sub-wrap');
        if (subWrap) subWrap.hidden = pack === 'all';
    }

    function exportJson() {
        var blob = {
            sales: sales,
            notes: notes,
            analysis: analyze(sales),
            exportedAt: new Date().toISOString()
        };
        var text = JSON.stringify(blob, null, 2);
        var a = document.createElement('a');
        a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
        a.download = 'reed-customer-analysis.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function kpiCard(label, value, sub) {
        return '<div class="cust-kpi"><p class="cust-kpi-v">' + esc(value) + '</p><p class="cust-kpi-l">' + esc(label) +
            (sub ? '<span>' + esc(sub) + '</span>' : '') + '</p></div>';
    }

    function barRow(label, pct, extra) {
        var w = Math.max(0, Math.min(100, pct || 0));
        return '<div class="cust-bar-row"><span>' + esc(label) + '</span><div class="cust-bar"><i style="width:' + w + '%"></i></div><b>' + w + '% ' + esc(extra || '') + '</b></div>';
    }

    function paintKpis() {
        var box = document.getElementById('cust-kpis');
        if (!box) return;
        var a = analyze(sales);
        var live = liveUnlockCount(paidFromCache());
        box.innerHTML = kpiCard('Paying users', a.payingUsers, 'in the saved ledger') +
            kpiCard('Sales', a.sales, '') +
            kpiCard('Revenue', ks(a.revenue), 'from saved sales') +
            kpiCard('Live unlocks', live, 'current paid sheet (no history)');
        var packBox = document.getElementById('cust-pack-bars');
        if (packBox) {
            packBox.innerHTML = barRow('Single subject', a.packPct.one, a.pack.one + ' · ' + ks(a.packAmt.one)) +
                barRow('All 6 subjects', a.packPct.all, a.pack.all + ' · ' + ks(a.packAmt.all));
        }
        var termBox = document.getElementById('cust-term-bars');
        if (termBox) {
            termBox.innerHTML = TERMS.map(function (t) {
                return barRow(t.label, a.termPct[t.id], String(a.term[t.id] || 0));
            }).join('');
        }
        var monthBox = document.getElementById('cust-months');
        if (monthBox) {
            var keys = Object.keys(a.months).sort();
            if (!keys.length) {
                monthBox.innerHTML = '<p class="post-help">No saved sales yet. Add each new buyer below — July / August / September will fill in.</p>';
            } else {
                monthBox.innerHTML = keys.map(function (k) {
                    var m = a.months[k];
                    return '<div class="cust-month"><b>' + esc(monthLabel(k)) + '</b><span>' + m.newUsers + ' new paying · ' + m.sales + ' sales · ' + ks(m.revenue) + '</span></div>';
                }).join('');
            }
        }
    }

    function paintSales() {
        var box = document.getElementById('cust-sales-list');
        if (!box) return;
        if (!sales.length) {
            box.innerHTML = '<p class="post-help">Ledger is empty. Old Google Sheet buyers cannot be recovered. Save every new sale here.</p>';
            return;
        }
        box.innerHTML = sales.map(function (s) {
            var pack = s.pack === 'all' ? 'All 6' : (s.subject || 'one');
            var term = (TERMS.filter(function (t) { return t.id === s.term; })[0] || TERMS[0]).label;
            return '<div class="cust-sale">' +
                '<div><b>' + esc(s.date) + '</b> · ID ' + esc(s.userId) +
                (s.userName ? ' · ' + esc(s.userName) : '') +
                '<span>G' + esc(s.grade) + ' · ' + esc(pack) + ' · ' + esc(term) + ' · ' + ks(s.amount) + '</span></div>' +
                '<button type="button" class="btn cust-del" data-id="' + esc(s.id) + '">Delete</button></div>';
        }).join('');
        box.querySelectorAll('.cust-del').forEach(function (btn) {
            btn.onclick = function () { removeSale(btn.getAttribute('data-id')); };
        });
    }

    function paintContent() {
        var box = document.getElementById('cust-content');
        if (!box) return;
        var rows = SUBJECTS.map(function (s) {
            var c = CONTENT_G12[s.id] || {};
            var tot = subjectTotal(c);
            return '<tr><td>' + esc(s.name) + '</td><td>' + c.tf + '</td><td>' + c.blank + '</td><td>' + c.mcq + '</td><td>' + tot + '</td></tr>';
        }).join('');
        var grand = SUBJECTS.reduce(function (n, s) { return n + subjectTotal(CONTENT_G12[s.id] || {}); }, 0);
        box.innerHTML = '<table class="cust-table"><thead><tr><th>Subject</th><th>T/F</th><th>Blank</th><th>MCQ</th><th>All items</th></tr></thead><tbody>' +
            rows + '</tbody></table>' +
            '<p class="post-help">Grade 12 current bank ≈ ' + esc(ks(grand).replace(' Ks', '')) + ' items (not counting old-question files). Explanations/answers are included. Questions follow the syllabus; Grade 12 also has past-paper (Old) quizzes. The bank grows when new JSON is added. 2,000 Ks for one subject is thousands of questions, not a couple of hundred.</p>';
    }

    function paintNotes() {
        var persona = document.getElementById('cust-persona');
        var spend = document.getElementById('cust-spend');
        var after = document.getElementById('cust-after');
        var funnel = document.getElementById('cust-funnel');
        var trial = document.getElementById('cust-trial');
        var goal = document.getElementById('cust-goal');
        if (persona) persona.value = notes.persona || 'mixture';
        if (spend && document.activeElement !== spend) spend.value = notes.spend || '';
        if (after && document.activeElement !== after) after.value = notes.afterExpire || '';
        if (funnel && document.activeElement !== funnel) funnel.value = notes.funnel || '';
        if (trial) trial.checked = notes.trial !== false;
        if (goal) goal.value = notes.goal || '';
        document.querySelectorAll('#cust-persona-chips .tt-chip').forEach(function (btn) {
            btn.classList.toggle('on', btn.getAttribute('data-v') === (notes.persona || 'mixture'));
        });
        document.querySelectorAll('#cust-goal-chips .tt-chip').forEach(function (btn) {
            btn.classList.toggle('on', btn.getAttribute('data-v') === (notes.goal || ''));
        });
    }

    function paint() {
        paintKpis();
        paintSales();
        paintContent();
        paintNotes();
        var el = document.getElementById('cust-sync');
        if (el && syncMsg) el.textContent = syncMsg;
    }

    function bind() {
        if (bind.done) return;
        bind.done = true;
        var date = document.getElementById('cust-date');
        if (date && !date.value) date.value = ymd();
        ['cust-pack', 'cust-term'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.onchange = fillAmount;
        });
        fillAmount();
        var add = document.getElementById('cust-add');
        if (add) add.onclick = function () { addSaleFromForm(); };
        var save = document.getElementById('cust-save-notes');
        if (save) save.onclick = function () { saveNotes(); };
        var exp = document.getElementById('cust-export');
        if (exp) exp.onclick = function () { exportJson(); };
        document.querySelectorAll('#cust-persona-chips .tt-chip').forEach(function (btn) {
            btn.onclick = function () {
                notes.persona = btn.getAttribute('data-v');
                var sel = document.getElementById('cust-persona');
                if (sel) sel.value = notes.persona;
                persistLocal();
                paintNotes();
            };
        });
        document.querySelectorAll('#cust-goal-chips .tt-chip').forEach(function (btn) {
            btn.onclick = function () {
                notes.goal = btn.getAttribute('data-v');
                var sel = document.getElementById('cust-goal');
                if (sel) sel.value = notes.goal;
                persistLocal();
                paintNotes();
            };
        });
        ['cust-spend', 'cust-after', 'cust-funnel'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.onchange = function () { readNotesFromForm(); persistLocal(); };
        });
        var trial = document.getElementById('cust-trial');
        if (trial) trial.onchange = function () { readNotesFromForm(); persistLocal(); };
    }

    function applyChrome() {
        var on = typeof root.isAppAdmin === 'function' && root.isAppAdmin();
        document.body.classList.toggle('admin-role', !!on);
        var tab = document.getElementById('nav-cust');
        if (tab) tab.hidden = !on;
        if (!on) {
            var screen = document.getElementById('cust-screen');
            if (screen && screen.classList.contains('active-screen') && typeof root.goTab === 'function') {
                root.goTab('home');
            }
        }
        if (on) {
            bind();
            sales = mergeSales(loadLocalSales(), sales);
            notes = Object.assign({}, DEFAULT_NOTES, loadLocalNotes(), notes);
            persistLocal();
            paint();
            if (!applyChrome.synced) {
                applyChrome.synced = true;
                loadCloud();
            }
        }
    }

    function open() {
        applyChrome();
        if (typeof root.changeTab === 'function') {
            root.changeTab('cust', document.getElementById('nav-cust'));
        } else if (typeof root.showScreen === 'function') {
            root.showScreen('cust');
        }
        paint();
    }

    root.REEDCustomers = {
        applyChrome: applyChrome,
        open: open,
        analyze: analyze,
        priceOf: priceOf,
        mergeSales: mergeSales,
        liveUnlockCount: liveUnlockCount,
        CONTENT_G12: CONTENT_G12,
        PRICES: PRICES
    };
})(typeof window !== 'undefined' ? window : globalThis);
