import test from "node:test";
import assert from "node:assert/strict";
import { calcUkeireForDiscard, evaluatePathWeight, makeWall, shantenChiitoi, shantenMentsu } from "./mahjong.ts";

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
