/* Reed Education Telegram bot — Cloudflare Worker
   Secrets: BOT_TOKEN, OPENAI_API_KEY
   Optional: START_VIDEO_FILE_ID, START_VIDEO_URL
   Paste this file into the Worker and deploy.
   Saved customer replies need a KV namespace binding named REPLIES.

   Daily sales to the admin needs a Cloudflare Cron Trigger on this worker:
   30 17 * * *  (23:30 Asia/Yangon).
   Paid unlocks are written with the existing TG APP SHEET web app (saveMulti).

   GET /photo?id=TELEGRAM_ID  live Telegram profile JPEG for Rank.
   POST webhook stays the /start + chat helper.

   Channel posts: in this bot chat, the admin sends
     /post
     the post text

     + label
   The bot publishes that text to @REED_education with one button under it.
   A line that is only "+ label" sets the button text and is not posted.
   With no such line the button says Open App.
   Channel posts cannot use a web_app button, so the button is a t.me mini-app link.

   /start caption is a few short Burmese lines.
   Video is sent if any of these work, in order:
     1) START_VIDEO_FILE_ID (must come from THIS bot)
     2) START_VIDEO_URL (direct https mp4 link)
     3) https://reededucation.net/start-welcome.mp4
   If none work, text is still sent.

   Easiest: upload start-welcome.mp4 to the GitHub repo root
   (GitHub → Add file → Upload). Pages will serve it at the URL above. */

