import { useEffect, useMemo, useRef, useState } from "react";

type EvalResult = {
  shantenM: number;
  shantenC: number;
  bestScore: number;
};

const TILE_LABELS = [
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}m`),
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}p`),
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}s`),
  ...Array.from({ length: 7 }, (_, i) => `${i + 1}z`),
];

// Unicode mahjong tiles (man/pin/sou/honors)
const TILE_GLYPHS = [
  "🀇", "🀈", "🀉", "🀊", "🀋", "🀌", "🀍", "🀎", "🀏", // man
  "🀙", "🀚", "🀛", "🀜", "🀝", "🀞", "🀟", "🀠", "🀡", // pin
  "🀐", "🀑", "🀒", "🀓", "🀔", "🀕", "🀖", "🀗", "🀘", // sou
  "🀀", "🀁", "🀂", "🀃", "🀆", "🀅", "🀄", // east,south,west,north,haku,hatsu,chun
];

const MAX_TURNS = 18;

const styles = `
body{font-family:system-ui,-apple-system,sans-serif;background:#1f5f44;color:#fff}
.wrap{max-width:1000px;margin:0 auto;padding:16px}
.stats{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px;margin-bottom:14px}
.card{background:#1b2c4a;border:2px solid #2d4b73;border-radius:14px;padding:12px;text-align:center}
.card h3{margin:0 0 8px;font-size:16px}.card p{margin:0;font-size:28px}
.panel{background:#143a2f;border-radius:10px;padding:10px;margin:8px 0}
.badge{display:inline-block;background:#263f5e;padding:4px 8px;border-radius:999px;margin-right:6px;margin-bottom:6px}
.tileRow{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px}
.tileGap{width:18px}
.tile{width:52px;height:72px;border-radius:8px;border:2px solid #c8ad60;background:#fff;color:#111;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
.tile.sel{outline:3px solid #ff5a4f}.tile.draw{border-color:#3b82f6}
.glyph{font-size:30px}
.label{font-size:11px;font-weight:700}
.kawa{min-height:88px;background:rgba(0,0,0,.25);border-radius:10px;padding:8px;display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:12px 0}
.kawa .tile{height:48px;width:auto}
.kawa .glyph{font-size:22px}
button.action{background:#111;border:none;color:#fff;padding:10px 14px;border-radius:8px;cursor:pointer}
`;

function rand(n: number) { return Math.floor(Math.random() * n); }

function makeWall() {
  const wall: number[] = [];
  for (let i = 0; i < 34; i++) for (let k = 0; k < 4; k++) wall.push(i);
  for (let i = wall.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

function shantenChiitoi(c: number[]) {
  let p = 0, kinds = 0;
  for (let i = 0; i < 34; i++) { if (c[i] >= 2) p++; if (c[i] > 0) kinds++; }
  let s = 6 - p;
  if (kinds < 7) s += 7 - kinds;
  return s;
}

function calcShanten(c: number[]) {
  let best = 8;
  function dfs(a: number[], i: number, m: number, t: number, p: number) {
    if (i >= 34) { best = Math.min(best, 8 - 2 * m - t - p); return; }
    if (a[i] === 0) return dfs(a, i + 1, m, t, p);
    if (a[i] >= 3) { a[i] -= 3; dfs(a, i, m + 1, t, p); a[i] += 3; }
    if (i < 27 && i % 9 <= 6 && a[i + 1] && a[i + 2]) {
      a[i]--;a[i + 1]--;a[i + 2]--; dfs(a, i, m + 1, t, p); a[i]++;a[i + 1]++;a[i + 2]++;
    }
    if (!p && a[i] >= 2) { a[i] -= 2; dfs(a, i, m, t, 1); a[i] += 2; }
    if (m + t < 4) {
      if (a[i] >= 2) { a[i] -= 2; dfs(a, i, m, t + 1, p); a[i] += 2; }
      if (i < 27 && i % 9 <= 7 && a[i + 1]) { a[i]--;a[i + 1]--; dfs(a, i, m, t + 1, p); a[i]++;a[i + 1]++; }
      if (i < 27 && i % 9 <= 6 && a[i + 2]) { a[i]--;a[i + 2]--; dfs(a, i, m, t + 1, p); a[i]++;a[i + 2]++; }
    }
    const tmp = a[i]; a[i] = 0; dfs(a, i + 1, m, t, p); a[i] = tmp;
  }
  dfs(c.slice(), 0, 0, 0, 0);
  return best;
}


function countPairKinds(counts: number[]) {
  let pair = 0;
  for (let i = 0; i < 34; i++) if (counts[i] >= 2) pair++;
  return pair;
}

// メンツ手ポテンシャル評価: 両面 + 4連形 + 5連形(3面張化) を加点
function countMentsuPotential(counts: number[]) {
  let score = 0;
  for (let s = 0; s < 3; s++) {
    const b = s * 9;
    for (let i = 0; i <= 7; i++) {
      if (counts[b + i] > 0 && counts[b + i + 1] > 0) score += 1.0; // 両面系
    }
    for (let i = 0; i <= 5; i++) {
      // 4連形: 4567 のような連続4枚
      if (counts[b + i] > 0 && counts[b + i + 1] > 0 && counts[b + i + 2] > 0 && counts[b + i + 3] > 0) score += 1.8;
    }
    for (let i = 0; i <= 4; i++) {
      // 5連形: 34567 のような連続5枚 (3面張化しやすい)
      if (counts[b + i] > 0 && counts[b + i + 1] > 0 && counts[b + i + 2] > 0 && counts[b + i + 3] > 0 && counts[b + i + 4] > 0) score += 2.8;
    }
  }
  return score;
}

function evaluateHand(hand: number[]): EvalResult {
  const counts = Array(34).fill(0);
  for (const t of hand) counts[t]++;
  const shantenM = calcShanten(counts);
  const shantenC = shantenChiitoi(counts);

  const pairCount = countPairKinds(counts);
  const mentsuPotential = countMentsuPotential(counts);

  // 対子が多いと七対子比重を上げるが、4連形/5連形が豊富ならメンツ手を優先
  let weightC = pairCount >= 4 ? 0.5 : 0.3;
  if (mentsuPotential >= 6) weightC -= 0.12;
  if (mentsuPotential >= 9) weightC -= 0.08;
  weightC = Math.max(0.18, Math.min(0.6, weightC));
  const weightM = 1 - weightC;

  let bestScore = -1e9;
  const seen = new Set<number>();
  for (let d = 0; d < hand.length; d++) {
    const tile = hand[d];
    if (seen.has(tile)) continue;
    seen.add(tile);
    counts[tile]--;

    const baseM = calcShanten(counts);
    const baseC = shantenChiitoi(counts);
    let cntM = 0, cntC = 0;

    for (let t = 0; t < 34; t++) {
      if (counts[t] >= 4) continue;
      counts[t]++;
      const nextM = calcShanten(counts);
      const nextC = shantenChiitoi(counts);
      if (nextM < baseM) cntM += 4 - (counts[t] - 1);
      if (nextC < baseC) cntC += 4 - (counts[t] - 1);
      counts[t]--;
    }

    const mentsuBonus = mentsuPotential * 120;
    const score = (10 - baseM) * 10000 * weightM + (10 - baseC) * 10000 * weightC + cntM * weightM + cntC * weightC + mentsuBonus;
    if (score > bestScore) bestScore = score;
    counts[tile]++;
  }

  return { shantenM, shantenC, bestScore };
}

function fmt(sec: number) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function calcSelectedUke(hand: number[], selected: number | null) {
  if (selected == null) return null;
  const nh = hand.slice();
  nh.splice(selected, 1);
  const c = Array(34).fill(0);
  nh.forEach((t) => c[t]++);
  const baseM = calcShanten(c), baseC = shantenChiitoi(c);

  const m: number[] = [];
  const c2: number[] = [];
  let mCnt = 0, cCnt = 0;

  for (let t = 0; t < 34; t++) {
    if (c[t] >= 4) continue;
    c[t]++;
    const nm = calcShanten(c), nc = shantenChiitoi(c);
    if (nm < baseM) { m.push(t); mCnt += 4 - (c[t] - 1); }
    if (nc < baseC) { c2.push(t); cCnt += 4 - (c[t] - 1); }
    c[t]--;
  }

  return { m, c2, mCnt, cCnt };
}

function TileButton({
  tile,
  selected,
  drawn,
  onClick,
  small = false,
}: {
  tile: number;
  selected?: boolean;
  drawn?: boolean;
  onClick?: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tile ${selected ? "sel" : ""} ${drawn ? "draw" : ""}`}
      onClick={onClick}
      disabled={!onClick}
      style={small ? { height: 48 } : undefined}
      title={TILE_LABELS[tile]}
    >
      <span className="glyph">{TILE_GLYPHS[tile]}</span>
      <span className="label">{TILE_LABELS[tile]}</span>
    </button>
  );
}

export default function Home() {
  const [wall, setWall] = useState<number[]>([]);
  const [hand, setHand] = useState<number[]>([]); // always 14 during decision
  const [kawa, setKawa] = useState<number[]>([]);
  const [turn, setTurn] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [games, setGames] = useState(0);
  const [wins, setWins] = useState(0);
  const [goodPlays, setGoodPlays] = useState(0);
  const [totalPlays, setTotalPlays] = useState(0);
  const [sumWinTurn, setSumWinTurn] = useState(0);
  const [sumThink, setSumThink] = useState(0);
  const [status, setStatus] = useState("ゲーム開始");
  const [elapsed, setElapsed] = useState(0);
  const thinkStart = useRef(Date.now());

  const evalResult = useMemo(() => hand.length ? evaluateHand(hand) : null, [hand]);
  const selectedUke = useMemo(() => calcSelectedUke(hand, selected), [hand, selected]);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - thinkStart.current) / 1000)), 250);
    return () => clearInterval(id);
  }, []);

  function startGame() {
    const w = makeWall();
    const h = w.splice(0, 14).sort((a, b) => a - b);
    setWall(w);
    setHand(h);
    setKawa([]);
    setTurn(1);
    setSelected(null);
    setElapsed(0);
    thinkStart.current = Date.now();
    setGames((g) => g + 1);
    setStatus("1クリックで仮選択（受け入れ表示）→ 同じ牌を2クリックで打牌");
  }

  useEffect(() => { startGame(); }, []);

  function drawNext(nextWall: number[], nextHand13: number[], nextTurn: number) {
    if (!nextWall.length || nextTurn > MAX_TURNS) {
      setStatus("流局。次ゲームへ");
      setTimeout(startGame, 900);
      return;
    }
    const t = nextWall[0];
    const nw = nextWall.slice(1);
    const nh = [...nextHand13, t].sort((a, b) => a - b);
    setWall(nw);
    setHand(nh);
    setTurn(nextTurn);
    setSelected(null);
    thinkStart.current = Date.now();
    setElapsed(0);
  }

  function clickTile(idx: number) {
    if (!evalResult) return;

    // first click: virtual select + show ukeire
    if (selected !== idx) {
      setSelected(idx);
      return;
    }

    // second click: discard
    const tile = hand[idx];
    const beforeScore = evalResult.bestScore;
    const nh = hand.slice();
    nh.splice(idx, 1); // 13
    const afterEval = evaluateHand(nh);

    setTotalPlays((n) => n + 1);
    if (beforeScore - afterEval.bestScore < 2000) {
      setGoodPlays((n) => n + 1);
      setScore((s) => s + 10);
    } else {
      setScore((s) => s - 8);
    }

    const thinkSec = Math.floor((Date.now() - thinkStart.current) / 1000);
    setSumThink((s) => s + thinkSec);

    const counts = Array(34).fill(0);
    nh.forEach((t) => counts[t]++);
    if (calcShanten(counts) <= -1 || shantenChiitoi(counts) <= -1) {
      setWins((w) => w + 1);
      setSumWinTurn((v) => v + turn);
      setScore((s) => s + 100 + (MAX_TURNS - turn) * 2);
      setStatus("和了！次ゲームへ");
      setHand(nh);
      setKawa((k) => [...k, tile]);
      setTimeout(startGame, 1000);
      return;
    }

    setKawa((k) => [...k, tile]);
    setHand(nh);
    setSelected(null);
    drawNext(wall, nh, turn + 1);
  }

  const hand13 = hand.slice(0, 13);
  const drawTile = hand[13] ?? null;

  return (
    <main className="wrap">
      <style>{styles}</style>

      <div className="stats">
        <div className="card"><h3>メンツ手シャンテン</h3><p>{evalResult?.shantenM ?? "-"}</p></div>
        <div className="card"><h3>七対子シャンテン</h3><p>{evalResult?.shantenC ?? "-"}</p></div>
        <div className="card"><h3>巡目</h3><p>{turn}/{MAX_TURNS}</p></div>
        <div className="card"><h3>思考時間</h3><p>{fmt(elapsed)}</p></div>
      </div>

      <div className="panel">{status}</div>
      <div className="panel">
        <span className="badge">スコア: {score}</span>
        <span className="badge">良打率: {totalPlays ? Math.round((goodPlays / totalPlays) * 100) : 0}%</span>
        <span className="badge">平均和了巡目: {wins ? (sumWinTurn / wins).toFixed(1) : "-"}</span>
        <span className="badge">平均思考時間: {totalPlays ? (sumThink / totalPlays).toFixed(1) : "0.0"}秒</span>
        <span className="badge">勝利/総数: {wins}/{games}</span>
      </div>

      <div className="kawa">
        {kawa.map((t, i) => <TileButton key={`k-${i}`} tile={t} small />)}
      </div>

      <div className="tileRow">
        {hand13.map((t, i) => (
          <TileButton key={`h-${i}-${t}`} tile={t} selected={selected === i} onClick={() => clickTile(i)} />
        ))}
        <span className="tileGap" />
        {drawTile != null && (
          <TileButton
            tile={drawTile}
            selected={selected === 13}
            drawn
            onClick={() => clickTile(13)}
          />
        )}
      </div>

      {selectedUke && selected != null && hand[selected] != null && (
        <div className="panel">
          <div>仮選択: {TILE_GLYPHS[hand[selected]]} {TILE_LABELS[hand[selected]]}</div>
          <div>メンツ手受け入れ: {selectedUke.m.length}種 {selectedUke.mCnt}枚</div>
          <div>{selectedUke.m.map((i) => `${TILE_GLYPHS[i]}${TILE_LABELS[i]}`).join(" ") || "なし"}</div>
          <div style={{ marginTop: 8 }}>七対子受け入れ: {selectedUke.c2.length}種 {selectedUke.cCnt}枚</div>
          <div>{selectedUke.c2.map((i) => `${TILE_GLYPHS[i]}${TILE_LABELS[i]}`).join(" ") || "なし"}</div>
        </div>
      )}

      <div style={{ marginTop: 12 }}><button className="action" onClick={startGame}>新しいゲーム</button></div>
    </main>
  );
}
