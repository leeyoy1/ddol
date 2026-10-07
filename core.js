// 글자 산책 · 별자리 산책 — 계산부 (walk_shape.py · expedition.py의 JS 판)
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
  fish: '물고기', cat: '고양이', rabbit: '토끼', whale: '고래', leaf: '나뭇잎', tree: '나무', tulip: '튤립', flower: '꽃', cactus: '선인장', custom: '내 도안' };
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
  const ids = [...nodes.keys()];
  // 50 m 격자 색인 — 가장 가까운 교차점 찾기를 전체 훑기에서 주변 칸 훑기로(10-08 검토: 경유점마다 전체를 훑어 수 초 걸림)
  const grid = new Map();
  ids.forEach((id, ord) => { const n = nodes.get(id); n.ord = ord; const k = Math.floor(n.x / CELL) + ',' + Math.floor(n.y / CELL); (grid.get(k) || grid.set(k, []).get(k)).push(id); });
  return { nodes, ids, grid };
}

// 최소 힙
class Heap {
  constructor() { this.a = []; }
  push(p, v) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

// A* (직선거리 하한) — 최단 경로를 돌려준다. 없으면 null
// enter(v)를 주면 마디 v로 들어가는 구간 길이에 곱할 배수(≥1)를 준다 — 배수가 1 이상이라 직선거리 하한은 그대로 맞다
export function shortest(G, s, t, enter = null) {
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
      const nv = gu + (enter ? w * enter(v) : w);
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

const CELL = 50;
// 격자 칸을 안쪽부터 넓혀 가며 찾는다. 결과는 전체 훑기와 같다(같은 거리면 먼저 들어온 마디 — Python판과 같은 동률 처리)
export function nearest(G, p) {
  if (!G.grid) { // 색인 없는 그래프(시험용)
    let best = null, bd = Infinity;
    for (const id of G.ids) { const n = G.nodes.get(id), d = (n.x - p[0]) ** 2 + (n.y - p[1]) ** 2; if (d < bd) { bd = d; best = id; } }
    return best;
  }
  const cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL);
  let best = null, bd = Infinity, bo = Infinity;
  for (let r = 0; r < 400; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // 고리 한 겹만
      for (const id of G.grid.get((cx + dx) + ',' + (cy + dy)) || []) {
        const n = G.nodes.get(id), d = (n.x - p[0]) ** 2 + (n.y - p[1]) ** 2;
        if (d < bd || (d === bd && n.ord < bo)) { bd = d; best = id; bo = n.ord; }
      }
    }
    // r겹까지 본 칸 밖의 점은 적어도 r·CELL 떨어져 있다
    if (best !== null && Math.sqrt(bd) <= r * CELL) return best;
  }
  return best;
}

// corridor > 0 이면 「통로 경로」: 모양 선에서 d만큼 떨어진 마디로 들어가는 비용에 (1 + corridor·(d/σ)²)를 곱한다.
// 경유점 사이를 그냥 최단 길로 잇지 않고 모양 선을 따라가는 길을 고른다(10-08, 닮음 개선)
export function route(G, target, step, corridor = 0, sigma = 30) {
  const snap = densify(target, step).map(p => nearest(G, p));
  const path = [snap[0]];
  let enter = null;
  if (corridor > 0) {
    const memo = new Map();
    enter = v => {
      let m = memo.get(v);
      if (m === undefined) { const n = G.nodes.get(v); const d = lineDist([n.x, n.y], target) / sigma; m = 1 + corridor * d * d; memo.set(v, m); }
      return m;
    };
  }
  for (let i = 0; i + 1 < snap.length; i++) {
    if (snap[i] === snap[i + 1]) continue;
    const seg = shortest(G, snap[i], snap[i + 1], enter);
    if (!seg) return null;
    path.push(...seg.slice(1));
  }
  if (corridor <= 0) return path;
  // 모양 선에서 σ 넘게 벗어난 끝점만 잔가지로 본다 — 별의 뾰족한 끝처럼 모양이 원래 「갔다 오는」 자리는 남긴다(10-08 비교 그림에서 별 팔이 잘림)
  const off = v => { const n = G.nodes.get(v); return lineDist([n.x, n.y], target) > sigma; };
  return prune(path, off);
}

