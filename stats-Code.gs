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

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
