/**
 * Serialise a value for an inline `<script type="application/ld+json">` element.
 *
 * JSON.stringify does not escape `<`, `>` or `&`, so a string value that contains `</script>` would end the
 * script element early. This helper writes those characters, and the JavaScript line separators U+2028 and
 * U+2029, as `\uXXXX` escapes. JSON structural characters are never `<`, `>` or `&`, and the escapes are
 * valid inside JSON strings, so the output parses to the same value as JSON.stringify.
 *
 * @param {unknown} value A JSON-serialisable value.
 * @returns {string} JSON text that is safe to place inside a script element.
 */
export function serializeJsonLd(value) {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new TypeError('serializeJsonLd: value is not JSON-serialisable');
  }
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