// 잔가지 잘라내기: …A→B→A… 처럼 들어갔다 그대로 되돌아 나오는 구간을 지운다(경유점 하나를 찍으려 막다른 길에 들어간 자국).
// 닫힌 고리의 처음·끝은 건드리지 않는다
export function prune(path, off = () => true) {
  const out = [];
  for (const v of path) {
    if (out.length >= 2 && out[out.length - 2] === v && off(out[out.length - 1])) { out.pop(); continue; }
    out.push(v);
  }
  return out;
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
// 이산 프레셰 거리: 두 선을 같은 방향으로만 나아가며 짝지을 때 필요한 가장 긴 줄 — 순서가 엉키거나 되돌아 나오면 커진다.
// 평균 거리(score)는 잔가지가 모양 근처를 찔러 주면 오히려 좋아지는 구멍이 있어(10-08 측정) 닮음 판정에 함께 쓴다
export function frechet(A, B, n = 80) {
  const rs = L => { const T = lineLen(L); return Array.from({ length: n }, (_, i) => interp(L, T * i / (n - 1))); };
  const P = rs(A), Q = rs(B), prev = new Float64Array(n), cur = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d = Math.hypot(P[i][0] - Q[j][0], P[i][1] - Q[j][1]);
      const m = i === 0 && j === 0 ? 0 : i === 0 ? cur[j - 1] : j === 0 ? prev[j] : Math.min(prev[j], prev[j - 1], cur[j - 1]);
      cur[j] = Math.max(d, m);
    }
    prev.set(cur);
  }
  return prev[n - 1];
}

// order = true 면 고르는 기준을 「평균 거리 + 프레셰 거리/2」로 — 순서·잔가지까지 본다(통로 방식과 함께 쓴다)
export function search(G, unit, size, maxKm, { step, rots = 24, angles = null, shifts = [0], scales = [0.8, 1.0, 1.2], center = [0, 0], corridor = 0, sparse = 1, order = false } = {}) {
  step = (step || Math.max(40, size / 12)) * sparse; // sparse > 1 이면 경유점을 성기게 — 사이는 통로 비용이 모양을 따라가게 한다
  angles = angles || Array.from({ length: rots }, (_, r) => 2 * Math.PI * r / rots);
  let best = null;
  for (const sc of scales) for (const ang of angles) for (const dx of shifts) for (const dy of shifts) {
    const tgt = placeShape(unit, size * sc, ang, center[0] + dx, center[1] + dy);
    const p = route(G, tgt, step, corridor, Math.max(25, size * sc / 16));
    if (!p) continue;
    const [s, L] = score(G, p, tgt);
    if (L > maxKm * 1000) continue;
    const fr = order ? frechet(p.map(id => { const n = G.nodes.get(id); return [n.x, n.y]; }), tgt) : 0;
    const key = order ? s + fr / 2 : s;
    if (!best || key < best.key) best = { dev: s, fr, key, len: L, path: p, tgt };
  }
  return best;
}

// ---------- 산책 ----------
export const GOOD = new Set(['footway', 'pedestrian', 'path', 'living_street', 'residential', 'track', 'unclassified', 'cycleway']);

