// 동네 별자리 — 폰 화면. 계산은 core.js, 그림 윤곽은 outline.js, 도로망은 tiles/ (make_tiles.py 산출)
import * as C from './core.js';
import { outlineFromRGBA, strokeToOutline } from './outline.js';
import * as K from './collect.js';

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('ws_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ws_' + k, JSON.stringify(v)); return true; } catch { status('폰 저장 공간에 쓰지 못했어요. 설정의 「기록 내보내기」로 백업해 두세요.'); return false; } },
};
const status = t => { $('status').textContent = t; };
// 색은 index.html :root 토큰에서 읽는다(밤하늘에선 같은 이름이 남색 값으로 바뀐다)
const T = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// 툴팁·라벨·안내판은 HTML로 들어간다 — 가져온 기록 파일·파일 이름의 글이 코드로 실행되지 않게 바꿔 넣는다
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shapeName = p => p.shape === 'custom' ? (p.customName || p.name || '내 도안') : C.SHAPE_KO[p.shape] || '';
const stars5 = n => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
const emoji = s => C.EMOJI[s] || '⭐';
// 내 도안집 — 예전 판의 단일 「내 그림」은 도안 하나로 옮긴다
const designs = () => store.get('designs', []);
(() => {
  const old = store.get('custom', null);
  if (old && !designs().length) { store.set('designs', [{ id: 'd' + Date.now(), name: old.name, pts: old.pts, made: 'image' }]); store.set('activeDesign', designs()[0].id); }
  try { localStorage.removeItem('ws_custom'); } catch { /* 없으면 그만 */ }
})();
const activeDesign = () => designs().find(d => d.id === store.get('activeDesign', null)) || designs()[designs().length - 1] || null;
function addDesign(name, pts, made) {
  const d = { id: 'd' + Date.now(), name: (name || '내 도안').slice(0, 20), pts, made };
  store.set('designs', [...designs(), d].slice(-24)); store.set('activeDesign', d.id); store.set('pick', 'custom');
  return d;
}
// 받침 있으면 을, 없으면 를(한글이 아니면 「을(를)」)
const eulReul = w => { const c = w.charCodeAt(w.length - 1); return c >= 0xAC00 && c <= 0xD7A3 ? ((c - 0xAC00) % 28 ? '을' : '를') : '을(를)'; };
// 위 안내·아래 안내판에 가리지 않게 지도를 맞춘다
const fit = (b, pad = 24) => map.fitBounds(b, { maxZoom: 16, paddingTopLeft: [pad, $('top').offsetHeight + pad], paddingBottomRight: [pad, $('sheet').offsetHeight + pad] });

// ---------- 지도 ----------
const map = L.map('map', { zoomControl: false }).setView([37.5665, 126.978], 13);
let base = null, mode = 'plan';
function setBase(kind, night) {
  if (base) map.removeLayer(base);
  const key = store.get('vwkey', '');
  if (kind.startsWith('vw-') && key) {
    // V-World WMTS (국토교통부 공간정보 오픈플랫폼). 밤하늘에서는 야간(midnight) 지도를 쓴다
    const layer = night ? 'midnight' : kind.slice(3), ext = layer === 'Satellite' ? 'jpeg' : 'png';
    base = L.tileLayer(`https://api.vworld.kr/req/wmts/1.0.0/${key}/${layer}/{z}/{y}/{x}.${ext}`,
      { maxZoom: 19, maxNativeZoom: 18, minZoom: 6, attribution: '© 국토교통부 V-World' });
    base.on('tileerror', () => status('V-World 지도를 못 불러왔어요. 키와 등록한 주소를 확인해 주세요.'));
  } else {
    base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자', className: night ? 'night' : '' });
  }
  base.addTo(map);
}
setBase(store.get('base', 'osm'), false);

// 말풍선 핀: 꼬리 끝이 그 지점을 가리킨다
const pin = (ll, e, text, color, cls = '') => L.marker(ll, {
  icon: L.divIcon({ className: 'pinwrap', iconSize: null, html: `<div class="pin ${cls}" style="--c:${color}"><span class="e">${e}</span>${text ? `<span>${esc(text)}</span>` : ''}</div>` }),
  zIndexOffset: cls.includes('big') ? 1000 : 500,
});

const planLayer = L.layerGroup().addTo(map), skyLayer = L.layerGroup(), meLayer = L.layerGroup().addTo(map);
let start = null, startMarker = null, plan = store.get('plan', null), track = [], watchId = null;

function setStart(lat, lon, why) {
  start = [lat, lon];
  if (startMarker) map.removeLayer(startMarker);
  startMarker = pin(start, '🚩', '출발', 'var(--path-go)').addTo(map);
  status(`${why} 출발할게요. 「산책 뽑기」를 눌러 보세요.`);
}
map.on('click', e => {
  if (mode !== 'plan' || watchId != null) return;
  if (plan) return status('지금 산책이 있어요. 새로 뽑으려면 「산책 뽑기」를 다시 누르세요.'); // 산책 중에 출발 핀만 옮겨지면 헷갈린다
  setStart(e.latlng.lat, e.latlng.lng, '여기서');
});

$('bLoc').onclick = () => {
  if (!navigator.geolocation) { const c = map.getCenter(); return setStart(c.lat, c.lng, '지도 가운데에서'); }
  status('위치를 찾는 중…');
  navigator.geolocation.getCurrentPosition(p => {
    map.setView([p.coords.latitude, p.coords.longitude], 15);
    setStart(p.coords.latitude, p.coords.longitude, '지금 자리에서');
  }, () => { const c = map.getCenter(); setStart(c.lat, c.lng, '위치를 받지 못해 지도 가운데에서'); }, { enableHighAccuracy: true, timeout: 15000 });
};

