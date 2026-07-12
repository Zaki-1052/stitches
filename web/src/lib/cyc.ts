// web/src/lib/cyc.ts — CYC yarn-weight display labels ("4 · Medium/Worsted", DESIGN §9). The
// schema's cyc_8 sits past the official CYC 0–7 standard; Zara picked "Jumbo+" for it
// (docs/DECISIONS.md).
import type { YarnWeight } from './schema.ts'

const CYC_8_LABEL = '8 · Jumbo+'

export const CYC_LABELS: Record<YarnWeight, string> = {
  cyc_0: '0 · Lace',
  cyc_1: '1 · Super Fine',
  cyc_2: '2 · Fine',
  cyc_3: '3 · Light',
  cyc_4: '4 · Medium/Worsted',
  cyc_5: '5 · Bulky',
  cyc_6: '6 · Super Bulky',
  cyc_7: '7 · Jumbo',
  cyc_8: CYC_8_LABEL,
}

export function formatCyc(weight: YarnWeight): string {
  return CYC_LABELS[weight]
}
