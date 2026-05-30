import test from "node:test";
import assert from "node:assert/strict";
import { calcUkeireForDiscard, classifyMentsuStructure, evaluatePathWeight, generateFiveBlockNoPairHand, generateSanmaFiveBlockNoPairHand, isSanmaTile, makeSanmaWall, makeWall, toCounts, shantenChiitoi, shantenMentsu } from "./mahjong.ts";

test("makeWall creates 136 tiles", () => {
  const wall = makeWall();
  assert.equal(wall.length, 136);
});

test("chiitoi shanten is -1 on complete seven pairs", () => {
  const hand = [0,0,1,1,9,9,10,10,18,18,19,19,27,27];
  assert.equal(shantenChiitoi(hand), -1);
});

test("mentsu shanten decreases for better shape", () => {
  const weak = [0,2,4,6,8,9,11,13,15,18,20,22,27,28];
  const better = [0,1,2,3,4,5,9,10,11,18,19,20,27,27];
  assert.ok(shantenMentsu(better) < shantenMentsu(weak));
});

test("ukeire returns separated mentsu/chiitoi counts", () => {
  const hand = [0,0,1,1,2,2,9,10,11,18,19,20,27,28];
  const res = calcUkeireForDiscard(hand, 13);
  assert.ok(res.mentsuKinds >= 0 && res.chiitoiKinds >= 0);
});

test("weight balances when four pairs exist", () => {
  const hand = [0,0,1,1,9,9,10,10,18,19,20,21,22,23];
  const { wm, wc } = evaluatePathWeight(hand);
  assert.equal(wm + wc, 1);
  assert.ok(wc >= 0.25);
});

test("classify identifies 5-block with pair", () => {
  const hand = [0,1,2,3,4,5,9,10,11,18,19,20,27,27];
  const r = classifyMentsuStructure(hand);
  assert.equal(r.blocks, 5);
  assert.equal(r.hasPair, true);
});

test("classify identifies 4-block with pair", () => {
  const hand = [0,1,2,3,4,5,9,10,18,19,27,27,30,31];
  const r = classifyMentsuStructure(hand);
  assert.ok(r.blocks >= 4);
  assert.equal(r.hasPair, true);
});

test("classify identifies 5-block without pair", () => {
  const hand = [0,1,2,3,4,5,9,10,11,18,19,20,22,23];
  const r = classifyMentsuStructure(hand);
  assert.ok(r.blocks >= 4);
  assert.equal(r.hasPair, false);
});

test("classify handles near-complete run middle tile case", () => {
  const hand = [0,1,2,3,4,5,6,7,8,18,19,20,31,33];
  const r = classifyMentsuStructure(hand);
  assert.ok(r.blocks >= 4);
  assert.equal(r.hasPair, false);
});

test("classify keeps shanten reference aligned", () => {
  const hand = [0,1,2,3,4,6,7,8,9,10,11,18,19,30];
  const r = classifyMentsuStructure(hand);
  assert.equal(r.shantenMentsuOnly, shantenMentsu(hand));
});

test("classify with honor-heavy hand", () => {
  const hand = [27,27,28,28,29,29,30,31,32,33,0,1,9,10];
  const r = classifyMentsuStructure(hand);
  assert.ok(r.blocks >= 3);
  assert.equal(r.hasPair, true);
});


test("classify exposes pair tile candidates and strictNoPair5Block", () => {
  const withPair = [0,1,2,9,10,11,18,19,20,27,27,30,31,32];
  const r1 = classifyMentsuStructure(withPair);
  assert.ok(r1.pairTileCandidates.includes(27));
  assert.equal(r1.strictNoPair5Block, false);

  const noExactPair = [0,1,2,9,10,11,18,19,20,27,28,29,30,33];
  const r2 = classifyMentsuStructure(noExactPair);
  assert.equal(r2.pairTileCandidates.length, 0);
});


test("fiveBlockNoPair generator has no duplicate tiles across 100 hands", () => {
  for (let i = 0; i < 100; i++) {
    const hand = generateFiveBlockNoPairHand();
    const c = toCounts(hand);
    for (let t = 0; t < 34; t++) assert.ok(c[t] <= 1);
  }
});


test("sanma wall excludes 2m through 8m", () => {
  const wall = makeSanmaWall();
  assert.equal(wall.length, 108);
  assert.ok(wall.every(isSanmaTile));
});

function hasCompleteSequence(hand: number[]): boolean {
  const c = toCounts(hand);
  for (const base of [0, 9, 18]) {
    for (let i = base; i <= base + 6; i++) {
      if (c[i] > 0 && c[i + 1] > 0 && c[i + 2] > 0) return true;
    }
  }
  return false;
}

function maxDisjointTaatsu(hand: number[]): number {
  const c = toCounts(hand);

  const dfs = (idx: number): number => {
    while (idx < 27 && c[idx] === 0) idx++;
    if (idx >= 27) return 0;

    let best = 0;
    c[idx]--;
    best = Math.max(best, dfs(idx));
    c[idx]++;

    if (idx % 9 <= 7 && c[idx + 1] > 0) {
      c[idx]--; c[idx + 1]--;
      best = Math.max(best, 1 + dfs(idx));
      c[idx]++; c[idx + 1]++;
    }

    if (idx % 9 <= 6 && c[idx + 2] > 0) {
      c[idx]--; c[idx + 2]--;
      best = Math.max(best, 1 + dfs(idx));
      c[idx]++; c[idx + 2]++;
    }

    return best;
  };

  return dfs(0);
}

test("sanma fiveBlockNoPair generator creates visible separated five blocks", () => {
  for (let i = 0; i < 100; i++) {
    const hand = generateSanmaFiveBlockNoPairHand();
    assert.ok(hand.every(isSanmaTile));
    assert.equal(hasCompleteSequence(hand), false);
    assert.equal(maxDisjointTaatsu(hand), 5);

    const c = toCounts(hand);
    for (let t = 0; t < 34; t++) assert.ok(c[t] <= 1);

    const pinCount = hand.filter((t) => t >= 9 && t <= 17).length;
    const souCount = hand.filter((t) => t >= 18 && t <= 26).length;
    assert.ok((pinCount === 4 && souCount === 6) || (pinCount === 6 && souCount === 4));
  }
});