export function rng(seed) { // mulberry32 — 같은 시드면 같은 산책
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

// 현지 날짜 yymmdd — toISOString은 UTC라 한국 새벽 0~9시 산책이 하루 전 날짜로 찍혔다(10-08 검토)
const localYmd = (d = new Date()) => String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
const COMPASS = ['동', '북동', '북', '북서', '서', '남서', '남', '남동'];
const pathLen = (G, p) => { let s = 0; for (let i = 0; i + 1 < p.length; i++) { const a = G.nodes.get(p[i]), b = G.nodes.get(p[i + 1]); s += Math.hypot(a.x - b.x, a.y - b.y); } return s; };

// pick: 'all' | 'geo' | 'animal' | 'plant' | 'custom'. custom이면 custom = {name, pts}(단위 좌표 윤곽)
// near: [[x,y],…] 를 주면 그 지점들 150 m 안의 도착지만 뽑는다(맛집 경유). 하나도 없으면 조건 없이 뽑는다
// end: [x,y]를 주면 돌아오는 길이 출발점 대신 거기서 끝난다(편도 「끝에서 시작」). 모양 자리는 그대로 출발점 둘레
// maxTotalKm: 주면 모두 걷는 거리가 이것을 넘는 자리는 다시 뽑는다(「분으로 보기」 — 점심시간을 넘기지 않게). 다 넘으면 가장 짧은 것
export function plan(G, proj, start, radius, size, seed, { pick = 'all', custom = null, onTry, near = null, end = null, maxTotalKm = null } = {}) {
  const R = rng(seed);
  let cand = candidates(G, start, radius);
  if (near && near.length) {
    const close = cand.filter(id => { const n = G.nodes.get(id); return near.some(([x, y]) => (n.x - x) ** 2 + (n.y - y) ** 2 < 150 * 150); });
    if (close.length) cand = close;
  }
  if (!cand.length) throw new Error('갈 만한 곳을 찾지 못했어요. 설정에서 거리를 바꿔 보세요.');
  if (pick === 'custom' && !(custom && custom.pts && custom.pts.length >= 4)) throw new Error('먼저 도감에서 내 도안을 만들어 주세요.');
  const pool = pick === 'all' ? [...CATEGORY.geo, ...CATEGORY.animal, ...CATEGORY.plant] : pick === 'custom' ? ['custom'] : CATEGORY[pick];
  const S = shapes(), s0 = nearest(G, start), e0 = end ? nearest(G, end) : s0;
  const walkKm = b => (pathLen(G, shortest(G, s0, b.path[0])) + b.len + pathLen(G, shortest(G, b.path[b.path.length - 1], e0))) / 1000;
  let best = null, p = null, shape = null, sz = size, spare = null;
  for (let i = 0; i < (maxTotalKm ? 14 : 8) && !best; i++) { // 모양을 못 그리는 자리면 다른 도착지
    p = cand[Math.floor(R() * cand.length)];
    shape = pool[Math.floor(R() * pool.length)];
    onTry && onTry(i + 1);
    const n = G.nodes.get(p), fig = isFigure(shape);
    sz = fig ? Math.max(size, FIGURE_MIN_SIZE) : size;
    // 통로 경로 + 성긴 경유점 + 순서 닮음 + 자리 9곳(10-08 bench_shape: 프레셰 18.4→12.7%, 길이비 1.90→1.50, 계산 0.04→0.35 s)
    const SHAPE_MODE = { corridor: 6, sparse: 2, order: true, shifts: [-sz / 8, 0, sz / 8] };
    // 모양 길 상한: 목표 둘레(≈π·지름)의 2.2배 — 넘으면 다른 도착지(짧게 고른 사람에게 5 km가 나오던 일, 10-08 가상 테스트)
    const maxLoopKm = Math.max(1.5, sz * Math.PI / 1000 * 2.2);
    best = search(G, shape === 'custom' ? custom.pts : S[shape], sz, maxLoopKm,
      fig ? { angles: FIGURE_ANGLES, scales: [0.9, 1.1], center: [n.x, n.y], ...SHAPE_MODE } : { rots: 12, scales: [0.9, 1.1], center: [n.x, n.y], ...SHAPE_MODE });
    if (best && maxTotalKm) { // 시간 예산을 넘으면 기억만 해 두고 다시 뽑는다(10-08 실측: 같은 설정에서 총거리가 가운데값의 1.5배까지 벌어짐)
      const km = walkKm(best);
      if (km > maxTotalKm) { if (!spare || km < spare.km) spare = { km, best, p, shape, sz }; best = null; }
    }
  }
  if (!best && spare) ({ best, p, shape, sz } = spare);
  if (!best) throw new Error('이 근처엔 모양을 그릴 자리가 없었어요. 다른 출발점을 골라 보세요.');
  const gold = R() < 1 / 12; // 반짝 산책(희귀) — 시드가 같으면 같다
  const go = shortest(G, s0, best.path[0]), back = shortest(G, best.path[best.path.length - 1], e0);
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
    id: localYmd() + '-' + seed, shape, seed,
    customName: shape === 'custom' ? custom.name || '내 그림' : null, designId: shape === 'custom' ? custom.id || null : null, gold,
    star: ll(p), center: proj.ll(cx, cy).map(v => +v.toFixed(6)), loopStart: ll(best.path[0]),
    dir, distKm: +(Math.hypot(cx - st.x, cy - st.y) / 1000).toFixed(1), turn: area > 0 ? '반시계' : '시계',
    devM: +best.dev.toFixed(1), devRatio: +(best.dev / usedSize).toFixed(4), sizeM: Math.round(sz), likeness: likeness(best.fr / usedSize),
    goKm: +(pathLen(G, go) / 1000).toFixed(2), loopKm: +(best.len / 1000).toFixed(2), backKm: +(pathLen(G, back) / 1000).toFixed(2),
    totalKm: +(total / 1000).toFixed(2), oneWay: !!end,
    goLL: go.map(ll), loopLL: best.path.map(ll), backLL: back.map(ll), fullLL: full.map(ll),
    tgtLL: best.tgt.map(([x, y]) => proj.ll(x, y)), edgeLen,
  };
}

