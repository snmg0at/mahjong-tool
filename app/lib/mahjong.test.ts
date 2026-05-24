import test from "node:test";
import assert from "node:assert/strict";
import { calcUkeireForDiscard, classifyMentsuStructure, evaluatePathWeight, makeWall, shantenChiitoi, shantenMentsu } from "./mahjong.ts";

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