var DEFAULT_START_VIDEO_URL = 'https://reededucation.net/start-welcome.mp4?v=2';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDailySales(env));
  },
  async fetch(request, env) {
    var url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 204 }));
    }
    if (request.method === 'GET' && isPhotoPath(url)) {
      try {
        return corsResponse(await serveTelegramPhoto(photoIdFromUrl(url), env));
      } catch (e) {
        return corsResponse(new Response('none', { status: 404 }));
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

    if (update && update.callback_query) {
      try { await handlePayDecision(update.callback_query, env); } catch (e) {}
      return new Response('OK', { status: 200 });
    }

    const msg = update && update.message;
    const chatId = msg && msg.chat && msg.chat.id;
    if (chatId && msg) {
      try {
        if (commandName(msg.text) === '/post' && isPrivateChat(msg)) {
          await handleChannelPost(msg, env);
        } else if (commandName(msg.text) === '/sales' && isPrivateChat(msg)) {
          await handleSalesCommand(msg, env);
        } else if (commandName(msg.text) === '/start') {
          await sendStartWelcome(chatId, env);
        } else if (isPostAdmin(msg, env) && isPrivateChat(msg) && meaningWord(msg.text)) {
          await handleSaveReply(msg, env);
        } else if (videoFileIdFromMessage(msg) && isPrivateChat(msg) && isPostAdmin(msg, env)) {
          await sendTelegramMessage(
            chatId,
            'Save this as Worker secret START_VIDEO_FILE_ID:\n' + videoFileIdFromMessage(msg),
            env.BOT_TOKEN
          );
        } else if (isPostAdmin(msg, env) && isPrivateChat(msg)) {
          // Admin text, photo, or voice is a saved reply, never a customer payment slip.
        } else if (paymentPhoto(msg) && isPrivateChat(msg)) {
          await handleCustomerPhoto(msg, env);
        } else if (typeof msg.text === 'string' && msg.text.trim()) {
          await replyForIntent(chatId, msg.text, env, msg);
        } else if (isPrivateChat(msg) && !isPostAdmin(msg, env)) {
          await sendUnmatched(msg, env);
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

function isPhotoPath(url) {
  return url.pathname === '/photo'
    || url.pathname.indexOf('/photo/') === 0
    || url.searchParams.get('action') === 'photo';
}

function photoIdFromUrl(url) {
  return url.searchParams.get('id')
    || url.searchParams.get('userId')
    || url.pathname.split('/')[2]
    || '';
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
    '• Rank — exam countdown and the score leaderboard. Tap a rank row to preview photo, name, and stats.',
    '• Analysis — daily motivation, accuracy, questions, time, subject radar',
    '• Me — profile, bio, paid unlocks, News, volunteer',
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
    'Reed မှ ကြိုဆိုပါတယ်။',
    'Reed App က objective question အတွက်ပါ။ တစ်ခြားလေ့ကျင့်မှုက နည်းပါတယ်။',
    'Grade 10, 11, 12။',
    'App ဖွင့်ရန် Start Practice ကို နှိပ်ပါ။',
    '',
    'သတင်းအတွက် Channel ကို join ပေးပါ — @REED_education'
  ].join('\n');
}

function startKeyboard() {
  return {
    inline_keyboard: [
      [{ text: 'Channel join မည်', url: 'https://t.me/REED_education' }]
    ]
  };
}

var CHANNEL_CHAT = '@REED_education';
var OPEN_APP_LABEL = 'Open App';
var OPEN_APP_URL = 'https://t.me/reededucation_bot?startapp';
var POST_ADMIN_ID = '8432363664';
var PAID_SHEET_URL = 'https://script.google.com/macros/s/AKfycbw8uoBL28zm8B52oeGy1d0a2XPEyq8nAZ4hj_WClNNEdJFqtj3CBwkbypxOqgjr-7oV/exec';
var PLAN_BY_AMOUNT = { 9500: 1, 19500: 3, 29500: 6, 34500: 13 };
var PLAN_PRICE = { 1: 9500, 3: 19500, 6: 29500, 13: 34500 };
var FIXED_REPLIES = {
  hello: 'မင်္ဂလာပါဗျ'
};
var UNMATCHED_REPLY = 'Reed App က objective question အတွက်ပါ။';
var CORE_SUBJECTS = ['mm', 'en', 'math', 'phy', 'chem'];
var SUBJECT_WORDS = [
  ['all', /all|အားလုံး/i],
  ['mm', /myanmar|မြန်မာ/i],
  ['en', /english|အင်္ဂလိပ်/i],
  ['math', /maths?|သင်္ချာ/i],
  ['phy', /physics|ရူပ/i],
  ['chem', /chemistry|chem|ဓာတု/i],
  ['bio', /biology|bio|ဇီဝ/i],
  ['eco', /economics|eco|ဘောဂ/i]
];
var SUBJECT_LABELS = {
  all: 'All', mm: 'Myanmar', en: 'English', math: 'Mathematics',
  phy: 'Physics', chem: 'Chemistry', bio: 'Biology', eco: 'Economics'
};

function fixedReply(intent) {
  return FIXED_REPLIES[intent] || UNMATCHED_REPLY;
}

function meaningWord(text) {
  var raw = String(text || '').trim();
  var match = raw.match(/^\+\s*(\S+)$/);
  if (!match) return '';
  var word = match[1].toLowerCase();
  if (!word || word.length > 32 || /[+\s]/.test(word)) return '';
  return word;
}

function voiceFile(msg) {
  return msg && msg.voice && msg.voice.file_id ? msg.voice : null;
}

function mediaRecord(msg) {
  if (!msg) return null;
  var voice = voiceFile(msg);
  if (voice) return { type: 'voice', fileId: voice.file_id, caption: '', text: '' };
  var photo = paymentPhoto(msg);
  if (photo && photo.file_id) {
    return { type: 'photo', fileId: photo.file_id, caption: String(msg.caption || ''), text: '' };
  }
  var text = String(msg.text || '').trim();
  if (text && !meaningWord(text)) return { type: 'text', fileId: '', caption: '', text: text };
  return null;
}

function canonMeaning(word) {
  var w = String(word || '').toLowerCase();
  if (w === 'stepbystep' || w === 'step-by-step' || w === 'step_by_step') return 'stepbstep';
  return w;
}

function replyKey(word) {
  return 'reply:' + canonMeaning(word);
}

async function saveReplyRecord(env, word, record) {
  var key = canonMeaning(word);
  if (!env || !env.REPLIES || !key) return false;
  if (key === 'stepbstep') {
    var existing = await loadReplyRecord(env, key);
    var parts = existing && existing.parts ? existing.parts.slice() : [];
    if ((!parts.length) && existing && existing.type) parts = [existing];
    var replaced = false;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === record.type) {
        parts[i] = record;
        replaced = true;
      }
    }
    if (!replaced) parts.push(record);
    await env.REPLIES.put(replyKey(key), JSON.stringify({ meaning: key, parts: parts }));
    return true;
  }
  await env.REPLIES.put(replyKey(key), JSON.stringify(record));
  return true;
}

async function loadReplyRecord(env, word) {
  if (!env || !env.REPLIES || !word) return null;
  var raw = await env.REPLIES.get(replyKey(word));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function savedMeanings(env) {
  if (!env || !env.REPLIES || !env.REPLIES.list) return [];
  try {
    var listed = await env.REPLIES.list({ prefix: 'reply:' });
    return (listed && listed.keys || []).map(function (key) {
      return String(key.name || '').replace(/^reply:/, '');
    }).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function handleSaveReply(msg, env) {
  var word = canonMeaning(meaningWord(msg.text));
  var media = mediaRecord(msg.reply_to_message);
  if (!media) {
    await sendTelegramMessage(msg.chat.id, 'Reply to the text, photo, or voice.', env.BOT_TOKEN);
    return;
  }
  var from = msg.reply_to_message;
  var ok = await saveReplyRecord(env, word, {
    meaning: word,
    fromChatId: String(from.chat && from.chat.id || msg.chat.id),
    messageId: from.message_id,
    fileId: media.fileId,
    type: media.type,
    caption: media.caption,
    text: media.text
  });
  await sendTelegramMessage(
    msg.chat.id,
    ok ? 'Saved' : 'Not saved. Add KV binding REPLIES on this worker.',
    env.BOT_TOKEN
  );
}

async function sendSavedReply(chatId, record, env) {
  if (record.messageId && record.fromChatId) {
    var copied = await telegramApiJson(env.BOT_TOKEN, 'copyMessage', {
      chat_id: chatId,
      from_chat_id: record.fromChatId,
      message_id: record.messageId
    });
    if (copied && copied.ok) return true;
  }
  if (record.type === 'text') {
    if (!record.text) return false;
    var text = await telegramApiJson(env.BOT_TOKEN, 'sendMessage', {
      chat_id: chatId,
      text: record.text
    });
    return !!(text && text.ok);
  }
  if (record.type === 'voice') {
    var voice = await telegramApiJson(env.BOT_TOKEN, 'sendVoice', {
      chat_id: chatId,
      voice: record.fileId
    });
    return !!(voice && voice.ok);
  }
  var photo = { chat_id: chatId, photo: record.fileId };
  if (record.caption) photo.caption = record.caption;
  var sent = await telegramApiJson(env.BOT_TOKEN, 'sendPhoto', photo);
  return !!(sent && sent.ok);
}

async function sendMeaning(chatId, meaning, env) {
  var saved = await loadReplyRecord(env, canonMeaning(meaning));
  var parts = saved && saved.parts && saved.parts.length ? saved.parts : null;
  if (!parts && saved && (saved.fileId || saved.text || saved.messageId)) parts = [saved];
  if (parts) {
    var sent = false;
    for (var i = 0; i < parts.length; i++) {
      try {
        if (await sendSavedReply(chatId, parts[i], env)) sent = true;
      } catch (e) {}
    }
    if (sent) return true;
  }
  var text = FIXED_REPLIES[canonMeaning(meaning)];
  if (!text) return false;
  await sendTelegramMessage(chatId, text, env.BOT_TOKEN);
  return true;
}

function pendingKey(chatId) {
  return 'pending:' + chatId;
}

async function rememberSlip(env, chatId, months) {
  if (!env || !env.REPLIES) return;
  await env.REPLIES.put(pendingKey(chatId), JSON.stringify({ months: Number(months) || 0 }));
}

async function loadPending(env, chatId) {
  if (!env || !env.REPLIES) return null;
  var raw = await env.REPLIES.get(pendingKey(chatId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function clearPending(env, chatId) {
  if (!env || !env.REPLIES || !env.REPLIES.delete) return;
  try { await env.REPLIES.delete(pendingKey(chatId)); } catch (e) {}
}

function gradeChoice(text) {
  var raw = String(text || '')
    .replace(/၁၀/g, '10')
    .replace(/၁၁/g, '11')
    .replace(/၁၂/g, '12');
  var found = [];
  function add(n) {
    if (found.indexOf(n) === -1) found.push(n);
  }
  var patterns = [
    /grade\s*(10|11|12)/ig,
    /\bg\s*(10|11|12)\b/ig,
    /(?:^|[^\d])(10|11|12)\s*တန်း/g,
    /တန်း\s*(10|11|12)/g,
    /(?:^|[^\d])(10|11|12)(?!\d)\s*(?:bio|eco|biology|econom)/ig,
    /(?:bio|eco|biology|econom)\s*(10|11|12)(?!\d)/ig
  ];
  for (var p = 0; p < patterns.length; p++) {
    var match;
    while ((match = patterns[p].exec(raw))) add(Number(match[1]));
  }
  return found.length === 1 ? found[0] : 0;
}

function buyerNote(slip, msg) {
  return [slip && slip.note, msg && msg.caption, msg && msg.text].filter(function (part) {
    return String(part || '').trim();
  }).join('\n');
}

function sixthSubject(text) {
  var raw = String(text || '');
  var bio = /biology|\bbio\b|ဇီဝ/i.test(raw);
  var eco = /econom/i.test(raw) || /\beco\b/i.test(raw) || /ဘောဂ/.test(raw);
  if (bio === eco) return '';
  return bio ? 'bio' : 'eco';
}

function typedId(text) {
  var match = String(text || '').match(/(?:^|\D)(\d{6,12})(?!\d)/);
  return match ? match[1] : '';
}

async function openBuyerSubjects(msg, env, grade, sixth) {
  var pending = await loadPending(env, msg.chat.id);
  var months = pending && Number(pending.months) || 0;
  if (!months || !sixth) return;
  var id = typedId(msg.text || msg.caption || '') || String(msg.from && msg.from.id || msg.chat.id);
  var wrote = await savePaidSubjects({
    id: id,
    grade: grade,
    subjects: CORE_SUBJECTS.concat([sixth]),
    months: months
  });
  if (!wrote || wrote.success !== true) return false;
  await clearPending(env, msg.chat.id);
  return true;
}

async function sendUnmatched(msg, env) {
  await sendTelegramMessage(msg.chat.id, UNMATCHED_REPLY, env.BOT_TOKEN);
}

async function replyForIntent(chatId, text, env, msg) {
  var hinted = keywordIntent(text);
  if (hinted === 'notopen') {
    if (!(await sendMeaning(chatId, 'notopen', env))) await sendStudyAnswer(chatId, text, env);
    return;
  }
  if (hinted === 'hello' || hinted === 'price' || hinted === 'pay' || hinted === 'reed' || hinted === 'explain' || hinted === 'stepbstep') {
    await sendMeaning(chatId, hinted, env);
    return;
  }
  var pending = await loadPending(env, chatId);
  var sixth = sixthSubject(text);
  var grade = gradeChoice(text);
  if (pending && Number(pending.months)) {
    if (sixth && grade) {
      var opened = await openBuyerSubjects(msg || { chat: { id: chatId }, text: text, from: {} }, env, grade, sixth);
      if (opened) await sendMeaning(chatId, 'complete', env);
      return;
    }
    if (sixth || grade) {
      await sendMeaning(chatId, 'askag', env);
      return;
    }
  }
  if (hinted === 'study') {
    await sendStudyAnswer(chatId, text, env);
    return;
  }
  var intent = await classifyIntent(text, env && env.OPENAI_API_KEY);
  if (intent === 'notopen') {
    if (!(await sendMeaning(chatId, 'notopen', env))) await sendStudyAnswer(chatId, text, env);
    return;
  }
  if (intent === 'hello' || intent === 'price' || intent === 'pay' || intent === 'reed' || intent === 'explain' || intent === 'stepbstep') {
    await sendMeaning(chatId, intent, env);
    return;
  }
  if (intent === 'study') {
    await sendStudyAnswer(chatId, text, env);
    return;
  }
  var answer = await studyAnswer(text, env && env.OPENAI_API_KEY);
  if (answer) await sendTelegramMessage(chatId, answer, env.BOT_TOKEN);
}

function isHello(text) {
  var raw = String(text || '').trim();
  var lower = raw.toLowerCase();
  if (['hi', 'hello', 'hey', 'hii', 'yo', 'mingalaba', 'mingalarbar', 'good morning', 'good evening'].indexOf(lower) !== -1) return true;
  return /^(မင်္ဂလာပါ|မဂလာပါ|ဟိုင်း|ဟဲလို|ဟယ်လို)(ဗျ|ရှင်|ခင်ဗျာ?)?$/.test(raw);
}

function isReedQuestion(text) {
  var s = String(text || '');
  if (/\breed\b|reededucation|ရီးဒ်|ရိဒ်/i.test(s)) return true;
  if (/(what|who|about|for|ဘာ|ရှင်း|ဘယ်).{0,48}(\bapp\b|အက်ပ်|အက်ပ|\bbot\b)/i.test(s)) return true;
  if (/(\bapp\b|အက်ပ်|အက်ပ|\bbot\b).{0,48}(what|who|about|for|ဘာ|ရှင်း)/i.test(s)) return true;
  if (/what(?:'s| is| are)? (this|it)(?: for)?\b/i.test(s)) return true;
  if (/what do you do|who are you|tell me about (this|it|yourself|reed|the app)/i.test(s)) return true;
  if (/ဘာအတွက်|ဘာလုပ်|ဆိုတာ/.test(s)) return true;
  return false;
}

function isExplainQuestion(text) {
  return /explain|explanation|ရှင်းပြ|ရှင်းပေး/i.test(String(text || ''));
}

function isNotOpenQuestion(text) {
  var s = String(text || '');
  return /not unlock|cannot open|can't open|can not open|doesn't open|does not open|won't open|will not open|not opening|not working|subjects?.{0,24}not|ဝင်မရ|မဝင်ဘူး|မဝင်နိုင်|မပွင့်|မဖွင့်နိုင်|မဖွင့်ရ|အလုပ်မလုပ်/i.test(s);
}

function isEnterQuestion(text) {
  var s = String(text || '');
  if (isNotOpenQuestion(s)) return false;
  return /how (?:do|to|can|should).{0,60}(?:open|enter|get in|start)|(?:open|enter|get into|start) (?:the |this )?(?:reed |reededucation )?(?:app|bot)|app ထဲ|အက်ပ်ထဲ|ဘယ်လို\s*ဖွင့်|ဖွင့်\s*ရမလဲ|ဘယ်လို\s*ဝင်|ဝင်\s*ရမလဲ|အက်ပ်\s*ဖွင့်|app\s*ဖွင့်/i.test(s);
}

function isStudyQuestion(text) {
  var s = String(text || '');
  return /practice|stud(?:y|ying)|revise|revision|quiz|chapter|exam|higher grade|how (?:do|to|can).{0,24}(?:practice|study|learn)|လေ့ကျင့်|ကျက်|စာမေးပွဲ|အခန်း/i.test(s);
}

function keywordIntent(text) {
  var s = String(text || '');
  if (/ဈေး|price|ဘယ်လောက်|how much|ဈေးနှုန်း/i.test(s)) return 'price';
  if (/k\s*pay|\bkbz\b|\bwave\b|transfer|ငွေလွှဲ|ငွေပို့|ဝယ်မယ်|ဝယ်ချင်|want to buy|\bbuy\b/i.test(s)) return 'pay';
  if (isHello(s)) return 'hello';
  if (isNotOpenQuestion(s)) return 'notopen';
  if (isEnterQuestion(s)) return 'stepbstep';
  if (isExplainQuestion(s)) return 'explain';
  if (isStudyQuestion(s)) return 'study';
  if (isReedQuestion(s)) return 'reed';
  return 'other';
}

function allowedMeanings() {
  return ['hello', 'price', 'pay', 'reed', 'explain', 'stepbstep', 'notopen', 'study', 'other'];
}

var NOT_A_DOWNLOAD = 'Reed is not a download. Open @reededucation_bot and tap Start Practice.';

function withoutStoreClaim(text) {
  var s = String(text || '');
  if (/play\s*store|app\s*store|google\s*play|download (?:reed|the app|this app|it\b)/i.test(s)) return NOT_A_DOWNLOAD;
  return s;
}

var STUDY_FACTS = [
  'You answer only about Reed App and studying. Two or three short sentences. Plain text. No markdown.',
  'Write the names Reed and App in English letters. Never write those names in Burmese script.',
  'Match the customer language.',
  'Reed is not on Google Play, the App Store, or any store. It is not a downloadable app. Never tell a customer to download it.',
  'The only way in is to open @reededucation_bot and tap Start Practice.',
  'If a customer cannot open the app or the subjects, it can be their internet. Tell them to use a VPN, especially 1.1.1.1. Do not mention a store. Do not send them to an admin.',
  'Facts: Reed App is an objective-question specialist. Other practice is minor.',
  'Grades are 10, 11, and 12. Pick one grade. Unlocks stay on that grade.',
  'Only the 6-subject pack is sold: Myanmar, English, Maths, Physics, Chemistry, plus Biology or Economics.',
  'Prices in MMK: 1 month 9500, 3 months 19500, 6 months 29500, 13 months 34500.',
  'Chapter 1 can be tried. Later chapters open after the pack is bought.',
  'If the message is daily life or personal, or not about Reed, the app, studying, practice, grades, quizzes, or subjects, reply with exactly SKIP.'
].join('\n');

async function studyAnswer(text, apiKey) {
  if (!apiKey) return '';
  try {
    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 180,
        messages: [
          { role: 'system', content: STUDY_FACTS },
          { role: 'user', content: String(text || '') }
        ]
      })
    });
    var data = await response.json();
    var said = String(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
    if (!said || /^skip$/i.test(said)) return '';
    return withoutStoreClaim(stripFancyText(said));
  } catch (e) {
    return '';
  }
}

async function sendStudyAnswer(chatId, text, env) {
  var answer = await studyAnswer(text, env && env.OPENAI_API_KEY);
  if (answer) await sendTelegramMessage(chatId, answer, env.BOT_TOKEN);
}

async function classifyIntent(text, apiKey) {
  var raw = String(text || '').trim();
  var allowed = allowedMeanings();
  if (commandName(raw) === '/start' || commandName(raw) === '/help') return 'other';
  var hinted = keywordIntent(raw);
  if (hinted !== 'other') return hinted;
  if (!apiKey) return 'other';
  try {
    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 8,
        messages: [
          {
            role: 'system',
            content: 'Classify the customer message. Reply with one word only: ' + allowed.join(', ') + '. If the sentence is incomplete, choose the closest of those meanings. notopen means they cannot get in or the subjects will not open, including Burmese such as ဝင်မရဘူး. explain means they want Reed or the app explained. stepbstep means how to open or enter the app. reed means what Reed is. study means practicing or higher grades. other means daily life or personal. A photo of the app is not a payment.'
          },
          { role: 'user', content: raw }
        ]
      })
    });
    var data = await response.json();
    var said = String(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').toLowerCase();
    var found = said.match(new RegExp('\\b(' + allowed.map(function (word) {
      return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')\\b'));
    if (found) return found[1];
  } catch (e) {}
  return keywordIntent(raw);
}

function paymentPhoto(msg) {
  if (!msg) return null;
  if (msg.photo && msg.photo.length) return msg.photo[msg.photo.length - 1];
  var doc = msg.document;
  if (!doc) return null;
  var mime = String(doc.mime_type || '');
  var name = String(doc.file_name || '');
  if (mime.indexOf('image/') === 0 || /\.(jpe?g|png|webp|gif)$/i.test(name)) return doc;
  return null;
}

function parseAsk(text) {
  var raw = String(text || '')
    .replace(/၁၀/g, '10')
    .replace(/၁၁/g, '11')
    .replace(/၁၂/g, '12');
  var gradeMatch = raw.match(/grade\s*(10|11|12)/i)
    || raw.match(/\bg\s*(10|11|12)\b/i)
    || raw.match(/(?:^|[^\d])(10|11|12)\s*တန်း/);
  var grade = gradeMatch ? Number(gradeMatch[1]) : 0;
  var subjects = [];
  for (var i = 0; i < SUBJECT_WORDS.length; i++) {
    if (SUBJECT_WORDS[i][1].test(raw) && subjects.indexOf(SUBJECT_WORDS[i][0]) === -1) {
      subjects.push(SUBJECT_WORDS[i][0]);
    }
  }
  if (subjects.indexOf('all') !== -1) subjects = ['all'];
  return { grade: grade, subjects: subjects };
}

function englishDigits(text) {
  return String(text || '')
    .replace(/[၀-၉]/g, function (d) { return String('၀၁၂၃၄၅၆၇၈၉'.indexOf(d)); })
    .replace(/[၊\u104A\uFF0C]/g, ',')
    .replace(/(\d)[။\u104B](?=\d)/g, '$1.')
    .replace(/(\d)[\s\u00A0\u2009\u202F]+(?=\d)/g, '$1');
}

function amountNumber(text) {
  var s = englishDigits(text);
  var money = [];
  var plain = [];
  var re = /-?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/g;
  var match;
  while ((match = re.exec(s))) {
    var raw = match[1];
    var digits = raw.replace(/,/g, '');
    if (digits.length > 6) continue;
    var n = Number(digits);
    if (!n) continue;
    var tail = s.slice(match.index, match.index + match[0].length + 12);
    var looksMoney = raw.indexOf(',') !== -1 || !!match[2] || /ks|mmk|ကျပ်/i.test(tail);
    if (looksMoney) money.push(n);
    else plain.push(n);
  }
  if (money.length) return money[0];
  if (plain.length === 1) return plain[0];
  return 0;
}

function txnId(text) {
  var s = englishDigits(text);
  var best = '';
  var re = /\d{8,}/g;
  var match;
  while ((match = re.exec(s))) {
    var id = match[0];
    if (/^09\d{6,10}$/.test(id)) continue;
    if (id.length > best.length) best = id;
  }
  return best;
}

function pad2(n) {
  var s = String(n);
  return s.length < 2 ? '0' + s : s;
}

function ymd(year, month, day) {
  var y = Number(year);
  var m = Number(month);
  var d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return '';
  return y + '-' + pad2(m) + '-' + pad2(d);
}

function receiptDay(timeText) {
  var s = englishDigits(timeText);
  var numeric = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (numeric) {
    var a = Number(numeric[1]);
    var b = Number(numeric[2]);
    var year = Number(numeric[3]);
    var day = a;
    var month = b;
    if (month > 12 && day <= 12) {
      day = b;
      month = a;
    }
    return ymd(year, month, day);
  }
  var months = [
    ['january', 1], ['february', 2], ['march', 3], ['april', 4], ['may', 5], ['june', 6],
    ['july', 7], ['august', 8], ['september', 9], ['october', 10], ['november', 11], ['december', 12],
    ['jan', 1], ['feb', 2], ['mar', 3], ['apr', 4], ['jun', 6], ['jul', 7], ['aug', 8], ['sep', 9], ['oct', 10], ['nov', 11], ['dec', 12],
    ['ဇန်နဝါရီ', 1], ['ဖေဖော်ဝါရီ', 2], ['မတ်', 3], ['ဧပြီ', 4], ['မေ', 5], ['ဇွန်', 6],
    ['ဇူလိုင်', 7], ['သြဂုတ်', 8], ['စက်တင်ဘာ', 9], ['အောက်တိုဘာ', 10], ['နိုဝင်ဘာ', 11], ['ဒီဇင်ဘာ', 12]
  ];
  for (var i = 0; i < months.length; i++) {
    var hit = s.match(new RegExp('(\\d{1,2})\\s*' + months[i][0] + '\\s*(\\d{4})', 'i'));
    if (hit) return ymd(hit[2], months[i][1], hit[1]);
  }
  return '';
}

function monthsForAmount(amount) {
  return PLAN_BY_AMOUNT[amountNumber(amount)] || 0;
}

function yangonToday() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Yangon', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function addMonths(ymd, months) {
  var p = String(ymd || '').split('-');
  var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  if (isNaN(dt.getTime())) return '';
  dt.setUTCMonth(dt.getUTCMonth() + Number(months || 0));
  var m = String(dt.getUTCMonth() + 1);
  var d = String(dt.getUTCDate());
  if (m.length < 2) m = '0' + m;
  if (d.length < 2) d = '0' + d;
  return dt.getUTCFullYear() + '-' + m + '-' + d;
}

function logDay(value) {
  var s = String(value || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = new Date(s);
  if (isNaN(d.getTime())) {
    var iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return iso ? iso[1] : '';
  }
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Yangon', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
  } catch (e) {
    return d.toISOString().slice(0, 10);
  }
}

function subjectLine(ids) {
  return (ids || []).map(function (id) { return SUBJECT_LABELS[id] || id; }).join(', ');
}

function paymentCaption(fields) {
  return [
    'Payment check',
    'Status: pending',
    'ID: ' + fields.id,
    'Name: ' + (fields.name || '-'),
    'Amount: ' + (fields.amount || '-'),
    'Time: ' + (fields.time || '-'),
    'Last: ' + (fields.last4 || '-'),
    'Grade: ' + fields.grade,
    'Subjects: ' + fields.subjects.join(','),
    'Months: ' + (fields.months || '-')
  ].join('\n');
}

function parsePaymentCaption(text) {
  var lines = String(text || '').split('\n');
  var map = {};
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/^([A-Za-z]+):\s*(.*)$/);
    if (m) map[m[1].toLowerCase()] = String(m[2] || '').trim();
  }
  var subjects = String(map.subjects || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  return {
    status: map.status || '',
    id: map.id || '',
    name: map.name || '',
    amount: map.amount || '',
    time: map.time || '',
    last4: map.last || '',
    grade: Number(map.grade) || 0,
    subjects: subjects,
    months: Number(map.months) || 0
  };
}

function payKeyboard() {
  return {
    inline_keyboard: [[
      { text: 'Approve', callback_data: 'payok' },
      { text: 'Reject', callback_data: 'payno' }
    ]]
  };
}

async function readSlip(fileId, env) {
  var empty = { amount: '', name: '', time: '', last4: '', note: '', txn: '' };
  if (!env || !env.OPENAI_API_KEY || !fileId) return empty;
  var file = await telegramApiJson(env.BOT_TOKEN, 'getFile', { file_id: fileId });
  var path = file && file.result && file.result.file_path;
  if (!path) return empty;
  var bin = await fetch('https://api.telegram.org/file/bot' + env.BOT_TOKEN + '/' + path);
  if (!bin.ok) return empty;
  var bytes = new Uint8Array(await bin.arrayBuffer());
  var b64 = '';
  try { b64 = bytesToBase64(bytes); } catch (e) { return empty; }
  if (!b64) return empty;
  var mime = /\.png$/i.test(path) ? 'image/png' : 'image/jpeg';
  try {
    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.OPENAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 240,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Read this payment slip. Return JSON only with keys amount, name, time, txn, last4, note. amount must be the large paid total copied as printed. If those digits are Burmese, copy the Burmese characters ၀၁၂၃၄၅၆၇၈၉ exactly. Do not convert them to English digits. ၇ is not ၂. On Wave the amount is the large number under the yellow title, such as ၁၇,၀၀၀.၀၀ or ၅,၀၀၀.၀၀, not the phone and not the transaction id. On KBZ it is the large line such as -40,000.00 Ks; keep the digits, drop a leading minus. time is the transfer date and time as shown. txn is the transaction id only, never a 09 phone. last4 is the last digits shown, copied as printed. note is only the မှတ်ချက် line, copied as written. Leave note empty if that line is blank. Do not guess a grade or subject. Use empty strings if missing.' },
            { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64 } }
          ]
        }]
      })
    });
    var data = await response.json();
    var parsed = JSON.parse(data.choices[0].message.content);
    return {
      amount: String(parsed.amount || ''),
      name: String(parsed.name || ''),
      time: String(parsed.time || ''),
      last4: String(parsed.last4 || ''),
      note: String(parsed.note || ''),
      txn: String(parsed.txn || '')
    };
  } catch (e) {
    return empty;
  }
}

