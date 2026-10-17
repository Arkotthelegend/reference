/* Reed Education Telegram bot — Cloudflare Worker
   Secrets: BOT_TOKEN, OPENAI_API_KEY
   Optional: START_VIDEO_FILE_ID, START_VIDEO_URL
   Paste this file into the Worker and deploy. No KV.

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
        } else if (paymentPhoto(msg) && isPrivateChat(msg)) {
          await handlePaymentPhoto(msg, env);
        } else if (videoFileIdFromMessage(msg) && isPrivateChat(msg)) {
          await sendTelegramMessage(
            chatId,
            'Save this as Worker secret START_VIDEO_FILE_ID:\n' + videoFileIdFromMessage(msg),
            env.BOT_TOKEN
          );
        } else if (typeof msg.text === 'string' && msg.text.trim()) {
          var intent = await classifyIntent(msg.text, env.OPENAI_API_KEY);
          await sendTelegramMessage(chatId, fixedReply(intent), env.BOT_TOKEN);
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
  price: 'ဘာသာစုံ ၁ လ ၉၅၀၀၊ ၃ လ ၁၉၅၀၀၊ ၆ လ ၂၉၅၀၀၊ ၁၃ လ ၃၄၅၀၀ ကျပ်ပါ။ Grade 10, 11, 12 အတူတူပါ။',
  pay: 'ငွေလွှဲပြေစာပုံကို ဒီချတ်မှာ ပို့ပါ။ ပုံအောက်မှာ Grade ရေးပါ။ ဥပမာ Grade 10။ ဘာသာစုံပဲ ရောင်းပါတယ်။',
  grade: 'Grade 10, 11, 12 ထဲက တစ်တန်းရွေးပါ။ ဘာသာစုံက အဲဒီတန်းမှာပဲ ပွင့်ပါတယ်။',
  locked: 'Chapter 1 က အခမဲ့ စမ်းသုံးလို့ရပါတယ်။ ကျန်တာက ဘာသာစုံဝယ်မှ ပွင့်ပါတယ်။',
  photo: 'ပြေစာရပါပြီ။ စစ်ပြီးမှ ဘာသာစုံဖွင့်ပေးပါမယ်။',
  other: 'Reed App က objective question အတွက်ပါ။ တစ်ခြားလေ့ကျင့်မှုက နည်းပါတယ်။ ဈေး၊ ငွေပေးနည်း၊ Grade မေးနိုင်ပါတယ်။'
};
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
  return FIXED_REPLIES[intent] || FIXED_REPLIES.other;
}

function keywordIntent(text) {
  var s = String(text || '');
  if (/ဈေး|price|ဘယ်လောက်|how much/i.test(s)) return 'price';
  if (/ပြေစာ|screenshot|slip|ငွေလွှဲ|kpay|wave|kbz|how to pay|ဘယ်လိုပေး/i.test(s)) return 'pay';
  if (/grade|တန်း|၁၀|၁၁|၁၂/.test(s) && /ရွေး|which|grade/i.test(s)) return 'grade';
  if (/ပိတ်|lock|မပွင့်|chapter 1|အခမဲ့/i.test(s)) return 'locked';
  return 'other';
}

async function classifyIntent(text, apiKey) {
  var raw = String(text || '').trim();
  var lowerQ = raw.toLowerCase();
  if (commandName(raw) === '/start' || commandName(raw) === '/help') return 'other';
  if (['hi', 'hello', 'hey', 'hii', 'yo', 'mingalaba', 'မင်္ဂလာပါ'].indexOf(lowerQ) !== -1) return 'other';
  if (!apiKey) return keywordIntent(raw);
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
            content: 'Classify the customer message. Reply with one word only: price, pay, grade, locked, photo, other.'
          },
          { role: 'user', content: raw }
        ]
      })
    });
    var data = await response.json();
    var word = String(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '')
      .toLowerCase().match(/price|pay|grade|locked|photo|other/);
    if (word) return word[0];
  } catch (e) {}
  return keywordIntent(raw);
}

function paymentPhoto(msg) {
  if (!msg) return null;
  if (msg.photo && msg.photo.length) return msg.photo[msg.photo.length - 1];
  if (msg.document && String(msg.document.mime_type || '').indexOf('image/') === 0) return msg.document;
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

function amountNumber(text) {
  var s = String(text || '')
    .replace(/[၀-၉]/g, function (d) { return String('၀၁၂၃၄၅၆၇၈၉'.indexOf(d)); })
    .replace(/,/g, '');
  var m = s.match(/(\d+)(?:\.\d+)?/);
  return m ? Number(m[1]) : 0;
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
  var empty = { amount: '', name: '', time: '', last4: '' };
  if (!env || !env.OPENAI_API_KEY || !fileId) return empty;
  var file = await telegramApiJson(env.BOT_TOKEN, 'getFile', { file_id: fileId });
  var path = file && file.result && file.result.file_path;
  if (!path) return empty;
  var bin = await fetch('https://api.telegram.org/file/bot' + env.BOT_TOKEN + '/' + path);
  if (!bin.ok) return empty;
  var bytes = new Uint8Array(await bin.arrayBuffer());
  var b64 = bytesToBase64(bytes);
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
        max_tokens: 180,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Read this payment slip. Return JSON only with keys amount, name, time, last4. amount is digits of the money paid. name is the payer. time is the transfer time. last4 is the last digits shown. Use empty strings if missing.' },
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
      last4: String(parsed.last4 || '')
    };
  } catch (e) {
    return empty;
  }
}

async function handlePaymentPhoto(msg, env) {
  var photo = paymentPhoto(msg);
  var ask = parseAsk(msg.caption || (msg.reply_to_message && (msg.reply_to_message.text || msg.reply_to_message.caption)) || '');
  if (!ask.grade) {
    await sendTelegramMessage(msg.chat.id, fixedReply('pay'), env.BOT_TOKEN);
    return;
  }
  var slip = await readSlip(photo.file_id, env);
  var months = monthsForAmount(slip.amount);
  var caption = paymentCaption({
    id: String(msg.from && msg.from.id || msg.chat.id),
    name: slip.name,
    amount: slip.amount,
    time: slip.time,
    last4: slip.last4,
    grade: ask.grade,
    subjects: ['all'],
    months: months
  });
  var sent = await telegramApiJson(env.BOT_TOKEN, 'sendPhoto', {
    chat_id: POST_ADMIN_ID,
    photo: photo.file_id,
    caption: caption,
    reply_markup: payKeyboard()
  });
  if (!sent || !sent.ok) {
    await telegramApiJson(env.BOT_TOKEN, 'sendMessage', {
      chat_id: POST_ADMIN_ID,
      text: caption,
      reply_markup: payKeyboard()
    });
  }
  await sendTelegramMessage(msg.chat.id, fixedReply('photo'), env.BOT_TOKEN);
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

async function savePaidSubjects(fields) {
  var expiry = addMonths(yangonToday(), fields.months);
  if (!fields.id || !fields.grade || !fields.subjects.length || !fields.months || !expiry) {
    return { success: false, message: 'Missing payment fields' };
  }
  var subjects = fields.subjects.map(function (id) {
    return { subject: id, grade: fields.grade, expiry: expiry, months: fields.months, unit: 'months' };
  });
  return postPaidSheet({ action: 'saveMulti', id: fields.id, role: 'paid', subjects: subjects });
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
    'Reed App is an objective-question specialist for Myanmar Grade 10, 11, and 12. Other practice is minor. Website: reededucation.net. Contact to buy: @minaphayarkot. No Play Store or App Store install.',
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
