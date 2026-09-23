/**
 * Statistics / Rank Google Apps Script
 * ------------------------------------------------
 * Paste this into the EXISTING analysis/stats Apps Script
 * (the one behind STATS_GAS_URL), then Deploy → New version.
 * Keep the same Web App URL so old scores stay connected.
 *
 * Execute as: Me
 * Who has access: Anyone
 *
 * This version adds `date` and `grade` to getLeaderboard rows so
 * weekly rank and Grade 10/11/12 boards work. Old columns are kept.
 *
 * Expected headers (row 1, any order). Extra columns are fine:
 *   userId, userName, quizFile, subject, chapter, type,
 *   score, total, isOld, timeTaken, date, grade
 *
 * If `date` / `grade` are missing, the script creates them.
 *
 * Project timezone: File → Project settings → Asia/Yangon
 *
 * Customer analysis (doPost saveSale / deleteSale / saveBizNotes,
 * doGet getSales / getBizNotes) uses extra sheets named Sales and BizNotes
 * in the SAME spreadsheet.
 *
 * Quiz best scores stay on the Normal / first scores tab only.
 * Do NOT write friend rows there. Friends uses a sheet named Friends.
 * Profiles (name / bio) uses a sheet named Profiles.
 * getPhotos uses Script Property BOT_TOKEN (same as timetable send).
 * Redeploy → New version after pasting this file. This version also
 * deletes leftover __soc_* rows that were mistakenly saved as scores.
 *
 *   Hosts a PNG and returns { status:'ok', url }. Optional Script Property
 *   BOT_TOKEN also sends the file to that Telegram user as a document.
 */

var TZ = 'Asia/Yangon';
var SPREADSHEET_ID = '';
var SHEET_NAME = '';