function usedTxnKey(txn) {
  return 'txn:' + txn;
}

async function slipAlreadyUsed(env, txn) {
  if (!env || !env.REPLIES || !txn) return false;
  return !!(await env.REPLIES.get(usedTxnKey(txn)));
}

async function markSlipUsed(env, txn) {
  if (!env || !env.REPLIES || !txn) return;
  await env.REPLIES.put(usedTxnKey(txn), '1');
}

function customerForwardLines(msg) {
  var from = (msg && msg.from) || {};
  var id = String(from.id || (msg && msg.chat && msg.chat.id) || '');
  var username = String(from.username || '').replace(/^@/, '');
  var name = [from.first_name, from.last_name].filter(Boolean).join(' ') || '-';
  return [
    'ID: ' + id,
    'User: ' + (username ? '@' + username : 'no username'),
    'Name: ' + name
  ].join('\n');
}

async function forwardUnplannedPayment(msg, env, amount, extra) {
  var caption = 'Payment\n' + customerForwardLines(msg) + '\nAmount: ' + (amount || '-');
  if (extra) caption += '\n' + extra;
  var photo = paymentPhoto(msg);
  if (photo && photo.file_id) {
    var sent = await telegramApiJson(env.BOT_TOKEN, 'sendPhoto', {
      chat_id: POST_ADMIN_ID,
      photo: photo.file_id,
      caption: caption
    });
    if (sent && sent.ok) return;
  }
  await telegramApiJson(env.BOT_TOKEN, 'sendMessage', {
    chat_id: POST_ADMIN_ID,
    text: caption
  });
}

