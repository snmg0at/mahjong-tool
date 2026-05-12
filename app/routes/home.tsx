import { useMemo, useState } from "react";

type Tile = number; // 0-8: man, 9-17: pin, 18-26: sou, 27-33: honors
type UkeireResult = {
  mentsuKinds: number;
  mentsuCount: number;
  chiitoiKinds: number;
  chiitoiCount: number;
};

const TILE_LABELS = [
  "1m","2m","3m","4m","5m","6m","7m","8m","9m",
  "1p","2p","3p","4p","5p","6p","7p","8p","9p",
  "1s","2s","3s","4s","5s","6s","7s","8s","9s",
  "東","南","西","北","白","發","中",
];

const MAX_TURNS = 18;

function makeWall(): Tile[] {
  const wall: Tile[] = [];
  for (let t = 0; t < 34; t++) for (let i = 0; i < 4; i++) wall.push(t);
  for (let i = wall.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

function toCounts(hand: Tile[]) {
  const c = Array(34).fill(0);
  for (const t of hand) c[t]++;
  return c;
}

function cloneCounts(c: number[]) {
  return c.slice();
}

// ざっくりシャンテン（メンツ手）: 十分実用になる簡易評価
function shantenMentsu(hand: Tile[]): number {
  const c = toCounts(hand);
  let meld = 0;
  let taatsu = 0;
  let pair = 0;

  // 刻子
  for (let i = 0; i < 34; i++) {
    while (c[i] >= 3) {
      c[i] -= 3;
      meld++;
    }
  }

  // 順子（数牌のみ）
  for (const base of [0, 9, 18]) {
    for (let i = base; i <= base + 6; i++) {
      while (c[i] > 0 && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--; c[i + 1]--; c[i + 2]--;
        meld++;
      }
    }
  }

  // 対子
  for (let i = 0; i < 34; i++) {
    if (c[i] >= 2) {
      c[i] -= 2;
      pair++;
    }
  }

  // 搭子（両面・嵌張）
  for (const base of [0, 9, 18]) {
    for (let i = base; i <= base + 7; i++) {
      while (c[i] > 0 && c[i + 1] > 0) {
        c[i]--; c[i + 1]--;
        taatsu++;
      }
    }
  }

  taatsu = Math.min(taatsu, 4 - meld);
  const hasPair = pair > 0 ? 1 : 0;
  const s = 8 - meld * 2 - taatsu - hasPair;
  return Math.max(-1, s);
}

function shantenChiitoi(hand: Tile[]): number {
  const c = toCounts(hand);
  let pairs = 0;
  let unique = 0;
  for (let i = 0; i < 34; i++) {
    if (c[i] > 0) unique++;
    if (c[i] >= 2) pairs++;
  }
  // 七対子: 6 - 対子数 + max(0, 7 - ユニーク数)
  return 6 - pairs + Math.max(0, 7 - unique);
}

function countPairs(hand: Tile[]) {
  const c = toCounts(hand);
  let p = 0;
  for (let i = 0; i < 34; i++) if (c[i] >= 2) p++;
  return p;
}

function countRyanmenLike(hand: Tile[]) {
  const c = toCounts(hand);
  let n = 0;
  for (const b of [0, 9, 18]) {
    for (let i = b; i <= b + 7; i++) {
      if (c[i] > 0 && c[i + 1] > 0) n++;
    }
  }
  return n;
}

function sortTiles(a: Tile, b: Tile) {
  return a - b;
}

function drawOne(stateWall: Tile[]) {
  return stateWall.pop();
}

function handWithoutIndex(hand: Tile[], idx: number) {
  return hand.filter((_, i) => i !== idx);
}

function calcUkeireForDiscard(hand14: Tile[], discardIdx: number): UkeireResult {
  const base13 = handWithoutIndex(hand14, discardIdx);
  const counts13 = toCounts(base13);

  const baseM = shantenMentsu(base13);
  const baseC = shantenChiitoi(base13);

  let mKinds = 0, mCount = 0;
  let cKinds = 0, cCount = 0;

  for (let t = 0; t < 34; t++) {
    if (counts13[t] >= 4) continue;
    const rem = 4 - counts13[t];
    const next = [...base13, t];

    const m = shantenMentsu(next);
    const c = shantenChiitoi(next);

    if (m < baseM) { mKinds++; mCount += rem; }
    if (c < baseC) { cKinds++; cCount += rem; }
  }

  return {
    mentsuKinds: mKinds,
    mentsuCount: mCount,
    chiitoiKinds: cKinds,
    chiitoiCount: cCount,
  };
}

type Stats = {
  totalGames: number;
  wins: number;
  score: number;
  goodMoves: number;
  totalMoves: number;
  totalThinkMs: number;
  totalWinTurn: number;
};

export default function Home() {
  const [wall, setWall] = useState<Tile[]>(() => makeWall());
  const [hand, setHand] = useState<Tile[]>(() => {
    const w = makeWall();
    const h = w.splice(w.length - 14, 14).sort(sortTiles);
    return h;
  });
  const [river, setRiver] = useState<Tile[]>([]);
  const [turn, setTurn] = useState(1);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedUke, setSelectedUke] = useState<UkeireResult | null>(null);
  const [thinkingFrom, setThinkingFrom] = useState<number>(Date.now());
  const [thinkMs, setThinkMs] = useState(0);

  const [stats, setStats] = useState<Stats>({
    totalGames: 0,
    wins: 0,
    score: 0,
    goodMoves: 0,
    totalMoves: 0,
    totalThinkMs: 0,
    totalWinTurn: 0,
  });

  const shantenM = useMemo(() => shantenMentsu(hand), [hand]);
  const shantenC = useMemo(() => shantenChiitoi(hand), [hand]);
  const pairCount = useMemo(() => countPairs(hand), [hand]);
  const ryanmenCount = useMemo(() => countRyanmenLike(hand), [hand]);

  function startNextGame(win: boolean) {
    const w = makeWall();
    const h = w.splice(w.length - 14, 14).sort(sortTiles);
    setWall(w);
    setHand(h);
    setRiver([]);
    setTurn(1);
    setSelectedIdx(null);
    setSelectedUke(null);
    setThinkingFrom(Date.now());
    setThinkMs(0);

    setStats((s) => ({
      ...s,
      totalGames: s.totalGames + 1,
      wins: s.wins + (win ? 1 : 0),
      totalWinTurn: s.totalWinTurn + (win ? turn : 0),
    }));
  }

  function evaluateMove(before: Tile[], after13: Tile[], think: number) {
    const bm = shantenMentsu(before);
    const bc = shantenChiitoi(before);
    const am = shantenMentsu(after13);
    const ac = shantenChiitoi(after13);

    const pairs = countPairs(before);
    const ry = countRyanmenLike(before);

    let wm = 0.7, wc = 0.3;
    if (pairs >= 4) { wm = 0.5; wc = 0.5; }
    if (pairs >= 4 && ry >= 3) { wm = 0.65; wc = 0.35; }

    const beforeScore = wm * (-bm) + wc * (-bc);
    const afterScore = wm * (-am) + wc * (-ac);
    const delta = afterScore - beforeScore;

    setStats((s) => {
      let add = 0;
      let good = 0;
      if (delta > 0.001) { add += 10; good = 1; }
      else if (delta < -0.001) { add -= 8; }
      return {
        ...s,
        score: s.score + add,
        goodMoves: s.goodMoves + good,
        totalMoves: s.totalMoves + 1,
        totalThinkMs: s.totalThinkMs + think,
      };
    });
  }

  function drawIfNeeded(after13: Tile[]) {
    // 和了判定（簡易: シャンテン -1 を和了扱い）
    if (shantenMentsu(after13) <= -1 || shantenChiitoi(after13) <= -1) {
      setStats((s) => ({
        ...s,
        score: s.score + 100 + Math.max(0, (18 - turn) * 2),
      }));
      startNextGame(true);
      return;
    }

    if (turn >= MAX_TURNS || wall.length === 0) {
      startNextGame(false);
      return;
    }

    const nextWall = [...wall];
    const t = drawOne(nextWall);
    if (t == null) {
      startNextGame(false);
      return;
    }
    const nextHand = [...after13, t].sort(sortTiles);

    setWall(nextWall);
    setHand(nextHand);
    setTurn((v) => v + 1);
    setSelectedIdx(null);
    setSelectedUke(null);
    setThinkingFrom(Date.now());
    setThinkMs(0);
  }

  function onTileClick(idx: number) {
    // 1回目: 仮選択して受け入れ表示
    if (selectedIdx !== idx) {
      setSelectedIdx(idx);
      setSelectedUke(calcUkeireForDiscard(hand, idx));
      setThinkMs(Date.now() - thinkingFrom);
      return;
    }

    // 2回目: 打牌確定
    const discard = hand[idx];
    const after13 = handWithoutIndex(hand, idx).sort(sortTiles);
    const think = Date.now() - thinkingFrom;

    evaluateMove(hand, after13, think);

    setRiver((r) => [...r, discard]);
    setHand(after13);

    drawIfNeeded(after13);
  }

  const avgThink = stats.totalMoves ? Math.round(stats.totalThinkMs / stats.totalMoves) : 0;
  const goodRate = stats.totalMoves ? Math.round((stats.goodMoves / stats.totalMoves) * 100) : 0;
  const avgWinTurn = stats.wins ? (stats.totalWinTurn / stats.wins).toFixed(1) : "-";

  return (
    <main style={{ maxWidth: 980, margin: "24px auto", fontFamily: "sans-serif", padding: "0 12px" }}>
      <h1 style={{ marginBottom: 8 }}>麻雀 牌効率ゲーム</h1>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(110px,1fr))", gap: 8, marginBottom: 14 }}>
        <Stat label="メンツ手シャンテン" value={String(shantenM)} />
        <Stat label="七対子シャンテン" value={String(shantenC)} />
        <Stat label="巡目" value={String(turn)} />
        <Stat label="思考時間(ms)" value={String(thinkMs)} />
        <Stat label="対子数" value={String(pairCount)} />
        <Stat label="両面形数" value={String(ryanmenCount)} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(130px,1fr))", gap: 8, marginBottom: 14 }}>
        <Stat label="スコア" value={String(stats.score)} />
        <Stat label="良打率" value={`${goodRate}%`} />
        <Stat label="平均和了巡目" value={String(avgWinTurn)} />
        <Stat label="平均思考時間" value={`${avgThink} ms`} />
        <Stat label="勝利/総数" value={`${stats.wins}/${stats.totalGames}`} />
      </section>

      {selectedUke && selectedIdx != null && (
        <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12, background: "#fafafa" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            仮選択牌: {TILE_LABELS[hand[selectedIdx]]}
          </div>
          <div>メンツ手受け入れ: {selectedUke.mentsuKinds}種 {selectedUke.mentsuCount}枚</div>
          <div>七対子受け入れ: {selectedUke.chiitoiKinds}種 {selectedUke.chiitoiCount}枚</div>
          <div style={{ color: "#666", marginTop: 4 }}>同じ牌をもう一度クリックで打牌確定</div>
        </div>
      )}

      <div style={{ marginBottom: 10, fontWeight: 700 }}>河（6枚ずつ）</div>
      <River river={river} />

      <div style={{ margin: "14px 0 8px", fontWeight: 700 }}>手牌（14枚）</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {hand.map((t, i) => {
          const selected = i === selectedIdx;
          return (
            <button
              key={`${t}-${i}-${Math.random()}`}
              onClick={() => onTileClick(i)}
              style={{
                minWidth: 48,
                padding: "10px 8px",
                borderRadius: 8,
                border: selected ? "2px solid #1677ff" : "1px solid #ccc",
                background: selected ? "#e6f4ff" : "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {TILE_LABELS[t]}
            </button>
          );
        })}
      </div>

      <p style={{ marginTop: 12, color: "#666" }}>
        1クリックで仮選択（受け入れ表示）、2クリックで打牌。和了または流局で次ゲームへ自動遷移。
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, background: "#fff" }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{value}</div>
    </div>
  );
}

function River({ river }: { river: Tile[] }) {
  const rows: Tile[][] = [];
  for (let i = 0; i < river.length; i += 6) rows.push(river.slice(i, i + 6));
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 8, minHeight: 64, marginBottom: 8, background: "#fff" }}>
      {rows.length === 0 ? (
        <div style={{ color: "#999" }}>（まだ捨て牌なし）</div>
      ) : (
        rows.map((row, rIdx) => (
          <div key={rIdx} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {row.map((t, i) => (
              <span key={`${rIdx}-${i}`} style={{ border: "1px solid #ccc", borderRadius: 6, padding: "4px 8px", fontWeight: 700 }}>
                {TILE_LABELS[t]}
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