var REQUIRED_HEADERS = [
  'userId', 'userName', 'quizFile', 'subject', 'chapter', 'type',
  'score', 'total', 'isOld', 'timeTaken', 'date', 'grade'
];

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = String(p.action || '');
  try {
    if (action === 'saveScore') return json_(saveScore_(p));
    if (action === 'getStats') return json_(getStats_(p));
    if (action === 'getLeaderboard') return json_(getLeaderboard_(p));
    if (action === 'getSales') return json_(getSales_());
    if (action === 'getBizNotes') return json_(getBizNotes_());
    if (action === 'friendState') return json_(friendState_(p));
    if (action === 'friendOp') return json_(friendOp_(p));
    if (action === 'saveProfile') return json_(saveProfile_(p));
    if (action === 'getPhotos') return json_(getPhotos_(p));
    if (action === 'purgeSocialScores') return json_(purgeSocialScoreRows_());
    return json_({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
}

function doPost(e) {
  try {
    var p = parsePost_(e);
    var action = String(p.action || '');
    if (action === 'uploadTimetable') return json_(uploadTimetable_(p));
    if (action === 'saveScore') return json_(saveScore_(p));
    if (action === 'saveSale') return json_(saveSale_(p.sale || p));
    if (action === 'deleteSale') return json_(deleteSale_(p.id || p.saleId));
    if (action === 'saveBizNotes') return json_(saveBizNotes_(p.notes || p));
    if (action === 'friendOp') return json_(friendOp_(p));
    if (action === 'friendState') return json_(friendState_(p));
    if (action === 'saveProfile') return json_(saveProfile_(p));
    if (action === 'getPhotos') return json_(getPhotos_(p));
    if (action === 'purgeSocialScores') return json_(purgeSocialScoreRows_());
    return json_({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
}

function saveScore_(p) {
  var sheet = scoresSheet_();
  var idx = headerIndex_(sheet);
  ensureExtraColumns_(sheet, idx);
  idx = headerIndex_(sheet);

  var userId = String(p.userId || '');
  var quizFile = String(p.quizFile || '');
  if (!userId || !quizFile) {
    return { status: 'error', message: 'userId and quizFile required' };
  }
  if (isSocialScoreRow_(quizFile, p.subject)) {
    var cleaned = purgeSocialScoreRows_();
    return { status: 'ok', action: 'ignored', message: 'social is not a quiz score', removed: cleaned.removed };
  }

  var newScore = num_(p.score);
  var newTotal = num_(p.total);
  var now = new Date();
  var grade = String(p.grade || inferGrade_(quizFile));

  var last = sheet.getLastRow();
  var foundRow = 0;
  var oldScore = -1;
  if (last >= 2) {
    var data = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
    for (var i = 0; i < data.length; i++) {
      var rowUser = String(data[i][idx.userId] || '');
      var rowFile = String(data[i][idx.quizFile] || '');
      if (rowUser === userId && rowFile === quizFile) {
        foundRow = i + 2;
        oldScore = num_(data[i][idx.score]);
        break;
      }
    }
  }

  if (foundRow) {
    if (newScore <= oldScore) {
      return { status: 'ok', action: 'skipped', bestScore: oldScore };
    }
    setCell_(sheet, foundRow, idx.userName, p.userName || '');
    setCell_(sheet, foundRow, idx.score, newScore);
    setCell_(sheet, foundRow, idx.total, newTotal);
    setCell_(sheet, foundRow, idx.timeTaken, num_(p.timeTaken));
    setCell_(sheet, foundRow, idx.chapter, p.chapter || '');
    setCell_(sheet, foundRow, idx.type, p.type || '');
    setCell_(sheet, foundRow, idx.subject, p.subject || '');
    setCell_(sheet, foundRow, idx.isOld, String(p.isOld || 'false'));
    setCell_(sheet, foundRow, idx.date, now);
    setCell_(sheet, foundRow, idx.grade, grade);
    return { status: 'ok', action: 'replaced', oldScore: oldScore, newScore: newScore, row: foundRow };
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var line = [];
  for (var c = 0; c < headers.length; c++) line.push('');
  function put(name, value) {
    if (idx[name] === undefined) return;
    line[idx[name]] = value;
  }
  put('userId', userId);
  put('userName', p.userName || '');
  put('quizFile', quizFile);
  put('subject', p.subject || '');
  put('chapter', p.chapter || '');
  put('type', p.type || '');
  put('score', newScore);
  put('total', newTotal);
  put('isOld', String(p.isOld || 'false'));
  put('timeTaken', num_(p.timeTaken));
  put('date', now);
  put('grade', grade);
  sheet.appendRow(line);
  return { status: 'ok', action: 'inserted', row: sheet.getLastRow() };
}

function getStats_(p) {
  var userId = String(p.userId || '');
  var rows = readScoreRows_().filter(function (r) { return r.userId === userId; });
  var answered = 0;
  var correct = 0;
  var bySubject = {};
  rows.forEach(function (r) {
    if (String(r.quizFile || '').indexOf('__soc_') === 0) return;
    answered += r.total;
    correct += r.score;
    if (!bySubject[r.subject]) bySubject[r.subject] = { score: 0, total: 0 };
    bySubject[r.subject].score += r.score;
    bySubject[r.subject].total += r.total;
  });
  var subOut = {};
  Object.keys(bySubject).forEach(function (s) {
    var b = bySubject[s];
    subOut[s] = { accuracy: b.total ? Math.round((b.score / b.total) * 100) : 0 };
  });
  return {
    status: 'ok',
    overall: {
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      answered: answered,
      correct: correct
    },
    bySubject: subOut,
    bestScores: rows.filter(function (r) {
      return String(r.quizFile || '').indexOf('__soc_') !== 0;
    }).map(function (r) {
      return {
        quizFile: r.quizFile,
        subject: r.subject,
        chapter: r.chapter,
        type: r.type,
        score: r.score,
        total: r.total,
        timeTaken: r.timeTaken,
        date: r.date,
        isOld: r.isOld,
        grade: r.grade
      };
    })
  };
}

function getLeaderboard_(p) {
  try { purgeSocialScoreRowsOnce_(); } catch (err) {}
  var subject = String(p.subject || 'all');
  var rows = readScoreRows_();
  if (subject && subject !== 'all') {
    rows = rows.filter(function (r) { return r.subject === subject; });
  }
  return {
    status: 'ok',
    count: rows.length,
    rows: rows.map(function (r) {
      return {
        userId: r.userId,
        userName: r.userName,
        quizFile: r.quizFile,
        subject: r.subject,
        score: r.score,
        total: r.total,
        timeTaken: r.timeTaken,
        date: r.date,
        grade: r.grade,
        isOld: r.isOld,
        chapter: r.chapter,
        type: r.type
      };
    })
  };
}

function readScoreRows_() {
  var sheet = scoresSheet_();
  var idx = headerIndex_(sheet);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var quizFile = String(values[i][idx.quizFile] || '');
    if (!quizFile) continue;
    var subject = String(values[i][idx.subject] || '');
    if (isSocialScoreRow_(quizFile, subject)) continue;
    var rawDate = idx.date !== undefined ? values[i][idx.date] : '';
    out.push({
      userId: String(values[i][idx.userId] || ''),
      userName: String(values[i][idx.userName] || ''),
      quizFile: quizFile,
      subject: subject,
      chapter: idx.chapter !== undefined ? String(values[i][idx.chapter] || '') : '',
      type: idx.type !== undefined ? String(values[i][idx.type] || '') : '',
      score: num_(values[i][idx.score]),
      total: num_(values[i][idx.total]),
      timeTaken: idx.timeTaken !== undefined ? num_(values[i][idx.timeTaken]) : 0,
      isOld: String(values[i][idx.isOld] || 'false') === 'true',
      date: toIso_(rawDate),
      grade: String((idx.grade !== undefined && values[i][idx.grade] !== '') ? values[i][idx.grade] : inferGrade_(quizFile))
    });
  }
  return out;
}

function scoresSheet_() {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet not found. Set SPREADSHEET_ID.');
  if (SHEET_NAME) {
    var named = ss.getSheetByName(SHEET_NAME);
    if (named) return named;
  }
  return ss.getSheets()[0];
}

function isSocialScoreRow_(quizFile, subject) {
  var qf = String(quizFile || '');
  var sub = String(subject || '').toLowerCase();
  if (qf.indexOf('__soc_') === 0) return true;
  if (sub === 'social') return true;
  return false;
}

function scoreWorkbook_() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function purgeSocialScoreRows_() {
  var ss = scoreWorkbook_();
  if (!ss) return { status: 'ok', removed: 0 };
  var skip = { Friends: 1, Profiles: 1, Sales: 1, BizNotes: 1 };
  var sheets = ss.getSheets();
  var removed = 0;
  var s;
  for (s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (skip[sheet.getName()]) continue;
    var idx = headerIndex_(sheet);
    if (idx.quizFile === undefined && idx.score === undefined) continue;
    var last = sheet.getLastRow();
    if (last < 2) continue;
    var values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
    var toDelete = [];
    var i;
    for (i = 0; i < values.length; i++) {
      var qf = idx.quizFile !== undefined ? String(values[i][idx.quizFile] || '') : '';
      var sub = idx.subject !== undefined ? String(values[i][idx.subject] || '') : '';
      var score = idx.score !== undefined ? num_(values[i][idx.score]) : 0;
      var total = idx.total !== undefined ? num_(values[i][idx.total]) : 0;
      if (isSocialScoreRow_(qf, sub) || (total > 0 && score > total * 5 && score > 100000)) {
        toDelete.push(i + 2);
      }
    }
    for (i = toDelete.length - 1; i >= 0; i--) {
      sheet.deleteRow(toDelete[i]);
      removed++;
    }
  }
  return { status: 'ok', removed: removed };
}

function purgeSocialScoreRowsOnce_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('purgedSocRows') === '1') return { status: 'ok', removed: 0, skipped: true };
  var res = purgeSocialScoreRows_();
  try { props.setProperty('purgedSocRows', '1'); } catch (err) {}
  return res;
}

function headerIndex_(sheet) {
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  var idx = {};
  for (var i = 0; i < headers.length; i++) {
    var key = String(headers[i] || '').trim();
    if (!key) continue;
    idx[key] = i;
    idx[key.toLowerCase()] = i;
  }
  return idx;
}

function ensureExtraColumns_(sheet, idx) {
  REQUIRED_HEADERS.forEach(function (name) {
    if (idx[name] !== undefined) return;
    var col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue(name);
    idx[name] = col - 1;
  });
}

function setCell_(sheet, row, colIndex, value) {
  if (colIndex === undefined) return;
  sheet.getRange(row, colIndex + 1).setValue(value);
}

function inferGrade_(quizFile) {
  var base = String(quizFile || '').replace(/^old_/, '');
  if (/^(g10_|G10_)/.test(base)) return '10';
  if (/^(g11_|G11_)/.test(base)) return '11';
  return '12';
}

function num_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function toIso_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return v.toISOString();
  }
  var d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString();
  return String(v);
}

function parsePost_(e) {
  if (e && e.postData && e.postData.contents) {
    var raw = String(e.postData.contents || '').trim();
    if (raw.charAt(0) === '{') return JSON.parse(raw);
  }
  return (e && e.parameter) || {};
}

function uploadTimetable_(p) {
  var b64 = String(p.png || p.image || '');
  var cut = b64.indexOf('base64,');
  if (cut >= 0) b64 = b64.slice(cut + 7);
  b64 = b64.replace(/\s/g, '');
  if (!b64) return { status: 'error', message: 'png required' };

  var fileName = String(p.fileName || 'REED-timetable.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!/\.png$/i.test(fileName)) fileName += '.png';
  var userId = String(p.userId || '').replace(/[^0-9]/g, '');

  var bytes = Utilities.base64Decode(b64);
  var blob = Utilities.newBlob(bytes, 'image/png', fileName);

  var sentToChat = sendTelegramImage_(userId, blob, fileName);
  var url = sentToChat ? '' : hostPng_(blob);

  if (!url && !sentToChat) return { status: 'error', message: 'upload failed' };
  return { status: 'ok', url: url || '', sentToChat: sentToChat };
}

function hostPng_(blob) {
  var url = postFileUrl_('https://litterbox.catbox.moe/resources/internals/api.php', {
    reqtype: 'fileupload',
    time: '24h',
    fileToUpload: blob
  });
  if (url) return url;

  url = postFileUrl_('https://tmpfiles.org/api/v1/upload', { file: blob });
  if (url) {
    url = String(url).replace('http://', 'https://');
    if (url.indexOf('tmpfiles.org/') >= 0 && url.indexOf('/dl/') < 0) {
      url = url.replace('://tmpfiles.org/', '://tmpfiles.org/dl/');
    }
    return url;
  }

  try {
    var folders = DriveApp.getFoldersByName('ReedTimetableTmp');
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('ReedTimetableTmp');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/uc?export=download&id=' + file.getId();
  } catch (err) {
    return '';
  }
}

function postFileUrl_(endpoint, payload) {
  try {
    var res = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      payload: payload,
      muteHttpExceptions: true,
      followRedirects: true
    });
    var text = String(res.getContentText() || '').trim();
    if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) return '';
    if (text.indexOf('https://') === 0 || text.indexOf('http://') === 0) {
      return text.split(/\s+/)[0];
    }
    if (text.charAt(0) === '{') {
      var data = JSON.parse(text);
      var nested = data && data.data && (data.data.url || data.data.link);
      return String(nested || data.url || data.link || '');
    }
  } catch (err) {}
  return '';
}

