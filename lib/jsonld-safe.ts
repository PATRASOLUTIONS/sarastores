/**
 * Safe serialisation for JSON-LD injected via dangerouslySetInnerHTML.
 *
 * JSON.stringify does NOT escape `<`, `>` or `&`, so any catalogue field
 * containing `</script>` closes the tag early and everything after it is
 * parsed as HTML. Product names arrive from Excel uploads and the Amazon
 * scraper, so they are not trustworthy input.
 *
 * Escaping to \uXXXX keeps the JSON semantically identical — parsers decode
 * the escapes — while making tag breakout impossible.
 */
const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
}

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => ESCAPES[c])
}
