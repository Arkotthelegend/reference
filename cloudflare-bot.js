/* Reed Education Telegram bot — Cloudflare Worker
   Secrets: BOT_TOKEN, OPENAI_API_KEY
   Paste this file into the Worker and deploy. */

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }

    let update;
    try {
      update = await request.json();
    } catch (e) {
      return new Response('OK', { status: 200 });
    }

    const msg = update && update.message;
    if (msg && typeof msg.text === 'string' && msg.text.trim()) {
      const chatId = msg.chat && msg.chat.id;
      if (chatId) {
        const reply = await getAIReply(msg.text, env.OPENAI_API_KEY);
        await sendTelegramMessage(chatId, reply, env.BOT_TOKEN);
      }
    }

    return new Response('OK', { status: 200 });
  }
};

function commandName(text) {
  var t = String(text || '').trim();
  if (t.charAt(0) !== '/') return '';
  return t.split(/\s+/)[0].split('@')[0].toLowerCase();
}

function aboutReedReply() {
  return [
    'Reed Education is a Telegram Mini App for Grade 10, 11, and 12.',
    '',
    'Open it in this chat: tap Start Practice, or the menu button then Open. No Play Store or App Store download.',
    '',
    'Inside the app:',
    '• Study — quizzes, flashcards, English grammar, poems, dialogues, Grade 12 Q and A',
    '• Plan — free Daily Quiz (3 questions a day), exam countdown, study checklist',
    '• Time — weekly timetable from your school, tuition, lunch, and rest. Download Mon–Fri and Sat–Sun A4 pages',
    '• Rank — all-time accuracy, questions, time, subject radar, and leaderboard',
    '• Me — profile, paid unlocks, News, volunteer',
    '',
    'Subjects: Myanmar, English, Maths, Physics, Chemistry, Biology, Economics.',
    'STEAM 1 uses Biology. STEAM 2 uses Economics. Pick that in Rank → Summary or when you build a timetable.',
    '',
    'Website: reededucation.net',
    'Channel: @REED_education',
    'Buy help: Me → contact to buy, or message @minaphayarkot and send your Telegram ID.',
    '',
    'Ask me about grades, subjects, the timetable, rank, pricing, or how to open the app.'
  ].join('\n');
}

function startReply() {
  return [
    'Welcome to Reed Education.',
    '',
    'This is a Grade 10 / 11 / 12 study Mini App that runs inside Telegram. No app store download.',
    '',
    'Open the app: tap Start Practice in this chat, or tap the menu button then Open.',
    '',
    'You get 3 free Daily Quiz questions per subject, plus a Chapter 1 trial.',
    '',
    'Ask me about:',
    '• How to open Reed',
    '• Grade 10, 11, 12 and subjects',
    '• Timetable, Rank, Daily Quiz',
    '• STEAM 1 (Bio) or STEAM 2 (Eco)',
    '• Pricing and how to buy',
    '',
    'Channel: @REED_education',
    '',
    'What would you like to know?'
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
  s = s.replace(/@REED[_]?education/gi, '@REED_education');
  s = s.replace(/t\.me\/REED[_]?education/gi, 't.me/REED_education');
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

  var systemPrompt = [
    'You are Reed, the in-chat helper for Reed Education. You are friendly, specific, and practical.',
    '',
    'WHAT REED IS:',
    'Reed Education is a Telegram Mini App for Myanmar Grade 10, 11, and 12 students. Website: reededucation.net. Official channel username is exactly @REED_education (underscore between REED and education). Never write @REEDeducation. Contact to buy: @minaphayarkot. The student opens the Mini App from this bot — tap Start Practice, or the menu button then Open. No Play Store or App Store install.',
    '',
    'IMPORTANT: Questions like "tell me about Reed", "Reed", "Reed Education", "the app", or ရီးဒ် ARE on-topic. Answer them. Do not say you can only help with the app.',
    '',
    'APP TABS:',
    '• Study — subject quizzes, flashcards, English grammar (shared across grades), poems, dialogues, Grade 12 Q and A',
    '• Plan — Daily Quiz (3 free questions per subject per day), exam countdown (around 9 March 2027), daily study checklist',
    '• Time — weekly timetable. Unlock after 4 paid subjects. Asks STEAM 1 or 2, school days, tuition, rest. Makes Mon–Fri and Sat–Sun A4 pages you can download. Lunch + Rest and Rest stay labeled. The planner is rule-based on the phone, not ChatGPT.',
    '• Rank — all-time leaderboard, Summary radar (questions, correct, time), Best scores, Old scores (Grade 12). STEAM 1 shows Biology. STEAM 2 shows Economics, not Biology.',
    '• Me — name, Telegram ID, bought subjects, contact to buy, quiz mode (sequential or random). Random + timer counts for rank. News. Volunteers get grade-locked unlocks and can report a mistake.',
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
    '• Myanmar: အပြော, စကားပြေ, ကဗျာ, ရေသည်, အရေး — true/false, fill-blank, MCQ',
    '• Maths: chapter quizzes (1/2/3 mark) and step-by-step solutions',
    '• Physics / Chemistry / Biology / Eco: chapters, sub-chapters, definitions, formulas, key terms',
    '• Free: Daily Quiz and Chapter 1 trial. Other chapters need a paid unlock or volunteer unlock.',
    '',
    'PRICING (MMK):',
    '• 1 month: 2,000 per subject',
    '• 3 months: 5,500 per subject',
    '• 6 months: 10,000 per subject',
    '• 12 months: 15,000 per subject',
    '• All-subjects: 10,000 / 27,000 / 53,000 / 75,000',
    'How to buy: Me → contact to buy (copies @minaphayarkot). Send your Telegram ID and the grade plus subjects you want.',
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
    '7. Official links only: channel @REED_education (keep the underscore), website reededucation.net, contact @minaphayarkot. Never invent @REEDeducation or other handles.'
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

async function sendTelegramMessage(chatId, text, botToken) {
  var clean = stripFancyText(text);
  if (!clean) return;
  await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: clean
    })
  });
}