function sendTelegramImage_(userId, blob, fileName) {
  if (!userId) return false;
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('BOT_TOKEN') || props.getProperty('TELEGRAM_BOT_TOKEN') || '';
  if (!token) return false;
  var caption = 'Reed · ' + fileName;
  if (sendTelegram_(token, 'sendPhoto', { chat_id: userId, photo: blob, caption: caption })) return true;
  return sendTelegram_(token, 'sendDocument', { chat_id: userId, document: blob, caption: caption });
}

function sendTelegram_(token, method, payload) {
  try {
    var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
      method: 'post',
      payload: payload,
      muteHttpExceptions: true
    });
    var data = JSON.parse(res.getContentText() || '{}');
    return !!(data && data.ok);
  } catch (err) {
    return false;
  }
}

function sendTelegramDocument_(userId, blob, fileName) {
  return sendTelegramImage_(userId, blob, fileName);
}

var SALES_HEADERS = [
  'id', 'date', 'userId', 'userName', 'grade', 'pack', 'subject', 'term', 'amount', 'note', 'savedAt'
];

function salesSheet_() {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet not found. Set SPREADSHEET_ID.');
  var sh = ss.getSheetByName('Sales');
  if (!sh) {
    sh = ss.insertSheet('Sales');
    sh.getRange(1, 1, 1, SALES_HEADERS.length).setValues([SALES_HEADERS]);
  }
  var idx = headerIndex_(sh);
  SALES_HEADERS.forEach(function (name) {
    if (idx[name] !== undefined) return;
    var col = sh.getLastColumn() + 1;
    sh.getRange(1, col).setValue(name);
    idx[name] = col - 1;
  });
  return sh;
}