async function receiptKind(fileId, env) {
  if (!env || !env.OPENAI_API_KEY || !fileId) return 'other';
  var file = await telegramApiJson(env.BOT_TOKEN, 'getFile', { file_id: fileId });
  var path = file && file.result && file.result.file_path;
  if (!path) return 'other';
  var bin = await fetch('https://api.telegram.org/file/bot' + env.BOT_TOKEN + '/' + path);
  if (!bin.ok) return 'other';
  var bytes = new Uint8Array(await bin.arrayBuffer());
  var b64 = '';
  try { b64 = bytesToBase64(bytes); } catch (e) { return 'other'; }
  if (!b64) return 'other';
  var mime = /\.png$/i.test(path) ? 'image/png' : 'image/jpeg';
  try {
    var response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.OPENAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 8,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What is this image? Reply with one word: kbz, wave, or other. kbz only for a blue KBZ Pay or KBZ Bank receipt. wave only for a yellow Wave receipt. other for a phone screen, a black or grey mini app, REED Official App, four squares, an app link, or anything that is not one of those two receipts.' },
            { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64 } }
          ]
        }]
      })
    });
    var data = await response.json();
    var word = String(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').toLowerCase();
    if (word.indexOf('kbz') >= 0) return 'kbz';
    if (word.indexOf('wave') >= 0) return 'wave';
    return 'other';
  } catch (e) {
    return 'other';
  }
}

