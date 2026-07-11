// scripts/verify/contrast.mjs — WCAG AA contrast gate for every text/background token pair
// from docs/DESIGN.md §3. Zero dependencies. Exits non-zero if any pair fails AA (4.5:1).
// Hex values mirror web/src/styles/theme.css — if tokens ever change, update BOTH files.

// stitches (light theme)
const L = {
  base100: '#FFFCF6',
  base200: '#FAF4E9',
  base300: '#EFE5D3',
  baseContent: '#4A3C33', // espresso
  primary: '#8CCAEE',
  primaryContent: '#103C58',
  secondary: '#CDA9E3',
  secondaryContent: '#4E2B66',
  accent: '#9ADDB6',
  accentContent: '#14523A',
  neutral: '#4A3C33',
  neutralContent: '#FFFCF6',
  info: '#1F6592',
  infoContent: '#FFFCF6',
  success: '#237A4C',
  successContent: '#FFFCF6',
  warning: '#8A6A0E',
  warningContent: '#FFFCF6',
  error: '#A63E14',
  errorContent: '#FFFCF6',
  inkMuted: '#6E6152',
}

// stitchesdim (counter theme)
const D = {
  base100: '#1B2740',
  base200: '#141D31',
  base300: '#0E1526',
  baseContent: '#E9EFF7',
  primary: '#9AD2F3',
  primaryContent: '#0C2A40',
  accent: '#8FDDB4',
  accentContent: '#0F3D2B',
  neutral: '#E9EFF7',
  neutralContent: '#141D31',
  error: '#FFB48F',
  errorContent: '#4A1F0A',
}

// patch accents (soft fill / core fill / deep text)
const PATCHES = {
  blue: { soft: '#DCEEF9', core: '#8CCAEE', deep: '#1F6592' },
  coral: { soft: '#FFE0D1', core: '#FFB48F', deep: '#A63E14' },
  lilac: { soft: '#F0E4F8', core: '#CDA9E3', deep: '#4E2B66' },
  mint: { soft: '#DEF3E6', core: '#9ADDB6', deep: '#14523A' },
  butter: { soft: '#FBF0CC', core: '#F6D97E', deep: '#7A5D0B' },
}

const AA = 4.5

function channel(hexByte) {
  const c = hexByte / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = channel((n >> 16) & 0xff)
  const g = channel((n >> 8) & 0xff)
  const b = channel(n & 0xff)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

/** @type {Array<[string, string, string]>} label, foreground, background */
const pairs = [
  // stitches: base ink on every surface
  ['stitches · base-content on base-100', L.baseContent, L.base100],
  ['stitches · base-content on base-200', L.baseContent, L.base200],
  ['stitches · base-content on base-300', L.baseContent, L.base300],
  // stitches: every *-content on its color
  ['stitches · primary-content on primary', L.primaryContent, L.primary],
  ['stitches · secondary-content on secondary', L.secondaryContent, L.secondary],
  ['stitches · accent-content on accent', L.accentContent, L.accent],
  ['stitches · neutral-content on neutral', L.neutralContent, L.neutral],
  ['stitches · info-content on info', L.infoContent, L.info],
  ['stitches · success-content on success', L.successContent, L.success],
  ['stitches · warning-content on warning', L.warningContent, L.warning],
  ['stitches · error-content on error', L.errorContent, L.error],
  // stitches: secondary text + links
  ['stitches · ink-muted on base-100', L.inkMuted, L.base100],
  ['stitches · ink-muted on base-200', L.inkMuted, L.base200],
  ['stitches · ink-muted on base-300', L.inkMuted, L.base300],
  ['stitches · info (links) on base-200', L.info, L.base200],
  // stitchesdim: base ink on every surface
  ['stitchesdim · base-content on base-100', D.baseContent, D.base100],
  ['stitchesdim · base-content on base-200', D.baseContent, D.base200],
  ['stitchesdim · base-content on base-300', D.baseContent, D.base300],
  // stitchesdim: every *-content on its color
  ['stitchesdim · primary-content on primary', D.primaryContent, D.primary],
  ['stitchesdim · accent-content on accent', D.accentContent, D.accent],
  ['stitchesdim · neutral-content on neutral', D.neutralContent, D.neutral],
  ['stitchesdim · error-content on error', D.errorContent, D.error],
  // patch chips: deep text on soft fill (resting) + espresso on core fill (selected)
  ...Object.entries(PATCHES).flatMap(([name, p]) => [
    [`chip · ${name}-deep on ${name}-soft`, p.deep, p.soft],
    [`chip · espresso on ${name} core`, L.baseContent, p.core],
  ]),
]

let failures = 0
for (const [label, fg, bg] of pairs) {
  const ratio = contrast(fg, bg)
  const ok = ratio >= AA
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${ratio.toFixed(2).padStart(5)}:1  ${label}  (${fg} on ${bg})`,
  )
}

console.log(`\n${pairs.length - failures}/${pairs.length} pairs pass WCAG AA (>= ${AA}:1)`)
if (failures > 0) {
  console.error(`${failures} pair(s) FAIL — tokens are binding DESIGN §2 values; stop and ask Zara.`)
  process.exit(1)
}
