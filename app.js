// 동네 별자리 — 폰 화면. 계산은 core.js, 그림 윤곽은 outline.js, 도로망은 tiles/ (make_tiles.py 산출)
import * as C from './core.js';
import { outlineFromRGBA } from './outline.js';

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('ws_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ws_' + k, JSON.stringify(v)); } catch { status('폰 저장 공간에 쓰지 못했어요 — 「기록 내보내기」로 백업하세요'); } },
};
const status = t => { $('status').textContent = t; };
// 툴팁·라벨·안내판은 HTML로 들어간다 — 가져온 기록 파일·파일 이름의 글이 코드로 실행되지 않게 바꿔 넣는다
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shapeName = p => p.shape === 'custom' ? (p.customName || p.name || '내 그림') : C.SHAPE_KO[p.shape] || '';
const emoji = s => C.EMOJI[s] || '⭐';
// 받침 있으면 을, 없으면 를(한글이 아니면 「을(를)」)
const eulReul = w => { const c = w.charCodeAt(w.length - 1); return c >= 0xAC00 && c <= 0xD7A3 ? ((c - 0xAC00) % 28 ? '을' : '를') : '을(를)'; };
// 위 안내·아래 안내판에 가리지 않게 지도를 맞춘다
const fit = (b, pad = 24) => map.fitBounds(b, { paddingTopLeft: [pad, $('status').offsetHeight + pad + 10], paddingBottomRight: [pad, $('sheet').offsetHeight + pad] });

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
    base.on('tileerror', () => status('V-World 지도를 못 불러왔어요 — 키와 등록한 서비스 주소를 확인하세요'));
  } else {
    base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OpenStreetMap', className: night ? 'night' : '' });
  }
  base.addTo(map);
}
setBase(store.get('base', 'osm'), false);

// 말풍선 핀: 꼬리 끝이 그 지점을 가리킨다
const pin = (ll, e, text, color, cls = '') => L.marker(ll, {
  icon: L.divIcon({ className: 'pinwrap', iconSize: null, html: `<div class="pin ${cls}" style="--c:${color}"><span class="e">${e}</span>${text ? `<span>${esc(text)}</span>` : ''}</div>` }),
  zIndexOffset: cls === 'big' ? 1000 : 500,
});

const planLayer = L.layerGroup().addTo(map), skyLayer = L.layerGroup(), meLayer = L.layerGroup().addTo(map);
let start = null, startMarker = null, plan = store.get('plan', null), track = [], watchId = null;

function setStart(lat, lon, why) {
  start = [lat, lon];
  if (startMarker) map.removeLayer(startMarker);
  startMarker = pin(start, '🚩', '출발', '#2e86ab').addTo(map);
  status(`출발점을 정했어요(${why}). 「원정 뽑기」를 누르세요.`);
}
map.on('click', e => { if (mode === 'plan' && watchId == null) setStart(e.latlng.lat, e.latlng.lng, '지도에서 고름'); });

$('bLoc').onclick = () => {
  if (!navigator.geolocation) return status('이 브라우저는 위치를 알려 주지 않아요 — 지도를 눌러 고르세요');
  status('위치를 찾는 중…');
  navigator.geolocation.getCurrentPosition(p => {
    map.setView([p.coords.latitude, p.coords.longitude], 15);
    setStart(p.coords.latitude, p.coords.longitude, '내 위치');
  }, e => status('위치를 못 받았어요(' + e.message + ') — 지도를 눌러 고르세요'), { enableHighAccuracy: true, timeout: 15000 });
};

// ---------- 도로망 조각 ----------
let INDEX = null;
const tileCache = new Map();
async function loadGraph(lat, lon, radius) {
  INDEX = INDEX || await (await fetch('tiles/index.json')).json();
  const keys = C.tileKeysAround(INDEX, lat, lon, radius);
  if (!keys.length) throw new Error('도로망 자료가 없는 곳이에요(지금은 서울만)');
  const tiles = await Promise.all(keys.map(async k => {
    if (!tileCache.has(k)) tileCache.set(k, await (await fetch(`tiles/${k}.json`)).json());
    return tileCache.get(k);
  }));
  const proj = new C.Proj(lat, lon);
  return { proj, G: C.buildGraph(tiles, proj, radius, INDEX.hw_names) };
}