// ---------- 산책 계산: 작업자에서(화면이 굳지 않게). 작업자를 못 쓰는 브라우저는 화면 쪽에서 같은 코드로 ----------
let worker = null;
try { worker = new Worker('plan_worker.js', { type: 'module' }); } catch { worker = null; }
function planAsync(params) {
  if (!worker) return import('./plan_job.js').then(m => m.runPlan(params));
  return new Promise((ok, bad) => {
    worker.onmessage = e => e.data.ok ? ok(e.data.plan) : bad(new Error(e.data.msg));
    worker.onerror = () => { worker = null; import('./plan_job.js').then(m => m.runPlan(params)).then(ok, bad); };
    worker.postMessage(params);
  });
}

// 도착지 근처 이름(OpenStreetMap 역지오코딩) — 도착지 좌표만 보낸다. 실패하면 이름 없이 간다
async function placeName(ll) {
  try {
    const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=ko&lat=${ll[0]}&lon=${ll[1]}`;
    const r = await fetch(u);
    if (!r.ok) return { label: null, dong: null, failed: true };
    const j = await r.json(), a = j.address || {};
    const dong = a.quarter || a.suburb || a.neighbourhood || a.city_district || null; // 동네 스탬프 단위
    const parts = [j.name, a.road || a.pedestrian || a.footway, dong];
    return { label: [...new Set(parts.filter(Boolean))].slice(0, 2).join(' · ') || null, dong };
  } catch { return { label: null, dong: null, failed: true }; }
}

// ---------- 시청 단골집 (mat.json · mat_build.py 산출, 없으면 이 기능과 화면은 숨는다) ----------
let MAT = undefined;
const TIER_TXT = ['', '', '상위 20%', '상위 5%'];
async function loadMat() {
  if (MAT !== undefined) return MAT;
  try { const r = await fetch('mat.json'); MAT = r.ok ? (await r.json()).places : null; } catch { MAT = null; }
  $('matSet').hidden = $('matDex').hidden = !MAT;
  return MAT;
}
// 경로 점(위경도) 60 m 안의 맛집
function matsOnRoute(ll) {
  if (!MAT || !ll.length) return [];
  const k = Math.cos(ll[0][0] * Math.PI / 180) * 111320, R2 = 60 * 60;
  const lats = ll.map(p => p[0]), lons = ll.map(p => p[1]);
  const bb = [Math.min(...lats) - 0.001, Math.max(...lats) + 0.001, Math.min(...lons) - 0.001, Math.max(...lons) + 0.001];
  return MAT.filter(m => m.ll[0] > bb[0] && m.ll[0] < bb[1] && m.ll[1] > bb[2] && m.ll[1] < bb[3])
    .filter(m => ll.some(([a, b]) => ((a - m.ll[0]) * 110540) ** 2 + ((b - m.ll[1]) * k) ** 2 < R2))
    .map(m => ({ k: m.n + '|' + m.a, n: m.n, a: m.a, t: m.t, v: m.v, ll: m.ll }));
}

// 길 위 단골집: 출발해서 몇 km쯤에 지나는지(경로 점 누적 거리) 순서로
const matMarkers = new Map();
function matListHtml(p) {
  const ms = p.mats || [];
  if (!ms.length) return '';
  const cum = [0];
  for (let i = 1; i < p.fullLL.length; i++) cum.push(cum[i - 1] + map.distance(p.fullLL[i - 1], p.fullLL[i]));
  const at = m => { let bi = 0, bd = Infinity; p.fullLL.forEach((q, i) => { const d = map.distance(q, m.ll); if (d < bd) { bd = d; bi = i; } }); return cum[bi] / 1000; };
  const rows = ms.map(m => ({ m, km: at(m) })).sort((a, b) => a.km - b.km);
  return `<details class="mats"><summary>길 위 시청 단골집 ${ms.length}곳</summary>${rows.map(({ m, km }) =>
    `<button class="matrow" data-mat="${esc(m.k)}"><span><b>${esc(m.n)}</b><br><small>${esc(m.a)}</small></span><small>출발 후 ${km.toFixed(1)} km<br>결제 ${esc(Number(m.v).toLocaleString())}건${TIER_TXT[m.t] ? ' · ' + TIER_TXT[m.t] : ''}</small></button>`).join('')}</details>`;
}

// ---------- 산책 ----------
function drawPlan(p) {
  planLayer.clearLayers();
  $('sheet').classList.toggle('active', !!p);
  if (!p) { $('info').innerHTML = ''; return; }
  const legacy = !p.goLL; // 예전 판 산책(가는 길·돌아오는 길 구분 없음)
  L.polyline(p.tgtLL, { color: T('--path-back'), dashArray: '4 6', weight: 2 }).addTo(planLayer);
  if (legacy) L.polyline(p.fullLL, { color: T('--accent'), weight: 5, opacity: .85 }).addTo(planLayer);
  else {
    L.polyline(p.goLL, { color: T('--path-go'), weight: 5, opacity: .85, dashArray: '1 9', lineCap: 'round' }).addTo(planLayer);
    L.polyline(p.backLL, { color: T('--path-back'), weight: 4, opacity: .7, dashArray: '1 9', lineCap: 'round' }).addTo(planLayer);
    L.polyline(p.loopLL, { color: T('--accent'), weight: 6, opacity: .9 }).addTo(planLayer);
    pin(p.loopStart, '✏️', '여기서 그리기 시작', 'var(--accent)', 'below').addTo(planLayer);
  }
  // 도착 핀은 모양 위쪽 가장자리에 — 가운데에 두면 그릴 모양을 덮는다
  const topLat = Math.max(...p.tgtLL.map(q => q[0])), midLon = p.tgtLL.reduce((s, q) => s + q[1], 0) / p.tgtLL.length;
  pin(legacy ? p.star : [topLat, midLon], emoji(p.shape), `${p.gold ? '반짝 ' : ''}${shapeName(p)} 그리는 곳`, p.gold ? 'var(--gold)' : 'var(--navy)', p.gold ? 'big gold' : 'big').addTo(planLayer);
  matMarkers.clear();
  for (const m of p.mats || []) matMarkers.set(m.k, L.marker(m.ll, { icon: L.divIcon({ className: 'mpin t' + m.t, iconSize: null, html: '<div>단</div>' }) })
    .addTo(planLayer).bindTooltip(esc(`${m.n} · 시청 결제 ${esc(Number(m.v).toLocaleString())}건`)));
  const e = emoji(p.shape), n = esc(shapeName(p));
  $('info').innerHTML = legacy
    ? `<div class="ttl">${e} ${n} 산책 <span class="sub">왕복 ${p.totalKm} km</span></div>`
    : `<div class="ttl">${p.gold ? '반짝 ' : ''}${e} ${n} 산책 <span class="sub">${p.dir}쪽 ${p.distKm} km</span></div>
       <div class="where">도착 <span id="place">${p.place ? esc(p.place) : '근처 이름을 찾는 중…'}</span></div>
       <ol class="steps">
         <li><i class="sw go"></i><span>✏️까지 가기</span><b>${p.goKm} km</b></li>
         <li><i class="sw loop"></i><span>${n} 그리며 한 바퀴(${p.turn} 방향)</span><b>${p.loopKm} km</b></li>
         <li><i class="sw back"></i><span>출발점으로 돌아오기</span><b>${p.backKm} km</b></li>
       </ol>
       ${matListHtml(p)}
       <div class="meta">모두 ${p.totalKm} km${p.likeness ? ` · 길이 모양을 닮은 정도 ${stars5(p.likeness)}(별이 많을수록 또렷해요)` : ''} · 모양 길(파란 실선)의 60%를 지나면 별이 돼요</div>`;
  $('bWalk').disabled = $('bGpx').disabled = false;
  $('bDone').disabled = !(store.get('track', null)?.id === p.id);
  // 가게를 누르면 목록을 접고(지도를 가리지 않게) 그 가게로 간다
  for (const b of document.querySelectorAll('[data-mat]')) b.onclick = () => {
    const m = (p.mats || []).find(x => x.k === b.dataset.mat); if (!m) return;
    b.closest('details').open = false;
    map.once('moveend', () => matMarkers.get(m.k)?.openTooltip());
    map.flyTo(m.ll, 17, { duration: 0.6 });
  };
  fit(L.polyline(p.fullLL).getBounds()); // 안내판을 채운 뒤 높이를 재서 맞춘다
  if (!legacy && !p.place) placeName(p.center).then(({ label, dong, failed }) => {
    if (plan !== p) return;
    if (failed) { const el = $('place'); if (el) el.textContent = '이름은 다음에 다시 찾아볼게요'; return; } // 저장하지 않으면 다음에 다시 부른다
    p.place = label ? label + ' 근처' : '이름 없는 골목'; p.dong = dong; store.set('plan', p);
    const el = $('place'); if (el) el.textContent = p.place;
  });
}

$('bPlan').onclick = async () => {
  if (plan && !confirm('지금 산책을 버리고 새로 뽑을까요?')) return; // 출발점을 옮기기 전에 묻는다
  $('bPlan').disabled = true; // 위치를 기다리는 동안에도 두 번 눌리지 않게
  try {
    if (!start) { // 지도를 안 눌렀으면 지금 자리에서(위치를 못 받으면 지도 가운데에서) — 첫 화면에서 「무엇부터 누르나」가 갈리지 않게(10-08 가상 테스트 5/5)
      status('지금 자리를 찾는 중…');
      const here = await new Promise(ok => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => ok([p.coords.latitude, p.coords.longitude]), () => ok(null), { enableHighAccuracy: true, timeout: 8000 }) : ok(null));
      if (mode !== 'plan') return; // 기다리는 사이 밤하늘로 갔으면 멈춘다 — 밤하늘에 출발 핀을 그리지 않는다
      const c = map.getCenter();
      setStart(...(here || [c.lat, c.lng]), here ? '지금 자리에서' : '위치를 받지 못해 지도 가운데에서');
    }
    const radius = +store.get('radius', 1000), size = +store.get('size', 400);
    const pick = radius <= 500 && store.get('pick', 'all') === 'all' ? 'geo' : store.get('pick', 'all'); // 짧게: 동물·식물은 600 m 넘게 그려야 해서 도형으로
    status('동네 길을 불러오는 중…');
    const d = activeDesign(), mats = await loadMat();
    status('어디로 갈지 고르는 중…');
    plan = await planAsync({ lat: start[0], lon: start[1], radius, size, pick, seed: Math.floor(Math.random() * 1e6),
      custom: d && { id: d.id, name: d.name, pts: d.pts },
      nearLL: store.get('matRoute', 'off') === 'on' && mats ? mats.map(m => m.ll) : null });
    plan.mats = matsOnRoute(plan.fullLL);
    store.set('plan', plan); store.set('track', null);
    drawPlan(plan);
    status(`${plan.gold ? '반짝 산책이에요. ' : ''}파란 점선을 따라 ✏️까지 가서, 파란 실선을 따라 ${shapeName(plan)}${eulReul(shapeName(plan))} 그리고 돌아오세요. 출발할 때 「걷기 시작」을 눌러 주세요.`);
  } catch (e) { status(e.message); } finally { $('bPlan').disabled = mode !== 'plan'; }
};

// 걷기: 내 위치를 따라가며 기록한다(이 폰에만). 산책마다 기록을 저장해 새로 고침해도 이어진다
let wake = null;
async function keepAwake(on) { // 걷는 동안 화면이 꺼지면 위치 추적이 끊긴다
  try { if (on && 'wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); else if (!on && wake) { await wake.release(); wake = null; } } catch { /* 지원 안 하면 그냥 간다 */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && watchId != null) keepAwake(true); });
const trackKm = tr => { let m = 0; for (let i = 1; i < tr.length; i++) m += map.distance(tr[i - 1], tr[i]); return m / 1000; };
function addPoint(ll) {
  const t = store.get('track', null);
  const tr = t && plan && t.id === plan.id ? t : { id: plan.id, pts: [] };
  tr.pts.push(ll.map(v => +v.toFixed(6))); store.set('track', tr);
  return tr;
}
function stopWalk() {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  keepAwake(false);
  $('bWalk').lastChild.textContent = '걷기 시작'; $('bWalk').classList.remove('walking');
}
$('bWalk').onclick = () => {
  if (watchId != null) { stopWalk(); return status('잠시 멈췄어요. 다시 누르면 이어서 기록해요.'); }
  if (!navigator.geolocation || !plan) return status('이 브라우저는 위치를 알려 주지 않아요.');
  meLayer.clearLayers();
  const prev = store.get('track', null);
  const line = L.polyline(prev && prev.id === plan.id ? prev.pts : [], { color: T('--path-go'), weight: 4 }).addTo(meLayer);
  const me = L.marker([0, 0], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16, 16] }) });
  keepAwake(true);
  watchId = navigator.geolocation.watchPosition(p => {
    if (p.coords.accuracy > 60) return; // 실내·지하에서 튀는 점은 버린다
    const ll = [p.coords.latitude, p.coords.longitude], tr = addPoint(ll);
    line.addLatLng(ll); me.setLatLng(ll).addTo(meLayer);
    $('bDone').disabled = false;
    status(`걷는 중 · ${trackKm(tr.pts).toFixed(2)} km · 모양 길의 ${Math.round(C.coverage(plan.loopLL, tr.pts) * 100)}%를 지났어요`);
  }, err => { if (err.code === 1) { stopWalk(); status('위치 권한이 꺼져 있어요. 브라우저 설정에서 켜 주세요.'); } else status('위치를 받지 못하고 있어요. 하늘이 트인 곳으로 가 보세요.'); }, { enableHighAccuracy: true });
  $('bWalk').lastChild.textContent = '걷는 중 · 멈춤'; $('bWalk').classList.add('walking');
  setFold(true, false); // 걷는 동안엔 지도를 넓게
  status('기록을 시작했어요. 화면을 켜 둔 채 걸어 주세요. 메뉴는 아래 손잡이로 펼쳐요.');
};

$('bDone').onclick = () => {
  if (!plan) return;
  const tr = store.get('track', null), pts = tr && tr.id === plan.id ? tr.pts : [];
  const cov = C.coverage(plan.loopLL, pts);
  if (cov < 0.6) return status(`모양 길의 ${Math.round(cov * 100)}%를 지났어요. 60%를 넘기면 별이 돼요.`);
  const walked = store.get('walked', {}), stars = store.get('stars', { stars: [], names: {} });
  if (stars.stars.some(s => s.id === plan.id)) return status('이미 별이 된 산책이에요.');
  const before = stars.stars.slice(), firstOfKind = !before.some(x => x.shape === plan.shape && (plan.shape !== 'custom' || x.designId === plan.designId));
  const s = C.done(plan, walked, stars, { coverage: cov, walkedKm: +trackKm(pts).toFixed(2) });
  if (!store.set('stars', stars)) return; // 저장 실패 — 산책과 걸은 기록을 그대로 둔다
  store.set('walked', walked); store.set('plan', null); store.set('track', null);
  stopWalk(); plan = null; drawPlan(null); meLayer.clearLayers();
  $('bWalk').disabled = $('bDone').disabled = $('bGpx').disabled = true;
  const unlocked = K.newlyUnlocked(before, stars.stars);
  status(`${s.gold ? '반짝 별' : '새 별'}이 떴어요. 별 ${stars.stars.length}개째예요.`);
  const su = K.suName(K.suIndex(s.ll)), suNew = !before.some(x => Array.isArray(x.ll) && K.suIndex(x.ll) === K.suIndex(s.ll));
  const DIR = { 북방현무: '북쪽', 동방청룡: '동쪽', 남방주작: '남쪽', 서방백호: '서쪽' };
  const notes = [`서울시청에서 ${DIR[su.group]} ${su.name}수 칸${suNew ? '을 처음 채웠어요(도감의 28칸 성도)' : ''}`, (s.mats || []).length ? `단골집 도장 ${s.mats.length}곳` : '', firstOfKind ? '도감에 새로 올랐어요' : '', ...unlocked.map(a => `업적 「${esc(a.title)}」`)].filter(Boolean);
  const GR = ['', '가장 밝은 별', '밝은 별', '보통 별', '흐린 별', '아주 흐린 별'];
  $('info').innerHTML = `<div class="cele">${emoji(s.shape)} ${esc(shapeName(s))} · ${s.grade}등성(${GR[s.grade]})
      <small>모양 길의 ${Math.round(cov * 100)}%를 따라 걸었어요${notes.length ? ' · ' + notes.join(' · ') : ''}</small></div>
    <div class="row" style="margin-top:6px"><button id="bCard">작품 카드 만들기</button><button id="bDex2">도감 보기</button></div>`;
  setFold(false, false);
  $('bCard').onclick = () => saveCard(s);
  $('bDex2').onclick = openDex;
};

$('bGpx').onclick = () => {
  if (!plan) return;
  const pts = plan.fullLL.map(([a, b]) => `<trkpt lat="${a}" lon="${b}"/>`).join('\n');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="동네 별자리" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>산책 ${plan.id}</name><trkseg>\n${pts}\n</trkseg></trk></gpx>`;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' })), download: `산책_${plan.id}.gpx` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  status('GPX를 저장했어요. 출발점이 들어 있으니 남에게 보내지 마세요.');
};

// ---------- 밤하늘 ----------
// 밤하늘 바탕: 서울시청에서 28수 경계 방향으로 뻗은 가는 선 + 네 방위의 사신 이름(별이 어느 칸에 뜰지 보인다)
function drawSkyGrid() {
  const [la0, lo0] = K.CENTER, k = Math.cos(la0 * Math.PI / 180), at = (b, km) => [la0 + km / 110.54 * Math.cos(b * Math.PI / 180), lo0 + km / (111.32 * k) * Math.sin(b * Math.PI / 180)];
  for (let i = 0; i < 28; i++) {
    const b = 315 + i * 360 / 28;
    L.polyline([at(b, 0.4), at(b, 16)], { color: T('--star-line'), weight: i % 7 === 0 ? 1.4 : 0.6, opacity: i % 7 === 0 ? 0.5 : 0.22, interactive: false }).addTo(skyLayer);
  }
  // 폰은 가로가 좁아 동·서 이름을 더 안쪽에 둔다
  K.SU.forEach(([, short], g) => L.marker(at(g * 90, g % 2 ? 2.2 : 4.5), { icon: L.divIcon({ className: 'lbl', html: short, iconSize: null }), interactive: false }).addTo(skyLayer));
  L.marker(K.CENTER, { icon: L.divIcon({ className: 'lbl', html: '서울시청', iconSize: null }), interactive: false }).addTo(skyLayer);
}
function drawSky() {
  skyLayer.clearLayers();
  drawSkyGrid();
  const st = store.get('stars', { stars: [], names: {} }), S = st.stars;
  if (!S.length) { // 별이 없어도 밤하늘은 연다 — 빈 하늘과 28칸 방위선을 보여 준다(10-08: 별 없을 때 눌러도 반응이 없어 보였다)
    map.setView(K.CENTER, 11);
    status('아직 별이 없어요. 산책을 다녀오면 서울시청에서 본 방향의 칸에 별이 떠요. 「산책으로」를 누르면 돌아가요.');
    return false;
  }
  S.forEach(s => {
    L.polyline(s.loopLL, { color: T('--star-line'), weight: 1, opacity: .45 }).addTo(skyLayer);
    L.circleMarker(s.ll, { radius: [0, 11, 8, 6, 4, 3][s.grade] || 3, color: s.gold ? T('--gold') : T('--star'), fillColor: s.gold ? T('--gold') : T('--star'), fillOpacity: 1, weight: s.gold ? 3 : 1 })
      .addTo(skyLayer).bindTooltip(esc(`${s.grade}등성 · ${shapeName(s)} · ${s.date} · 새 길 ${s.newKm} km`));
    L.marker(s.ll, { icon: L.divIcon({ className: 'skyewrap', iconSize: null, html: `<div class="skye">${emoji(s.shape)}</div>` }), interactive: false }).addTo(skyLayer);
  });
  let nc = 0;
  for (let i = 0; i + 5 <= S.length; i += 5) {
    nc++;
    const lines = C.mstLines(S.slice(i, i + 5).map(s => s.ll));
    lines.forEach(l => L.polyline(l, { color: T('--star-line'), weight: 1.5, opacity: .75 }).addTo(skyLayer));
    const p = lines.flat(), c = [p.reduce((a, b) => a + b[0], 0) / p.length, p.reduce((a, b) => a + b[1], 0) / p.length];
    const k = nc, name = st.names[k] || `이름 없는 별자리 ${k}`;
    L.marker(c, { icon: L.divIcon({ className: 'lbl', html: esc(name), iconSize: null }) }).addTo(skyLayer)
      .on('click', () => { const t = prompt('별자리 이름', name); if (t) { st.names[k] = t; store.set('stars', st); drawSky(); } });
  }
  fit(L.latLngBounds(S.map(s => s.ll)).pad(0.3));
  status(`별 ${S.length}개 · 별자리 ${nc}개${nc ? '. 별자리 이름을 누르면 바꿀 수 있어요.' : '. 별 5개가 모이면 별자리가 돼요.'}`);
  return true;
}
$('bSky').onclick = () => {
  if (mode === 'plan') {
    mode = 'sky'; document.documentElement.dataset.theme = 'dark';
    map.removeLayer(planLayer); map.removeLayer(meLayer); if (startMarker) map.removeLayer(startMarker); // 밤하늘엔 출발점·오가는 길을 그리지 않는다
    setBase(store.get('base', 'osm'), true); skyLayer.addTo(map); drawSky(); $('bSky').lastChild.textContent = '산책으로';
    $('bPlan').disabled = $('bLoc').disabled = true; // 밤하늘에선 산책을 짜지 않는다(안 보이는 층에 그려진다)
    $('info').style.display = 'none';
  } else {
    mode = 'plan'; delete document.documentElement.dataset.theme;
    map.removeLayer(skyLayer); planLayer.addTo(map); meLayer.addTo(map); if (startMarker) startMarker.addTo(map);
    setBase(store.get('base', 'osm'), false); $('bSky').lastChild.textContent = '밤하늘'; $('bPlan').disabled = $('bLoc').disabled = false;
    $('info').style.display = '';
    status(plan ? '하던 산책이 있어요.' : '지도를 눌러 출발할 곳을 골라 주세요.');
  }
};

// ---------- 설정 ----------
$('bSet').onclick = () => {
  $('sRadius').value = store.get('radius', 1000); $('sSize').value = store.get('size', 400);
  $('sBase').value = store.get('base', 'osm'); $('sKey').value = store.get('vwkey', '');
  $('sPick').value = store.get('pick', 'all'); $('sMat').value = store.get('matRoute', 'off');
  $('dSet').showModal();
};
$('dSet').addEventListener('close', () => {
  store.set('radius', +$('sRadius').value); store.set('size', +$('sSize').value);
  store.set('vwkey', $('sKey').value.trim()); store.set('base', $('sBase').value); store.set('pick', $('sPick').value); store.set('matRoute', $('sMat').value);
  if ($('sBase').value.startsWith('vw-') && !$('sKey').value.trim()) status('V-World 키가 없어 OpenStreetMap으로 보여요');
  if ($('sPick').value === 'custom' && !activeDesign()) status('「내 도안」을 고르셨어요. 도감에서 도안을 먼저 만들어 주세요.');
  setBase(store.get('base', 'osm'), mode === 'sky');
  setLen(Object.keys(LEN).find(k => LEN[k].radius === +store.get('radius', 1000)), false); // 고급에서 고친 거리를 단추에도(맞는 단추가 없으면 모두 꺼짐)
});

$('bExport').onclick = () => {
  const data = { app: 'ddol', v: 2, walked: store.get('walked', {}), stars: store.get('stars', { stars: [], names: {} }), designs: designs(), activeDesign: store.get('activeDesign', null) };
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })), download: '동네별자리_기록.json' });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  status('기록을 내보냈어요. 걸은 길이 들어 있으니 남에게 보내지 마세요.');
};
$('bImport').onclick = () => $('fImport').click();
// 가져오기: 형식이 맞는 항목만 받는다(글자가 들어갈 자리엔 글자, 숫자 자리엔 숫자) — 남이 만든 파일로 코드가 끼어드는 길을 막는다
const isStr = (v, max = 200) => typeof v === 'string' && v.length <= max;
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const okLL = a => Array.isArray(a) && a.length === 2 && a.every(isNum);
const okMat = m => m && isStr(m.k, 300) && isStr(m.n) && isStr(m.a) && Number.isInteger(m.t) && Number.isInteger(m.v) && okLL(m.ll);
const okStar = s => s && isStr(s.id, 40) && isStr(s.date, 6) && isStr(s.shape, 20) && okLL(s.ll) && Number.isInteger(s.grade) && s.grade >= 1 && s.grade <= 5
  && Array.isArray(s.loopLL) && s.loopLL.every(okLL) && (s.mats == null || (Array.isArray(s.mats) && s.mats.every(okMat)))
  && (s.name == null || isStr(s.name, 20)) && (s.dong == null || isStr(s.dong, 40)) && (s.designId == null || isStr(s.designId, 40));