function notesSheet_() {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet not found. Set SPREADSHEET_ID.');
  var sh = ss.getSheetByName('BizNotes');
  if (!sh) {
    sh = ss.insertSheet('BizNotes');
    sh.getRange(1, 1, 1, 2).setValues([['key', 'json']]);
  }
  return sh;
}

function saveSale_(sale) {
  sale = sale || {};
  var id = String(sale.id || '');
  if (!id) return { status: 'error', message: 'id required' };
  var sheet = salesSheet_();
  var idx = headerIndex_(sheet);
  var last = sheet.getLastRow();
  var found = 0;
  if (last >= 2) {
    var ids = sheet.getRange(2, (idx.id || 0) + 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '') === id) { found = i + 2; break; }
    }
  }
  function putRow(row) {
    setCell_(sheet, row, idx.id, id);
    setCell_(sheet, row, idx.date, String(sale.date || ''));
    setCell_(sheet, row, idx.userId, String(sale.userId || ''));
    setCell_(sheet, row, idx.userName, String(sale.userName || ''));
    setCell_(sheet, row, idx.grade, String(sale.grade || ''));
    setCell_(sheet, row, idx.pack, String(sale.pack || ''));
    setCell_(sheet, row, idx.subject, String(sale.subject || ''));
    setCell_(sheet, row, idx.term, String(sale.term || ''));
    setCell_(sheet, row, idx.amount, num_(sale.amount));
    setCell_(sheet, row, idx.note, String(sale.note || ''));
    setCell_(sheet, row, idx.savedAt, String(sale.savedAt || new Date().toISOString()));
  }
  if (found) {
    putRow(found);
    return { status: 'ok', action: 'replaced', id: id };
  }
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var line = [];
  for (var c = 0; c < headers.length; c++) line.push('');
  function put(name, value) {
    if (idx[name] === undefined) return;
    line[idx[name]] = value;
  }
  put('id', id);
  put('date', String(sale.date || ''));
  put('userId', String(sale.userId || ''));
  put('userName', String(sale.userName || ''));
  put('grade', String(sale.grade || ''));
  put('pack', String(sale.pack || ''));
  put('subject', String(sale.subject || ''));
  put('term', String(sale.term || ''));
  put('amount', num_(sale.amount));
  put('note', String(sale.note || ''));
  put('savedAt', String(sale.savedAt || new Date().toISOString()));
  sheet.appendRow(line);
  return { status: 'ok', action: 'inserted', id: id };
}

