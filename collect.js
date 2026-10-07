// 수집 — 도감·업적·동네 스탬프. 전부 별 기록(stars)에서 매번 계산한다(따로 저장한 값과 어긋날 일이 없게)
import { CATEGORY, SHAPE_KO, EMOJI } from './core.js';

const sum = (S, k) => S.reduce((a, s) => a + (+s[k] || 0), 0);
const kinds = S => new Set(S.map(s => s.shape));

// 도감: 기본 모양 14칸 + 내 도안마다 한 칸
export function dex(S, designs = []) {
  const card = (key, name, emoji, list) => ({
    key, name, emoji, count: list.length, got: list.length > 0,
    best: list.length ? Math.min(...list.map(s => s.grade)) : null,
    first: list.length ? list.map(s => s.date).sort()[0] : null,
    gold: list.some(s => s.gold), last: list[list.length - 1] || null,
  });
  const base = [...CATEGORY.geo, ...CATEGORY.animal, ...CATEGORY.plant]
    .map(k => card(k, SHAPE_KO[k], EMOJI[k], S.filter(s => s.shape === k)));
  const mine = designs.map(d => card('d:' + d.id, d.name, d.made === 'draw' ? '✍️' : '🖼️', S.filter(s => s.shape === 'custom' && s.designId === d.id)));
  return { base, mine, got: base.filter(c => c.got).length, total: base.length };
}

export function stamps(S) {
  const m = new Map();
  for (const s of S) if (s.dong) m.set(s.dong, (m.get(s.dong) || 0) + 1);
  return [...m.entries()].map(([dong, n]) => ({ dong, n })).sort((a, b) => b.n - a.n || a.dong.localeCompare(b.dong));
}

// 공무원 맛집 도장 — 원정 길 60 m 안에서 지나간 가게(별 기록의 mats)
export function matStamps(S) {
  const m = new Map();
  for (const s of S) for (const x of s.mats || []) { const e = m.get(x.k) || { ...x, times: 0 }; e.times++; m.set(x.k, e); }
  return [...m.values()].sort((a, b) => b.t - a.t || b.v - a.v);
}

const has = (S, list) => list.filter(k => kinds(S).has(k)).length;
const designsWalked = S => new Set(S.filter(s => s.shape === 'custom' && s.designId).map(s => s.designId)).size;

// [id, 이모지, 이름, 설명, 진행(0~1)을 내는 함수]
const RULES = [
  ['first', '⭐', '첫 별', '원정을 한 번 다녀오기', S => Math.min(1, S.length)],
  ['const1', '🌌', '첫 별자리', '별 5개 모으기', S => Math.min(1, S.length / 5)],
  ['const3', '🪐', '별자리 셋', '별 15개 모으기', S => Math.min(1, S.length / 15)],
  ['bright', '💎', '1등성', '모양을 아주 정확히 그려 1등성 받기', S => S.some(s => s.grade === 1) ? 1 : 0],
  ['gold', '✨', '반짝 별', '반짝 원정을 다녀오기', S => S.some(s => s.gold) ? 1 : 0],
  ['km10', '👟', '10 km', '원정으로 모두 10 km 걷기', S => Math.min(1, sum(S, 'totalKm') / 10)],
  ['km50', '🥾', '50 km', '원정으로 모두 50 km 걷기', S => Math.min(1, sum(S, 'totalKm') / 50)],
  ['pioneer', '🧭', '개척자', '처음 걷는 길 20 km', S => Math.min(1, sum(S, 'newKm') / 20)],
  ['geo', '📐', '도형 수집가', '도형 5종 모두 그리기', S => has(S, CATEGORY.geo) / CATEGORY.geo.length],
  ['animal', '🐾', '동물 박사', '동물 4종 모두 그리기', S => has(S, CATEGORY.animal) / CATEGORY.animal.length],
  ['plant', '🌿', '정원사', '식물 5종 모두 그리기', S => has(S, CATEGORY.plant) / CATEGORY.plant.length],
  ['maker', '🎨', '첫 작품', '내 도안으로 원정 다녀오기', S => Math.min(1, designsWalked(S))],
  ['maker3', '🖌️', '동네 화가', '내 도안 3개로 원정 다녀오기', S => Math.min(1, designsWalked(S) / 3)],
  ['dong5', '📮', '동네 마당발', '동네 스탬프 5곳', S => Math.min(1, stamps(S).length / 5)],
  ['mat1', '🍽️', '공무원 맛집', '원정 길에 공무원 맛집 지나가기', S => Math.min(1, matStamps(S).length)],
  ['mat10', '🥢', '맛집 탐방가', '공무원 맛집 도장 10곳', S => Math.min(1, matStamps(S).length / 10)],
  ['matTop', '👑', '전설의 맛집', '30번 넘게 간 공무원 맛집 지나가기', S => matStamps(S).some(m => m.t === 3) ? 1 : 0],
];

export function achievements(S) {
  return RULES.map(([id, emoji, title, desc, f]) => { const p = f(S); return { id, emoji, title, desc, progress: p, ok: p >= 1 }; });
}

// 방금 새로 얻은 업적(별 하나를 더하기 전·후 비교)
export function newlyUnlocked(before, after) {
  const was = new Set(achievements(before).filter(a => a.ok).map(a => a.id));
  return achievements(after).filter(a => a.ok && !was.has(a.id));
}