const okDesign = d => d && isStr(d.id, 40) && isStr(d.name, 20) && Array.isArray(d.pts) && d.pts.length >= 4 && d.pts.length <= 80 && d.pts.every(okLL);
$('fImport').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; // 같은 파일을 다시 골라도 동작하게
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d.stars || !Array.isArray(d.stars.stars)) throw new Error();
    const stars = { stars: d.stars.stars.filter(okStar), names: {} };
    for (const [k, v] of Object.entries(d.stars.names || {})) if (/^\d{1,4}$/.test(k) && isStr(v, 30)) stars.names[k] = v;
    const walked = {};
    for (const [k, v] of Object.entries(d.walked && typeof d.walked === 'object' ? d.walked : {})) if (/^\d+-\d+$/.test(k) && isNum(v)) walked[k] = v;
    const ds = Array.isArray(d.designs) ? d.designs.filter(okDesign) : designs();
    if (!confirm(`별 ${stars.stars.length}개짜리 기록으로 바꿀까요? 지금 이 폰의 기록은 사라져요.`)) return;
    store.set('walked', walked); store.set('stars', stars); store.set('designs', ds);
    if (isStr(d.activeDesign, 40)) store.set('activeDesign', d.activeDesign);
    status(`기록을 가져왔어요. 별 ${stars.stars.length}개예요.`);
  } catch { status('기록 파일이 아니에요.'); }
};


