BUILD_MARKER_MAIN_2026_05_12
import { useMemo, useState } from "react";

type SimResult = { i: number; tiles: number; score: number; shanten: number; machi: { name: string; count: number }[] };

const styles = `
body{font-family:system-ui,-apple-system,sans-serif;background:#f0f2f5}
.page{max-width:860px;margin:0 auto;padding:16px;line-height:1.5}
.card{background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
h2{margin-top:0;color:#1a1a1a;border-left:4px solid #111;padding-left:10px}
.row{display:flex;gap:10px;margin-bottom:12px}
.col{flex:1}
input,select,button{width:100%;box-sizing:border-box;padding:12px;margin-top:6px;font-size:16px;border-radius:8px;border:1px solid #ccc}
button{background:#111;color:#fff;font-weight:700;cursor:pointer;border:none;margin-top:12px}
.tabs{display:flex;gap:8px;margin-bottom:12px}
.tab{flex:1;padding:12px;border-radius:8px;text-align:center;cursor:pointer;background:#e4e6eb;font-weight:700;border:none}
.tab.active{background:#111;color:#fff}
.label{font-size:14px;font-weight:700;color:#555}
.draw-group{margin-bottom:16px;padding:12px;background:#eef2f7;border-radius:8px;border:2px dashed #bcc6d2;min-height:50px;display:flex;flex-wrap:wrap}
.draw-btn{padding:6px 8px;margin:2px;background:#fff;border:1px solid #ccc;border-radius:6px;cursor:pointer;font-size:13px;min-width:38px;text-align:center}
.draw-btn.effective{border:2px solid #d93025;color:#d93025;font-weight:bold;background:#fff1f0}
.recommend-item{margin-bottom:12px;padding:12px;background:#f8f9fa;border-left:5px solid #d93025;border-radius:4px}
.agari-card{background:#d93025;color:#fff;padding:30px;border-radius:12px;text-align:center;font-size:28px;font-weight:bold;margin-bottom:15px;box-shadow:0 4px 15px rgba(217,48,37,0.4)}
.machi-info{color:#d93025;font-weight:700;margin-top:4px;display:block;font-size:14px}
#advice-area{background:#fff9db;border:2px solid #fab005;padding:15px;border-radius:8px;margin-bottom:15px;color:#856404;font-size:15px;font-weight:bold;}
`;

function parseHand(str: string) {
  const c = Array(34).fill(0);
  const g = str.match(/(\d+)([mpsz])/g) || [];
  for (const x of g) {
    const n = x.slice(0, -1);
    const s = x.slice(-1);
    const b = s === "m" ? 0 : s === "p" ? 9 : s === "s" ? 18 : 27;
    for (const ch of n) {
      const idx = b + Number(ch) - 1;
      if (idx < 34) c[idx]++;
    }
  }
  return c;
}

function serializeHand(c: number[]) {
  let s = "";
  const suffix = ["m", "p", "s", "z"];
  for (let i = 0; i < 4; i++) {
    let digits = "";
    for (let j = 0; j < 9; j++) {
      if (i === 3 && j >= 7) break;
      for (let k = 0; k < c[i * 9 + j]; k++) digits += j + 1;
    }
    if (digits) s += digits + suffix[i];
  }
  return s;
}

function tileName(i: number) {
  if (i < 9) return `${i + 1}m`;
  if (i < 18) return `${i - 8}p`;
  if (i < 27) return `${i - 17}s`;
  return `${i - 26}z`;
}

