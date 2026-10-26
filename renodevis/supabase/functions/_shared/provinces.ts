// Provinces belges d'après le code postal (plages officielles bpost).
// Mêmes codes que la fonction SQL rd_province().

export type Province = { code: string; label: string; region: "Wallonie" | "Bruxelles" | "Flandre"; ranges: [number, number][] };

export const PROVINCES: Province[] = [
  { code: "BRU", label: "Bruxelles-Capitale", region: "Bruxelles", ranges: [[1000, 1299]] },
  { code: "WBR", label: "Brabant wallon", region: "Wallonie", ranges: [[1300, 1499]] },
  { code: "WHT", label: "Hainaut", region: "Wallonie", ranges: [[6000, 6599], [7000, 7999]] },
  { code: "WLG", label: "Liège", region: "Wallonie", ranges: [[4000, 4999]] },
  { code: "WLX", label: "Luxembourg", region: "Wallonie", ranges: [[6600, 6999]] },
  { code: "WNA", label: "Namur", region: "Wallonie", ranges: [[5000, 5999]] },
  { code: "VBR", label: "Brabant flamand", region: "Flandre", ranges: [[1500, 1999], [3000, 3499]] },
  { code: "VAN", label: "Anvers", region: "Flandre", ranges: [[2000, 2999]] },
  { code: "VLI", label: "Limbourg", region: "Flandre", ranges: [[3500, 3999]] },
  { code: "VOV", label: "Flandre orientale", region: "Flandre", ranges: [[9000, 9999]] },
  { code: "VWV", label: "Flandre occidentale", region: "Flandre", ranges: [[8000, 8999]] },
];

export function provinceOf(postalCode: string): Province | null {
  if (!/^[1-9][0-9]{3}$/.test(postalCode)) return null;
  const n = Number(postalCode);
  return PROVINCES.find((p) => p.ranges.some(([a, b]) => n >= a && n <= b)) ?? null;
}