// ---------- 얼마나 걸을까: 짧게·보통·길게 → 반경·모양 크기·고를 모양 ----------
const LEN = { short: { radius: 500, size: 300 }, mid: { radius: 1000, size: 400 }, long: { radius: 2000, size: 600 } };
function setLen(k, save = true) {
  for (const b of document.querySelectorAll('#lenRow [data-len]')) b.setAttribute('aria-pressed', String(b.dataset.len === k));
  if (save) { store.set('radius', LEN[k].radius); store.set('size', LEN[k].size); }
}
for (const b of document.querySelectorAll('#lenRow [data-len]')) b.onclick = () => setLen(b.dataset.len);
setLen(Object.keys(LEN).find(k => LEN[k].radius === +store.get('radius', 1000)) || 'mid', false);

// ---------- 메뉴 접기: 손잡이를 누르거나 아래로 밀면 접히고 위로 밀면 펼쳐진다 ----------
function setFold(on, save = true) {
  $('sheet').classList.toggle('folded', on);
  $('fold').setAttribute('aria-expanded', String(!on));
  $('fold').setAttribute('aria-label', on ? '메뉴 펼치기' : '메뉴 접기');
  if (save) store.set('fold', on);
}
let foldY = null;
$('fold').addEventListener('pointerdown', e => { foldY = e.clientY; });
$('fold').addEventListener('pointerup', e => {
  if (foldY == null) return;
  const dy = e.clientY - foldY; foldY = null;
  if (dy > 30) setFold(true); else if (dy < -30) setFold(false); else setFold(!$('sheet').classList.contains('folded'));
});
$('fold').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFold(!$('sheet').classList.contains('folded')); } });
setFold(store.get('fold', false), false);

