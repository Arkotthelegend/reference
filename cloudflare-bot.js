/* Reed Education Telegram bot — Cloudflare Worker
   Secrets: BOT_TOKEN, OPENAI_API_KEY
   Optional: START_VIDEO_FILE_ID, START_VIDEO_URL
   Optional bind: SOCIAL_KV (KV namespace) for friends/bios
   Optional custom domain: bot.reededucation.net → this worker
     (Mini App uses that URL for photos + Add friend)

   GET  /photo?id=TELEGRAM_ID     Telegram profile JPEG
   GET  /social?action=friendState&userId=
   GET  /social?action=friendOp&op=request&fromId=&toId=&fromName=
   GET  /social?action=saveProfile&userId=&name=&bio=
   POST Telegram webhook (messages + friend Accept buttons)

   Paste this file into the Worker and deploy. */

var DEFAULT_START_VIDEO_URL = 'https://reededucation.net/start-welcome.mp4?v=2';

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 204 }));
    }

    if (request.method === 'GET' || url.pathname.indexOf('/social') === 0 || url.pathname.indexOf('/photo') === 0 || url.searchParams.get('action')) {
      try {
        return corsResponse(await handlePublic(request, env));
      } catch (err) {
        return corsResponse(jsonResponse({ status: 'error', message: String(err) }, 500));
      }
    }

    if (request.method !== 'POST') {
      return corsResponse(new Response('OK', { status: 200 }));
    }

    let update;
    try {
      update = await request.json();
    } catch (e) {
      return new Response('OK', { status: 200 });
    }

    try {
      if (update && update.callback_query) {
        await handleFriendCallback(update.callback_query, env);
        return new Response('OK', { status: 200 });
      }
    } catch (e0) {}

    const msg = update && update.message;
    const chatId = msg && msg.chat && msg.chat.id;
    if (chatId && msg) {
      try {
        var start = commandName(msg.text);
        if (start === '/start') {
          var payload = startPayload(msg.text);
          if (payload.indexOf('friend_') === 0) {
            await acceptStartFriend(chatId, payload, env);
          } else {
            await sendStartWelcome(chatId, env);
          }
        } else if (videoFileIdFromMessage(msg) && isPrivateChat(msg)) {
          await sendTelegramMessage(
            chatId,
            'Save this as Worker secret START_VIDEO_FILE_ID:\n' + videoFileIdFromMessage(msg),
            env.BOT_TOKEN
          );
        } else if (typeof msg.text === 'string' && msg.text.trim()) {
          const reply = await getAIReply(msg.text, env.OPENAI_API_KEY);
          await sendTelegramMessage(chatId, reply, env.BOT_TOKEN);
        }
      } catch (e) {}
    }

    return new Response('OK', { status: 200 });
  }
};

