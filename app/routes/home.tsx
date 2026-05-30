import { useMemo, useState } from "react";
import {
  calcUkeireForDiscard,
  classifyMentsuStructure,
  handWithoutIndex,
  isWinningHand,
  makeWall,

  makeSanmaWall,
  generateFiveBlockNoPairHand,
  SANMA_ALLOWED_TILES,
  shantenChiitoi,
  shantenMentsu,
  classifyMentsuStructure,

  sortTiles,
  TILE_LABELS,
  tileImagePath,
  toCounts,
  type Tile,
  type UkeireResult,
} from "../lib/mahjong";

const MAX_TURNS = 18;

type RuleSet = "yonma" | "sanma";
type Mode = "random" | "twoShanten" | "fiveBlockWithPair" | "fourBlockWithPair" | "fiveBlockNoPair" | "twoShantenFiveBlock" | "twoShantenFourBlock" | "twoShantenNoPair";

const ADVANCED_MODES: Mode[] = ["fiveBlockWithPair", "fourBlockWithPair", "fiveBlockNoPair", "twoShantenFiveBlock", "twoShantenFourBlock", "twoShantenNoPair"];
const isAdvancedMode = (mode: Mode): boolean => ADVANCED_MODES.includes(mode);
const modeLabel = (mode: Mode): string => {
  if (mode === "random") return "通常配牌モード";

  if (mode === "twoShanten") return "二向聴チャレンジ";
  if (mode === "fiveBlockWithPair") return "5ブロック雀頭あり";
  if (mode === "fourBlockWithPair") return "4ブロック雀頭あり";
  if (mode === "fiveBlockNoPair") return "5ブロック雀頭なし";
  if (mode === "twoShantenFiveBlock") return "二向聴5ブロック";
  if (mode === "twoShantenFourBlock") return "二向聴4ブロック";
  return "二向聴雀頭なし";
};
type Stats = { totalGames: number; wins: number; goodMoves: number; totalMoves: number };
type ReviewItem = { tile: Tile; mKinds: number; mCount: number; nextShanten: number; score: number };
type LastDiscardReview = { discard: Tile; mentsuKinds: number; mentsuCount: number; top3: ReviewItem[] };
type GameState = { wall: Tile[]; hand13: Tile[]; drawTile: Tile | null; river: Tile[]; turn: number; resultMsg: string; gameEnded: boolean; lastReview: LastDiscardReview | null };


function ruleSetLabel(ruleSet: RuleSet): string { return ruleSet === "yonma" ? "四麻" : "三麻"; }

function createGameState(ruleSet: RuleSet, mode: Mode): GameState {

  const fromRandomDeal = (wallFactory: () => Tile[] = makeWall): GameState => {
    const w = wallFactory(); const hand13 = w.splice(w.length - 13, 13).sort(sortTiles); const draw = w.pop();
    return { wall: w, hand13, drawTile: draw ?? null, river: [], turn: 1, resultMsg: "", gameEnded: false, lastReview: null };
  };


  const wallFactory = ruleSet === "sanma" ? makeSanmaWall : makeWall;


  const matchesMode = (fullHand: Tile[]): boolean => {
    const m = classifyMentsuStructure(fullHand);
    const minShanten = Math.min(shantenMentsu(fullHand), shantenChiitoi(fullHand));
    if (mode === "twoShanten") return minShanten === 2;
    if (mode === "fiveBlockWithPair") return m.blocks === 5 && m.hasPair;
    // 合意仕様: 「4ブロック雀頭あり」はシャンテン固定せず、形条件のみで開始する
    if (mode === "fourBlockWithPair") return m.blocks === 4 && m.hasPair;
    if (mode === "fiveBlockNoPair") return m.strictNoPair5Block;
    if (mode === "twoShantenFiveBlock") return m.shantenMentsuOnly === 2 && m.blocks === 5 && m.hasPair;
    if (mode === "twoShantenFourBlock") return m.shantenMentsuOnly === 2 && m.blocks === 4 && m.hasPair;
    if (mode === "twoShantenNoPair") return m.shantenMentsuOnly === 2 && !m.hasPair;
    return true;
  };


  if (mode === "random") return fromRandomDeal(wallFactory);
  if (mode === "fiveBlockNoPair") {
    const hand14 = ruleSet === "sanma" ? generateFiveBlockNoPairHand(20000, SANMA_ALLOWED_TILES) : generateFiveBlockNoPairHand();
    const wall = wallFactory();

    for (const t of hand14) {
      const ix = wall.indexOf(t);
      if (ix >= 0) wall.splice(ix, 1);
    }
    const shuffled = [...hand14].sort(() => Math.random() - 0.5);
    const draw = shuffled.pop() ?? null;
    const hand13 = shuffled.sort(sortTiles);
    return { wall, hand13, drawTile: draw, river: [], turn: 1, resultMsg: "", gameEnded: false, lastReview: null };
  }


  for (let i = 0; i < 8000; i++) {
    const state = fromRandomDeal(wallFactory);
    if (state.drawTile == null) continue;
    if (matchesMode([...state.hand13, state.drawTile])) return state;
  }
  return fromRandomDeal(wallFactory);
}