// ---------- 28수 성도: 서울시청을 가운데 두고 방위 28칸 ----------
function suSvg(S) {
  const f = K.suFilled(S), cx = 160, cy = 160, R = 150, r0 = 78, step = 360 / 28;
  const pt = (b, r) => [cx + r * Math.sin(b * Math.PI / 180), cy - r * Math.cos(b * Math.PI / 180)];
  const done = K.SU.map((_, g) => [0, 1, 2, 3, 4, 5, 6].every(k => f.has(g * 7 + k)));
  let w = '', t = '';
  for (let i = 0; i < 28; i++) {
    const b0 = 315 + i * step, b1 = b0 + step, [x0, y0] = pt(b0, R), [x1, y1] = pt(b1, R), [x2, y2] = pt(b1, r0), [x3, y3] = pt(b0, r0);
    const g = Math.floor(i / 7), on = f.has(i), cls = done[g] ? 'w done' : on ? 'w on' : 'w', { name } = K.suName(i);
    w += `<path class="${cls}" d="M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z"><title>${K.SU[g][0]} ${name}${on ? ` · 별 ${f.get(i)}개` : ''}</title></path>`;
    const [tx, ty] = pt(b0 + step / 2, (R + r0) / 2);
    t += `<text x="${tx}" y="${ty}" class="${on || done[g] ? 'on' : ''}">${name.slice(2, 3)}</text>`;
  }
  const q = K.SU.map(([, short], g) => { const [x, y] = pt(g * 90, r0 - 16); return `<text class="q" x="${x}" y="${y}">${short}${done[g] ? ' ✓' : ''}</text>`; }).join('');
  return `<svg viewBox="0 0 320 320" role="img" aria-label="28수 성도: ${f.size}칸 채움">${w}${t}${q}<text x="${cx}" y="${cy - 8}">서울시청</text><text class="q" x="${cx}" y="${cy + 10}">${f.size} / 28수</text></svg>`;
}

