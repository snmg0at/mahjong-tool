export type Tile = number;

export type UkeireResult = {
  mentsuKinds: number;
  mentsuCount: number;
  chiitoiKinds: number;
  chiitoiCount: number;
};

export const TILE_LABELS = [
  "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m",
  "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p",
  "1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s",
  "東", "南", "西", "北", "白", "發", "中",
];

export function makeWall(): Tile[] {
  const wall: Tile[] = [];
  for (let t = 0; t < 34; t++) for (let i = 0; i < 4; i++) wall.push(t);
  for (let i = wall.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

export function toCounts(hand: Tile[]) {
  const c = Array(34).fill(0);
  for (const t of hand) c[t]++;
  return c;
}

export function shantenMentsu(hand: Tile[]): number {
  const c = toCounts(hand);
  let meld = 0;
  let taatsu = 0;
  let pair = 0;

  for (let i = 0; i < 34; i++) {
    while (c[i] >= 3) {
      c[i] -= 3;
      meld++;
    }
  }

  for (const base of [0, 9, 18]) {
    for (let i = base; i <= base + 6; i++) {
      while (c[i] > 0 && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--;
        c[i + 1]--;
        c[i + 2]--;
        meld++;
      }
    }
  }

  for (let i = 0; i < 34; i++) {
    if (c[i] >= 2) {
      c[i] -= 2;
      pair++;
    }
  }

  for (const base of [0, 9, 18]) {
    for (let i = base; i <= base + 7; i++) {
      while (c[i] > 0 && c[i + 1] > 0) {
        c[i]--;
        c[i + 1]--;
        taatsu++;
      }
    }
  }

  taatsu = Math.min(taatsu, 4 - meld);
  const hasPair = pair > 0 ? 1 : 0;
  return Math.max(-1, 8 - meld * 2 - taatsu - hasPair);
}

export function shantenChiitoi(hand: Tile[]): number {
  const c = toCounts(hand);
  let pairs = 0;
  let unique = 0;
  for (let i = 0; i < 34; i++) {
    if (c[i] > 0) unique++;
    if (c[i] >= 2) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - unique);
}

export function countPairs(hand: Tile[]) {
  const c = toCounts(hand);
  let p = 0;
  for (let i = 0; i < 34; i++) if (c[i] >= 2) p++;
  return p;
}

export function countRyanmenLike(hand: Tile[]) {
  const c = toCounts(hand);
  let n = 0;
  for (const b of [0, 9, 18]) {
    for (let i = b; i <= b + 7; i++) {
      if (c[i] > 0 && c[i + 1] > 0) n++;
    }
  }
  return n;
}

export function countExtendedRuns(hand: Tile[]) {
  const c = toCounts(hand);
  let extended = 0;
  for (const base of [0, 9, 18]) {
    for (let i = base; i <= base + 4; i++) {
      if (c[i] > 0 && c[i + 1] > 0 && c[i + 2] > 0 && c[i + 3] > 0) extended += 2;
      if (c[i] > 0 && c[i + 1] > 0 && c[i + 2] > 0 && c[i + 3] > 0 && c[i + 4] > 0) extended += 3;
    }
  }
  return extended;
}

export function sortTiles(a: Tile, b: Tile) {
  return a - b;
}

export function handWithoutIndex(hand: Tile[], idx: number) {
  return hand.filter((_, i) => i !== idx);
}

export function calcUkeireForDiscard(hand14: Tile[], discardIdx: number): UkeireResult {
  const base13 = handWithoutIndex(hand14, discardIdx);
  const counts13 = toCounts(base13);

  const baseM = shantenMentsu(base13);
  const baseC = shantenChiitoi(base13);

  let mKinds = 0;
  let mCount = 0;
  let cKinds = 0;
  let cCount = 0;

  for (let t = 0; t < 34; t++) {
    if (counts13[t] >= 4) continue;
    const rem = 4 - counts13[t];
    const next = [...base13, t];

    const m = shantenMentsu(next);
    const c = shantenChiitoi(next);

    if (m < baseM) {
      mKinds++;
      mCount += rem;
    }
    if (c < baseC) {
      cKinds++;
      cCount += rem;
    }
  }

  return { mentsuKinds: mKinds, mentsuCount: mCount, chiitoiKinds: cKinds, chiitoiCount: cCount };
}

export function evaluatePathWeight(hand: Tile[]) {
  const pairs = countPairs(hand);
  const ryanmen = countRyanmenLike(hand);
  const extendedRuns = countExtendedRuns(hand);

  let wm = 0.7;
  let wc = 0.3;

  if (pairs >= 4) {
    wm = 0.5;
    wc = 0.5;
  }

  if (pairs >= 4 && (ryanmen >= 3 || extendedRuns >= 2)) {
    wm = 0.65;
    wc = 0.35;
  }

  if (extendedRuns >= 4) {
    wm = Math.min(0.75, wm + 0.1);
    wc = 1 - wm;
  }

  return { wm, wc };
}


export function tileFileName(tile: Tile) {
  if (tile <= 8) return `${tile + 1}m.jpg`;
  if (tile <= 17) return `${tile - 8}p.jpg`;
  if (tile <= 26) return `${tile - 17}s.jpg`;
  const honors = ["east.jpg", "south.jpg", "west.jpg", "north.jpg", "white.jpg", "green.jpg", "red.jpg"];
  return honors[tile - 27];
}

export function tileImagePath(tile: Tile) {
  const base = (typeof import.meta !== "undefined" && (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL) || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}tiles/Regular/${tileFileName(tile)}`;

}


export function isWinningHand(hand: Tile[]): boolean {
  if (hand.length !== 14) return false;
  const counts = toCounts(hand);

  let pairs = 0;
  let uniq = 0;
  for (const c of counts) {
    if (c > 0) uniq++;
    if (c >= 2) pairs++;
  }
  if (pairs === 7 && uniq === 7) return true;

  for (let i = 0; i < 34; i++) {
    if (counts[i] < 2) continue;
    const work = counts.slice();
    work[i] -= 2;
    if (canFormMelds(work)) return true;
  }
  return false;
}

function canFormMelds(counts: number[]): boolean {
  let i = counts.findIndex((c) => c > 0);
  if (i === -1) return true;

  if (counts[i] >= 3) {
    counts[i] -= 3;
    if (canFormMelds(counts)) return true;
    counts[i] += 3;
  }

  if (i <= 26 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--; counts[i + 1]--; counts[i + 2]--;
    if (canFormMelds(counts)) return true;
    counts[i]++; counts[i + 1]++; counts[i + 2]++;
  }
  return false;

}
