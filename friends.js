(function (root) {
    var UNKNOWN_ID_MSG = 'No user with this id';
    var friendCache = { friends: [], incoming: [], outgoing: [], profiles: {} };
    var previewTarget = null;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function meUser() {
        var tg = root.Telegram && Telegram.WebApp;
        var u = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
        try {
            if (!u.id) {
                var raw = sessionStorage.getItem('reed_tg_user');
                if (raw) u = JSON.parse(raw) || {};
            }
        } catch (e) {}
        return u || {};
    }

    function meId() {
        var u = meUser();
        return u.id != null ? String(u.id) : '';
    }

    function meName() {
        if (typeof root.telegramDisplayName === 'function') return root.telegramDisplayName(meUser());
        var u = meUser();
        return ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.username || 'Scholar';
    }

    function mePhoto() {
        return (meUser().photo_url) || '';
    }

    function storeKey() {
        return 'reed_friends_' + (meId() || 'guest');
    }

    function readLocal() {
        try {
            var raw = localStorage.getItem(storeKey());
            if (!raw) return { friends: [], incoming: [], outgoing: [], profiles: {} };
            var data = JSON.parse(raw);
            return {
                friends: data.friends || [],
                incoming: data.incoming || [],
                outgoing: data.outgoing || [],
                profiles: data.profiles || {}
            };
        } catch (e) {
            return { friends: [], incoming: [], outgoing: [], profiles: {} };
        }
    }

    function writeLocal(state) {
        friendCache = state;
        try { localStorage.setItem(storeKey(), JSON.stringify(state)); } catch (e) {}
    }

    function recordHasPaidSubjects(rec) {
        if (!rec || typeof rec !== 'object') return false;
        var k;
        for (k in rec) {
            if (!Object.prototype.hasOwnProperty.call(rec, k)) continue;
            if (k === 'vol' || k === 'isVolunteer' || k === 'name' || k === 'photo' || k === 'photo_url') continue;
            var val = rec[k];
            if (val && typeof val === 'object' && !Array.isArray(val)) continue;
            if (typeof root.isExpiryValid === 'function' && root.isExpiryValid(val)) return true;
        }
        return false;
    }

    function paidMap() {
        return (typeof root.paidUsers === 'object' && root.paidUsers) ? root.paidUsers : {};
    }

    function targetBoughtSubjects(id) {
        return recordHasPaidSubjects(paidMap()[String(id)]);
    }

    function gasUrl() {
        return root.STATS_GAS_URL || '';
    }

    function profileOf(id, fallback) {
        var p = (friendCache.profiles && friendCache.profiles[String(id)]) || {};
        fallback = fallback || {};
        return {
            userId: String(id),
            name: p.name || fallback.name || fallback.userName || 'Student',
            photo: p.photo || fallback.photo || ''
        };
    }

    function rememberProfile(id, name, photo) {
        if (!id) return;
        friendCache.profiles = friendCache.profiles || {};
        var prev = friendCache.profiles[String(id)] || {};
        friendCache.profiles[String(id)] = {
            name: name || prev.name || 'Student',
            photo: photo || prev.photo || ''
        };
        writeLocal(friendCache);
    }

    function mergeState(server) {
        var local = readLocal();
        if (!server || (server.status && server.status !== 'ok')) {
            friendCache = local;
            return local;
        }
        var merged = {
            friends: server.friends || local.friends || [],
            incoming: server.incoming || local.incoming || [],
            outgoing: server.outgoing || local.outgoing || [],
            profiles: Object.assign({}, local.profiles || {}, server.profiles || {})
        };
        writeLocal(merged);
        return merged;
    }

    function fetchJson(url, opts) {
        return fetch(url, opts || {}).then(function (r) { return r.text(); }).then(function (t) {
            try { return JSON.parse(t); } catch (e) { return null; }
        });
    }

    function loadFriendState() {
        var uid = meId();
        if (!uid) {
            friendCache = readLocal();
            return Promise.resolve(friendCache);
        }
        var url = gasUrl() + '?action=friendState&userId=' + encodeURIComponent(uid) + '&cb=' + Date.now();
        return fetchJson(url).then(function (data) {
            return mergeState(data);
        }).catch(function () {
            friendCache = readLocal();
            return friendCache;
        });
    }

    function postFriendOp(op, otherId) {
        var uid = meId();
        if (!uid) return Promise.resolve({ status: 'error', message: 'Sign in with Telegram' });
        var body = {
            action: 'friendOp',
            op: op,
            fromId: uid,
            toId: String(otherId || ''),
            fromName: meName(),
            fromPhoto: mePhoto()
        };
        var qs = gasUrl() + '?action=friendOp'
            + '&op=' + encodeURIComponent(op)
            + '&fromId=' + encodeURIComponent(uid)
            + '&toId=' + encodeURIComponent(String(otherId || ''))
            + '&fromName=' + encodeURIComponent(meName())
            + '&fromPhoto=' + encodeURIComponent(mePhoto());
        return fetchJson(gasUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        }).then(function (data) {
            if (data && data.status === 'ok') return mergeState(data);
            return fetchJson(qs).then(function (g) {
                if (g && g.status === 'ok') return mergeState(g);
                applyLocalOp(op, otherId);
                return friendCache;
            });
        }).catch(function () {
            return fetchJson(qs).then(function (g) {
                if (g && g.status === 'ok') return mergeState(g);
                applyLocalOp(op, otherId);
                return friendCache;
            }).catch(function () {
                applyLocalOp(op, otherId);
                return friendCache;
            });
        });
    }

    function listHas(list, id) {
        return (list || []).some(function (row) { return String(row.userId) === String(id); });
    }

    function applyLocalOp(op, otherId) {
        var state = readLocal();
        var id = String(otherId);
        var card = { userId: id, name: profileOf(id).name, photo: profileOf(id).photo };
        function drop(list) { return (list || []).filter(function (r) { return String(r.userId) !== id; }); }
        if (op === 'request') {
            if (!listHas(state.outgoing, id) && !listHas(state.friends, id)) state.outgoing = (state.outgoing || []).concat([card]);
        } else if (op === 'accept') {
            state.incoming = drop(state.incoming);
            if (!listHas(state.friends, id)) state.friends = (state.friends || []).concat([card]);
        } else if (op === 'reject' || op === 'cancel') {
            state.incoming = drop(state.incoming);
            state.outgoing = drop(state.outgoing);
        } else if (op === 'unfriend') {
            state.friends = drop(state.friends);
        }
        writeLocal(state);
    }

    function relationTo(id) {
        id = String(id);
        if (!id || id === meId()) return 'self';
        if (listHas(friendCache.friends, id)) return 'friends';
        if (listHas(friendCache.incoming, id)) return 'incoming';
        if (listHas(friendCache.outgoing, id)) return 'outgoing';
        return 'none';
    }

    function avatarHtml(name, photo, cls) {
        var initial = String(name || 'S').charAt(0).toUpperCase();
        if (photo) {
            return '<img class="' + (cls || 'social-avatar') + '" src="' + esc(photo) + '" alt="">';
        }
        return '<div class="' + (cls || 'social-avatar') + ' social-avatar-fallback">' + esc(initial) + '</div>';
    }

    function personRow(row, actionsHtml) {
        var id = row.userId || row.id;
        var name = row.name || row.userName || 'Student';
        var photo = row.photo || '';
        return '<button type="button" class="friend-row" data-peer="' + esc(id) + '">'
            + avatarHtml(name, photo)
            + '<div class="friend-row-info"><div class="friend-row-name">' + esc(name) + '</div>'
            + '<div class="friend-row-meta">ID ' + esc(id) + '</div></div></button>'
            + (actionsHtml || '');
    }

    function emptyLine(text) {
        return '<p class="social-empty">' + esc(text) + '</p>';
    }

    function renderLists() {
        var reqEl = document.getElementById('social-requests');
        var frEl = document.getElementById('social-friends');
        if (reqEl) {
            var incoming = friendCache.incoming || [];
            if (!incoming.length) reqEl.innerHTML = emptyLine('No requests');
            else {
                reqEl.innerHTML = incoming.map(function (row) {
                    return '<div class="friend-row-wrap">'
                        + personRow(row, '<div class="friend-row-actions">'
                            + '<button type="button" class="btn social-mini-btn" data-fop="accept" data-peer="' + esc(row.userId) + '">Accept</button>'
                            + '<button type="button" class="btn social-mini-btn social-mini-ghost" data-fop="reject" data-peer="' + esc(row.userId) + '">Decline</button>'
                            + '</div>')
                        + '</div>';
                }).join('');
            }
        }
        if (frEl) {
            var friends = friendCache.friends || [];
            if (!friends.length) frEl.innerHTML = emptyLine('No friends yet');
            else {
                frEl.innerHTML = friends.map(function (row) {
                    return '<div class="friend-row-wrap">'
                        + personRow(row, '<div class="friend-row-actions">'
                            + '<button type="button" class="btn social-mini-btn social-mini-ghost" data-fop="unfriend" data-peer="' + esc(row.userId) + '">Remove</button>'
                            + '</div>')
                        + '</div>';
                }).join('');
            }
        }
        var outEl = document.getElementById('social-outgoing');
        if (outEl) {
            var outgoing = friendCache.outgoing || [];
            if (!outgoing.length) outEl.innerHTML = '';
            else {
                outEl.innerHTML = '<p class="social-kicker">Sent</p>' + outgoing.map(function (row) {
                    return '<div class="friend-row-wrap">'
                        + personRow(row, '<div class="friend-row-actions">'
                            + '<button type="button" class="btn social-mini-btn social-mini-ghost" data-fop="cancel" data-peer="' + esc(row.userId) + '">Cancel</button>'
                            + '</div>')
                        + '</div>';
                }).join('');
            }
        }
    }

    function setFindMsg(text, isError) {
        var el = document.getElementById('social-find-msg');
        if (!el) return;
        el.textContent = text || '';
        el.className = 'social-find-msg' + (isError ? ' is-error' : '');
    }

    function statsFromEntry(entry) {
        if (!entry || !entry.rankData) return null;
        return {
            acc: Math.round(entry.rankData.acc * 100),
            questions: entry.totalPossible || 0,
            time: entry.totalTime || 0,
            quizzes: entry.quizCount || 0,
            rank: entry._rank || null
        };
    }

    function formatTime(sec) {
        if (typeof root.formatTime === 'function') return root.formatTime(sec || 0);
        var s = parseInt(sec, 10) || 0;
        var m = Math.floor(s / 60);
        var r = s % 60;
        return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
    }

    function findInLeaderboard(id) {
        return Promise.resolve().then(function () {
            if (typeof root.fetchAllLeaderboardRows !== 'function' || typeof root.buildRankEntries !== 'function') return null;
            return root.fetchAllLeaderboardRows().then(function (rows) {
                var grade = (typeof root.getStatsGrade === 'function') ? root.getStatsGrade() : 12;
                var built = root.buildRankEntries(rows, { subject: 'all', grade: grade, period: 'all' });
                var idx = built.entries.findIndex(function (e) { return String(e.userId) === String(id); });
                if (idx === -1) {
                    var all = {};
                    (rows || []).forEach(function (row) {
                        var uid = String(row.userId || '');
                        if (!uid) return;
                        if (!all[uid]) all[uid] = { userId: uid, userName: row.userName || 'Student', totalScore: 0, totalPossible: 0, totalTime: 0, quizCount: 0 };
                        all[uid].totalScore += parseInt(row.score || 0, 10);
                        all[uid].totalPossible += parseInt(row.total || 0, 10);
                        all[uid].totalTime += parseInt(row.timeTaken || 0, 10);
                        all[uid].quizCount += 1;
                    });
                    var raw = all[String(id)];
                    if (!raw || !raw.totalPossible) return null;
                    raw.rankData = (typeof root.calculateRankScore === 'function')
                        ? root.calculateRankScore(raw.totalScore, raw.totalPossible, raw.totalTime)
                        : { acc: raw.totalScore / raw.totalPossible };
                    return raw;
                }
                var hit = Object.assign({}, built.entries[idx]);
                hit._rank = idx + 1;
                return hit;
            });
        }).catch(function () { return null; });
    }

    function fetchPeerStats(id) {
        var url = gasUrl() + '?action=getStats&userId=' + encodeURIComponent(id);
        return fetchJson(url).then(function (data) {
            if (!data || data.status !== 'ok') return null;
            var overall = data.overall || {};
            var time = 0;
            (data.bestScores || []).forEach(function (b) { time += parseInt(b.timeTaken || 0, 10); });
            return {
                acc: overall.accuracy || 0,
                questions: overall.answered || 0,
                correct: overall.correct || 0,
                time: time
            };
        }).catch(function () { return null; });
    }

    function fillPreview(id, meta, stats) {
        var overlay = document.getElementById('peer-preview');
        if (!overlay) return;
        previewTarget = String(id);
        var name = (meta && meta.name) || 'Student';
        var photo = (meta && meta.photo) || '';
        document.getElementById('peer-preview-name').textContent = name;
        document.getElementById('peer-preview-id').textContent = 'ID ' + id;
        var av = document.getElementById('peer-preview-avatar');
        av.innerHTML = avatarHtml(name, photo, 'peer-avatar');
        var acc = stats && stats.acc != null ? stats.acc + '%' : '—';
        var qs = stats && stats.questions != null ? String(stats.questions) : '—';
        var tm = stats && stats.time != null ? formatTime(stats.time) : '—';
        var rk = stats && stats.rank ? '#' + stats.rank : '';
        document.getElementById('peer-preview-acc').textContent = acc;
        document.getElementById('peer-preview-q').textContent = qs;
        document.getElementById('peer-preview-time').textContent = tm;
        document.getElementById('peer-preview-rank').textContent = rk;
        var btn = document.getElementById('peer-preview-action');
        var rel = relationTo(id);
        btn.style.display = '';
        if (rel === 'self') {
            btn.style.display = 'none';
        } else if (rel === 'friends') {
            btn.textContent = 'Friends';
            btn.disabled = true;
        } else if (rel === 'outgoing') {
            btn.textContent = 'Requested';
            btn.disabled = true;
        } else if (rel === 'incoming') {
            btn.textContent = 'Accept';
            btn.disabled = false;
            btn.setAttribute('data-fop', 'accept');
        } else {
            btn.textContent = 'Add friend';
            btn.disabled = false;
            btn.setAttribute('data-fop', 'request');
        }
        overlay.hidden = false;
    }

    function openPeerPreview(id, extras) {
        extras = extras || {};
        id = String(id || '').replace(/[^0-9]/g, '');
        if (!id) return;
        rememberProfile(id, extras.name || extras.userName, extras.photo);
        var meta = profileOf(id, extras);
        fillPreview(id, meta, extras.stats || statsFromEntry(extras));
        findInLeaderboard(id).then(function (entry) {
            if (entry) {
                rememberProfile(id, entry.userName);
                meta = profileOf(id, { name: entry.userName });
                fillPreview(id, meta, statsFromEntry(entry));
            }
            return fetchPeerStats(id);
        }).then(function (remote) {
            if (!remote) return;
            var overlay = document.getElementById('peer-preview');
            if (overlay && !overlay.hidden && previewTarget === id) {
                document.getElementById('peer-preview-acc').textContent = remote.acc + '%';
                document.getElementById('peer-preview-q').textContent = String(remote.questions);
                document.getElementById('peer-preview-time').textContent = formatTime(remote.time);
            }
        });
    }

    function findReedUser() {
        var input = document.getElementById('social-find-id');
        var raw = input ? String(input.value || '').trim() : '';
        var id = raw.replace(/[^0-9]/g, '');
        setFindMsg('');
        if (!id) {
            setFindMsg(UNKNOWN_ID_MSG, true);
            return;
        }
        if (id === meId()) {
            openPeerPreview(id, { name: meName(), photo: mePhoto() });
            return;
        }
        if (!targetBoughtSubjects(id)) {
            setFindMsg(UNKNOWN_ID_MSG, true);
            return;
        }
        setFindMsg('Found');
        findInLeaderboard(id).then(function (entry) {
            openPeerPreview(id, {
                name: (entry && entry.userName) || 'Student',
                stats: statsFromEntry(entry || {})
            });
        });
    }

    function runOp(op, id) {
        if (!op || !id) return;
        if (op === 'request') rememberProfile(id, profileOf(id).name, profileOf(id).photo);
        postFriendOp(op, id).then(function () {
            renderLists();
            if (previewTarget === String(id)) openPeerPreview(id);
        });
    }

    function bindUi() {
        var rootEl = document.getElementById('social-screen');
        if (rootEl && !rootEl._reedBound) {
            rootEl._reedBound = true;
            rootEl.addEventListener('click', function (e) {
                var opBtn = e.target.closest('[data-fop]');
                if (opBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    runOp(opBtn.getAttribute('data-fop'), opBtn.getAttribute('data-peer'));
                    return;
                }
                var row = e.target.closest('[data-peer]');
                if (row && row.classList.contains('friend-row')) {
                    openPeerPreview(row.getAttribute('data-peer'));
                }
            });
        }
        var findBtn = document.getElementById('social-find-btn');
        if (findBtn) findBtn.onclick = findReedUser;
        var findInput = document.getElementById('social-find-id');
        if (findInput) {
            findInput.onkeydown = function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    findReedUser();
                }
            };
        }
        var overlay = document.getElementById('peer-preview');
        if (overlay && !overlay._reedBound) {
            overlay._reedBound = true;
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay || e.target.id === 'peer-preview-close') {
                    overlay.hidden = true;
                }
            });
        }
        var act = document.getElementById('peer-preview-action');
        if (act) {
            act.onclick = function () {
                runOp(act.getAttribute('data-fop') || 'request', previewTarget);
            };
        }
    }

    function openSocial() {
        bindUi();
        loadFriendState().then(renderLists);
    }

    root.findReedUser = findReedUser;
    root.openPeerPreview = openPeerPreview;
    root.recordHasPaidSubjects = recordHasPaidSubjects;
    root.REEDSocial = {
        open: openSocial,
        render: renderLists,
        relationTo: relationTo
    };
})(window);
