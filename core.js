// 글자 산책 · 별자리 원정 — 계산부 (walk_shape.py · expedition.py의 JS 판)
// 브라우저와 Node(시험) 양쪽에서 쓴다. DOM을 건드리지 않는다.

export class Proj {
  constructor(lat0, lon0) { this.lat0 = lat0; this.lon0 = lon0; this.kx = Math.cos(lat0 * Math.PI / 180) * 111320; }
  xy(lat, lon) { return [(lon - this.lon0) * this.kx, (lat - this.lat0) * 110540]; }
  ll(x, y) { return [this.lat0 + y / 110540, this.lon0 + x / this.kx]; }
}

const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));

export function shapes() {
  const star = [];
  for (let i = 0; i < 11; i++) {
    const r = i % 2 === 0 ? 1 : 0.4, a = Math.PI / 2 + i * Math.PI / 5;
    star.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const heart = linspace(0, 2 * Math.PI, 40).map(t => [16 * Math.sin(t) ** 3 / 16,
    (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]);
  // 꽃: 꽃잎 다섯 장(장미 곡선)
  const flower = linspace(0, 2 * Math.PI, 61).map(t => { const r = 0.55 + 0.45 * Math.cos(5 * t); return [r * Math.sin(t), r * Math.cos(t)]; });
  return {
    square: [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]],
    triangle: [[0, 1], [0.87, -0.5], [-0.87, -0.5], [0, 1]],
    star, heart,
    circle: linspace(0, 2 * Math.PI, 36).map(t => [Math.cos(t), Math.sin(t)]),
    // 동물·식물: 길 위에서 알아볼 만큼 굵은 실루엣(코·귀·꼬리 같은 특징 한두 개만)
    fish: [[1, 0], [0.7, 0.35], [0.3, 0.5], [-0.2, 0.42], [-0.55, 0.15], [-1, 0.5], [-0.85, 0], [-1, -0.5], [-0.55, -0.15], [-0.2, -0.42], [0.3, -0.5], [0.7, -0.35], [1, 0]],
    cat: [[-0.8, -0.6], [-0.95, 0], [-0.8, 0.45], [-0.75, 1], [-0.35, 0.62], [0.35, 0.62], [0.75, 1], [0.8, 0.45], [0.95, 0], [0.8, -0.6], [0.4, -0.9], [-0.4, -0.9], [-0.8, -0.6]],
    rabbit: [[-0.6, -0.7], [-0.75, -0.2], [-0.55, 0.2], [-0.6, 1], [-0.3, 1], [-0.2, 0.3], [0.2, 0.3], [0.3, 1], [0.6, 1], [0.55, 0.2], [0.75, -0.2], [0.6, -0.7], [0, -0.95], [-0.6, -0.7]],
    whale: [[1, -0.1], [0.85, 0.35], [0.4, 0.5], [-0.2, 0.4], [-0.6, 0.15], [-0.8, 0.6], [-1, 0.75], [-0.95, 0.35], [-0.75, 0], [-0.5, -0.3], [0, -0.45], [0.6, -0.45], [1, -0.1]],
    leaf: [[0, -1], [0.5, -0.5], [0.6, 0.1], [0.35, 0.6], [0, 1], [-0.35, 0.6], [-0.6, 0.1], [-0.5, -0.5], [0, -1]],
    tree: [[-0.15, -1], [-0.15, -0.45], [-0.8, -0.45], [-0.35, 0.05], [-0.65, 0.05], [-0.25, 0.5], [-0.45, 0.5], [0, 1], [0.45, 0.5], [0.25, 0.5], [0.65, 0.05], [0.35, 0.05], [0.8, -0.45], [0.15, -0.45], [0.15, -1], [-0.15, -1]],
    tulip: [[-0.6, 0.9], [-0.3, 0.55], [0, 0.95], [0.3, 0.55], [0.6, 0.9], [0.65, 0.2], [0.4, -0.25], [0.12, -0.35], [0.12, -1], [-0.12, -1], [-0.12, -0.35], [-0.4, -0.25], [-0.65, 0.2], [-0.6, 0.9]],
    flower,
    cactus: [[-0.2, -1], [-0.2, 0.1], [-0.55, 0.1], [-0.55, 0.6], [-0.35, 0.6], [-0.35, 0.3], [-0.2, 0.3], [-0.2, 1], [0.2, 1], [0.2, 0.45], [0.35, 0.45], [0.35, 0.8], [0.55, 0.8], [0.55, 0.25], [0.2, 0.25], [0.2, -1], [-0.2, -1]],
  };
}
export const SHAPE_KO = { star: '별', triangle: '세모', heart: '하트', square: '네모', circle: '동그라미',
  fish: '물고기', cat: '고양이', rabbit: '토끼', whale: '고래', leaf: '나뭇잎', tree: '나무', tulip: '튤립', flower: '꽃', cactus: '선인장', custom: '내 그림' };
export const EMOJI = { star: '⭐', triangle: '🔺', heart: '💗', square: '🟦', circle: '⭕',
  fish: '🐟', cat: '🐱', rabbit: '🐰', whale: '🐳', leaf: '🍃', tree: '🌲', tulip: '🌷', flower: '🌸', cactus: '🌵', custom: '🖼️' };
export const CATEGORY = {
  geo: ['star', 'triangle', 'heart', 'square', 'circle'],
  animal: ['fish', 'cat', 'rabbit', 'whale'],
  plant: ['leaf', 'tree', 'tulip', 'flower', 'cactus'],
};
// 그림 모양은 거꾸로 서면 못 알아본다 → ±30°까지만 돌린다. 세부가 있어 최소 크기도 키운다
export const isFigure = s => !CATEGORY.geo.includes(s);
export const FIGURE_ANGLES = [-30, -15, 0, 15, 30].map(d => d * Math.PI / 180);
export const FIGURE_MIN_SIZE = 600;

// ---------- 그래프 ----------
// G = { nodes: Map(id -> {x, y, adj: [[id, w, hw], ...]}) }
export function buildGraph(tiles, proj, radius, hwNames) {
  const pos = new Map();
  for (const t of tiles) for (const [id, la, lo] of t.n) if (!pos.has(id)) pos.set(id, proj.xy(la / 1e6, lo / 1e6));
  const nodes = new Map(), seen = new Set(), r2 = radius * radius;
  const inside = id => { const p = pos.get(id); return p && p[0] * p[0] + p[1] * p[1] <= r2; };
  const node = id => { let n = nodes.get(id); if (!n) { const p = pos.get(id); n = { x: p[0], y: p[1], adj: [] }; nodes.set(id, n); } return n; };
  for (const t of tiles) for (const [a, b, h] of t.e) {
    if (a === b || !inside(a) || !inside(b)) continue;
    const k = a < b ? a + ',' + b : b + ',' + a;
    if (seen.has(k)) continue; // 조각 경계 구간은 두 조각에 다 들어 있다
    seen.add(k);
    const na = node(a), nb = node(b), w = Math.hypot(na.x - nb.x, na.y - nb.y), hw = hwNames[h];
    na.adj.push([b, w, hw]); nb.adj.push([a, w, hw]);
  }
  // 가장 큰 연결 덩어리만
  const comp = new Map(); let best = null, bestN = 0, c = 0;
  for (const id of nodes.keys()) {
    if (comp.has(id)) continue;
    c++; let cnt = 0; const st = [id]; comp.set(id, c);
    while (st.length) { const u = st.pop(); cnt++; for (const [v] of nodes.get(u).adj) if (!comp.has(v)) { comp.set(v, c); st.push(v); } }
    if (cnt > bestN) { bestN = cnt; best = c; }
  }
  for (const id of [...nodes.keys()]) if (comp.get(id) !== best) nodes.delete(id);
  return { nodes, ids: [...nodes.keys()] };
}

// 최소 힙
class Heap {
  constructor() { this.a = []; }
  push(p, v) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

// A* (직선거리 하한) — 최단 경로를 돌려준다. 없으면 null
export function shortest(G, s, t) {
  if (s === t) return [s];
  const N = G.nodes, T = N.get(t), h = id => { const n = N.get(id); return Math.hypot(n.x - T.x, n.y - T.y); };
  const g = new Map([[s, 0]]), prev = new Map(), done = new Set(), q = new Heap();
  q.push(h(s), s);
  while (q.size) {
    const [, u] = q.pop();
    if (done.has(u)) continue;
    if (u === t) { const p = [t]; let k = t; while (k !== s) { k = prev.get(k); p.push(k); } return p.reverse(); }
    done.add(u);
    const gu = g.get(u);
    for (const [v, w] of N.get(u).adj) {
      const nv = gu + w;
      if (nv < (g.get(v) ?? Infinity)) { g.set(v, nv); prev.set(v, u); q.push(nv + h(v), v); }
    }
  }
  return null;
}

export function placeShape(unit, size, rot, cx, cy) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return unit.map(([x, y]) => [cx + size / 2 * (x * c - y * s), cy + size / 2 * (x * s + y * c)]);
}

// 나눌 칸 수: 변 길이가 간격의 정확한 배수인 경계(네모 1000 m ÷ 83.33 m = 12)에서는 cos·sin·hypot의 마지막 자리가
// Python과 JS에서 달라 11/12가 흔들렸다(10-07 대조: 경유점 49 vs 45). 두 판 모두 1e-6 여유를 두어 경계를 피한다
export function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const n = Math.max(1, Math.floor(Math.hypot(x2 - x1, y2 - y1) / step + 1e-6));
    for (let k = 1; k <= n; k++) out.push([x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n]);
  }
  return out;
}