// ---------- 도감 ----------
const pct = x => Math.round(x * 100);
function openDex() { renderDex(); if (!$('dDex').open) $('dDex').showModal(); }
$('bDex').onclick = openDex;
$('bDexClose').onclick = () => $('dDex').close();

function renderDex() {
  const S = store.get('stars', { stars: [], names: {} }).stars, D = K.dex(S, designs()), ST = K.stamps(S);
  const A = K.achievements(S).filter(a => MAT || !a.id.startsWith('mat')); // 단골집 자료가 없는 판에선 깰 수 없는 업적을 숨긴다
  const okA = A.filter(a => a.ok).length;
  $('dexSum').innerHTML = `<div style="font-size:14px;margin:6px 0 4px">모양 ${D.got}/${D.total} · 업적 ${okA}/${A.length} · 동네 도장 ${ST.length}곳 · 내 도안 ${designs().length}개</div>
    <div class="bar"><i style="width:${pct(D.got / D.total)}%"></i></div>`;
  const cardHtml = (c, extra = '') => `<div class="card${c.got ? '' : ' locked'}${c.gold ? ' gold' : ''}">
      ${c.gold ? '<span class="tag">✨</span>' : ''}<div class="e">${c.emoji}</div>
      <div class="n">${esc(c.name)}</div>
      <div class="m">${!c.got ? '아직이에요' : c.count ? `${c.count}번 · ${c.best}등성` : '안 걸었어요'}</div>${extra}</div>`; // 못 모은 칸도 흐린 그림·이름을 보여 줘 무엇을 모을지 알게 한다
  $('suRing').innerHTML = suSvg(S);
  $('dexBase').innerHTML = D.base.map(c => cardHtml(c, c.got ? `<button class="sub" data-card="${c.key}">카드</button>` : '')).join('');
  const act = store.get('activeDesign', null);
  $('dexMine').innerHTML = D.mine.length ? D.mine.map(c => {
    const id = c.key.slice(2);
    return cardHtml({ ...c, got: true }, `<button class="${id === act && store.get('pick', 'all') === 'custom' ? '' : 'sub'}" data-use="${id}">${id === act && store.get('pick', 'all') === 'custom' ? '✔ 다음 산책' : '이걸로 걷기'}</button>
      ${c.count ? `<button class="sub" data-card="${c.key}">카드</button>` : ''}<button class="sub" data-del="${id}">지우기</button>`);
  }).join('') : '<p style="font-size:13px;color:var(--sub)">아직 도안이 없어요. 손으로 그리거나 그림을 올려 보세요.</p>';
  $('achList').innerHTML = A.map(a => `<div class="ach${a.ok ? '' : ' no'}"><div class="e">${a.emoji}</div>
      <div class="t"><b>${esc(a.title)}</b> ${a.ok ? '<span class="ok">완료</span>' : ''}<br><span style="color:var(--sub)">${esc(a.desc)}</span>
      ${a.ok ? '' : `<div class="bar" style="margin-top:4px"><i style="width:${pct(a.progress)}%"></i></div>`}</div></div>`).join('');
  const MS = K.matStamps(S);
  loadMat().then(all => {
    if (!all) return;
    $('matList').innerHTML = `<div style="font-size:13px;margin-bottom:4px">${MS.length} / ${all.length}곳</div>`
      + MS.slice(0, 30).map(m => `<div class="mat"><span><b>${esc(m.n)}</b><br><small>${esc(m.a)}</small></span><small>시청 결제 ${esc(Number(m.v).toLocaleString())}건${TIER_TXT[m.t] ? ' · ' + TIER_TXT[m.t] : ''}<br>내가 지난 ${esc(m.times)}번</small></div>`).join('');
  });
  $('stampList').innerHTML = ST.length ? ST.map(x => `<span class="chip">📮 ${esc(x.dong)}${x.n > 1 ? ' ×' + x.n : ''}</span>`).join('')
    : '<span style="font-size:13px;color:var(--sub)">산책을 다녀오면 도착한 동네 도장이 찍혀요.</span>';
}
$('dDex').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.use) { store.set('activeDesign', t.dataset.use); store.set('pick', 'custom'); renderDex(); status('다음 산책은 이 도안으로 걸어요.'); }
  if (t.dataset.del && confirm('이 도안을 지울까요? 이미 받은 별은 남아요.')) { store.set('designs', designs().filter(d => d.id !== t.dataset.del)); renderDex(); }
  if (t.dataset.card) {
    const S = store.get('stars', { stars: [] }).stars, k = t.dataset.card;
    const list = S.filter(s => k.startsWith('d:') ? s.shape === 'custom' && s.designId === k.slice(2) : s.shape === k);
    if (list.length) saveCard(list.reduce((a, b) => (b.grade < a.grade ? b : a))); // 가장 밝은 별로
  }
});

