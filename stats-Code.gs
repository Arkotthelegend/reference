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
 * Time tab download (doPost action=uploadTimetable):
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
    return json_({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
}

function doPost(e) {
  try {
    var p = parsePost_(e);
    if (String(p.action || '') === 'uploadTimetable') return json_(uploadTimetable_(p));
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
    bestScores: rows.map(function (r) {
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
        isOld: r.isOld
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
    var rawDate = idx.date !== undefined ? values[i][idx.date] : '';
    out.push({
      userId: String(values[i][idx.userId] || ''),
      userName: String(values[i][idx.userName] || ''),
      quizFile: quizFile,
      subject: String(values[i][idx.subject] || ''),
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

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