export function nearest(G, p) {
  let best = null, bd = Infinity;
  for (const id of G.ids) { const n = G.nodes.get(id), d = (n.x - p[0]) ** 2 + (n.y - p[1]) ** 2; if (d < bd) { bd = d; best = id; } }
  return best;
}

export function route(G, target, step) {
  const snap = densify(target, step).map(p => nearest(G, p));
  const path = [snap[0]];
  for (let i = 0; i + 1 < snap.length; i++) {
    if (snap[i] === snap[i + 1]) continue;
    const seg = shortest(G, snap[i], snap[i + 1]);
    if (!seg) return null;
    path.push(...seg.slice(1));
  }
  return path;
}

// ---------- 점수 ----------
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const lineDist = (p, L) => { let m = Infinity; for (let i = 0; i + 1 < L.length; i++) m = Math.min(m, segDist(p, L[i], L[i + 1])); return m; };
const lineLen = L => { let s = 0; for (let i = 0; i + 1 < L.length; i++) s += Math.hypot(L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]); return s; };
function interp(L, d) {
  for (let i = 0; i + 1 < L.length; i++) {
    const s = Math.hypot(L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]);
    if (d <= s || i + 2 === L.length) { const t = s ? Math.min(1, d / s) : 0; return [L[i][0] + (L[i + 1][0] - L[i][0]) * t, L[i][1] + (L[i + 1][1] - L[i][1]) * t]; }
    d -= s;
  }
  return L[L.length - 1];
}
// 경로→모양 + 모양→경로 평균 거리 (한쪽만 재면 모양 일부를 건너뛰어도 점수가 좋아진다)
export function score(G, path, target) {
  const R = path.map(id => { const n = G.nodes.get(id); return [n.x, n.y]; });
  if (R.length < 2) return [Infinity, 0];
  const RL = lineLen(R), TL = lineLen(target);
  let k = Math.max(20, Math.floor(RL / 10)), s1 = 0;
  for (let i = 0; i <= k; i++) s1 += lineDist(interp(R, RL * i / k), target);
  let k2 = Math.max(20, Math.floor(TL / 10)), s2 = 0;
  for (let i = 0; i <= k2; i++) s2 += lineDist(interp(target, TL * i / k2), R);
  return [s1 / (k + 1) + s2 / (k2 + 1), RL];
}

