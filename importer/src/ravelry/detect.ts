// importer/src/ravelry/detect.ts — is this URL a Ravelry pattern-library page? (RAVELRY.md
// §4.1 step 1.) Pure and total: only `/patterns/library/{permalink}` on ravelry.com matches;
// projects, stores, rav.me short links, and every other host fall through to the OG path.
// Trailing `-N` disambiguators are part of the permalink; query strings never reach
// `url.pathname` so they are ignored for free.
const RAVELRY_HOSTS = new Set(['ravelry.com', 'www.ravelry.com'])
const LIBRARY_PATH = /^\/patterns\/library\/([^/?#]+)\/?$/

export function matchRavelryPermalink(url: URL): string | null {
  if (!RAVELRY_HOSTS.has(url.hostname.toLowerCase())) return null
  const match = LIBRARY_PATH.exec(url.pathname)
  return match ? match[1] : null
}
