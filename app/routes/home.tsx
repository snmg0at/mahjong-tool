import { useEffect, useMemo, useState } from "react";
import {
  calcUkeireForDiscard,
  evaluatePathWeight,
  handWithoutIndex,
  makeWall,
  shantenChiitoi,
  shantenMentsu,
  sortTiles,
  TILE_LABELS,
  tileImagePath,
  type Tile,
  type UkeireResult,
} from "../lib/mahjong";

const MAX_TURNS = 18;

type Stats = {
  totalGames: number;
  wins: number;
  score: number;
  goodMoves: number;
  totalMoves: number;
  totalThinkMs: number;
  totalWinTurn: number;
};

function createGame() {
  const w = makeWall();
  const h = w.splice(w.length - 14, 14).sort(sortTiles);
  return { wall: w, hand: h };
}

export default function Home() {
  const initial = createGame();
  const [wall, setWall] = useState<Tile[]>(initial.wall);
  const [hand, setHand] = useState<Tile[]>(initial.hand);
  const [river, setRiver] = useState<Tile[]>([]);
  const [turn, setTurn] = useState(1);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedUke, setSelectedUke] = useState<UkeireResult | null>(null);
  const [thinkingFrom, setThinkingFrom] = useState<number>(Date.now());
  const [thinkMs, setThinkMs] = useState(0);

  const [stats, setStats] = useState<Stats>({ totalGames: 0, wins: 0, score: 0, goodMoves: 0, totalMoves: 0, totalThinkMs: 0, totalWinTurn: 0 });

  useEffect(() => {
    const id = setInterval(() => setThinkMs(Date.now() - thinkingFrom), 100);
    return () => clearInterval(id);
  }, [thinkingFrom]);

  const shantenM = useMemo(() => shantenMentsu(hand), [hand]);
  const shantenC = useMemo(() => shantenChiitoi(hand), [hand]);

  function startNextGame(win: boolean) {
    const next = createGame();
    setWall(next.wall);
    setHand(next.hand);
    setRiver([]);
    setTurn(1);
    setSelectedIdx(null);
    setSelectedUke(null);
    setThinkingFrom(Date.now());
    setThinkMs(0);
    setStats((s) => ({ ...s, totalGames: s.totalGames + 1, wins: s.wins + (win ? 1 : 0), totalWinTurn: s.totalWinTurn + (win ? turn : 0) }));
  }

  function evaluateMove(before: Tile[], after13: Tile[], think: number) {
    const bm = shantenMentsu(before);
    const bc = shantenChiitoi(before);
    const am = shantenMentsu(after13);
    const ac = shantenChiitoi(after13);
    const { wm, wc } = evaluatePathWeight(before);
    const delta = wm * (-am) + wc * (-ac) - (wm * (-bm) + wc * (-bc));

    setStats((s) => {
      let add = 0;
      let good = 0;
      if (delta > 0.001) {
        add += 10;
        good = 1;
      } else if (delta < -0.001) {
        add -= 8;
      }
      return { ...s, score: s.score + add, goodMoves: s.goodMoves + good, totalMoves: s.totalMoves + 1, totalThinkMs: s.totalThinkMs + think };
    });
  }

  function drawIfNeeded(after13: Tile[]) {
    if (shantenMentsu(after13) <= -1 || shantenChiitoi(after13) <= -1) {
      setStats((s) => ({ ...s, score: s.score + 100 + Math.max(0, (18 - turn) * 2) }));
      startNextGame(true);
      return;
    }
    if (turn >= MAX_TURNS || wall.length === 0) {
      startNextGame(false);
      return;
    }

    const nextWall = [...wall];
    const draw = nextWall.pop();
    if (draw == null) {
      startNextGame(false);
      return;
    }

    setRiver((r) => r);
    setWall(nextWall);
    setHand([...after13, draw].sort(sortTiles));
    setTurn((v) => v + 1);
    setSelectedIdx(null);
    setSelectedUke(null);
    setThinkingFrom(Date.now());
    setThinkMs(0);
  }

  function onTileClick(idx: number) {
    if (selectedIdx !== idx) {
      setSelectedIdx(idx);
      setSelectedUke(calcUkeireForDiscard(hand, idx));
      return;
    }

    const discard = hand[idx];
    const after13 = handWithoutIndex(hand, idx).sort(sortTiles);
    evaluateMove(hand, after13, Date.now() - thinkingFrom);
    setRiver((r) => [...r, discard]);
    drawIfNeeded(after13);
  }

  const avgThink = stats.totalMoves ? Math.round(stats.totalThinkMs / stats.totalMoves) : 0;
  const goodRate = stats.totalMoves ? Math.round((stats.goodMoves / stats.totalMoves) * 100) : 0;
  const avgWinTurn = stats.wins ? (stats.totalWinTurn / stats.wins).toFixed(1) : "-";

  return (
    <main style={{ maxWidth: 980, margin: "24px auto", fontFamily: "sans-serif", padding: "0 12px", color: "#f5f5f5" }}>
      <h1 style={{ marginBottom: 8 }}>麻雀 牌効率ゲーム</h1>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(110px,1fr))", gap: 8, marginBottom: 14 }}>
        <Stat label="メンツ手シャンテン" value={String(shantenM)} />
        <Stat label="七対子シャンテン" value={String(shantenC)} />
        <Stat label="巡目" value={String(turn)} />
        <Stat label="思考時間(ms)" value={String(thinkMs)} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(130px,1fr))", gap: 8, marginBottom: 14 }}>
        <Stat label="スコア" value={String(stats.score)} />
        <Stat label="良打率" value={`${goodRate}%`} />
        <Stat label="平均和了巡目" value={String(avgWinTurn)} />
        <Stat label="平均思考時間" value={`${avgThink} ms`} />
        <Stat label="勝利/総数" value={`${stats.wins}/${stats.totalGames}`} />
      </section>

      {selectedUke && selectedIdx != null && (
        <div style={{ padding: 10, border: "1px solid #2b7056", borderRadius: 8, marginBottom: 12, background: "#00552e" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>仮選択牌: {TILE_LABELS[hand[selectedIdx]]}</div>
          <div>メンツ手受け入れ: {selectedUke.mentsuKinds}種 {selectedUke.mentsuCount}枚</div>
          <div>七対子受け入れ: {selectedUke.chiitoiKinds}種 {selectedUke.chiitoiCount}枚</div>
          <div style={{ color: "#bbe7d5", marginTop: 4 }}>同じ牌をもう一度クリックで打牌確定</div>
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
              key={`${t}-${i}`}
              onClick={() => onTileClick(i)}
              style={{
                minWidth: 48,
                padding: "10px 8px",
                borderRadius: 8,
                border: selected ? "2px solid #6cc9ff" : "1px solid #2b7056",
                background: selected ? "#1f5f47" : "#13523d",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <img src={tileImagePath(t)} alt={TILE_LABELS[t]} width={44} height={60} style={{ display: "block", pointerEvents: "none" }} onError={(e) => { (e.currentTarget.style.display = "none"); const next = e.currentTarget.nextElementSibling as HTMLElement | null; if (next) next.style.display = "inline"; }} /><span style={{ display: "none" }}>{TILE_LABELS[t]}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={{ border: "1px solid #2b7056", borderRadius: 8, padding: 8, background: "#00552e" }}><div style={{ fontSize: 12, color: "#bbe7d5" }}>{label}</div><div style={{ fontWeight: 700, fontSize: 18, color: "#f5f5f5" }}>{value}</div></div>;
}

function River({ river }: { river: Tile[] }) {
  const rows: Tile[][] = [];
  for (let i = 0; i < river.length; i += 6) rows.push(river.slice(i, i + 6));
  return (
    <div style={{ border: "1px solid #2b7056", borderRadius: 8, padding: 8, minHeight: 64, marginBottom: 8, background: "#00552e" }}>
      {rows.length === 0 ? (
        <div style={{ color: "#bbe7d5" }}>（まだ捨て牌なし）</div>
      ) : (
        rows.map((row, rIdx) => (
          <div key={rIdx} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {row.map((t, i) => (
              <span key={`${rIdx}-${i}`} style={{ border: "1px solid #95d9bf", borderRadius: 4, padding: "4px 6px", background: "#184f3b" }}>
                <img src={tileImagePath(t)} alt={TILE_LABELS[t]} width={44} height={60} style={{ display: "block", pointerEvents: "none" }} onError={(e) => { (e.currentTarget.style.display = "none"); const next = e.currentTarget.nextElementSibling as HTMLElement | null; if (next) next.style.display = "inline"; }} /><span style={{ display: "none" }}>{TILE_LABELS[t]}</span>
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
