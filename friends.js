(function (root) {
    var UNKNOWN_ID_MSG = 'No user with this id';
    var BIO_MAX = 80;
    var ST_OFF = 0;
    var ST_PENDING = 1;
    var ST_FRIEND = 2;
    var friendCache = { friends: [], incoming: [], outgoing: [], profiles: {} };
    var previewTarget = null;
    var previewSeq = 0;
    var ignoreOpenUntil = 0;
    var socialTimer = 0;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function meUser() {
        if (typeof root.telegramProfileUser === 'function') {
            var live = root.telegramProfileUser();
            if (live && live.id) return live;
        }
        var tg = root.Telegram && Telegram.WebApp;
        var u = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
        if (u && u.id) return u;
        try {
            var raw = sessionStorage.getItem('reed_tg_user');
            if (raw) u = JSON.parse(raw) || {};
        } catch (e) {}
        return u || {};
    }

    function meId() {
        try {
            var live = root.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user;
            if (live && live.id) return String(live.id);
        } catch (e0) {}
        if (typeof root.telegramUserId === 'function') {
            var liveId = root.telegramUserId();
            if (liveId) return String(liveId);
        }
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

    function botWorker() {
        return String(root.REED_BOT_WORKER || '').replace(/\/$/, '');
    }

    function photoUrlFor(id) {
        id = String(id || '').replace(/[^0-9]/g, '');
        if (!id) return '';
        if (id === meId() && mePhoto()) return mePhoto();
        var worker = botWorker();
        if (!worker) return '';
        return worker + '/photo?id=' + encodeURIComponent(id);
    }

    function bioKey() {
        return 'reed_bio_' + (meId() || 'guest');
    }

    function readMyBio() {
        try { return String(localStorage.getItem(bioKey()) || ''); } catch (e) { return ''; }
    }

    function writeMyBio(text) {
        try { localStorage.setItem(bioKey(), String(text || '').slice(0, BIO_MAX)); } catch (e) {}
    }

    function storeKey() {
        return 'reed_friends_' + (meId() || 'guest');
    }

    function writeLocal(state) {
        var prev = (friendCache && friendCache.profiles) || {};
        var nextP = (state && state.profiles) || {};
        Object.keys(prev).forEach(function (id) {
            var older = prev[id] || {};
            var newer = nextP[id] || {};
            var newerPhoto = newer.photo || '';
            var olderPhoto = older.photo || '';
            nextP[id] = {
                name: newer.name || older.name || 'Student',
                photo: (newerPhoto.indexOf('data:image/') === 0) ? newerPhoto : ((olderPhoto.indexOf('data:image/') === 0) ? olderPhoto : ''),
                bio: newer.bio || older.bio || ''
            };
        });
        if (state) state.profiles = nextP;
        friendCache = state;
        try {
            var copy = {
                friends: state.friends,
                incoming: state.incoming,
                outgoing: state.outgoing,
                profiles: {}
            };
            Object.keys(nextP).forEach(function (id) {
                var p = nextP[id] || {};
                copy.profiles[id] = {
                    name: p.name || '',
                    photo: '',
                    bio: p.bio || ''
                };
            });
            localStorage.setItem(storeKey(), JSON.stringify(copy));
        } catch (e) {}
    }

    function recordHasPaidSubjects(rec) {
        if (!rec || typeof rec !== 'object') return false;
        var k;
        for (k in rec) {
            if (!Object.prototype.hasOwnProperty.call(rec, k)) continue;
            if (k === 'vol' || k === 'isVolunteer' || k === 'name' || k === 'photo' || k === 'photo_url' || k === 'bio') continue;
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

    function socialGet(action, extra) {
        extra = extra || {};
        extra.action = action;
        if (!gasUrl()) return Promise.resolve(null);
        var params = new URLSearchParams();
        Object.keys(extra).forEach(function (k) {
            if (k === 'photo' || k === 'photo_url' || k === 'fromPhoto') return;
            if (extra[k] == null) return;
            params.set(k, String(extra[k]));
        });
        var getUrl = gasUrl() + '?' + params.toString();
        var body = {};
        Object.keys(extra).forEach(function (k) {
            if (extra[k] == null) return;
            body[k] = extra[k];
        });
        function ok(data) {
            return data && (data.status === 'ok' || data.friends || data.profiles) ? data : null;
        }
        function postPlain() {
            return fetchJson(gasUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(body)
            }).then(ok);
        }
        return fetchJson(getUrl).then(ok).then(function (data) {
            if (data) return data;
            return postPlain();
        }).catch(function () { return postPlain().catch(function () { return null; }); });
    }

    function packCard(name, photo, bio) {
        return JSON.stringify({
            n: String(name || '').slice(0, 40),
            p: '',
            b: String(bio || '').slice(0, BIO_MAX)
        });
    }

    function unpackCard(raw, fallbackName) {
        var s = String(raw || '').trim();
        if (s.charAt(0) === '{') {
            try {
                var o = JSON.parse(s);
                return {
                    name: o.n || fallbackName || 'Student',
                    photo: o.p || '',
                    bio: o.b || ''
                };
            } catch (e) {}
        }
        return { name: s || fallbackName || 'Student', photo: '', bio: '' };
    }

    function profileOf(id, fallback) {
        fallback = fallback || {};
        if (String(id) === meId()) {
            return {
                userId: String(id),
                name: meName(),
                photo: mePhoto() || photoUrlFor(id),
                bio: readMyBio()
            };
        }
        var p = (friendCache.profiles && friendCache.profiles[String(id)]) || {};
        var name = p.name || fallback.name || fallback.userName || 'Student';
        var live = photoUrlFor(id);
        var photo = live || p.photo || fallback.photo || '';
        if (name === meName()) name = fallback.name || fallback.userName || 'Student';
        if (name === meName()) name = 'Student';
        if (photo && photo === mePhoto()) photo = live || '';
        return {
            userId: String(id),
            name: name,
            photo: photo,
            bio: p.bio || fallback.bio || ''
        };
    }

    function rememberProfile(id, name, photo, bio) {
        if (!id) return;
        friendCache.profiles = friendCache.profiles || {};
        var prev = friendCache.profiles[String(id)] || {};
        var keepPhoto = '';
        if (photo && String(photo).indexOf('data:image/') === 0) keepPhoto = photo;
        else if (prev.photo && String(prev.photo).indexOf('data:image/') === 0) keepPhoto = prev.photo;
        friendCache.profiles[String(id)] = {
            name: name || prev.name || 'Student',
            photo: keepPhoto,
            bio: bio != null && bio !== '' ? bio : (prev.bio || '')
        };
        writeLocal(friendCache);
    }

    function fetchJson(url, opts) {
        opts = opts || {};
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = setTimeout(function () {
            try { if (ctrl) ctrl.abort(); } catch (e0) {}
        }, 8000);
        var next = {};
        Object.keys(opts).forEach(function (k) { next[k] = opts[k]; });
        if (ctrl && !next.signal) next.signal = ctrl.signal;
        return fetch(url, next).then(function (r) { return r.text(); }).then(function (t) {
            try { return JSON.parse(t); } catch (e) { return null; }
        }).catch(function () { return null; }).finally(function () { clearTimeout(timer); });
    }

    function gasGet(action, extra) {
        var uid = meId();
        if (!uid || !gasUrl()) return Promise.resolve(null);
        var params = new URLSearchParams({ action: action });
        extra = extra || {};
        Object.keys(extra).forEach(function (k) {
            if (k === 'photo' || k === 'photo_url') return;
            if (extra[k] == null) return;
            params.set(k, String(extra[k]));
        });
        return fetchJson(gasUrl() + '?' + params.toString()).catch(function () { return null; });
    }

    function applyRemoteState(data) {
        if (!data) return null;
        var profiles = data.profiles || {};
        var merged = Object.assign({}, friendCache.profiles || {});
        Object.keys(profiles).forEach(function (id) {
            var prev = merged[id] || {};
            var incoming = profiles[id] || {};
            merged[id] = {
                name: incoming.name || prev.name || 'Student',
                photo: (prev.photo && String(prev.photo).indexOf('data:image/') === 0) ? prev.photo : '',
                bio: incoming.bio || prev.bio || ''
            };
        });
        friendCache.profiles = merged;
        if (!Array.isArray(data.friends) && !Array.isArray(data.incoming) && !Array.isArray(data.outgoing)) {
            if (Object.keys(profiles).length) writeLocal(friendCache);
            return data.status === 'ok' ? friendCache : null;
        }
        function withProf(row) {
            var p = merged[String(row.userId)] || {};
            return {
                userId: String(row.userId),
                name: p.name || row.name || 'Student',
                photo: photoUrlFor(row.userId) || p.photo || '',
                bio: p.bio || row.bio || ''
            };
        }
        var next = {
            friends: (data.friends || []).map(withProf),
            incoming: (data.incoming || []).map(withProf),
            outgoing: (data.outgoing || []).map(withProf),
            profiles: merged
        };
        writeLocal(next);
        return next;
    }

    function publishMe() {
        var uid = meId();
        if (!uid) return Promise.resolve();
        rememberProfile(uid, meName(), '', readMyBio());
        return socialGet('saveProfile', {
            userId: uid,
            fromId: uid,
            name: meName(),
            userName: meName(),
            bio: readMyBio()
        });
    }

    function numStat(v) {
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
    }

    function stateFromRows(rows, uid) {
        var profiles = {};
        var quizNames = {};
        var myFr = {};
        var theirFr = {};
        var myOk = {};
        var theirOk = {};
        (rows || []).forEach(function (row) {
            var qf = String(row.quizFile || '');
            var oid = String(row.userId || '');
            if (!oid) return;
            if (qf.indexOf('__soc_') !== 0) {
                var rawName = String(row.userName || '');
                if (rawName && rawName.charAt(0) !== '{') quizNames[oid] = rawName;
                return;
            }
            var packed = unpackCard(row.userName, row.userName);
            if (qf === '__soc_p') {
                if (oid !== uid && looksLikeMyCard(packed)) return;
                profiles[oid] = packed;
                return;
            }
            var fr = /^__soc_fr_(\d+)$/.exec(qf);
            if (fr) {
                var to = fr[1];
                if (to === oid) return;
                var st = numStat(row.timeTaken);
                if (oid === uid) myFr[to] = st;
                if (to === uid) theirFr[oid] = st;
                return;
            }
            var ok = /^__soc_ok_(\d+)$/.exec(qf);
            if (ok) {
                var other = ok[1];
                if (other === oid) return;
                var ost = numStat(row.timeTaken);
                if (oid === uid) myOk[other] = ost;
                if (other === uid) theirOk[oid] = ost;
            }
        });
        function looksLikeMyCard(packed) {
            if (!packed) return false;
            var myN = meName();
            var myP = mePhoto();
            if (packed.name && myN && packed.name === myN) return true;
            if (packed.photo && myP && packed.photo === myP) return true;
            return false;
        }

        function card(id) {
            if (id === uid) {
                return {
                    userId: String(id),
                    name: meName(),
                    photo: mePhoto() || photoUrlFor(id),
                    bio: readMyBio()
                };
            }
            var p = profiles[id] || {};
            var name = p.name || quizNames[id] || 'Student';
            if (looksLikeMyCard({ name: name, photo: p.photo })) {
                name = quizNames[id] || 'Student';
            }
            return {
                userId: String(id),
                name: name,
                photo: photoUrlFor(id),
                bio: p.bio || ''
            };
        }
        var friends = [];
        var incoming = [];
        var outgoing = [];
        var seen = {};
        function isFriend(id) {
            if (!id || id === uid) return false;
            return (theirFr[id] === ST_PENDING && myOk[id] === ST_FRIEND)
                || (myFr[id] === ST_PENDING && theirOk[id] === ST_FRIEND)
                || (myOk[id] === ST_FRIEND && theirOk[id] === ST_FRIEND);
        }
        Object.keys(theirFr).concat(Object.keys(myFr), Object.keys(myOk), Object.keys(theirOk)).forEach(function (id) {
            if (seen[id] || id === uid) return;
            seen[id] = true;
            if (isFriend(id)) {
                friends.push(card(id));
                return;
            }
            if (theirFr[id] === ST_PENDING && myOk[id] !== ST_FRIEND && myOk[id] !== ST_OFF) {
                incoming.push(card(id));
                return;
            }
            if (myFr[id] === ST_PENDING && theirOk[id] !== ST_FRIEND) {
                outgoing.push(card(id));
            }
        });
        return { friends: friends, incoming: incoming, outgoing: outgoing, profiles: profiles };
    }

    function ingestRows(rows) {
        var uid = meId();
        (rows || []).forEach(function (row) {
            var qf = String(row.quizFile || '');
            if (qf !== '__soc_p') return;
            var oid = String(row.userId || '');
            var packed = unpackCard(row.userName, row.userName);
            if (oid && oid !== uid && packed.name === meName()) return;
            if (packed.bio || packed.name) {
                rememberProfile(row.userId, packed.name, '', packed.bio);
            }
        });
    }

    function isQuizStatRow(b) {
        var qf = String((b && b.quizFile) || '');
        if (qf.indexOf('__soc_') === 0) return false;
        if (String((b && b.subject) || '') === 'social') return false;
        var tot = parseInt(b && b.total, 10) || 0;
        var sc = parseInt(b && b.score, 10) || 0;
        if (tot <= 0) return false;
        if (sc > tot * 5) return false;
        return true;
    }

    function loadFriendState() {
        var uid = meId();
        if (!uid) return Promise.resolve(friendCache);
        return socialGet('friendState', { userId: uid, fromId: uid }).then(function (data) {
            var remote = applyRemoteState(data);
            if (remote) return remote;
            var url = gasUrl() + '?action=getLeaderboard&subject=all&userId=' + encodeURIComponent(uid) + '&cb=' + Date.now();
            return fetchJson(url).then(function (board) {
                var fromBoard = applyRemoteState(board);
                if (fromBoard) return fromBoard;
                if (board && board.profiles) {
                    friendCache.profiles = Object.assign({}, friendCache.profiles || {}, board.profiles);
                    writeLocal(friendCache);
                }
                return friendCache;
            });
        }).catch(function () {
            return friendCache;
        });
    }

    function postFriendOp(op, otherId) {
        var uid = meId();
        var id = String(otherId || '').replace(/[^0-9]/g, '');
        if (!uid || !id || id === uid) return Promise.resolve(friendCache);
        if (op === 'request' && !listHas(friendCache.outgoing, id) && !listHas(friendCache.friends, id)) {
            var meta = profileOf(id, { name: 'Student' });
            friendCache.outgoing = (friendCache.outgoing || []).concat([meta]);
            writeLocal(friendCache);
        }
        return socialGet('saveProfile', {
            userId: uid,
            name: meName(),
            bio: readMyBio()
        }).then(function () {
            return socialGet('friendOp', {
                op: op,
                friendOp: op,
                fromId: uid,
                toId: id,
                fromName: meName()
            });
        }).then(function (data) {
            var remote = applyRemoteState(data);
            if (remote) return remote;
            return loadFriendState();
        });
    }

    function listHas(list, id) {
        return (list || []).some(function (row) { return String(row.userId) === String(id); });
    }

    function relationTo(id) {
        id = String(id);
        if (!id || id === meId()) return 'self';
        if (listHas(friendCache.friends, id)) return 'friends';
        if (listHas(friendCache.incoming, id)) return 'incoming';
        if (listHas(friendCache.outgoing, id)) return 'outgoing';
        return 'none';
    }

    function avatarHtml(name, photo, cls, id) {
        var initial = String(name || 'S').charAt(0).toUpperCase();
        var klass = cls || 'social-avatar';
        var data = id ? (' data-avatar="' + esc(id) + '"') : '';
        var safe = (photo && (photo.indexOf('data:image/') === 0 || photo.indexOf('https://') === 0)) ? photo : '';
        var img = '<img class="' + klass + '"' + data + ' src="' + (safe ? esc(safe) : '') + '" alt="" referrerpolicy="no-referrer" style="' + (safe ? '' : 'display:none') + '" onerror="this.style.display=\'none\';if(this.nextSibling)this.nextSibling.style.display=\'flex\'">';
        var fall = '<div class="' + klass + ' social-avatar-fallback"' + (safe ? ' style="display:none"' : '') + '>' + esc(initial) + '</div>';
        return img + fall;
    }

    function personRow(row, actionsHtml) {
        var id = row.userId || row.id;
        var name = row.name || row.userName || 'Student';
        var photo = row.photo || '';
        return '<button type="button" class="friend-row" data-peer="' + esc(id) + '" data-name="' + esc(name) + '">'
            + avatarHtml(name, photo, 'social-avatar', id)
            + '<div class="friend-row-info"><div class="friend-row-name">' + esc(name) + '</div>'
            + (row.bio ? '<div class="friend-row-bio">' + esc(row.bio) + '</div>' : '')
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
                        var qf = String(row.quizFile || '');
                        if (!uid || qf.indexOf('__soc_') === 0) return;
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
            var score = 0;
            var total = 0;
            var time = 0;
            (data.bestScores || []).forEach(function (b) {
                if (!isQuizStatRow(b)) return;
                score += parseInt(b.score || 0, 10);
                total += parseInt(b.total || 0, 10);
                time += parseInt(b.timeTaken || 0, 10);
            });
            if (!total) return null;
            var acc = Math.round((score / total) * 100);
            if (acc < 0 || acc > 100) return null;
            return { acc: acc, questions: total, correct: score, time: time };
        }).catch(function () { return null; });
    }

    function closePeerPreview(ev) {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }
        previewSeq += 1;
        previewTarget = null;
        ignoreOpenUntil = Date.now() + 500;
        var overlay = document.getElementById('peer-preview');
        if (overlay) overlay.hidden = true;
    }

    function fillPreview(id, meta, stats) {
        var overlay = document.getElementById('peer-preview');
        if (!overlay) return;
        previewTarget = String(id);
        var mine = String(id) === meId();
        var name = (meta && meta.name) || 'Student';
        var photo = (meta && meta.photo) || photoUrlFor(id) || '';
        var bio = (meta && meta.bio) || '';
        if (!mine && (name === meName() || (photo && photo === mePhoto()))) {
            name = (meta && meta.fallbackName) || 'Student';
            photo = photoUrlFor(id) || '';
        }
        if (mine) {
            name = meName() || name;
            photo = mePhoto() || photoUrlFor(id) || photo;
            bio = readMyBio() || bio;
        }
        document.getElementById('peer-preview-name').textContent = name;
        var bioEl = document.getElementById('peer-preview-bio');
        if (bioEl) {
            bioEl.textContent = bio;
            bioEl.hidden = !bio;
        }
        document.getElementById('peer-preview-id').textContent = 'ID ' + id;
        var av = document.getElementById('peer-preview-avatar');
        av.innerHTML = avatarHtml(name, photo, 'peer-avatar', id);
        var acc = stats && stats.acc != null ? stats.acc + '%' : '—';
        var qs = stats && stats.questions != null ? String(stats.questions) : '—';
        var tm = stats && stats.time != null ? formatTime(stats.time) : '—';
        var rk = stats && stats.rank ? '#' + stats.rank : '';
        document.getElementById('peer-preview-acc').textContent = acc;
        document.getElementById('peer-preview-q').textContent = qs;
        document.getElementById('peer-preview-time').textContent = tm;
        document.getElementById('peer-preview-rank').textContent = rk;
        var btn = document.getElementById('peer-preview-action');
        if (btn) btn.style.display = 'none';
        overlay.hidden = false;
        fillPhotos([id]);
    }

    function openPeerPreview(id, extras) {
        extras = extras || {};
        id = String(id || '').replace(/[^0-9]/g, '');
        if (!id) return;
        if (Date.now() < ignoreOpenUntil && !(extras && extras.force)) return;
        var overlay = document.getElementById('peer-preview');
        if (overlay && !overlay.hidden && previewTarget === String(id) && !(extras && extras.force)) return;
        var seq = ++previewSeq;
        var hadRank = !!(extras.stats && extras.stats.questions);
        if (String(id) !== meId()) {
            extras = Object.assign({}, extras);
            if (extras.name === meName()) extras.name = '';
            if (extras.photo === mePhoto()) extras.photo = '';
            if (extras.userName === meName()) extras.userName = '';
        }
        rememberProfile(id, extras.name || extras.userName, extras.photo, extras.bio);
        var meta = profileOf(id, extras);
        meta.fallbackName = extras.name || extras.userName || '';
        fillPreview(id, meta, extras.stats || statsFromEntry(extras));
        if (seq !== previewSeq) return;
        findInLeaderboard(id).then(function (entry) {
            if (seq !== previewSeq) return;
            if (entry) {
                var unpacked = unpackCard(entry.userName, entry.userName);
                var entryName = unpacked.name && String(unpacked.name).charAt(0) === '{'
                    ? String(entry.userName || '')
                    : (unpacked.name || entry.userName || '');
                if (String(id) === meId() || (entryName && entryName !== meName())) {
                    rememberProfile(id, entryName, '', unpacked.bio);
                }
                meta = profileOf(id, extras);
                meta.fallbackName = extras.name || extras.userName || entryName;
                fillPreview(id, meta, hadRank ? extras.stats : statsFromEntry(entry));
            }
            return hadRank ? null : fetchPeerStats(id);
        }).then(function (remote) {
            if (seq !== previewSeq || !remote) return;
            var live = document.getElementById('peer-preview');
            if (live && !live.hidden && previewTarget === id) {
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
            openPeerPreview(id, { name: meName(), photo: mePhoto(), bio: readMyBio() });
            return;
        }
        if (!targetBoughtSubjects(id)) {
            setFindMsg(UNKNOWN_ID_MSG, true);
            return;
        }
        setFindMsg('Found');
        loadFriendState().then(function () {
            var meta = profileOf(id, { name: 'Student' });
            findInLeaderboard(id).then(function (entry) {
                openPeerPreview(id, {
                    name: meta.name || (entry && entry.userName) || 'Student',
                    photo: photoUrlFor(id) || meta.photo,
                    bio: meta.bio,
                    stats: statsFromEntry(entry || {})
                });
            });
        });
    }

    function runOp(op, id) {
        if (!op || !id) return;
        var btn = document.getElementById('peer-preview-action');
        if (btn) btn.disabled = true;
        publishMe().then(function () { return postFriendOp(op, id); }).then(function () {
            renderLists();
            if (previewTarget === String(id)) openPeerPreview(id, { force: true });
            if (typeof root.loadLeaderboard === 'function') root.loadLeaderboard();
        }).catch(function () {}).then(function () {
            if (!btn) return;
            var rel = relationTo(id);
            if (rel === 'none' || rel === 'incoming') {
                btn.disabled = false;
                btn.removeAttribute('disabled');
            }
        });
    }

    function bindUi() {
        var overlay = document.getElementById('peer-preview');
        if (overlay && !overlay._reedBound) {
            overlay._reedBound = true;
            overlay.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
            overlay.addEventListener('click', function (e) {
                e.stopPropagation();
                var back = e.target.closest('#peer-preview-back, #peer-preview-close');
                if (back) closePeerPreview(e);
            });
        }
        bindBioEditor();
    }

    function paintMyBio() {
        var el = document.getElementById('user-bio');
        if (!el) return;
        var bio = readMyBio();
        el.textContent = bio || 'Add a short bio';
        el.classList.toggle('is-empty', !bio);
    }

    function bindBioEditor() {
        var edit = document.getElementById('profile-bio-edit');
        var box = document.getElementById('profile-bio-editor');
        var input = document.getElementById('profile-bio-input');
        var save = document.getElementById('profile-bio-save');
        if (!edit || edit._reedBound) return;
        edit._reedBound = true;
        edit.onclick = function () {
            if (!box || !input) return;
            box.hidden = false;
            input.value = readMyBio();
            input.focus();
        };
        if (save) {
            save.onclick = function () {
                var text = String(input.value || '').replace(/\s+/g, ' ').trim().slice(0, BIO_MAX);
                writeMyBio(text);
                paintMyBio();
                if (box) box.hidden = true;
                publishMe();
            };
        }
    }

    function applyAvatar(id, url) {
        if (!id || !url) return;
        if (url.indexOf('data:image/') !== 0 && url.indexOf('https://') !== 0) return;
        if (url.indexOf('data:image/') === 0) rememberProfile(id, '', url, null);
        var nodes = document.querySelectorAll('[data-avatar="' + id + '"]');
        var i;
        for (i = 0; i < nodes.length; i++) {
            nodes[i].src = url;
            nodes[i].style.display = '';
            var next = nodes[i].nextSibling;
            if (next && next.style) next.style.display = 'none';
        }
    }

    function idsFromSocialLists() {
        var out = [];
        function add(list) {
            (list || []).forEach(function (row) {
                if (row && row.userId) out.push(row.userId);
            });
        }
        add(friendCache.friends);
        add(friendCache.incoming);
        add(friendCache.outgoing);
        if (previewTarget) out.push(previewTarget);
        return out;
    }

    function fillPhotos(ids) {
        var want = [];
        var seen = {};
        (ids || idsFromSocialLists()).forEach(function (id) {
            id = String(id || '').replace(/[^0-9]/g, '');
            if (!id || seen[id]) return;
            seen[id] = true;
            want.push(id);
        });
        if (!want.length) return Promise.resolve();
        want.forEach(function (id) {
            var live = photoUrlFor(id);
            if (live) applyAvatar(id, live);
        });
        if (!gasUrl()) return Promise.resolve();
        return fetchJson(gasUrl() + '?action=getPhotos&ids=' + encodeURIComponent(want.join(',')) + '&cb=' + Date.now()).then(function (data) {
            if (!data || data.status !== 'ok' || !data.photos) return;
            Object.keys(data.photos).forEach(function (id) {
                applyAvatar(id, data.photos[id]);
            });
        }).catch(function () {});
    }

    function openSocial() {
        bindUi();
        paintMyBio();
        publishMe().catch(function () {});
        return Promise.resolve();
    }

    root.findReedUser = findReedUser;
    root.openPeerPreview = openPeerPreview;
    root.recordHasPaidSubjects = recordHasPaidSubjects;
    root.REEDSocial = {
        open: openSocial,
        render: renderLists,
        relationTo: relationTo,
        publishMe: publishMe,
        paintMyBio: paintMyBio,
        ingestRows: ingestRows,
        fillPhotos: fillPhotos,
        closePreview: closePeerPreview,
        previewBlocked: function () {
            var overlay = document.getElementById('peer-preview');
            return Date.now() < ignoreOpenUntil || (overlay && !overlay.hidden);
        },
        photoFor: function (id) {
            return photoUrlFor(id) || (profileOf(id).photo || '');
        },
        profileFor: profileOf
    };
})(window);