function corsResponse(res) {
  var headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(res.body, { status: res.status, headers: headers });
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handlePublic(request, env) {
  var url = new URL(request.url);
  var action = String(url.searchParams.get('action') || '');
  if (!action && url.pathname.indexOf('/social/') === 0) {
    action = String(url.pathname.split('/')[2] || '');
  }
  if (url.pathname === '/photo' || url.pathname.indexOf('/photo/') === 0 || action === 'photo') {
    return serveTelegramPhoto(url.searchParams.get('id') || url.searchParams.get('userId') || url.pathname.split('/')[2], env);
  }
  if (action === 'getPhotos') {
    var ids = String(url.searchParams.get('ids') || '').split(',');
    var origin = url.origin;
    var photos = {};
    ids.forEach(function (id) {
      id = String(id || '').replace(/[^0-9]/g, '');
      if (id) photos[id] = origin + '/photo?id=' + id;
    });
    return jsonResponse({ status: 'ok', photos: photos });
  }
  if (action === 'saveProfile') return jsonResponse(await saveProfile(env, url.searchParams));
  if (action === 'friendState') return jsonResponse(await friendState(env, url.searchParams.get('userId') || url.searchParams.get('fromId')));
  if (action === 'friendOp') return jsonResponse(await friendOp(env, url.searchParams, url.origin));
  if (url.pathname.indexOf('/social') === 0) {
    return jsonResponse({ status: 'error', message: 'Unknown social action' }, 400);
  }
  return new Response('OK', { status: 200 });
}

function startPayload(text) {
  var t = String(text || '').trim().split(/\s+/);
  return t.length > 1 ? t.slice(1).join(' ') : '';
}

function commandName(text) {
  var t = String(text || '').trim();
  if (t.charAt(0) !== '/') return '';
  return t.split(/\s+/)[0].split('@')[0].toLowerCase();
}

function aboutReedReply() {
  return [
    'Reed Education is a Grade 10 / 11 / 12 study Mini App. You are already in the bot that opens it: @reededucation_bot.',
    '',
    'To practice now:',
    '• Tap Start Practice in this chat menu',
    '• Or pin this bot chat. In your chat list you will see Open App',
    '',
    '@REED_education is only our news and community channel. You cannot practice quizzes there.',
    '',
    'Inside the Mini App:',
    '• Study — quizzes, ခက်ဆစ် word list, English grammar, poems, dialogues, Grade 12 Q and A',
    '• Time — weekly timetable from your school, tuition, lunch, and rest. Download Mon–Fri and Sat–Sun A4 pages',
    '• Social — find friends by Telegram ID (paid students only), friend requests, and rank',
    '• Analysis — daily motivation, accuracy, questions, time, subject radar',
    '• Me — profile, paid unlocks, exam countdown, News, volunteer',
    '',
    'Subjects: Myanmar, English, Maths, Physics, Chemistry, Biology, Economics.',
    'STEAM 1 uses Biology. STEAM 2 uses Economics.',
    '',
    'Website: reededucation.net',
    'Channel (info only): @REED_education',
    'This bot (open the app here): @reededucation_bot',
    'Buy help: Me → contact to buy, or message @minaphayarkot and send your Telegram ID.'
  ].join('\n');
}

function startReply() {
  return [
    'ရီးဒ်ပညာရေးမှ ကြိုဆိုပါတယ်။',
    'ကျွန်တော်တို့က ၁၀ တန်း၊ ၁၁ တန်း၊ ၁၂ တန်းအတွက် လေ့ကျင့်ရေး Mini App ပါ။',
    'Telegram ထဲမှာပဲ ဘာသာရပ်တွေ လေ့ကျင့်လို့ရပါတယ်။',
    'အက်ပ်ဖွင့်ရန် Start Practice ကို နှိပ်လိုက်ပါ။',
    '',
    'သတင်းနဲ့ အကြောင်းအရာအသစ်တွေအတွက် Channel ကို join ပေးပါ — @REED_education'
  ].join('\n');
}

function startKeyboard() {
  return {
    inline_keyboard: [
      [{ text: 'Channel join မည်', url: 'https://t.me/REED_education' }]
    ]
  };
}

function howToOpenReply() {
  return [
    'Practice is in this bot chat: @reededucation_bot. You are already here.',
    '',
    '• Tap Start Practice in this chat menu to open the Mini App',
    '• Or pin this chat, then tap Open App when you see this chat in your list',
    '',
    'Do not go to @REED_education to practice. That channel is only news and community.'
  ].join('\n');
}

function looksLikeReedQuestion(q) {
  var s = String(q || '').toLowerCase();
  if (/\/start|\/help/.test(s)) return true;
  if (/\breed\b|reededucation|ရီးဒ်|ရိဒ်/.test(s)) return true;
  if (/\b(mini\s*app|telegram app|this app|the app|our app|your app)\b/.test(s)) return true;
  if (/\b(grade\s*(10|11|12)|matric|timetable|steam|daily quiz|leaderboard|flashcard|volunteer)\b/.test(s)) return true;
  if (/(မြန်မာစာ|အင်္ဂလိပ်|သင်္ချာ|ရူပ|ဓာတု|ဇီဝ|ဘောဂ|အချိန်ဇယား|အက်ပ်|အက်ပ)/.test(s)) return true;
  return false;
}

function stripFancyText(text) {
  var s = String(text || '');
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/```[\s\S]*?```/g, function (block) {
    return block.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
  });
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  s = s.replace(/\*\*(.+?)\*\*/g, '$1');
  s = s.replace(/__(.+?)__/g, '$1');
  s = s.replace(/~~(.+?)~~/g, '$1');
  s = s.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$|[.,!?])/g, '$1$2');
  s = s.replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g, '$1$2');
  s = s.replace(/<\/?(b|strong|i|em|u|code|pre|a)[^>]*>/gi, '');
  s = s.replace(/[*#<>]/g, '');
  s = fixOfficialHandles(s);
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function fixOfficialHandles(text) {
  var s = String(text || '');
  s = s.replace(/@reededucation_bot/gi, '@reededucation_bot');
  s = s.replace(/t\.me\/reededucation_bot/gi, 't.me/reededucation_bot');
  s = s.replace(/@REED_education\b/gi, '@REED_education');
  s = s.replace(/@REEDeducation\b(?!_bot)/gi, '@REED_education');
  s = s.replace(/t\.me\/REED_education\b/gi, 't.me/REED_education');
  s = s.replace(/t\.me\/REEDeducation\b(?!_bot)/gi, 't.me/REED_education');
  s = s.replace(/@minaphayarkot/gi, '@minaphayarkot');
  return s;
}

async function getAIReply(question, apiKey) {
  var raw = String(question || '').trim();
  var lowerQ = raw.toLowerCase();
  var cmd = commandName(raw);

  if (cmd === '/start' || cmd === '/help') {
    return startReply();
  }

  if (['hi', 'hello', 'hey', 'hii', 'yo', 'mingalaba', 'မင်္ဂလာပါ'].indexOf(lowerQ) !== -1) {
    return 'Hello. Welcome to Reed Education. Ask me anything about the Reed Mini App — grades, subjects, timetable, rank, or pricing.';
  }
  if (['thanks', 'thank you', 'thank', 'ty', 'ကျေးဇူးတင်ပါတယ်', 'ကျေးဇူးပါ', 'ကျေးဇူး'].indexOf(lowerQ) !== -1) {
    return 'You are welcome. Happy studying.';
  }

  if (/^(tell me about|what is|what's|whats|who is|about)\s+(reed|reed education|reed app|the reed|ရီးဒ်)(\s+(app|education|mini app))?[\s.?!]*$/i.test(raw)
    || /^(reed|reed education|reed app|ရီးဒ်)$/i.test(raw)
    || /reed (education )?(app|mini app)/i.test(raw) && raw.length < 80) {
    return aboutReedReply();
  }

  if (/\b(start practice|open app|open the app|how to (open|practice|use)|where (to |do i )?(practice|open)|pin (the )?chat|menu button)\b/i.test(raw)
    || /\b(channel|@reed_education|@reededucation)\b/i.test(raw) && /\b(practice|quiz|app|open|bot)\b/i.test(raw)) {
    return howToOpenReply();
  }

  var systemPrompt = [
    'You are Reed, the in-chat helper for Reed Education. You are friendly, specific, and practical.',
    '',
    'WHAT REED IS:',
    'Reed Education is a Telegram Mini App for Myanmar Grade 10, 11, and 12 students. Website: reededucation.net. Contact to buy: @minaphayarkot. No Play Store or App Store install.',
    '',
    'BOT vs CHANNEL — never mix these up:',
    '• @reededucation_bot is THIS chat. The user is already typing here. This bot opens the Mini App.',
    '• To practice: tap Start Practice in this chat menu. Or pin this bot chat; then Open App shows on this chat in the chat list.',
    '• @REED_education is the news and community CHANNEL only. Users cannot practice, quiz, or open the Mini App there. Never send people to the channel to study.',
    '• Never write @REEDeducation. Channel is @REED_education. Bot is @reededucation_bot.',
    '',
    'IMPORTANT: Questions like "tell me about Reed", "Reed", "Reed Education", "the app", or ရီးဒ် ARE on-topic. Answer them. Do not say you can only help with the app.',
    '',
    'APP TABS:',
    '• Study — subject quizzes, flashcards, English grammar (shared across grades), poems, dialogues, Grade 12 Q and A',
    '• Time — weekly timetable. Unlock after buying subjects. Asks STEAM 1 or 2, school days, tuition, rest. Makes Mon–Fri and Sat–Sun A4 pages you can download. Lunch + Rest and Rest stay labeled. The planner is rule-based on the phone, not ChatGPT.',
    '• Social — Find by Telegram ID only if that person bought subjects, otherwise the app says no user with this id. Add / accept friends. Rank leaderboard is in this tab. Tap a rank row to preview photo, name, and stats.',
    '• Analysis — Daily Motivation, Summary radar (questions, correct, time), Best scores, Old scores (Grade 12). STEAM 1 shows Biology. STEAM 2 shows Economics, not Biology.',
    '• Me — name, Telegram ID, bought subjects, exam countdown at the bottom, contact to buy. Each chapter has Practice (book order, no timer, no score) and Test (shuffled, timer on, scored). Only Test counts for rank. News. Volunteers get grade-locked unlocks and can report a mistake.',
    '',
    'GRADES AND SUBJECTS:',
    'Grade 10, 11, and 12. Pick the grade in the app. Unlocks stay on that grade.',
    'Subjects: Myanmar, English, Maths, Physics, Chemistry, Biology, Economics.',
    'STEAM 1: Myanmar, English, Maths, Physics, Chemistry, Biology.',
    'STEAM 2: Myanmar, English, Maths, Physics, Chemistry, Economics.',
    'Old questions (past-year) are on Grade 12 only.',
    '',
    'CONTENT:',
    '• English: 12 units (Initial Letter, MCQ), shared grammar notes, poems (with Grade 12 paraphrase), dialogues (review and practice), Grade 12 Q and A',
    '• Myanmar: အပြော, စကားပြေ, ကဗျာ, ရေသည်, အရေး — true/false, fill-blank, MCQ. ခက်ဆစ် is a tap-to-open word list, not flashcards.',
    '• Maths: chapter quizzes (1/2/3 mark) and step-by-step solutions',
    '• Physics / Chemistry / Biology / Eco: chapters, sub-chapters, definitions, formulas, key terms',
    '• Free: Chapter 1 trial. Other chapters need a paid unlock or volunteer unlock.',
    '',
    'PRICING (MMK):',
    'Sold as all-subjects only. No per-subject sales.',
    '• 1 month: 9,500',
    '• 3 months: 19,500',
    '• 6 months: 29,500',
    '• 13 months: 34,500',
    'Same prices for Grade 10, 11, and 12. Grade 12 also includes old questions.',
    'Weekly timetable made by AI is included.',
    'How to buy: Me → contact to buy (copies @minaphayarkot). Send your Telegram ID, grade, and plan.',
    '',
    'OTHER: Theme shop still exists on Me. Website landing page is only a preview; the real app is inside Telegram.',
    '',
    'RULES:',
    '1. Treat Reed / Reed Education / the Mini App / the bot as the same product. Always help.',
    '2. If the question is clearly not about Reed (weather, cooking, celebrity, random homework with no Reed context), say you help with Reed Education, then offer two things you can explain (how to open the app, timetable, pricing). Do not use the old line "I can only help with questions about our app."',
    '3. Do not solve full homework or write essays. Point them to the matching quiz or flashcard in the app.',
    '4. Match the user language (English or Myanmar).',
    '5. Plain text only. Never use asterisks, markdown, HTML, or # headings. Use short sentences and • bullets. Keep under 160 words.',
    '6. If you are not sure a feature exists, say so and point them to the matching tab instead of inventing it.',
    '7. Official names only: bot @reededucation_bot, channel @REED_education, website reededucation.net, contact @minaphayarkot. Never invent @REEDeducation. If they ask how to practice, tell them they are already in the bot and to tap Start Practice or pin the chat for Open App. Do not tell them to open the channel to practice.'
  ].join('\n');

  if (!looksLikeReedQuestion(raw)) {
    systemPrompt += '\n\nThis message might be casual. If it can reasonably be about Reed or school prep in our app, answer helpfully. Only steer back to Reed if it is clearly unrelated.';
  }

  try {
    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: raw }
        ],
        temperature: 0.25,
        max_tokens: 380
      })
    });

    var data = await response.json();
    if (data.error) {
      return 'Sorry, I could not answer just now. Please try again, or open the Mini App with Start Practice.';
    }
    return stripFancyText(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ||
      'Sorry, I could not answer that. Try asking about Reed, the timetable, or how to open the app.';
  } catch (err) {
    return 'Sorry, I could not answer just now. Please try again in a moment.';
  }
}