function breaksCompletedMeldShape(base13: Tile[], discard: Tile): boolean {
  const c = toCounts(base13);
  if (discard <= 26 && c[discard] >= 2) return true;
  if (discard <= 26) {
    if (discard % 9 <= 6 && c[discard + 1] > 0 && c[discard + 2] > 0) return true;
    if (discard % 9 >= 1 && discard % 9 <= 7 && c[discard - 1] > 0 && c[discard + 1] > 0) return true;
    if (discard % 9 >= 2 && c[discard - 1] > 0 && c[discard - 2] > 0) return true;
  }
  return false;
}

export default function Home() {

  const [ruleSet, setRuleSet] = useState<RuleSet | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  if (ruleSet == null) {
    return <main style={{ maxWidth: 920, margin: "8px auto", padding: "0 8px", color: "#f5f5f5", fontFamily: "sans-serif" }}><h1 style={{ fontSize: 22 }}>麻雀 牌効率ゲーム</h1><section style={{ display: "grid", gap: 8, background: "#00552e", borderRadius: 8, padding: 10 }}><h2 style={{ margin: 0, fontSize: 16, color: "#bbe7d5" }}>ルール選択</h2><button onClick={() => setRuleSet("yonma")} style={{ padding: "12px", fontWeight: 700 }}>四麻</button><button onClick={() => setRuleSet("sanma")} style={{ padding: "12px", fontWeight: 700 }}>三麻</button></section></main>;
  }

  if (mode == null) {
    return <main style={{ maxWidth: 920, margin: "8px auto", padding: "0 8px", color: "#f5f5f5", fontFamily: "sans-serif" }}><h1 style={{ fontSize: 22 }}>麻雀 牌効率ゲーム</h1><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><h2 style={{ fontSize: 18, color: "#bbe7d5" }}>{ruleSetLabel(ruleSet)} モード選択</h2><button onClick={() => setRuleSet(null)} style={{ padding: "8px 10px", fontWeight: 700 }}>ルール選択へ戻る</button></div><div style={{ display: "grid", gap: 12 }}><section style={{ display: "grid", gap: 8, background: "#00552e", borderRadius: 8, padding: 10 }}><h2 style={{ margin: 0, fontSize: 16, color: "#bbe7d5" }}>通常</h2><button onClick={() => setMode("random")} style={{ padding: "12px", fontWeight: 700 }}>通常配牌モード</button><button onClick={() => setMode("twoShanten")} style={{ padding: "12px", fontWeight: 700 }}>二向聴チャレンジ</button></section><section style={{ display: "grid", gap: 8, background: "#00552e", borderRadius: 8, padding: 10 }}><h2 style={{ margin: 0, fontSize: 16, color: "#bbe7d5" }}>上級</h2><button onClick={() => setMode("fiveBlockWithPair")} style={{ padding: "12px", fontWeight: 700 }}>5ブロック雀頭あり</button><button onClick={() => setMode("fourBlockWithPair")} style={{ padding: "12px", fontWeight: 700 }}>4ブロック雀頭あり</button><button onClick={() => setMode("fiveBlockNoPair")} style={{ padding: "12px", fontWeight: 700 }}>5ブロック雀頭なし</button><button onClick={() => setMode("twoShantenFiveBlock")} style={{ padding: "12px", fontWeight: 700 }}>二向聴5ブロック</button><button onClick={() => setMode("twoShantenFourBlock")} style={{ padding: "12px", fontWeight: 700 }}>二向聴4ブロック</button><button onClick={() => setMode("twoShantenNoPair")} style={{ padding: "12px", fontWeight: 700 }}>二向聴雀頭なし</button></section></div></main>;
  }
  return <GameScreen ruleSet={ruleSet} mode={mode} onBackToMenu={() => setMode(null)} />;
}

