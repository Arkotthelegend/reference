#!/usr/bin/env node
/**
 * HMAC + admin API tests for cloudflare-bot.js.
 * Copies the worker to a temp .mjs so Node can import its named exports.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'cloudflare-bot.js');
const tmp = path.join(os.tmpdir(), 'reed-cloudflare-bot-test.mjs');
fs.writeFileSync(tmp, fs.readFileSync(SRC, 'utf8'));

const {
  telegramInitDataUser,
  handleAdminApi,
  isAdminApiPath
} = await import(pathToFileURL(tmp).href + '?t=' + Date.now());

const TOKEN = 'test-bot-token-not-real';
const ADMIN_ID = '8432363664';
const STUDENT_ID = '111111111';
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  } else {
    console.log('ok  ', msg);
  }
}

async function signInitData(fields) {
  const params = new URLSearchParams();
  Object.keys(fields).forEach((k) => params.set(k, fields[k]));
  const pairs = [];
  params.forEach((value, key) => pairs.push(key + '=' + value));
  pairs.sort();
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const hash = crypto.createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

function userJson(id) {
  return JSON.stringify({ id: Number(id), first_name: 'Test' });
}

async function call(pathname, body, method) {
  const req = new Request('https://bot.example' + pathname, {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {})
  });
  return handleAdminApi(req, { BOT_TOKEN: TOKEN, ADMIN_IDS: ADMIN_ID });
}

async function jsonOf(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { _raw: text };
  }
}

const now = Math.floor(Date.now() / 1000);
const adminData = await signInitData({
  user: userJson(ADMIN_ID),
  auth_date: String(now)
});
const studentData = await signInitData({
  user: userJson(STUDENT_ID),
  auth_date: String(now)
});
const staleData = await signInitData({
  user: userJson(ADMIN_ID),
  auth_date: String(now - 90000)
});
const badHash = adminData.replace(/hash=[0-9a-f]+/, 'hash=' + 'ab'.repeat(32));

assert(isAdminApiPath(new URL('https://x/admin/whoami')), 'whoami path');
assert(isAdminApiPath(new URL('https://x/admin/questions')), 'questions path');
assert(!isAdminApiPath(new URL('https://x/photo?id=1')), 'photo is not admin');
assert(!isAdminApiPath(new URL('https://x/?admin=whoami')), 'query admin=whoami is not enough');

const adminUser = await telegramInitDataUser(adminData, TOKEN);
assert(adminUser && adminUser.id === ADMIN_ID, 'valid HMAC yields admin id');

const noToken = await telegramInitDataUser(adminData, '');
assert(noToken === null, 'missing bot token is unauthorized');

const bad = await telegramInitDataUser(badHash, TOKEN);
assert(bad === null, 'tampered hash is unauthorized');

const flag = await telegramInitDataUser(
  'user=' + encodeURIComponent(userJson(ADMIN_ID)) + '&auth_date=' + now + '&hash=00',
  TOKEN
);
assert(flag === null, 'client-supplied user without valid HMAC is unauthorized');

const stale = await telegramInitDataUser(staleData, TOKEN);
assert(stale === null, 'stale auth_date is unauthorized');

let res = await call('/admin/whoami', {});
let body = await jsonOf(res);
assert(res.status === 401 && body.error === 'unauthorized', 'whoami without initData → 401');

res = await call('/admin/whoami', { initData: adminData }, 'GET');
body = await jsonOf(res);
assert(res.status === 405 && body.error === 'method_not_allowed', 'GET whoami → 405');

res = await call('/admin/whoami', { initData: adminData, isAdmin: true });
body = await jsonOf(res);
assert(res.status === 200 && body.ok === true && body.admin === true, 'signed admin whoami → admin true');
assert(body.userId === ADMIN_ID, 'whoami returns verified userId');

res = await call('/admin/whoami', { initData: studentData, isAdmin: true, email: 'admin@x' });
body = await jsonOf(res);
assert(res.status === 200 && body.admin === false, 'signed student whoami → admin false even with isAdmin flag');

res = await call('/admin/questions', { initData: studentData, action: 'saveQuestion', question: { q: 'x', type: 'tf', c: 'true' } });
body = await jsonOf(res);
assert(res.status === 403 && body.error === 'forbidden', 'student cannot save questions');

res = await call('/admin/questions', { initData: adminData, action: 'saveQuestion', question: { q: 'x', type: 'tf', c: 'true' } });
body = await jsonOf(res);
assert(res.status === 403 && body.error === 'writes_disabled', 'admin save still blocked in phase 1');

res = await call('/admin/questions', {});
body = await jsonOf(res);
assert(res.status === 401 && body.error === 'unauthorized', 'unsigned write → 401');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all admin auth tests passed');
