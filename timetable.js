/* REED weekly timetable — rule-based planner that feels like AI. */
(function (root) {
    var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    var SHORT = {
        mm: 'Myan', en: 'Eng', math: 'Math', phy: 'Phys',
        chem: 'Chem', bio: 'Bio', eco: 'Eco'
    };
    var FOCUS = {
        en: ['Grammar / Text', 'Essay / letter', 'Text / Poem', 'Questions / Essay'],
        mm: ['စကားပြေ / ကဗျာ', 'ရေးသည် / ခက်ဆစ်', 'စာစီစာကုံး / အဆို'],
        math: ['Practice', 'Past paper', 'Formula drill'],
        phy: ['ကျက်စာ / တွက်စာ', 'Notes / Calculating'],
        chem: ['ကျက်စာ / တွက်စာ', 'Memorizing / Calculating'],
        bio: ['Notes / Diagram', 'ကျက်စာ / Review'],
        eco: ['Notes / MCQ', 'Essay']
    };
    var COLORS = {
        school: '#C5E38A',
        rest: '#9FD4F0',
        brk: '#7EDCE2',
        tuition: '#B7E0C2',
        study: '#FFD7B5',
        dinner: '#B8D4C8',
        homework: '#E6D4F5'
    };

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
        if (aAp === bAp) return left + ' – ' + right + ' ' + bAp;
        return minsToLabel(a) + ' – ' + minsToLabel(b === 1440 ? 0 : b);
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
    function subjectMeta(id, seed, slot) {
        var focus = FOCUS[id] || ['Review'];
        var label = SHORT[id] || id;
        var sub = focus[(seed + slot) % focus.length];
        return { label: label, sub: sub, color: COLORS.study };
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

        if (schoolOn) {
            var schoolLen = answers.schoolEnd - answers.schoolStart;
            var afterMins = schoolLen >= 5 * 60 ? 60 : 30;
            var after = clip({ start: answers.schoolEnd, end: answers.schoolEnd + afterMins, type: 'rest', label: 'Rest', color: COLORS.rest }, dayStart, dayEnd);
            if (after) {
                var busySchool = blocks.map(function (b) { return { start: b.start, end: b.end }; });
                gaps(after.start, after.end, busySchool).forEach(function (g) {
                    if (g.end - g.start >= 15) {
                        blocks.push({ start: g.start, end: g.end, type: 'rest', label: 'Rest', sub: '', color: COLORS.rest });
                    }
                });
            }
        }

        var rest = clip({ start: answers.restStart, end: answers.restEnd, type: 'rest', label: answers.restLabel || 'Rest', color: COLORS.dinner }, dayStart, dayEnd);
        if (rest) {
            var busyNow = blocks.map(function (b) { return { start: b.start, end: b.end }; });
            gaps(rest.start, rest.end, busyNow).forEach(function (g) {
                if (g.end - g.start >= 15) {
                    blocks.push({ start: g.start, end: g.end, type: 'rest', label: answers.restLabel || 'Rest', sub: '', color: COLORS.dinner });
                }
            });
        }

        var free = gaps(dayStart, dayEnd, blocks);
        var slot = dayIndex * 7;
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
            function fill(a, b) {
                var t = a;
                while (b - t >= 20) {
                    var left = b - t;
                    if (left < 35) {
                        blocks.push({ start: t, end: b, type: 'brk', label: left <= 20 ? 'Break' : 'Rest', sub: '', color: left <= 20 ? COLORS.brk : COLORS.rest });
                        break;
                    }
                    var studyLen = 90;
                    if (left < 90) studyLen = left;
                    else if (left <= 110) studyLen = left;
                    else if (left < 120) studyLen = left - 15;
                    var meta = subjectMeta(cycle[(seed + slot) % cycle.length], seed, slot);
                    slot++;
                    var isHw = (slot + seed) % 9 === 0;
                    blocks.push({
                        start: t,
                        end: t + studyLen,
                        type: 'study',
                        label: isHw ? (meta.label + ' + HW') : meta.label,
                        sub: meta.sub,
                        color: isHw ? COLORS.homework : COLORS.study
                    });
                    t += studyLen;
                    if (b - t >= 45) {
                        var br = Math.min(15, b - t - 30);
                        blocks.push({ start: t, end: t + br, type: 'brk', label: 'Break', sub: '', color: COLORS.brk });
                        t += br;
                    }
                }
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
        return blocks;
    }

    function buildWeek(answers, seed) {
        var cycle = seededShuffle(answers.subjects.slice(), seed || 1);
        if (!cycle.length) cycle = ['en'];
        var days = [];
        for (var d = 0; d < 7; d++) days.push(buildDay(answers, d, cycle, seed + d * 13));
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
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (b.start <= start && b.end >= end) return b;
        }
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
    function drawLogo(ctx, cx, cy, r, grade) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#1E3A4C';
        ctx.fill();
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#C9A24A';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#E8D48A';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#F7E27A';
        ctx.beginPath();
        ctx.arc(cx, cy - r * 0.22, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 ' + Math.round(r * 0.42) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('G' + grade, cx, cy + 6);
        ctx.restore();
    }
    function deco(ctx, w, h) {
        var blobs = [
            [0, 80, 140, 'rgba(244,184,200,0.45)'],
            [w, 40, 160, 'rgba(90,120,170,0.18)'],
            [40, h - 40, 90, 'rgba(197,227,138,0.35)'],
            [w - 30, h * 0.55, 70, 'rgba(255,215,181,0.4)']
        ];
        blobs.forEach(function (b) {
            ctx.beginPath();
            ctx.fillStyle = b[3];
            ctx.arc(b[0], b[1], b[2], 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.strokeStyle = 'rgba(90,74,138,0.18)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.72, 28);
        ctx.quadraticCurveTo(w * 0.82, 70, w * 0.9, 36);
        ctx.stroke();
    }

    function tableHeight(rows, rowH) {
        return 48 + rows.length * rowH;
    }

    function drawTable(ctx, x, y, w, dayIdxs, weekDays, headerColor, rowH) {
        var bounds = uniqueBounds(weekDays, dayIdxs);
        var rows = [];
        for (var i = 0; i < bounds.length - 1; i++) {
            if (bounds[i + 1] - bounds[i] >= 10) rows.push({ start: bounds[i], end: bounds[i + 1] });
        }
        if (!rows.length) return 0;
        var timeW = 168;
        var colW = (w - timeW) / dayIdxs.length;
        var headerH = 46;
        var h = headerH + rows.length * rowH;

        rr(ctx, x, y, w, h, 16);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#B9C6D2';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = headerColor;
        rr(ctx, x, y, w, headerH, 16);
        ctx.fill();
        ctx.fillRect(x, y + 16, w, headerH - 16);

        ctx.fillStyle = '#FFF';
        ctx.font = '800 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Time', x + timeW / 2, y + headerH / 2);
        dayIdxs.forEach(function (di, i) {
            ctx.fillText(dayIdxs.length > 2 ? DAYS[di] : DAY_FULL[di], x + timeW + colW * i + colW / 2, y + headerH / 2);
        });

        rows.forEach(function (row, ri) {
            var ry = y + headerH + ri * rowH;
            ctx.fillStyle = ri % 2 ? '#F7FBFE' : '#FFFDF8';
            ctx.fillRect(x, ry, w, rowH);
            ctx.strokeStyle = '#D5DEE6';
            ctx.beginPath();
            ctx.moveTo(x, ry);
            ctx.lineTo(x + w, ry);
            ctx.stroke();
            ctx.fillStyle = '#EEDCC3';
            ctx.fillRect(x, ry, timeW, rowH);
            ctx.fillStyle = '#3A2A1A';
            ctx.font = '700 15px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(fitText(ctx, rangeLabel(row.start, row.end), timeW - 12, 15), x + timeW / 2, ry + rowH / 2);

            var skip = {};
            dayIdxs.forEach(function (di, ci) {
                if (skip[ci]) return;
                var cell = cellAt(weekDays[di], row.start, row.end);
                var span = 1;
                while (ci + span < dayIdxs.length) {
                    var next = cellAt(weekDays[dayIdxs[ci + span]], row.start, row.end);
                    if (!cell && !next) { span++; continue; }
                    if (cell && next && cell.label === next.label && cell.type === next.type) span++;
                    else break;
                }
                for (var k = 1; k < span; k++) skip[ci + k] = 1;
                var cx = x + timeW + ci * colW;
                var cw = colW * span;
                if (cell) {
                    ctx.fillStyle = cell.color || COLORS.study;
                    ctx.fillRect(cx + 2, ry + 2, cw - 4, rowH - 4);
                    ctx.fillStyle = '#1E293B';
                    ctx.textAlign = 'center';
                    ctx.font = '800 16px "Noto Sans Myanmar","Myanmar Text",Padauk,sans-serif';
                    var main = fitText(ctx, cell.label, cw - 10, 16);
                    if (cell.sub && rowH >= 44 && span >= 1) {
                        ctx.fillText(main, cx + cw / 2, ry + rowH / 2 - 8);
                        ctx.font = '600 12px "Noto Sans Myanmar","Myanmar Text",Padauk,sans-serif';
                        ctx.fillStyle = '#334155';
                        ctx.fillText(fitText(ctx, '(' + cell.sub + ')', cw - 10, 12), cx + cw / 2, ry + rowH / 2 + 10);
                    } else {
                        ctx.fillText(main, cx + cw / 2, ry + rowH / 2);
                    }
                }
            });
        });

        ctx.beginPath();
        ctx.moveTo(x + timeW, y);
        ctx.lineTo(x + timeW, y + h);
        ctx.strokeStyle = '#C5D0DA';
        ctx.stroke();
        return h;
    }

    function drawPoster(canvas, model, meta) {
        var weekDays = model.days;
        var weekdayIdx = [0, 1, 2, 3, 4];
        var weekendIdx = [5, 6];
        var w = 1080;
        var pad = 48;
        var innerW = w - pad * 2;
        function countRows(idxs) {
            var b = uniqueBounds(weekDays, idxs);
            var n = 0;
            for (var i = 0; i < b.length - 1; i++) if (b[i + 1] - b[i] >= 10) n++;
            return Math.max(n, 1);
        }
        var rowH = 48;
        var h = 210 + 48 + countRows(weekdayIdx) * rowH + 28 + 48 + countRows(weekendIdx) * rowH + 80;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#D9EEF8';
        ctx.fillRect(0, 0, w, h);
        deco(ctx, w, h);

        ctx.fillStyle = '#1A2330';
        ctx.font = '800 54px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('G' + meta.grade + ' Learning Hub', pad, 78);

        var name = meta.name || 'Student';
        ctx.font = '700 26px "Noto Sans Myanmar","Myanmar Text",Padauk,sans-serif';
        var nw = Math.min(innerW - 180, Math.max(220, ctx.measureText(name).width + 48));
        rr(ctx, pad, 96, nw, 48, 24);
        ctx.fillStyle = '#F4B8C8';
        ctx.fill();
        ctx.fillStyle = '#3B1F2A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fitText(ctx, name, nw - 24, 26), pad + nw / 2, 120);

        drawLogo(ctx, w - pad - 70, 92, 62, meta.grade);

        ctx.fillStyle = '#5B6B7C';
        ctx.font = '600 18px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(meta.weekLabel || '', pad, 168);

        var y = 190;
        y += drawTable(ctx, pad, y, innerW, weekdayIdx, weekDays, '#C9956A', rowH) + 28;
        y += drawTable(ctx, pad, y, innerW, weekendIdx, weekDays, '#5B4B8A', rowH) + 24;

        ctx.fillStyle = '#5B6B7C';
        ctx.font = '600 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('REED Planner · a fresh mix every week · screenshot or Save to keep this poster', w / 2, y + 8);
        return canvas;
    }

    function weekLabel(mondayYmd) {
        if (!mondayYmd) return '';
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        function pretty(ymd) {
            var p = ymd.split('-');
            return parseInt(p[2], 10) + ' ' + months[parseInt(p[1], 10) - 1];
        }
        var end = new Date(Date.parse(mondayYmd + 'T12:00:00+06:30') + 6 * 86400000);
        var ey = end.getFullYear();
        var em = pad(end.getMonth() + 1);
        var ed = pad(end.getDate());
        return 'This week · ' + pretty(mondayYmd) + ' – ' + pretty(ey + '-' + em + '-' + ed);
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

    function storageKey(grade) { return 'reed_timetable_v1_g' + grade; }

    function loadAnswers(grade) {
        try { return JSON.parse(localStorage.getItem(storageKey(grade)) || 'null'); }
        catch (e) { return null; }
    }
    function saveAnswers(grade, answers) {
        localStorage.setItem(storageKey(grade), JSON.stringify(answers));
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

    function makePoster(api, answers) {
        var grade = api.getGrade();
        var monday = api.monday();
        var seed = hashStr(String(api.userId) + ':' + monday + ':' + grade);
        var model = buildWeek(answers, seed);
        var canvas = document.createElement('canvas');
        drawPoster(canvas, model, {
            grade: grade,
            name: answers.name,
            weekLabel: weekLabel(monday)
        });
        return canvas;
    }

    function showResult(api, answers, thinking) {
        var canvas = makePoster(api, answers);
        var img = document.getElementById('tt-preview');
        var weekEl = document.getElementById('tt-week-note');
        if (weekEl) weekEl.textContent = weekLabel(api.monday()) + ' · subjects reshuffle every Monday';
        canvas.toBlob(function (blob) {
            if (!blob) {
                img.src = canvas.toDataURL('image/png');
            } else {
                if (img._url) URL.revokeObjectURL(img._url);
                img._url = URL.createObjectURL(blob);
                img.src = img._url;
                img._blob = blob;
            }
            showPanel('tt-result');
        }, 'image/png');
        if (thinking) showPanel('tt-think');
    }

    function openAsk(api, draft) {
        showPanel('tt-ask');
        var answers = draft || {
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
            subjects: paidSubjects(api).map(function (s) { return s.id; })
        };
        var step = 0;

        function steps() {
            var s = [
                { id: 'name', title: 'Timetable ပေါ်မှာ နာမည် ဘယ်လိုရေးမလဲ။' },
                { id: 'schoolDays', title: 'ဘယ်နေ့တွေ ကျောင်းတက်လဲ။' }
            ];
            if ((answers.schoolDays || []).length) {
                s.push({ id: 'schoolHours', title: 'ကျောင်းနာရီ ဘယ်အချိန်လဲ။' });
            }
            s.push({ id: 'tuition', title: 'Tuition / extra class ရှိလား။' });
            if (answers.hasTuition) {
                s.push({ id: 'tuitionHours', title: 'Tuition ရှိတဲ့နေ့ နဲ့ နာရီ။' });
                s.push({ id: 'tuition2', title: 'ညဘက် Tuition ထပ်ရှိသေးလား။' });
            }
            s.push({ id: 'wake', title: 'မနက် ဘယ်အချိန် စပီး လေ့လာမလဲ။' });
            s.push({ id: 'sleep', title: 'ည ဘယ်အချိန် အိပ်မလဲ။' });
            s.push({ id: 'rest', title: 'ထမင်းစား / နားချိန်' });
            s.push({ id: 'subjects', title: 'Timetable ထဲ ထည့်မယ့် ဘာသာရပ်များ' });
            return s;
        }

        function paint() {
            var list = steps();
            if (step < 0) step = 0;
            if (step >= list.length) {
                saveAnswers(api.getGrade(), answers);
                showPanel('tt-think');
                setTimeout(function () { showResult(api, answers, false); }, 900);
                return;
            }
            var cur = list[step];
            document.getElementById('tt-step-note').textContent = (step + 1) + ' / ' + list.length;
            document.getElementById('tt-q').textContent = cur.title;
            var body = document.getElementById('tt-body');
            var html = '';
            if (cur.id === 'name') {
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
                html = '<div class="tt-chips" id="tt-tu-days">' + dayChips(answers.tuitionDays || [0, 1, 2, 3, 4]) + '</div>' +
                    '<div class="tt-times"><label>Start<select id="tt-tu-start">' + timeSelectHtml(6 * 60, 22 * 60, answers.tuitionStart) + '</select></label>' +
                    '<label>End<select id="tt-tu-end">' + timeSelectHtml(8 * 60, 24 * 60, answers.tuitionEnd) + '</select></label></div>';
            } else if (cur.id === 'tuition2') {
                html = '<div class="tt-yesno" id="tt-tu2"><button type="button" class="tt-chip' + (answers.hasTuition2 ? ' on' : '') + '" data-v="1">ရှိတယ်</button>' +
                    '<button type="button" class="tt-chip' + (!answers.hasTuition2 ? ' on' : '') + '" data-v="0">မရှိဘူး</button></div>' +
                    '<div class="tt-times" id="tt-tu2-times" style="' + (answers.hasTuition2 ? '' : 'display:none') + '"><label>Start<select id="tt-tu2-start">' + timeSelectHtml(12 * 60, 22 * 60, answers.tuition2Start) + '</select></label>' +
                    '<label>End<select id="tt-tu2-end">' + timeSelectHtml(14 * 60, 24 * 60, answers.tuition2End) + '</select></label></div>';
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
            } else if (cur.id === 'subjects') {
                html = '<p class="tt-help">ဝယ်ထားသော ဘာသာရပ်ထဲက အနည်းဆုံး ၃ ခု ရွေးပါ။</p><div class="tt-subs" id="tt-subs">' +
                    paidSubjects(api).map(function (s) {
                        var on = answers.subjects.indexOf(s.id) !== -1;
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
                    if (cur.id === 'tuition2') {
                        var box = document.getElementById('tt-tu2-times');
                        if (box) box.style.display = ch.getAttribute('data-v') === '1' ? '' : 'none';
                    }
                };
            });
            body.querySelectorAll('#tt-subs .tt-chip').forEach(function (ch) {
                ch.onclick = function () { ch.classList.toggle('on'); };
            });
        }

        function collect() {
            var list = steps();
            var cur = list[step];
            if (!cur) return true;
            if (cur.id === 'name') {
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
            } else if (cur.id === 'tuitionHours') {
                answers.tuitionDays = readDays(document.getElementById('tt-tu-days'));
                answers.tuitionStart = parseTime(document.getElementById('tt-tu-start').value);
                answers.tuitionEnd = parseTime(document.getElementById('tt-tu-end').value);
                if (!answers.tuitionDays.length) { api.alert('Tuition ရှိတဲ့နေ့ ရွေးပါ။'); return false; }
                if (answers.tuitionEnd <= answers.tuitionStart) { api.alert('Tuition ပြီးချိန်က စချိန်ထက် နောက်ကျရပါမယ်။'); return false; }
            } else if (cur.id === 'tuition2') {
                answers.hasTuition2 = document.querySelector('#tt-tu2 .tt-chip.on').getAttribute('data-v') === '1';
                if (answers.hasTuition2) {
                    answers.tuition2Start = parseTime(document.getElementById('tt-tu2-start').value);
                    answers.tuition2End = parseTime(document.getElementById('tt-tu2-end').value);
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
            } else if (cur.id === 'subjects') {
                answers.subjects = Array.prototype.map.call(document.querySelectorAll('#tt-subs .tt-chip.on'), function (ch) {
                    return ch.getAttribute('data-sub');
                });
                if (answers.subjects.length < 3) { api.alert('ဘာသာရပ် အနည်းဆုံး ၃ ခု ရွေးပါ။'); return false; }
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

    function downloadPreview() {
        var img = document.getElementById('tt-preview');
        var blob = img && img._blob;
        var doSave = function (b) {
            var name = 'REED-timetable.png';
            try {
                var file = new File([b], name, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    navigator.share({ files: [file], title: name }).catch(function () {});
                    return;
                }
            } catch (err) {}
            var a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
        };
        if (blob) doSave(blob);
        else if (img && img.src) {
            fetch(img.src).then(function (r) { return r.blob(); }).then(doSave);
        }
    }

    function openTab(api) {
        var grade = api.getGrade();
        var paid = paidSubjects(api);
        if (paid.length < 3 && !api.isPaid('all')) {
            document.getElementById('tt-lock-count').textContent = String(paid.length);
            showPanel('tt-lock');
            return;
        }
        var saved = loadAnswers(grade);
        if (saved && saved.subjects && saved.subjects.length >= 3) {
            showResult(api, saved, false);
            return;
        }
        openAsk(api, saved);
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
        retake: function (api) { openAsk(api, loadAnswers(api.getGrade()) || undefined); },
        downloadPreview: downloadPreview
    };
})(typeof window !== 'undefined' ? window : globalThis);
