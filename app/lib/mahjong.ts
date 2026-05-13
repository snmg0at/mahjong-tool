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
  for (let t = 0; t < 34; t++) {
    for (let i = 0; i < 4; i++) wall.push(t);
  }
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
  let best = 8;

  function dfsMentsuTatsu(idx: number, m: number, t: number, pair: number) {
    while (idx < 34 && c[idx] === 0) idx++;
    if (idx >= 34) {
      const mm = Math.min(m, 4);
      const tt = Math.min(t, 4 - mm);
      const s = 8 - mm * 2 - tt - pair;
      if (s < best) best = s;
      return;
    }

    if (c[idx] >= 3) {
      c[idx] -= 3;
      dfsMentsuTatsu(idx, m + 1, t, pair);
      c[idx] += 3;
    }

    if (idx <= 26 && idx % 9 <= 6 && c[idx + 1] > 0 && c[idx + 2] > 0) {
      c[idx]--;
      c[idx + 1]--;
      c[idx + 2]--;
      dfsMentsuTatsu(idx, m + 1, t, pair);
      c[idx]++;
      c[idx + 1]++;
      c[idx + 2]++;
    }

    if (pair === 0 && c[idx] >= 2) {
      c[idx] -= 2;
      dfsMentsuTatsu(idx, m, t, 1);
      c[idx] += 2;
    }

    if (c[idx] >= 2) {
      c[idx] -= 2;
      dfsMentsuTatsu(idx, m, t + 1, pair);
      c[idx] += 2;
    }

    if (idx <= 26 && idx % 9 <= 7 && c[idx + 1] > 0) {
      c[idx]--;
      c[idx + 1]--;
      dfsMentsuTatsu(idx, m, t + 1, pair);
      c[idx]++;
      c[idx + 1]++;
    }

    if (idx <= 26 && idx % 9 <= 6 && c[idx + 2] > 0) {
      c[idx]--;
      c[idx + 2]--;
      dfsMentsuTatsu(idx, m, t + 1, pair);
      c[idx]++;
      c[idx + 2]++;
    }

    c[idx]--;
    dfsMentsuTatsu(idx, m, t, pair);
    c[idx]++;
  }

  dfsMentsuTatsu(0, 0, 0, 0);
  return best;
}

export function shantenChiitoi(hand: Tile[]): number {
  const c = toCounts(hand);
  let pairs = 0;
  let uniq = 0;
  for (const x of c) {
    if (x >= 2) pairs++;
    if (x > 0) uniq++;
  }
  const needPairs = 7 - pairs;
  const needUniq = Math.max(0, 7 - uniq);
  return needPairs + needUniq - 1;
}

export function countPairs(hand: Tile[]) {
  const c = toCounts(hand);
  return c.filter((x) => x >= 2).length;
}

export function countRyanmenLike(hand: Tile[]) {
  const c = toCounts(hand);
  let v = 0;
  for (let b = 0; b <= 18; b += 9) {
    for (let i = 0; i < 8; i++) {
      if (c[b + i] > 0 && c[b + i + 1] > 0) v++;
    }
  }
  return v;
}

export function countExtendedRuns(hand: Tile[]) {
  const c = toCounts(hand);
  let v = 0;
  for (let b = 0; b <= 18; b += 9) {
    for (let i = 0; i < 7; i++) {
      if (c[b + i] > 0 && c[b + i + 1] > 0 && c[b + i + 2] > 0) v++;
    }
  }
  return v;
}

export function sortTiles(a: Tile, b: Tile) {
  return a - b;
}

export function handWithoutIndex(hand: Tile[], idx: number) {
  return hand.filter((_, i) => i !== idx);
}

export function calcUkeireForDiscard(hand14: Tile[], discardIdx: number): UkeireResult {
  const after13 = handWithoutIndex(hand14, discardIdx);
  const baseM = shantenMentsu(after13);
  const baseC = shantenChiitoi(after13);

  const c = toCounts(after13);
  let mKinds = 0;
  let mCount = 0;
  let cKinds = 0;
  let cCount = 0;

  for (let t = 0; t < 34; t++) {
    if (c[t] >= 4) continue;
    const rem = 4 - c[t];

    const test = [...after13, t];
    const m = shantenMentsu(test);
    const cc = shantenChiitoi(test);

    if (m < baseM) {
      mKinds++;
      mCount += rem;
    }
    if (cc < baseC) {
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
  const base =
    (typeof import.meta !== "undefined" &&
      (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL) ||
    "/";
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
    counts[i]--;
    counts[i + 1]--;
    counts[i + 2]--;
    if (canFormMelds(counts)) return true;
    counts[i]++;
    counts[i + 1]++;
    counts[i + 2]++;
  }

  return false;
}