// angles를 주면 그 회전만 본다(그림 모양은 ±30°). 없으면 rots등분 — Python판과 같다
export function search(G, unit, size, maxKm, { step, rots = 24, angles = null, shifts = [0], scales = [0.8, 1.0, 1.2], center = [0, 0] } = {}) {
  step = step || Math.max(40, size / 12);
  angles = angles || Array.from({ length: rots }, (_, r) => 2 * Math.PI * r / rots);
  let best = null;
  for (const sc of scales) for (const ang of angles) for (const dx of shifts) for (const dy of shifts) {
    const tgt = placeShape(unit, size * sc, ang, center[0] + dx, center[1] + dy);
    const p = route(G, tgt, step);
    if (!p) continue;
    const [s, L] = score(G, p, tgt);
    if (L > maxKm * 1000) continue;
    if (!best || s < best.dev) best = { dev: s, len: L, path: p, tgt };
  }
  return best;
}

// ---------- 원정 ----------
export const GOOD = new Set(['footway', 'pedestrian', 'path', 'living_street', 'residential', 'track', 'unclassified', 'cycleway']);

export function rng(seed) { // mulberry32 — 같은 시드면 같은 원정
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function candidates(G, start, radius) {
  const out = [];
  for (const id of G.ids) {
    const n = G.nodes.get(id), r = Math.hypot(n.x - start[0], n.y - start[1]);
    if (r < 0.5 * radius || r > radius || n.adj.length < 2) continue;
    if (n.adj.some(([, , hw]) => GOOD.has(hw))) out.push(id);
  }
  return out.sort((a, b) => a - b);
}

export const ekey = (a, b) => a < b ? a + '-' + b : b + '-' + a;

export function grade(devRatio, newFrac) {
  const g = devRatio < 0.04 ? 1 : devRatio < 0.07 ? 2 : devRatio < 0.10 ? 3 : devRatio < 0.15 ? 4 : 5;
  return Math.min(5, g + (newFrac < 0.3 ? 1 : 0));
}

const COMPASS = ['동', '북동', '북', '북서', '서', '남서', '남', '남동'];
const pathLen = (G, p) => { let s = 0; for (let i = 0; i + 1 < p.length; i++) { const a = G.nodes.get(p[i]), b = G.nodes.get(p[i + 1]); s += Math.hypot(a.x - b.x, a.y - b.y); } return s; };

// pick: 'all' | 'geo' | 'animal' | 'plant' | 'custom'. custom이면 custom = {name, pts}(단위 좌표 윤곽)
export function plan(G, proj, start, radius, size, seed, { pick = 'all', custom = null, onTry } = {}) {
  const R = rng(seed), cand = candidates(G, start, radius);
  if (!cand.length) throw new Error('조건에 맞는 도착지가 없어요 — 반경을 바꿔 보세요');
  if (pick === 'custom' && !(custom && custom.pts && custom.pts.length >= 4)) throw new Error('먼저 설정에서 내 그림을 올려 주세요');
  const pool = pick === 'all' ? [...CATEGORY.geo, ...CATEGORY.animal, ...CATEGORY.plant] : pick === 'custom' ? ['custom'] : CATEGORY[pick];
  const S = shapes(), s0 = nearest(G, start);
  let best = null, p = null, shape = null, sz = size;
  for (let i = 0; i < 8 && !best; i++) { // 모양을 못 그리는 자리면 다른 도착지
    p = cand[Math.floor(R() * cand.length)];
    shape = pool[Math.floor(R() * pool.length)];
    onTry && onTry(i + 1);
    const n = G.nodes.get(p), fig = isFigure(shape);
    sz = fig ? Math.max(size, FIGURE_MIN_SIZE) : size;
    best = search(G, shape === 'custom' ? custom.pts : S[shape], sz, 6,
      fig ? { angles: FIGURE_ANGLES, scales: [0.9, 1.1], center: [n.x, n.y] } : { rots: 12, scales: [0.9, 1.1], center: [n.x, n.y] });
  }
  if (!best) throw new Error('여덟 번 뽑아도 모양을 그릴 자리가 없었어요');
  const go = shortest(G, s0, best.path[0]), back = shortest(G, best.path[best.path.length - 1], s0);
  const full = [...go, ...best.path.slice(1), ...back.slice(1)];
  const edgeLen = {};
  let total = 0;
  for (let i = 0; i + 1 < full.length; i++) {
    const a = full[i], b = full[i + 1]; if (a === b) continue;
    const na = G.nodes.get(a), nb = G.nodes.get(b), w = Math.hypot(na.x - nb.x, na.y - nb.y);
    total += w; edgeLen[ekey(a, b)] = Math.round(w * 10) / 10;
  }
  const xs = best.tgt.map(q => q[0]), ys = best.tgt.map(q => q[1]);
  const usedSize = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / Math.SQRT2;
  const ll = id => { const n = G.nodes.get(id); return proj.ll(n.x, n.y).map(v => +v.toFixed(6)); };
  // 모양 한가운데(도착지 표시)와, 출발점에서 본 방향·거리
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const st = G.nodes.get(s0), ang = Math.atan2(cy - st.y, cx - st.x);
  const dir = COMPASS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  // 그리는 방향: 고리 경로의 부호 있는 넓이(y 위쪽) > 0 이면 반시계
  let area = 0;
  for (let i = 0; i + 1 < best.path.length; i++) { const a = G.nodes.get(best.path[i]), b = G.nodes.get(best.path[i + 1]); area += a.x * b.y - b.x * a.y; }
  return {
    id: new Date().toISOString().slice(2, 10).replaceAll('-', '') + '-' + seed, shape, seed,
    customName: shape === 'custom' ? custom.name || '내 그림' : null,
    star: ll(p), center: proj.ll(cx, cy).map(v => +v.toFixed(6)), loopStart: ll(best.path[0]),
    dir, distKm: +(Math.hypot(cx - st.x, cy - st.y) / 1000).toFixed(1), turn: area > 0 ? '반시계' : '시계',
    devM: +best.dev.toFixed(1), devRatio: +(best.dev / usedSize).toFixed(4), sizeM: Math.round(sz),
    goKm: +(pathLen(G, go) / 1000).toFixed(2), loopKm: +(best.len / 1000).toFixed(2), backKm: +(pathLen(G, back) / 1000).toFixed(2),
    totalKm: +(total / 1000).toFixed(2),
    goLL: go.map(ll), loopLL: best.path.map(ll), backLL: back.map(ll), fullLL: full.map(ll),
    tgtLL: best.tgt.map(([x, y]) => proj.ll(x, y)), edgeLen,
  };
}

export function done(rec, walked, stars) {
  let nw = 0, tot = 0;
  for (const [k, l] of Object.entries(rec.edgeLen)) { tot += l; if (!(k in walked)) nw += l; }
  const frac = tot ? nw / tot : 0;
  Object.assign(walked, rec.edgeLen);
  const star = { id: rec.id, date: rec.id.slice(0, 6), shape: rec.shape, name: rec.customName || null, ll: rec.center || rec.star, loopLL: rec.loopLL,
    newKm: +(nw / 1000).toFixed(2), newFrac: +frac.toFixed(3), grade: grade(rec.devRatio, frac) };
  stars.stars.push(star);
  return star;
}

export function mstLines(pts) {
  if (pts.length < 2) return [];
  const inn = new Set([0]), lines = [];
  while (inn.size < pts.length) {
    let best = null, bd = Infinity;
    for (const i of inn) for (let j = 0; j < pts.length; j++) if (!inn.has(j)) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < bd) { bd = d; best = [i, j]; }
    }
    lines.push([pts[best[0]], pts[best[1]]]); inn.add(best[1]);
  }
  return lines;
}

export function tileKeysAround(index, lat, lon, radiusM) {
  const dLat = radiusM / 110540, dLon = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
  const x0 = Math.floor((lon - dLon - index.lon0) / index.dlon), x1 = Math.floor((lon + dLon - index.lon0) / index.dlon);
  const y0 = Math.floor((lat - dLat - index.lat0) / index.dlat), y1 = Math.floor((lat + dLat - index.lat0) / index.dlat);
  const have = new Set(index.tiles), out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (have.has(x + '_' + y)) out.push(x + '_' + y);
  return out;
}
