import { useEffect, useMemo, useState } from "react";
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

type GameState = {
  wall: Tile[];
  hand13: Tile[];
  drawTile: Tile | null;
  river: Tile[];
  turn: number;
  resultMsg: string;
  gameEnded: boolean;
};

function createGameState(): GameState {
  const w = makeWall();
  const hand13 = w.splice(w.length - 13, 13).sort(sortTiles);
  const draw = w.pop();
  return { wall: w, hand13, drawTile: draw ?? null, river: [], turn: 1, resultMsg: "", gameEnded: false };
}

export default function Home() {
  const [current, setCurrent] = useState<GameState>(() => createGameState());
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [redoStack, setRedoStack] = useState<GameState[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedUke, setSelectedUke] = useState<UkeireResult | null>(null);
  const [selectedWaitInfo, setSelectedWaitInfo] = useState<{ labels: string[]; total: number } | null>(null);
  const [undoDiffMsg, setUndoDiffMsg] = useState("");
  const [stats, setStats] = useState<Stats>({ totalGames: 0, wins: 0, goodMoves: 0, totalMoves: 0 });

  const { wall, hand13, drawTile, river, turn, resultMsg, gameEnded } = current;

  const fullHand = useMemo(() => {
    const base = [...hand13];
    if (drawTile != null) base.push(drawTile);
    return base;
  }, [hand13, drawTile]);

  const shantenM = useMemo(() => shantenMentsu(fullHand), [fullHand]);
  const shantenC = useMemo(() => shantenChiitoi(fullHand), [fullHand]);
  const goodRate = stats.totalMoves ? Math.round((stats.goodMoves / stats.totalMoves) * 100) : 0;

  const selectedNext13 = selectedIdx != null ? handWithoutIndex(fullHand, selectedIdx).sort(sortTiles) : null;
  const previewShantenM = selectedNext13 ? shantenMentsu(selectedNext13) : shantenM;
  const previewShantenC = selectedNext13 ? shantenChiitoi(selectedNext13) : shantenC;
  const isMentsuShantenBack = selectedIdx != null && previewShantenM > shantenM;

  useEffect(() => {
    if (gameEnded || fullHand.length !== 14 || !isWinningHand(fullHand)) return;
    setCurrent((s) => ({ ...s, resultMsg: "和了", gameEnded: true }));
    setStats((s) => ({ ...s, totalGames: s.totalGames + 1, wins: s.wins + 1 }));
  }, [fullHand, gameEnded]);

  function resetSelections() {
    setSelectedIdx(null);
    setSelectedUke(null);
    setSelectedWaitInfo(null);
  }

  function startNextGame() {
    setCurrent(createGameState());
    setUndoStack([]);
    setRedoStack([]);
    resetSelections();
    setUndoDiffMsg("");
  }

  function calcWaitInfoForDiscard(hand14: Tile[], discardIdx: number) {
    const next13 = handWithoutIndex(hand14, discardIdx).sort(sortTiles);
    const waits: Tile[] = [];
    for (let t = 0; t < 34; t++) if (isWinningHand([...next13, t])) waits.push(t);
    if (waits.length === 0) return null;

    const counts = Array(34).fill(0);
    for (const t of next13) counts[t]++;
    let total = 0;
    for (const t of waits) total += Math.max(0, 4 - counts[t]);
    return { labels: waits.map((t) => TILE_LABELS[t]), total };
  }

  function onUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const nowLast = current.river[current.river.length - 1];
    const prevLast = prev.river[prev.river.length - 1];
    setUndoDiffMsg(nowLast == null ? "" : `Undo差分: 打牌 ${TILE_LABELS[nowLast]} → ${prevLast == null ? "（打牌前）" : TILE_LABELS[prevLast]}`);
    setRedoStack((r) => [...r, current]);
    setUndoStack((u) => u.slice(0, -1));
    setCurrent(prev);
    resetSelections();
  }

  function onRedo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, current]);
    setRedoStack((r) => r.slice(0, -1));
    setCurrent(next);
    setUndoDiffMsg("");
    resetSelections();
  }

  function onTileClick(idx: number) {
    if (gameEnded) return;
    if (selectedIdx !== idx) {
      setSelectedIdx(idx);
      setSelectedUke(calcUkeireForDiscard(fullHand, idx));
      setSelectedWaitInfo(calcWaitInfoForDiscard(fullHand, idx));
      return;
    }

    const currentUke = calcUkeireForDiscard(fullHand, idx).mentsuCount;
    let bestUke = -1;
    for (let i = 0; i < fullHand.length; i++) bestUke = Math.max(bestUke, calcUkeireForDiscard(fullHand, i).mentsuCount);
    setStats((s) => ({ ...s, totalMoves: s.totalMoves + 1, goodMoves: s.goodMoves + (currentUke >= bestUke ? 1 : 0) }));

    const discard = fullHand[idx];
    const next13 = handWithoutIndex(fullHand, idx).sort(sortTiles);
    const nextState: GameState = { ...current, river: [...river, discard] };

    if (turn >= MAX_TURNS || wall.length === 0) {
      nextState.resultMsg = "流局";
      nextState.gameEnded = true;
      setStats((s) => ({ ...s, totalGames: s.totalGames + 1 }));
    } else {
      const nextWall = [...wall];
      const draw = nextWall.pop();
      if (draw == null) {
        nextState.resultMsg = "流局";
        nextState.gameEnded = true;
        setStats((s) => ({ ...s, totalGames: s.totalGames + 1 }));
      } else {
        nextState.wall = nextWall;
        nextState.hand13 = next13;
        nextState.drawTile = draw;
        nextState.turn = turn + 1;
      }
    }

    setUndoStack((u) => [...u, current]);
    setRedoStack([]);
    setCurrent(nextState);
    setUndoDiffMsg("");
    resetSelections();
  }

  return (
    <main style={{ maxWidth: 920, margin: "4px auto", fontFamily: "sans-serif", padding: "0 6px", color: "#f5f5f5", minHeight: "100svh", height: "100svh", paddingBottom: "env(safe-area-inset-bottom)", display: "grid", gridTemplateRows: "auto auto auto 1fr auto", gap: 4, overflow: "hidden" }}>
      <h1 style={{ marginBottom: 0, fontSize: 18 }}>麻雀 牌効率ゲーム</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "start", minHeight: 96 }}>
        <div>
          <div style={{ marginBottom: 4, fontWeight: 700, fontSize: 14 }}>河（6枚ずつ）</div>
          <River river={river} fixedHeight={92} compact />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 22 }}>
          <button onClick={onUndo} disabled={undoStack.length === 0} style={{ padding: "4px 8px", minWidth: 62, fontSize: 12 }}>Undo</button>
          <button onClick={onRedo} disabled={redoStack.length === 0} style={{ padding: "4px 8px", minWidth: 62, fontSize: 12 }}>Redo</button>
          <span style={{ color: "#bbe7d5", width: 120, fontSize: 10, lineHeight: 1.2 }}>{undoDiffMsg}</span>
        </div>
      </div>

      <div>
        <div style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14 }}>手牌（13枚 + ツモ1枚）</div>
        <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 4, minHeight: 56 }}>
          {fullHand.slice(0, 13).map((t, i) => (
            <button key={`h-${t}-${i}`} onClick={() => onTileClick(i)} style={{ width: 34, height: 48, padding: 0, borderRadius: 0, outline: i === selectedIdx ? "2px solid #6cc9ff" : "none", marginRight: -1, background: "#13523d", cursor: gameEnded ? "default" : "pointer", flex: "0 0 auto" }}>
              <MahjongTileFace tile={t} compact />
            </button>
          ))}
          {fullHand[13] != null && (
            <button key={`d-${fullHand[13]}`} onClick={() => onTileClick(13)} style={{ width: 34, height: 48, padding: 0, borderRadius: 0, outline: selectedIdx === 13 ? "2px solid #6cc9ff" : "none", marginLeft: 10, background: "#13523d", cursor: gameEnded ? "default" : "pointer", flex: "0 0 auto" }}>
              <MahjongTileFace tile={fullHand[13]} compact />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: 6, borderRadius: 8, background: "#00552e", fontSize: 11, minHeight: 78, overflow: "hidden" }}>
        {resultMsg ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%" }}>
            <div style={{ fontWeight: 700, color: "#ffe082", fontSize: 20 }}>{resultMsg}</div>
            {gameEnded && <button onClick={startNextGame} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#6cc9ff", color: "#023", fontWeight: 700, cursor: "pointer" }}>New Game</button>}
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 700, marginBottom: 4, minHeight: 20 }}>{selectedUke && selectedIdx != null ? `仮選択牌: ${TILE_LABELS[fullHand[selectedIdx]]}` : ""}</div>
            <div style={{ minHeight: 18 }}>{selectedUke ? `メンツ手 受け入れ: ${selectedUke.mentsuKinds}種 ${selectedUke.mentsuCount}枚${isMentsuShantenBack ? "（シャンテン戻し）" : ""}` : ""}</div>
            <div style={{ minHeight: 18 }}>{selectedUke ? `七対子 受け入れ: ${selectedUke.chiitoiKinds}種 ${selectedUke.chiitoiCount}枚` : ""}</div>
            <div style={{ color: "#bbe7d5", marginTop: 2, minHeight: 18 }}>{selectedUke && selectedIdx != null ? (selectedWaitInfo ? `聴牌・待ち: ${selectedWaitInfo.labels.join(" ")}（${selectedWaitInfo.total}枚）` : "同じ牌をもう一度クリックで打牌確定") : ""}</div>
          </>
        )}
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(80px,1fr))", gap: 4 }}>
        <Stat label="メンツ手" value={selectedIdx != null ? `${shantenM} → ${previewShantenM}` : String(shantenM)} />
        <Stat label="七対子" value={selectedIdx != null ? `${shantenC} → ${previewShantenC}` : String(shantenC)} />
        <Stat label="巡目" value={String(turn)} />
        <Stat label="良打率" value={`${goodRate}%`} />
        <Stat label="勝利/総数" value={`${stats.wins}/${stats.totalGames}`} />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={{ border: "1px solid #2b7056", borderRadius: 8, padding: 6, background: "#00552e" }}><div style={{ fontSize: 10, color: "#bbe7d5" }}>{label}</div><div style={{ fontWeight: 700, fontSize: 14, color: "#f5f5f5" }}>{value}</div></div>;
}

