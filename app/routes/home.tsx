import { useMemo, useState } from "react";
import {
  calcUkeireForDiscard,
  classifyMentsuStructure,
  handWithoutIndex,
  isWinningHand,
  makeWall,
  makeSanmaWall,
  generateFiveBlockNoPairHand,
  generateSanmaFiveBlockNoPairHand,
  shantenChiitoi,
  shantenMentsu,
  sortTiles,
  TILE_LABELS,
  tileImagePath,
  toCounts,
  type Tile,
  type UkeireResult,
} from "../lib/mahjong";

const MAX_TURNS = 18;

type RuleSet = "yonma" | "sanma";
type Difficulty = "easy" | "medium" | "expert";
type GoatReaction = "idle" | "inspect" | "encourage" | "celebrate";
type Mode =
  | "random"
  | "twoShanten"
  | "fiveBlockWithPair"
  | "fourBlockWithPair"
  | "fiveBlockNoPair"
  | "twoShantenFiveBlock"
  | "twoShantenFourBlock"
  | "twoShantenNoPair";
type Language = "en" | "ja";

const ADVANCED_MODES: Mode[] = [
  "fiveBlockWithPair",
  "fourBlockWithPair",
  "fiveBlockNoPair",
  "twoShantenFiveBlock",
  "twoShantenFourBlock",
  "twoShantenNoPair",
];
const isAdvancedMode = (mode: Mode): boolean => ADVANCED_MODES.includes(mode);
const modeLabel = (mode: Mode, language: Language): string => {
  const labels: Record<Mode, [string, string]> = {
    random: ["Standard Deal", "通常配牌モード"],
    twoShanten: ["Two-away (二向聴) Challenge", "二向聴チャレンジ"],
    fiveBlockWithPair: ["5 Blocks + Pair (雀頭)", "5ブロック雀頭あり"],
    fourBlockWithPair: ["4 Blocks + Pair (雀頭)", "4ブロック雀頭あり"],
    fiveBlockNoPair: ["5 Blocks, No Pair (雀頭なし)", "5ブロック雀頭なし"],
    twoShantenFiveBlock: ["Two-away (二向聴), 5 Blocks", "二向聴5ブロック"],
    twoShantenFourBlock: ["Two-away (二向聴), 4 Blocks", "二向聴4ブロック"],
    twoShantenNoPair: [
      "Two-away (二向聴), No Pair (雀頭なし)",
      "二向聴雀頭なし",
    ],
  };
  return labels[mode][language === "en" ? 0 : 1];
};
type Stats = {
  totalGames: number;
  wins: number;
  goodMoves: number;
  totalMoves: number;
};
type ReviewItem = {
  tile: Tile;
  mKinds: number;
  mCount: number;
  nextShanten: number;
  score: number;
};
type LastDiscardReview = {
  discard: Tile;
  mentsuKinds: number;
  mentsuCount: number;
  top3: ReviewItem[];
};
type GameState = {
  wall: Tile[];
  hand13: Tile[];
  drawTile: Tile | null;
  river: Tile[];
  turn: number;
  resultMsg: string;
  gameEnded: boolean;
  lastReview: LastDiscardReview | null;
};

function ruleSetLabel(ruleSet: RuleSet, language: Language): string {
  if (language === "ja") return ruleSet === "yonma" ? "四麻" : "三麻";
  return ruleSet === "yonma" ? "Four-player (四麻)" : "Three-player (三麻)";
}

function LanguageSelector({
  language,
  onChange,
  compact = false,
}: {
  language: Language;
  onChange: (language: Language) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Language / 言語"
      style={{ display: "flex", gap: 2 }}
    >
      <button
        aria-pressed={language === "en"}
        onClick={() => onChange("en")}
        style={{
          padding: compact ? "3px 6px" : "5px 8px",
          fontSize: compact ? 10 : undefined,
          fontWeight: language === "en" ? 700 : 400,
          background: language === "en" ? "#ffe082" : "#f5f5f5",
        }}
      >
        English
      </button>
      <button
        aria-pressed={language === "ja"}
        onClick={() => onChange("ja")}
        style={{
          padding: compact ? "3px 6px" : "5px 8px",
          fontSize: compact ? 10 : undefined,
          fontWeight: language === "ja" ? 700 : 400,
          background: language === "ja" ? "#ffe082" : "#f5f5f5",
        }}
      >
        日本語
      </button>
    </div>
  );
}

function HistoryControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  compact = false,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  compact?: boolean;
}) {
  const size = compact ? 28 : 36;
  const iconSize = compact ? 15 : 19;
  const buttonStyle = (enabled: boolean) =>
    ({
      width: size,
      height: size,
      padding: 0,
      borderRadius: "50%",
      border: enabled
        ? "1px solid rgba(255, 224, 130, 0.9)"
        : "1px solid rgba(255, 255, 255, 0.2)",
      background: enabled
        ? "rgba(255, 224, 130, 0.14)"
        : "rgba(255, 255, 255, 0.045)",
      color: enabled ? "#ffe082" : "rgba(220, 235, 229, 0.46)",
      boxShadow: enabled
        ? "0 0 0 2px rgba(255, 224, 130, 0.1), 0 0 12px rgba(255, 214, 92, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.24)"
        : "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
      opacity: enabled ? 1 : 0.58,
      display: "inline-grid",
      placeItems: "center",
      cursor: enabled ? "pointer" : "default",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      transition:
        "border-color 160ms ease, background-color 160ms ease, color 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
    }) as const;

  return (
    <div style={{ display: "flex", gap: compact ? 5 : 7 }}>
      <button
        type="button"
        aria-label="Undo"
        title="Undo"
        disabled={!canUndo}
        onClick={onUndo}
        style={buttonStyle(canUndo)}
      >
        <svg
          aria-hidden="true"
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          style={{ display: "block" }}
        >
          <path
            d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Redo"
        title="Redo"
        disabled={!canRedo}
        onClick={onRedo}
        style={buttonStyle(canRedo)}
      >
        <svg
          aria-hidden="true"
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          style={{ display: "block" }}
        >
          <path
            d="m15 14 5-5-5-5m5 5H9.5a5.5 5.5 0 0 0 0 11H13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 13,
        height: 10,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {[0, 1, 2].map((line) => (
        <span
          key={line}
          style={{
            display: "block",
            height: 1.5,
            borderRadius: 2,
            background: "currentColor",
            transform:
              open && line === 0
                ? "translateY(4.25px) rotate(45deg)"
                : open && line === 1
                  ? "scaleX(0)"
                  : open && line === 2
                    ? "translateY(-4.25px) rotate(-45deg)"
                    : "none",
            transition: "transform 160ms ease",
          }}
        />
      ))}
    </span>
  );
}

type DrawerLineItem = {
  label: string;
  onSelect: () => void;
  pressed?: boolean;
};

