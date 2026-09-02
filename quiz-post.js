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

    var grainTile = null;

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

    function fileName() {
        var sub = state.sub;
        var ch = state.chapter;
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

    function makeGrain() {
        if (grainTile) return grainTile;
        var g = document.createElement('canvas');
        g.width = 160;
        g.height = 160;
        var x = g.getContext('2d');
        if (!x) return g;
        for (var i = 0; i < 160; i += 2) {
            for (var j = 0; j < 160; j += 2) {
                var n = Math.random();
                if (n > 0.62) {
                    x.fillStyle = n > 0.88 ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.42)';
                    x.fillRect(i, j, 2, 2);
                }
            }
        }
        grainTile = g;
        return g;
    }

    function paintGrain(ctx) {
        var tile = makeGrain();
        if (!ctx.createPattern) return;
        var pat = ctx.createPattern(tile, 'repeat');
        if (!pat) return;
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    function paintOrbs(ctx, accent) {
        function orb(cx, cy, r, color) {
            if (!ctx.createRadialGradient) {
                ctx.save();
                ctx.globalAlpha = 0.12;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                return;
            }
            var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, color);
            g.addColorStop(1, 'rgba(11,15,25,0)');
            ctx.fillStyle = g;
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
        orb(200, 140, 420, hexRgba(accent, 0.32));
        orb(940, 980, 460, hexRgba(accent, 0.2));
        orb(980, 90, 280, 'rgba(255,255,255,0.1)');
        orb(80, 900, 240, hexRgba(accent, 0.14));
    }

    function paintDots(ctx) {
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        for (var dx = 36; dx < W; dx += 28) {
            for (var dy = 36; dy < H; dy += 28) {
                ctx.beginPath();
                ctx.arc(dx, dy, 1.15, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function paintWatermark(ctx) {
        ctx.save();
        ctx.translate(W / 2, H / 2 + 40);
        if (ctx.rotate) ctx.rotate(-0.16);
        ctx.globalAlpha = 0.045;
        ctx.fillStyle = WHITE;
        ctx.font = '900 210px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('REED', 0, 70);
        ctx.restore();
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
        paintOrbs(ctx, accent);
        paintGrain(ctx);
        paintDots(ctx);
        paintWatermark(ctx);

        ctx.strokeStyle = hexRgba(accent, 0.42);
        ctx.lineWidth = 3;
        strokeRound(ctx, 22, 22, W - 44, H - 44, 36);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        strokeRound(ctx, 34, 34, W - 68, H - 68, 28);

        if (ctx.createLinearGradient) {
            var bar = ctx.createLinearGradient(22, 0, W - 22, 0);
            bar.addColorStop(0, accent);
            bar.addColorStop(0.55, hexRgba(accent, 0.85));
            bar.addColorStop(1, hexRgba(accent, 0.15));
            ctx.fillStyle = bar;
        } else {
            ctx.fillStyle = accent;
        }
        ctx.fillRect(24, 24, W - 48, 8);
        ctx.fillRect(24, H - 32, W - 48, 8);

        ctx.fillStyle = accent;
        ctx.font = '800 32px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('REED', 56, 80);

        var pill = kind === 'answer' ? 'ANSWER' : 'QUIZ';
        var pw = kind === 'answer' ? 170 : 122;
        fillRound(ctx, W - 56 - pw, 50, pw, 42, 21, hexRgba(accent, 0.18));
        ctx.strokeStyle = hexRgba(accent, 0.45);
        ctx.lineWidth = 1.5;
        strokeRound(ctx, W - 56 - pw, 50, pw, 42, 21);
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
            var optH = n >= 4 ? 86 : 98;
            var gap = 12;
            var optsH = n * optH + (n - 1) * gap;
            var qH = bottom - top - optsH - 16;
            if (qH < 150) {
                optH = 74;
                optsH = n * optH + (n - 1) * gap;
                qH = bottom - top - optsH - 16;
            }
            paintCard(ctx, x, top, inner, qH, 22, CARD, accent);
            ctx.font = '700 32px ' + fontFace;
            var maxLines = Math.max(3, Math.floor((qH - 40) / 40));
            var qLines = wrapLines(ctx, q.q, inner - 56, maxLines);
            drawQuestionLines(ctx, qLines, x + 28, top + 48, 40, accent);
            var oy = top + qH + 16;
            q.options.forEach(function (opt, i) {
                paintCard(ctx, x, oy, inner, optH, 18, CARD2, null);
                ctx.beginPath();
                ctx.arc(x + 44, oy + optH / 2, 22, 0, Math.PI * 2);
                ctx.fillStyle = accent;
                ctx.fill();
                ctx.fillStyle = BG;
                ctx.font = '800 22px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(LETTERS[i] || String(i + 1), x + 44, oy + optH / 2 + 8);
                ctx.textAlign = 'left';
                ctx.fillStyle = WHITE;
                ctx.font = '700 26px Inter, "Noto Sans Myanmar", sans-serif';
                var ol = wrapLines(ctx, opt, inner - 130, 2);
                ctx.fillText(ol[0] || '', x + 82, oy + (ol[1] ? optH * 0.4 : optH * 0.62));
                if (ol[1]) ctx.fillText(ol[1], x + 82, oy + optH * 0.76);
                oy += optH + gap;
            });
        } else if (q.kind === 'tf') {
            var btnH = 118;
            var tfH = bottom - top - btnH - 16;
            paintCard(ctx, x, top, inner, tfH, 22, CARD, accent);
            ctx.font = '700 32px ' + fontFace;
            var tfLines = wrapLines(ctx, q.q, inner - 56, Math.max(4, Math.floor((tfH - 40) / 40)));
            drawQuestionLines(ctx, tfLines, x + 28, top + 52, 40, accent);
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
            ctx.font = '700 30px Inter, sans-serif';
            var rLines = wrapLines(ctx, q.q, inner - 56, Math.max(6, Math.floor((bottom - top - 90) / 40)));
            drawQuestionLines(ctx, rLines, x + 28, top + 96, 40, accent);
        } else {
            var hasInline = /_{3,}/.test(q.q || '');
            var blankH = hasInline ? 0 : 118;
            var bH = bottom - top - blankH - (blankH ? 16 : 0);
            paintCard(ctx, x, top, inner, bH, 22, CARD, accent);
            ctx.font = '700 32px ' + fontFace;
            var bLines = wrapLines(ctx, q.q, inner - 56, Math.max(4, Math.floor((bH - 40) / 40)));
            drawQuestionLines(ctx, bLines, x + 28, top + 52, 40, accent);
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
        var ansH = q.e ? 280 : Math.min(420, bottom - top);

        ctx.save();
        if (ctx.shadowBlur != null) {
            ctx.shadowColor = hexRgba(OK, 0.45);
            ctx.shadowBlur = 36;
        }
        paintCard(ctx, x, top, inner, ansH, 24, '#10261A', OK);
        ctx.restore();

        ctx.fillStyle = MUTED;
        ctx.font = '700 20px Inter, sans-serif';
        ctx.fillText('Correct answer', x + 28, top + 48);
        ctx.fillStyle = OK;
        ctx.font = '800 38px Inter, "Noto Sans Myanmar", sans-serif';
        var ans = '';
        if (q.kind === 'mcq') {
            ans = (LETTERS[q.correct] || '') + '   ' + (q.options[q.correct] || '');
        } else if (q.kind === 'tf') {
            ans = q.correct ? 'TRUE' : 'FALSE';
        } else {
            ans = q.correct || '—';
        }
        var aLines = wrapLines(ctx, ans, inner - 56, 4);
        var ay = top + 108;
        aLines.forEach(function (ln) {
            ctx.fillText(ln, x + 28, ay);
            ay += 50;
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
                ctx.font = '600 26px Inter, "Noto Sans Myanmar", sans-serif';
                var eLines = wrapLines(ctx, q.e, inner - 56, Math.max(4, Math.floor((whyH - 70) / 36)));
                var ey = whyTop + 88;
                eLines.forEach(function (ln) {
                    ctx.fillText(ln, x + 28, ey);
                    ey += 36;
                });
            }
        }
        return slide.c;
    }

    function metaLine() {
        var s = subMeta(state.sub);
        var type = currentType();
        if (isGrammar()) return s.short + '  ·  GRAMMAR  ·  ' + grammarTitle(state.chapter).toUpperCase();
        if (state.sub === 'en' && state.type === 'en_init') return s.short + '  ·  UNIT ' + state.chapter + '  ·  INITIAL';
        if (state.sub === 'en') return s.short + '  ·  UNIT ' + state.chapter + '  ·  ' + type.label.toUpperCase();
        if (state.sub === 'mm') return s.short + '  ·  ' + (mmFiles(state.grade)[state.chapter - 1] || '').replace(/^mm_/, '') + '  ·  MCQ';
        return s.short + '  ·  CHAPTER ' + state.chapter + '  ·  ' + type.label.toUpperCase();
    }

    function stem() {
        if (isGrammar()) return ('en-g' + state.grade + '-' + state.chapter + '-grammar').toLowerCase();
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
            state.chapter = isGrammar() ? (grammarTopics()[0] && grammarTopics()[0].id) : 1;
            paintPickers();
        });
        var types = typesFor(state.sub);
        chipRow('post-types', types.map(function (t) {
            return { id: t.id, label: t.label };
        }), state.type, function (v) {
            state.type = v;
            if (isGrammar()) state.chapter = (grammarTopics()[0] && grammarTopics()[0].id) || 'past_simple';
            else if (typeof state.chapter !== 'number') state.chapter = 1;
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
        if (!chs.some(function (c) { return String(c.id) === String(state.chapter); })) {
            state.chapter = chs[0] ? chs[0].id : 1;
        }
        var chWrap = document.getElementById('post-chs');
        if (chWrap) chWrap.classList.toggle('post-chs-topics', isGrammar());
        var chLab = document.getElementById('post-ch-label');
        if (chLab) {
            chLab.textContent = isGrammar() ? 'GRAMMAR TOPIC' : (state.sub === 'en' ? 'UNIT' : (state.sub === 'mm' ? 'CATEGORY' : 'CHAPTER'));
        }
        chipRow('post-chs', chs, state.chapter, function (v) {
            state.chapter = isGrammar() ? v : parseInt(v, 10);
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
        var name = fileName();
        setStatus('Loading ' + name + '…');
        return loadQuizJson(state.grade, name).then(function (data) {
            if (!Array.isArray(data) || !data.length) throw new Error('empty');
            var picked = shufflePick(data, n);
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
        typesFor: typesFor,
        state: state
    };
})(typeof window !== 'undefined' ? window : globalThis);