async function handleCustomerPhoto(msg, env) {
  var photo = paymentPhoto(msg);
  var kind = 'other';
  try { kind = await receiptKind(photo && photo.file_id, env); } catch (e) {}
  if (kind !== 'kbz' && kind !== 'wave') {
    await sendMeaning(msg.chat.id, 'notopen', env);
    return;
  }
  await handlePaymentPhoto(msg, env);
}

async function handlePaymentPhoto(msg, env) {
  var photo = paymentPhoto(msg);
  var slip = { amount: '', note: '', time: '', txn: '' };
  try {
    if (photo) slip = await readSlip(photo.file_id, env) || slip;
  } catch (e) {}
  var amount = amountNumber(slip && slip.amount);
  var months = PLAN_BY_AMOUNT[amount] || 0;
  var txn = txnId(slip && slip.txn);
  var detail = 'Txn: ' + (txn || '-');
  if (!txn) {
    await forwardUnplannedPayment(msg, env, amount, 'Transaction id was not read.\n' + detail);
    return;
  }
  var used = false;
  try { used = await slipAlreadyUsed(env, txn); } catch (e) {}
  if (used) {
    await forwardUnplannedPayment(msg, env, amount, 'Receipt was already used.\n' + detail);
    return;
  }
  if (!months) {
    try { await markSlipUsed(env, txn); } catch (e) {}
    await forwardUnplannedPayment(msg, env, amount, 'Amount is not a plan.\n' + detail);
    return;
  }
  try { await markSlipUsed(env, txn); } catch (e) {}
  await rememberSlip(env, msg.chat.id, months);
  var note = buyerNote(slip, msg);
  var sixth = sixthSubject(note);
  var grade = gradeChoice(note);
  if (sixth && grade) {
    var opened = await openBuyerSubjects(msg, env, grade, sixth);
    if (opened) await sendMeaning(msg.chat.id, 'complete', env);
    else await forwardUnplannedPayment(msg, env, amount, 'Sheet was not written.');
    return;
  }
  await sendMeaning(msg.chat.id, 'askag', env);
}

