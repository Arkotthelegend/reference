#!/usr/bin/env node
/**
 * Import Qwen share chats into REED quiz JSON files.
 *
 * Example — Grade 11 Chemistry chapter 1 from 3 share links:
 *
 *   node tools/import-qwen-quiz.mjs --grade 11 --sub chem --chapter 1 \
 *     --mcq 'https://chat.qwen.ai/s/UUID-MCQ' \
 *     --tf 'https://chat.qwen.ai/s/UUID-TF' \
 *     --blank 'https://chat.qwen.ai/s/UUID-BLANK'
 *
 * Writes (and overwrites):
 *   quizzes/G11/G11_chem_Chapter_1_1.1_MCQ.json
 *   quizzes/G11/G11_chem_Chapter_1_1.2_MCQ.json
 *   …
 *   quizzes/G11/G11_chem_Chapter_1_MCQ.json          (whole chapter)
 *   same pattern for True_False and Fill_Blank
 *
 * If a share link cannot be fetched, save the chat as a .txt / .md and pass:
 *   --mcq ./chem-ch1-mcq.txt
 *
 * Flags: --dry-run   print files, do not write
 *        --self-test run parser checks and exit
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
var TYPE_FILE = { mcq: 'MCQ', tf: 'True_False', blank: 'Fill_Blank' };
var GRADE_DIR = { 10: 'G10', 11: 'G11', 12: '' };
var GRADE_PREFIX = { 10: 'G10_', 11: 'G11_', 12: '' };

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function parseArgs(argv) {
  var out = { grade: 11, sub: 'chem', chapter: 1, dryRun: false, selfTest: false, sources: {} };
  for (var i = 2; i < argv.length; i++) {
    var a = argv[i];
    var n = argv[i + 1];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--self-test') out.selfTest = true;
    else if (a === '--grade') { out.grade = parseInt(n, 10); i++; }
    else if (a === '--sub') { out.sub = String(n).toLowerCase(); i++; }
    else if (a === '--chapter') { out.chapter = parseInt(n, 10); i++; }
    else if (a === '--mcq') { out.sources.mcq = n; i++; }
    else if (a === '--tf' || a === '--true-false') { out.sources.tf = n; i++; }
    else if (a === '--blank' || a === '--fill' || a === '--fill-blank') { out.sources.blank = n; i++; }
    else die('Unknown flag: ' + a);
  }
  return out;
}

function shareIdFrom(input) {
  var s = String(input || '').trim();
  var m = s.match(/chat\.qwen\.ai\/s\/([0-9a-fA-F-]{8,})/) || s.match(/^[0-9a-fA-F-]{8,}$/);
  return m ? (m[1] || m[0]) : '';
}

async function loadSource(input) {
  var id = shareIdFrom(input);
  if (id) {
    var url = 'https://chat.qwen.ai/api/v2/chats/share/' + id;
    var res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 REED-quiz-import' } });
    if (!res.ok) throw new Error('Qwen share HTTP ' + res.status + ' for ' + url);
    var body = await res.json();
    if (!body || body.success === false) {
      throw new Error('Qwen share failed: ' + JSON.stringify(body && body.data || body));
    }
    return { kind: 'share', id: id, text: assistantTextFromShare(body) };
  }
  var file = path.resolve(input);
  if (!fs.existsSync(file)) throw new Error('Not a Qwen share URL or local file: ' + input);
  return { kind: 'file', id: file, text: fs.readFileSync(file, 'utf8') };
}

function assistantTextFromShare(body) {
  var chat = (body && body.data && body.data.chat) || {};
  var chunks = [];
  var hist = (chat.history && chat.history.messages) || {};
  Object.keys(hist).forEach(function (k) {
    var m = hist[k];
    if (m && m.role === 'assistant') chunks.push(messageContent(m));
  });
  if (Array.isArray(chat.messages)) {
    chat.messages.forEach(function (m) {
      if (m && m.role === 'assistant') chunks.push(messageContent(m));
    });
  }
  var text = chunks.filter(Boolean).join('\n\n');
  if (!text.trim()) throw new Error('Share has no assistant text. Ask your friend to Share the finished chat, not a private /c/ link.');
  return text;
}

function messageContent(m) {
  var c = m && m.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c.map(function (part) {
      if (typeof part === 'string') return part;
      if (part && typeof part.text === 'string') return part.text;
      if (part && typeof part.content === 'string') return part.content;
      return '';
    }).join('\n');
  }
  if (c && typeof c.text === 'string') return c.text;
  return '';
}

function extractJsonArrays(text) {
  var out = [];
  var fence = /```(?:json)?\s*([\s\S]*?)```/gi;
  var m;
  while ((m = fence.exec(text))) {
    try {
      var v = JSON.parse(m[1]);
      if (Array.isArray(v)) out.push(v);
    } catch (e) {}
  }
  if (out.length) return out;
  var start = 0;
  while (start < text.length) {
    var from = text.indexOf('[', start);
    if (from === -1) break;
    var depth = 0;
    var end = -1;
    for (var i = from; i < text.length; i++) {
      if (text[i] === '[') depth++;
      else if (text[i] === ']') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) break;
    try {
      var parsed = JSON.parse(text.slice(from, end + 1));
      if (Array.isArray(parsed) && parsed.length && parsed[0] && parsed[0].q) out.push(parsed);
    } catch (e) {}
    start = from + 1;
  }
  return out;
}

function letterIndex(ch) {
  var n = String(ch || '').trim().toUpperCase().charCodeAt(0) - 65;
  return n >= 0 && n < 26 ? n : -1;
}

function normalizeItem(raw, fallbackType, fallbackSub) {
  if (!raw || typeof raw !== 'object') return null;
  var type = String(raw.type || fallbackType || '').toLowerCase();
  if (type === 'true_false' || type === 'truefalse' || type === 'true/false') type = 'tf';
  if (type === 'fill_blank' || type === 'fill-blank' || type === 'fillblank') type = 'blank';
  if (type !== 'mcq' && type !== 'tf' && type !== 'blank') return null;
  var q = String(raw.q || raw.question || '').replace(/\s+/g, ' ').trim();
  if (!q) return null;
  var sub = String(raw.sub || raw.section || raw.subchapter || fallbackSub || '').trim();
  var item = { type: type, q: q };
  if (sub) item._sub = sub;
  if (raw.e) item.e = String(raw.e).trim();

  if (type === 'mcq') {
    var opts = raw.a || raw.options || raw.choices;
    if (!Array.isArray(opts) || opts.length < 2) return null;
    item.a = opts.map(function (o) { return String(o == null ? '' : o).trim(); });
    var c = raw.c;
    if (typeof c === 'string' && /^[A-Da-d]$/.test(c.trim())) c = letterIndex(c);
    c = parseInt(c, 10);
    if (isNaN(c) || c < 0 || c >= item.a.length) return null;
    item.c = c;
  } else if (type === 'tf') {
    var ans = raw.c;
    if (typeof ans === 'boolean') ans = ans ? 'true' : 'false';
    ans = String(ans == null ? '' : ans).toLowerCase().trim();
    if (ans === 't' || ans === '1' || ans === 'yes') ans = 'true';
    if (ans === 'f' || ans === '0' || ans === 'no') ans = 'false';
    if (ans !== 'true' && ans !== 'false') return null;
    item.c = ans;
  } else {
    var blank = raw.c != null ? raw.c : (raw.a != null && !Array.isArray(raw.a) ? raw.a : raw.answer);
    if (blank == null || String(blank).trim() === '') return null;
    item.c = String(blank).trim();
  }
  return item;
}

function parseMarkdown(text, fallbackType) {
  var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  var items = [];
  var sub = '';
  var i = 0;

  function isSubHead(line) {
    var m = String(line || '').match(/^\s{0,3}#{1,6}\s*(?:sub[- ]?chapter\s*)?(\d+\.\d+)\b/i)
      || String(line || '').match(/^\s*(?:sub[- ]?chapter|section)\s*[:.\-]?\s*(\d+\.\d+)\b/i)
      || String(line || '').match(/^\s*\*\*(\d+\.\d+)\*\*/);
    return m ? m[1] : '';
  }

  function readUntilNext() {
    var buf = [];
    i++;
    while (i < lines.length) {
      if (/^\s*\d+[\.\)]\s+\S/.test(lines[i]) || isSubHead(lines[i]) || /^```/.test(lines[i])) break;
      buf.push(lines[i]);
      i++;
    }
    i--;
    return buf.join('\n');
  }

  for (; i < lines.length; i++) {
    var head = isSubHead(lines[i]);
    if (head) { sub = head; continue; }
    var qm = lines[i].match(/^\s*\d+[\.\)]\s+(.+)$/);
    if (!qm) continue;
    var q = qm[1].trim();
    var body = readUntilNext();
    var block = q + '\n' + body;
    var item = markdownOne(block, fallbackType, sub);
    if (item) items.push(item);
  }
  return items;
}

function markdownOne(block, fallbackType, sub) {
  var text = String(block || '').trim();
  if (!text) return null;
  var parts = text.split('\n');
  var q = (parts.shift() || '').trim();
  var rest = parts.join('\n');
  var expl = '';
  var em = rest.match(/(?:explanation|why|reason)\s*[:：]\s*([\s\S]+)/i);
  if (em) {
    expl = em[1].trim();
    rest = rest.slice(0, em.index).trim();
  }
  var ansM = rest.match(/(?:answer|correct|ans)\s*[:：]\s*(.+)$/im);
  var ans = ansM ? ansM[1].trim() : '';
  if (ansM) rest = (rest.slice(0, ansM.index) + rest.slice(ansM.index + ansM[0].length)).trim();

  var opts = [];
  rest.split('\n').forEach(function (ln) {
    var om = ln.match(/^\s*(?:[\-\*]\s*)?(?:\(([A-Da-d])\)|([A-Da-d])[\)\.\]])\s+(.+)$/);
    if (om) opts.push(om[3].trim());
  });

  var type = fallbackType;
  if (opts.length >= 2) type = 'mcq';
  else if (/^(true|false|t|f)$/i.test(ans) || /\b(true|false)\b/i.test(q) && !opts.length) type = type || 'tf';
  else if (/_{3,}/.test(q) || type === 'blank') type = 'blank';

  var raw;
  if (type === 'mcq') {
    var ci = letterIndex(ans);
    if (ci < 0) {
      ci = opts.findIndex(function (o) { return o.toLowerCase() === ans.toLowerCase(); });
    }
    raw = { type: 'mcq', q: q, a: opts, c: ci, e: expl, sub: sub };
  } else if (type === 'tf') {
    raw = { type: 'tf', q: q.replace(/\s*\((true|false)\)\s*$/i, ''), c: ans, e: expl, sub: sub };
  } else {
    raw = { type: 'blank', q: q, c: ans, e: expl, sub: sub };
  }
  return normalizeItem(raw, fallbackType, sub);
}

function parseItems(text, fallbackType) {
  var items = [];
  extractJsonArrays(text).forEach(function (arr) {
    arr.forEach(function (raw) {
      var it = normalizeItem(raw, fallbackType, raw && (raw.sub || raw.section));
      if (it) items.push(it);
    });
  });
  if (!items.length) items = parseMarkdown(text, fallbackType);
  return items;
}

function groupBySub(items, chapter) {
  var groups = {};
  items.forEach(function (it) {
    var sub = it._sub || '';
    if (!sub) sub = String(chapter) + '.1';
    if (!groups[sub]) groups[sub] = [];
    var copy = { type: it.type, q: it.q };
    if (it.a) copy.a = it.a;
    copy.c = it.c;
    if (it.e) copy.e = it.e;
    groups[sub].push(copy);
  });
  return groups;
}

function quizDir(grade) {
  var folder = GRADE_DIR[grade];
  return folder ? path.join(ROOT, 'quizzes', folder) : path.join(ROOT, 'quizzes');
}

function fileName(grade, sub, chapter, section, typeKey) {
  var prefix = GRADE_PREFIX[grade] || '';
  var stem = sub + '_Chapter_' + chapter;
  if (section) stem += '_' + section;
  return prefix + stem + '_' + TYPE_FILE[typeKey] + '.json';
}

function writeJson(file, data, dryRun) {
  var json = JSON.stringify(data, null, 2) + '\n';
  if (dryRun) {
    console.log('[dry-run]', file, '(' + data.length + ' items)');
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json);
  console.log('wrote', path.relative(ROOT, file), '(' + data.length + ' items)');
}

function uniqueByQ(list) {
  var seen = {};
  var out = [];
  list.forEach(function (it) {
    var k = String(it.q || '');
    if (seen[k]) return;
    seen[k] = 1;
    out.push(it);
  });
  return out;
}

function sortSubs(keys) {
  return keys.slice().sort(function (a, b) {
    var pa = a.split('.').map(Number);
    var pb = b.split('.').map(Number);
    return (pa[0] - pb[0]) || (pa[1] - pb[1]) || a.localeCompare(b);
  });
}

async function importType(opts, typeKey, source) {
  var loaded = await loadSource(source);
  var items = parseItems(loaded.text, typeKey);
  if (!items.length) throw new Error('No ' + typeKey + ' items parsed from ' + source);
  var groups = groupBySub(items, opts.chapter);
  var dir = quizDir(opts.grade);
  var combined = [];
  sortSubs(Object.keys(groups)).forEach(function (section) {
    var list = groups[section];
    var fp = path.join(dir, fileName(opts.grade, opts.sub, opts.chapter, section, typeKey));
    writeJson(fp, list, opts.dryRun);
    combined = combined.concat(list);
  });
  var whole = path.join(dir, fileName(opts.grade, opts.sub, opts.chapter, '', typeKey));
  writeJson(whole, uniqueByQ(combined), opts.dryRun);
  return { type: typeKey, subs: Object.keys(groups).length, items: combined.length };
}

function selfTest() {
  var jsonText = '```json\n' + JSON.stringify([
    { sub: '1.1', type: 'mcq', q: 'Bonds are _____.', a: ['chemical bonds', 'gravity', 'light'], c: 0, e: 'ok' },
    { sub: '1.2', type: 'mcq', q: 's holds __ electrons.', a: ['2', '6', '10'], c: 0 }
  ]) + '\n```';
  var mcq = parseItems(jsonText, 'mcq');
  if (mcq.length !== 2 || mcq[0]._sub !== '1.1' || mcq[0].c !== 0) throw new Error('json mcq parse failed');

  var md = [
    '## 1.1',
    '1. Atoms are small.',
    'Answer: True',
    'Explanation: they are',
    '',
    '## 1.2',
    '1. The nucleus is empty.',
    'Answer: False'
  ].join('\n');
  var tf = parseItems(md, 'tf');
  if (tf.length !== 2 || tf[1].c !== 'false' || tf[0]._sub !== '1.1') throw new Error('markdown tf parse failed');

  var blankMd = [
    '## 1.1',
    '1. Valence electrons are in the ____.',
    'Answer: outermost shell'
  ].join('\n');
  var blanks = parseItems(blankMd, 'blank');
  if (blanks.length !== 1 || blanks[0].c !== 'outermost shell') throw new Error('markdown blank parse failed');
  console.log('self-test ok');
}

async function main() {
  var opts = parseArgs(process.argv);
  if (opts.selfTest) {
    selfTest();
    return;
  }
  if (![10, 11, 12].includes(opts.grade)) die('--grade must be 10, 11, or 12');
  if (!opts.sub) die('--sub is required (chem, phy, bio, …)');
  if (!(opts.chapter >= 1)) die('--chapter must be a number');
  var keys = Object.keys(opts.sources);
  if (!keys.length) {
    die('Pass at least one of --mcq --tf --blank with a Qwen share URL or a local file.');
  }
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    await importType(opts, k, opts.sources[k]);
  }
}

main().catch(function (err) {
  die(err && err.stack || err);
});
