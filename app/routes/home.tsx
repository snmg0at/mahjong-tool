import { useMemo, useState } from "react";
import {
  calcUkeireForDiscard,
  handWithoutIndex,
  makeWall,
  shantenChiitoi,
  shantenMentsu,
  sortTiles,
  TILE_LABELS,
  tileImagePath,
  type Tile,
} from "../lib/mahjong";

type Mode = "random" | "twoShanten";

type GameState = {
  wall: Tile[];
  hand13: Tile[];
  drawTile: Tile | null;
  river: Tile[];
  turn: number;
  resultMsg: string;
  gameEnded: boolean;
};

function createGameState(mode: Mode): GameState {
  if (mode === "random") {
    const w = makeWall();
    const hand13 = w.splice(w.length - 13, 13).sort(sortTiles);
    const draw = w.pop() ?? null;
    return { wall: w, hand13, drawTile: draw, river: [], turn: 1, resultMsg: "", gameEnded: false };
  }

  for (let i = 0; i < 3000; i++) {
    const w = makeWall();
    const hand13 = w.splice(w.length - 13, 13).sort(sortTiles);
    const draw = w.pop();
    if (draw == null) continue;
    const full = [...hand13, draw];
    if (Math.min(shantenMentsu(full), shantenChiitoi(full)) === 2) {
      return { wall: w, hand13, drawTile: draw, river: [], turn: 1, resultMsg: "", gameEnded: false };
    }
  }

  return createGameState("random");
}

export default function Home() {
  const [mode, setMode] = useState<Mode | null>(null);

  if (mode == null) {
    return (
      <main style={{ maxWidth: 900, margin: "12px auto", padding: "0 10px", color: "#f5f5f5", fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 22 }}>麻雀 牌効率ゲーム</h1>
        <div style={{ display: "grid", gap: 8 }}>
          <button onClick={() => setMode("random")} style={{ padding: 12, fontWeight: 700 }}>通常配牌モード</button>
          <button onClick={() => setMode("twoShanten")} style={{ padding: 12, fontWeight: 700 }}>二向聴チャレンジ</button>
        </div>
      </main>
    );
  }

  return <GameScreen mode={mode} onBack={() => setMode(null)} />;
}

function GameScreen({ mode, onBack }: { mode: Mode; onBack: () => void }) {
  const [state, setState] = useState<GameState>(() => createGameState(mode));
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const fullHand = useMemo(() => {
    const h = [...state.hand13];
    if (state.drawTile != null) h.push(state.drawTile);
    return h;
  }, [state.hand13, state.drawTile]);

  const shantenM = useMemo(() => shantenMentsu(fullHand), [fullHand]);
  const shantenC = useMemo(() => shantenChiitoi(fullHand), [fullHand]);

  const onTileClick = (idx: number) => {
    if (state.gameEnded) return;
    if (selectedIdx !== idx) {
      setSelectedIdx(idx);
      return;
    }

    const discard = fullHand[idx];
    const next13 = handWithoutIndex(fullHand, idx).sort(sortTiles);
    const nextWall = [...state.wall];
    const draw = nextWall.pop() ?? null;

    setState((prev) => ({
      ...prev,
      hand13: next13,
      drawTile: draw,
      wall: nextWall,
      river: [...prev.river, discard],
      turn: prev.turn + 1,
    }));
    setSelectedIdx(null);
  };

  return (
    <main style={{ maxWidth: 900, margin: "8px auto", padding: "0 8px", color: "#f5f5f5", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>麻雀 牌効率ゲーム</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onBack}>Menu</button>
          <button onClick={() => setState(createGameState(mode))}>New Game</button>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>巡目: {state.turn}</div>
      <div style={{ marginBottom: 8 }}>メンツ手: {shantenM} / 七対子: {shantenC}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {fullHand.map((t, i) => (
          <button
            key={`${t}-${i}`}
            onClick={() => onTileClick(i)}
            style={{
              width: 34,
              height: 46,
              padding: 0,
              border: i === selectedIdx ? "2px solid #6cc9ff" : "1px solid #d7d7d7",
              background: "#13523d",
            }}
            title={TILE_LABELS[t]}
          >
            <img
              src={tileImagePath(t)}
              alt={TILE_LABELS[t]}
              width={32}
              height={44}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
            />
          </button>
        ))}
      </div>

      {selectedIdx != null ? (
        <div>
          選択牌: {TILE_LABELS[fullHand[selectedIdx]]} / 受け入れ: {calcUkeireForDiscard(fullHand, selectedIdx).mentsuCount}枚
        </div>
      ) : (
        <div>牌を1回クリックで選択、同じ牌をもう1回クリックで打牌</div>
      )}
    </main>
  );
}