// 그림 올리기 → 도안
$('bUpload').onclick = () => $('fImg').click();
$('fImg').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const probe = await createImageBitmap(f), k0 = 64 / Math.max(probe.width, probe.height); probe.close && probe.close();
    const bmp = await createImageBitmap(f, { resizeWidth: Math.max(8, Math.round(probe.width * k0)), resizeHeight: Math.max(8, Math.round(probe.height * k0)) });
    const k = 64 / Math.max(bmp.width, bmp.height), w = Math.max(8, Math.round(bmp.width * k)), h = Math.max(8, Math.round(bmp.height * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
    const d = addDesign(f.name.replace(/\.[^.]+$/, ''), outlineFromRGBA(g.getImageData(0, 0, w, h).data, w, h), 'image');
    $('customName').textContent = `「${d.name}」 도안을 만들었어요. 다음 산책에 써요.`;
    renderDex();
  } catch (err) { $('customName').textContent = err.message || '그림을 읽지 못했어요'; }
};

// 손그림 → 도안
let stroke = [], drawing = false;
const pad = $('pad'), pg = pad.getContext('2d');
function clearPad() {
  stroke = []; pg.fillStyle = T('--paper'); pg.fillRect(0, 0, pad.width, pad.height);
  pg.fillStyle = T('--rule'); for (let x = 15; x < 300; x += 30) for (let y = 15; y < 300; y += 30) pg.fillRect(x, y, 2, 2); // 점 격자
  $('mMsg').textContent = '';
}
const padXY = e => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height]; };
pad.addEventListener('pointerdown', e => { clearPad(); drawing = true; pad.setPointerCapture(e.pointerId); stroke.push(padXY(e)); });
pad.addEventListener('pointermove', e => {
  if (!drawing) return;
  const p = padXY(e), q = stroke[stroke.length - 1];
  if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 3) return;
  stroke.push(p); pg.strokeStyle = T('--accent'); pg.lineWidth = 5; pg.lineCap = 'round';
  pg.beginPath(); pg.moveTo(...q); pg.lineTo(...p); pg.stroke();
});
pad.addEventListener('pointerup', () => {
  if (!drawing) return; drawing = false;
  if (stroke.length > 2) { pg.setLineDash([6, 6]); pg.beginPath(); pg.moveTo(...stroke[stroke.length - 1]); pg.lineTo(...stroke[0]); pg.stroke(); pg.setLineDash([]); }
});
$('bDraw').onclick = () => { clearPad(); $('mName').value = ''; $('dMake').showModal(); };
$('mClear').onclick = clearPad;
$('mClose').onclick = () => $('dMake').close();
$('mSave').onclick = () => {
  try {
    const d = addDesign($('mName').value.trim() || '내 도안', strokeToOutline(stroke), 'draw');
    $('dMake').close(); $('customName').textContent = `「${d.name}」 도안을 만들었어요. 다음 산책에 써요.`; renderDex();
  } catch (err) { $('mMsg').textContent = err.message; }
};