function deleteSale_(id) {
  id = String(id || '');
  if (!id) return { status: 'error', message: 'id required' };
  var sheet = salesSheet_();
  var idx = headerIndex_(sheet);
  var last = sheet.getLastRow();
  if (last < 2) return { status: 'ok', action: 'missing' };
  var ids = sheet.getRange(2, (idx.id || 0) + 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '') === id) {
      sheet.deleteRow(i + 2);
      return { status: 'ok', action: 'deleted', id: id };
    }
  }
  return { status: 'ok', action: 'missing', id: id };
}

function getSales_() {
  var sheet = salesSheet_();
  var idx = headerIndex_(sheet);
  var last = sheet.getLastRow();
  if (last < 2) return { status: 'ok', sales: [] };
  var values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var sales = [];
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][idx.id] || '');
    if (!id) continue;
    sales.push({
      id: id,
      date: String(values[i][idx.date] || ''),
      userId: String(values[i][idx.userId] || ''),
      userName: idx.userName !== undefined ? String(values[i][idx.userName] || '') : '',
      grade: idx.grade !== undefined ? String(values[i][idx.grade] || '') : '',
      pack: idx.pack !== undefined ? String(values[i][idx.pack] || '') : '',
      subject: idx.subject !== undefined ? String(values[i][idx.subject] || '') : '',
      term: idx.term !== undefined ? String(values[i][idx.term] || '') : '',
      amount: idx.amount !== undefined ? num_(values[i][idx.amount]) : 0,
      note: idx.note !== undefined ? String(values[i][idx.note] || '') : '',
      savedAt: idx.savedAt !== undefined ? String(values[i][idx.savedAt] || '') : ''
    });
  }
  return { status: 'ok', sales: sales };
}