function calcShanten(c: number[]) {
  let minS = 8;
  function dfs(a: number[], i: number, m: number, t: number, p: number) {
    if (i === 34) {
      const s = 8 - 2 * m - t - p;
      if (minS > s) minS = s;
      return;
    }
    if (a[i] === 0) return dfs(a, i + 1, m, t, p);
    if (a[i] >= 3) {
      a[i] -= 3;
      dfs(a, i, m + 1, t, p);
      a[i] += 3;
    }
    if (i < 27 && i % 9 <= 6 && a[i + 1] > 0 && a[i + 2] > 0) {
      a[i]--;a[i + 1]--;a[i + 2]--;
      dfs(a, i, m + 1, t, p);
      a[i]++;a[i + 1]++;a[i + 2]++;
    }
    if (p === 0 && a[i] >= 2) {
      a[i] -= 2;
      dfs(a, i, m, t, 1);
      a[i] += 2;
    }
    if (t + m < 4) {
      if (a[i] >= 2) {
        a[i] -= 2;
        dfs(a, i, m, t + 1, p);
        a[i] += 2;
      }
      if (i < 27 && i % 9 <= 7 && a[i + 1] > 0) {
        a[i]--;a[i + 1]--;
        dfs(a, i, m, t + 1, p);
        a[i]++;a[i + 1]++;
      }
      if (i < 27 && i % 9 <= 6 && a[i + 2] > 0) {
        a[i]--;a[i + 2]--;
        dfs(a, i, m, t + 1, p);
        a[i]++;a[i + 2]++;
      }
    }
    const tmp = a[i];
    a[i] = 0;
    dfs(a, i + 1, m, t, p);
    a[i] = tmp;
  }
  dfs(c.slice(), 0, 0, 0, 0);
  return minS;
}

function shantenChiitoi(c: number[]) {
  let p = 0;
  let k = 0;
  for (let i = 0; i < 34; i++) {
    if (c[i] >= 2) p++;
    if (c[i] > 0) k++;
  }
  let s = 6 - p;
  if (k < 7) s += 7 - k;
  return s;
}

function simulate(c: number[], mode: "mentu" | "chiitoi") {
  const results: SimResult[] = [];
  const bestEffs = new Set<number>();
  for (let d = 0; d < 34; d++) {
    if (c[d] === 0) continue;
    c[d]--;
    let validDraws = 0;
    const machi: { name: string; count: number }[] = [];
    const afterS = mode === "mentu" ? calcShanten(c) : shantenChiitoi(c);
    for (let t = 0; t < 34; t++) {
      if (c[t] >= 4) continue;
      c[t]++;
      const nextS = mode === "mentu" ? calcShanten(c) : shantenChiitoi(c);
      if (nextS < afterS) {
        const nokori = 4 - (c[t] - 1);
        if (nokori > 0) {
          validDraws += nokori;
          if (afterS === 0) machi.push({ name: tileName(t), count: nokori });
        }
      }
      c[t]--;
    }
    const score = (10 - afterS) * 10000000 + validDraws * 100;
    results.push({ i: d, tiles: validDraws, score, shanten: afterS, machi });
    c[d]++;
  }
  results.sort((a, b) => b.score - a.score);
  if (results.length > 0) {
    const tempHand = c.slice();
    tempHand[results[0].i]--;
    const baseS = mode === "mentu" ? calcShanten(tempHand) : shantenChiitoi(tempHand);
    for (let t = 0; t < 34; t++) {
      tempHand[t]++;
      if ((mode === "mentu" ? calcShanten(tempHand) : shantenChiitoi(tempHand)) < baseS) bestEffs.add(t);
      tempHand[t]--;
    }
  }
  return { recommendations: results, effs: Array.from(bestEffs) };
}