// 도착지 근처 이름(OpenStreetMap 역지오코딩) — 도착지 좌표만 보낸다. 실패하면 이름 없이 간다
async function placeName(ll) {
  try {
    const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=ko&lat=${ll[0]}&lon=${ll[1]}`;
    const j = await (await fetch(u)).json(), a = j.address || {};
    const parts = [j.name, a.road || a.pedestrian || a.footway, a.quarter || a.neighbourhood || a.suburb || a.city_district];
    return [...new Set(parts.filter(Boolean))].slice(0, 2).join(' · ') || null;
  } catch { return null; }
}

// ---------- 원정 ----------
function drawPlan(p) {
  planLayer.clearLayers();
  if (!p) { $('info').innerHTML = ''; return; }
  const legacy = !p.goLL; // 예전 판 원정(가는 길·돌아오는 길 구분 없음)
  L.polyline(p.tgtLL, { color: '#9aa3b8', dashArray: '4 6', weight: 2 }).addTo(planLayer);
  if (legacy) L.polyline(p.fullLL, { color: '#e4572e', weight: 5, opacity: .85 }).addTo(planLayer);
  else {
    L.polyline(p.goLL, { color: '#2e86ab', weight: 5, opacity: .85, dashArray: '1 9', lineCap: 'round' }).addTo(planLayer);
    L.polyline(p.backLL, { color: '#7d8597', weight: 4, opacity: .7, dashArray: '1 9', lineCap: 'round' }).addTo(planLayer);
    L.polyline(p.loopLL, { color: '#ff6b6b', weight: 6, opacity: .9 }).addTo(planLayer);
    pin(p.loopStart, '✏️', '여기서 그리기 시작', '#ff6b6b', 'below').addTo(planLayer);
  }
  // 도착 핀은 모양 위쪽 가장자리에 — 가운데에 두면 그릴 모양을 덮는다
  const topLat = Math.max(...p.tgtLL.map(q => q[0])), midLon = p.tgtLL.reduce((s, q) => s + q[1], 0) / p.tgtLL.length;
  pin(legacy ? p.star : [topLat, midLon], emoji(p.shape), `도착 · ${shapeName(p)}`, '#f5a623', 'big').addTo(planLayer);
  const e = emoji(p.shape), n = esc(shapeName(p));
  $('info').innerHTML = legacy
    ? `<div class="ttl">${e} ${n} 원정 <span class="sub">왕복 ${p.totalKm} km</span></div>`
    : `<div class="ttl">${e} ${n} 원정 <span class="sub">출발점에서 ${p.dir}쪽 ${p.distKm} km</span></div>
       <div class="where">📍 <span id="place">${p.place ? esc(p.place) : '도착지 이름 찾는 중…'}</span></div>
       <ol class="steps">
         <li><i class="sw go"></i>🚩 출발 → ✏️ 그리기 시작점 <b>${p.goKm} km</b></li>
         <li><i class="sw loop"></i>✏️ ${n} 한 바퀴 (${p.turn} 방향) <b>${p.loopKm} km</b></li>
         <li><i class="sw back"></i>✏️ → 🚩 돌아오기 <b>${p.backKm} km</b></li>
       </ol>
       <div class="meta">모두 ${p.totalKm} km · 모양 지름 ${p.sizeM} m · 어긋남 ${p.devM} m</div>`;
  $('bWalk').disabled = $('bDone').disabled = $('bGpx').disabled = false;
  fit(L.polyline(p.fullLL).getBounds()); // 안내판을 채운 뒤 높이를 재서 맞춘다
  if (!legacy && !p.place) placeName(p.center).then(nm => {
    if (plan !== p) return;
    p.place = nm || '이름 없는 골목'; store.set('plan', p);
    const el = $('place'); if (el) el.textContent = p.place;
  });
}

$('bPlan').onclick = async () => {
  if (!start) return status('먼저 출발점을 정하세요 — 지도를 누르거나 「내 위치」');
  if (plan && !confirm('지금 원정을 버리고 새로 뽑을까요?')) return;
  const radius = +store.get('radius', 2000), size = +store.get('size', 400), pick = store.get('pick', 'all');
  $('bPlan').disabled = true;
  status('도로망을 불러오는 중…');
  try {
    const { proj, G } = await loadGraph(start[0], start[1], radius + Math.max(size, C.FIGURE_MIN_SIZE));
    status(`길 ${G.ids.length.toLocaleString()}개 교차점에서 원정을 짜는 중…`);
    await new Promise(r => setTimeout(r, 30)); // 안내 문구가 먼저 그려지게
    const seed = Math.floor(Math.random() * 1e6);
    plan = C.plan(G, proj, [0, 0], radius, size, seed, { pick, custom: store.get('custom', null) });
    store.set('plan', plan);
    drawPlan(plan);
    status(`${emoji(plan.shape)} 파란 점선을 따라 ✏️까지 가서, 빨간 선으로 ${shapeName(plan)}${eulReul(shapeName(plan))} 그리고 돌아오세요.`);
  } catch (e) { status(e.message); } finally { $('bPlan').disabled = false; }
};

// 걷기 — 내 위치를 따라가며 걸은 거리를 잰다(기록은 이 폰에만)
$('bWalk').onclick = () => {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; $('bWalk').textContent = '걷기 시작'; return status('걷기를 멈췄어요'); }
  if (!navigator.geolocation) return status('이 브라우저는 위치를 알려 주지 않아요');
  track = []; meLayer.clearLayers();
  const line = L.polyline([], { color: '#2e86ab', weight: 4 }).addTo(meLayer);
  const me = L.marker([0, 0], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16, 16] }) });
  watchId = navigator.geolocation.watchPosition(p => {
    const ll = [p.coords.latitude, p.coords.longitude];
    track.push(ll); line.addLatLng(ll); me.setLatLng(ll).addTo(meLayer);
    let m = 0; for (let i = 1; i < track.length; i++) m += map.distance(track[i - 1], track[i]);
    status(`걷는 중 · ${(m / 1000).toFixed(2)} km`);
  }, e => status('위치를 못 받았어요: ' + e.message), { enableHighAccuracy: true });
  $('bWalk').textContent = '걷기 멈춤';
};

$('bDone').onclick = () => {
  if (!plan) return;
  const walked = store.get('walked', {}), stars = store.get('stars', { stars: [], names: {} });
  if (stars.stars.some(s => s.id === plan.id)) return status('이미 별이 된 원정이에요');
  const s = C.done(plan, walked, stars);
  store.set('walked', walked); store.set('stars', stars); store.set('plan', null);
  plan = null; drawPlan(null); meLayer.clearLayers();
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; $('bWalk').textContent = '걷기 시작'; }
  $('bWalk').disabled = $('bDone').disabled = $('bGpx').disabled = true;
  status(`${emoji(s.shape)} 새 별! ${s.grade}등성 · 새 길 ${s.newKm} km(${Math.round(s.newFrac * 100)}%) · 별 ${stars.stars.length}개째`);
};

$('bGpx').onclick = () => {
  if (!plan) return;
  const pts = plan.fullLL.map(([a, b]) => `<trkpt lat="${a}" lon="${b}"/>`).join('\n');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="동네 별자리" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>원정 ${plan.id}</name><trkseg>\n${pts}\n</trkseg></trk></gpx>`;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' })), download: `원정_${plan.id}.gpx` });
  a.click(); URL.revokeObjectURL(a.href);
  status('GPX를 저장했어요 — 출발점이 들어 있으니 남에게 보내지 마세요');
};

// ---------- 밤하늘 ----------
function drawSky() {
  skyLayer.clearLayers();
  const st = store.get('stars', { stars: [], names: {} }), S = st.stars;
  if (!S.length) { status('아직 별이 없어요 — 원정을 다녀오면 별이 생겨요'); return false; }
  S.forEach(s => {
    L.polyline(s.loopLL, { color: '#8fa8d8', weight: 1, opacity: .45 }).addTo(skyLayer);
    L.circleMarker(s.ll, { radius: [0, 11, 8, 6, 4, 3][s.grade] || 3, color: '#fff8d6', fillColor: '#fff3b0', fillOpacity: 1, weight: 1, className: 'glow' })
      .addTo(skyLayer).bindTooltip(esc(`${s.grade}등성 · ${shapeName(s)} · ${s.date} · 새 길 ${s.newKm} km`));
    L.marker(s.ll, { icon: L.divIcon({ className: 'skyewrap', iconSize: null, html: `<div class="skye">${emoji(s.shape)}</div>` }), interactive: false }).addTo(skyLayer);
  });
  let nc = 0;
  for (let i = 0; i + 5 <= S.length; i += 5) {
    nc++;
    const lines = C.mstLines(S.slice(i, i + 5).map(s => s.ll));
    lines.forEach(l => L.polyline(l, { color: '#c9d6ff', weight: 1.5, opacity: .75 }).addTo(skyLayer));
    const p = lines.flat(), c = [p.reduce((a, b) => a + b[0], 0) / p.length, p.reduce((a, b) => a + b[1], 0) / p.length];
    const k = nc, name = st.names[k] || `이름 없는 별자리 ${k}`;
    L.marker(c, { icon: L.divIcon({ className: 'lbl', html: esc(name), iconSize: null }) }).addTo(skyLayer)
      .on('click', () => { const t = prompt('별자리 이름', name); if (t) { st.names[k] = t; store.set('stars', st); drawSky(); } });
  }
  fit(L.latLngBounds(S.map(s => s.ll)).pad(0.3));
  status(`별 ${S.length}개 · 별자리 ${nc}개 — 별자리 이름을 누르면 바꿀 수 있어요`);
  return true;
}
$('bSky').onclick = () => {
  if (mode === 'plan') {
    mode = 'sky'; document.documentElement.dataset.theme = 'dark';
    map.removeLayer(planLayer); map.removeLayer(meLayer); if (startMarker) map.removeLayer(startMarker); // 밤하늘엔 출발점·오가는 길을 그리지 않는다
    setBase(store.get('base', 'osm'), true); skyLayer.addTo(map); drawSky(); $('bSky').textContent = '원정으로';
    $('bPlan').disabled = $('bLoc').disabled = true; // 밤하늘에선 원정을 짜지 않는다(안 보이는 층에 그려진다)
    $('info').style.display = 'none';
  } else {
    mode = 'plan'; delete document.documentElement.dataset.theme;
    map.removeLayer(skyLayer); planLayer.addTo(map); meLayer.addTo(map); if (startMarker) startMarker.addTo(map);
    setBase(store.get('base', 'osm'), false); $('bSky').textContent = '밤하늘'; $('bPlan').disabled = $('bLoc').disabled = false;
    $('info').style.display = '';
    status(plan ? '진행 중인 원정이 있어요' : '지도를 눌러 출발점을 정하세요');
  }
};

// ---------- 설정 ----------
function drawPreview(pts) {
  const cv = $('cPrev'), g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  if (!pts) { cv.hidden = true; return; }
  cv.hidden = false;
  const s = cv.width / 2 - 10;
  g.lineWidth = 3; g.strokeStyle = '#ff6b6b'; g.lineJoin = 'round'; g.beginPath();
  pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](cv.width / 2 + x * s, cv.height / 2 - y * s));
  g.stroke();
}
$('bSet').onclick = () => {
  $('sRadius').value = store.get('radius', 2000); $('sSize').value = store.get('size', 400);
  $('sBase').value = store.get('base', 'osm'); $('sKey').value = store.get('vwkey', '');
  $('sPick').value = store.get('pick', 'all');
  const cu = store.get('custom', null);
  $('customName').textContent = cu ? `지금 그림: ${cu.name} (점 ${cu.pts.length}개)` : '아직 올린 그림이 없어요';
  drawPreview(cu && cu.pts);
  $('dSet').showModal();
};
$('dSet').addEventListener('close', () => {
  store.set('radius', +$('sRadius').value); store.set('size', +$('sSize').value);
  store.set('vwkey', $('sKey').value.trim()); store.set('base', $('sBase').value); store.set('pick', $('sPick').value);
  if ($('sBase').value.startsWith('vw-') && !$('sKey').value.trim()) status('V-World 키가 없어 OpenStreetMap으로 보여요');
  if ($('sPick').value === 'custom' && !store.get('custom', null)) status('「내 그림」을 고르셨어요 — 설정에서 그림을 먼저 올려 주세요');
  setBase(store.get('base', 'osm'), mode === 'sky');
});