function MahjongTileFace({ tile, compact = false }: { tile: Tile; compact?: boolean }) {
  return (
    <span style={{ display: "inline-flex", width: "100%", height: "100%", borderRadius: compact ? 0 : 6, background: "#f4f4f4", alignItems: "center", justifyContent: "flex-start", overflow: "hidden", boxSizing: "border-box", border: "1px solid #d7d7d7" }}>
      <img src={tileImagePath(tile)} alt={TILE_LABELS[tile]} width={44} height={60} style={{ display: "block", pointerEvents: "none", width: "auto", height: "100%", maxWidth: "100%", objectFit: "contain", objectPosition: "center", margin: "0 auto" }} onError={(e) => { e.currentTarget.style.display = "none"; const next = e.currentTarget.nextElementSibling as HTMLElement | null; if (next) next.style.display = "inline"; }} />
      <span style={{ display: "none", color: "#102218", fontSize: 12, fontWeight: 700 }}>{TILE_LABELS[tile]}</span>
    </span>
  );
}

function River({ river, fixedHeight, compact = false }: { river: Tile[]; fixedHeight?: number; compact?: boolean }) {
  const rows: Tile[][] = [];
  for (let i = 0; i < river.length; i += 6) rows.push(river.slice(i, i + 6));

  return (
    <div style={{ borderRadius: 8, padding: compact ? 6 : 8, height: fixedHeight ?? 120, marginBottom: 0, background: "#00552e", display: "flex", flexDirection: "column", alignItems: "flex-start", overflowY: "auto" }}>
      {rows.length === 0 ? <div style={{ color: "#bbe7d5" }}>（まだ捨て牌なし）</div> : rows.map((row, rIdx) => (
        <div key={rIdx} style={{ display: "flex", gap: compact ? 4 : 6, marginBottom: compact ? 4 : 6, justifyContent: "flex-start" }}>
          {row.map((t, i) => <span key={`${rIdx}-${i}`} style={{ borderRadius: 4, padding: "1px", background: "#184f3b", width: compact ? 22 : 28, height: compact ? 32 : 40 }}><MahjongTileFace tile={t} /></span>)}
        </div>
      ))}
    </div>
  );
}