function bytesToBase64(bytes) {
  var chunk = 0x8000;
  var parts = [];
  for (var i = 0; i < bytes.length; i += chunk) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
  }
  return btoa(parts.join(''));
}

async function postPaidSheet(body) {
  var payload = JSON.stringify(body);
  var res = await fetch(PAID_SHEET_URL, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: payload
  });
  if (res.status >= 300 && res.status < 400) {
    var loc = res.headers.get('Location');
    if (!loc) return { success: false, message: 'Sheet did not answer' };
    res = await fetch(loc, { method: 'GET', redirect: 'follow' });
  }
  try {
    return await res.json();
  } catch (e) {
    return { success: false, message: 'Sheet did not answer' };
  }
}

function renewalEnd(months) {
  return addMonths(yangonToday(), months);
}

function addedMonths(logs, id, grade, bought) {
  var groups = {};
  (logs || []).forEach(function (row) {
    if (String(row.id || '') !== String(id || '')) return;
    if (String(row.role || 'paid').toLowerCase() === 'volunteer') return;
    if (Number(row.grade || 12) !== Number(grade)) return;
    var months = Number(row.months) || 0;
    if (!months) return;
    var key = String(row.expiry || '') + '|' + months + '|' + logDay(row.timestamp);
    if (!groups[key]) groups[key] = months;
  });
  var prior = 0;
  Object.keys(groups).forEach(function (key) { prior += groups[key]; });
  return prior + (Number(bought) || 0);
}