function saveBizNotes_(notes) {
  var sheet = notesSheet_();
  var json = JSON.stringify(notes || {});
  var last = sheet.getLastRow();
  if (last < 2) {
    sheet.appendRow(['notes', json]);
  } else {
    sheet.getRange(2, 1, 1, 2).setValues([['notes', json]]);
  }
  return { status: 'ok' };
}

function getBizNotes_() {
  var sheet = notesSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return { status: 'ok', notes: {} };
  var raw = String(sheet.getRange(2, 2).getValue() || '');
  if (!raw) return { status: 'ok', notes: {} };
  try {
    return { status: 'ok', notes: JSON.parse(raw) };
  } catch (err) {
    return { status: 'ok', notes: {} };
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

var FRIEND_HEADERS = ['fromId', 'toId', 'status', 'fromName', 'toName', 'fromPhoto', 'toPhoto', 'updated'];
var PROFILE_HEADERS = ['userId', 'name', 'photo', 'bio', 'updated'];

function profilesSheet_() {
  var ss = scoreWorkbook_();
  if (!ss) throw new Error('Spreadsheet not found. Set SPREADSHEET_ID.');
  var sh = ss.getSheetByName('Profiles');
  if (!sh) {
    sh = ss.insertSheet('Profiles');
    sh.appendRow(PROFILE_HEADERS);
  }
  if (sh.getLastRow() < 1) sh.appendRow(PROFILE_HEADERS);
  return sh;
}

function saveProfile_(p) {
  var userId = String(p.userId || p.fromId || '').replace(/[^0-9]/g, '');
  if (!userId) return { status: 'error', message: 'userId required' };
  var name = String(p.name || p.userName || '').slice(0, 40);
  var photo = String(p.photo || p.photo_url || '').slice(0, 500);
  var bio = String(p.bio || '').slice(0, 80);
  var sheet = profilesSheet_();
  var last = sheet.getLastRow();
  var found = 0;
  if (last >= 2) {
    var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
    var i;
    for (i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '') === userId) {
        found = i + 2;
        break;
      }
    }
  }
  var line = [userId, name, photo, bio, new Date()];
  if (found) sheet.getRange(found, 1, 1, PROFILE_HEADERS.length).setValues([line]);
  else sheet.appendRow(line);
  return { status: 'ok', userId: userId };
}

function readProfiles_() {
  var sheet = profilesSheet_();
  var last = sheet.getLastRow();
  var out = {};
  if (last < 2) return out;
  var values = sheet.getRange(2, 1, last - 1, PROFILE_HEADERS.length).getValues();
  var i;
  for (i = 0; i < values.length; i++) {
    var id = String(values[i][0] || '');
    if (!id) continue;
    out[id] = {
      name: String(values[i][1] || 'Student'),
      photo: String(values[i][2] || ''),
      bio: String(values[i][3] || '')
    };
  }
  return out;
}

function friendsSheet_() {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet not found. Set SPREADSHEET_ID.');
  var sh = ss.getSheetByName('Friends');
  if (!sh) {
    sh = ss.insertSheet('Friends');
    sh.appendRow(FRIEND_HEADERS);
  }
  if (sh.getLastRow() < 1) sh.appendRow(FRIEND_HEADERS);
  return sh;
}

function friendRows_() {
  var sheet = friendsSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return { sheet: sheet, rows: [] };
  var values = sheet.getRange(2, 1, last - 1, FRIEND_HEADERS.length).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    rows.push({
      row: i + 2,
      fromId: String(values[i][0] || ''),
      toId: String(values[i][1] || ''),
      status: String(values[i][2] || ''),
      fromName: String(values[i][3] || ''),
      toName: String(values[i][4] || ''),
      fromPhoto: String(values[i][5] || ''),
      toPhoto: String(values[i][6] || ''),
      updated: values[i][7]
    });
  }
  return { sheet: sheet, rows: rows };
}