function GameScreen({ ruleSet, mode, onBackToMenu }: { ruleSet: RuleSet; mode: Mode; onBackToMenu: () => void }) {
  const [current, setCurrent] = useState<GameState>(() => createGameState(ruleSet, mode));
  const [undoStack, setUndoStack] = useState<Array<{ state: GameState; stats: Stats }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ state: GameState; stats: Stats }>>([]);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedUke, setSelectedUke] = useState<UkeireResult | null>(null);
  const [selectedWaitInfo, setSelectedWaitInfo] = useState<{ labels: string[]; total: number } | null>(null);
  const [undoDiffMsg, setUndoDiffMsg] = useState("");
  const [stats, setStats] = useState<Stats>({ totalGames: 0, wins: 0, goodMoves: 0, totalMoves: 0 });

  const isMini = typeof window !== "undefined" && window.innerHeight <= 740;
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;


  const { wall, hand13, drawTile, river, turn, resultMsg, gameEnded, lastReview } = current;
  const fullHand = useMemo(() => { const b = [...hand13]; if (drawTile != null) b.push(drawTile); return b; }, [hand13, drawTile]);
  const shantenM = useMemo(() => shantenMentsu(fullHand), [fullHand]);
  const shantenC = useMemo(() => (isAdvancedMode(mode) ? null : shantenChiitoi(fullHand)), [fullHand, mode]);
  const goodRate = stats.totalMoves ? Math.round((stats.goodMoves / stats.totalMoves) * 100) : 0;
  const selectedNext13 = selectedIdx != null ? handWithoutIndex(fullHand, selectedIdx).sort(sortTiles) : null;
  const previewShantenM = selectedNext13 ? shantenMentsu(selectedNext13) : shantenM;
  const previewShantenC = shantenC == null ? null : (selectedNext13 ? shantenChiitoi(selectedNext13) : shantenC);
  const isMentsuShantenBack = selectedIdx != null && previewShantenM > shantenM;
  const shantenCLabel = previewShantenC == null ? "---" : (selectedIdx != null ? `${shantenC} → ${previewShantenC}` : String(shantenC));

  const resetSelections = () => { setSelectedIdx(null); setSelectedUke(null); setSelectedWaitInfo(null); };

  const startNextGame = () => { setCurrent(createGameState(ruleSet, mode)); setUndoStack([]); setRedoStack([]); resetSelections(); setUndoDiffMsg(""); };
  const calcWaitInfoForDiscard = (hand14: Tile[], discardIdx: number) => { const next13 = handWithoutIndex(hand14, discardIdx).sort(sortTiles); const waits: Tile[] = []; for (let t = 0; t < 34; t++) if (isWinningHand([...next13, t])) waits.push(t); if (waits.length === 0) return null; const counts = Array(34).fill(0); for (const t of next13) counts[t]++; let total = 0; for (const t of waits) total += Math.max(0, 4 - counts[t]); return { labels: waits.map((t) => TILE_LABELS[t]), total }; };

  const onUndo = () => { if (!undoStack.length) return; const prev = undoStack[undoStack.length - 1]; const nowLast = current.river[current.river.length - 1]; const prevLast = prev.state.river[prev.state.river.length - 1]; setUndoDiffMsg(nowLast == null ? "" : `Undo差分: 打牌 ${TILE_LABELS[nowLast]} → ${prevLast == null ? "（打牌前）" : TILE_LABELS[prevLast]}`); setRedoStack((r) => [...r, { state: current, stats }]); setUndoStack((u) => u.slice(0, -1)); setCurrent(prev.state); setStats(prev.stats); resetSelections(); };
  const onRedo = () => { if (!redoStack.length) return; const next = redoStack[redoStack.length - 1]; setUndoStack((u) => [...u, { state: current, stats }]); setRedoStack((r) => r.slice(0, -1)); setCurrent(next.state); setStats(next.stats); setUndoDiffMsg(""); resetSelections(); };

  const onTileClick = (idx: number) => {
    if (gameEnded) return;
    if (selectedIdx !== idx) { setSelectedIdx(idx); setSelectedUke(calcUkeireForDiscard(fullHand, idx)); setSelectedWaitInfo(calcWaitInfoForDiscard(fullHand, idx)); return; }

    let bestScore = -Infinity;
    let currentScore = -Infinity;
    const all: ReviewItem[] = [];
    for (let i = 0; i < fullHand.length; i++) {
      const discard = fullHand[i];
      const base13 = handWithoutIndex(fullHand, i).sort(sortTiles);
      const r = calcUkeireForDiscard(fullHand, i);
      const nextShanten = shantenMentsu(base13);
      const breaksMeld = breaksCompletedMeldShape(base13, discard);
      const score = -(nextShanten * 10000) + r.mentsuCount * 100 + r.mentsuKinds * 10 - (breaksMeld ? 25 : 0);
      if (score > bestScore) bestScore = score;
      if (i === idx) currentScore = score;
      all.push({ tile: discard, mKinds: r.mentsuKinds, mCount: r.mentsuCount, nextShanten, score });
    }

    const isGoodMove = currentScore >= bestScore;
    setStats((s) => ({ ...s, totalMoves: s.totalMoves + 1, goodMoves: s.goodMoves + (isGoodMove ? 1 : 0) }));


    const discard = fullHand[idx];
    const next13 = handWithoutIndex(fullHand, idx).sort(sortTiles);
    const nextState: GameState = { ...current, river: [...river, discard], hand13: next13, drawTile: null };

    const top3 = [...all].sort((a, b) => b.score - a.score || b.mCount - a.mCount || b.mKinds - a.mKinds).slice(0, 3);
    const cur = calcUkeireForDiscard(fullHand, idx);
    nextState.lastReview = { discard, mentsuKinds: cur.mentsuKinds, mentsuCount: cur.mentsuCount, top3 };


    if (shantenMentsu(next13) === 0 || shantenChiitoi(next13) === 0) {
      nextState.resultMsg = "聴牌";
      nextState.gameEnded = true;
      setStats((st) => ({ ...st, totalGames: st.totalGames + 1, wins: st.wins + 1 }));
      setUndoStack((u) => [...u, { state: current, stats }]); setRedoStack([]); setCurrent(nextState); setUndoDiffMsg(""); resetSelections();
      return;
    }

    if (turn >= MAX_TURNS || wall.length === 0) {
      nextState.resultMsg = "流局";
      nextState.gameEnded = true;
      setStats((s) => ({ ...s, totalGames: s.totalGames + 1 }));
    } else {
      const nextWall = [...wall]; const draw = nextWall.pop();
      if (draw == null) {
        nextState.resultMsg = "流局";
        nextState.gameEnded = true;
        setStats((s) => ({ ...s, totalGames: s.totalGames + 1 }));
      } else {
        nextState.wall = nextWall;
        nextState.drawTile = draw;
        nextState.turn = turn + 1;
      }
    }
    setUndoStack((u) => [...u, { state: current, stats }]); setRedoStack([]); setCurrent(nextState); setUndoDiffMsg(""); resetSelections();
  };

  return <main style={{ maxWidth: 920, margin: "4px auto", fontFamily: "sans-serif", padding: "0 6px", color: "#f5f5f5", minHeight: "100svh", height: "100svh", paddingBottom: "env(safe-area-inset-bottom)", display: "grid", gridTemplateRows: "auto auto auto auto auto", gap: 3, overflow: "hidden" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h1 style={{ marginBottom: 0, fontSize: isDesktop ? 22 : isMini ? 14 : 16 }}>麻雀 牌効率ゲーム（{ruleSetLabel(ruleSet)} / {modeLabel(mode)}）</h1><div style={{ display: "flex", gap: 6 }}><button onClick={onBackToMenu} style={{ padding: "4px 8px", fontSize: isDesktop ? 14 : 11 }}>Menu</button><button onClick={startNextGame} style={{ padding: isDesktop ? "6px 10px" : "4px 8px", fontSize: isDesktop ? 14 : 11 }}>New Game</button></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "start", minHeight: isDesktop ? 120 : isMini ? 68 : 78 }}><River river={river} fixedHeight={isDesktop ? 180 : isMini ? 62 : 74} compact desktop={isDesktop} /><div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: isMini ? 8 : 10 }}><button onClick={onUndo} disabled={undoStack.length === 0} style={{ padding: "4px 8px", minWidth: isDesktop ? 74 : isMini ? 50 : 56, fontSize: isDesktop ? 14 : isMini ? 10 : 11 }}>Undo</button><button onClick={onRedo} disabled={redoStack.length === 0} style={{ padding: "4px 8px", minWidth: isDesktop ? 74 : isMini ? 50 : 56, fontSize: isDesktop ? 14 : isMini ? 10 : 11 }}>Redo</button><span style={{ color: "#bbe7d5", width: isDesktop ? 160 : isMini ? 84 : 96, fontSize: isDesktop ? 12 : isMini ? 8 : 9, lineHeight: 1.2 }}>{undoDiffMsg}</span></div></div><div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 2, minHeight: isDesktop ? 66 : isMini ? 44 : 48 }}>{fullHand.slice(0, 13).map((t, i) => <button key={`h-${t}-${i}`} onClick={() => onTileClick(i)} style={{ width: isDesktop ? 44 : isMini ? 27 : 30, height: isDesktop ? 60 : isMini ? 38 : 42, padding: 0, borderRadius: 0, outline: i === selectedIdx ? "2px solid #6cc9ff" : "none", marginRight: -1, background: "#13523d", cursor: gameEnded ? "default" : "pointer", flex: "0 0 auto" }}><MahjongTileFace tile={t} compact /></button>)}{fullHand[13] != null && <button key={`d-${fullHand[13]}`} onClick={() => onTileClick(13)} style={{ width: isDesktop ? 44 : isMini ? 27 : 30, height: isDesktop ? 60 : isMini ? 38 : 42, padding: 0, borderRadius: 0, outline: selectedIdx === 13 ? "2px solid #6cc9ff" : "none", marginLeft: isDesktop ? 14 : isMini ? 6 : 8, background: "#13523d", cursor: gameEnded ? "default" : "pointer", flex: "0 0 auto" }}><MahjongTileFace tile={fullHand[13]} compact /></button>}</div><div style={{ padding: isDesktop ? 8 : isMini ? 3 : 4, borderRadius: 8, background: "#00552e", fontSize: isDesktop ? 14 : isMini ? 8 : 9, minHeight: isDesktop ? 108 : isMini ? 60 : 70, overflow: "hidden" }}>{resultMsg ? <div style={{ fontWeight: 700, color: "#ffe082", fontSize: isDesktop ? 22 : isMini ? 12 : 14 }}>{resultMsg}</div> : null}<div style={{ minHeight: isDesktop ? 20 : isMini ? 10 : 12 }}>{selectedUke && selectedIdx != null ? `仮選択牌: ${TILE_LABELS[fullHand[selectedIdx]]}` : ""}</div><div style={{ minHeight: isDesktop ? 20 : isMini ? 10 : 12 }}>{selectedUke ? `メンツ手 受け入れ: ${selectedUke.mentsuKinds}種 ${selectedUke.mentsuCount}枚${isMentsuShantenBack ? "（シャンテン戻し）" : ""}` : ""}</div><div style={{ minHeight: isDesktop ? 20 : isMini ? 10 : 12 }}>{selectedUke ? `七対子 受け入れ: ${selectedUke.chiitoiKinds}種 ${selectedUke.chiitoiCount}枚` : ""}</div><div style={{ color: "#bbe7d5", minHeight: isDesktop ? 20 : isMini ? 10 : 12 }}>{selectedUke && selectedIdx != null ? (selectedWaitInfo ? `聴牌・待ち: ${selectedWaitInfo.labels.join(" ")}（${selectedWaitInfo.total}枚）` : "同じ牌をもう一度クリックで打牌確定") : ""}</div><div style={{ color: "#ffe082", minHeight: isDesktop ? 20 : isMini ? 10 : 12 }}>{lastReview ? `直前打牌評価: ${TILE_LABELS[lastReview.discard]} / ${lastReview.mentsuKinds}種${lastReview.mentsuCount}枚 / Top3 ${lastReview.top3.map((x, i) => `${i + 1}位 ${TILE_LABELS[x.tile]}（${x.mCount}枚）`).join(" / ")}` : ""}</div></div><section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: isDesktop ? 6 : isMini ? 2 : 3 }}><Stat compact={isMini} large={isDesktop} label="メンツ手" value={selectedIdx != null ? `${shantenM} → ${previewShantenM}` : String(shantenM)} /><Stat compact={isMini} large={isDesktop} label="七対子" value={shantenCLabel} /><Stat compact={isMini} large={isDesktop} label="巡目" value={String(turn)} /><Stat compact={isMini} large={isDesktop} label="良打率" value={`${goodRate}%`} /><Stat compact={isMini} large={isDesktop} label="勝利/総数" value={`${stats.wins}/${stats.totalGames}`} /></section></main>;
}


