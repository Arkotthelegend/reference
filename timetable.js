/* REED weekly timetable — rule-based planner that feels like AI. */
(function (root) {
    var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    var SHORT = {
        mm: 'Myan', en: 'English', math: 'Maths', phy: 'Physics',
        chem: 'Chemistry', bio: 'Biology',         eco: 'Eco'
    };
    var MIN_SUBJECTS = 4;
    var STEAM = {
        1: ['mm', 'en', 'math', 'phy', 'chem', 'bio'],
        2: ['mm', 'en', 'math', 'phy', 'chem', 'eco']
    };
    var INK = '#111111';
    var PAPER = '#FFFFFF';
    var HEADER = '#245C43';
    var TIMECOL = '#7CB87A';
    var SCHOOL = '#F6E56B';
    var PAUSE = '#B7E7EA';
    var DINNER = '#C8E89A';
    var COLORS = {
        school: SCHOOL,
        rest: PAUSE,
        brk: PAUSE,
        tuition: PAUSE,
        study: PAPER,
        dinner: DINNER,
        homework: PAPER
    };
    var LOGO_SRC = './logo.jpg';
    var logoCache = { tried: false, canvas: null };

    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function minsToLabel(m) {
        m = ((m % 1440) + 1440) % 1440;
        if (m === 0) return '12:00 AM';
        var h = Math.floor(m / 60);
        var min = m % 60;
        var ap = h >= 12 ? 'PM' : 'AM';
        var hr = h % 12;
        if (!hr) hr = 12;
        return hr + ':' + pad(min) + ' ' + ap;
    }
    function rangeLabel(a, b) {
        var left = minsToLabel(a).replace(' AM', '').replace(' PM', '');
        var aAp = a >= 12 * 60 && a < 24 * 60 ? 'PM' : 'AM';
        var bAp = (b >= 24 * 60 ? 'AM' : (b >= 12 * 60 ? 'PM' : 'AM'));
        if (b === 1440 || b === 0) { bAp = 'AM'; }
        var right = minsToLabel(b === 1440 ? 0 : b).replace(' AM', '').replace(' PM', '');
        if (aAp === bAp) return left + '–' + right + ' ' + bAp;
        return minsToLabel(a).replace(' ', '\u00a0') + '–' + minsToLabel(b === 1440 ? 0 : b);
    }
    function parseTime(v) {
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
    }
    function hashStr(s) {
        var h = 2166136261;
        s = String(s || '');
        for (var i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }
    function mulberry32(a) {
        return function () {
            a |= 0;
            a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function seededShuffle(arr, seed) {
        var a = arr.slice();
        var rng = mulberry32(seed);
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(rng() * (i + 1));
            var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
    }
    function clip(block, start, end) {
        var s = Math.max(block.start, start);
        var e = Math.min(block.end, end);
        if (e - s < 10) return null;
        return { start: s, end: e, type: block.type, label: block.label, sub: block.sub || '', color: block.color };
    }
    function mergeBusy(list) {
        var a = list.slice().sort(function (x, y) { return x.start - y.start; });
        var out = [];
        a.forEach(function (x) {
            if (!out.length || x.start > out[out.length - 1].end) out.push({ start: x.start, end: x.end });
            else out[out.length - 1].end = Math.max(out[out.length - 1].end, x.end);
        });
        return out;
    }
    function gaps(dayStart, dayEnd, busy) {
        var occ = mergeBusy(busy.map(function (b) {
            return { start: Math.max(b.start, dayStart), end: Math.min(b.end, dayEnd) };
        }).filter(function (b) { return b.end - b.start >= 5; }));
        var g = [];
        var t = dayStart;
        occ.forEach(function (o) {
            if (o.start > t) g.push({ start: t, end: o.start });
            t = Math.max(t, o.end);
        });
        if (t < dayEnd) g.push({ start: t, end: dayEnd });
        return g;
    }
    function subjectMeta(id) {
        return { label: SHORT[id] || id, sub: '', color: COLORS.study };
    }

    function buildDay(answers, dayIndex, cycle, seed) {
        var dayStart = answers.dayStart;
        var dayEnd = answers.dayEnd <= answers.dayStart ? 1440 : answers.dayEnd;
        var blocks = [];
        var schoolOn = (answers.schoolDays || []).indexOf(dayIndex) !== -1;
        var tuitionOn = answers.hasTuition && (answers.tuitionDays || []).indexOf(dayIndex) !== -1;
        if (schoolOn) {
            var sch = clip({ start: answers.schoolStart, end: answers.schoolEnd, type: 'school', label: 'School', color: COLORS.school }, dayStart, dayEnd);
            if (sch) blocks.push(sch);
        }
        function addTuition(start, end) {
            var tu = clip({ start: start, end: end, type: 'tuition', label: 'Tuition', color: COLORS.tuition }, dayStart, dayEnd);
            if (!tu) return;
            var overlapSchool = schoolOn && !(tu.end <= answers.schoolStart || tu.start >= answers.schoolEnd);
            if (overlapSchool) {
                if (tu.start < answers.schoolStart) {
                    var left = clip({ start: tu.start, end: Math.min(tu.end, answers.schoolStart), type: 'tuition', label: 'Tuition', color: COLORS.tuition }, dayStart, dayEnd);
                    if (left) blocks.push(left);
                }
                if (tu.end > answers.schoolEnd) {
                    var right = clip({ start: Math.max(tu.start, answers.schoolEnd), end: tu.end, type: 'tuition', label: 'Tuition', color: COLORS.tuition }, dayStart, dayEnd);
                    if (right) blocks.push(right);
                }
                return;
            }
            blocks.push(tu);
        }
        if (tuitionOn) addTuition(answers.tuitionStart, answers.tuitionEnd);
        if (tuitionOn && answers.hasTuition2) addTuition(answers.tuition2Start, answers.tuition2End);

        var lastTu = 0;
        if (tuitionOn) lastTu = answers.tuitionEnd;
        if (tuitionOn && answers.hasTuition2) lastTu = Math.max(lastTu, answers.tuition2End);
        var restStart = answers.restStart;
        var restEnd = answers.restEnd;
        var restLabel = answers.restLabel || 'Dinner + Rest';
        if (lastTu && restStart < lastTu) {
            restStart = lastTu;
            restEnd = lastTu + 30;
            restLabel = 'Dinner + Rest';
        }

        if (schoolOn && !tuitionOn) {
            var lunch = clip({ start: answers.schoolEnd, end: answers.schoolEnd + 60, type: 'rest', label: 'Lunch + Rest', color: COLORS.rest }, dayStart, dayEnd);
            if (lunch) blocks.push(lunch);
        }

        var rest = clip({ start: restStart, end: restEnd, type: 'rest', label: restLabel, color: COLORS.dinner }, dayStart, dayEnd);
        if (rest) {
            var busyNow = blocks.map(function (b) { return { start: b.start, end: b.end }; });
            gaps(rest.start, rest.end, busyNow).forEach(function (g) {
                if (g.end - g.start >= 15) {
                    blocks.push({ start: g.start, end: g.end, type: 'rest', label: restLabel, sub: '', color: COLORS.dinner });
                }
            });
        }

        var free = gaps(dayStart, dayEnd, blocks);
        var slot = dayIndex;
        function pushStudy(a, b) {
            if (b - a < 15) return;
            var metaC = subjectMeta(cycle[slot % cycle.length]);
            slot++;
            blocks.push({ start: a, end: b, type: 'study', label: metaC.label, sub: metaC.sub, color: COLORS.study });
        }
        function fill(a, b) {
            if (b - a < 20) {
                if (b - a >= 10) blocks.push({ start: a, end: b, type: 'brk', label: 'Break', sub: '', color: COLORS.brk });
                return;
            }
            if (!answers.shortRest) {
                pushStudy(a, b);
                return;
            }
            var studyChunk = 90;
            var restLen = answers.shortRestMins || 15;
            var t = a;
            while (b - t >= 20) {
                var left = b - t;
                if (left <= studyChunk + restLen) {
                    pushStudy(t, b);
                    return;
                }
                pushStudy(t, t + studyChunk);
                t += studyChunk;
                if (b - t >= restLen + 20) {
                    blocks.push({ start: t, end: t + restLen, type: 'brk', label: 'Rest', sub: '', color: COLORS.brk });
                    t += restLen;
                }
            }
        }
        free.forEach(function (gap) {
            var start = gap.start;
            var end = gap.end;
            if (end - start < 20) {
                if (end - start >= 10) blocks.push({ start: start, end: end, type: 'brk', label: 'Break', sub: '', color: COLORS.brk });
                return;
            }
            var lunch = null;
            if (!schoolOn && start <= 11 * 60 && end >= 14 * 60) {
                lunch = { start: 12 * 60, end: 13 * 60 };
            }
            if (lunch && lunch.start > start && lunch.end < end) {
                fill(start, lunch.start);
                blocks.push({ start: lunch.start, end: lunch.end, type: 'rest', label: 'Lunch + Rest', sub: '', color: COLORS.rest });
                fill(lunch.end, end);
            } else {
                fill(start, end);
            }
        });

        blocks.sort(function (a, b) { return a.start - b.start; });
        var merged = [];
        blocks.forEach(function (b) {
            var last = merged[merged.length - 1];
            if (last && last.end === b.start && last.type === b.type && last.label === b.label && (last.sub || '') === (b.sub || '')) {
                last.end = b.end;
            } else {
                merged.push(b);
            }
        });
        if (!merged.length) {
            pushStudy(dayStart, dayEnd);
            return blocks;
        }
        if (merged[0].start > dayStart) merged[0].start = dayStart;
        for (var i = 1; i < merged.length; i++) {
            if (merged[i].start > merged[i - 1].end) merged[i - 1].end = merged[i].start;
        }
        if (merged[merged.length - 1].end < dayEnd) merged[merged.length - 1].end = dayEnd;
        return merged;
    }

    function steamId(answers) {
        return parseInt(answers && answers.steam, 10) === 2 ? 2 : 1;
    }
    function steamIds(answers) {
        return STEAM[steamId(answers)].slice();
    }
    function inSteam(answers, id) {
        return steamIds(answers).indexOf(id) !== -1;
    }
    function steamHelp(st) {
        return st === 2
            ? 'STEAM 2: Myan, English, Maths, Physics, Chemistry, Eco'
            : 'STEAM 1: Myan, English, Maths, Physics, Chemistry, Biology';
    }
    function steamSubjectList(api, answers) {
        var all = api.getSubjects() || [];
        return steamIds(answers).map(function (id) {
            var found = null;
            all.forEach(function (s) { if (s.id === id) found = s; });
            return found || { id: id, name: SHORT[id] || id };
        });
    }
    function guessSteam(api) {
        var paid = paidSubjects(api).map(function (s) { return s.id; });
        if (paid.indexOf('eco') !== -1 && paid.indexOf('bio') === -1) return 2;
        return 1;
    }
    function steamChoiceKey(api, grade) {
        var uid = telegramUserId(api) || '0';
        var g = grade;
        if (g == null) {
            try {
                if (api && typeof api.getGrade === 'function') g = api.getGrade();
            } catch (e) {}
        }
        return 'reed_steam_u' + uid + '_g' + (g || 12);
    }
    function getSteam(api, grade) {
        try {
            var stored = localStorage.getItem(steamChoiceKey(api, grade));
            if (stored === '1' || stored === '2') return parseInt(stored, 10);
        } catch (e) {}
        try {
            var g = grade;
            if (g == null && api && typeof api.getGrade === 'function') g = api.getGrade();
            var rec = loadAnswers(g || 12, api);
            if (rec && (rec.steam === 1 || rec.steam === 2)) return rec.steam;
        } catch (e2) {}
        return guessSteam(api);
    }
    function setSteam(api, steam, grade) {
        steam = parseInt(steam, 10) === 2 ? 2 : 1;
        try { localStorage.setItem(steamChoiceKey(api, grade), String(steam)); } catch (e) {}
        try {
            var g = grade;
            if (g == null && api && typeof api.getGrade === 'function') g = api.getGrade();
            var rec = loadAnswers(g || 12, api);
            if (rec) {
                rec.steam = steam;
                saveAnswers(g || 12, rec, api);
            }
        } catch (e2) {}
        return steam;
    }
    function weekSubjects(answers) {
        var ids = [];
        function add(list) {
            (list || []).forEach(function (id) {
                if (id && ids.indexOf(id) === -1 && inSteam(answers, id)) ids.push(id);
            });
        }
        add(steamIds(answers));
        add(answers.weakSubjects);
        add(answers.strongSubjects);
        return ids;
    }

    function makeCycle(answers, seed) {
        var bag = steamIds(answers);
        (answers.weakSubjects || []).forEach(function (id) {
            if (inSteam(answers, id)) bag.push(id, id);
        });
        if (!bag.length) bag = ['en'];
        return seededShuffle(bag, seed || 1);
    }

    function buildWeek(answers, seed) {
        var cycle = makeCycle(answers, seed);
        var days = [];
        for (var d = 0; d < 7; d++) days.push(buildDay(answers, d, cycle, d >= 5 ? seed + 17 : seed));
        return { days: days, cycle: cycle };
    }

    function uniqueBounds(days, dayIdxs) {
        var set = {};
        dayIdxs.forEach(function (di) {
            (days[di] || []).forEach(function (b) {
                set[b.start] = 1;
                set[b.end] = 1;
            });
        });
        return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    }

    function cellAt(blocks, start, end) {
        var best = null;
        var bestCov = 0;
        var span = Math.max(1, end - start);
        for (var i = 0; i < (blocks || []).length; i++) {
            var b = blocks[i];
            var cov = Math.min(b.end, end) - Math.max(b.start, start);
            if (cov > bestCov) {
                bestCov = cov;
                best = b;
            }
        }
        if (best && bestCov > 0) return best;
        return null;
    }

    function rr(ctx, x, y, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    function fitText(ctx, text, maxW, size) {
        ctx.font = '700 ' + size + 'px "Noto Sans Myanmar","Myanmar Text",Padauk,sans-serif';
        var t = String(text || '');
        if (ctx.measureText(t).width <= maxW) return t;
        while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
        return t + '…';
    }
    function drawLogo(ctx, cx, cy, s) {
        s = s || 88;
        ctx.save();
        ctx.translate(cx, cy);
        var sc = s / 110;
        ctx.scale(sc, sc);
        ctx.strokeStyle = INK;
        ctx.fillStyle = INK;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(-32, -30);
        ctx.lineTo(-32, 18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(32, -30);
        ctx.lineTo(32, 18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(0, 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-34, 22);
        ctx.quadraticCurveTo(-16, 30, 0, 24);
        ctx.quadraticCurveTo(16, 30, 34, 22);
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.moveTo(0, 22);
        ctx.bezierCurveTo(10, 10, 28, -2, 26, -18);
        ctx.bezierCurveTo(24, -36, 4, -48, -18, -46);
        ctx.bezierCurveTo(-44, -44, -52, -18, -40, 2);
        ctx.bezierCurveTo(-30, 16, -8, 10, 18, -8);
        ctx.bezierCurveTo(30, -16, 38, -24, 44, -32);
        ctx.stroke();

        ctx.save();
        ctx.translate(44, -32);
        ctx.rotate(-0.78);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(6, -5);
        ctx.lineTo(22, 0);
        ctx.lineTo(6, 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#F4F1E8';
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(16, 0);
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
        ctx.restore();
    }

    function punchLogo(img) {
        var tmp = document.createElement('canvas');
        tmp.width = img.naturalWidth || img.width;
        tmp.height = img.naturalHeight || img.height;
        var t = tmp.getContext('2d');
        t.drawImage(img, 0, 0);
        try {
            var data = t.getImageData(0, 0, tmp.width, tmp.height);
            var px = data.data;
            for (var i = 0; i < px.length; i += 4) {
                var avg = (px[i] + px[i + 1] + px[i + 2]) / 3;
                if (avg > 228 && Math.abs(px[i] - px[i + 1]) < 22) {
                    px[i + 3] = avg > 246 ? 0 : Math.max(0, Math.round((246 - avg) * 14));
                }
            }
            t.putImageData(data, 0, 0);
        } catch (e) {}
        return tmp;
    }

    function loadLogo(done) {
        if (logoCache.canvas) return done(logoCache.canvas);
        if (logoCache.tried) return done(null);
        if (typeof Image === 'undefined') {
            logoCache.tried = true;
            return done(null);
        }
        var img = new Image();
        img.onload = function () {
            logoCache.tried = true;
            try { logoCache.canvas = punchLogo(img); }
            catch (e) { logoCache.canvas = img; }
            done(logoCache.canvas);
        };
        img.onerror = function () {
            logoCache.tried = true;
            done(null);
        };
        img.src = LOGO_SRC;
    }

    function drawBrandLogo(ctx, cx, cy, s, logoCanvas) {
        if (logoCanvas) {
            ctx.drawImage(logoCanvas, cx - s / 2, cy - s / 2, s, s);
            return;
        }
        drawLogo(ctx, cx, cy, s);
    }

    function drawLeaf(ctx, x, y, rot, sc, alpha) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.scale(sc, sc);
        ctx.fillStyle = 'rgba(47,107,79,' + (alpha || 0.16) + ')';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(22, -28, 0, -62);
        ctx.quadraticCurveTo(-22, -28, 0, 0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(47,107,79,' + ((alpha || 0.16) + 0.08) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(0, -54);
        ctx.stroke();
        ctx.restore();
    }

    function chartGroups() {
        return [
            { title: 'Mon – Fri', days: [0, 1, 2, 3, 4] },
            { title: 'Sat – Sun', days: [5, 6] }
        ];
    }

    function tableRows(weekDays, dayIdxs) {
        var counts = {};
        var minT = 24 * 60;
        var maxT = 0;
        dayIdxs.forEach(function (di) {
            (weekDays[di] || []).forEach(function (b) {
                counts[b.start] = (counts[b.start] || 0) + 1;
                counts[b.end] = (counts[b.end] || 0) + 1;
                if (b.start < minT) minT = b.start;
                if (b.end > maxT) maxT = b.end;
            });
        });
        var need = dayIdxs.length >= 4 ? 2 : 1;
        var bounds = Object.keys(counts).map(Number).filter(function (t) {
            return t === minT || t === maxT || counts[t] >= need;
        }).sort(function (a, b) { return a - b; });
        var rows = [];
        for (var i = 0; i < bounds.length - 1; i++) {
            if (bounds[i + 1] - bounds[i] >= 10) rows.push({ start: bounds[i], end: bounds[i + 1] });
        }
        return rows;
    }

    function rowHFor(row) {
        var d = row.end - row.start;
        if (d >= 300) return 118;
        if (d >= 150) return 100;
        if (d >= 60) return 92;
        return 84;
    }

    function strokeCell(ctx, x, y, w, h) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
    }

    function drawCellLabel(ctx, cell, cx, cy, cw, rh, size) {
        if (!cell) return;
        ctx.fillStyle = INK;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        size = size || 22;
        if (cw < 140) size = Math.max(16, size - 4);
        ctx.font = '700 ' + size + 'px "Noto Sans Myanmar","Myanmar Text",Padauk,sans-serif';
        ctx.fillText(fitText(ctx, cell.label, cw - 14, size), cx + cw / 2, cy);
    }

    function stackHeights(blocks, bodyTarget) {
        var heights = (blocks || []).map(rowHFor);
        if (!heights.length) return heights;
        var natural = heights.reduce(function (a, b) { return a + b; }, 0);
        if (!bodyTarget || natural <= 0) return heights;
        if (bodyTarget > natural) {
            var bump = (bodyTarget - natural) / heights.length;
            return heights.map(function (h) { return h + bump; });
        }
        var scale = bodyTarget / natural;
        return heights.map(function (h) { return Math.max(40, h * scale); });
    }

    function drawWeekendDays(ctx, x, y, w, dayIdxs, weekDays, title, bodyTarget) {
        var headerH = 64;
        var titleH = title ? 52 : 0;
        var ty = y + titleH;
        var half = w / 2;
        var timeW = 210;
        var actW = half - timeW;
        var lists = dayIdxs.map(function (di) { return (weekDays[di] || []).slice(); });
        var maxH = 0;
        var allHeights = lists.map(function (blocks) {
            var hs = stackHeights(blocks, bodyTarget);
            var sum = hs.reduce(function (a, b) { return a + b; }, 0);
            if (sum > maxH) maxH = sum;
            return hs;
        });
        var bodyH = Math.max(maxH, bodyTarget || 0);

        if (title) {
            ctx.fillStyle = INK;
            ctx.font = '800 32px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(title, x, y + 26);
        }

        ctx.fillStyle = PAPER;
        ctx.fillRect(x, ty, w, headerH + bodyH);
        ctx.fillStyle = HEADER;
        ctx.fillRect(x, ty, w, headerH);

        ctx.fillStyle = PAPER;
        ctx.font = '700 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        dayIdxs.forEach(function (di, i) {
            ctx.fillText(DAYS[di], x + half * i + half / 2, ty + headerH / 2);
            strokeCell(ctx, x + half * i, ty, half, headerH);
        });

        lists.forEach(function (blocks, i) {
            var colX = x + half * i;
            ctx.fillStyle = TIMECOL;
            ctx.fillRect(colX, ty + headerH, timeW, bodyH);
            var ry = ty + headerH;
            var heights = allHeights[i] || [];
            blocks.forEach(function (b, ri) {
                var rh = heights[ri] || rowHFor(b);
                strokeCell(ctx, colX, ry, timeW, rh);
                ctx.fillStyle = INK;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '700 20px sans-serif';
                ctx.fillText(fitText(ctx, rangeLabel(b.start, b.end), timeW - 10, 20), colX + timeW / 2, ry + rh / 2);
                var ax = colX + timeW;
                ctx.fillStyle = (b && b.color) ? b.color : PAPER;
                ctx.fillRect(ax, ry, actW, rh);
                strokeCell(ctx, ax, ry, actW, rh);
                drawCellLabel(ctx, b, ax, ry + rh / 2, actW, rh, rh < 52 ? 16 : 24);
                ry += rh;
            });
            strokeCell(ctx, colX, ty + headerH, timeW, bodyH);
            strokeCell(ctx, colX + timeW, ty + headerH, actW, bodyH);
        });

        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.8;
        ctx.strokeRect(x, ty, w, headerH + bodyH);
        return titleH + headerH + bodyH;
    }

    function drawTable(ctx, x, y, w, dayIdxs, weekDays, title, bodyTarget) {
        if ((dayIdxs || []).length <= 2) {
            return drawWeekendDays(ctx, x, y, w, dayIdxs, weekDays, title, bodyTarget);
        }
        var rows = tableRows(weekDays, dayIdxs);
        if (!rows.length) return 0;
        var heights = rows.map(rowHFor);
        var natural = heights.reduce(function (a, b) { return a + b; }, 0);
        if (bodyTarget && natural > 0 && bodyTarget > natural) {
            var bump = (bodyTarget - natural) / rows.length;
            heights = heights.map(function (h) { return h + bump; });
        }
        var timeW = dayIdxs.length <= 2 ? 260 : 210;
        var colW = (w - timeW) / dayIdxs.length;
        var headerH = 64;
        var titleH = title ? 52 : 0;
        var bodyH = heights.reduce(function (a, b) { return a + b; }, 0);
        var h = titleH + headerH + bodyH;
        var ty = y + titleH;
        var fontPx = 24;

        if (title) {
            ctx.fillStyle = INK;
            ctx.font = '800 32px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(title, x, y + 26);
        }

        ctx.fillStyle = PAPER;
        ctx.fillRect(x, ty, w, headerH + bodyH);
        ctx.fillStyle = HEADER;
        ctx.fillRect(x, ty, w, headerH);
        ctx.fillStyle = TIMECOL;
        ctx.fillRect(x, ty + headerH, timeW, bodyH);

        ctx.fillStyle = PAPER;
        ctx.font = '700 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        dayIdxs.forEach(function (di, i) {
            ctx.fillText(DAYS[di], x + timeW + colW * i + colW / 2, ty + headerH / 2);
        });
        strokeCell(ctx, x, ty, timeW, headerH);
        dayIdxs.forEach(function (_di, i) {
            strokeCell(ctx, x + timeW + colW * i, ty, colW, headerH);
        });

        var ry = ty + headerH;
        rows.forEach(function (row, ri) {
            var rh = heights[ri];
            strokeCell(ctx, x, ry, timeW, rh);
            ctx.fillStyle = INK;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            var timeLabel = rangeLabel(row.start, row.end);
            ctx.font = '700 22px sans-serif';
            ctx.fillText(fitText(ctx, timeLabel, timeW - 12, 22), x + timeW / 2, ry + rh / 2);

            dayIdxs.forEach(function (di, ci) {
                var cell = cellAt(weekDays[di], row.start, row.end);
                var cx = x + timeW + ci * colW;
                var cw = colW;
                ctx.fillStyle = (cell && cell.color) ? cell.color : PAPER;
                ctx.fillRect(cx, ry, cw, rh);
                strokeCell(ctx, cx, ry, cw, rh);
                drawCellLabel(ctx, cell, cx, ry + rh / 2, cw, rh, fontPx);
            });
            ry += rh;
        });

        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.8;
        ctx.strokeRect(x, ty, w, headerH + bodyH);
        return h;
    }

    var A4W = 1654;
    var A4H = 2339;

    function drawA4Page(canvas, model, meta, logoCanvas, group) {
        var weekDays = model.days;
        var w = A4W;
        var h = A4H;
        var pad = 72;
        var innerW = w - pad * 2;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#F4F1E8';
        ctx.fillRect(0, 0, w, h);
        drawLeaf(ctx, 16, 110, -0.5, 1.7, 0.12);
        drawLeaf(ctx, 70, 130, 0.35, 1.2, 0.1);
        drawLeaf(ctx, w - 24, h - 40, 2.6, 2.0, 0.12);
        drawLeaf(ctx, w - 90, h - 16, 3.3, 1.3, 0.1);

        drawBrandLogo(ctx, pad + 44, 88, 96, logoCanvas);
        ctx.fillStyle = INK;
        ctx.font = '800 56px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Reed', pad + 104, 78);
        ctx.font = '700 24px sans-serif';
        ctx.fillText('Grade ' + meta.grade + '  ·  ' + (meta.name || 'Student'), pad + 104, 112);
        ctx.globalAlpha = 0.65;
        ctx.font = '600 20px sans-serif';
        ctx.fillText((meta.weekLabel || '') + '  ·  A4', pad + 104, 142);
        ctx.globalAlpha = 1;

        var headerEnd = 168;
        var footer = 56;
        var titleH = 52;
        var tableHeader = 64;
        var bodyTarget = h - pad - headerEnd - titleH - tableHeader - footer;
        if (group.days.length > 2) {
            var rows = tableRows(weekDays, group.days);
            var natural = rows.reduce(function (a, r) { return a + rowHFor(r); }, 0);
            if (natural > bodyTarget) bodyTarget = natural;
        }

        drawTable(ctx, pad, headerEnd, innerW, group.days, weekDays, group.title, bodyTarget);

        ctx.fillStyle = INK;
        ctx.globalAlpha = 0.55;
        ctx.font = '600 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Reed · print this A4 page', w / 2, h - 28);
        ctx.globalAlpha = 1;
        return canvas;
    }

    function drawPoster(canvas, model, meta, logoCanvas) {
        return drawA4Page(canvas, model, meta, logoCanvas, chartGroups()[0]);
    }

    function weekLabel() {
        return 'This week';
    }

    function targetMonday(api) {
        if (api && typeof api.planningMonday === 'function') return api.planningMonday();
        return api && api.monday ? api.monday() : '';
    }

    function weekFor(answers, api) {
        return (answers && answers.week) || targetMonday(api);
    }

    function canChangePlan(saved, api) {
        return !hasWeekPlan(saved, targetMonday(api), api);
    }

    function timeSelectHtml(from, to, selected) {
        var html = '';
        for (var m = from; m <= to; m += 15) {
            html += '<option value="' + m + '"' + (m === selected ? ' selected' : '') + '>' + minsToLabel(m) + '</option>';
        }
        return html;
    }

    function paidSubjects(api) {
        var list = (api.getSubjects() || []).filter(function (s) { return api.isPaid(s.id); });
        if (!list.length && api.isPaid('all')) list = (api.getSubjects() || []).slice();
        return list;
    }

    function telegramUserId(api) {
        if (api && api.userId) return String(api.userId);
        try {
            var u = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user;
            if (u && u.id != null) return String(u.id);
        } catch (e) {}
        return '';
    }
    function storageKey(grade, userId) {
        return 'reed_timetable_v2_u' + String(userId || '') + '_g' + grade;
    }
    function wipeLegacyTimetables() {
        var drop = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.indexOf('reed_timetable_v1') === 0) drop.push(k);
        }
        drop.forEach(function (k) { localStorage.removeItem(k); });
    }
    function loadAnswers(grade, api) {
        var uid = telegramUserId(api);
        if (!uid) return null;
        try {
            var cur = JSON.parse(localStorage.getItem(storageKey(grade, uid)) || 'null');
            if (!cur || String(cur.userId || '') !== uid) return null;
            return cur;
        } catch (e) { return null; }
    }
    function saveAnswers(grade, answers, api) {
        var uid = telegramUserId(api);
        if (!uid) return;
        answers.userId = uid;
        localStorage.setItem(storageKey(grade, uid), JSON.stringify(answers));
    }
    function clearPreview() {
        [0, 1].forEach(function (i) {
            var img = document.getElementById('tt-preview-' + i) || (i === 0 ? document.getElementById('tt-preview') : null);
            if (!img) return;
            if (img._url) {
                try { URL.revokeObjectURL(img._url); } catch (e) {}
            }
            img._url = '';
            img._blob = null;
            img._httpsUrl = '';
            img.removeAttribute('src');
        });
    }

    function showPanel(id) {
        ['tt-lock', 'tt-ask', 'tt-think', 'tt-result'].forEach(function (pid) {
            var el = document.getElementById(pid);
            if (el) el.hidden = pid !== id;
        });
    }

    function setChips(container, selected) {
        container.querySelectorAll('.tt-chip').forEach(function (ch) {
            var on = selected.indexOf(parseInt(ch.getAttribute('data-day'), 10)) !== -1;
            ch.classList.toggle('on', on);
        });
    }

    function readDays(container) {
        return Array.prototype.map.call(container.querySelectorAll('.tt-chip.on'), function (ch) {
            return parseInt(ch.getAttribute('data-day'), 10);
        }).filter(function (n) { return n >= 0; });
    }

    function dayChips(selected) {
        return DAYS.map(function (label, i) {
            return '<button type="button" class="tt-chip' + (selected.indexOf(i) !== -1 ? ' on' : '') + '" data-day="' + i + '">' + label + '</button>';
        }).join('');
    }

    function pageFileName(i) {
        return i === 1 ? 'REED-timetable-Sat-Sun-A4.png' : 'REED-timetable-Mon-Fri-A4.png';
    }

    function setPreviewImage(img, blob, canvas) {
        if (!img) return;
        if (img._url) {
            try { URL.revokeObjectURL(img._url); } catch (e) {}
        }
        img._httpsUrl = '';
        if (blob) {
            img._url = URL.createObjectURL(blob);
            img.src = img._url;
            img._blob = blob;
        } else {
            img.src = canvas.toDataURL('image/png');
            img._blob = null;
        }
    }

    function makePages(api, answers, logoCanvas) {
        var grade = api.getGrade();
        var monday = weekFor(answers, api);
        var seed = hashStr(String(api.userId) + ':' + monday + ':' + grade);
        var model = buildWeek(answers, seed);
        var meta = {
            grade: grade,
            name: answers.name,
            weekLabel: weekLabel(monday)
        };
        return chartGroups().map(function (g) {
            return drawA4Page(document.createElement('canvas'), model, meta, logoCanvas, g);
        });
    }

    function makePoster(api, answers, logoCanvas) {
        return makePages(api, answers, logoCanvas)[0];
    }

    function showResult(api, answers, thinking) {
        if (thinking) showPanel('tt-think');
        loadLogo(function (logoCanvas) {
            var pages = makePages(api, answers, logoCanvas);
            var weekEl = document.getElementById('tt-week-note');
            var monday = weekFor(answers, api);
            if (weekEl) {
                weekEl.textContent = canChangePlan(answers, api)
                    ? (weekLabel(monday) + ' · ထားခဲ့နိုင်သည်။ စနေမှ နောက်အပတ်ကို ပြန်ဆွဲနိုင်ပါတယ်')
                    : (weekLabel(monday) + ' · ဒီအပတ် တစ်ကြိမ်သာ ဆွဲနိုင်ပါတယ်');
            }
            var retakeBtn = document.getElementById('tt-retake');
            if (retakeBtn) retakeBtn.hidden = !canChangePlan(answers, api);
            var left = pages.length;
            pages.forEach(function (canvas, i) {
                var img = document.getElementById('tt-preview-' + i);
                var done = function (blob) {
                    setPreviewImage(img, blob, canvas);
                    left--;
                    if (left <= 0) showPanel('tt-result');
                };
                if (canvas.toBlob) canvas.toBlob(done, 'image/png');
                else done(null);
            });
        });
    }

    function openAsk(api, draft) {
        clearPreview();
        showPanel('tt-ask');
        var answers = draft || {
            steam: getSteam(api),
            name: (api.defaultName() || 'Student').slice(0, 40),
            schoolDays: [0, 1, 2, 3, 4],
            schoolStart: 7 * 60 + 30,
            schoolEnd: 13 * 60,
            hasTuition: false,
            tuitionDays: [0, 1, 2, 3, 4],
            tuitionStart: 16 * 60,
            tuitionEnd: 19 * 60,
            hasTuition2: false,
            tuition2Start: 20 * 60,
            tuition2End: 23 * 60,
            dayStart: 6 * 60,
            dayEnd: 23 * 60,
            restStart: 18 * 60,
            restEnd: 19 * 60,
            restLabel: 'Dinner + Rest',
            shortRest: true,
            shortRestMins: 15,
            weakSubjects: [],
            strongSubjects: [],
            subjects: []
        };
        if (!answers.steam) answers.steam = getSteam(api);
        if (!answers.weakSubjects) answers.weakSubjects = [];
        if (!answers.strongSubjects) answers.strongSubjects = [];
        if (typeof answers.shortRest !== 'boolean') answers.shortRest = true;
        if (!answers.shortRestMins) answers.shortRestMins = 15;
        var step = 0;

        function steps() {
            var s = [
                { id: 'steam', title: 'STEAM ဘယ်လမ်းလဲ။' },
                { id: 'name', title: 'Timetable ပေါ်မှာ နာမည် ဘယ်လိုရေးမလဲ။' },
                { id: 'schoolDays', title: 'ဘယ်နေ့တွေ ကျောင်းတက်လဲ။' }
            ];
            if ((answers.schoolDays || []).length) {
                s.push({ id: 'schoolHours', title: 'ကျောင်းနာရီ ဘယ်အချိန်လဲ။' });
            }
            s.push({ id: 'tuition', title: 'Tuition / extra class ရှိလား။' });
            if (answers.hasTuition) {
                s.push({ id: 'tuitionHours', title: 'Tuition ရှိတဲ့နေ့ နဲ့ နာရီ။' });
            }
            s.push({ id: 'wake', title: 'မနက် ဘယ်အချိန် စပီး လေ့လာမလဲ။' });
            s.push({ id: 'sleep', title: 'ည ဘယ်အချိန် အိပ်မလဲ။' });
            s.push({ id: 'rest', title: 'ထမင်းစား / နားချိန်' });
            s.push({ id: 'shortRest', title: 'ရှည်လျားတဲ့ ကျက်ချိန်ပြီးရင် ခဏနားမလား။' });
            s.push({ id: 'weak', title: 'ဒီအပတ် အားနည်းတဲ့ ဘာသာရပ်များ' });
            s.push({ id: 'strong', title: 'ဒီအပတ် အားကောင်းတဲ့ ဘာသာရပ်များ' });
            return s;
        }

        function paint() {
            var list = steps();
            if (step < 0) step = 0;
            if (step >= list.length) {
                answers.week = targetMonday(api);
                answers.subjects = weekSubjects(answers);
                saveAnswers(api.getGrade(), answers, api);
                showPanel('tt-think');
                setTimeout(function () { showResult(api, answers, false); }, 900);
                return;
            }
            var cur = list[step];
            document.getElementById('tt-step-note').textContent = (step + 1) + ' / ' + list.length;
            document.getElementById('tt-q').textContent = cur.title;
            var body = document.getElementById('tt-body');
            var html = '';
            if (cur.id === 'steam') {
                var st = steamId(answers);
                html = '<p class="tt-help">Grade 10, 11, 12 အားလုံး STEAM 1 ဒါမှမဟုတ် STEAM 2 ရွေးပါ။</p>' +
                    '<div class="tt-yesno" id="tt-steam">' +
                    '<button type="button" class="tt-chip' + (st === 1 ? ' on' : '') + '" data-v="1">STEAM 1 · Bio</button>' +
                    '<button type="button" class="tt-chip' + (st === 2 ? ' on' : '') + '" data-v="2">STEAM 2 · Eco</button>' +
                    '</div><p class="tt-help" id="tt-steam-note">' + steamHelp(st) + '</p>';
            } else if (cur.id === 'name') {
                html = '<input class="quiz-input tt-input" id="tt-name" maxlength="40" value="' + String(answers.name || '').replace(/"/g, '&quot;') + '">';
            } else if (cur.id === 'schoolDays') {
                html = '<p class="tt-help">မတက်ရင် တစ်နေ့မှ မရွေးပါနဲ့။</p><div class="tt-chips" id="tt-school-days">' + dayChips(answers.schoolDays || []) + '</div>';
            } else if (cur.id === 'schoolHours') {
                html = '<div class="tt-presets">' +
                    [['7:30 AM – 1:00 PM', 450, 780], ['8:00 AM – 2:30 PM', 480, 870], ['8:00 AM – 4:00 PM', 480, 960], ['9:00 AM – 5:00 PM', 540, 1020]].map(function (p) {
                        return '<button type="button" class="tt-chip tt-preset" data-a="' + p[1] + '" data-b="' + p[2] + '">' + p[0] + '</button>';
                    }).join('') + '</div>' +
                    '<div class="tt-times"><label>Start<select id="tt-school-start">' + timeSelectHtml(5 * 60, 12 * 60, answers.schoolStart) + '</select></label>' +
                    '<label>End<select id="tt-school-end">' + timeSelectHtml(10 * 60, 18 * 60, answers.schoolEnd) + '</select></label></div>';
            } else if (cur.id === 'tuition') {
                html = '<div class="tt-yesno"><button type="button" class="tt-chip' + (answers.hasTuition ? ' on' : '') + '" data-v="1">ရှိတယ်</button>' +
                    '<button type="button" class="tt-chip' + (!answers.hasTuition ? ' on' : '') + '" data-v="0">မရှိဘူး</button></div>';
            } else if (cur.id === 'tuitionHours') {
                html = '<p class="tt-help">၂ ခုရှိရင် Add နှိပ်ပြီး နောက်ထပ် အချိန်ထည့်ပါ။</p>' +
                    '<div class="tt-chips" id="tt-tu-days">' + dayChips(answers.tuitionDays || [0, 1, 2, 3, 4]) + '</div>' +
                    '<p class="tt-print-label">Tuition 1</p>' +
                    '<div class="tt-times"><label>Start<select id="tt-tu-start">' + timeSelectHtml(6 * 60, 22 * 60, answers.tuitionStart) + '</select></label>' +
                    '<label>End<select id="tt-tu-end">' + timeSelectHtml(8 * 60, 24 * 60, answers.tuitionEnd) + '</select></label></div>' +
                    '<div id="tt-tu2-block"' + (answers.hasTuition2 ? '' : ' hidden') + '>' +
                    '<p class="tt-print-label">Tuition 2</p>' +
                    '<div class="tt-times"><label>Start<select id="tt-tu2-start">' + timeSelectHtml(12 * 60, 22 * 60, answers.tuition2Start || 20 * 60) + '</select></label>' +
                    '<label>End<select id="tt-tu2-end">' + timeSelectHtml(14 * 60, 24 * 60, answers.tuition2End || 23 * 60) + '</select></label></div>' +
                    '<button type="button" class="tt-chip tt-add-tu" id="tt-tu2-remove">Tuition 2 ဖယ်ရှားမည်</button>' +
                    '</div>' +
                    '<button type="button" class="tt-chip tt-add-tu" id="tt-tu-add"' + (answers.hasTuition2 ? ' hidden' : '') + '>+ Tuition ထပ်ထည့်မည်</button>';
            } else if (cur.id === 'wake') {
                html = '<select class="tt-select" id="tt-wake">' + timeSelectHtml(5 * 60, 9 * 60, answers.dayStart) + '</select>';
            } else if (cur.id === 'sleep') {
                html = '<select class="tt-select" id="tt-sleep">' + timeSelectHtml(20 * 60, 24 * 60, answers.dayEnd) + '</select>';
            } else if (cur.id === 'rest') {
                html = '<div class="tt-presets">' +
                    [['5:00 – 6:00 PM', 17 * 60, 18 * 60, 'Dinner + Rest'], ['6:00 – 7:00 PM', 18 * 60, 19 * 60, 'Dinner + Rest'], ['7:00 – 8:00 PM', 19 * 60, 20 * 60, 'Dinner + Break'], ['10:00 – 10:30 PM', 22 * 60, 22 * 60 + 30, 'Dinner + Rest']].map(function (p) {
                        return '<button type="button" class="tt-chip tt-preset" data-a="' + p[1] + '" data-b="' + p[2] + '" data-l="' + p[3] + '">' + p[0] + '</button>';
                    }).join('') + '</div>' +
                    '<div class="tt-times"><label>Start<select id="tt-rest-start">' + timeSelectHtml(16 * 60, 23 * 60, answers.restStart) + '</select></label>' +
                    '<label>End<select id="tt-rest-end">' + timeSelectHtml(17 * 60, 24 * 60, answers.restEnd) + '</select></label></div>';
            } else if (cur.id === 'shortRest') {
                html = '<p class="tt-help">၁ နာရီခွဲ ကျက်ပြီးရင် ၁၅ မိနစ် Rest ထည့်မယ်။</p>' +
                    '<div class="tt-yesno"><button type="button" class="tt-chip' + (answers.shortRest ? ' on' : '') + '" data-v="1">ထည့်မယ်</button>' +
                    '<button type="button" class="tt-chip' + (!answers.shortRest ? ' on' : '') + '" data-v="0">မထည့်ဘူး</button></div>';
            } else if (cur.id === 'weak') {
                html = '<p class="tt-help">ဒီအပတ် အချိန်ပိုပေးမယ့် ဘာသာရပ်များ။ STEAM ' + steamId(answers) + ' ထဲက ရွေးပါ။</p><div class="tt-subs" id="tt-weak">' +
                    steamSubjectList(api, answers).map(function (s) {
                        var on = answers.weakSubjects.indexOf(s.id) !== -1;
                        return '<button type="button" class="tt-chip' + (on ? ' on' : '') + '" data-sub="' + s.id + '">' + s.name + '</button>';
                    }).join('') + '</div>';
            } else if (cur.id === 'strong') {
                html = '<p class="tt-help">အားနည်းတဲ့ထဲ ရွေးပြီးသား မပါပါ။ မရွေးလည်း ရပါတယ်။</p><div class="tt-subs" id="tt-strong">' +
                    steamSubjectList(api, answers).filter(function (s) {
                        return answers.weakSubjects.indexOf(s.id) === -1;
                    }).map(function (s) {
                        var on = answers.strongSubjects.indexOf(s.id) !== -1;
                        return '<button type="button" class="tt-chip' + (on ? ' on' : '') + '" data-sub="' + s.id + '">' + s.name + '</button>';
                    }).join('') + '</div>';
            }
            body.innerHTML = html;
            document.getElementById('tt-back-q').style.visibility = step ? 'visible' : 'hidden';
            document.getElementById('tt-next-q').textContent = step === list.length - 1 ? '✨ Timetable ဆွဲမည်' : 'ဆက်မည်';

            body.querySelectorAll('#tt-school-days .tt-chip, #tt-tu-days .tt-chip').forEach(function (ch) {
                ch.onclick = function () { ch.classList.toggle('on'); };
            });
            body.querySelectorAll('.tt-presets .tt-preset').forEach(function (ch) {
                ch.onclick = function () {
                    var a = parseInt(ch.getAttribute('data-a'), 10);
                    var b = parseInt(ch.getAttribute('data-b'), 10);
                    var map = {
                        schoolHours: ['tt-school-start', 'tt-school-end'],
                        rest: ['tt-rest-start', 'tt-rest-end']
                    };
                    var ids = map[cur.id];
                    if (ids) {
                        document.getElementById(ids[0]).value = String(a);
                        document.getElementById(ids[1]).value = String(b);
                    }
                    if (cur.id === 'rest' && ch.getAttribute('data-l')) answers.restLabel = ch.getAttribute('data-l');
                    body.querySelectorAll('.tt-preset').forEach(function (x) { x.classList.remove('on'); });
                    ch.classList.add('on');
                };
            });
            body.querySelectorAll('.tt-yesno .tt-chip').forEach(function (ch) {
                ch.onclick = function () {
                    body.querySelectorAll('.tt-yesno .tt-chip').forEach(function (x) { x.classList.remove('on'); });
                    ch.classList.add('on');
                    if (cur.id === 'steam') {
                        var picked = ch.getAttribute('data-v') === '2' ? 2 : 1;
                        var note = document.getElementById('tt-steam-note');
                        if (note) note.textContent = steamHelp(picked);
                        setSteam(api, picked);
                    }
                };
            });
            var addTu = document.getElementById('tt-tu-add');
            var remTu = document.getElementById('tt-tu2-remove');
            var tu2 = document.getElementById('tt-tu2-block');
            function showTu2(on) {
                answers.hasTuition2 = !!on;
                if (tu2) tu2.hidden = !on;
                if (addTu) addTu.hidden = !!on;
            }
            if (addTu) addTu.onclick = function () { showTu2(true); };
            if (remTu) remTu.onclick = function () { showTu2(false); };
            body.querySelectorAll('#tt-subs .tt-chip, #tt-weak .tt-chip, #tt-strong .tt-chip').forEach(function (ch) {
                ch.onclick = function () { ch.classList.toggle('on'); };
            });
        }

        function collect() {
            var list = steps();
            var cur = list[step];
            if (!cur) return true;
            if (cur.id === 'steam') {
                var steamChip = document.querySelector('#tt-steam .tt-chip.on');
                answers.steam = steamChip && steamChip.getAttribute('data-v') === '2' ? 2 : 1;
                setSteam(api, answers.steam);
                answers.weakSubjects = (answers.weakSubjects || []).filter(function (id) { return inSteam(answers, id); });
                answers.strongSubjects = (answers.strongSubjects || []).filter(function (id) { return inSteam(answers, id); });
            } else if (cur.id === 'name') {
                var n = (document.getElementById('tt-name').value || '').trim();
                if (!n) { api.alert('နာမည် ရိုက်ထည့်ပါ။'); return false; }
                answers.name = n;
            } else if (cur.id === 'schoolDays') {
                answers.schoolDays = readDays(document.getElementById('tt-school-days'));
            } else if (cur.id === 'schoolHours') {
                answers.schoolStart = parseTime(document.getElementById('tt-school-start').value);
                answers.schoolEnd = parseTime(document.getElementById('tt-school-end').value);
                if (answers.schoolEnd <= answers.schoolStart) { api.alert('ကျောင်းဆင်းချိန်က စချိန်ထက် နောက်ကျရပါမယ်။'); return false; }
            } else if (cur.id === 'tuition') {
                var yes = document.querySelector('.tt-yesno .tt-chip.on');
                answers.hasTuition = !!(yes && yes.getAttribute('data-v') === '1');
                if (!answers.hasTuition) answers.hasTuition2 = false;
            } else if (cur.id === 'tuitionHours') {
                answers.tuitionDays = readDays(document.getElementById('tt-tu-days'));
                answers.tuitionStart = parseTime(document.getElementById('tt-tu-start').value);
                answers.tuitionEnd = parseTime(document.getElementById('tt-tu-end').value);
                if (!answers.tuitionDays.length) { api.alert('Tuition ရှိတဲ့နေ့ ရွေးပါ။'); return false; }
                if (answers.tuitionEnd <= answers.tuitionStart) { api.alert('Tuition ပြီးချိန်က စချိန်ထက် နောက်ကျရပါမယ်။'); return false; }
                var tu2Box = document.getElementById('tt-tu2-block');
                answers.hasTuition2 = !!(tu2Box && !tu2Box.hidden);
                if (answers.hasTuition2) {
                    answers.tuition2Start = parseTime(document.getElementById('tt-tu2-start').value);
                    answers.tuition2End = parseTime(document.getElementById('tt-tu2-end').value);
                    if (answers.tuition2End <= answers.tuition2Start) { api.alert('Tuition 2 ပြီးချိန်က စချိန်ထက် နောက်ကျရပါမယ်။'); return false; }
                }
            } else if (cur.id === 'wake') {
                answers.dayStart = parseTime(document.getElementById('tt-wake').value);
            } else if (cur.id === 'sleep') {
                answers.dayEnd = parseTime(document.getElementById('tt-sleep').value);
                if (answers.dayEnd <= answers.dayStart) { api.alert('အိပ်ချိန်က မနက်စချိန်ထက် နောက်ကျရပါမယ်။'); return false; }
            } else if (cur.id === 'rest') {
                answers.restStart = parseTime(document.getElementById('tt-rest-start').value);
                answers.restEnd = parseTime(document.getElementById('tt-rest-end').value);
                if (answers.restEnd <= answers.restStart) { api.alert('နားချိန် ပြီးချိန်က စချိန်ထက် နောက်ကျရပါမယ်။'); return false; }
            } else if (cur.id === 'shortRest') {
                var restYes = document.querySelector('.tt-yesno .tt-chip.on');
                answers.shortRest = !!(restYes && restYes.getAttribute('data-v') === '1');
                answers.shortRestMins = 15;
            } else if (cur.id === 'weak') {
                answers.weakSubjects = Array.prototype.map.call(document.querySelectorAll('#tt-weak .tt-chip.on'), function (ch) {
                    return ch.getAttribute('data-sub');
                });
                if (!answers.weakSubjects.length) { api.alert('အားနည်းတဲ့ ဘာသာရပ် အနည်းဆုံး ၁ ခု ရွေးပါ။'); return false; }
                answers.strongSubjects = (answers.strongSubjects || []).filter(function (id) {
                    return answers.weakSubjects.indexOf(id) === -1;
                });
            } else if (cur.id === 'strong') {
                answers.strongSubjects = Array.prototype.map.call(document.querySelectorAll('#tt-strong .tt-chip.on'), function (ch) {
                    return ch.getAttribute('data-sub');
                });
                answers.subjects = weekSubjects(answers);
            }
            return true;
        }

        document.getElementById('tt-next-q').onclick = function () {
            if (!collect()) return;
            step++;
            paint();
        };
        document.getElementById('tt-back-q').onclick = function () {
            collect();
            step--;
            paint();
        };
        paint();
    }

    function webApp() {
        return (window.Telegram && window.Telegram.WebApp) || null;
    }

    function blobToBase64(blob) {
        return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onloadend = function () {
                var s = String(fr.result || '');
                var i = s.indexOf('base64,');
                resolve(i >= 0 ? s.slice(i + 7) : s);
            };
            fr.onerror = function () { reject(fr.error || new Error('read failed')); };
            fr.readAsDataURL(blob);
        });
    }

    function parseJsonish(text) {
        var s = String(text || '').trim();
        try { return JSON.parse(s); } catch (e) {}
        var a = s.indexOf('{');
        var b = s.lastIndexOf('}');
        if (a >= 0 && b > a) {
            try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) {}
        }
        return null;
    }

    function httpsUrl(text) {
        var t = String(text || '').trim().split(/\s+/)[0];
        return t.indexOf('https://') === 0 ? t : '';
    }

    function fetchTimeout(url, opts, ms) {
        opts = opts || {};
        ms = ms || 12000;
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = setTimeout(function () {
            try { if (ctrl) ctrl.abort(); } catch (e) {}
        }, ms);
        if (ctrl) opts.signal = ctrl.signal;
        return fetch(url, opts).then(function (r) {
            clearTimeout(timer);
            return r;
        }, function (err) {
            clearTimeout(timer);
            throw err;
        });
    }

    function uploadLitterboxDirect(blob, fileName) {
        var fd = new FormData();
        fd.append('reqtype', 'fileupload');
        fd.append('time', '24h');
        fd.append('fileToUpload', blob, fileName || 'REED-timetable.png');
        return fetchTimeout('https://litterbox.catbox.moe/resources/internals/api.php', {
            method: 'POST',
            body: fd
        }, 10000).then(function (r) { return r.text(); }).then(function (t) {
            return httpsUrl(t);
        }).catch(function () { return ''; });
    }

    function uploadTmpfilesDirect(blob, fileName) {
        var fd = new FormData();
        fd.append('file', blob, fileName || 'REED.png');
        return fetchTimeout('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: fd
        }, 12000).then(function (r) { return r.text(); }).then(function (t) {
            var data = parseJsonish(t) || {};
            var u = (data.data && (data.data.url || data.data.link)) || data.url || '';
            u = String(u || '').replace('http://', 'https://');
            if (u.indexOf('tmpfiles.org/') >= 0 && u.indexOf('/dl/') < 0) {
                u = u.replace('://tmpfiles.org/', '://tmpfiles.org/dl/');
            }
            return httpsUrl(u);
        }).catch(function () { return ''; });
    }

    function uploadViaGas(api, blob, fileName) {
        var url = api && api.uploadUrl;
        if (!url) return Promise.resolve({ url: '', sentToChat: false });
        return blobToBase64(blob).then(function (b64) {
            return fetchTimeout(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'uploadTimetable',
                    png: b64,
                    fileName: fileName,
                    userId: telegramUserId(api)
                })
            }, 45000);
        }).then(function (r) { return r.text(); }).then(function (t) {
            var data = parseJsonish(t) || {};
            var hosted = httpsUrl(data.url);
            if (data.status !== 'ok' || (!hosted && !data.sentToChat)) {
                return { url: '', sentToChat: false };
            }
            return { url: hosted, sentToChat: !!data.sentToChat };
        }).catch(function () {
            return { url: '', sentToChat: false };
        });
    }

    function hostPng(api, blob, fileName) {
        return uploadViaGas(api, blob, fileName).then(function (g) {
            g = g || { url: '', sentToChat: false };
            if (g.sentToChat) return g;
            return uploadLitterboxDirect(blob, fileName).then(function (url) {
                return url || uploadTmpfilesDirect(blob, fileName) || g.url || '';
            }).then(function (url) {
                return { url: url || '', sentToChat: false };
            });
        }).catch(function () {
            return { url: '', sentToChat: false };
        });
    }

    function openHttpsFile(fileUrl) {
        if (!fileUrl) return false;
        var tg = webApp();
        try {
            if (tg && typeof tg.openLink === 'function') {
                tg.openLink(fileUrl, { try_instant_view: false });
                return true;
            }
        } catch (e) {}
        try {
            window.open(fileUrl, '_blank');
            return true;
        } catch (e2) {}
        return false;
    }

    function asPngBlob(blob) {
        if (!blob) return blob;
        try {
            if (blob.type === 'image/png') return blob;
            return new Blob([blob], { type: 'image/png' });
        } catch (e) {
            return blob;
        }
    }

    function tryBlobSave(blob, fileName) {
        return new Promise(function (resolve) {
            if (!blob) { resolve(false); return; }
            try {
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = fileName || 'REED.png';
                a.rel = 'noopener';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(function () {
                    try { URL.revokeObjectURL(url); a.remove(); } catch (e) {}
                }, 2500);
                resolve(true);
            } catch (e2) {
                resolve(false);
            }
        });
    }

    function setDlState(idx, busy, label) {
        var btn = document.getElementById('tt-dl-' + idx);
        if (!btn) return;
        if (!btn._label) btn._label = btn.textContent;
        btn.disabled = !!busy;
        btn.textContent = label || btn._label;
    }

    function tellSaved(api, sentToChat, openedLink, kind) {
        if (!api || !api.alert) return;
        if (sentToChat) {
            if (kind === 'timetable') api.alert('Timetable ကို Telegram chat ထဲ ပို့လိုက်ပါတယ်။ Chat မှာ ဖွင့်ပြီး Save လုပ်ပါ။');
            else api.alert('ပုံကို Telegram chat ထဲ ပို့လိုက်ပါတယ်။ Chat မှာ ဖွင့်ပြီး Save လုပ်ပါ။');
            return;
        }
        if (openedLink) {
            api.alert('ပုံကို browser မှာ ဖွင့်လိုက်ပါတယ်။ Long press ပြီး Save image လုပ်ပါ။');
        }
    }

    function saveImage(api, blob, fileName, onState) {
        api = api || {};
        fileName = fileName || 'REED.png';
        onState = onState || function () {};
        blob = asPngBlob(blob);
        if (!blob) return Promise.resolve({ ok: false, url: '', sentToChat: false });
        onState(true, 'Sending…');
        return hostPng(api, blob, fileName).then(function (hosted) {
            hosted = hosted || { url: '', sentToChat: false };
            if (hosted.sentToChat) {
                return { ok: true, url: hosted.url || '', sentToChat: true, openedLink: false };
            }
            if (hosted.url && openHttpsFile(hosted.url)) {
                return { ok: true, url: hosted.url, sentToChat: false, openedLink: true };
            }
            return tryBlobSave(blob, fileName).then(function (ok) {
                return { ok: ok, url: hosted.url || '', sentToChat: false, openedLink: false };
            });
        }).then(function (result) {
            onState(false);
            return result;
        }, function () {
            onState(false);
            return { ok: false, url: '', sentToChat: false, openedLink: false };
        });
    }

    function downloadBlob(blob, fileName, api, onState) {
        api = api || (typeof window.timetableApi === 'function' ? window.timetableApi() : {});
        fileName = fileName || 'REED.png';
        if (!blob) {
            if (api && api.alert) api.alert('ပုံ မရသေးပါ။ ခဏစောင့်ပြီး ထပ်နှိပ်ပါ။');
            return Promise.resolve({ url: '', sentToChat: false });
        }
        return saveImage(api, blob, fileName, onState).then(function (result) {
            if (!result.ok) {
                if (api && api.alert) api.alert('ဖုန်းထဲ သိမ်းမရပါ။ အင်တာနက် ဖွင့်ပြီး ထပ်နှိပ်ပါ။');
            } else {
                tellSaved(api, result.sentToChat, result.openedLink, 'image');
            }
            return { url: result.url || '', sentToChat: !!result.sentToChat };
        });
    }

    function downloadPreview(api, which) {
        if (typeof api === 'number' || api == null) {
            which = api;
            api = (typeof window.timetableApi === 'function' ? window.timetableApi() : {});
        }
        var idx = parseInt(which, 10);
        if (idx !== 1) idx = 0;
        var img = document.getElementById('tt-preview-' + idx);
        var blob = img && img._blob;
        var name = pageFileName(idx);

        if (!blob) {
            if (api && api.alert) api.alert('ပုံ မရသေးပါ။ ခဏစောင့်ပြီး ထပ်နှိပ်ပါ။');
            return;
        }
        saveImage(api, blob, name, function (busy, label) {
            setDlState(idx, busy, label);
        }).then(function (result) {
            if (img && result && result.url) img._httpsUrl = result.url;
            if (!result.ok) {
                if (api && api.alert) api.alert('ဖုန်းထဲ သိမ်းမရပါ။ အင်တာနက် ဖွင့်ပြီး ထပ်နှိပ်ပါ။');
            } else {
                tellSaved(api, result.sentToChat, result.openedLink, 'timetable');
            }
        });
    }

    function savePng(blob, fileName, api) {
        return downloadBlob(blob, fileName, api);
    }

    function hasWeekPlan(saved, monday, api) {
        var uid = telegramUserId(api);
        if (!saved || !uid || !monday) return false;
        if (String(saved.userId || '') !== uid) return false;
        if (saved.week !== monday) return false;
        if (saved.steam !== 1 && saved.steam !== 2) return false;
        return weekSubjects(saved).length > 0;
    }

    function openTab(api) {
        wipeLegacyTimetables();
        var grade = api.getGrade();
        var paid = paidSubjects(api);
        if (paid.length < MIN_SUBJECTS && !api.isPaid('all')) {
            clearPreview();
            document.getElementById('tt-lock-count').textContent = String(paid.length);
            showPanel('tt-lock');
            return;
        }
        var monday = api.monday();
        var saved = loadAnswers(grade, api);
        if (hasWeekPlan(saved, monday, api) || hasWeekPlan(saved, targetMonday(api), api)) {
            showResult(api, saved, false);
            return;
        }
        openAsk(api, saved && String(saved.userId || '') === telegramUserId(api) ? saved : null);
    }

    root.REEDTimetable = {
        DAYS: DAYS,
        SHORT: SHORT,
        COLORS: COLORS,
        parseTime: parseTime,
        minsToLabel: minsToLabel,
        hashStr: hashStr,
        buildWeek: buildWeek,
        drawPoster: drawPoster,
        weekLabel: weekLabel,
        rangeLabel: rangeLabel,
        openTab: openTab,
        openAsk: openAsk,
        retake: function (api) {
            var saved = loadAnswers(api.getGrade(), api);
            if (!canChangePlan(saved, api)) {
                api.alert('ဒီအပတ် Timetable ကို ဆွဲပြီးပါပြီ။ နောက်အပတ် တနင်္လာမှ အသစ်ဆွဲနိုင်ပါတယ်။');
                if (saved) showResult(api, saved, false);
                return;
            }
            openAsk(api, saved || undefined);
        },
        downloadPreview: downloadPreview,
        downloadBlob: downloadBlob,
        savePng: savePng,
        getSteam: getSteam,
        setSteam: setSteam
    };
})(typeof window !== 'undefined' ? window : globalThis);