function friendCard_(id, name, photo) {
  return { userId: String(id), name: name || 'Student', photo: photo || '' };
}

function friendState_(p) {
  var userId = String(p.userId || p.fromId || '').replace(/[^0-9]/g, '');
  if (!userId) return { status: 'error', message: 'userId required' };
  var pack = friendRows_();
  var stored = readProfiles_();
  var friends = [];
  var incoming = [];
  var outgoing = [];
  var profiles = stored;
  pack.rows.forEach(function (r) {
    if (!r.fromId || !r.toId) return;
    if (!profiles[r.fromId]) profiles[r.fromId] = { name: r.fromName || 'Student', photo: r.fromPhoto || '', bio: '' };
    if (!profiles[r.toId]) profiles[r.toId] = { name: r.toName || 'Student', photo: r.toPhoto || '', bio: '' };
    if (r.status === 'accepted') {
      if (r.fromId === userId) friends.push(friendCard_(r.toId, (profiles[r.toId] && profiles[r.toId].name) || r.toName, (profiles[r.toId] && profiles[r.toId].photo) || r.toPhoto));
      else if (r.toId === userId) friends.push(friendCard_(r.fromId, (profiles[r.fromId] && profiles[r.fromId].name) || r.fromName, (profiles[r.fromId] && profiles[r.fromId].photo) || r.fromPhoto));
    } else if (r.status === 'pending') {
      if (r.toId === userId) incoming.push(friendCard_(r.fromId, (profiles[r.fromId] && profiles[r.fromId].name) || r.fromName, (profiles[r.fromId] && profiles[r.fromId].photo) || r.fromPhoto));
      else if (r.fromId === userId) outgoing.push(friendCard_(r.toId, (profiles[r.toId] && profiles[r.toId].name) || r.toName, (profiles[r.toId] && profiles[r.toId].photo) || r.toPhoto));
    }
  });
  return { status: 'ok', friends: friends, incoming: incoming, outgoing: outgoing, profiles: profiles };
}

function findPair_(rows, a, b) {
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if ((r.fromId === a && r.toId === b) || (r.fromId === b && r.toId === a)) return r;
  }
  return null;
}

function writeFriendRow_(sheet, rowNum, r) {
  sheet.getRange(rowNum, 1, 1, FRIEND_HEADERS.length).setValues([[
    r.fromId, r.toId, r.status, r.fromName || '', r.toName || '', r.fromPhoto || '', r.toPhoto || '', new Date()
  ]]);
}

function friendOp_(p) {
  var op = String(p.op || p.friendOp || '').toLowerCase();
  var fromId = String(p.fromId || '').replace(/[^0-9]/g, '');
  var toId = String(p.toId || '').replace(/[^0-9]/g, '');
  var fromName = String(p.fromName || '');
  var fromPhoto = String(p.fromPhoto || '');
  if (!fromId || !toId) return { status: 'error', message: 'fromId and toId required' };
  if (fromId === toId) return { status: 'error', message: 'same user' };
  var pack = friendRows_();
  var hit = findPair_(pack.rows, fromId, toId);
  if (op === 'request') {
    if (hit && hit.status === 'accepted') return friendState_({ userId: fromId });
    if (hit && hit.status === 'pending' && hit.toId === fromId) {
      hit.status = 'accepted';
      hit.toName = fromName;
      hit.toPhoto = fromPhoto;
      writeFriendRow_(pack.sheet, hit.row, hit);
      return friendState_({ userId: fromId });
    }
    if (hit && hit.status === 'pending') {
      hit.fromName = fromName || hit.fromName;
      hit.fromPhoto = fromPhoto || hit.fromPhoto;
      writeFriendRow_(pack.sheet, hit.row, hit);
      return friendState_({ userId: fromId });
    }
    pack.sheet.appendRow([fromId, toId, 'pending', fromName, '', fromPhoto, '', new Date()]);
    return friendState_({ userId: fromId });
  }
  if (op === 'accept') {
    if (!hit || hit.status !== 'pending' || hit.toId !== fromId) {
      return { status: 'error', message: 'no request' };
    }
    hit.status = 'accepted';
    hit.toName = fromName;
    hit.toPhoto = fromPhoto;
    writeFriendRow_(pack.sheet, hit.row, hit);
    return friendState_({ userId: fromId });
  }
  if (op === 'reject' || op === 'cancel' || op === 'unfriend') {
    if (hit) pack.sheet.deleteRow(hit.row);
    return friendState_({ userId: fromId });
  }
  return { status: 'error', message: 'Unknown friend op' };
}

