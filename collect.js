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

// 시청 단골집 도장: 산책 길 60 m 안에서 지나간 가게(별 기록의 mats)
export function matStamps(S) {
  const m = new Map();
  for (const s of S) for (const x of s.mats || []) { const e = m.get(x.k) || { ...x, times: 0 }; e.times++; m.set(x.k, e); }
  return [...m.values()].sort((a, b) => b.t - a.t || b.v - a.v);
}

// 구 모범음식점 도장: 산책 길 60 m 안에서 지나간 곳(별 기록의 models) — 동네(행정동)별로 센다
export function modelStamps(S) {
  const m = new Map();
  for (const s of S) for (const x of s.models || []) { const e = m.get(x.k) || { ...x, times: 0 }; e.times++; m.set(x.k, e); }
  return [...m.values()];
}
const modelDongs = S => new Set(modelStamps(S).filter(m => m.dong).map(m => m.gu + ' ' + m.dong)).size;

// ---------- 28수(宿) 분야 ----------
// 천상열차분야지도의 28수를 서울에 옮긴 놀이용 배정: 서울시청에서 본 방위를 28칸으로 나눈다(실제 분야설 재현이 아니다).
// 북(315°~45°) 현무 · 동(45°~135°) 청룡 · 남(135°~225°) 주작 · 서(225°~315°) 백호, 각 7수를 시계 방향으로
export const CENTER = [37.5663, 126.9779]; // 서울시청
export const SU = [
  ['북방현무', '현무', ['두(斗)', '우(牛)', '여(女)', '허(虛)', '위(危)', '실(室)', '벽(壁)']],
  ['동방청룡', '청룡', ['각(角)', '항(亢)', '저(氐)', '방(房)', '심(心)', '미(尾)', '기(箕)']],
  ['남방주작', '주작', ['정(井)', '귀(鬼)', '류(柳)', '성(星)', '장(張)', '익(翼)', '진(軫)']],
  ['서방백호', '백호', ['규(奎)', '루(婁)', '위(胃)', '묘(昴)', '필(畢)', '자(觜)', '삼(參)']],
];
// 별 자리(위경도) → 0~27 칸 번호. 북방 첫 칸이 315°에서 시작한다
export function suIndex([lat, lon]) {
  const dx = (lon - CENTER[1]) * Math.cos(CENTER[0] * Math.PI / 180), dy = lat - CENTER[0];
  const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360; // 북 0°, 동 90°
  return Math.floor(((bearing - 315 + 360) % 360) / (360 / 28));
}
export const suName = i => { const [grp, , names] = SU[Math.floor(i / 7)]; return { group: grp, name: names[i % 7] }; };
export function suFilled(S) {
  const m = new Map();
  for (const s of S) if (Array.isArray(s.ll)) { const i = suIndex(s.ll); m.set(i, (m.get(i) || 0) + 1); }
  return m;
}

const has = (S, list) => list.filter(k => kinds(S).has(k)).length;
const designsWalked = S => new Set(S.filter(s => s.shape === 'custom' && s.designId).map(s => s.designId)).size;

