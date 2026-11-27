// Regression tests for serializeJsonLd, the helper that writes JSON-LD into an inline script element.
// Run with: node --test tests/jsonld.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeJsonLd } from '../src/lib/jsonld.mjs';

const sample = (overrides = {}) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Ordinary headline',
  description: 'An ordinary description with punctuation: quotes "like this" and an apostrophe (it\'s).',
  keywords: 'cve, research',
  ...overrides,
});

test('ordinary values round-trip through JSON.parse unchanged', () => {
  const value = sample();
  assert.deepEqual(JSON.parse(serializeJsonLd(value)), value);
});

test('a description containing </script> cannot close the script element', () => {
  const hostile = sample({ description: 'Before </script><script>alert(1)</script> after' });
  const out = serializeJsonLd(hostile);
  assert.equal(out.includes('<'), false, 'no raw < may remain');
  assert.equal(out.includes('>'), false, 'no raw > may remain');
  assert.deepEqual(JSON.parse(out), hostile, 'the value must still round-trip');
});

test('a title containing </script> is safe when placed in a full script element', () => {
  const hostile = sample({ headline: 'Title </script><img src=x onerror=alert(1)>' });
  const element = `<script type="application/ld+json">${serializeJsonLd(hostile)}</script>`;
  assert.equal(element.split('</script').length - 1, 1, 'exactly one closing tag');
  assert.equal(element.includes('<img'), false);
});

test('HTML comment openers and ampersands are escaped', () => {
  const value = sample({ description: '<!-- hidden --> & more' });
  const out = serializeJsonLd(value);
  assert.equal(out.includes('<!--'), false);
  assert.equal(out.includes('&'), false);
  assert.deepEqual(JSON.parse(out), value);
});

test('U+2028 and U+2029 line separators are escaped', () => {
  const value = sample({ headline: 'line sep para' });
  const out = serializeJsonLd(value);
  assert.equal(out.includes(' '), false);
  assert.equal(out.includes(' '), false);
  assert.deepEqual(JSON.parse(out), value);
});

test('nested objects, arrays, numbers and booleans are preserved', () => {
  const value = sample({ disclaimer: 'Sample content for demonstration only.', tags: ['a', 'b'], count: 3, demo: true });
  assert.deepEqual(JSON.parse(serializeJsonLd(value)), value);
});

test('a non-serialisable value is refused rather than written', () => {
  assert.throws(() => serializeJsonLd(undefined), TypeError);
});