// ---------- 작품 카드 — 지도 없이 걸은 모양만 그린 그림(어디인지는 담지 않는다) ----------
async function saveCard(s) {
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1020'); bg.addColorStop(1, s.gold ? '#3a2a05' : '#1d2547');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // 매번 같은 밤하늘
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`; g.beginPath(); g.arc(rnd() * W, rnd() * H, rnd() * 2.2, 0, 7); g.fill(); }
  // 걸은 모양을 가운데 크게 — 위경도는 화면 비율로만 쓰고 글자로는 남기지 않는다
  const k = Math.cos(s.ll[0] * Math.PI / 180), P = s.loopLL.map(([la, lo]) => [lo * k, -la]);
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]), sc = 760 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  g.save(); g.translate(W / 2, 620); g.lineJoin = g.lineCap = 'round';
  for (const [w, a] of [[34, 0.12], [18, 0.25], [8, 1]]) {
    g.strokeStyle = s.gold ? `rgba(255,214,90,${a})` : `rgba(255,140,140,${a})`; g.lineWidth = w; g.beginPath();
    P.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo']((x - cx) * sc, (y - cy) * sc)); g.stroke();
  }
  g.restore();
  g.textAlign = 'center'; g.fillStyle = '#fff';
  g.font = '120px serif'; g.fillText(emoji(s.shape), W / 2, 170);
  g.font = 'bold 64px "IBM Plex Sans KR", sans-serif'; g.fillText(`${s.gold ? '반짝 ' : ''}${shapeName(s)}`, W / 2, 1100);
  const suc = K.suName(K.suIndex(s.ll)); g.font = '600 40px "IBM Plex Sans KR", sans-serif'; g.fillStyle = '#f2d98a'; g.fillText(`${suc.group} ${suc.name}수`, W / 2, 1160); g.fillStyle = '#fff';
  g.font = '36px "IBM Plex Sans KR", sans-serif'; g.fillStyle = '#c9d6ff';
  g.fillText(`${s.grade}등성 · ${s.walkedKm ? s.walkedKm + ' km 걸어서 그림 · ' : ''}20${s.date.slice(0, 2)}.${s.date.slice(2, 4)}.${s.date.slice(4, 6)}`, W / 2, 1220);
  g.font = '30px "IBM Plex Sans KR", sans-serif'; g.fillStyle = '#8fa0c8'; g.fillText('동네 별자리 · leeyoy1.github.io/ddol', W / 2, 1290);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `동네별자리_${shapeName(s)}_${s.date}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '동네 별자리' }); return; } catch { /* 취소하면 저장으로 */ }
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: file.name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  status('작품 카드를 저장했어요. 지도와 좌표는 담기지 않아요.');
}

if (plan) { drawPlan(plan); status('하던 산책이 있어요. 「걷기 시작」으로 이어서 걸어요.'); }
loadMat(); // 단골집 자료가 있으면 설정·도감에 그 칸을 보인다
window.__app = { setStart, C, outlineFromRGBA, map, addPoint, get plan() { return plan; } }; // 점검용
