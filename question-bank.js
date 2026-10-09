/* REED admin — read-only question bank over quizzes/*.json (not Google Sheets). */
(function (root) {
    var INDEX_URL = './quizzes/admin-index.json';
    var PAGE = 20;
    var SUB_LABEL = {
        phy: 'Physics', chem: 'Chemistry', bio: 'Biology', eco: 'Economics',
        math: 'Maths', en: 'English', mm: 'Myanmar', other: 'Other'
    };
    var ISSUE_LABEL = {
        unreadable: 'File will not parse',
        not_array: 'File is not a question list',
        not_object: 'Item is not an object',
        missing_text: 'Missing question text',
        missing_type: 'Missing type',
        missing_answer: 'Missing correct answer',
        bad_options: 'Incomplete multiple-choice options',
        bad_answer: 'Correct answer does not match options',
        duplicate_in_file: 'Duplicate inside file',
        duplicate_cross_file: 'Duplicate across files'
    };

    var indexData = null;
    var indexErr = '';
    var loadingIndex = false;
    var tab = 'overview';
    var bound = false;
    var page = 0;
    var loaded = [];
    var loadMsg = '';
    var preview = null;
    var whoami = { checked: false, admin: false, reason: '' };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function quizHtml(s) {
        var raw = String(s == null ? '' : s)
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/\son\w+\s*=/gi, ' data-dropped=');
        return typeof root.formatQuizMath === 'function' ? root.formatQuizMath(raw) : esc(raw);
    }

    function clientAdmin() {
        return typeof root.isAppAdmin === 'function' && root.isAppAdmin();
    }

    function bounceIfNeeded() {
        var screen = document.getElementById('bank-screen');
        if (screen && screen.classList.contains('active-screen') && !clientAdmin()) {
            if (typeof root.goTab === 'function') root.goTab('home');
            else if (typeof root.changeTab === 'function') {
                var home = document.querySelector('.nav-item[data-tab="home"]');
                root.changeTab('home', home);
            }
        }
    }

    function applyChrome() {
        var on = clientAdmin();
        document.body.classList.toggle('admin-role', !!on);
        var nav = document.getElementById('nav-bank');
        if (nav) nav.hidden = !on;
        if (!on) bounceIfNeeded();
        if (on) bind();
    }

    function workerUrl() {
        var base = typeof root.REED_BOT_WORKER === 'string' ? root.REED_BOT_WORKER : '';
        return String(base || '').replace(/\/$/, '');
    }

    function initDataString() {
        var tg = root.Telegram && root.Telegram.WebApp;
        if (tg && tg.initData) return String(tg.initData);
        try {
            return sessionStorage.getItem('reed_tg_init') || '';
        } catch (e) {
            return '';
        }
    }

    function checkWhoami() {
        var url = workerUrl();
        var initData = initDataString();
        whoami = { checked: false, admin: false, reason: '' };
        paintAuth();
        if (!url) {
            whoami = { checked: true, admin: false, reason: 'no_worker' };
            paintAuth();
            return Promise.resolve(whoami);
        }
        if (!initData) {
            whoami = { checked: true, admin: false, reason: 'no_initdata' };
            paintAuth();
            return Promise.resolve(whoami);
        }
        return fetch(url + '/admin/whoami', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: initData })
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (body) {
                whoami = {
                    checked: true,
                    admin: !!(body && body.ok && body.admin),
                    reason: (body && body.error) || (res.ok ? '' : 'http_' + res.status)
                };
                paintAuth();
                return whoami;
            });
        }).catch(function () {
            whoami = { checked: true, admin: false, reason: 'network' };
            paintAuth();
            return whoami;
        });
    }

    function paintAuth() {
        var el = document.getElementById('bank-auth');
        if (!el) return;
        if (!whoami.checked) {
            el.textContent = 'Checking server admin session…';
            return;
        }
        if (whoami.admin) {
            el.textContent = 'Server confirmed this Telegram account is an admin. Question writes stay disabled.';
            return;
        }
        if (whoami.reason === 'no_initdata') {
            el.textContent = 'No Telegram initData. Open the Mini App from @reededucation_bot for a server-side admin check.';
            return;
        }
        if (whoami.reason === 'no_worker' || whoami.reason === 'network') {
            el.textContent = 'Server admin check is unavailable. The Bank tab is still client-gated like Post/Cust. Writes stay off.';
            return;
        }
        el.textContent = 'Server did not confirm admin. Read-only preview of public quiz JSON only.';
    }

    function loadIndex(force) {
        if (indexData && !force) return Promise.resolve(indexData);
        if (loadingIndex) return Promise.resolve(indexData);
        loadingIndex = true;
        indexErr = '';
        paint();
        return fetch(INDEX_URL).then(function (res) {
            if (!res.ok) throw new Error('index HTTP ' + res.status);
            return res.json();
        }).then(function (data) {
            indexData = data;
            loadingIndex = false;
            paint();
            return data;
        }).catch(function (err) {
            loadingIndex = false;
            indexErr = (err && err.message) || 'Could not load question index';
            paint();
            return null;
        });
    }

    function bind() {
        if (bound) return;
        bound = true;
        document.querySelectorAll('#bank-tabs .bank-tab').forEach(function (btn) {
            btn.onclick = function () {
                tab = btn.getAttribute('data-bank-tab') || 'overview';
                page = 0;
                paint();
                if (tab === 'bank') searchBank();
            };
        });
        var go = document.getElementById('bank-search-go');
        if (go) go.onclick = function () { page = 0; searchBank(); };
        ['bank-grade', 'bank-subject', 'bank-kind', 'bank-q'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener(id === 'bank-q' ? 'keydown' : 'change', function (ev) {
                if (id === 'bank-q' && ev.key !== 'Enter') return;
                page = 0;
                searchBank();
            });
        });
        var prev = document.getElementById('bank-prev');
        var next = document.getElementById('bank-next');
        if (prev) prev.onclick = function () { if (page > 0) { page--; paintBankList(); } };
        if (next) next.onclick = function () {
            if ((page + 1) * PAGE < loaded.length) { page++; paintBankList(); }
        };
        var close = document.getElementById('bank-preview-close');
        if (close) close.onclick = function () { preview = null; paintPreview(); };
        var validate = document.getElementById('bank-validate');
        if (validate) validate.onclick = function () { runDraftValidate(); };
        var save = document.getElementById('bank-save');
        if (save) save.onclick = function () { refuseWrite(); };
        var draftType = document.getElementById('bank-draft-type');
        if (draftType) draftType.onchange = syncDraftFields;
        syncDraftFields();
    }

    function setTabChrome() {
        document.querySelectorAll('#bank-tabs .bank-tab').forEach(function (btn) {
            btn.classList.toggle('on', btn.getAttribute('data-bank-tab') === tab);
        });
        ['overview', 'bank', 'health', 'draft'].forEach(function (name) {
            var pane = document.getElementById('bank-pane-' + name);
            if (pane) pane.hidden = tab !== name;
        });
    }

    function kpi(label, value, note) {
        return '<div class="cust-kpi"><div class="cust-kpi-v">' + esc(value) + '</div><p class="cust-kpi-l">' + esc(label) + (note ? '<span>' + esc(note) + '</span>' : '') + '</p></div>';
    }

    function paintOverview() {
        var box = document.getElementById('bank-overview');
        if (!box) return;
        if (loadingIndex) { box.innerHTML = '<p class="post-help">Loading index…</p>'; return; }
        if (indexErr) { box.innerHTML = '<p class="bank-err">' + esc(indexErr) + '</p>'; return; }
        if (!indexData) { box.innerHTML = '<p class="post-help">No index yet.</p>'; return; }
        var t = indexData.totals || {};
        var html = '<div class="cust-kpis">';
        html += kpi('Questions', t.questions || 0, 'from ' + (t.files || 0) + ' JSON files');
        html += kpi('Unreadable files', t.unreadable || 0, 'not counted in question totals');
        html += kpi('Health flags', t.issueRows || 0, t.issuesCapped ? 'sample list capped; count is complete' : 'from the generated index');
        html += kpi('Generated', (indexData.generated || '').replace('T', ' ').replace('Z', ' UTC'), 'rebuild with tools/build-admin-index.py');
        html += '</div>';
        html += '<p class="post-help">Questions are <b>quizzes/*.json</b> in git. Google Sheets holds paid users and scores, not the question bank. Identity is file path + index — items have no <code>id</code> field.</p>';
        html += '<p class="post-label">BY SUBJECT</p><table class="cust-table"><thead><tr><th>Subject</th><th class="num">Files</th><th class="num">Questions</th></tr></thead><tbody>';
        Object.keys(indexData.bySubject || {}).sort().forEach(function (k) {
            var row = indexData.bySubject[k];
            html += '<tr><td>' + esc(SUB_LABEL[k] || k) + '</td><td class="num">' + (row.files || 0) + '</td><td class="num">' + (row.questions || 0) + '</td></tr>';
        });
        html += '</tbody></table>';
        html += '<p class="post-label">BY TYPE</p><table class="cust-table"><thead><tr><th>Type</th><th class="num">Questions</th></tr></thead><tbody>';
        Object.keys(indexData.byType || {}).sort().forEach(function (k) {
            html += '<tr><td>' + esc(k) + '</td><td class="num">' + indexData.byType[k] + '</td></tr>';
        });
        html += '</tbody></table>';
        html += '<p class="post-label">TOP CHAPTERS</p><table class="cust-table"><thead><tr><th>Grade</th><th>Subject</th><th>Chapter</th><th class="num">Questions</th></tr></thead><tbody>';
        (indexData.byChapter || []).slice(0, 15).forEach(function (row) {
            html += '<tr><td>' + row.grade + '</td><td>' + esc(SUB_LABEL[row.subject] || row.subject) + '</td><td>' + esc(row.chapter) + '</td><td class="num">' + row.questions + '</td></tr>';
        });
        html += '</tbody></table>';
        box.innerHTML = html;
    }

    function paintHealth() {
        var box = document.getElementById('bank-health');
        if (!box) return;
        if (loadingIndex) { box.innerHTML = '<p class="post-help">Loading index…</p>'; return; }
        if (indexErr) { box.innerHTML = '<p class="bank-err">' + esc(indexErr) + '</p>'; return; }
        if (!indexData) { box.innerHTML = '<p class="post-help">No index yet.</p>'; return; }
        var counts = indexData.issueCounts || {};
        if (!Object.keys(counts).length) {
            (indexData.issues || []).forEach(function (iss) {
                counts[iss.code] = (counts[iss.code] || 0) + 1;
            });
        }
        var html = '<p class="post-help">' + esc(indexData.idScheme || '') + '. Duplicate checks use type + question text + correct answer, not a stored id.</p>';
        html += '<table class="cust-table"><thead><tr><th>Check</th><th class="num">Count</th></tr></thead><tbody>';
        Object.keys(ISSUE_LABEL).forEach(function (code) {
            html += '<tr><td>' + esc(ISSUE_LABEL[code]) + '</td><td class="num">' + (counts[code] || 0) + '</td></tr>';
        });
        html += '</tbody></table>';
        if (indexData.totals && indexData.totals.issuesCapped) {
            html += '<p class="post-help">Flagged-item sample is capped (' + esc(indexData.totals.issuesListed || 0) + ' listed). Counts in the table are complete.</p>';
        }
        html += '<p class="post-label">FLAGGED ITEMS</p>';
        var rows = indexData.issues || [];
        if (!rows.length) html += '<p class="post-help">No flags in this index.</p>';
        rows.slice(0, 80).forEach(function (iss) {
            var id = iss.path + '#' + (iss.i < 0 ? 'file' : iss.i);
            html += '<div class="bank-issue"><b>' + esc(ISSUE_LABEL[iss.code] || iss.code) + '</b><span>' + esc(id) + '</span><span>' + esc(iss.detail || '') + '</span></div>';
        });
        box.innerHTML = html;
    }

    function matchingFiles() {
        if (!indexData || !indexData.files) return [];
        var grade = document.getElementById('bank-grade').value;
        var subject = document.getElementById('bank-subject').value;
        var kind = document.getElementById('bank-kind').value;
        return indexData.files.filter(function (f) {
            if (grade && String(f.grade) !== grade) return false;
            if (subject && f.subject !== subject) return false;
            if (kind && f.kind !== kind) return false;
            return true;
        });
    }

    function itemId(file, i) {
        return file + '#' + i;
    }

    function searchBank() {
        var q = (document.getElementById('bank-q').value || '').trim().toLowerCase();
        var files = matchingFiles();
        loadMsg = '';
        loaded = [];
        paintBankList();
        if (!files.length) {
            loadMsg = 'No files match those filters.';
            paintBankList();
            return;
        }
        if (!q && files.length > 12) {
            loadMsg = 'Add search text, or narrow subject/type — ' + files.length + ' files match.';
            paintBankList();
            return;
        }
        var take = files.slice(0, 24);
        loadMsg = 'Loading ' + take.length + ' file' + (take.length === 1 ? '' : 's') + '…';
        paintBankList();
        Promise.all(take.map(function (f) {
            return fetch('./' + f.path).then(function (res) {
                if (!res.ok) return { file: f, err: 'HTTP ' + res.status, items: [] };
                return res.json().then(function (items) {
                    return { file: f, items: Array.isArray(items) ? items : [] };
                }).catch(function () {
                    return { file: f, err: 'invalid JSON', items: [] };
                });
            }).catch(function () {
                return { file: f, err: 'network', items: [] };
            });
        })).then(function (packs) {
            var out = [];
            packs.forEach(function (pack) {
                pack.items.forEach(function (item, i) {
                    if (!item || typeof item !== 'object') return;
                    var text = String(item.q || item.title || '');
                    var id = itemId(pack.file.path, i);
                    if (q && text.toLowerCase().indexOf(q) === -1 && id.toLowerCase().indexOf(q) === -1) return;
                    out.push({
                        id: id,
                        file: pack.file.path,
                        i: i,
                        type: item.type || '',
                        q: text,
                        c: item.c,
                        a: item.a,
                        e: item.e,
                        grade: pack.file.grade,
                        subject: pack.file.subject,
                        kind: pack.file.kind
                    });
                });
            });
            loaded = out;
            loadMsg = out.length ? '' : 'No questions matched.';
            if (take.length < files.length) {
                loadMsg = (loadMsg ? loadMsg + ' ' : '') + 'Showing first ' + take.length + ' of ' + files.length + ' files.';
            }
            page = 0;
            paintBankList();
        });
    }

    function paintBankList() {
        var list = document.getElementById('bank-list');
        var meta = document.getElementById('bank-list-meta');
        if (meta) meta.textContent = loadMsg || (loaded.length ? loaded.length + ' shown' : '');
        if (!list) return;
        if (!loaded.length) {
            list.innerHTML = '<p class="post-help">' + esc(loadMsg || 'Choose a subject and search.') + '</p>';
            return;
        }
        var start = page * PAGE;
        var slice = loaded.slice(start, start + PAGE);
        list.innerHTML = slice.map(function (row) {
            return '<button type="button" class="bank-row" data-id="' + esc(row.id) + '">' +
                '<b>' + esc(row.q || '(no text)') + '</b>' +
                '<span>' + esc(row.id) + ' · ' + esc(row.type || '—') + ' · G' + row.grade + ' ' + esc(row.subject) + '</span>' +
                '</button>';
        }).join('');
        list.querySelectorAll('.bank-row').forEach(function (btn) {
            btn.onclick = function () {
                var id = btn.getAttribute('data-id');
                preview = loaded.filter(function (r) { return r.id === id; })[0] || null;
                paintPreview();
            };
        });
        var prev = document.getElementById('bank-prev');
        var next = document.getElementById('bank-next');
        if (prev) prev.disabled = page <= 0;
        if (next) next.disabled = (page + 1) * PAGE >= loaded.length;
    }

    function paintPreview() {
        var box = document.getElementById('bank-preview');
        if (!box) return;
        if (!preview) { box.hidden = true; box.innerHTML = ''; return; }
        box.hidden = false;
        var opts = '';
        if (Array.isArray(preview.a)) {
            opts = '<ol class="bank-opts">' + preview.a.map(function (a, i) {
                var mark = (preview.c === i || String(preview.c) === String(i) || String(preview.c) === String(a)) ? ' class="on"' : '';
                return '<li' + mark + '>' + quizHtml(a) + '</li>';
            }).join('') + '</ol>';
        }
        box.innerHTML = '<div class="bank-preview-card">' +
            '<div class="bank-preview-head"><span>' + esc(preview.id) + '</span><button type="button" class="btn" id="bank-preview-close">Close</button></div>' +
            '<div class="bank-q">' + quizHtml(preview.q) + '</div>' +
            opts +
            '<p class="post-help">Answer: ' + esc(preview.c == null ? '—' : String(preview.c).slice(0, 120)) + '</p>' +
            (preview.e ? '<div class="bank-e">' + quizHtml(preview.e) + '</div>' : '') +
            '</div>';
        var close = document.getElementById('bank-preview-close');
        if (close) close.onclick = function () { preview = null; paintPreview(); };
        if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([box]).catch(function () {});
    }

    function syncDraftFields() {
        var type = (document.getElementById('bank-draft-type') || {}).value || 'mcq';
        var opts = document.getElementById('bank-draft-options');
        if (opts) opts.hidden = type !== 'mcq';
    }

    function draftObject() {
        var type = (document.getElementById('bank-draft-type') || {}).value || 'mcq';
        var q = ((document.getElementById('bank-draft-q') || {}).value || '').trim();
        var cRaw = ((document.getElementById('bank-draft-c') || {}).value || '').trim();
        var e = ((document.getElementById('bank-draft-e') || {}).value || '').trim();
        var obj = { type: type, q: q };
        if (e) obj.e = e;
        if (type === 'mcq') {
            var lines = ((document.getElementById('bank-draft-a') || {}).value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
            obj.a = lines;
            if (/^\d+$/.test(cRaw)) obj.c = parseInt(cRaw, 10);
            else obj.c = cRaw;
        } else if (type === 'tf') {
            obj.c = /^(true|1|မှန်)$/i.test(cRaw) ? 'true' : (/^(false|0|မှား)$/i.test(cRaw) ? 'false' : cRaw);
        } else {
            obj.c = cRaw;
        }
        return obj;
    }

    function validateQuestion(obj) {
        var errs = [];
        if (!obj || typeof obj !== 'object') return ['Question must be an object'];
        if (!String(obj.q || '').trim()) errs.push('Question text is required');
        var type = String(obj.type || '').trim();
        if (!type) errs.push('Type is required');
        if (type === 'mcq') {
            if (!Array.isArray(obj.a) || obj.a.length < 2) errs.push('MCQ needs at least two options');
            if (obj.c === '' || obj.c == null) errs.push('Correct answer is required');
            else if (!mcqOk(obj)) errs.push('Correct answer must be an option index or matching option text');
        } else if (type === 'tf' || type === 'blank') {
            if (obj.c === '' || obj.c == null) errs.push('Correct answer is required');
        }
        return errs;
    }

    function mcqOk(obj) {
        if (!Array.isArray(obj.a)) return false;
        if (typeof obj.c === 'number') return obj.c >= 0 && obj.c < obj.a.length;
        var s = String(obj.c);
        if (/^\d+$/.test(s) && parseInt(s, 10) < obj.a.length) return true;
        return obj.a.some(function (a) { return String(a) === s; });
    }

    function runDraftValidate() {
        var out = document.getElementById('bank-draft-msg');
        var errs = validateQuestion(draftObject());
        if (!out) return;
        if (errs.length) {
            out.className = 'bank-err';
            out.textContent = errs.join(' · ');
        } else {
            out.className = 'bank-ok';
            out.textContent = 'Looks valid for the existing JSON format. Save is still blocked.';
        }
    }

    function refuseWrite() {
        var out = document.getElementById('bank-draft-msg');
        var errs = validateQuestion(draftObject());
        if (errs.length) {
            if (out) { out.className = 'bank-err'; out.textContent = errs.join(' · '); }
            return;
        }
        var url = workerUrl();
        var initData = initDataString();
        if (!url || !initData) {
            if (out) {
                out.className = 'bank-err';
                out.textContent = 'Save refused: no server-side Telegram session. Writes are not stored in Sheets or git from this form.';
            }
            return;
        }
        fetch(url + '/admin/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: initData, action: 'saveQuestion', question: draftObject() })
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (body) {
                if (out) {
                    out.className = 'bank-err';
                    out.textContent = (body && body.error) || ('Save refused HTTP ' + res.status);
                }
            });
        }).catch(function () {
            if (out) {
                out.className = 'bank-err';
                out.textContent = 'Save refused (network). Question files were not changed.';
            }
        });
    }

    function paint() {
        setTabChrome();
        paintAuth();
        paintOverview();
        paintHealth();
        paintPreview();
    }

    function open() {
        applyChrome();
        if (!clientAdmin()) return;
        bind();
        paint();
        loadIndex();
        checkWhoami();
    }

    root.REEDQuestionBank = {
        applyChrome: applyChrome,
        open: open,
        bind: bind,
        validateQuestion: validateQuestion,
        loadIndex: loadIndex
    };
})(typeof window !== 'undefined' ? window : this);