function Stat({ label, value, compact = false, large = false }: { label: string; value: string; compact?: boolean; large?: boolean }) { return <div style={{ border: "1px solid #2b7056", borderRadius: 8, padding: large ? 8 : compact ? 3 : 4, background: "#00552e" }}><div style={{ fontSize: large ? 11 : compact ? 7 : 8, color: "#bbe7d5" }}>{label}</div><div style={{ fontWeight: 700, fontSize: large ? 18 : compact ? 10 : 11, color: "#f5f5f5" }}>{value}</div></div>; }
function MahjongTileFace({ tile, compact = false }: { tile: Tile; compact?: boolean }) { return <span style={{ display: "inline-flex", width: "100%", height: "100%", borderRadius: compact ? 0 : 6, background: "#f4f4f4", alignItems: "center", justifyContent: "flex-start", overflow: "hidden", boxSizing: "border-box", border: "1px solid #d7d7d7" }}><img src={tileImagePath(tile)} alt={TILE_LABELS[tile]} width={44} height={60} style={{ display: "block", pointerEvents: "none", width: "auto", height: "100%", maxWidth: "100%", objectFit: "contain", objectPosition: "center", margin: "0 auto" }} onError={(e) => { e.currentTarget.style.display = "none"; const next = e.currentTarget.nextElementSibling as HTMLElement | null; if (next) next.style.display = "inline"; }} /><span style={{ display: "none", color: "#102218", fontSize: 12, fontWeight: 700 }}>{TILE_LABELS[tile]}</span></span>; }
function River({ river, fixedHeight, compact = false, desktop = false }: { river: Tile[]; fixedHeight?: number; compact?: boolean; desktop?: boolean }) { const rows: Tile[][] = []; for (let i = 0; i < river.length; i += 6) rows.push(river.slice(i, i + 6)); return <div style={{ borderRadius: 8, padding: compact ? 3 : 10, height: fixedHeight ?? 120, marginBottom: 0, background: "#00552e", display: "flex", flexDirection: "column", alignItems: "flex-start", overflowY: "auto" }}>{rows.length === 0 ? <div style={{ color: "#bbe7d5" }}>（まだ捨て牌なし）</div> : rows.map((row, rIdx) => <div key={rIdx} style={{ display: "flex", gap: compact ? 2 : 8, marginBottom: compact ? 2 : 6, justifyContent: "flex-start" }}>{row.map((t, i) => <span key={`${rIdx}-${i}`} style={{ borderRadius: 4, padding: "1px", background: "#184f3b", width: desktop ? 36 : compact ? 16 : 32, height: desktop ? 52 : compact ? 22 : 46 }}><MahjongTileFace tile={t} /></span>)}</div>)}</div>; }