async function subjectsForRenewal(id, grade, sixth) {
  var list = CORE_SUBJECTS.concat([sixth]);
  var prefix = Number(grade) === 12 ? '' : 'g' + Number(grade) + '_';
  try {
    var res = await fetch(PAID_SHEET_URL + '?action=getUsers&cb=' + Date.now());
    var data = await res.json();
    var row = data && data[String(id)];
    if (!row) return list;
    ['all', 'mm', 'en', 'math', 'phy', 'chem', 'bio', 'eco'].forEach(function (subject) {
      if (row[prefix + subject] && list.indexOf(subject) === -1) list.push(subject);
    });
  } catch (e) {}
  return list;
}

async function savePaidSubjects(fields) {
  var bought = Number(fields.months) || 0;
  var expiry = renewalEnd(bought);
  if (!fields.id || !fields.grade || !fields.subjects.length || !bought || !expiry) {
    return { success: false, message: 'Missing payment fields' };
  }
  var logs = [];
  try { logs = await fetchPaidLogs(); } catch (e) {}
  var months = addedMonths(logs, fields.id, fields.grade, bought);
  var ids = await subjectsForRenewal(fields.id, fields.grade, fields.subjects[fields.subjects.length - 1]);
  fields.subjects.forEach(function (subject) {
    if (ids.indexOf(subject) === -1) ids.push(subject);
  });
  var subjects = ids.map(function (id) {
    return { subject: id, grade: fields.grade, expiry: expiry, months: months, unit: 'months' };
  });
  return postPaidSheet({
    action: 'saveMulti',
    id: fields.id,
    role: 'paid',
    months: months,
    expiry: expiry,
    subjects: subjects
  });
}

async function handlePayDecision(q, env) {
  var data = String(q.data || '');
  if (data !== 'payok' && data !== 'payno') return;
  var fromId = String(q.from && q.from.id || '');
  if (!isPostAdmin({ from: { id: fromId } }, env)) {
    await telegramApiJson(env.BOT_TOKEN, 'answerCallbackQuery', {
      callback_query_id: q.id,
      text: 'Not allowed.'
    });
    return;
  }
  var msg = q.message || {};
  var fields = parsePaymentCaption(msg.caption || msg.text || '');
  await telegramApiJson(env.BOT_TOKEN, 'answerCallbackQuery', { callback_query_id: q.id });
  if (fields.status !== 'pending') return;
  var customerText = '';
  var nextStatus = 'rejected';
  if (data === 'payno') {
    customerText = 'ငွေလွှဲကို လက်မခံပါ။';
  } else if (!fields.months) {
    await telegramApiJson(env.BOT_TOKEN, 'sendMessage', {
      chat_id: msg.chat.id,
      text: 'Amount is not a plan. Subjects were not opened.'
    });
    return;
  } else {
    fields.subjects = ['all'];
    var wrote = await savePaidSubjects(fields);
    if (!wrote || wrote.success !== true) {
      await telegramApiJson(env.BOT_TOKEN, 'sendMessage', {
        chat_id: msg.chat.id,
        text: 'Sheet was not written. Subjects were not opened.'
      });
      return;
    }
    customerText = 'ဘာသာစုံဖွင့်ပြီးပါပြီ။ App ကို ပိတ်ပြီး ပြန်ဖွင့်ပါ။';
    nextStatus = 'approved';
  }
  if (fields.id && customerText) await sendTelegramMessage(fields.id, customerText, env.BOT_TOKEN);
  var body = String(msg.caption || msg.text || '').replace('Status: pending', 'Status: ' + nextStatus);
  var editPayload = {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    reply_markup: { inline_keyboard: [] }
  };
  try {
    if (msg.photo) {
      editPayload.caption = body;
      await telegramApiJson(env.BOT_TOKEN, 'editMessageCaption', editPayload);
    } else {
      editPayload.text = body;
      await telegramApiJson(env.BOT_TOKEN, 'editMessageText', editPayload);
    }
  } catch (e) {}
}

async function fetchPaidLogs() {
  var res = await fetch(PAID_SHEET_URL + '?cb=' + Date.now());
  var data = await res.json();
  return (data && data.logs) || [];
}

function summarizeSales(logs, day) {
  var groups = {};
  var order = [];
  (logs || []).forEach(function (row) {
    if (String(row.role || 'paid').toLowerCase() === 'volunteer') return;
    if (logDay(row.timestamp) !== day) return;
    var id = String(row.id || '');
    if (!id) return;
    var key = id + '|' + (row.months || '') + '|' + (row.expiry || '') + '|' + day;
    if (!groups[key]) {
      groups[key] = { months: Number(row.months) || 0, subjects: [] };
      order.push(key);
    }
    var label = 'G' + (row.grade || 12) + ' ' + (row.subject || row.column || '');
    if (groups[key].subjects.indexOf(label) === -1) groups[key].subjects.push(label);
  });
  var amount = 0;
  var opened = [];
  order.forEach(function (key) {
    var g = groups[key];
    if (PLAN_PRICE[g.months]) amount += PLAN_PRICE[g.months];
    opened = opened.concat(g.subjects);
  });
  return {
    day: day,
    count: order.length,
    amount: amount,
    subjects: opened
  };
}

