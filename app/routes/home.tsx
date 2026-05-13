import { useMemo, useState } from "react";
import {
  calcUkeireForDiscard,
  handWithoutIndex,
  makeWall,
  shantenChiitoi,
  shantenMentsu,
  isWinningHand,
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
  goodMoves: number;
  totalMoves: number;
};

function createGame() {
  const w = makeWall();
  const hand13 = w.splice(w.length - 13, 13).sort(sortTiles);
  const draw = w.pop();
  return { wall: w, hand13, draw };
}

export default function Home() {
  const initial = createGame();
  const [wall, setWall] = useState<Tile[]>(initial.wall);
  const [hand13, setHand13] = useState<Tile[]>(initial.hand13);
  const [drawTile, setDrawTile] = useState<Tile | null>(initial.draw ?? null);
  const [river, setRiver] = useState<Tile[]>([]);
  const [turn, setTurn] = useState(1);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedUke, setSelectedUke] = useState<UkeireResult | null>(null);
  const [stats, setStats] = useState<Stats>({ totalGames: 0, wins: 0, goodMoves: 0, totalMoves: 0 });
  const [resultMsg, setResultMsg] = useState("");
  const [gameEnded, setGameEnded] = useState(false);

  const fullHand = useMemo(() => {
    const base = [...hand13];
    if (drawTile != null) base.push(drawTile);
    return base;
  }, [hand13, drawTile]);

  const shantenM = useMemo(() => shantenMentsu(fullHand), [fullHand]);
  const shantenC = useMemo(() => shantenChiitoi(fullHand), [fullHand]);
  const goodRate = stats.totalMoves ? Math.round((stats.goodMoves / stats.totalMoves) * 100) : 0;

  function startNextGame(win: boolean) {
    const next = createGame();
    setWall(next.wall);
    setHand13(next.hand13);
    setDrawTile(next.draw ?? null);
    setRiver([]);
    setTurn(1);
    setSelectedIdx(null);
    setSelectedUke(null);
    setStats((s) => ({ ...s, totalGames: s.totalGames + 1, wins: s.wins + (win ? 1 : 0) }));
    setResultMsg("");
    setGameEnded(false);
  }

  function drawIfNeeded(next13: Tile[]) {
    if (isWinningHand(next13)) {
      setResultMsg("和了");
      setGameEnded(true);
      return;
    }
    if (turn >= MAX_TURNS || wall.length === 0) {
      setResultMsg("流局");
      setGameEnded(true);
      setStats((s) => ({ ...s, totalGames: s.totalGames + 1 }));
      return;
    }
    const nextWall = [...wall];
    const draw = nextWall.pop();
    if (draw == null) {
      startNextGame(false);
      return;
    }
    setWall(nextWall);
    setHand13(next13.sort(sortTiles));
    setDrawTile(draw);
    setTurn((v) => v + 1);
    setSelectedIdx(null);
    setSelectedUke(null);
  }

  function onTileClick(idx: number) {
    if (selectedIdx !== idx) {
      setSelectedIdx(idx);
      setSelectedUke(calcUkeireForDiscard(fullHand, idx));
      return;
    }
    const discard = fullHand[idx];
    const currentUke = calcUkeireForDiscard(fullHand, idx).mentsuCount;
    let bestUke = -1;
    for (let i = 0; i < fullHand.length; i++) bestUke = Math.max(bestUke, calcUkeireForDiscard(fullHand, i).mentsuCount);
    setStats((s) => ({ ...s, totalMoves: s.totalMoves + 1, goodMoves: s.goodMoves + (currentUke >= bestUke ? 1 : 0) }));
    const next13 = handWithoutIndex(fullHand, idx).sort(sortTiles);
    if (gameEnded) return;
    setRiver((r) => [...r, discard]);
    drawIfNeeded(next13);
  }

  return (
    <main style={{ maxWidth: 920, margin: "8px auto", fontFamily: "sans-serif", padding: "0 8px", color: "#f5f5f5" }}>
      <h1 style={{ marginBottom: 6, fontSize: 22 }}>麻雀 牌効率ゲーム</h1>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(90px,1fr))", gap: 6, marginBottom: 8 }}>
        <Stat label="メンツ手" value={String(shantenM)} />
        <Stat label="七対子" value={String(shantenC)} />
        <Stat label="巡目" value={String(turn)} />
        <Stat label="良打率" value={`${goodRate}%`} />
        <Stat label="勝利/総数" value={`${stats.wins}/${stats.totalGames}`} />
      </section>

      <div style={{ padding: 8, borderRadius: 8, marginBottom: 8, background: "#00552e", fontSize: 14, height: 86, overflow: "hidden" }}>
        {resultMsg ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%" }}>
            <div style={{ fontWeight: 700, color: "#ffe082", fontSize: 20 }}>{resultMsg}</div>
            {gameEnded && <button onClick={() => startNextGame(resultMsg === "和了")} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#6cc9ff", color: "#023", fontWeight: 700, cursor: "pointer" }}>New Game</button>}
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 700, marginBottom: 4, minHeight: 20 }}>{selectedUke && selectedIdx != null ? `仮選択牌: ${TILE_LABELS[fullHand[selectedIdx]]}` : ""}</div>
            <div style={{ minHeight: 20 }}>{selectedUke && selectedIdx != null ? `受け入れ: ${selectedUke.mentsuKinds}種 ${selectedUke.mentsuCount}枚` : ""}</div>
            <div style={{ color: "#bbe7d5", marginTop: 3, minHeight: 20 }}>{selectedUke && selectedIdx != null ? "同じ牌をもう一度クリックで打牌確定" : ""}</div>
          </>
        )}
      </div>

      <div style={{ marginBottom: 6, fontWeight: 700 }}>河（6枚ずつ）</div>
      <River river={river} />

      <div style={{ margin: "8px 0 6px", fontWeight: 700 }}>手牌（13枚 + ツモ1枚）</div>
      <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 6 }}>
        {fullHand.slice(0, 13).map((t, i) => (
          <button
            key={`h-${t}-${i}`}
            onClick={() => onTileClick(i)}
            style={{
              width: 44,
              height: 60,
              padding: 0,
              borderRadius: 0,
              outline: i === selectedIdx ? "2px solid #6cc9ff" : "none",
              marginRight: -1,
              background: "#13523d",
              cursor: gameEnded ? "default" : "pointer",
              flex: "0 0 auto",
            }}
          >
            <MahjongTileFace tile={t} compact />
          </button>
        ))}
        {fullHand[13] != null && (
          <button
            key={`d-${fullHand[13]}`}
            onClick={() => onTileClick(13)}
            style={{
              width: 44,
              height: 60,
              padding: 0,
              borderRadius: 0,
              outline: selectedIdx === 13 ? "2px solid #6cc9ff" : "none",
              marginLeft: 14,
              background: "#13523d",
              cursor: gameEnded ? "default" : "pointer",
              flex: "0 0 auto",
            }}
          >
            <MahjongTileFace tile={fullHand[13]} compact />
          </button>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={{ border: "1px solid #2b7056", borderRadius: 8, padding: 6, background: "#00552e" }}><div style={{ fontSize: 11, color: "#bbe7d5" }}>{label}</div><div style={{ fontWeight: 700, fontSize: 16, color: "#f5f5f5" }}>{value}</div></div>;
}

function MahjongTileFace({ tile, compact = false }: { tile: Tile; compact?: boolean }) {
  return (
    <span style={{ display: "inline-flex", width: "100%", height: "100%", borderRadius: compact ? 0 : 6, background: "#f4f4f4", alignItems: "center", justifyContent: "flex-start", overflow: "hidden" }}>
      <img
        src={tileImagePath(tile)}
        alt={TILE_LABELS[tile]}
        width={44}
        height={60}
        style={{ display: "block", pointerEvents: "none", width: "auto", height: "100%", maxWidth: "100%", objectFit: "contain", objectPosition: "center", margin: "0 auto" }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
          const next = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (next) next.style.display = "inline";
        }}
      />
      <span style={{ display: "none", color: "#102218", fontSize: 12, fontWeight: 700 }}>{TILE_LABELS[tile]}</span>
    </span>
  );
}

function River({ river }: { river: Tile[] }) {
  const rows: Tile[][] = [];
  for (let i = 0; i < river.length; i += 6) rows.push(river.slice(i, i + 6));

  return (
    <div style={{ borderRadius: 8, padding: 8, minHeight: 64, marginBottom: 8, background: "#00552e", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      {rows.length === 0 ? (
        <div style={{ color: "#bbe7d5" }}>（まだ捨て牌なし）</div>
      ) : (
        rows.map((row, rIdx) => (
          <div key={rIdx} style={{ display: "flex", gap: 6, marginBottom: 6, justifyContent: "flex-start" }}>
            {row.map((t, i) => (
              <span key={`${rIdx}-${i}`} style={{ borderRadius: 4, padding: "1px", background: "#184f3b", width: 28, height: 40 }}>
                <MahjongTileFace tile={t} />
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