function DrawerLineMenu({
  label,
  items,
}: {
  label: string;
  items: DrawerLineItem[];
}) {
  const [focusedItem, setFocusedItem] = useState<number | null>(null);

  return (
    <nav aria-label={label}>
      <div
        style={{
          marginBottom: 5,
          paddingLeft: 27,
          color: "#9fc5b7",
          fontSize: 8,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 2,
        }}
      >
        {items.map((item, index) => {
          const emphasized = item.pressed || focusedItem === index;

          return (
            <li key={item.label} style={{ position: "relative" }}>
              <button
                type="button"
                aria-pressed={
                  typeof item.pressed === "boolean" ? item.pressed : undefined
                }
                onClick={item.onSelect}
                onPointerEnter={() => setFocusedItem(index)}
                onPointerLeave={() => setFocusedItem(null)}
                onPointerDown={() => setFocusedItem(index)}
                onFocus={() => setFocusedItem(index)}
                onBlur={() => setFocusedItem(null)}
                style={{
                  width: "100%",
                  minHeight: 28,
                  padding: 0,
                  border: 0,
                  borderRadius: 0,
                  background: "transparent",
                  color: emphasized ? "#ffe082" : "#c8ddd5",
                  display: "grid",
                  gridTemplateColumns: "23px minmax(0, 1fr)",
                  alignItems: "center",
                  textAlign: "left",
                  font: "inherit",
                  fontSize: 10,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "block",
                    width: emphasized ? 21 : 13,
                    height: 1,
                    borderRadius: 999,
                    background: emphasized
                      ? "#ffe082"
                      : "rgba(190, 221, 209, 0.48)",
                    boxShadow: emphasized
                      ? "0 0 8px rgba(255, 224, 130, 0.5)"
                      : "none",
                    transformOrigin: "left center",
                    transition:
                      "width 150ms ease, background-color 150ms ease, box-shadow 150ms ease",
                  }}
                />
                <span
                  style={{
                    display: "block",
                    minWidth: 0,
                    lineHeight: 1.15,
                    transform: emphasized ? "translateX(4px)" : "none",
                    transition: "transform 150ms ease, color 150ms ease",
                  }}
                >
                  {item.label}
                </span>
              </button>
              {index < items.length - 1 ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: -1,
                    width: 7,
                    height: 1,
                    background: "rgba(190, 221, 209, 0.24)",
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const GOAT_COACH_STYLES = `
  .goat-coach__speech {
    position: relative;
    isolation: isolate;
    min-width: 0;
    align-self: center;
    padding: 8px 13px 6px 11px;
    backdrop-filter: blur(16px) saturate(115%);
    -webkit-backdrop-filter: blur(16px) saturate(115%);
    box-sizing: border-box;
    pointer-events: none;
  }

  .goat-coach__speech-shape {
    position: absolute;
    z-index: -1;
    inset: 0 auto 0 0;
    width: calc(100% + 28px);
    height: 100%;
    overflow: visible;
    filter:
      drop-shadow(0 8px 11px rgba(0, 0, 0, 0.16))
      drop-shadow(0 1px 0 rgba(255, 255, 255, 0.08));
  }

  .goat-coach__tip-label {
    position: absolute;
    top: -7px;
    left: 12px;
    padding: 2px 7px 1px;
    border: 1px solid rgba(255, 224, 130, 0.4);
    border-radius: 999px 999px 999px 6px;
    background: rgba(12, 91, 59, 0.92);
    box-shadow:
      0 3px 8px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.14);
    color: #ffe082;
    font-size: 5.5px;
    font-weight: 750;
    letter-spacing: 0.08em;
  }

  .goat-coach {
    position: relative;
    width: 98px;
    height: 92px;
    align-self: end;
    justify-self: center;
    pointer-events: none;
  }

  .goat-coach__float {
    position: absolute;
    inset: 0;
    transform-origin: 50% 78%;
    animation: goat-coach-float 3.8s steps(4, end) infinite;
  }

  .goat-coach__reaction {
    position: absolute;
    inset: 0;
    transform-origin: 50% 82%;
  }

  .goat-coach__reaction--inspect {
    animation: goat-coach-inspect 520ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .goat-coach__reaction--encourage {
    animation: goat-coach-encourage 620ms ease-in-out;
  }

  .goat-coach__reaction--celebrate {
    animation: goat-coach-celebrate 820ms cubic-bezier(0.2, 0.85, 0.3, 1);
  }

  .goat-coach__image {
    position: absolute;
    right: 4px;
    bottom: 0;
    display: block;
    width: 90px;
    height: 90px;
    object-fit: contain;
    image-rendering: auto;
    filter: drop-shadow(0 5px 5px rgba(0, 0, 0, 0.24));
    user-select: none;
  }

  .goat-coach__lid {
    position: absolute;
    z-index: 3;
    top: 36px;
    width: 14px;
    height: 13px;
    border-radius: 52% 52% 46% 46%;
    border-bottom: 1.5px solid #242122;
    background: #fbfbf8;
    opacity: 0;
    transform: scaleY(0.12);
    transform-origin: center 58%;
    animation: goat-coach-blink 5.8s steps(1, end) infinite;
  }

  .goat-coach__lid--left {
    left: 30px;
  }

  .goat-coach__lid--right {
    left: 53px;
  }

  .goat-coach__spark {
    position: absolute;
    z-index: 4;
    width: 6px;
    height: 6px;
    background: #ffe082;
    clip-path: polygon(50% 0, 63% 37%, 100% 50%, 63% 63%, 50% 100%, 37% 63%, 0 50%, 37% 37%);
    opacity: 0;
    filter: drop-shadow(0 0 3px rgba(255, 224, 130, 0.8));
  }

  .goat-coach__spark--left {
    top: 23px;
    left: 10px;
  }

  .goat-coach__spark--right {
    top: 10px;
    right: 5px;
    width: 5px;
    height: 5px;
  }

  .goat-coach__spark--top {
    top: 1px;
    left: 46px;
    width: 4px;
    height: 4px;
  }

  .goat-coach__reaction--celebrate .goat-coach__spark {
    animation: goat-coach-spark 700ms ease-out both;
  }

  .goat-coach__reaction--celebrate .goat-coach__spark--right {
    animation-delay: 70ms;
  }

  .goat-coach__reaction--celebrate .goat-coach__spark--top {
    animation-delay: 130ms;
  }

  .goat-coach__tile {
    position: absolute;
    z-index: 2;
    left: 50%;
    bottom: -42px;
    width: 42px;
    height: 58px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.78);
    border-radius: 4px;
    overflow: hidden;
    background: #13523d;
    box-shadow:
      0 0 0 2px rgba(255, 225, 128, 0.72),
      0 0 13px rgba(255, 214, 92, 0.68);
    cursor: pointer;
    pointer-events: auto;
    transform: translateX(-50%) rotate(1deg);
    transform-origin: 50% 80%;
    transition: transform 140ms ease, box-shadow 140ms ease;
  }

  .goat-coach__tile:hover,
  .goat-coach__tile:focus-visible {
    outline: none;
    transform: translateX(-50%) translateY(-2px) rotate(0) scale(1.06);
  }

  .goat-coach__tile--selected {
    transform: translateX(-50%) translateY(-3px) rotate(0) scale(1.12);
    box-shadow:
      0 0 0 3px rgba(255, 225, 128, 0.78),
      0 0 17px rgba(255, 214, 92, 0.82);
  }

  .goat-coach__tile:disabled {
    cursor: default;
  }

  @keyframes goat-coach-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  @keyframes goat-coach-blink {
    0%, 40%, 43.2%, 45.6%, 100% {
      opacity: 0;
      transform: scaleY(0.12);
    }
    40.6%, 42.3%, 44%, 45% {
      opacity: 1;
      transform: scaleY(1);
    }
  }

  @keyframes goat-coach-inspect {
    0%, 100% { transform: translateY(0) rotate(0); }
    38% { transform: translateY(-4px) rotate(-2.5deg); }
    68% { transform: translateY(-2px) rotate(2deg); }
  }

  @keyframes goat-coach-encourage {
    0%, 100% { transform: translateY(0) rotate(0); }
    28% { transform: translateY(2px) rotate(-1.5deg); }
    52% { transform: translateY(-2px) rotate(1.5deg); }
    76% { transform: translateY(1px) rotate(-0.5deg); }
  }

  @keyframes goat-coach-celebrate {
    0%, 100% { transform: translateY(0) rotate(0) scale(1); }
    28% { transform: translateY(-11px) rotate(-3deg) scale(1.045); }
    49% { transform: translateY(-8px) rotate(3deg) scale(1.04); }
    72% { transform: translateY(-3px) rotate(-1deg) scale(1.015); }
  }

  @keyframes goat-coach-spark {
    0% { opacity: 0; transform: translateY(5px) scale(0.3) rotate(0); }
    35% { opacity: 1; transform: translateY(-3px) scale(1) rotate(45deg); }
    100% { opacity: 0; transform: translateY(-9px) scale(0.55) rotate(90deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .goat-coach__float {
      animation: none;
    }

    .goat-coach__reaction,
    .goat-coach__lid,
    .goat-coach__spark {
      animation: none !important;
    }

    .goat-coach__tile {
      transition: none;
    }
  }
`;

function GoatCoach({
  tile,
  selected,
  gameEnded,
  language,
  reaction,
  reactionSequence,
  onTileClick,
}: {
  tile: Tile | null;
  selected: boolean;
  gameEnded: boolean;
  language: Language;
  reaction: GoatReaction;
  reactionSequence: number;
  onTileClick: () => void;
}) {
  return (
    <div
      className="goat-coach"
      role="img"
      aria-label={
        language === "en"
          ? "Goat helper sharing the current hand analysis"
          : "現在の手牌分析を伝えるヤギのヘルパー"
      }
    >
      <style>{GOAT_COACH_STYLES}</style>
      <div className="goat-coach__float">
        <div
          key={reactionSequence}
          className={`goat-coach__reaction goat-coach__reaction--${reaction}`}
        >
          <img
            className="goat-coach__image"
            src="/mascot/mahjong-goat-concept-v2.png"
            alt=""
            draggable={false}
          />
          <span
            className="goat-coach__lid goat-coach__lid--left"
            aria-hidden="true"
          />
          <span
            className="goat-coach__lid goat-coach__lid--right"
            aria-hidden="true"
          />
          <span
            className="goat-coach__spark goat-coach__spark--left"
            aria-hidden="true"
          />
          <span
            className="goat-coach__spark goat-coach__spark--right"
            aria-hidden="true"
          />
          <span
            className="goat-coach__spark goat-coach__spark--top"
            aria-hidden="true"
          />
          {tile != null ? (
            <button
              type="button"
              className={`goat-coach__tile${selected ? " goat-coach__tile--selected" : ""}`}
              aria-label={
                language === "en"
                  ? `${TILE_LABELS[tile]}, newly drawn tile held by the goat`
                  : `ヤギが持っているツモ牌、${TILE_LABELS[tile]}`
              }
              disabled={gameEnded}
              onClick={onTileClick}
            >
              <MahjongTileFace tile={tile} compact />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CompactAnalysis({
  language,
  selectedTile,
  selectedUke,
  selectedWaitInfo,
  isMentsuShantenBack,
  lastReview,
  undoDiffMsg,
  resultMsg,
}: {
  language: Language;
  selectedTile: Tile | null;
  selectedUke: UkeireResult | null;
  selectedWaitInfo: { labels: string[]; total: number } | null;
  isMentsuShantenBack: boolean;
  lastReview: LastDiscardReview | null;
  undoDiffMsg: string;
  resultMsg: string;
}) {
  const english = language === "en";
  const hasAnalysis =
    Boolean(resultMsg) ||
    Boolean(undoDiffMsg) ||
    Boolean(selectedUke && selectedTile != null) ||
    Boolean(lastReview);
  const chipStyle = {
    padding: "2px 5px",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
  } as const;

  const actionLabel = selectedWaitInfo
    ? english
      ? `聴牌 waits: ${selectedWaitInfo.labels.join(" ")} · ${selectedWaitInfo.total}`
      : `聴牌・待ち ${selectedWaitInfo.labels.join(" ")} · ${selectedWaitInfo.total}枚`
    : english
      ? "Tap again to discard 打牌"
      : "もう一度タップで打牌";

  return (
    <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
      {!hasAnalysis ? (
        <div style={{ color: "#cce4db" }}>
          {english
            ? "Choose a tile and I’ll compare its acceptance (受け入れ)."
            : "牌を選ぶと、受け入れを比較するよ。"}
        </div>
      ) : null}
      {resultMsg ? (
        <div style={{ fontWeight: 700 }}>
          {english
            ? resultMsg === "聴牌"
              ? "Ready hand 聴牌"
              : "Draw 流局"
            : resultMsg}
        </div>
      ) : null}
      {undoDiffMsg ? (
        <div
          style={{
            color: "#bbe7d5",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {undoDiffMsg}
        </div>
      ) : null}
      {selectedUke && selectedTile != null ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <strong style={chipStyle}>
            {english ? "Tile 仮選択" : "仮選択牌"}: {TILE_LABELS[selectedTile]}
          </strong>
          <span style={chipStyle}>
            メンツ手 {selectedUke.mentsuKinds}
            {english ? " types" : "種"} · {selectedUke.mentsuCount}
            {english ? " tiles" : "枚"}
            {isMentsuShantenBack ? " ↑向聴" : ""}
          </span>
          <span style={chipStyle}>
            七対子 {selectedUke.chiitoiKinds}
            {english ? " types" : "種"} · {selectedUke.chiitoiCount}
            {english ? " tiles" : "枚"}
          </span>
          <span
            style={{
              color: "#bbe7d5",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {actionLabel}
          </span>
        </div>
      ) : null}
      {lastReview ? (
        <div
          style={{
            paddingTop: 3,
            borderTop: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#ffe082",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {english ? "Last 打牌" : "直前打牌"} {TILE_LABELS[lastReview.discard]}{" "}
          · {lastReview.mentsuKinds}
          {english ? " types" : "種"} / {lastReview.mentsuCount}
          {english ? " tiles" : "枚"} · Top{" "}
          {lastReview.top3
            .map((item) => `${TILE_LABELS[item.tile]} ${item.mCount}`)
            .join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

type SetupLineItem = {
  label: string;
  onSelect: () => void;
  active?: boolean;
  ariaControls?: string;
  ariaExpanded?: boolean;
};

const SETUP_SCREEN_STYLES = `
  .setup-screen {
    width: min(100%, 920px);
    min-height: var(--app-height, 100svh);
    margin: 0 auto;
    padding: max(14px, env(safe-area-inset-top))
      max(18px, env(safe-area-inset-right))
      max(18px, env(safe-area-inset-bottom))
      max(18px, env(safe-area-inset-left));
    box-sizing: border-box;
    color: #f5f5f5;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI",
      sans-serif;
  }

  .setup-header {
    min-height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border-bottom: 1px solid rgba(190, 221, 209, 0.26);
  }

  .setup-brand {
    min-width: 0;
  }

  .setup-eyebrow,
  .setup-kicker,
  .setup-section-label {
    color: #9fc5b7;
    font-size: 9px;
    font-weight: 650;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .setup-brand h1 {
    margin: 3px 0 0;
    font-size: 21px;
    line-height: 1.05;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .setup-language {
    display: flex;
    align-items: center;
    gap: 13px;
    flex: 0 0 auto;
  }

  .setup-language button,
  .setup-back {
    appearance: none;
    border: 0;
    border-radius: 0;
    padding: 5px 0;
    background: transparent;
    color: #b9d1c8;
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  .setup-language button {
    display: inline-grid;
    grid-template-columns: 15px auto;
    align-items: center;
    gap: 5px;
  }

  .setup-language button::before,
  .setup-back::before {
    content: "";
    display: block;
    width: 8px;
    height: 1px;
    background: rgba(190, 221, 209, 0.46);
    transition: width 150ms ease, background-color 150ms ease,
      box-shadow 150ms ease;
  }

  .setup-language button[aria-pressed="true"],
  .setup-language button:hover,
  .setup-language button:focus-visible,
  .setup-back:hover,
  .setup-back:focus-visible {
    color: #ffe082;
    outline: none;
  }

  .setup-language button[aria-pressed="true"]::before,
  .setup-language button:hover::before,
  .setup-language button:focus-visible::before,
  .setup-back:hover::before,
  .setup-back:focus-visible::before {
    width: 15px;
    background: #ffe082;
    box-shadow: 0 0 8px rgba(255, 224, 130, 0.45);
  }

  .setup-main {
    padding-top: 24px;
  }

  .setup-intro {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 22px;
  }

  .setup-intro-copy {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .setup-step {
    width: 42px;
    height: 42px;
    border: 1px solid rgba(190, 221, 209, 0.38);
    border-radius: 50%;
    color: #ffe082;
    display: grid;
    place-items: center;
    font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .setup-intro h2 {
    margin: 3px 0 0;
    font-size: 20px;
    line-height: 1.1;
  }

  .setup-back {
    display: inline-grid;
    grid-template-columns: 18px auto;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .setup-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .setup-line-item {
    border-top: 1px solid rgba(190, 221, 209, 0.18);
  }

  .setup-line-item:last-child {
    border-bottom: 1px solid rgba(190, 221, 209, 0.18);
  }

  .setup-line-button {
    width: 100%;
    min-height: 48px;
    appearance: none;
    border: 0;
    border-radius: 0;
    padding: 0 2px;
    background: transparent;
    color: #d5e5df;
    display: grid;
    grid-template-columns: 28px 34px minmax(0, 1fr) 18px;
    align-items: center;
    text-align: left;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .setup-line-index {
    color: rgba(190, 221, 209, 0.52);
    font: 9px ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .setup-line-marker {
    width: 17px;
    height: 1px;
    border-radius: 999px;
    background: rgba(190, 221, 209, 0.5);
    transform-origin: left center;
    transition: width 160ms ease, background-color 160ms ease,
      box-shadow 160ms ease;
  }

  .setup-line-label {
    min-width: 0;
    font-size: 15px;
    font-weight: 620;
    line-height: 1.1;
    transition: color 160ms ease, transform 160ms ease;
  }

  .setup-line-arrow {
    color: rgba(190, 221, 209, 0.38);
    opacity: 0;
    transform: translateX(-5px);
    transition: color 160ms ease, opacity 160ms ease, transform 160ms ease;
  }

  .setup-line-button:hover,
  .setup-line-button:focus-visible,
  .setup-line-button:active,
  .setup-line-button[aria-pressed="true"] {
    color: #ffe082;
    outline: none;
  }

  .setup-line-button:hover .setup-line-marker,
  .setup-line-button:focus-visible .setup-line-marker,
  .setup-line-button:active .setup-line-marker,
  .setup-line-button[aria-pressed="true"] .setup-line-marker {
    width: 31px;
    background: #ffe082;
    box-shadow: 0 0 9px rgba(255, 224, 130, 0.48);
  }

  .setup-line-button:hover .setup-line-label,
  .setup-line-button:focus-visible .setup-line-label,
  .setup-line-button:active .setup-line-label,
  .setup-line-button[aria-pressed="true"] .setup-line-label {
    transform: translateX(5px);
  }

  .setup-line-button:hover .setup-line-arrow,
  .setup-line-button:focus-visible .setup-line-arrow,
  .setup-line-button:active .setup-line-arrow,
  .setup-line-button[aria-pressed="true"] .setup-line-arrow {
    color: #ffe082;
    opacity: 1;
    transform: translateX(0);
  }

  .setup-rule-list {
    width: min(100%, 620px);
  }

  .setup-section-label {
    margin: 0 0 7px 62px;
  }

  .setup-difficulty-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .setup-difficulty-menu {
    width: min(100%, 620px);
  }

  .setup-difficulty-layout--expert .setup-difficulty-menu {
    width: 100%;
  }

  .setup-expert-panel {
    min-width: 0;
    padding-left: 18px;
    border-left: 1px solid rgba(255, 224, 130, 0.3);
    animation: setup-expert-reveal 180ms ease-out both;
  }

  .setup-expert-note {
    margin: -1px 0 7px 62px;
    color: #ffe082;
    font-size: 9px;
    letter-spacing: 0.04em;
  }

  @keyframes setup-expert-reveal {
    from {
      opacity: 0;
      transform: translateX(-6px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @media (orientation: landscape) and (max-height: 500px),
    (orientation: portrait) and (max-width: 1024px) {
    .setup-screen {
      height: var(--app-height, 100svh);
      padding-top: max(7px, env(safe-area-inset-top));
      padding-bottom: max(10px, env(safe-area-inset-bottom));
      overflow-y: auto;
    }

    .setup-header {
      min-height: 40px;
    }

    .setup-eyebrow {
      font-size: 7px;
    }

    .setup-brand h1 {
      margin-top: 1px;
      font-size: 15px;
    }

    .setup-main {
      padding-top: 9px;
    }

    .setup-intro {
      margin-bottom: 9px;
    }

    .setup-intro-copy {
      grid-template-columns: 32px minmax(0, 1fr);
      gap: 9px;
    }

    .setup-step {
      width: 30px;
      height: 30px;
      font-size: 8px;
    }

    .setup-kicker,
    .setup-section-label {
      font-size: 7px;
    }

    .setup-intro h2 {
      margin-top: 1px;
      font-size: 15px;
    }

    .setup-line-button {
      min-height: 42px;
      grid-template-columns: 24px 30px minmax(0, 1fr) 16px;
    }

    .setup-line-label {
      font-size: 12px;
    }

    .setup-section-label {
      margin: 0 0 4px 54px;
    }

    .setup-difficulty-layout--expert {
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.7fr);
      gap: 28px;
    }

    .setup-difficulty-layout--expert .setup-line-button {
      min-height: 31px;
    }

    .setup-difficulty-layout--expert .setup-line-label {
      font-size: 10px;
    }

    .setup-expert-panel {
      padding-left: 0;
    }

    .setup-expert-note {
      margin: -1px 0 4px 54px;
      font-size: 7px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .setup-expert-panel {
      animation: none;
    }
  }
`;

function SetupLineMenu({
  label,
  items,
  className,
  id,
}: {
  label: string;
  items: SetupLineItem[];
  className?: string;
  id?: string;
}) {
  return (
    <nav id={id} className={className} aria-label={label}>
      <div className="setup-section-label">{label}</div>
      <ol className="setup-list">
        {items.map((item, index) => (
          <li className="setup-line-item" key={item.label}>
            <button
              className="setup-line-button"
              type="button"
              onClick={item.onSelect}
              aria-pressed={item.active}
              aria-controls={item.ariaControls}
              aria-expanded={item.ariaExpanded}
            >
              <span className="setup-line-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="setup-line-marker" aria-hidden="true" />
              <span className="setup-line-label">{item.label}</span>
              <span className="setup-line-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SetupLanguageSelector({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="setup-language" role="group" aria-label="Language / 言語">
      <button
        type="button"
        aria-pressed={language === "en"}
        onClick={() => onChange("en")}
      >
        English
      </button>
      <button
        type="button"
        aria-pressed={language === "ja"}
        onClick={() => onChange("ja")}
      >
        日本語
      </button>
    </div>
  );
}

function SetupScreen({
  language,
  onLanguageChange,
  children,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
  children: React.ReactNode;
}) {
  return (
    <main className="setup-screen">
      <style>{SETUP_SCREEN_STYLES}</style>
      <header className="setup-header">
        <div className="setup-brand">
          <div className="setup-eyebrow">Mahjong efficiency · 牌効率</div>
          <h1>
            {language === "en" ? "Mahjong 牌効率 Trainer" : "麻雀 牌効率ゲーム"}
          </h1>
        </div>
        <SetupLanguageSelector
          language={language}
          onChange={onLanguageChange}
        />
      </header>
      <div className="setup-main">{children}</div>
    </main>
  );
}

function createGameState(ruleSet: RuleSet, mode: Mode): GameState {
  const fromRandomDeal = (wallFactory: () => Tile[] = makeWall): GameState => {
    const w = wallFactory();
    const hand13 = w.splice(w.length - 13, 13).sort(sortTiles);
    const draw = w.pop();
    return {
      wall: w,
      hand13,
      drawTile: draw ?? null,
      river: [],
      turn: 1,
      resultMsg: "",
      gameEnded: false,
      lastReview: null,
    };
  };

  const wallFactory = ruleSet === "sanma" ? makeSanmaWall : makeWall;

  const matchesMode = (fullHand: Tile[]): boolean => {
    const m = classifyMentsuStructure(fullHand);
    const minShanten = Math.min(
      shantenMentsu(fullHand),
      shantenChiitoi(fullHand),
    );
    if (mode === "twoShanten") return minShanten === 2;
    if (mode === "fiveBlockWithPair") return m.blocks === 5 && m.hasPair;
    // 合意仕様: 「4ブロック雀頭あり」はシャンテン固定せず、形条件のみで開始する
    if (mode === "fourBlockWithPair") return m.blocks === 4 && m.hasPair;
    if (mode === "fiveBlockNoPair") return m.strictNoPair5Block;
    if (mode === "twoShantenFiveBlock")
      return m.shantenMentsuOnly === 2 && m.blocks === 5 && m.hasPair;
    if (mode === "twoShantenFourBlock")
      return m.shantenMentsuOnly === 2 && m.blocks === 4 && m.hasPair;
    if (mode === "twoShantenNoPair")
      return m.shantenMentsuOnly === 2 && !m.hasPair;
    return true;
  };

  if (mode === "random") return fromRandomDeal(wallFactory);
  if (mode === "fiveBlockNoPair") {
    const hand14 =
      ruleSet === "sanma"
        ? generateSanmaFiveBlockNoPairHand()
        : generateFiveBlockNoPairHand();
    const wall = wallFactory();

    for (const t of hand14) {
      const ix = wall.indexOf(t);
      if (ix >= 0) wall.splice(ix, 1);
    }
    const shuffled = [...hand14].sort(() => Math.random() - 0.5);
    const draw = shuffled.pop() ?? null;
    const hand13 = shuffled.sort(sortTiles);
    return {
      wall,
      hand13,
      drawTile: draw,
      river: [],
      turn: 1,
      resultMsg: "",
      gameEnded: false,
      lastReview: null,
    };
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
    if (discard % 9 <= 6 && c[discard + 1] > 0 && c[discard + 2] > 0)
      return true;
    if (
      discard % 9 >= 1 &&
      discard % 9 <= 7 &&
      c[discard - 1] > 0 &&
      c[discard + 1] > 0
    )
      return true;
    if (discard % 9 >= 2 && c[discard - 1] > 0 && c[discard - 2] > 0)
      return true;
  }
  return false;
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [ruleSet, setRuleSet] = useState<RuleSet | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  if (ruleSet == null) {
    return (
      <SetupScreen language={language} onLanguageChange={setLanguage}>
        <section className="setup-intro">
          <div className="setup-intro-copy">
            <div className="setup-step">01</div>
            <div>
              <div className="setup-kicker">
                {language === "en" ? "Table rules · ルール" : "ルール · Rules"}
              </div>
              <h2>
                {language === "en" ? "Choose your table" : "ルールを選択"}
              </h2>
            </div>
          </div>
        </section>
        <div className="setup-rule-list">
          <SetupLineMenu
            label={language === "en" ? "Players / 人数" : "人数 / Players"}
            items={[
              {
                label: ruleSetLabel("yonma", language),
                onSelect: () => setRuleSet("yonma"),
              },
              {
                label: ruleSetLabel("sanma", language),
                onSelect: () => setRuleSet("sanma"),
              },
            ]}
          />
        </div>
      </SetupScreen>
    );
  }

  if (mode == null) {
    return (
      <SetupScreen language={language} onLanguageChange={setLanguage}>
        <section className="setup-intro">
          <div className="setup-intro-copy">
            <div className="setup-step">02</div>
            <div>
              <div className="setup-kicker">
                {ruleSetLabel(ruleSet, language)}
              </div>
              <h2>{language === "en" ? "Choose a drill" : "モードを選択"}</h2>
            </div>
          </div>
          <button
            type="button"
            className="setup-back"
            onClick={() => {
              setDifficulty(null);
              setRuleSet(null);
            }}
          >
            {language === "en" ? "Back to rules" : "ルール選択へ戻る"}
          </button>
        </section>
        <div
          className={`setup-difficulty-layout${
            difficulty === "expert" ? " setup-difficulty-layout--expert" : ""
          }`}
        >
          <SetupLineMenu
            className="setup-difficulty-menu"
            label={
              language === "en" ? "Difficulty / 難易度" : "難易度 / Difficulty"
            }
            items={[
              {
                label:
                  language === "en"
                    ? "Easy · Standard Deal (通常配牌)"
                    : "初級 · 通常配牌",
                active: difficulty === "easy",
                onSelect: () => {
                  setDifficulty("easy");
                  setMode("random");
                },
              },
              {
                label:
                  language === "en"
                    ? "Medium · Two-away (二向聴)"
                    : "中級 · 二向聴チャレンジ",
                active: difficulty === "medium",
                onSelect: () => {
                  setDifficulty("medium");
                  setMode("twoShanten");
                },
              },
              {
                label:
                  language === "en"
                    ? "Expert · Shape Drills (牌姿別)"
                    : "上級 · 牌姿別ドリル",
                active: difficulty === "expert",
                ariaControls: "expert-drill-menu",
                ariaExpanded: difficulty === "expert",
                onSelect: () => setDifficulty("expert"),
              },
            ]}
          />
          {difficulty === "expert" ? (
            <div className="setup-expert-panel">
              <div className="setup-expert-note">
                {language === "en"
                  ? "Choose one required drill"
                  : "ドリルを1つ選択してください（必須）"}
              </div>
              <SetupLineMenu
                id="expert-drill-menu"
                label={
                  language === "en"
                    ? "Expert drill / 上級課題"
                    : "上級課題 / Expert drill"
                }
                items={ADVANCED_MODES.map((item) => ({
                  label: modeLabel(item, language),
                  onSelect: () => setMode(item),
                }))}
              />
            </div>
          ) : null}
        </div>
      </SetupScreen>
    );
  }
  return (
    <GameScreen
      ruleSet={ruleSet}
      mode={mode}
      language={language}
      onLanguageChange={setLanguage}
      onBackToMenu={() => setMode(null)}
    />
  );
}

function GameScreen({
  ruleSet,
  mode,
  language,
  onLanguageChange,
  onBackToMenu,
}: {
  ruleSet: RuleSet;
  mode: Mode;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onBackToMenu: () => void;
}) {
  const english = language === "en";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [current, setCurrent] = useState<GameState>(() =>
    createGameState(ruleSet, mode),
  );
  const [undoStack, setUndoStack] = useState<
    Array<{ state: GameState; stats: Stats }>
  >([]);
  const [redoStack, setRedoStack] = useState<
    Array<{ state: GameState; stats: Stats }>
  >([]);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedUke, setSelectedUke] = useState<UkeireResult | null>(null);
  const [selectedWaitInfo, setSelectedWaitInfo] = useState<{
    labels: string[];
    total: number;
  } | null>(null);
  const [undoDiffMsg, setUndoDiffMsg] = useState("");
  const [stats, setStats] = useState<Stats>({
    totalGames: 0,
    wins: 0,
    goodMoves: 0,
    totalMoves: 0,
  });
  const [goatMotion, setGoatMotion] = useState<{
    reaction: GoatReaction;
    sequence: number;
  }>({
    reaction: "idle",
    sequence: 0,
  });

  const isPortraitDevice =
    typeof window !== "undefined" &&
    window.innerWidth < window.innerHeight &&
    window.innerWidth <= 1024;
  const isMini =
    typeof window !== "undefined" &&
    (isPortraitDevice || window.innerHeight <= 740);
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;
  const isLandscapeMobile =
    typeof window !== "undefined" &&
    (window.innerWidth > window.innerHeight ||
      window.innerWidth >= 600 ||
      isPortraitDevice);

  const {
    wall,
    hand13,
    drawTile,
    river,
    turn,
    resultMsg,
    gameEnded,
    lastReview,
  } = current;
  const fullHand = useMemo(() => {
    const b = [...hand13];
    if (drawTile != null) b.push(drawTile);
    return b;
  }, [hand13, drawTile]);
  const shantenM = useMemo(() => shantenMentsu(fullHand), [fullHand]);
  const shantenC = useMemo(
    () => (isAdvancedMode(mode) ? null : shantenChiitoi(fullHand)),
    [fullHand, mode],
  );
  const goodRate = stats.totalMoves
    ? Math.round((stats.goodMoves / stats.totalMoves) * 100)
    : 0;
  const selectedNext13 =
    selectedIdx != null
      ? handWithoutIndex(fullHand, selectedIdx).sort(sortTiles)
      : null;
  const previewShantenM = selectedNext13
    ? shantenMentsu(selectedNext13)
    : shantenM;
  const previewShantenC =
    shantenC == null
      ? null
      : selectedNext13
        ? shantenChiitoi(selectedNext13)
        : shantenC;
  const isMentsuShantenBack = selectedIdx != null && previewShantenM > shantenM;
  const shantenCLabel =
    previewShantenC == null
      ? "---"
      : selectedIdx != null
        ? `${shantenC} → ${previewShantenC}`
        : String(shantenC);

  const resetSelections = () => {
    setSelectedIdx(null);
    setSelectedUke(null);
    setSelectedWaitInfo(null);
  };

  const triggerGoatReaction = (reaction: GoatReaction) => {
    setGoatMotion((previous) => ({
      reaction,
      sequence: previous.sequence + 1,
    }));
  };

  const startNextGame = () => {
    setCurrent(createGameState(ruleSet, mode));
    setUndoStack([]);
    setRedoStack([]);
    resetSelections();
    setUndoDiffMsg("");
    triggerGoatReaction("idle");
  };
  const calcWaitInfoForDiscard = (hand14: Tile[], discardIdx: number) => {
    const next13 = handWithoutIndex(hand14, discardIdx).sort(sortTiles);
    const waits: Tile[] = [];
    for (let t = 0; t < 34; t++)
      if (isWinningHand([...next13, t])) waits.push(t);
    if (waits.length === 0) return null;
    const counts = Array(34).fill(0);
    for (const t of next13) counts[t]++;
    let total = 0;
    for (const t of waits) total += Math.max(0, 4 - counts[t]);
    return { labels: waits.map((t) => TILE_LABELS[t]), total };
  };

  const onUndo = () => {
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    const nowLast = current.river[current.river.length - 1];
    const prevLast = prev.state.river[prev.state.river.length - 1];
    setUndoDiffMsg(
      nowLast == null
        ? ""
        : english
          ? `Undo: discard (打牌) ${TILE_LABELS[nowLast]} → ${prevLast == null ? "before discard" : TILE_LABELS[prevLast]}`
          : `Undo差分: 打牌 ${TILE_LABELS[nowLast]} → ${prevLast == null ? "（打牌前）" : TILE_LABELS[prevLast]}`,
    );
    setRedoStack((r) => [...r, { state: current, stats }]);
    setUndoStack((u) => u.slice(0, -1));
    setCurrent(prev.state);
    setStats(prev.stats);
    resetSelections();
  };
  const onRedo = () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, { state: current, stats }]);
    setRedoStack((r) => r.slice(0, -1));
    setCurrent(next.state);
    setStats(next.stats);
    setUndoDiffMsg("");
    resetSelections();
  };

  const onTileClick = (idx: number) => {
    if (gameEnded) return;
    if (selectedIdx !== idx) {
      setSelectedIdx(idx);
      setSelectedUke(calcUkeireForDiscard(fullHand, idx));
      setSelectedWaitInfo(calcWaitInfoForDiscard(fullHand, idx));
      triggerGoatReaction("inspect");
      return;
    }

    let bestScore = -Infinity;
    let currentScore = -Infinity;
    const all: ReviewItem[] = [];
    for (let i = 0; i < fullHand.length; i++) {
      const discard = fullHand[i];
      const base13 = handWithoutIndex(fullHand, i).sort(sortTiles);
      const r = calcUkeireForDiscard(fullHand, i);
      const nextShanten = shantenMentsu(base13);
      const breaksMeld = breaksCompletedMeldShape(base13, discard);
      const score =
        -(nextShanten * 10000) +
        r.mentsuCount * 100 +
        r.mentsuKinds * 10 -
        (breaksMeld ? 25 : 0);
      if (score > bestScore) bestScore = score;
      if (i === idx) currentScore = score;
      all.push({
        tile: discard,
        mKinds: r.mentsuKinds,
        mCount: r.mentsuCount,
        nextShanten,
        score,
      });
    }

    const isGoodMove = currentScore >= bestScore;
    setStats((s) => ({
      ...s,
      totalMoves: s.totalMoves + 1,
      goodMoves: s.goodMoves + (isGoodMove ? 1 : 0),
    }));

    const discard = fullHand[idx];
    const next13 = handWithoutIndex(fullHand, idx).sort(sortTiles);
    const reachesTenpai =
      shantenMentsu(next13) === 0 || shantenChiitoi(next13) === 0;
    triggerGoatReaction(
      reachesTenpai || isGoodMove ? "celebrate" : "encourage",
    );
    const nextState: GameState = {
      ...current,
      river: [...river, discard],
      hand13: next13,
      drawTile: null,
    };

    const top3 = [...all]
      .sort(
        (a, b) =>
          b.score - a.score || b.mCount - a.mCount || b.mKinds - a.mKinds,
      )
      .slice(0, 3);
    const cur = calcUkeireForDiscard(fullHand, idx);
    nextState.lastReview = {
      discard,
      mentsuKinds: cur.mentsuKinds,
      mentsuCount: cur.mentsuCount,
      top3,
    };

    if (reachesTenpai) {
      nextState.resultMsg = "聴牌";
      nextState.gameEnded = true;
      setStats((st) => ({
        ...st,
        totalGames: st.totalGames + 1,
        wins: st.wins + 1,
      }));
      setUndoStack((u) => [...u, { state: current, stats }]);
      setRedoStack([]);
      setCurrent(nextState);
      setUndoDiffMsg("");
      resetSelections();
      return;
    }

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
        nextState.drawTile = draw;
        nextState.turn = turn + 1;
      }
    }
    setUndoStack((u) => [...u, { state: current, stats }]);
    setRedoStack([]);
    setCurrent(nextState);
    setUndoDiffMsg("");
    resetSelections();
  };

  return (
    <>
      {isLandscapeMobile ? (
        <aside
          aria-label={english ? "Game menu" : "ゲームメニュー"}
          aria-hidden={!isMenuOpen}
          style={{
            position: "fixed",
            inset: 0,
            right: "auto",
            width: 136,
            paddingTop: "max(10px, env(safe-area-inset-top))",
            paddingBottom: "max(10px, env(safe-area-inset-bottom))",
            paddingLeft: "max(10px, env(safe-area-inset-left))",
            paddingRight: 10,
            boxSizing: "border-box",
            zIndex: 10,
            color: "#f5f5f5",
            background: "rgba(18, 35, 30, 0.58)",
            borderRight: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "12px 0 30px rgba(0, 0, 0, 0.24)",
            backdropFilter: "blur(18px) saturate(110%)",
            WebkitBackdropFilter: "blur(18px) saturate(110%)",
            transform: isMenuOpen ? "translateX(0)" : "translateX(-105%)",
            visibility: isMenuOpen ? "visible" : "hidden",
            pointerEvents: isMenuOpen ? "auto" : "none",
            transition: isMenuOpen
              ? "transform 180ms ease"
              : "transform 180ms ease, visibility 0s linear 180ms",
            fontFamily: "sans-serif",
          }}
        >
          <button
            type="button"
            aria-label={english ? "Close menu" : "メニューを閉じる"}
            onClick={() => setIsMenuOpen(false)}
            style={{
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: "50%",
              border: "1px solid rgba(255, 255, 255, 0.42)",
              color: "#f5f5f5",
              background: "rgba(255, 255, 255, 0.1)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <HamburgerIcon open />
          </button>
          <div
            style={{
              marginTop: 13,
              display: "grid",
              gap: 11,
            }}
          >
            <DrawerLineMenu
              label={english ? "Language / 言語" : "言語 / Language"}
              items={[
                {
                  label: "English",
                  pressed: language === "en",
                  onSelect: () => onLanguageChange("en"),
                },
                {
                  label: "日本語",
                  pressed: language === "ja",
                  onSelect: () => onLanguageChange("ja"),
                },
              ]}
            />
            <DrawerLineMenu
              label={english ? "Game / 対局" : "対局 / Game"}
              items={[
                {
                  label: english ? "Mode menu" : "モード選択",
                  onSelect: () => {
                    setIsMenuOpen(false);
                    onBackToMenu();
                  },
                },
                {
                  label: english ? "New game" : "新しいゲーム",
                  onSelect: () => {
                    setIsMenuOpen(false);
                    startNextGame();
                  },
                },
              ]}
            />
          </div>
        </aside>
      ) : null}
      <main
        style={{
          maxWidth: 920,
          width: isLandscapeMobile ? "100%" : undefined,
          margin: isLandscapeMobile ? "0 auto" : "4px auto",
          fontFamily: "sans-serif",
          padding: isLandscapeMobile ? 0 : "0 6px",
          paddingLeft: isLandscapeMobile
            ? "max(10px, env(safe-area-inset-left))"
            : undefined,
          paddingRight: isLandscapeMobile
            ? "max(10px, env(safe-area-inset-right))"
            : undefined,
          color: "#f5f5f5",
          minHeight: "var(--app-height, 100svh)",
          height: "var(--app-height, 100svh)",
          paddingBottom: isLandscapeMobile
            ? "max(env(safe-area-inset-bottom), 18px)"
            : "env(safe-area-inset-bottom)",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateRows: isLandscapeMobile
            ? "auto 46px auto minmax(76px, 1fr) 40px"
            : "auto auto auto auto auto",
          gap: isLandscapeMobile ? 2 : 3,
          overflow: "hidden",
          position: "relative",
          transform:
            isLandscapeMobile && isMenuOpen ? "translateX(104px)" : "none",
          transition: "transform 180ms ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1
            style={{
              margin: isLandscapeMobile ? "2px 0" : undefined,
              marginBottom: 0,
              fontSize: isDesktop
                ? 22
                : isLandscapeMobile
                  ? 12
                  : isMini
                    ? 14
                    : 16,
              whiteSpace: isLandscapeMobile ? "nowrap" : undefined,
              overflow: isLandscapeMobile ? "hidden" : undefined,
              textOverflow: isLandscapeMobile ? "ellipsis" : undefined,
              flex: isLandscapeMobile ? "1 1 auto" : undefined,
              minWidth: isLandscapeMobile ? 0 : undefined,
            }}
          >
            {isLandscapeMobile
              ? `${english ? "牌効率 Trainer" : "牌効率ゲーム"} • ${ruleSet === "yonma" ? "四麻" : "三麻"} • ${modeLabel(mode, language)}`
              : `${english ? "Mahjong 牌効率 Trainer" : "麻雀 牌効率ゲーム"}（${ruleSetLabel(ruleSet, language)} / ${modeLabel(mode, language)}）`}
          </h1>
          {!isLandscapeMobile ? (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <LanguageSelector
                language={language}
                onChange={onLanguageChange}
              />
              <>
                <button
                  onClick={onBackToMenu}
                  style={{
                    padding: "4px 8px",
                    fontSize: isDesktop ? 14 : 11,
                  }}
                >
                  Menu
                </button>
                <button
                  onClick={startNextGame}
                  style={{
                    padding: isDesktop ? "6px 10px" : "4px 8px",
                    fontSize: isDesktop ? 14 : 11,
                  }}
                >
                  New Game
                </button>
              </>
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 6,
            alignItems: "start",
            minHeight: isDesktop
              ? 120
              : isLandscapeMobile
                ? 46
                : isMini
                  ? 68
                  : 78,
          }}
        >
          <River
            river={river}
            language={language}
            fixedHeight={
              isDesktop ? 180 : isLandscapeMobile ? 42 : isMini ? 62 : 74
            }
            compact
            desktop={isDesktop}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              alignItems: "flex-end",
              paddingTop: isLandscapeMobile ? 1 : isMini ? 8 : 10,
            }}
          >
            <HistoryControls
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              onUndo={onUndo}
              onRedo={onRedo}
              compact={isLandscapeMobile || isMini}
            />
            {!isLandscapeMobile ? (
              <span
                style={{
                  color: "#bbe7d5",
                  width: isDesktop ? 160 : isMini ? 84 : 96,
                  fontSize: isDesktop ? 12 : isMini ? 8 : 9,
                  lineHeight: 1.2,
                }}
              >
                {undoDiffMsg}
              </span>
            ) : null}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isLandscapeMobile ? "center" : undefined,
            overflowX: isLandscapeMobile ? "visible" : "auto",
            paddingBottom: 2,
            paddingLeft: isLandscapeMobile ? 8 : undefined,
            paddingRight: isLandscapeMobile ? 108 : undefined,
            boxSizing: "border-box",
            minHeight: isDesktop
              ? 80
              : isLandscapeMobile
                ? 80
                : isMini
                  ? 44
                  : 48,
            zIndex: 2,
            gridRow: isLandscapeMobile ? 4 : undefined,
          }}
        >
          {fullHand.slice(0, 13).map((t, i) => (
            <button
              key={`h-${t}-${i}`}
              onClick={() => onTileClick(i)}
              style={{
                width: isDesktop
                  ? 58
                  : isLandscapeMobile
                    ? "clamp(34px, calc((var(--app-width, 100vw) - env(safe-area-inset-left) - env(safe-area-inset-right) - 78px) / 14), 58px)"
                    : isMini
                      ? 27
                      : 30,
                height: isDesktop
                  ? "auto"
                  : isLandscapeMobile
                    ? "auto"
                    : isMini
                      ? 38
                      : 42,
                padding: 0,
                borderRadius: 5,
                border: "1px solid rgba(255, 255, 255, 0.5)",
                overflow: "hidden",
                outline: "none",
                marginRight: 2,
                background: "#13523d",
                cursor: gameEnded ? "default" : "pointer",
                flex: "0 0 auto",
                aspectRatio: isLandscapeMobile ? "11 / 15" : undefined,
                transform:
                  i === selectedIdx ? "translateY(-3px) scale(1.1)" : "none",
                transformOrigin: "bottom center",
                transition: "transform 140ms ease",
                zIndex: i === selectedIdx ? 2 : 1,
              }}
            >
              <MahjongTileFace tile={t} compact />
            </button>
          ))}
          {fullHand[13] != null && !isLandscapeMobile && (
            <button
              key={`d-${fullHand[13]}`}
              onClick={() => onTileClick(13)}
              style={{
                width: isDesktop
                  ? 58
                  : isLandscapeMobile
                    ? "clamp(34px, calc((var(--app-width, 100vw) - env(safe-area-inset-left) - env(safe-area-inset-right) - 78px) / 14), 58px)"
                    : isMini
                      ? 27
                      : 30,
                height: isDesktop
                  ? "auto"
                  : isLandscapeMobile
                    ? "auto"
                    : isMini
                      ? 38
                      : 42,
                padding: 0,
                borderRadius: 5,
                border: "1px solid rgba(255, 255, 255, 0.7)",
                overflow: "hidden",
                outline: "none",
                marginLeft: isDesktop
                  ? 16
                  : isLandscapeMobile
                    ? 12
                    : isMini
                      ? 8
                      : 10,
                background: "#13523d",
                boxShadow:
                  "0 0 0 2px rgba(255, 225, 128, 0.68), 0 0 14px rgba(255, 214, 92, 0.62)",
                cursor: gameEnded ? "default" : "pointer",
                flex: "0 0 auto",
                aspectRatio: isLandscapeMobile ? "11 / 15" : undefined,
                transform:
                  selectedIdx === 13 ? "translateY(-3px) scale(1.1)" : "none",
                transformOrigin: "bottom center",
                transition: "transform 140ms ease",
                zIndex: selectedIdx === 13 ? 2 : 1,
              }}
            >
              <MahjongTileFace tile={fullHand[13]} compact />
            </button>
          )}
        </div>
        <div
          style={{
            padding: isLandscapeMobile ? 0 : isDesktop ? 8 : isMini ? 3 : 4,
            borderRadius: isLandscapeMobile ? 12 : 8,
            background: isLandscapeMobile ? "transparent" : "#00552e",
            fontSize: isDesktop ? 14 : isLandscapeMobile ? 7.5 : isMini ? 8 : 9,
            minHeight: isDesktop
              ? 108
              : isLandscapeMobile
                ? 92
                : isMini
                  ? 60
                  : 70,
            overflow: isLandscapeMobile ? "visible" : "hidden",
            display: isLandscapeMobile ? "grid" : "block",
            gridTemplateColumns: isLandscapeMobile
              ? "minmax(0, 1fr) 98px"
              : undefined,
            gap: isLandscapeMobile ? 7 : undefined,
            alignItems: isLandscapeMobile ? "end" : undefined,
            width: isLandscapeMobile ? "calc(100% - 20px)" : undefined,
            justifySelf: isLandscapeMobile ? "center" : undefined,
            alignSelf: isLandscapeMobile ? "center" : undefined,
            boxSizing: "border-box",
            zIndex: 3,
            gridRow: isLandscapeMobile ? 3 : undefined,
          }}
        >
          {isLandscapeMobile ? (
            <>
              <div className="goat-coach__speech">
                <svg
                  className="goat-coach__speech-shape"
                  viewBox="0 0 100 32"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id="goat-speech-glass"
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="1"
                    >
                      <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
                      <stop
                        offset="0.58"
                        stopColor="#ffffff"
                        stopOpacity="0.065"
                      />
                      <stop offset="1" stopColor="#ffffff" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M3 1 H93 C95.3 1 96.5 3.4 96.5 7 V10 C97.4 12.5 99 14.7 100 16 C99 17.3 97.4 19.5 96.5 22 V25 C96.5 28.6 95.1 31 92.5 31 H3 C1.4 31 0.5 29.4 0.5 27 V5 C0.5 2.6 1.4 1 3 1 Z"
                    fill="url(#goat-speech-glass)"
                    stroke="rgba(235, 255, 248, 0.34)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d="M3.2 2.4 H92.5 C94 2.4 94.9 3.6 95.2 5.3"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.18)"
                    strokeWidth="0.7"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span className="goat-coach__tip-label">
                  {english ? "GOAT TIP" : "ヤギのヒント"}
                </span>
                <CompactAnalysis
                  language={language}
                  selectedTile={
                    selectedIdx != null ? fullHand[selectedIdx] : null
                  }
                  selectedUke={selectedUke}
                  selectedWaitInfo={selectedWaitInfo}
                  isMentsuShantenBack={isMentsuShantenBack}
                  lastReview={lastReview}
                  undoDiffMsg={undoDiffMsg}
                  resultMsg={resultMsg}
                />
              </div>
              <GoatCoach
                tile={fullHand[13] ?? null}
                selected={selectedIdx === 13}
                gameEnded={gameEnded}
                language={language}
                reaction={goatMotion.reaction}
                reactionSequence={goatMotion.sequence}
                onTileClick={() => onTileClick(13)}
              />
            </>
          ) : (
            <>
              {resultMsg ? (
                <div
                  style={{
                    fontWeight: 700,
                    color: "#ffe082",
                    fontSize: isDesktop ? 22 : isMini ? 12 : 14,
                  }}
                >
                  {english
                    ? resultMsg === "聴牌"
                      ? "Ready hand (聴牌 / tenpai)"
                      : "Draw (流局 / ryūkyoku)"
                    : resultMsg}
                </div>
              ) : null}
              <div style={{ minHeight: isDesktop ? 20 : isMini ? 10 : 12 }}>
                {selectedUke && selectedIdx != null
                  ? english
                    ? `Selected tile (仮選択牌): ${TILE_LABELS[fullHand[selectedIdx]]}`
                    : `仮選択牌: ${TILE_LABELS[fullHand[selectedIdx]]}`
                  : ""}
              </div>
              <div style={{ minHeight: isDesktop ? 20 : isMini ? 10 : 12 }}>
                {selectedUke
                  ? english
                    ? `Standard hand (メンツ手) acceptance 受け入れ: ${selectedUke.mentsuKinds} types / ${selectedUke.mentsuCount} tiles${isMentsuShantenBack ? " (shanten increase / シャンテン戻し)" : ""}`
                    : `メンツ手 受け入れ: ${selectedUke.mentsuKinds}種 ${selectedUke.mentsuCount}枚${isMentsuShantenBack ? "（シャンテン戻し）" : ""}`
                  : ""}
              </div>
              <div style={{ minHeight: isDesktop ? 20 : isMini ? 10 : 12 }}>
                {selectedUke
                  ? english
                    ? `Seven pairs (七対子) acceptance 受け入れ: ${selectedUke.chiitoiKinds} types / ${selectedUke.chiitoiCount} tiles`
                    : `七対子 受け入れ: ${selectedUke.chiitoiKinds}種 ${selectedUke.chiitoiCount}枚`
                  : ""}
              </div>
              <div
                style={{
                  color: "#bbe7d5",
                  minHeight: isDesktop ? 20 : isMini ? 10 : 12,
                }}
              >
                {selectedUke && selectedIdx != null
                  ? selectedWaitInfo
                    ? english
                      ? `Ready hand (聴牌) — waits (待ち): ${selectedWaitInfo.labels.join(" ")} (${selectedWaitInfo.total} tiles)`
                      : `聴牌・待ち: ${selectedWaitInfo.labels.join(" ")}（${selectedWaitInfo.total}枚）`
                    : english
                      ? "Click the same tile again to confirm discard (打牌)"
                      : "同じ牌をもう一度クリックで打牌確定"
                  : ""}
              </div>
              <div
                style={{
                  color: "#ffe082",
                  minHeight: isDesktop ? 20 : isMini ? 10 : 12,
                }}
              >
                {lastReview
                  ? english
                    ? `Last discard (打牌) review: ${TILE_LABELS[lastReview.discard]} / ${lastReview.mentsuKinds} types, ${lastReview.mentsuCount} tiles / Top 3: ${lastReview.top3.map((x, i) => `${i + 1}. ${TILE_LABELS[x.tile]} (${x.mCount})`).join(" / ")}`
                    : `直前打牌評価: ${TILE_LABELS[lastReview.discard]} / ${lastReview.mentsuKinds}種${lastReview.mentsuCount}枚 / Top3 ${lastReview.top3.map((x, i) => `${i + 1}位 ${TILE_LABELS[x.tile]}（${x.mCount}枚）`).join(" / ")}`
                  : ""}
              </div>
            </>
          )}
        </div>
        <section
          style={{
            display: "grid",
            gridTemplateColumns: isLandscapeMobile
              ? "36px repeat(5, minmax(0,1fr))"
              : "repeat(5, minmax(0,1fr))",
            gap: isDesktop ? 6 : isMini ? 2 : 3,
            alignItems: "stretch",
            gridRow: isLandscapeMobile ? 5 : undefined,
          }}
        >
          {isLandscapeMobile ? (
            <button
              type="button"
              aria-label={english ? "Open menu" : "メニューを開く"}
              aria-expanded={isMenuOpen}
              aria-hidden={isMenuOpen}
              tabIndex={isMenuOpen ? -1 : 0}
              onClick={() => setIsMenuOpen(true)}
              style={{
                width: 34,
                height: 34,
                padding: 0,
                alignSelf: "center",
                justifySelf: "center",
                borderRadius: "50%",
                border: "1px solid rgba(255, 255, 255, 0.42)",
                color: "#f5f5f5",
                background: "rgba(255, 255, 255, 0.1)",
                display: "grid",
                placeItems: "center",
                visibility: isMenuOpen ? "hidden" : "visible",
                pointerEvents: isMenuOpen ? "none" : "auto",
              }}
            >
              <HamburgerIcon open={isMenuOpen} />
            </button>
          ) : null}
          <Stat
            compact={isMini}
            large={isDesktop}
            label={english ? "Standard メンツ手" : "メンツ手"}
            value={
              selectedIdx != null
                ? `${shantenM} → ${previewShantenM}`
                : String(shantenM)
            }
          />
          <Stat
            compact={isMini}
            large={isDesktop}
            label={english ? "Seven pairs 七対子" : "七対子"}
            value={shantenCLabel}
          />
          <Stat
            compact={isMini}
            large={isDesktop}
            label={english ? "Turn 巡目" : "巡目"}
            value={String(turn)}
          />
          <Stat
            compact={isMini}
            large={isDesktop}
            label={english ? "Good moves 良打率" : "良打率"}
            value={`${goodRate}%`}
          />
          <Stat
            compact={isMini}
            large={isDesktop}
            label={english ? "Wins / games" : "勝利/総数"}
            value={`${stats.wins}/${stats.totalGames}`}
          />
        </section>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  compact = false,
  large = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
  large?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #2b7056",
        borderRadius: 8,
        padding: large ? 8 : compact ? 3 : 4,
        background: "#00552e",
      }}
    >
      <div style={{ fontSize: large ? 11 : compact ? 7 : 8, color: "#bbe7d5" }}>
        {label}
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: large ? 18 : compact ? 10 : 11,
          color: "#f5f5f5",
        }}
      >
        {value}
      </div>
    </div>
  );
}
function MahjongTileFace({
  tile,
  compact = false,
  square = false,
}: {
  tile: Tile;
  compact?: boolean;
  square?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        width: "100%",
        height: "100%",
        borderRadius: square ? 0 : compact ? 4 : 6,
        background: "#f4f4f4",
        alignItems: "center",
        justifyContent: "flex-start",
        overflow: "hidden",
        boxSizing: "border-box",
        border: "1px solid #d7d7d7",
      }}
    >
      <img
        src={tileImagePath(tile)}
        alt={TILE_LABELS[tile]}
        width={44}
        height={60}
        style={{
          display: "block",
          pointerEvents: "none",
          width: "auto",
          height: "100%",
          maxWidth: "100%",
          objectFit: "contain",
          objectPosition: "center",
          margin: "0 auto",
        }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
          const next = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (next) next.style.display = "inline";
        }}
      />
      <span
        style={{
          display: "none",
          color: "#102218",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {TILE_LABELS[tile]}
      </span>
    </span>
  );
}
function River({
  river,
  language,
  fixedHeight,
  compact = false,
  desktop = false,
}: {
  river: Tile[];
  language: Language;
  fixedHeight?: number;
  compact?: boolean;
  desktop?: boolean;
}) {
  const rows: Tile[][] = [];
  for (let i = 0; i < river.length; i += 6) rows.push(river.slice(i, i + 6));
  return (
    <div
      style={{
        borderRadius: 8,
        padding: compact ? 3 : 10,
        height: fixedHeight ?? 120,
        marginBottom: 0,
        background: "#00552e",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        overflowY: "auto",
      }}
    >
      {rows.length === 0 ? (
        <div style={{ color: "#bbe7d5" }}>
          {language === "en"
            ? "No discards yet (捨て牌)"
            : "（まだ捨て牌なし）"}
        </div>
      ) : (
        rows.map((row, rIdx) => (
          <div
            key={rIdx}
            style={{
              display: "flex",
              gap: compact ? 2 : 8,
              marginBottom: compact ? 2 : 6,
              justifyContent: "flex-start",
            }}
          >
            {row.map((t, i) => (
              <span
                key={`${rIdx}-${i}`}
                style={{
                  borderRadius: 0,
                  padding: "1px",
                  background: "rgba(116, 132, 125, 0.42)",
                  border: "1px solid rgba(220, 231, 227, 0.18)",
                  boxShadow: "0 2px 5px rgba(0, 0, 0, 0.16)",
                  width: desktop ? 40 : compact ? 18 : 35,
                  height: desktop ? 57 : compact ? 24 : 51,
                  filter: "grayscale(0.72) saturate(0.45)",
                  opacity: 0.84,
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <MahjongTileFace tile={t} square />
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
