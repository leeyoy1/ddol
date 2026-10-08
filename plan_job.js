// 원정 한 판 짜기 — 도로망 조각을 불러와 그래프를 만들고 core.plan을 돌린다.
// 작업자(plan_worker.js)와, 작업자를 못 쓰는 브라우저의 화면 쪽에서 똑같이 쓴다.
import * as C from './core.js?v=2610090006';

let INDEX = null;
const cache = new Map(); // 조각 캐시 — 최근 16개만(출발점을 여러 번 옮겨도 메모리가 쌓이지 않게)

async function getJson(url) {
  let r;
  try { r = await fetch(url); } catch { throw new Error('인터넷 연결이 불안정해요. 잠시 뒤 다시 눌러 주세요.'); }
  if (!r.ok) throw new Error('동네 길 자료를 받지 못했어요. 잠시 뒤 다시 눌러 주세요.');
  return r.json();
}

async function tile(k) {
  if (cache.has(k)) { const v = cache.get(k); cache.delete(k); cache.set(k, v); return v; }
  const v = await getJson(`tiles/${k}.json`);
  cache.set(k, v);
  if (cache.size > 16) cache.delete(cache.keys().next().value);
  return v;
}

// params: { lat, lon, endLat?, endLon?, radius, size, pick, custom, nearLL, seed, maxTotalKm? }
// 도착점이 있으면 두 점의 가운데를 중심으로, 두 점이 다 들어가게 조각을 받는다(10-08 실측: 2.5 km면 조각 4→9개, 내려받기 2~2.5배)
export async function runPlan({ lat, lon, endLat = null, endLon = null, radius, size, pick, custom, nearLL, seed, maxTotalKm = null }, onProgress) {
  INDEX = INDEX || await getJson('tiles/index.json');
  const hasEnd = endLat != null;
  const proj = new C.Proj(hasEnd ? (lat + endLat) / 2 : lat, hasEnd ? (lon + endLon) / 2 : lon);
  const start = proj.xy(lat, lon), end = hasEnd ? proj.xy(endLat, endLon) : null;
  const reach = (end ? Math.hypot(start[0] - end[0], start[1] - end[1]) / 2 : 0) + radius + Math.max(size, C.FIGURE_MIN_SIZE);
  const keys = C.tileKeysAround(INDEX, proj.lat0, proj.lon0, reach);
  if (!keys.length) throw new Error('아직 서울에서만 돼요. 서울 안을 골라 주세요.');
  let got = 0;
  const tiles = await Promise.all(keys.map(k => tile(k).then(t => { onProgress && onProgress(++got, keys.length); return t; })));
  const G = C.buildGraph(tiles, proj, reach, INDEX.hw_names);
  const near = nearLL ? nearLL.map(([a, b]) => proj.xy(a, b)).filter(([x, y]) => Math.hypot(x - start[0], y - start[1]) <= radius * 1.1) : null;
  return C.plan(G, proj, start, radius, size, seed, { pick, custom, near, end, maxTotalKm });
}