// 닮음 별점(1~5): 순서 닮음(프레셰 ÷ 지름) — 10-08 측정 30건의 분포(중앙 12.7%)에 맞춘 구간
export const likeness = r => r < 0.08 ? 5 : r < 0.11 ? 4 : r < 0.15 ? 3 : r < 0.2 ? 2 : 1;

// 걸은 기록이 모양 길(고리)을 얼마나 지났나: 고리를 20 m 간격으로 나눠 40 m 안에 걸은 점이 있는 비율
// skipLL: 「여긴 못 걷겠다」를 누른 자리들 — 그 SKIP_M 안의 고리 점은 분자·분모에서 함께 뺀다(계단·끊긴 보도도 별이 되게)
export const SKIP_M = 25, SKIP_MAX = 0.4; // 반경 25 m(한 골목 구간) — 60 m는 작은 모양(점심 30분 칸)에서 한 번 누르면 절반이 빠졌다(10-08: 105곳 중 60곳이 40% 초과). 상한을 넘으면 판정이 빈 껍데기가 된다
// 판정 규칙 판번호(별의 판정 쪽지에 남는다): 1 = 닮음으로 등급(10-07 첫 판), 2 = 모양 길 60% 지나기, 3 = 2 + 못 걷는 길 빼기·약속·정각
export const RULE_V = 3, NEED = 0.6;
function loopSamples(loopLL, step) {
  const k = Math.cos(loopLL[0][0] * Math.PI / 180) * 111320, xy = ([a, b]) => [b * k, a * 110540];
  return { xy, pts: densify(loopLL.map(xy), step) };
}
const nearAny = (p, Q, r) => Q.some(q => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 <= r * r);
export function skippedFrac(loopLL, skipLL, step = 20) {
  if (!loopLL.length || !skipLL || !skipLL.length) return 0;
  const { xy, pts } = loopSamples(loopLL, step), S = skipLL.map(xy);
  return pts.filter(p => nearAny(p, S, SKIP_M)).length / pts.length;
}
export function coverage(loopLL, trackLL, step = 20, near = 40, skipLL = []) {
  if (!loopLL.length || !trackLL.length) return 0;
  const { xy, pts } = loopSamples(loopLL, step), Tr = trackLL.map(xy), S = (skipLL || []).map(xy);
  const keep = S.length ? pts.filter(p => !nearAny(p, S, SKIP_M)) : pts;
  if (!keep.length) return 0;
  return keep.filter(p => nearAny(p, Tr, near)).length / keep.length;
}
// 별 등급은 실제로 따라 걸은 비율로: 90%↑ 1등성 · 80%↑ 2 · 70%↑ 3 · 그 밖 4 (새 길이 30% 미만이면 한 등급 어둡게)
export const gradeByCoverage = (cov, newFrac) => Math.min(5, (cov >= 0.9 ? 1 : cov >= 0.8 ? 2 : cov >= 0.7 ? 3 : 4) + (newFrac < 0.3 ? 1 : 0));

// kept: 약속한 시각에 걷기 시작함 → 한 등급 밝게 · ontime: 돌아갈 시각과의 차(초, 1분 안일 때만) · skipped: 뺀 몫
export function done(rec, walked, stars, { coverage: cov = null, walkedKm = null, skipped = 0, kept = false, ontime = null } = {}) {
  let nw = 0, tot = 0;
  for (const [k, l] of Object.entries(rec.edgeLen)) { tot += l; if (!(k in walked)) nw += l; }
  const frac = tot ? nw / tot : 0;
  Object.assign(walked, rec.edgeLen);
  const star = { id: rec.id, date: rec.id.slice(0, 6), shape: rec.shape, name: rec.customName || null, designId: rec.designId || null,
    gold: !!rec.gold, dong: rec.dong || null, mats: rec.mats || [], totalKm: rec.totalKm || 0, ll: rec.center || rec.star, loopLL: rec.loopLL,
    newKm: +(nw / 1000).toFixed(2), newFrac: +frac.toFixed(3), grade: cov == null ? grade(rec.devRatio, frac) : Math.max(1, gradeByCoverage(cov, frac) - (kept ? 1 : 0)),
    coverage: cov == null ? null : +cov.toFixed(2), walkedKm };
  if (cov != null) Object.assign(star, { rule: RULE_V, skipped: +skipped.toFixed(2), kept: !!kept, ontime });
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