export default function Home() {
  const [bakaze, setBakaze] = useState("27");
  const [jikaze, setJikaze] = useState("27");
  const [dora, setDora] = useState("1z");
  const [hand, setHand] = useState("456777m11189p345s");
  const [tab, setTab] = useState<"mentu" | "chiitoi">("mentu");

  const handArray = useMemo(() => parseHand(hand), [hand]);
  const sM = useMemo(() => calcShanten(handArray), [handArray]);
  const sC = useMemo(() => shantenChiitoi(handArray), [handArray]);
  const currentS = tab === "mentu" ? sM : sC;
  const resM = useMemo(() => simulate(handArray.slice(), "mentu"), [handArray]);
  const resC = useMemo(() => simulate(handArray.slice(), "chiitoi"), [handArray]);
  const currentRes = tab === "mentu" ? resM : resC;

  const executeTsumo = (drawIdx: number) => {
    const next = handArray.slice();
    const res = simulate(next.slice(), tab);
    const count = next.reduce((a, b) => a + b, 0);
    if (count >= 14 && res.recommendations.length > 0) next[res.recommendations[0].i]--;
    next[drawIdx]++;
    setHand(serializeHand(next));
  };

  const renderList = (arr: SimResult[]) => {
    if (!arr.length) return null;
    const minS = Math.min(...arr.map((r) => r.shanten));
    let currentTitle = "";
    return arr.map((r, idx) => {
      if (r.shanten > minS + 1 || r.shanten > 2) return null;
      const label = r.shanten === 0 ? "聴牌" : `${r.shanten + 1}向聴`;
      const showTitle = currentTitle !== label;
      if (showTitle) currentTitle = label;
      return (
        <div key={`${r.i}-${idx}`}>
          {showTitle ? <h3 style={{ marginTop: "15px", borderBottom: "1px solid #ccc" }}>{label}</h3> : null}
          <div className="recommend-item">
            <strong>打 {tileName(r.i)}</strong> (受入: {r.tiles}枚)
            {r.shanten === 0 && r.machi.length > 0 ? (
              <span className="machi-info">待ち: {r.machi.map((m) => `${m.name}(${m.count})`).join(" ")}</span>
            ) : null}
          </div>
        </div>
      );
    });
  };

  return (
    <main className="page">
      <style>{styles}</style>
      <h2>麻雀牌効率 やぎちゃんシミュレーター v16.35</h2>
      <div id="advice-area">{sM <= sC ? "【メンツ手】優先" : "【七対子】優先"}</div>
      {currentS <= -1 ? <div className="agari-card">✨ ツモアガリ！和了しました ✨</div> : null}

      <div className="card">
        <div className="row">
          <div className="col"><div className="label">場風</div><select value={bakaze} onChange={(e) => setBakaze(e.target.value)}><option value="27">東</option><option value="28">南</option></select></div>
          <div className="col"><div className="label">自風</div><select value={jikaze} onChange={(e) => setJikaze(e.target.value)}><option value="27">東</option><option value="28">南</option><option value="29">西</option><option value="30">北</option></select></div>
          <div className="col"><div className="label">ドラ表示牌</div><input value={dora} maxLength={2} onChange={(e) => setDora(e.target.value)} /></div>
        </div>
        <div className="label">手牌</div>
        <input value={hand} onChange={(e) => setHand(e.target.value)} />
        <button type="button">解析を実行</button>
      </div>

      <div className="card"><div className="label">仮想ドロー（ツモ牌を入れ替え）</div><div className="draw-group">{Array.from({ length: 34 }, (_, i) => <button key={i} type="button" className={`draw-btn ${currentRes.effs.includes(i) ? "effective" : ""}`} onClick={() => executeTsumo(i)}>{tileName(i)}</button>)}</div></div>

      <div className="tabs">
        <button id="btn-mentu" className={`tab ${tab === "mentu" ? "active" : ""}`} onClick={() => setTab("mentu")}>メンツ手</button>
        <button id="btn-chiitoi" className={`tab ${tab === "chiitoi" ? "active" : ""}`} onClick={() => setTab("chiitoi")}>七対子</button>
      </div>

      <div id="result-container">
        <div className={`card ${tab === "mentu" ? "" : "hidden"}`}>{currentS <= -1 ? null : renderList(resM.recommendations)}</div>
        <div className={`card ${tab === "chiitoi" ? "" : "hidden"}`}>{currentS <= -1 ? null : renderList(resC.recommendations)}</div>
      </div>
    </main>
  );
}
