/* REED admin Post tab — TikTok Q/A quiz slides. */
(function (root) {
    var W = 1080;
    var H = 1920;
    var BG = '#0B0F19';
    var CARD = '#162235';
    var CYAN = '#00D5FF';
    var WHITE = '#FFFFFF';
    var MUTED = '#94A3B8';
    var OK = '#22C55E';
    var LETTERS = 'ABCD';

    var SUBS = [
        { id: 'phy', name: 'Physics', short: 'PHY' },
        { id: 'chem', name: 'Chemistry', short: 'CHEM' },
        { id: 'bio', name: 'Biology', short: 'BIO' },
        { id: 'eco', name: 'Economy', short: 'ECO' },
        { id: 'math', name: 'Maths', short: 'MATH' },
        { id: 'en', name: 'English', short: 'EN' },
        { id: 'mm', name: 'Myanmar', short: 'MM' }
    ];
    var TYPES = [
        { id: 'MCQ', label: 'MCQ', file: 'MCQ' },
        { id: 'Fill_Blank', label: 'Blank', file: 'Fill_Blank' },
        { id: 'True_False', label: 'T / F', file: 'True_False' }
    ];

    var state = {
        grade: 12,
        sub: 'phy',
        chapter: 1,
        type: 'MCQ',
        count: 5,
        slides: []
    };

    function subMeta(id) {
        for (var i = 0; i < SUBS.length; i++) if (SUBS[i].id === id) return SUBS[i];
        return { id: id, name: id, short: id.toUpperCase() };
    }

    function gradeCfg(grade) {
        if (typeof root.getGradeCfgFor === 'function') return root.getGradeCfgFor(grade);
        return (root.GRADE_CONFIG && root.GRADE_CONFIG[grade]) || (root.GRADE_CONFIG && root.GRADE_CONFIG[12]) || {};
    }

    function chapterCount(grade, subId) {
        var cfg = gradeCfg(grade);
        var list = (cfg && cfg.subjects) || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === subId) {
                if (subId === 'en') return list[i].units || cfg.enUnits || 12;
                if (typeof list[i].chapters === 'number') return list[i].chapters;
            }
        }
        return 6;
    }

    function skipChapters(grade, subId) {
        var cfg = gradeCfg(grade);
        var list = (cfg && cfg.subjects) || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === subId) return list[i].skipChapters || [];
        }
        return [];
    }

    function mmFiles(grade) {
        return (gradeCfg(grade).mmDailyFiles || []).slice();
    }

    function typesFor(subId) {
        if (subId === 'math') return [{ id: 'MCQ', label: '1 Mark', file: '1_Mark' }];
        if (subId === 'en') return [{ id: 'MCQ', label: 'MCQ', file: 'mcq' }];
        if (subId === 'mm') return [{ id: 'MCQ', label: 'အမှန်ရွေး', file: 'အမှန်ရွေး' }];
        return TYPES.slice();
    }

    function fileName() {
        var sub = state.sub;
        var ch = state.chapter;
        var type = currentType();
        if (sub === 'en') return 'en_unit' + ch + '_mcq';
        if (sub === 'mm') return mmFiles(state.grade)[ch - 1] || mmFiles(state.grade)[0];
        if (sub === 'math') return 'math_Chapter_' + ch + '_1_Mark';
        return sub + '_Chapter_' + ch + '_' + type.file;
    }

    function currentType() {
        var list = typesFor(state.sub);
        for (var i = 0; i < list.length; i++) if (list[i].id === state.type) return list[i];
        return list[0];
    }

    function quizPath(grade, name) {
        var cfg = gradeCfg(grade);
        var prefix = cfg.filePrefix || '';
        var folder = cfg.quizFolder || '';
        var base = String(name || '').replace(/^(g10_|g11_|G10_|G11_)/, '');
        var prefixed = prefix + base;
        if (!folder) return './quizzes/' + prefixed + '.json';
        return './quizzes/' + folder + '/' + prefixed + '.json';
    }

    function quizPaths(grade, name) {
        var cfg = gradeCfg(grade);
        var prefix = cfg.filePrefix || '';
        var folder = cfg.quizFolder || '';
        var base = String(name || '').replace(/^(g10_|g11_|G10_|G11_)/, '');
        var out = [quizPath(grade, name)];
        function add(p) { if (p && out.indexOf(p) === -1) out.push(p); }
        if (folder) add('./quizzes/' + folder + '/' + base + '.json');
        if (prefix) add('./quizzes/' + prefix + base + '.json');
        add('./quizzes/' + base + '.json');
        return out;
    }

    function loadQuizJson(grade, name) {
        var urls = quizPaths(grade, name);
        var i = 0;
        function next() {
            if (i >= urls.length) return Promise.reject(new Error('missing'));
            var url = urls[i++];
            return fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'cb=' + Date.now()).then(function (res) {
                if (!res.ok) return next();
                return res.json();
            }, next);
        }
        return next();
    }

    function cleanLatex(raw) {
        var s = String(raw == null ? '' : raw);
        s = s.replace(/\$\$([\s\S]+?)\$\$/g, ' $1 ');
        s = s.replace(/\$([^$]+)\$/g, '$1');
        s = s.replace(/\\\(([\s\S]+?)\\\)/g, '$1');
        s = s.replace(/\\\[([\s\S]+?)\\\]/g, '$1');
        s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
        s = s.replace(/\\mathrm\{([^}]+)\}/g, '$1');
        s = s.replace(/\\text\{([^}]+)\}/g, '$1');
        s = s.replace(/\\left|\\right/g, '');
        s = s.replace(/\\infty/g, '∞').replace(/\\times/g, '×').replace(/\\div/g, '÷');
        s = s.replace(/\\pm/g, '±').replace(/\\cdot/g, '·').replace(/\\circ/g, '°');
        s = s.replace(/\\rightarrow|\\to/g, '→').replace(/\\leq/g, '≤').replace(/\\geq/g, '≥');
        s = s.replace(/\\neq/g, '≠').replace(/\\approx/g, '≈');
        s = s.replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\gamma/g, 'γ');
        s = s.replace(/\\theta/g, 'θ').replace(/\\omega/g, 'ω').replace(/\\pi/g, 'π');
        s = s.replace(/\\Delta/g, 'Δ').replace(/\\lambda/g, 'λ');
        s = s.replace(/\\,/g, ' ').replace(/\\;/g, ' ').replace(/\\!/g, '');
        s = s.replace(/\\([a-zA-Z]+)/g, '$1');
        s = s.replace(/[{}]/g, '');
        s = s.replace(/_/g, '').replace(/\^/g, '');
        return s.replace(/\s+/g, ' ').trim();
    }

    function shufflePick(arr, n) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a.slice(0, Math.min(n, a.length));
    }

    function normalizeQ(raw) {
        var type = String(raw && raw.type || '').toLowerCase();
        var q = cleanLatex(raw && raw.q);
        var e = cleanLatex(raw && raw.e);
        if (type === 'mcq' || Array.isArray(raw && raw.a)) {
            var opts = (raw.a || []).map(cleanLatex);
            var ci = parseInt(raw.c, 10);
            if (isNaN(ci) || ci < 0 || ci >= opts.length) ci = 0;
            return { kind: 'mcq', q: q, options: opts, correct: ci, e: e };
        }
        if (type === 'tf' || type === 'true_false' || type === 'truefalse') {
            var tf = String(raw.c).toLowerCase();
            var isTrue = tf === 'true' || tf === '1' || raw.c === true || raw.c === 1;
            return { kind: 'tf', q: q, correct: isTrue, e: e };
        }
        var ans = '';
        if (raw && raw.c != null && !Array.isArray(raw.c)) ans = raw.c;
        else if (raw && typeof raw.a === 'string') ans = raw.a;
        return { kind: 'blank', q: q, correct: cleanLatex(ans), e: e };
    }

    function wrapLines(ctx, text, maxW, maxLines) {
        text = String(text || '');
        var words = text.split(/\s+/);
        var lines = [];
        var cur = '';
        function flush() {
            if (cur) { lines.push(cur); cur = ''; }
        }
        if (words.length === 1 && words[0].length > 28) {
            var s = words[0];
            while (s.length) {
                var take = s.length;
                while (take > 4 && ctx.measureText(s.slice(0, take)).width > maxW) take--;
                lines.push(s.slice(0, take));
                s = s.slice(take);
                if (maxLines && lines.length >= maxLines) break;
            }
            return lines;
        }
        for (var i = 0; i < words.length; i++) {
            var next = cur ? cur + ' ' + words[i] : words[i];
            if (ctx.measureText(next).width > maxW && cur) {
                flush();
                cur = words[i];
            } else cur = next;
        }
        flush();
        if (maxLines && lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
            var last = lines[lines.length - 1];
            while (ctx.measureText(last + '…').width > maxW && last.length > 2) last = last.slice(0, -1);
            lines[lines.length - 1] = last + '…';
        }
        return lines;
    }

    function fillRound(ctx, x, y, w, h, r, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
    }

    function slideBase(kind, idx, total, meta) {
        var c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        var ctx = c.getContext('2d');
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = CYAN;
        ctx.fillRect(0, 0, W, 14);
        ctx.fillRect(0, H - 14, W, 14);

        ctx.fillStyle = CYAN;
        ctx.font = '800 42px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('REED', 72, 90);
        ctx.fillStyle = MUTED;
        ctx.font = '700 28px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(kind === 'answer' ? 'ANSWER' : 'QUIZ', W - 72, 88);

        ctx.textAlign = 'left';
        ctx.fillStyle = WHITE;
        ctx.font = '800 36px Inter, system-ui, sans-serif';
        ctx.fillText(meta.line, 72, 160);
        ctx.fillStyle = MUTED;
        ctx.font = '700 26px Inter, system-ui, sans-serif';
        ctx.fillText((kind === 'answer' ? 'Answer  ' : 'Question  ') + idx + ' / ' + total, 72, 208);

        ctx.fillStyle = MUTED;
        ctx.font = '700 24px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(kind === 'answer' ? 'REED Education' : 'REED Education  ·  swipe for answer', W / 2, H - 52);
        ctx.textAlign = 'left';
        return { c: c, ctx: ctx };
    }

    function drawQuestion(q, idx, total, meta) {
        var slide = slideBase('question', idx, total, meta);
        var ctx = slide.ctx;
        var y = 250;
        fillRound(ctx, 56, y, W - 112, q.kind === 'mcq' ? 520 : 640, 28, CARD);
        ctx.fillStyle = WHITE;
        ctx.font = '700 40px "Noto Sans Myanmar","Myanmar Text",Padauk,Inter,sans-serif';
        var qLines = wrapLines(ctx, q.q, W - 200, q.kind === 'mcq' ? 8 : 12);
        var ty = y + 70;
        qLines.forEach(function (ln) {
            ctx.fillText(ln, 88, ty);
            ty += 52;
        });

        if (q.kind === 'mcq') {
            var start = 820;
            q.options.forEach(function (opt, i) {
                var oy = start + i * 150;
                fillRound(ctx, 56, oy, W - 112, 128, 24, CARD);
                ctx.fillStyle = CYAN;
                ctx.font = '800 40px Inter, sans-serif';
                ctx.fillText(LETTERS[i] || String(i + 1), 88, oy + 80);
                ctx.fillStyle = WHITE;
                ctx.font = '700 34px Inter, "Noto Sans Myanmar", sans-serif';
                var ol = wrapLines(ctx, opt, W - 280, 2);
                ctx.fillText(ol[0] || '', 168, oy + 58);
                if (ol[1]) ctx.fillText(ol[1], 168, oy + 100);
            });
        } else if (q.kind === 'tf') {
            fillRound(ctx, 56, 980, 450, 140, 24, CARD);
            fillRound(ctx, 574, 980, 450, 140, 24, CARD);
            ctx.fillStyle = WHITE;
            ctx.font = '800 44px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('TRUE', 281, 1068);
            ctx.fillText('FALSE', 799, 1068);
            ctx.textAlign = 'left';
        } else {
            ctx.fillStyle = MUTED;
            ctx.font = '700 30px Inter, sans-serif';
            ctx.fillText('Fill the blank', 72, 980);
            fillRound(ctx, 56, 1020, W - 112, 160, 24, CARD);
            ctx.fillStyle = CYAN;
            ctx.font = '800 40px Inter, sans-serif';
            ctx.fillText('_____', 88, 1118);
        }
        return slide.c;
    }

    function drawAnswer(q, idx, total, meta) {
        var slide = slideBase('answer', idx, total, meta);
        var ctx = slide.ctx;
        fillRound(ctx, 56, 250, W - 112, 420, 28, CARD);
        ctx.fillStyle = MUTED;
        ctx.font = '700 26px Inter, sans-serif';
        ctx.fillText('Correct answer', 88, 310);
        ctx.fillStyle = OK;
        ctx.font = '800 52px Inter, "Noto Sans Myanmar", sans-serif';
        var ans = '';
        if (q.kind === 'mcq') {
            ans = (LETTERS[q.correct] || '') + '   ' + (q.options[q.correct] || '');
        } else if (q.kind === 'tf') {
            ans = q.correct ? 'TRUE' : 'FALSE';
        } else {
            ans = q.correct || '—';
        }
        var aLines = wrapLines(ctx, ans, W - 200, 4);
        var ay = 390;
        aLines.forEach(function (ln) {
            ctx.fillText(ln, 88, ay);
            ay += 64;
        });

        if (q.e) {
            fillRound(ctx, 56, 720, W - 112, 980, 28, CARD);
            ctx.fillStyle = MUTED;
            ctx.font = '700 26px Inter, sans-serif';
            ctx.fillText('Why', 88, 780);
            ctx.fillStyle = WHITE;
            ctx.font = '600 34px Inter, "Noto Sans Myanmar", sans-serif';
            var eLines = wrapLines(ctx, q.e, W - 200, 18);
            var ey = 850;
            eLines.forEach(function (ln) {
                ctx.fillText(ln, 88, ey);
                ey += 46;
            });
        }
        return slide.c;
    }

    function metaLine() {
        var s = subMeta(state.sub);
        var type = currentType();
        if (state.sub === 'en') return s.short + '  ·  UNIT ' + state.chapter + '  ·  ' + type.label.toUpperCase();
        if (state.sub === 'mm') return s.short + '  ·  ' + (mmFiles(state.grade)[state.chapter - 1] || '').replace(/^mm_/, '') + '  ·  MCQ';
        return s.short + '  ·  CHAPTER ' + state.chapter + '  ·  ' + type.label.toUpperCase();
    }

    function stem() {
        return (state.sub + '-g' + state.grade + '-ch' + state.chapter + '-' + currentType().id).toLowerCase();
    }

    function canvasBlob(canvas) {
        return new Promise(function (resolve) {
            if (!canvas) return resolve(null);
            if (canvas.toBlob) canvas.toBlob(function (b) { resolve(b || null); }, 'image/png');
            else {
                try {
                    var url = canvas.toDataURL('image/png');
                    var bin = atob(url.split(',')[1]);
                    var arr = new Uint8Array(bin.length);
                    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                    resolve(new Blob([arr], { type: 'image/png' }));
                } catch (e) { resolve(null); }
            }
        });
    }

    function downloadOne(item) {
        return canvasBlob(item.canvas).then(function (blob) {
            if (!blob) return { ok: false };
            if (root.REEDTimetable && typeof root.REEDTimetable.downloadBlob === 'function') {
                var api = typeof root.timetableApi === 'function' ? root.timetableApi() : {};
                return root.REEDTimetable.downloadBlob(blob, item.name, api);
            }
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = item.name;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 2000);
            return { ok: true };
        });
    }

    function setStatus(text) {
        var el = document.getElementById('post-status');
        if (el) el.textContent = text || '';
    }

    function chipRow(id, items, selected, onPick) {
        var wrap = document.getElementById(id);
        if (!wrap) return;
        wrap.innerHTML = items.map(function (it) {
            var on = String(it.id) === String(selected) ? ' on' : '';
            return '<button type="button" class="tt-chip post-chip' + on + '" data-v="' + it.id + '">' + it.label + '</button>';
        }).join('');
        wrap.querySelectorAll('.post-chip').forEach(function (btn) {
            btn.onclick = function () { onPick(btn.getAttribute('data-v')); };
        });
    }

    function paintPickers() {
        chipRow('post-grades', [
            { id: 10, label: 'G10' }, { id: 11, label: 'G11' }, { id: 12, label: 'G12' }
        ], state.grade, function (v) {
            state.grade = parseInt(v, 10);
            paintPickers();
        });
        chipRow('post-subs', SUBS.map(function (s) {
            return { id: s.id, label: s.short };
        }), state.sub, function (v) {
            state.sub = v;
            var types = typesFor(v);
            if (!types.some(function (t) { return t.id === state.type; })) state.type = types[0].id;
            state.chapter = 1;
            paintPickers();
        });
        var types = typesFor(state.sub);
        chipRow('post-types', types.map(function (t) {
            return { id: t.id, label: t.label };
        }), state.type, function (v) {
            state.type = v;
            paintPickers();
        });
        var chs = [];
        if (state.sub === 'mm') {
            mmFiles(state.grade).forEach(function (f, i) {
                chs.push({ id: i + 1, label: f.replace(/^mm_/, '').replace(/_/g, ' ') });
            });
        } else {
            var n = chapterCount(state.grade, state.sub);
            var skip = skipChapters(state.grade, state.sub);
            var prefix = state.sub === 'en' ? 'U' : 'Ch ';
            for (var i = 1; i <= n; i++) {
                if (skip.indexOf(i) !== -1) continue;
                chs.push({ id: i, label: prefix + i });
            }
        }
        if (!chs.some(function (c) { return c.id === state.chapter; })) state.chapter = chs[0] ? chs[0].id : 1;
        chipRow('post-chs', chs, state.chapter, function (v) {
            state.chapter = parseInt(v, 10);
            paintPickers();
        });
        var countEl = document.getElementById('post-count');
        if (countEl && document.activeElement !== countEl) countEl.value = String(state.count);
    }

    function renderPreviews() {
        var box = document.getElementById('post-previews');
        if (!box) return;
        if (!state.slides.length) {
            box.innerHTML = '';
            return;
        }
        box.innerHTML = state.slides.map(function (s, i) {
            return '<div class="post-card">' +
                '<p class="post-card-label">' + (s.kind === 'answer' ? 'Answer' : 'Question') + ' ' + s.n + '</p>' +
                '<img class="post-thumb" alt="' + s.name + '">' +
                '<button type="button" class="btn post-dl-one" data-i="' + i + '">Download</button>' +
                '</div>';
        }).join('');
        box.querySelectorAll('.post-thumb').forEach(function (img, i) {
            img.src = state.slides[i].canvas.toDataURL('image/png');
        });
        box.querySelectorAll('.post-dl-one').forEach(function (btn) {
            btn.onclick = function () {
                var item = state.slides[parseInt(btn.getAttribute('data-i'), 10)];
                if (item) downloadOne(item);
            };
        });
    }

    function generate() {
        var n = parseInt((document.getElementById('post-count') || {}).value, 10);
        if (!(n >= 1 && n <= 20)) n = 5;
        state.count = n;
        var name = fileName();
        setStatus('Loading ' + name + '…');
        return loadQuizJson(state.grade, name).then(function (data) {
            if (!Array.isArray(data) || !data.length) throw new Error('empty');
            var picked = shufflePick(data, n);
            var meta = { line: metaLine() };
            var slides = [];
            picked.forEach(function (raw, i) {
                var q = normalizeQ(raw);
                var num = i + 1;
                var pad = num < 10 ? '0' + num : String(num);
                slides.push({
                    kind: 'question', n: num, name: pad + '-q-' + stem() + '.png',
                    canvas: drawQuestion(q, num, picked.length, meta)
                });
                slides.push({
                    kind: 'answer', n: num, name: pad + '-a-' + stem() + '.png',
                    canvas: drawAnswer(q, num, picked.length, meta)
                });
            });
            state.slides = slides;
            renderPreviews();
            setStatus(picked.length + ' quizzes · ' + slides.length + ' images');
            var allBtn = document.getElementById('post-dl-all');
            if (allBtn) allBtn.hidden = !slides.length;
        }).catch(function () {
            state.slides = [];
            renderPreviews();
            var allBtn = document.getElementById('post-dl-all');
            if (allBtn) allBtn.hidden = true;
            setStatus('မေးခွန်းဖိုင် မတွေ့ပါ — ' + name);
            if (root.Telegram && Telegram.WebApp && Telegram.WebApp.showAlert) {
                Telegram.WebApp.showAlert('မေးခွန်းဖိုင် မတွေ့သေးပါ: ' + name);
            }
        });
    }

    function downloadAll() {
        var list = state.slides.slice();
        if (!list.length) return Promise.resolve();
        var i = 0;
        function next() {
            if (i >= list.length) {
                setStatus('Download ' + list.length + ' images');
                return Promise.resolve();
            }
            var item = list[i++];
            setStatus('Download ' + i + ' / ' + list.length);
            return downloadOne(item).then(function () {
                return new Promise(function (r) { setTimeout(r, 350); });
            }).then(next);
        }
        return next();
    }

    function bind() {
        if (bind.done) return;
        bind.done = true;
        var countEl = document.getElementById('post-count');
        if (countEl) countEl.onchange = function () {
            var n = parseInt(countEl.value, 10);
            state.count = (n >= 1 && n <= 20) ? n : 5;
        };
        var go = document.getElementById('post-go');
        if (go) go.onclick = function () { generate(); };
        var all = document.getElementById('post-dl-all');
        if (all) all.onclick = function () { downloadAll(); };
        paintPickers();
    }

    function applyChrome() {
        var on = typeof root.isAppAdmin === 'function' && root.isAppAdmin();
        document.body.classList.toggle('admin-role', !!on);
        var tab = document.getElementById('nav-post');
        if (tab) tab.hidden = !on;
        if (!on) {
            var screen = document.getElementById('post-screen');
            if (screen && screen.classList.contains('active-screen') && typeof root.goTab === 'function') {
                root.goTab('home');
            }
        }
        if (on) bind();
    }

    function open() {
        applyChrome();
        if (typeof root.changeTab === 'function') {
            root.changeTab('post', document.getElementById('nav-post'));
        } else if (typeof root.showScreen === 'function') {
            root.showScreen('post');
        }
        paintPickers();
    }

    root.REEDQuizPost = {
        applyChrome: applyChrome,
        open: open,
        bind: bind,
        generate: generate,
        fileName: fileName,
        quizPath: quizPath,
        quizPaths: quizPaths,
        normalizeQ: normalizeQ,
        cleanLatex: cleanLatex,
        drawQuestion: drawQuestion,
        drawAnswer: drawAnswer,
        state: state
    };
})(typeof window !== 'undefined' ? window : globalThis);
