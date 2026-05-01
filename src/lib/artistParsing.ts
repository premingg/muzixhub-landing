// Utilities for parsing artist strings (often from YouTube-sourced MP3s)
// e.g. "Drake ft. Lil Baby", "Drake feat. Travis Scott", "Drake & Lil Baby",
//      "Drake @ Lil Baby", "Drake; Lil Baby", "Drake, Lil Baby"

const SPLIT_REGEX = /\s*(?:\bft\.?\b|\bfeat\.?\b|\bfeaturing\b|\bwith\b|\bx\b|&|@|;|,|\/|\|)\s*/gi;

export function parseArtists(raw: string | null | undefined): { main: string; featuring: string[] } {
  if (!raw) return { main: "", featuring: [] };
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return { main: "", featuring: [] };

  const parts = cleaned
    .split(SPLIT_REGEX)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length === 0) return { main: cleaned, featuring: [] };
  const [main, ...featuring] = parts;
  // de-dupe featuring (case-insensitive) and drop any equal to main
  const seen = new Set<string>([main.toLowerCase()]);
  const dedupedFeat: string[] = [];
  for (const f of featuring) {
    const k = f.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      dedupedFeat.push(f);
    }
  }
  return { main, featuring: dedupedFeat };
}

export function formatArtistDisplay(main: string, featuring?: string[] | null): string {
  if (!featuring || featuring.length === 0) return main;
  return `${main} ft. ${featuring.join(", ")}`;
}
