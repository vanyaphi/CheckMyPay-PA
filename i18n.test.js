// Tests for i18n.js and resources.js. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I18N = require('../js/i18n.js');
const RESOURCES = require('../js/resources.js');

const root = path.join(__dirname, '..');
const en = I18N.strings.en;
const es = I18N.strings.es;

test('English and Spanish have exactly the same keys', () => {
  const enKeys = Object.keys(en).sort();
  const esKeys = Object.keys(es).sort();
  assert.deepEqual(enKeys.filter(k => !(k in es)), [], 'missing in Spanish');
  assert.deepEqual(esKeys.filter(k => !(k in en)), [], 'missing in English');
});

test('no string is empty', () => {
  for (const lang of ['en', 'es']) {
    for (const [k, v] of Object.entries(I18N.strings[lang])) {
      assert.ok(v.trim().length > 0, lang + ' ' + k + ' is empty');
    }
  }
});

test('both languages use the same {placeholders} in each string', () => {
  const holes = s => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const k of Object.keys(en)) {
    assert.equal(holes(es[k]), holes(en[k]), k);
  }
});

test('every data-i18n key used in the HTML pages exists', () => {
  const pages = fs.readdirSync(root).filter(f => f.endsWith('.html'));
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
    const attrKeys = [...html.matchAll(/data-i18n-attr="([^"]+)"/g)]
      .flatMap(m => m[1].split(';').map(p => p.split(':')[1].trim()));
    for (const k of keys.concat(attrKeys)) assert.ok(k in en, page + ' uses missing key ' + k);
  }
});

test('every literal key passed to t() in the scripts exists', () => {
  const files = ['layout.js', 'check.js', 'help.js'];
  for (const f of files) {
    // Leave out comments so examples in them are not checked.
    const js = fs.readFileSync(path.join(root, 'js', f), 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
    const keys = [...js.matchAll(/\bt\('([a-zA-Z0-9.]+)'\s*[,)]/g)].map(m => m[1]);
    const dataKeys = [...js.matchAll(/data-i18n="([a-zA-Z0-9.]+)"/g)].map(m => m[1]);
    for (const k of keys.concat(dataKeys)) assert.ok(k in en, f + ' uses missing key ' + k);
  }
});

test('every error, warning, note and math key the logic returns has words', () => {
  const files = ['calculator.js', 'shifts.js'];
  for (const f of files) {
    const js = fs.readFileSync(path.join(root, 'js', f), 'utf8');
    const keys = [...js.matchAll(/'((?:err|warn|note|math)\.[a-zA-Z]+)'/g)].map(m => m[1]);
    for (const k of keys) assert.ok(k in en, f + ' returns missing key ' + k);
  }
});

test('the FAQ has all 22 questions, each with an answer or a link', () => {
  const items = I18N.faq.flatMap(g => g.items);
  assert.deepEqual(items.map(i => i.n), Array.from({ length: 22 }, (_, i) => i + 1));
  for (const item of items) {
    assert.ok(('faq.q' + item.n) in en);
    assert.ok(('faq.a' + item.n) in en || item.link, 'question ' + item.n + ' needs an answer or link');
  }
});

test('every resource has both languages, a link and a checked field', () => {
  for (const r of RESOURCES.items) {
    assert.ok(RESOURCES.groups.includes(r.group));
    assert.ok(r.name.en && r.name.es && r.description.en && r.description.es);
    assert.match(r.url, /^https:\/\//);
    assert.ok('checked' in r);
    if (r.details) assert.equal(r.details.en.length, r.details.es.length);
  }
});

test('the site makes no outside requests, stores nothing, and never mentions AI', () => {
  const files = fs.readdirSync(root).filter(f => f.endsWith('.html'))
    .concat(fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f), ['css/styles.css']);
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    assert.doesNotMatch(text, /localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon/, f);
    assert.doesNotMatch(text, /<script[^>]+src="https?:|<link[^>]+href="https?:|@import|fonts\.googleapis/, f);
    assert.doesNotMatch(text, /\bAI\b|artificial intelligence|inteligencia artificial|ChatGPT|Claude/, f);
  }
});

test('the $13 billion and 30% figures are not used', () => {
  for (const lang of ['en', 'es']) {
    const all = Object.values(I18N.strings[lang]).join(' ');
    assert.doesNotMatch(all, /13 billion|13 mil millones|30 ?%/);
  }
});
