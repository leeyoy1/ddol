// 올린 그림 → 걷기용 윤곽선(단위 좌표 [-1,1], y 위쪽, 닫힌 점 목록)
// 이미지는 저장하지 않는다. 결과 좌표만 폰에 남는다.
//   outlineFromRGBA(data, w, h) — data는 RGBA 바이트(canvas getImageData().data와 같은 꼴)

const N4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// 오츠 문턱값: 밝기 분포를 두 무리로 가장 잘 가르는 값
function otsu(lum) {
  const hist = new Array(256).fill(0);
  for (const v of lum) hist[v]++;
  const total = lum.length;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, th = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (sum - sB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; th = t; }
  }
  return th;
}

// 그림(1)·배경(0) 가르기 — 투명 픽셀이 충분하면 투명도로, 아니면 밝기로. 테두리에 더 많이 닿는 쪽이 배경이다
export function foregroundMask(data, w, h) {
  const n = w * h, alpha = new Uint8Array(n), lum = new Uint8Array(n);
  let clear = 0;
  for (let i = 0; i < n; i++) {
    const r = data[4 * i], g = data[4 * i + 1], b = data[4 * i + 2], a = data[4 * i + 3];
    alpha[i] = a; if (a < 128) clear++;
    // 투명 픽셀은 흰 바탕에 얹은 것으로 본다
    lum[i] = Math.round((0.299 * r + 0.587 * g + 0.114 * b) * a / 255 + 255 * (1 - a / 255));
  }
  const m = new Uint8Array(n);
  if (clear > n * 0.05) { for (let i = 0; i < n; i++) m[i] = alpha[i] >= 128 ? 1 : 0; return m; }
  const th = otsu(lum);
  for (let i = 0; i < n; i++) m[i] = lum[i] <= th ? 1 : 0; // 어두운 쪽을 일단 그림으로
  let edge1 = 0, edge = 0;
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { edge++; edge1 += m[y * w + x]; }
  for (let y = 1; y < h - 1; y++) for (const x of [0, w - 1]) { edge++; edge1 += m[y * w + x]; }
  if (edge1 > edge / 2) for (let i = 0; i < n; i++) m[i] ^= 1; // 어두운 쪽이 테두리를 덮으면 그쪽이 배경
  return m;
}

// 가장 큰 덩어리만 남긴다(4이웃)
export function largestBlob(m, w, h) {
  const lab = new Int32Array(w * h).fill(-1);
  let best = -1, bestN = 0, c = 0;
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || lab[s] >= 0) continue;
    let cnt = 0; const st = [s]; lab[s] = c;
    while (st.length) {
      const i = st.pop(); cnt++;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (m[j] && lab[j] < 0) { lab[j] = c; st.push(j); }
      }
    }
    if (cnt > bestN) { bestN = cnt; best = c; }
    c++;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = lab[i] === best ? 1 : 0;
  return { mask: out, size: bestN };
}

// 무어 이웃 추적 — 바깥 윤곽을 시계 방향(화면 좌표)으로 한 바퀴
const M8 = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
export function traceContour(m, w, h) {
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  let sx = -1, sy = -1;
  outer: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) { sx = x; sy = y; break outer; }
  if (sx < 0) return [];
  const pts = [[sx, sy]];
  let cx = sx, cy = sy, back = 0; // 들어온 쪽(왼쪽)부터 시계 방향으로 훑는다
  for (let guard = 0; guard < 4 * w * h; guard++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (back + k) % 8, nx = cx + M8[d][0], ny = cy + M8[d][1];
      if (at(nx, ny)) {
        cx = nx; cy = ny; back = (d + 6) % 8; found = true; break; // 다음엔 직전 이웃의 반대편 근처부터
      }
    }
    if (!found) break; // 점 하나뿐
    if (cx === sx && cy === sy) break;
    pts.push([cx, cy]);
  }
  pts.push([sx, sy]);
  return pts;
}

// 라머-더글러스-포이커 단순화
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = -1, dmax = 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  for (let i = 1; i < pts.length - 1; i++) {
    const d = L ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L : Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

// 닫힌 윤곽은 가장 먼 두 점에서 나눠 각각 단순화한다(시작점이 곧 끝점이면 RDP가 퇴화한다)
export function simplifyClosed(pts, maxPts = 40) {
  const ring = pts.slice(0, -1);
  let far = 0, fd = 0;
  for (let i = 1; i < ring.length; i++) { const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]); if (d > fd) { fd = d; far = i; } }
  for (let eps = 0.8; eps < 50; eps *= 1.3) {
    const A = rdp(ring.slice(0, far + 1), eps), B = rdp([...ring.slice(far), ring[0]], eps);
    const out = [...A.slice(0, -1), ...B];
    if (out.length <= maxPts + 1) return out;
  }
  return null;
}

export function outlineFromRGBA(data, w, h, { maxPts = 40 } = {}) {
  const { mask, size } = largestBlob(foregroundMask(data, w, h), w, h);
  if (size < w * h * 0.03) throw new Error('그림을 찾지 못했어요 — 배경과 대비가 뚜렷한 그림을 써 주세요');
  if (size > w * h * 0.97) throw new Error('그림과 배경을 가르지 못했어요 — 단색 바탕 위의 그림을 써 주세요');
  const c = traceContour(mask, w, h);
  const s = simplifyClosed(c, maxPts);
  if (!s || s.length < 4) throw new Error('윤곽이 너무 단순하거나 복잡해요'); // 세모 = 꼭짓점 3 + 닫는 점
  return normalizeOutline(s);
}

// 화면 좌표 윤곽 → 단위 좌표(가운데 0, 긴 변 반지름 1). 화면 y는 아래쪽 → 뒤집는다
export function normalizeOutline(s) {
  const xs = s.map(p => p[0]), ys = s.map(p => p[1]);
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 || 1;
  return s.map(([x, y]) => [+((x - mx) / half).toFixed(3), +(-(y - my) / half).toFixed(3)]);
}

// 손가락으로 그린 자국(열린 선, 화면 좌표) → 닫힌 단위 윤곽. 끝점을 첫 점에 이어 닫는다
export function strokeToOutline(pts, { maxPts = 40 } = {}) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (pts.length < 3 || ext < 20) throw new Error('그림이 너무 작아요 — 칸을 크게 써서 그려 주세요');
  const s = simplifyClosed([...pts, pts[0]], maxPts);
  if (!s || s.length < 4) throw new Error('모양을 알아보지 못했어요 — 다시 그려 주세요');
  return normalizeOutline(s);
}