// 내 그림: 윤곽 좌표만 남기고 이미지는 버린다
$('bUpload').onclick = () => $('fImg').click();
$('fImg').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const bmp = await createImageBitmap(f);
    const k = 64 / Math.max(bmp.width, bmp.height), w = Math.max(8, Math.round(bmp.width * k)), h = Math.max(8, Math.round(bmp.height * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
    const pts = outlineFromRGBA(g.getImageData(0, 0, w, h).data, w, h);
    const name = f.name.replace(/\.[^.]+$/, '').slice(0, 20) || '내 그림';
    store.set('custom', { name, pts });
    $('sPick').value = 'custom'; store.set('pick', 'custom'); // 창을 닫기 전에 원정을 뽑아도 내 그림으로
    $('customName').textContent = `지금 그림: ${name} (점 ${pts.length}개) — 빨간 선이 걸을 모양이에요`;
    drawPreview(pts);
  } catch (err) { $('customName').textContent = err.message || '그림을 읽지 못했어요'; drawPreview(null); }
};

$('bExport').onclick = () => {
  const data = { walked: store.get('walked', {}), stars: store.get('stars', { stars: [], names: {} }) };
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })), download: '동네별자리_기록.json' });
  a.click(); URL.revokeObjectURL(a.href);
};
$('bImport').onclick = () => $('fImport').click();
$('fImport').onchange = async e => {
  try {
    const d = JSON.parse(await e.target.files[0].text());
    if (!d.stars || !Array.isArray(d.stars.stars)) throw new Error();
    // 모양이 이상한 별은 버린다(좌표·등급이 숫자가 아니면 지도가 깨진다)
    const okLL = a => Array.isArray(a) && a.length === 2 && a.every(Number.isFinite);
    d.stars.stars = d.stars.stars.filter(s => okLL(s.ll) && Number.isInteger(s.grade) && Array.isArray(s.loopLL) && s.loopLL.every(okLL));
    d.stars.names = d.stars.names && typeof d.stars.names === 'object' ? d.stars.names : {};
    store.set('walked', d.walked || {}); store.set('stars', d.stars); status(`기록을 가져왔어요 — 별 ${d.stars.stars.length}개`);
  } catch { status('기록 파일이 아니에요'); }
};

if (plan) drawPlan(plan);
window.__app = { setStart, C, outlineFromRGBA, map }; // 점검용
