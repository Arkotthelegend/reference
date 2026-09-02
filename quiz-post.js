/* REED admin Post tab — TikTok Q/A quiz slides. */
(function (root) {
    var W = 1080;
    var H = 1080;
    var BG = '#0B0F19';
    var CARD = '#162235';
    var CARD2 = '#1B2A41';
    var CYAN = '#00D5FF';
    var WHITE = '#FFFFFF';
    var MUTED = '#94A3B8';
    var OK = '#22C55E';
    var LETTERS = 'ABCD';
    var ACCENTS = {
        phy: '#00D5FF',
        chem: '#F5A623',
        bio: '#3DDC97',
        eco: '#C084FC',
        math: '#FF5C8A',
        en: '#5B9DFF',
        mm: '#F5C542'
    };

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
        chapters: [1],
        type: 'MCQ',
        count: 5,
        slides: []
    };

    function subMeta(id) {
        for (var i = 0; i < SUBS.length; i++) if (SUBS[i].id === id) return SUBS[i];
        return { id: id, name: id, short: id.toUpperCase() };
    }

    function accentOf(sub) {
        return ACCENTS[sub] || CYAN;
    }

    function hexRgba(hex, a) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        var r = parseInt(h.slice(0, 2), 16) || 0;
        var g = parseInt(h.slice(2, 4), 16) || 0;
        var b = parseInt(h.slice(4, 6), 16) || 0;
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    function gradeCfg(grade) {
        if (typeof root.getGradeCfgFor === 'function') return root.getGradeCfgFor(grade);
        return (root.GRADE_CONFIG && root.GRADE_CONFIG[grade]) || (root.GRADE_CONFIG && root.GRADE_CONFIG[12]) || {};
    }

    function grammarTopics() {
        if (typeof root.getEnGrammarTopics === 'function') return root.getEnGrammarTopics();
        return (root.EN_GRAMMAR_TOPICS || []).slice();
    }

    function grammarTitle(id) {
        var list = grammarTopics();
        for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].title;
        return String(id || '');
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

    function subKeys(grade, subId, ch) {
        var cfg = gradeCfg(grade);
        var map = (cfg && cfg.subChapters && cfg.subChapters[subId]) || {};
        return (map['Chapter ' + ch] || []).slice();
    }

    function selectedChapters() {
        var list = (state.chapters && state.chapters.length) ? state.chapters.slice() : [];
        if (list.length && list.some(function (id) { return String(id) === String(state.chapter); })) {
            return list;
        }
        return state.chapter != null ? [state.chapter] : [1];
    }

    function setChapters(list) {
        var next = (list || []).slice();
        if (!next.length) next = [isGrammar() ? 'past_simple' : 1];
        state.chapters = next;
        state.chapter = next[0];
    }

    function coerceChIds(list) {
        return (list || []).map(function (v) {
            if (isGrammar()) return v;
            var n = parseInt(v, 10);
            return isNaN(n) ? v : n;
        });
    }

    function mmFiles(grade) {
        return (gradeCfg(grade).mmDailyFiles || []).slice();
    }

    function typesFor(subId) {
        if (subId === 'math') return [{ id: 'MCQ', label: '1 Mark', file: '1_Mark' }];
        if (subId === 'en') return [
            { id: 'MCQ', label: 'MCQ', file: 'mcq' },
            { id: 'en_init', label: 'Initial', file: 'initial_letter' },
            { id: 'en_gram', label: 'Grammar', file: '' }
        ];
        if (subId === 'mm') return [{ id: 'MCQ', label: 'အမှန်ရွေး', file: 'အမှန်ရွေး' }];
        return TYPES.slice();
    }

    function isGrammar() {
        return state.sub === 'en' && state.type === 'en_gram';
    }

    function fileNameFor(ch) {
        var sub = state.sub;
        var type = currentType();
        if (sub === 'en') {
            if (state.type === 'en_gram') return String(ch);
            if (state.type === 'en_init') return 'en_unit' + ch + '_initial_letter';
            return 'en_unit' + ch + '_mcq';
        }
        if (sub === 'mm') return mmFiles(state.grade)[ch - 1] || mmFiles(state.grade)[0];
        if (sub === 'math') return 'math_Chapter_' + ch + '_1_Mark';
        return sub + '_Chapter_' + ch + '_' + type.file;
    }

    function fileName() {
        return fileNameFor(selectedChapters()[0]);
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
        if (typeof root.isSharedEnGrammarFile === 'function' && root.isSharedEnGrammarFile(base)) {
            return './quizzes/' + base + '.json';
        }
        var prefixed = prefix + base;
        if (!folder) return './quizzes/' + prefixed + '.json';
        return './quizzes/' + folder + '/' + prefixed + '.json';
    }

    function quizPaths(grade, name) {
        var cfg = gradeCfg(grade);
        var prefix = cfg.filePrefix || '';
        var folder = cfg.quizFolder || '';
        var base = String(name || '').replace(/^(g10_|g11_|G10_|G11_)/, '');
        if (typeof root.isSharedEnGrammarFile === 'function' && root.isSharedEnGrammarFile(base)) {
            return ['./quizzes/' + base + '.json'];
        }
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

    function loadQuizJsonSoft(grade, name) {
        return loadQuizJson(grade, name).then(function (data) {
            return Array.isArray(data) ? data : [];
        }).catch(function () { return []; });
    }

    function usesSubFiles() {
        return ['phy', 'chem', 'bio', 'eco'].indexOf(state.sub) !== -1;
    }

    function loadChapterGroups(ch) {
        if (!usesSubFiles()) {
            return loadQuizJsonSoft(state.grade, fileNameFor(ch)).then(function (items) {
                return [{ group: String(ch), items: items }];
            });
        }
        var type = currentType();
        var parts = subKeys(state.grade, state.sub, ch);
        if (!parts.length) {
            return loadQuizJsonSoft(state.grade, fileNameFor(ch)).then(function (items) {
                return [{ group: String(ch), items: items }];
            });
        }
        return Promise.all(parts.map(function (p) {
            var name = state.sub + '_Chapter_' + ch + '_' + p + '_' + type.file;
            return loadQuizJsonSoft(state.grade, name).then(function (items) {
                return { group: ch + '-' + p, items: items };
            });
        })).then(function (groups) {
            if (groups.some(function (g) { return g.items.length; })) return groups;
            return loadQuizJsonSoft(state.grade, fileNameFor(ch)).then(function (items) {
                return [{ group: String(ch), items: items }];
            });
        });
    }

    function cleanLatex(raw) {
        var s = String(raw == null ? '' : raw);
        var blanks = [];
        s = s.replace(/_{3,}/g, function (m) {
            blanks.push(m);
            return '\u0000' + (blanks.length - 1) + '\u0000';
        });
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
        s = s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return blanks[Number(i)] || ''; });
        return s.replace(/\s+/g, ' ').trim();
    }

    function shufflePick(arr, n) {
        return pickSpread([arr || []], n);
    }

    function pickSpread(groups, n) {
        var buckets = (groups || []).map(function (g) {
            var a = (g || []).slice();
            for (var i = a.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var t = a[i]; a[i] = a[j]; a[j] = t;
            }
            return a;
        }).filter(function (g) { return g.length; });
        var out = [];
        var seen = {};
        function key(item) {
            return String((item && item.q) || '') + '|' + String((item && (item.c != null ? item.c : item.a)) || '');
        }
        var guard = 0;
        while (out.length < n && buckets.length && guard < n * 80) {
            guard++;
            buckets = buckets.filter(function (b) { return b.length; });
            for (var i = 0; i < buckets.length && out.length < n; i++) {
                var item = buckets[i].pop();
                var k = key(item);
                if (seen[k]) continue;
                seen[k] = 1;
                out.push(item);
            }
        }
        for (var x = out.length - 1; x > 0; x--) {
            var y = Math.floor(Math.random() * (x + 1));
            var tmp = out[x]; out[x] = out[y]; out[y] = tmp;
        }
        return out;
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
        var srcQ = String(raw && raw.q || '');
        var isBlank = type === 'blank' || type === 'fill_blank' || /_{3,}/.test(srcQ) || /_{3,}/.test(q);
        if (!isBlank && typeof ans === 'string' && ans) {
            return { kind: 'rewrite', q: q, correct: cleanLatex(ans), e: e };
        }
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

    function roundPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function fillRound(ctx, x, y, w, h, r, color) {
        ctx.fillStyle = color;
        roundPath(ctx, x, y, w, h, r);
        ctx.fill();
    }

    function strokeRound(ctx, x, y, w, h, r) {
        roundPath(ctx, x, y, w, h, r);
        ctx.stroke();
    }

    function paintCard(ctx, x, y, w, h, r, fill, accent) {
        ctx.save();
        roundPath(ctx, x, y, w, h, r);
        ctx.clip();
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        if (accent) {
            ctx.fillStyle = accent;
            ctx.fillRect(x, y, 8, h);
        }
        ctx.restore();
        ctx.strokeStyle = hexRgba('#ffffff', 0.06);
        ctx.lineWidth = 1.5;
        strokeRound(ctx, x, y, w, h, r);
    }

    function paintBlocks(ctx, accent) {
        var cell = 108;
        var gx, gy, x, y, k;
        for (gy = 0; gy < 10; gy++) {
            for (gx = 0; gx < 10; gx++) {
                x = gx * cell;
                y = gy * cell;
                k = (gx * 3 + gy * 5) % 7;
                if (k === 0) {
                    ctx.fillStyle = 'rgba(255,255,255,0.04)';
                    ctx.fillRect(x + 8, y + 8, 60, 60);
                } else if (k === 1) {
                    ctx.fillStyle = 'rgba(255,255,255,0.025)';
                    ctx.fillRect(x + 24, y + 16, 72, 32);
                } else if (k === 2) {
                    ctx.fillStyle = 'rgba(0,0,0,0.10)';
                    ctx.fillRect(x + 16, y + 28, 44, 68);
                } else if (k === 3) {
                    ctx.fillStyle = 'rgba(255,255,255,0.05)';
                    ctx.fillRect(x + 40, y + 40, 52, 52);
                } else if (k === 4) {
                    ctx.fillStyle = 'rgba(255,255,255,0.02)';
                    ctx.fillRect(x + 12, y + 48, 84, 28);
                }
            }
        }
    }

    function kindLabel(q) {
        if (q.kind === 'mcq') return 'MULTIPLE CHOICE';
        if (q.kind === 'tf') return 'TRUE OR FALSE';
        if (q.kind === 'rewrite') return 'REWRITE';
        if (/[A-Za-z]_{3,}/.test(q.q || '')) return 'INITIAL LETTER';
        return 'FILL THE BLANK';
    }

    function drawLineWithBlanks(ctx, line, x, y, accent) {
        var parts = String(line || '').split(/(_+)/);
        if (parts.length < 2) {
            ctx.fillStyle = WHITE;
            ctx.fillText(line, x, y);
            return;
        }
        var cx = x;
        parts.forEach(function (p) {
            if (!p) return;
            ctx.fillStyle = /^_+$/.test(p) ? accent : WHITE;
            ctx.fillText(p, cx, y);
            cx += ctx.measureText(p).width;
        });
    }

    function drawQuestionLines(ctx, lines, x, y, lineH, accent) {
        lines.forEach(function (ln) {
            drawLineWithBlanks(ctx, ln, x, y, accent);
            y += lineH;
        });
        return y;
    }

    function slideBase(kind, idx, total, meta) {
        var c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        var ctx = c.getContext('2d');
        var accent = (meta && meta.accent) || CYAN;

        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
        paintBlocks(ctx, accent);

        ctx.strokeStyle = hexRgba('#334155', 0.9);
        ctx.lineWidth = 2;
        strokeRound(ctx, 22, 22, W - 44, H - 44, 28);
        ctx.fillStyle = accent;
        ctx.fillRect(22, 22, W - 44, 8);
        ctx.fillRect(22, H - 30, W - 44, 8);

        ctx.fillStyle = accent;
        ctx.font = '800 32px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('REED', 56, 80);

        var pill = kind === 'answer' ? 'ANSWER' : 'QUIZ';
        var pw = kind === 'answer' ? 170 : 122;
        fillRound(ctx, W - 56 - pw, 50, pw, 42, 21, hexRgba(accent, 0.16));
        ctx.fillStyle = accent;
        ctx.font = '800 20px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pill, W - 56 - pw / 2, 78);

        fillRound(ctx, 56, 102, 84, 84, 22, accent);
        ctx.fillStyle = BG;
        ctx.font = '900 38px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(idx), 98, 156);

        ctx.textAlign = 'left';
        ctx.fillStyle = WHITE;
        ctx.font = '800 24px Inter, system-ui, sans-serif';
        ctx.fillText(meta.line, 158, 136);
        ctx.fillStyle = MUTED;
        ctx.font = '700 18px Inter, system-ui, sans-serif';
        ctx.fillText((kind === 'answer' ? 'Answer' : 'Question') + '  ' + idx + ' / ' + total, 158, 168);

        ctx.fillStyle = MUTED;
        ctx.font = '700 18px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(kind === 'answer' ? 'REED Education' : 'REED Education  ·  swipe for answer', W / 2, H - 48);
        ctx.textAlign = 'left';
        return { c: c, ctx: ctx, accent: accent };
    }

    function drawQuestion(q, idx, total, meta) {
        var slide = slideBase('question', idx, total, meta);
        var ctx = slide.ctx;
        var accent = slide.accent;
        var x = 48;
        var inner = W - 96;
        var top = 208;
        var bottom = H - 78;
        var fontFace = '"Noto Sans Myanmar","Myanmar Text",Padauk,Inter,sans-serif';

        ctx.fillStyle = hexRgba(accent, 0.16);
        fillRound(ctx, x, top, Math.min(inner, 320), 36, 18, hexRgba(accent, 0.16));
        ctx.fillStyle = accent;
        ctx.font = '800 16px Inter, sans-serif';
        ctx.fillText(kindLabel(q), x + 16, top + 24);
        top += 50;

        if (q.kind === 'mcq') {
            var n = Math.max(1, (q.options || []).length);
            var optH = n >= 4 ? 92 : 104;
            var gap = 12;
            var optsH = n * optH + (n - 1) * gap;
            var qH = bottom - top - optsH - 16;
            if (qH < 160) {
                optH = 82;
                optsH = n * optH + (n - 1) * gap;
                qH = bottom - top - optsH - 16;
            }
            paintCard(ctx, x, top, inner, qH, 22, CARD, accent);
            ctx.font = '700 40px ' + fontFace;
            var maxLines = Math.max(3, Math.floor((qH - 44) / 48));
            var qLines = wrapLines(ctx, q.q, inner - 56, maxLines);
            drawQuestionLines(ctx, qLines, x + 28, top + 52, 48, accent);
            var oy = top + qH + 16;
            q.options.forEach(function (opt, i) {
                paintCard(ctx, x, oy, inner, optH, 18, CARD2, null);
                ctx.beginPath();
                ctx.arc(x + 48, oy + optH / 2, 24, 0, Math.PI * 2);
                ctx.fillStyle = accent;
                ctx.fill();
                ctx.fillStyle = BG;
                ctx.font = '800 24px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(LETTERS[i] || String(i + 1), x + 48, oy + optH / 2 + 8);
                ctx.textAlign = 'left';
                ctx.fillStyle = WHITE;
                ctx.font = '700 32px Inter, "Noto Sans Myanmar", sans-serif';
                var ol = wrapLines(ctx, opt, inner - 140, 2);
                ctx.fillText(ol[0] || '', x + 88, oy + (ol[1] ? optH * 0.4 : optH * 0.62));
                if (ol[1]) ctx.fillText(ol[1], x + 88, oy + optH * 0.76);
                oy += optH + gap;
            });
        } else if (q.kind === 'tf') {
            var btnH = 118;
            var tfH = bottom - top - btnH - 16;
            paintCard(ctx, x, top, inner, tfH, 22, CARD, accent);
            ctx.font = '700 40px ' + fontFace;
            var tfLines = wrapLines(ctx, q.q, inner - 56, Math.max(4, Math.floor((tfH - 44) / 48)));
            drawQuestionLines(ctx, tfLines, x + 28, top + 56, 48, accent);
            var by = bottom - btnH;
            var bw = (inner - 16) / 2;
            paintCard(ctx, x, by, bw, btnH, 20, CARD2, '#22C55E');
            paintCard(ctx, x + bw + 16, by, bw, btnH, 20, CARD2, '#F87171');
            ctx.fillStyle = WHITE;
            ctx.font = '800 34px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('TRUE', x + bw / 2, by + 70);
            ctx.fillText('FALSE', x + bw + 16 + bw / 2, by + 70);
            ctx.textAlign = 'left';
        } else if (q.kind === 'rewrite') {
            paintCard(ctx, x, top, inner, bottom - top, 22, CARD, accent);
            ctx.fillStyle = MUTED;
            ctx.font = '700 20px Inter, sans-serif';
            ctx.fillText('Rewrite / complete the sentence', x + 28, top + 44);
            ctx.font = '700 38px Inter, sans-serif';
            var rLines = wrapLines(ctx, q.q, inner - 56, Math.max(6, Math.floor((bottom - top - 90) / 48)));
            drawQuestionLines(ctx, rLines, x + 28, top + 100, 48, accent);
        } else {
            var hasInline = /_{3,}/.test(q.q || '');
            var blankH = hasInline ? 0 : 118;
            var bH = bottom - top - blankH - (blankH ? 16 : 0);
            paintCard(ctx, x, top, inner, bH, 22, CARD, accent);
            ctx.font = '700 40px ' + fontFace;
            var bLines = wrapLines(ctx, q.q, inner - 56, Math.max(4, Math.floor((bH - 44) / 48)));
            drawQuestionLines(ctx, bLines, x + 28, top + 56, 48, accent);
            if (!hasInline) {
                paintCard(ctx, x, bottom - blankH, inner, blankH, 20, CARD2, accent);
                ctx.fillStyle = MUTED;
                ctx.font = '700 20px Inter, sans-serif';
                ctx.fillText('Fill the blank', x + 28, bottom - blankH + 40);
                ctx.fillStyle = accent;
                ctx.font = '800 36px Inter, sans-serif';
                ctx.fillText('_____', x + 28, bottom - 32);
            }
        }
        return slide.c;
    }

    function drawAnswer(q, idx, total, meta) {
        var slide = slideBase('answer', idx, total, meta);
        var ctx = slide.ctx;
        var accent = slide.accent;
        var x = 48;
        var inner = W - 96;
        var top = 208;
        var bottom = H - 78;
        var ansH = q.e ? 300 : Math.min(440, bottom - top);

        paintCard(ctx, x, top, inner, ansH, 24, '#10261A', OK);

        ctx.fillStyle = MUTED;
        ctx.font = '700 22px Inter, sans-serif';
        ctx.fillText('Correct answer', x + 28, top + 52);
        ctx.fillStyle = OK;
        ctx.font = '800 46px Inter, "Noto Sans Myanmar", sans-serif';
        var ans = '';
        if (q.kind === 'mcq') {
            ans = (LETTERS[q.correct] || '') + '   ' + (q.options[q.correct] || '');
        } else if (q.kind === 'tf') {
            ans = q.correct ? 'TRUE' : 'FALSE';
        } else {
            ans = q.correct || '—';
        }
        var aLines = wrapLines(ctx, ans, inner - 56, 4);
        var ay = top + 116;
        aLines.forEach(function (ln) {
            ctx.fillText(ln, x + 28, ay);
            ay += 56;
        });

        if (q.e) {
            var whyTop = top + ansH + 16;
            var whyH = bottom - whyTop;
            if (whyH > 120) {
                paintCard(ctx, x, whyTop, inner, whyH, 22, CARD, accent);
                ctx.fillStyle = MUTED;
                ctx.font = '700 20px Inter, sans-serif';
                ctx.fillText('Why', x + 28, whyTop + 44);
                ctx.fillStyle = WHITE;
                ctx.font = '600 30px Inter, "Noto Sans Myanmar", sans-serif';
                var eLines = wrapLines(ctx, q.e, inner - 56, Math.max(4, Math.floor((whyH - 70) / 40)));
                var ey = whyTop + 92;
                eLines.forEach(function (ln) {
                    ctx.fillText(ln, x + 28, ey);
                    ey += 40;
                });
            }
        }
        return slide.c;
    }

    function metaLine() {
        var s = subMeta(state.sub);
        var type = currentType();
        var cs = selectedChapters();
        if (isGrammar()) {
            if (cs.length === 1) return s.short + '  ·  GRAMMAR  ·  ' + grammarTitle(cs[0]).toUpperCase();
            return s.short + '  ·  GRAMMAR  ·  ' + cs.length + ' TOPICS';
        }
        if (state.sub === 'en' && state.type === 'en_init') {
            return s.short + '  ·  UNIT ' + cs.join(', ') + '  ·  INITIAL';
        }
        if (state.sub === 'en') return s.short + '  ·  UNIT ' + cs.join(', ') + '  ·  ' + type.label.toUpperCase();
        if (state.sub === 'mm') {
            if (cs.length === 1) return s.short + '  ·  ' + (mmFiles(state.grade)[cs[0] - 1] || '').replace(/^mm_/, '') + '  ·  MCQ';
            return s.short + '  ·  ' + cs.length + ' CATEGORIES  ·  MCQ';
        }
        return s.short + '  ·  CHAPTER ' + cs.join(', ') + '  ·  ' + type.label.toUpperCase();
    }

    function stem() {
        var cs = selectedChapters();
        if (isGrammar()) return ('en-g' + state.grade + '-' + cs.join('_') + '-grammar').toLowerCase().slice(0, 60);
        return (state.sub + '-g' + state.grade + '-ch' + cs.join('-') + '-' + currentType().id).toLowerCase();
    }

    function crc32(u8) {
        var c = 0xFFFFFFFF;
        var i, b;
        for (i = 0; i < u8.length; i++) {
            b = (c ^ u8[i]) & 0xFF;
            c = (CRC_TABLE[b] ^ (c >>> 8)) >>> 0;
        }
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    var CRC_TABLE = (function () {
        var t = new Uint32Array(256);
        var n, c, k;
        for (n = 0; n < 256; n++) {
            c = n;
            for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        return t;
    })();

    function u16(n) {
        return new Uint8Array([n & 255, (n >>> 8) & 255]);
    }

    function u32(n) {
        return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
    }

    function concatU8(chunks) {
        var n = 0, i, o = 0, out;
        for (i = 0; i < chunks.length; i++) n += chunks[i].length;
        out = new Uint8Array(n);
        for (i = 0; i < chunks.length; i++) { out.set(chunks[i], o); o += chunks[i].length; }
        return out;
    }

    function zipFiles(files) {
        var encoder = new TextEncoder();
        var locals = [];
        var centrals = [];
        var offset = 0;
        files.forEach(function (f) {
            var name = encoder.encode(String(f.name || 'file.bin'));
            var data = f.bytes || new Uint8Array(0);
            var crc = crc32(data);
            var local = concatU8([
                u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
                u32(crc), u32(data.length), u32(data.length),
                u16(name.length), u16(0), name, data
            ]);
            var central = concatU8([
                u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
                u32(crc), u32(data.length), u32(data.length),
                u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
                u32(offset), name
            ]);
            locals.push(local);
            centrals.push(central);
            offset += local.length;
        });
        var cd = concatU8(centrals);
        var eocd = concatU8([
            u32(0x06054b50), u16(0), u16(0),
            u16(files.length), u16(files.length),
            u32(cd.length), u32(offset), u16(0)
        ]);
        return new Blob([concatU8(locals.concat([cd, eocd]))], { type: 'application/zip' });
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

    function blobBytes(blob) {
        if (!blob) return Promise.resolve(new Uint8Array(0));
        if (blob.arrayBuffer) {
            return blob.arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
        }
        return new Promise(function (resolve) {
            var fr = new FileReader();
            fr.onload = function () { resolve(new Uint8Array(fr.result || [])); };
            fr.onerror = function () { resolve(new Uint8Array(0)); };
            fr.readAsArrayBuffer(blob);
        });
    }

    function fetchTimeout(url, opts, ms) {
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 20000);
        opts = opts || {};
        if (ctrl) opts.signal = ctrl.signal;
        return fetch(url, opts).then(function (res) {
            clearTimeout(timer);
            return res;
        }, function (err) {
            clearTimeout(timer);
            throw err;
        });
    }

    function httpsUrl(raw) {
        var u = String(raw || '').trim();
        if (/^https:\/\//i.test(u)) return u;
        return '';
    }

    function telegramApp() {
        return (root.Telegram && Telegram.WebApp) || null;
    }

    function useTelegramSave() {
        var tg = telegramApp();
        return !!(tg && typeof tg.openLink === 'function');
    }

    function uploadLitterbox(blob, fileName) {
        var fd = new FormData();
        fd.append('reqtype', 'fileupload');
        fd.append('time', '24h');
        fd.append('fileToUpload', blob, fileName || 'REED.zip');
        return fetchTimeout('https://litterbox.catbox.moe/resources/internals/api.php', {
            method: 'POST',
            body: fd
        }, 25000).then(function (r) { return r.text(); }).then(function (t) {
            return httpsUrl(t);
        }).catch(function () { return ''; });
    }

    function uploadTmpfiles(blob, fileName) {
        var fd = new FormData();
        fd.append('file', blob, fileName || 'REED.zip');
        return fetchTimeout('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: fd
        }, 25000).then(function (r) { return r.text(); }).then(function (t) {
            var data = {};
            try { data = JSON.parse(t); } catch (e) {}
            var u = (data.data && (data.data.url || data.data.link)) || data.url || '';
            u = String(u || '').replace('http://', 'https://');
            if (u.indexOf('tmpfiles.org/') >= 0 && u.indexOf('/dl/') < 0) {
                u = u.replace('://tmpfiles.org/', '://tmpfiles.org/dl/');
            }
            return httpsUrl(u);
        }).catch(function () { return ''; });
    }

    function hostFile(blob, fileName) {
        return uploadLitterbox(blob, fileName).then(function (url) {
            if (url) return url;
            return uploadTmpfiles(blob, fileName);
        });
    }

    function openHttps(url) {
        if (!url) return false;
        var tg = telegramApp();
        try {
            if (tg && typeof tg.openLink === 'function') {
                tg.openLink(url, { try_instant_view: false });
                return true;
            }
        } catch (e) {}
        try {
            window.open(url, '_blank', 'noopener');
            return true;
        } catch (e2) {}
        return false;
    }

    function setZipLink(href, fileName) {
        var link = document.getElementById('post-zip-link');
        if (!link) return;
        if (link._prev && String(link._prev).indexOf('blob:') === 0) {
            try { URL.revokeObjectURL(link._prev); } catch (e) {}
        }
        link._prev = href;
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener';
        if (fileName) link.setAttribute('download', fileName);
        else link.removeAttribute('download');
        link.hidden = false;
        link.textContent = 'Save ZIP';
        link.onclick = function (ev) {
            if (href && href.indexOf('https:') === 0) {
                ev.preventDefault();
                openHttps(href);
            }
        };
    }

    function clickLocalDownload(blob, fileName) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'reed-quiz.zip';
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            try { URL.revokeObjectURL(url); a.remove(); } catch (e) {}
        }, 4000);
        return url;
    }

    function saveBlob(blob, fileName) {
        if (!blob) return Promise.resolve({ ok: false });
        if (useTelegramSave()) {
            setStatus('Uploading…');
            return hostFile(blob, fileName).then(function (url) {
                if (!url) {
                    setStatus('သိမ်းမရပါ — အင်တာနက် ဖွင့်ပါ');
                    return { ok: false };
                }
                if (/\.zip$/i.test(fileName || '')) setZipLink(url, fileName);
                openHttps(url);
                return { ok: true, hosted: true, url: url };
            });
        }
        try {
            var blobUrl = clickLocalDownload(blob, fileName);
            if (/\.zip$/i.test(fileName || '')) setZipLink(blobUrl, fileName);
            return Promise.resolve({ ok: true });
        } catch (e) {
            return Promise.resolve({ ok: false });
        }
    }

    function downloadOne(item) {
        return canvasBlob(item.canvas).then(function (blob) {
            if (!blob) return { ok: false };
            return saveBlob(blob, item.name);
        });
    }

    function zipName() {
        return stem() + '-' + state.slides.length + 'imgs.zip';
    }

    function downloadAll() {
        var list = state.slides.slice();
        if (!list.length) {
            setStatus('အရင် ပုံထုတ်ပါ');
            return Promise.resolve();
        }
        var btn = document.getElementById('post-dl-all');
        if (btn) { btn.disabled = true; btn.textContent = 'ZIP လုပ်နေ…'; }
        setStatus('ZIP လုပ်နေ…');
        return Promise.all(list.map(function (item) {
            return canvasBlob(item.canvas).then(function (blob) {
                return blobBytes(blob).then(function (bytes) {
                    return { name: item.name, bytes: bytes };
                });
            });
        })).then(function (files) {
            var zip = zipFiles(files);
            return saveBlob(zip, zipName()).then(function (res) {
                if (res && res.hosted) {
                    setStatus('Browser မှာ ဖွင့်ပြီး Save လုပ်ပါ · ပုံ ' + files.length + ' ခု');
                } else {
                    setStatus(res && res.ok ? ('ZIP ၁ ဖိုင် · ပုံ ' + files.length + ' ခု') : 'ZIP သိမ်းမရပါ');
                }
                return res;
            });
        }).catch(function () {
            setStatus('ZIP မရပါ');
        }).then(function () {
            if (btn) { btn.disabled = false; btn.textContent = 'Download ZIP'; }
        });
    }

    function setStatus(text) {
        var el = document.getElementById('post-status');
        if (el) el.textContent = text || '';
    }

    function escHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function chipRow(id, items, selected, onPick) {
        var wrap = document.getElementById(id);
        if (!wrap) return;
        wrap.innerHTML = items.map(function (it) {
            var on = String(it.id) === String(selected) ? ' on' : '';
            return '<button type="button" class="tt-chip post-chip' + on + '" data-v="' + escHtml(it.id) + '">' + escHtml(it.label) + '</button>';
        }).join('');
        wrap.querySelectorAll('.post-chip').forEach(function (btn) {
            btn.onclick = function () { onPick(btn.getAttribute('data-v')); };
        });
    }

    function chipRowMulti(id, items, selected, onChange) {
        var wrap = document.getElementById(id);
        if (!wrap) return;
        var sel = (selected || []).map(String);
        var allIds = items.map(function (it) { return String(it.id); });
        var allOn = allIds.length > 0 && allIds.every(function (x) { return sel.indexOf(x) !== -1; });
        var html = '<button type="button" class="tt-chip post-chip' + (allOn ? ' on' : '') + '" data-v="__all__">All</button>';
        html += items.map(function (it) {
            var on = sel.indexOf(String(it.id)) !== -1 ? ' on' : '';
            return '<button type="button" class="tt-chip post-chip' + on + '" data-v="' + escHtml(it.id) + '">' + escHtml(it.label) + '</button>';
        }).join('');
        wrap.innerHTML = html;
        wrap.querySelectorAll('.post-chip').forEach(function (btn) {
            btn.onclick = function () {
                var v = btn.getAttribute('data-v');
                if (v === '__all__') {
                    onChange(allIds.slice());
                    return;
                }
                var next;
                if (allOn) next = [v];
                else {
                    next = sel.slice();
                    var idx = next.indexOf(v);
                    if (idx >= 0) {
                        if (next.length > 1) next.splice(idx, 1);
                    } else next.push(v);
                }
                onChange(next);
            };
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
            setChapters([isGrammar() ? ((grammarTopics()[0] && grammarTopics()[0].id) || 'past_simple') : 1]);
            paintPickers();
        });
        var types = typesFor(state.sub);
        chipRow('post-types', types.map(function (t) {
            return { id: t.id, label: t.label };
        }), state.type, function (v) {
            state.type = v;
            if (isGrammar()) setChapters([(grammarTopics()[0] && grammarTopics()[0].id) || 'past_simple']);
            else if (typeof selectedChapters()[0] !== 'number') setChapters([1]);
            paintPickers();
        });
        var chs = [];
        if (isGrammar()) {
            grammarTopics().forEach(function (t) {
                chs.push({ id: t.id, label: t.title });
            });
        } else if (state.sub === 'mm') {
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
        if (chs.length) {
            var allowed = {};
            chs.forEach(function (c) { allowed[String(c.id)] = c.id; });
            var cur = selectedChapters().filter(function (id) {
                return Object.prototype.hasOwnProperty.call(allowed, String(id));
            }).map(function (id) { return allowed[String(id)]; });
            if (!cur.length) cur = [chs[0].id];
            setChapters(cur);
        }
        var chWrap = document.getElementById('post-chs');
        if (chWrap) chWrap.classList.toggle('post-chs-topics', isGrammar());
        var chLab = document.getElementById('post-ch-label');
        if (chLab) {
            var base = isGrammar() ? 'GRAMMAR TOPIC' : (state.sub === 'en' ? 'UNIT' : (state.sub === 'mm' ? 'CATEGORY' : 'CHAPTER'));
            chLab.textContent = base + ' · tap more than one';
        }
        var hint = document.getElementById('post-ch-hint');
        if (hint) {
            if (isGrammar()) hint.textContent = 'Tap more than one topic to mix questions.';
            else if (state.sub === 'en') hint.textContent = 'Tap more than one unit to mix questions.';
            else if (state.sub === 'mm') hint.textContent = 'Tap more than one category to mix questions.';
            else hint.textContent = 'Tap more than one chapter. Questions mix across 1.1, 1.2, … not just one section.';
        }
        chipRowMulti('post-chs', chs, selectedChapters(), function (next) {
            setChapters(coerceChIds(next));
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
        if (!(n >= 1 && n <= 20)) n = parseInt(state.count, 10);
        if (!(n >= 1 && n <= 20)) n = 5;
        state.count = n;
        var chs = selectedChapters();
        var label = chs.length === 1
            ? fileNameFor(chs[0])
            : (state.sub + ' · ' + chs.length + ' chapters');
        setStatus('Loading ' + label + '…');
        return Promise.all(chs.map(function (ch) { return loadChapterGroups(ch); })).then(function (packs) {
            var groups = [];
            packs.forEach(function (pack) {
                (pack || []).forEach(function (g) { groups.push(g.items || []); });
            });
            var pool = groups.reduce(function (sum, g) { return sum + g.length; }, 0);
            if (!pool) throw new Error('empty');
            var picked = pickSpread(groups, n);
            state.lastPicked = picked;
            var meta = { line: metaLine(), accent: accentOf(state.sub) };
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
            setStatus(picked.length + ' quizzes · mixed · ' + slides.length + ' images');
            var allBtn = document.getElementById('post-dl-all');
            if (allBtn) {
                allBtn.hidden = !slides.length;
                allBtn.disabled = false;
                allBtn.textContent = 'Download ZIP';
            }
            var zipLink = document.getElementById('post-zip-link');
            if (zipLink) zipLink.hidden = true;
        }).catch(function () {
            state.slides = [];
            state.lastPicked = [];
            renderPreviews();
            var allBtn = document.getElementById('post-dl-all');
            if (allBtn) allBtn.hidden = true;
            var zipLink = document.getElementById('post-zip-link');
            if (zipLink) zipLink.hidden = true;
            setStatus('မေးခွန်းဖိုင် မတွေ့ပါ — ' + label);
            if (root.Telegram && Telegram.WebApp && Telegram.WebApp.showAlert) {
                Telegram.WebApp.showAlert('မေးခွန်းဖိုင် မတွေ့သေးပါ: ' + label);
            }
        });
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
        fileNameFor: fileNameFor,
        pickSpread: pickSpread,
        selectedChapters: selectedChapters,
        setChapters: setChapters,
        loadChapterGroups: loadChapterGroups,
        quizPath: quizPath,
        quizPaths: quizPaths,
        normalizeQ: normalizeQ,
        cleanLatex: cleanLatex,
        drawQuestion: drawQuestion,
        drawAnswer: drawAnswer,
        typesFor: typesFor,
        zipFiles: zipFiles,
        downloadAll: downloadAll,
        saveBlob: saveBlob,
        useTelegramSave: useTelegramSave,
        state: state
    };
})(typeof window !== 'undefined' ? window : globalThis);