function botToken_() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty('BOT_TOKEN') || props.getProperty('TELEGRAM_BOT_TOKEN') || '';
}

function getPhotos_(p) {
  var token = botToken_();
  var raw = String(p.ids || p.userId || '').split(',');
  var ids = [];
  var seen = {};
  var i;
  for (i = 0; i < raw.length && ids.length < 12; i++) {
    var id = String(raw[i] || '').replace(/[^0-9]/g, '');
    if (!id || seen[id]) continue;
    seen[id] = true;
    ids.push(id);
  }
  var cache = CacheService.getScriptCache();
  var out = {};
  var need = [];
  for (i = 0; i < ids.length; i++) {
    var key = 'ph_' + ids[i];
    var hit = '';
    try { hit = cache.get(key) || ''; } catch (e1) { hit = ''; }
    if (hit) out[ids[i]] = hit;
    else need.push(ids[i]);
  }
  if (!token || !need.length) return { status: 'ok', photos: out };

  var listReqs = [];
  for (i = 0; i < need.length; i++) {
    listReqs.push({
      url: 'https://api.telegram.org/bot' + token + '/getUserProfilePhotos?user_id=' + need[i] + '&limit=1',
      muteHttpExceptions: true
    });
  }
  var lists = UrlFetchApp.fetchAll(listReqs);
  var fileReqs = [];
  var fileFor = [];
  for (i = 0; i < lists.length; i++) {
    try {
      var data = JSON.parse(lists[i].getContentText() || '{}');
      var photos = data && data.ok && data.result && data.result.photos;
      if (!photos || !photos.length || !photos[0].length) continue;
      var sizes = photos[0];
      var pick = sizes[0];
      var s;
      for (s = 0; s < sizes.length; s++) {
        var w = sizes[s].width || 0;
        if (w >= 80 && w <= 160) { pick = sizes[s]; break; }
        if (w > 0 && w < (pick.width || 9999)) pick = sizes[s];
      }
      if (!(pick && pick.file_id)) continue;
      fileReqs.push({
        url: 'https://api.telegram.org/bot' + token + '/getFile?file_id=' + encodeURIComponent(pick.file_id),
        muteHttpExceptions: true
      });
      fileFor.push(need[i]);
    } catch (e2) {}
  }
  if (!fileReqs.length) return { status: 'ok', photos: out };

  var files = UrlFetchApp.fetchAll(fileReqs);
  var binReqs = [];
  var binFor = [];
  for (i = 0; i < files.length; i++) {
    try {
      var fileData = JSON.parse(files[i].getContentText() || '{}');
      var path = fileData && fileData.ok && fileData.result && fileData.result.file_path;
      if (!path) continue;
      binReqs.push({
        url: 'https://api.telegram.org/file/bot' + token + '/' + path,
        muteHttpExceptions: true
      });
      binFor.push(fileFor[i]);
    } catch (e3) {}
  }
  if (!binReqs.length) return { status: 'ok', photos: out };

  var bins = UrlFetchApp.fetchAll(binReqs);
  for (i = 0; i < bins.length; i++) {
    try {
      if (bins[i].getResponseCode() < 200 || bins[i].getResponseCode() >= 300) continue;
      var blob = bins[i].getBlob();
      var mime = blob.getContentType() || 'image/jpeg';
      if (mime.indexOf('image/') !== 0) mime = 'image/jpeg';
      var dataUrl = 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());
      if (dataUrl.length > 90000) continue;
      out[binFor[i]] = dataUrl;
      try { cache.put('ph_' + binFor[i], dataUrl, 21600); } catch (e4) {}
    } catch (e5) {}
  }
  return { status: 'ok', photos: out };
}

function telegramPhotoDataUrl_(userId) {
  var res = getPhotos_({ ids: String(userId || '') });
  return (res && res.photos && res.photos[String(userId)]) || '';
}
