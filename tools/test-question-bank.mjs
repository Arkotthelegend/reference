#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(ROOT, 'question-bank.js'), 'utf8');
const window = {};
vm.runInNewContext(code, { window, document: { getElementById() { return null; }, querySelectorAll() { return []; } } });
const v = window.REEDQuestionBank.validateQuestion;
let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  } else {
    console.log('ok  ', msg);
  }
}

assert(v({ type: 'mcq', q: 'In a circular motion, the object just moves in a _____.', a: ['circle', 'straight line', 'parabola'], c: 0 }).length === 0, 'real phy ch1 mcq #0 validates');
assert(v({ type: 'mcq', q: 'Q', a: ['a'], c: 0 }).some((e) => /two options/i.test(e)), 'mcq with one option rejected');
assert(v({ type: 'mcq', q: 'Q', a: ['a', 'b'], c: 9 }).some((e) => /option/i.test(e)), 'mcq index out of range rejected');
assert(v({ type: 'mcq', q: 'Q', a: ['a', 'b'], c: '' }).some((e) => /required/i.test(e)), 'mcq missing answer rejected');
assert(v({ type: 'tf', q: '', c: 'true' }).some((e) => /text/i.test(e)), 'missing question text rejected');
assert(v({ type: 'tf', q: 'T?', c: 'true' }).length === 0, 'tf with answer accepted');
assert(v({ type: 'blank', q: 'Fill', c: '' }).some((e) => /required/i.test(e)), 'blank missing answer rejected');

const indexPath = path.join(ROOT, 'quizzes', 'admin-index.json');
assert(fs.existsSync(indexPath), 'admin-index.json exists');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
assert(index.totals && index.totals.questions > 0, 'index has question totals from files');
assert(index.issueCounts && typeof index.issueCounts.missing_type === 'number', 'index has complete issueCounts');
assert(index.totals.issueRows >= index.totals.issuesListed, 'complete issue count is not the capped sample');
assert(index.source === 'quizzes/*.json', 'index source is git JSON');
assert(Array.isArray(index.files) && index.files.length > 0, 'index lists quiz files');
const phy = index.files.find((f) => f.path === 'quizzes/phy_Chapter_1_MCQ.json');
assert(phy && phy.n > 0 && phy.subject === 'phy' && phy.chapter === '1', 'phy chapter 1 MCQ is in the index');

const quiz = JSON.parse(fs.readFileSync(path.join(ROOT, 'quizzes', 'phy_Chapter_1_MCQ.json'), 'utf8'));
assert(quiz[0].q.indexOf('circular motion') !== -1 && quiz[0].c === 0, 'student quiz file still has chapter 1 item 0');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all question-bank tests passed');