// [id, 이모지, 이름, 설명, 진행(0~1)을 내는 함수]
const RULES = [
  ['first', '⭐', '첫 별', '산책을 한 번 다녀오기', S => Math.min(1, S.length)],
  ['const1', '🌌', '첫 별자리', '별 5개 모으기', S => Math.min(1, S.length / 5)],
  ['const3', '🪐', '별자리 셋', '별 15개 모으기', S => Math.min(1, S.length / 15)],
  ['bright', '💎', '1등성', '모양 길을 90% 넘게 따라 걸어 1등성 받기', S => S.some(s => s.grade === 1) ? 1 : 0],
  ['gold', '✨', '반짝 별', '반짝 산책을 다녀오기', S => S.some(s => s.gold) ? 1 : 0],
  ['km10', '👟', '10 km', '산책으로 모두 10 km 걷기', S => Math.min(1, sum(S, 'totalKm') / 10)],
  ['km50', '🥾', '50 km', '산책으로 모두 50 km 걷기', S => Math.min(1, sum(S, 'totalKm') / 50)],
  ['pioneer', '🧭', '개척자', '처음 걷는 길 20 km 걷기', S => Math.min(1, sum(S, 'newKm') / 20)],
  ['geo', '📐', '도형 수집가', '도형 5종 모두 그리기', S => has(S, CATEGORY.geo) / CATEGORY.geo.length],
  ['animal', '🐾', '동물 박사', '동물 4종 모두 그리기', S => has(S, CATEGORY.animal) / CATEGORY.animal.length],
  ['plant', '🌿', '정원사', '식물 5종 모두 그리기', S => has(S, CATEGORY.plant) / CATEGORY.plant.length],
  ['maker', '🎨', '첫 작품', '내 도안으로 산책 다녀오기', S => Math.min(1, designsWalked(S))],
  ['maker3', '🖌️', '동네 화가', '내 도안 3개로 산책 다녀오기', S => Math.min(1, designsWalked(S) / 3)],
  ['dong5', '📮', '동네 마당발', '동네 도장 5곳 받기', S => Math.min(1, stamps(S).length / 5)],
  ['su1', '🌌', '첫 칸', '28수 둥근 판에서 한 칸 채우기', S => Math.min(1, suFilled(S).size)],
  ['guard', '🐉', '사신 도장', '한 방위의 7수를 모두 채우기(청룡·현무·백호·주작)', S => Math.max(...SU.map((_, g) => [0, 1, 2, 3, 4, 5, 6].filter(k => suFilled(S).has(g * 7 + k)).length)) / 7],
  ['su28', '🗺️', '서울 천상열차분야지도', '28수를 모두 채우기', S => suFilled(S).size / 28],
  ['kept', '🤝', '약속 지킴', '약속한 시각에 산책 다녀오기', S => S.some(s => s.kept) ? 1 : 0],
  ['ontime', '⏱️', '정각 도착', '돌아갈 시각 1분 안에 「다녀왔어요」 누르기', S => S.some(s => s.ontime != null) ? 1 : 0],
  ['memo1', '🧠', '외워 그린 별', '지도를 가린 채 끝까지 걸어 별 받기(「지도 없이 걷기」)', S => S.some(s => s.memo) ? 1 : 0],
  ['access', '🚧', '못 가는 길 알리기', '못 가는 길을 판정에서 빼고 다녀오기', S => S.some(s => s.skipped > 0) ? 1 : 0],
  ['mat1', '🍽️', '시청 단골집', '산책 길에 시청 단골집 지나가기', S => Math.min(1, matStamps(S).length)],
  ['mat10', '🥢', '단골집 탐방', '시청 단골집 도장 10곳 받기', S => Math.min(1, matStamps(S).length / 10)],
  ['model1', '🏅', '모범음식점', '산책 길에 구청 지정 모범음식점 지나가기', S => Math.min(1, modelStamps(S).length)],
  ['modelDong5', '🗂️', '동네 모범 도장판', '서로 다른 다섯 동에서 모범음식점 도장 받기', S => Math.min(1, modelDongs(S) / 5)],
  ['matTop', '👑', '최고 단골집', '결제 건수 상위 5%인 단골집 지나가기', S => matStamps(S).some(m => m.t === 3) ? 1 : 0],
];

export function achievements(S) {
  return RULES.map(([id, emoji, title, desc, f]) => { const p = f(S); return { id, emoji, title, desc, progress: p, ok: p >= 1 }; });
}

// 방금 새로 얻은 업적(별 하나를 더하기 전·후 비교)
export function newlyUnlocked(before, after) {
  const was = new Set(achievements(before).filter(a => a.ok).map(a => a.id));
  return achievements(after).filter(a => a.ok && !was.has(a.id));
}