function isPrivateChat(msg) {
  return !!(msg && msg.chat && msg.chat.type === 'private');
}

function videoFileIdFromMessage(msg) {
  if (!msg) return '';
  if (msg.video && msg.video.file_id) return msg.video.file_id;
  if (msg.document && msg.document.file_id && String(msg.document.mime_type || '').indexOf('video/') === 0) {
    return msg.document.file_id;
  }
  return '';
}

async function startVideoTargets(env) {
  var out = [];
  var fileId = String((env && env.START_VIDEO_FILE_ID) || '').trim();
  var url = String((env && env.START_VIDEO_URL) || '').trim();
  if (fileId) out.push(fileId);
  if (url) out.push(url);
  if (url !== DEFAULT_START_VIDEO_URL && await urlIsReachable(DEFAULT_START_VIDEO_URL)) {
    out.push(DEFAULT_START_VIDEO_URL);
  }
  return out;
}

async function urlIsReachable(url) {
  try {
    var res = await fetch(url, { method: 'HEAD' });
    return !!(res && res.ok);
  } catch (e) {
    return false;
  }
}

async function sendStartWelcome(chatId, env) {
  var caption = startReply();
  var markup = startKeyboard();
  var targets = await startVideoTargets(env);
  for (var i = 0; i < targets.length; i++) {
    if (await sendTelegramVideo(chatId, targets[i], caption, env.BOT_TOKEN, markup)) return;
  }
  await sendTelegramMessage(chatId, caption, env.BOT_TOKEN, markup);
}