function salesText(summary) {
  var subjects = summary.subjects.length ? summary.subjects.join(', ') : '-';
  return [
    'Sales ' + summary.day,
    'Count: ' + summary.count,
    'Amount: ' + summary.amount + ' MMK',
    'Opened: ' + subjects
  ].join('\n');
}

async function todaySales() {
  var logs = await fetchPaidLogs();
  return summarizeSales(logs, yangonToday());
}

async function handleSalesCommand(msg, env) {
  if (!isPostAdmin(msg, env)) {
    await sendTelegramMessage(msg.chat.id, 'Not allowed.', env.BOT_TOKEN);
    return;
  }
  try {
    await sendTelegramMessage(POST_ADMIN_ID, salesText(await todaySales()), env.BOT_TOKEN);
  } catch (e) {
    await sendTelegramMessage(msg.chat.id, 'Could not read the sheet.', env.BOT_TOKEN);
  }
}

async function sendDailySales(env) {
  if (!env || !env.BOT_TOKEN) return;
  try {
    await telegramApiJson(env.BOT_TOKEN, 'sendMessage', {
      chat_id: POST_ADMIN_ID,
      text: salesText(await todaySales())
    });
  } catch (e) {}
}

function cutButtonLabel(label) {
  var chars = Array.from(String(label || ''));
  if (chars.length <= 64) return chars.join('');
  return chars.slice(0, 64).join('');
}

function openAppKeyboard(label) {
  var text = cutButtonLabel(String(label || '').trim()) || OPEN_APP_LABEL;
  return {
    inline_keyboard: [
      [{ text: text, url: OPEN_APP_URL }]
    ]
  };
}

function splitChannelPost(body) {
  var lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  var label = '';
  var kept = [];
  for (var i = 0; i < lines.length; i++) {
    var match = String(lines[i]).match(/^\s*\+(?:\s+(.*?))?\s*$/);
    if (match) {
      var next = String(match[1] || '').trim();
      if (next) label = cutButtonLabel(next);
      continue;
    }
    kept.push(lines[i]);
  }
  return { text: kept.join('\n').trim(), label: label };
}

function isPostAdmin(msg, env) {
  var id = String(msg && msg.from && msg.from.id || '');
  var extra = String((env && env.ADMIN_TELEGRAM_ID) || '').trim();
  return id === POST_ADMIN_ID || (extra && id === extra);
}

function textAfterPost(text) {
  var raw = String(text || '');
  var match = raw.match(/^\/post(?:@\w+)?(?:\s+([\s\S]*))?$/i);
  if (!match) return '';
  return String(match[1] || '').trim();
}

async function handleChannelPost(msg, env) {
  var chatId = msg.chat.id;
  if (!isPostAdmin(msg, env)) {
    await sendTelegramMessage(chatId, 'Not allowed.', env.BOT_TOKEN);
    return;
  }
  var body = textAfterPost(msg.text);
  if (!body && msg.reply_to_message) {
    body = String(msg.reply_to_message.text || msg.reply_to_message.caption || '').trim();
  }
  var parsed = splitChannelPost(body);
  body = parsed.text;
  if (!body) {
    await sendTelegramMessage(chatId, '/post\ntext', env.BOT_TOKEN);
    return;
  }
  if (body.length > 4096) {
    await sendTelegramMessage(chatId, 'Too long.', env.BOT_TOKEN);
    return;
  }
  var sent = await telegramApiJson(env.BOT_TOKEN, 'sendMessage', {
    chat_id: CHANNEL_CHAT,
    text: body,
    reply_markup: openAppKeyboard(parsed.label)
  });
  if (sent && sent.ok) {
    await sendTelegramMessage(chatId, 'Posted.', env.BOT_TOKEN);
    return;
  }
  var why = (sent && sent.description) ? String(sent.description) : 'Could not post.';
  await sendTelegramMessage(chatId, why, env.BOT_TOKEN);
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
    'Reed App is an objective-question specialist for Myanmar Grade 10, 11, and 12. Other practice is minor. Website: reededucation.net. Contact to buy: @minaphayarkot.',
    'Reed is not on Google Play, the App Store, or any store. It is not a downloadable app. Never tell a customer to download it. The only way in is to open @reededucation_bot and tap Start Practice.',
    'If a customer cannot open the app or the subjects, it can be their internet. Tell them to use a VPN, especially 1.1.1.1. Do not send them to an admin.',
    'Write the names Reed and App in English letters. Never write those names in Burmese script.',
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
    '• Rank — exam countdown at the top, then the score leaderboard. Tap a rank row to preview photo, name, and stats.',
    '• Analysis — Daily Motivation, Summary radar (questions, correct, time), Best scores, Old scores (Grade 12). STEAM 1 shows Biology. STEAM 2 shows Economics, not Biology.',
    '• Me — name, Telegram ID, bio, bought subjects, contact to buy. Each chapter has Practice (book order, no timer, no score) and Test (shuffled, timer on, scored). Only Test counts for rank. News. Volunteers get grade-locked unlocks and can report a mistake.',
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
    'Only the 6-subject pack (ဘာသာစုံ) is sold. Never offer one subject, two subjects, or a smaller pack.',
    '• 1 month: 9,500',
    '• 3 months: 19,500',
    '• 6 months: 29,500',
    '• 13 months: 34,500',
    'Same prices for Grade 10, 11, and 12. Approval opens every subject on that grade.',
    'How to buy: send the payment photo in this chat with the grade. Contact: @minaphayarkot.',
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
    return withoutStoreClaim(stripFancyText(data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)) ||
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

async function telegramApi(botToken, method, payload) {
  var data = await telegramApiJson(botToken, method, payload);
  return !!(data && data.ok);
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
  if (!id || !env || !env.BOT_TOKEN) return new Response('missing', { status: 404 });
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
  if (!(pick && pick.file_id)) return new Response('none', { status: 404 });
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
