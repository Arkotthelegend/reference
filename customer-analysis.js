/* REED admin — customer analysis from TG APP SHEET Logs. */
(function (root) {
    var TZ = 'Asia/Yangon';
    var SUBJECT_ORDER = [
        { id: 'mm', name: 'Myanmar' },
        { id: 'en', name: 'English' },
        { id: 'math', name: 'Mathematics' },
        { id: 'phy', name: 'Physics' },
        { id: 'chem', name: 'Chemistry' },
        { id: 'bio', name: 'Biology' },
        { id: 'eco', name: 'Economics' },
        { id: 'all', name: 'All' }
    ];
    var NAME_TO_ID = {
        myanmar: 'mm', english: 'en', mathematics: 'math', maths: 'math',
        math: 'math', physics: 'phy', chemistry: 'chem', biology: 'bio',
        economics: 'eco', all: 'all', 'all subjects': 'all'
    };
    var GRADES = [10, 11, 12];

    var logs = [];
    var active = [];
    var syncMsg = '';
    var searchQ = '';
    var loading = false;

    function paidGasUrl() {
        if (typeof root.PAID_USERS_GAS_URL === 'string' && root.PAID_USERS_GAS_URL) {
            return root.PAID_USERS_GAS_URL;
        }
        return 'https://script.google.com/macros/s/AKfycbw8uoBL28zm8B52oeGy1d0a2XPEyq8nAZ4hj_WClNNEdJFqtj3CBwkbypxOqgjr-7oV/exec';
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function todayYmd() {
        try {
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
            }).format(new Date());
        } catch (e) {
            return new Date().toISOString().slice(0, 10);
        }
    }

    function toYmd(value) {
        if (value === null || value === undefined || value === '') return '';
        if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
            try {
                return new Intl.DateTimeFormat('en-CA', {
                    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
                }).format(value);
            } catch (e) {
                return value.toISOString().slice(0, 10);
            }
        }
        var s = String(value).trim();
        var iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
        if (iso) return iso[1];
        var dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
        if (dmy) {
            var y = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
            return y + '-' + String(dmy[2]).padStart(2, '0') + '-' + String(dmy[1]).padStart(2, '0');
        }
        var d = new Date(s);
        if (!isNaN(d.getTime())) return toYmd(d);
        return '';
    }

    function formatStamp(value) {
        if (!value) return '';
        var d = value instanceof Date ? value : new Date(value);
        if (isNaN(d.getTime())) return String(value);
        try {
            return new Intl.DateTimeFormat('en-GB', {
                timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
            }).format(d).replace(',', '');
        } catch (e) {
            return d.toISOString();
        }
    }

    function subjectIdFrom(name, column) {
        var col = String(column || '').trim().toLowerCase();
        var colId = col.replace(/^(?:g1[01]_)?(?:vol_)?/, '');
        if (NAME_TO_ID[colId]) return NAME_TO_ID[colId];
        var key = String(name || '').trim().toLowerCase();
        if (NAME_TO_ID[key]) return NAME_TO_ID[key];
        return key || colId || 'other';
    }

    function subjectNameFrom(id, fallback) {
        for (var i = 0; i < SUBJECT_ORDER.length; i++) {
            if (SUBJECT_ORDER[i].id === id) return SUBJECT_ORDER[i].name;
        }
        return fallback || id;
    }

    function gradeOf(raw, column) {
        var n = parseInt(raw, 10);
        if (n === 10 || n === 11 || n === 12) return n;
        var m = String(column || '').match(/^g(10|11)_/);
        if (m) return parseInt(m[1], 10);
        return 12;
    }

    function isVolunteerRow(row) {
        if (!row) return false;
        if (row.kind === 'volunteer' || row.volunteer === true) return true;
        if (String(row.role || '').toLowerCase() === 'volunteer') return true;
        return /(?:^|_)vol_/.test(String(row.column || ''));
    }

    function isPaidLog(row) {
        if (!row) return false;
        if (isVolunteerRow(row)) return false;
        var status = String(row.status || row.role || 'paid').toLowerCase();
        return status === '' || status === 'paid';
    }

    function normalizeLog(raw) {
        raw = raw || {};
        var column = raw.column || raw.subjectCode || raw.code || '';
        var subject = raw.subject || raw.subjectName || raw.name || '';
        var id = subjectIdFrom(subject, column);
        var grade = gradeOf(raw.grade, column);
        return {
            timestamp: raw.timestamp || raw.time || '',
            userId: String(raw.id || raw.userId || raw.uid || '').trim(),
            subject: subjectNameFrom(id, subject || id),
            subjectId: id,
            months: parseInt(raw.months != null ? raw.months : raw.duration, 10) || 0,
            unit: raw.unit || 'months',
            expiry: toYmd(raw.expiry),
            grade: grade,
            column: String(column || ''),
            role: String(raw.role || raw.status || 'paid'),
            volunteer: isVolunteerRow(raw)
        };
    }

    function normalizeActive(raw) {
        raw = raw || {};
        var column = raw.column || '';
        var subject = raw.subject || '';
        var id = subjectIdFrom(subject, column);
        return {
            userId: String(raw.id || raw.userId || '').trim(),
            subject: subjectNameFrom(id, subject || id),
            subjectId: id,
            expiry: toYmd(raw.expiry),
            grade: gradeOf(raw.grade, column),
            column: String(column || ''),
            volunteer: isVolunteerRow(raw)
        };
    }

    function paidLogs(list) {
        return (list || []).map(normalizeLog).filter(function (row) {
            return row.userId && isPaidLog(row);
        });
    }

    function currentUnlocks(list, today) {
        today = today || todayYmd();
        return (list || []).map(normalizeActive).filter(function (row) {
            return row.userId && !row.volunteer && row.expiry && row.expiry >= today;
        });
    }

    function emptyMatrix() {
        var matrix = {};
        SUBJECT_ORDER.forEach(function (s) {
            matrix[s.id] = { name: s.name, 10: 0, 11: 0, 12: 0, total: 0 };
        });
        return matrix;
    }

    function addToMatrix(matrix, subjectId, subjectName, grade) {
        var id = subjectId || 'other';
        if (!matrix[id]) matrix[id] = { name: subjectName || id, 10: 0, 11: 0, 12: 0, total: 0 };
        if (grade === 10 || grade === 11 || grade === 12) {
            matrix[id][grade] += 1;
            matrix[id].total += 1;
        }
    }

    function soldMatrix(list) {
        var rows = paidLogs(list);
        var matrix = emptyMatrix();
        var buyers = {};
        var months = 0;
        rows.forEach(function (row) {
            addToMatrix(matrix, row.subjectId, row.subject, row.grade);
            buyers[row.userId] = 1;
            months += row.months;
        });
        return {
            rows: rows,
            matrix: matrix,
            sold: rows.length,
            buyers: Object.keys(buyers).length,
            months: months
        };
    }

    function liveMatrix(list, today) {
        var rows = currentUnlocks(list, today);
        var matrix = emptyMatrix();
        var users = {};
        rows.forEach(function (row) {
            addToMatrix(matrix, row.subjectId, row.subject, row.grade);
            if (!users[row.userId]) users[row.userId] = [];
            users[row.userId].push(row);
        });
        Object.keys(users).forEach(function (id) {
            users[id].sort(function (a, b) {
                return (a.grade - b.grade) || String(a.subject).localeCompare(String(b.subject));
            });
        });
        return {
            rows: rows,
            matrix: matrix,
            users: users,
            userCount: Object.keys(users).length,
            slots: rows.length
        };
    }

    function setSync(text) {
        syncMsg = text || '';
        var el = document.getElementById('cust-sync');
        if (el) el.textContent = syncMsg;
    }

    function kpiCard(label, value, sub) {
        return '<div class="cust-kpi"><p class="cust-kpi-v">' + esc(value) + '</p><p class="cust-kpi-l">' + esc(label) +
            (sub ? '<span>' + esc(sub) + '</span>' : '') + '</p></div>';
    }

    function matrixTable(matrix) {
        var ids = SUBJECT_ORDER.map(function (s) { return s.id; });
        Object.keys(matrix).forEach(function (id) {
            if (ids.indexOf(id) === -1 && matrix[id].total) ids.push(id);
        });
        var totals = { 10: 0, 11: 0, 12: 0, total: 0 };
        var body = ids.map(function (id) {
            var row = matrix[id];
            if (!row || (!row.total && SUBJECT_ORDER.some(function (s) { return s.id === id; }) === false)) return '';
            totals[10] += row[10];
            totals[11] += row[11];
            totals[12] += row[12];
            totals.total += row.total;
            return '<tr><td>' + esc(row.name) + '</td><td class="num">' + row[10] + '</td><td class="num">' +
                row[11] + '</td><td class="num">' + row[12] + '</td><td class="num">' + row.total + '</td></tr>';
        }).join('');
        return '<table class="cust-table"><thead><tr><th>Subject</th><th>G10</th><th>G11</th><th>G12</th><th>Total</th></tr></thead><tbody>' +
            body + '</tbody><tfoot><tr><th>Total</th><th class="num">' + totals[10] + '</th><th class="num">' +
            totals[11] + '</th><th class="num">' + totals[12] + '</th><th class="num">' + totals.total + '</th></tr></tfoot></table>';
    }

    function paintKpis() {
        var box = document.getElementById('cust-kpis');
        if (!box) return;
        var sold = soldMatrix(logs);
        var live = liveMatrix(active);
        box.innerHTML =
            kpiCard('Subjects sold', sold.sold, 'paid rows in Logs') +
            kpiCard('Buyers', sold.buyers, 'unique Telegram IDs in Logs') +
            kpiCard('Unlock users now', live.userCount, 'expiry still valid') +
            kpiCard('Open subjects now', live.slots, 'current paid unlocks');
    }

    function paintTables() {
        var soldBox = document.getElementById('cust-sold-table');
        if (soldBox) {
            var sold = soldMatrix(logs);
            soldBox.innerHTML = matrixTable(sold.matrix) +
                '<p class="post-help">Each Logs row is one subject sale. Volunteer unlocks are left out. <b>All</b> is a full-pack row, not six separate subjects.</p>';
        }
        var liveBox = document.getElementById('cust-live-table');
        if (liveBox) {
            var live = liveMatrix(active);
            liveBox.innerHTML = matrixTable(live.matrix);
        }
    }

    function paintUsers() {
        var box = document.getElementById('cust-users');
        if (!box) return;
        var live = liveMatrix(active);
        var q = searchQ.toLowerCase();
        var ids = Object.keys(live.users).sort(function (a, b) {
            return live.users[b].length - live.users[a].length || a.localeCompare(b);
        });
        var shown = ids.filter(function (id) {
            if (!q) return true;
            if (id.indexOf(q) !== -1) return true;
            return live.users[id].some(function (row) {
                return String(row.subject).toLowerCase().indexOf(q) !== -1 ||
                    ('g' + row.grade).indexOf(q) !== -1;
            });
        });
        if (!shown.length) {
            box.innerHTML = '<p class="post-help">' + (ids.length ? 'No unlock user matches that search.' : 'No current paid unlocks.') + '</p>';
            return;
        }
        box.innerHTML = shown.map(function (id) {
            var rows = live.users[id];
            var lines = rows.map(function (row) {
                return 'G' + row.grade + ' ' + row.subject + ' · until ' + row.expiry;
            }).join('<br>');
            return '<div class="cust-sale"><div><b>ID ' + esc(id) + '</b><span>' + rows.length +
                ' subject' + (rows.length === 1 ? '' : 's') + ' open</span><span>' + lines + '</span></div></div>';
        }).join('');
    }

    function paintLogs() {
        var box = document.getElementById('cust-logs');
        if (!box) return;
        var rows = paidLogs(logs).slice().sort(function (a, b) {
            return String(b.timestamp).localeCompare(String(a.timestamp));
        }).slice(0, 40);
        if (!rows.length) {
            box.innerHTML = '<p class="post-help">No paid Logs rows yet.</p>';
            return;
        }
        box.innerHTML = rows.map(function (row) {
            return '<div class="cust-sale"><div><b>' + esc(formatStamp(row.timestamp)) + '</b> · ID ' + esc(row.userId) +
                '<span>G' + esc(row.grade) + ' · ' + esc(row.subject) + ' · ' +
                esc(row.months || 0) + ' ' + esc(row.unit || 'months') +
                (row.expiry ? ' · until ' + esc(row.expiry) : '') + '</span></div></div>';
        }).join('');
    }

    function paint() {
        paintKpis();
        paintTables();
        paintUsers();
        paintLogs();
        var el = document.getElementById('cust-sync');
        if (el && syncMsg) el.textContent = syncMsg;
        var btn = document.getElementById('cust-refresh');
        if (btn) btn.disabled = loading;
    }

    function loadSheet() {
        if (loading) return Promise.resolve();
        loading = true;
        setSync('Reading TG APP SHEET…');
        paint();
        var url = paidGasUrl() + '?cb=' + Date.now();
        return fetch(url).then(function (res) { return res.json(); }).then(function (data) {
            if (!data || data.success === false) {
                throw new Error((data && data.message) || 'Sheet read failed');
            }
            logs = Array.isArray(data.logs) ? data.logs : [];
            active = Array.isArray(data.active) ? data.active : [];
            setSync('From TG APP SHEET · Logs ' + logs.length + ' rows · updated ' + formatStamp(new Date()));
        }).catch(function (err) {
            setSync('Could not read the sheet. ' + (err && err.message ? err.message : ''));
        }).then(function () {
            loading = false;
            paint();
        });
    }

    function bind() {
        if (bind.done) return;
        bind.done = true;
        var refresh = document.getElementById('cust-refresh');
        if (refresh) refresh.onclick = function () { loadSheet(); };
        var search = document.getElementById('cust-search');
        if (search) {
            search.oninput = function () {
                searchQ = search.value || '';
                paintUsers();
            };
        }
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
            return;
        }
        bind();
        paint();
        var custOpen = document.getElementById('cust-screen');
        if (custOpen && custOpen.classList.contains('active-screen')) {
            if (!applyChrome.fetched || applyChrome.stale) {
                applyChrome.fetched = true;
                applyChrome.stale = false;
                loadSheet();
            }
        } else if (!applyChrome.fetched) {
            applyChrome.fetched = true;
            loadSheet();
        }
    }

    function open() {
        applyChrome.stale = true;
        applyChrome();
        if (typeof root.changeTab === 'function') {
            root.changeTab('cust', document.getElementById('nav-cust'));
        } else if (typeof root.showScreen === 'function') {
            root.showScreen('cust');
        }
    }

    root.REEDCustomers = {
        applyChrome: applyChrome,
        open: open,
        loadSheet: loadSheet,
        soldMatrix: soldMatrix,
        liveMatrix: liveMatrix,
        currentUnlocks: currentUnlocks,
        normalizeLog: normalizeLog,
        isPaidLog: isPaidLog,
        todayYmd: todayYmd
    };
})(typeof window !== 'undefined' ? window : globalThis);