async function telegramApiJson(botToken, method, payload) {
  var res = await fetch('https://api.telegram.org/bot' + botToken + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function serveTelegramPhoto(userId, env) {
  var id = String(userId || '').replace(/[^0-9]/g, '');
  if (!id || !env.BOT_TOKEN) return new Response('missing', { status: 404 });
  var list = await telegramApiJson(env.BOT_TOKEN, 'getUserProfilePhotos', { user_id: Number(id), limit: 1 });
  var photos = list && list.ok && list.result && list.result.photos;
  if (!photos || !photos[0] || !photos[0].length) return new Response('none', { status: 404 });
  var sizes = photos[0];
  var pick = sizes[0];
  var i;
  for (i = 0; i < sizes.length; i++) {
    var w = sizes[i].width || 0;
    if (w >= 80 && w <= 160) { pick = sizes[i]; break; }
    if (w > 0 && w < (pick.width || 9999)) pick = sizes[i];
  }
  var file = await telegramApiJson(env.BOT_TOKEN, 'getFile', { file_id: pick.file_id });
  var path = file && file.ok && file.result && file.result.file_path;
  if (!path) return new Response('none', { status: 404 });
  var bin = await fetch('https://api.telegram.org/file/bot' + env.BOT_TOKEN + '/' + path);
  if (!bin.ok) return new Response('none', { status: 404 });
  return new Response(bin.body, {
    status: 200,
    headers: {
      'Content-Type': bin.headers.get('Content-Type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=21600'
    }
  });
}

function emptyUser(id) {
  return { userId: String(id), friends: [], incoming: [], outgoing: [], name: '', bio: '', updated: Date.now() };
}

async function readUser(env, id) {
  id = String(id || '').replace(/[^0-9]/g, '');
  if (!id) return emptyUser('');
  var raw = '';
  try {
    if (env.SOCIAL_KV) raw = (await env.SOCIAL_KV.get('u:' + id)) || '';
  } catch (e) {}
  if (!raw) {
    try {
      var hit = await caches.default.match(new Request('https://reed-social.internal/u/' + id));
      if (hit) raw = await hit.text();
    } catch (e2) {}
  }
  if (!raw) return emptyUser(id);
  try {
    var o = JSON.parse(raw);
    o.userId = id;
    o.friends = o.friends || [];
    o.incoming = o.incoming || [];
    o.outgoing = o.outgoing || [];
    return o;
  } catch (e3) {
    return emptyUser(id);
  }
}

async function writeUser(env, rec) {
  if (!rec || !rec.userId) return;
  var body = JSON.stringify(rec);
  try {
    if (env.SOCIAL_KV) await env.SOCIAL_KV.put('u:' + rec.userId, body);
  } catch (e) {}
  try {
    await caches.default.put(
      new Request('https://reed-social.internal/u/' + rec.userId),
      new Response(body, { headers: { 'Cache-Control': 'max-age=31536000' } })
    );
  } catch (e2) {}
}

function cardFrom(rec, id) {
  return { userId: String(id), name: (rec && rec.name) || 'Student', photo: '', bio: (rec && rec.bio) || '' };
}

async function friendState(env, userId) {
  var me = await readUser(env, userId);
  var profiles = {};
  profiles[me.userId] = { name: me.name || 'Student', photo: '', bio: me.bio || '' };
  async function loadList(ids) {
    var out = [];
    var i;
    for (i = 0; i < ids.length; i++) {
      var other = await readUser(env, ids[i]);
      profiles[other.userId] = { name: other.name || 'Student', photo: '', bio: other.bio || '' };
      out.push(cardFrom(other, ids[i]));
    }
    return out;
  }
  return {
    status: 'ok',
    friends: await loadList(me.friends),
    incoming: await loadList(me.incoming),
    outgoing: await loadList(me.outgoing),
    profiles: profiles
  };
}

async function saveProfile(env, params) {
  var id = String(params.get('userId') || params.get('fromId') || '').replace(/[^0-9]/g, '');
  if (!id) return { status: 'error', message: 'userId required' };
  var rec = await readUser(env, id);
  rec.name = String(params.get('name') || params.get('userName') || rec.name || '').slice(0, 40);
  rec.bio = String(params.get('bio') || rec.bio || '').slice(0, 80);
  rec.updated = Date.now();
  await writeUser(env, rec);
  return { status: 'ok', userId: id };
}

function uniq(list, id) {
  id = String(id);
  if (!id) return list;
  if (list.indexOf(id) === -1) list.push(id);
  return list;
}

function without(list, id) {
  id = String(id);
  return (list || []).filter(function (x) { return String(x) !== id; });
}

async function friendOp(env, params, origin) {
  var op = String(params.get('op') || params.get('friendOp') || '').toLowerCase();
  var fromId = String(params.get('fromId') || '').replace(/[^0-9]/g, '');
  var toId = String(params.get('toId') || '').replace(/[^0-9]/g, '');
  var fromName = String(params.get('fromName') || params.get('name') || 'Student').slice(0, 40);
  if (!fromId || !toId || fromId === toId) return { status: 'error', message: 'fromId and toId required' };
  var from = await readUser(env, fromId);
  var to = await readUser(env, toId);
  from.name = fromName || from.name;
  if (op === 'request') {
    if (from.friends.indexOf(toId) !== -1) return friendState(env, fromId);
    if (to.incoming.indexOf(fromId) === -1 && to.friends.indexOf(fromId) === -1) {
      to.incoming = uniq(to.incoming, fromId);
      from.outgoing = uniq(from.outgoing, toId);
      await writeUser(env, from);
      await writeUser(env, to);
      await notifyFriendRequest(env, fromId, toId, fromName, origin);
    }
    return friendState(env, fromId);
  }
  if (op === 'accept') {
    if (from.incoming.indexOf(toId) === -1 && to.outgoing.indexOf(fromId) === -1) {
      return friendState(env, fromId);
    }
    from.friends = uniq(without(from.friends, toId), toId);
    to.friends = uniq(without(to.friends, fromId), fromId);
    from.incoming = without(from.incoming, toId);
    from.outgoing = without(from.outgoing, toId);
    to.incoming = without(to.incoming, fromId);
    to.outgoing = without(to.outgoing, fromId);
    await writeUser(env, from);
    await writeUser(env, to);
    return friendState(env, fromId);
  }
  if (op === 'reject' || op === 'cancel' || op === 'unfriend') {
    from.friends = without(from.friends, toId);
    from.incoming = without(from.incoming, toId);
    from.outgoing = without(from.outgoing, toId);
    to.friends = without(to.friends, fromId);
    to.incoming = without(to.incoming, fromId);
    to.outgoing = without(to.outgoing, fromId);
    await writeUser(env, from);
    await writeUser(env, to);
    return friendState(env, fromId);
  }
  return { status: 'error', message: 'Unknown friend op' };
}

async function notifyFriendRequest(env, fromId, toId, fromName, origin) {
  if (!env.BOT_TOKEN) return;
  var text = fromName + ' wants to be friends on Reed.\nID ' + fromId + '\nOpen Social in the Mini App to accept.';
  await sendTelegramMessage(toId, text, env.BOT_TOKEN, {
    inline_keyboard: [
      [{ text: 'Accept', callback_data: 'friend_accept_' + fromId }],
      [{ text: 'Open Social', url: 'https://t.me/reededucation_bot/app' }]
    ]
  });
}

async function handleFriendCallback(q, env) {
  var data = String((q && q.data) || '');
  var fromChat = q && q.from && q.from.id;
  if (!fromChat || data.indexOf('friend_accept_') !== 0) return;
  var other = data.replace('friend_accept_', '').replace(/[^0-9]/g, '');
  var params = new URLSearchParams({ op: 'accept', fromId: String(fromChat), toId: other });
  await friendOp(env, params, '');
  try {
    await telegramApiJson(env.BOT_TOKEN, 'answerCallbackQuery', { callback_query_id: q.id, text: 'You are friends now' });
  } catch (e) {}
}

async function acceptStartFriend(chatId, payload, env) {
  var parts = String(payload || '').split('_');
  var fromId = parts[1] || '';
  if (!fromId) {
    await sendStartWelcome(chatId, env);
    return;
  }
  var params = new URLSearchParams({ op: 'accept', fromId: String(chatId), toId: String(fromId).replace(/[^0-9]/g, '') });
  await friendOp(env, params, '');
  await sendTelegramMessage(chatId, 'Friend request accepted. Open Social in the Mini App.', env.BOT_TOKEN);
}

async function telegramApi(botToken, method, payload) {
  var res = await fetch('https://api.telegram.org/bot' + botToken + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  try {
    var data = await res.json();
    return !!(data && data.ok);
  } catch (e) {
    return false;
  }
}

async function sendTelegramMessage(chatId, text, botToken, replyMarkup) {
  var clean = stripFancyText(text);
  if (!clean) return false;
  var payload = {
    chat_id: chatId,
    text: clean
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return telegramApi(botToken, 'sendMessage', payload);
}

async function sendTelegramVideo(chatId, video, caption, botToken, replyMarkup) {
  var clean = stripFancyText(caption);
  var payload = {
    chat_id: chatId,
    video: video,
    caption: clean,
    supports_streaming: true
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return telegramApi(botToken, 'sendVideo', payload);
}
