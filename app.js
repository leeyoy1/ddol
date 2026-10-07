// 동네 별자리 — 폰 화면. 계산은 core.js, 그림 윤곽은 outline.js, 도로망은 tiles/ (make_tiles.py 산출)
import * as C from './core.js';
import { outlineFromRGBA, strokeToOutline } from './outline.js';
import * as K from './collect.js';

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
// 내 도안집 — 예전 판의 단일 「내 그림」은 도안 하나로 옮긴다
const designs = () => store.get('designs', []);
(() => { const old = store.get('custom', null); if (old && !designs().length) { store.set('designs', [{ id: 'd' + Date.now(), name: old.name, pts: old.pts, made: 'image' }]); store.set('activeDesign', designs()[0].id); } })();
const activeDesign = () => designs().find(d => d.id === store.get('activeDesign', null)) || designs()[designs().length - 1] || null;
function addDesign(name, pts, made) {
  const d = { id: 'd' + Date.now(), name: (name || '내 도안').slice(0, 20), pts, made };
  store.set('designs', [...designs(), d].slice(-24)); store.set('activeDesign', d.id); store.set('pick', 'custom');
  return d;
}
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
    const dong = a.quarter || a.suburb || a.neighbourhood || a.city_district || null; // 동네 스탬프 단위
    const parts = [j.name, a.road || a.pedestrian || a.footway, dong];
    return { label: [...new Set(parts.filter(Boolean))].slice(0, 2).join(' · ') || null, dong };
  } catch { return { label: null, dong: null }; }
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
  pin(legacy ? p.star : [topLat, midLon], emoji(p.shape), `${p.gold ? '✨ ' : ''}도착 · ${shapeName(p)}`, p.gold ? '#f5c542' : '#f5a623', p.gold ? 'big gold' : 'big').addTo(planLayer);
  const e = emoji(p.shape), n = esc(shapeName(p));
  $('info').innerHTML = legacy
    ? `<div class="ttl">${e} ${n} 원정 <span class="sub">왕복 ${p.totalKm} km</span></div>`
    : `<div class="ttl">${p.gold ? '✨ 반짝 ' : ''}${e} ${n} 원정 <span class="sub">출발점에서 ${p.dir}쪽 ${p.distKm} km</span></div>
       <div class="where">📍 <span id="place">${p.place ? esc(p.place) : '도착지 이름 찾는 중…'}</span></div>
       <ol class="steps">
         <li><i class="sw go"></i>🚩 출발 → ✏️ 그리기 시작점 <b>${p.goKm} km</b></li>
         <li><i class="sw loop"></i>✏️ ${n} 한 바퀴 (${p.turn} 방향) <b>${p.loopKm} km</b></li>
         <li><i class="sw back"></i>✏️ → 🚩 돌아오기 <b>${p.backKm} km</b></li>
       </ol>
       <div class="meta">모두 ${p.totalKm} km · 모양 지름 ${p.sizeM} m · 어긋남 ${p.devM} m</div>`;
  $('bWalk').disabled = $('bDone').disabled = $('bGpx').disabled = false;
  fit(L.polyline(p.fullLL).getBounds()); // 안내판을 채운 뒤 높이를 재서 맞춘다
  if (!legacy && !p.place) placeName(p.center).then(({ label, dong }) => {
    if (plan !== p) return;
    p.place = label || '이름 없는 골목'; p.dong = dong; store.set('plan', p);
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
    const d = activeDesign();
    plan = C.plan(G, proj, [0, 0], radius, size, seed, { pick, custom: d && { id: d.id, name: d.name, pts: d.pts } });
    store.set('plan', plan);
    drawPlan(plan);
    status(`${plan.gold ? '✨ 반짝 원정이에요! ' : ''}${emoji(plan.shape)} 파란 점선을 따라 ✏️까지 가서, 빨간 선으로 ${shapeName(plan)}${eulReul(shapeName(plan))} 그리고 돌아오세요.`);
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
  const before = stars.stars.slice(), firstOfKind = !before.some(x => x.shape === plan.shape && (plan.shape !== 'custom' || x.designId === plan.designId));
  const s = C.done(plan, walked, stars);
  store.set('walked', walked); store.set('stars', stars); store.set('plan', null);
  plan = null; drawPlan(null); meLayer.clearLayers();
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; $('bWalk').textContent = '걷기 시작'; }
  $('bWalk').disabled = $('bDone').disabled = $('bGpx').disabled = true;
  const unlocked = K.newlyUnlocked(before, stars.stars);
  status(`${s.gold ? '✨ 반짝 별! ' : '새 별! '}${s.grade}등성 · 새 길 ${s.newKm} km · 별 ${stars.stars.length}개째`);
  $('info').innerHTML = `<div class="cele">${emoji(s.shape)} ${esc(shapeName(s))} — ${s.grade}등성${s.gold ? ' ✨' : ''}
      <small>${firstOfKind ? '📖 도감에 새로 올랐어요! ' : ''}${unlocked.map(a => `${a.emoji} 업적 「${esc(a.title)}」`).join(' · ')}</small></div>
    <div class="row" style="margin-top:6px"><button id="bCard">🖼️ 작품 카드 만들기</button><button id="bDex2" class="sub">📖 도감 보기</button></div>`;
  $('bCard').onclick = () => saveCard(s);
  $('bDex2').onclick = openDex;
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
    L.circleMarker(s.ll, { radius: [0, 11, 8, 6, 4, 3][s.grade] || 3, color: s.gold ? '#ffd23f' : '#fff8d6', fillColor: s.gold ? '#ffcc00' : '#fff3b0', fillOpacity: 1, weight: s.gold ? 3 : 1, className: 'glow' })
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
$('bSet').onclick = () => {
  $('sRadius').value = store.get('radius', 2000); $('sSize').value = store.get('size', 400);
  $('sBase').value = store.get('base', 'osm'); $('sKey').value = store.get('vwkey', '');
  $('sPick').value = store.get('pick', 'all');
  $('dSet').showModal();
};
$('dSet').addEventListener('close', () => {
  store.set('radius', +$('sRadius').value); store.set('size', +$('sSize').value);
  store.set('vwkey', $('sKey').value.trim()); store.set('base', $('sBase').value); store.set('pick', $('sPick').value);
  if ($('sBase').value.startsWith('vw-') && !$('sKey').value.trim()) status('V-World 키가 없어 OpenStreetMap으로 보여요');
  if ($('sPick').value === 'custom' && !activeDesign()) status('「내 도안」을 고르셨어요 — 도감에서 도안을 먼저 만들어 주세요');
  setBase(store.get('base', 'osm'), mode === 'sky');
});

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

// ---------- 도감 ----------
const pct = x => Math.round(x * 100);
function openDex() { renderDex(); if (!$('dDex').open) $('dDex').showModal(); }
$('bDex').onclick = openDex;
$('bDexClose').onclick = () => $('dDex').close();

function renderDex() {
  const S = store.get('stars', { stars: [], names: {} }).stars, D = K.dex(S, designs()), A = K.achievements(S), ST = K.stamps(S);
  const okA = A.filter(a => a.ok).length;
  $('dexSum').innerHTML = `<div style="font-size:14px;margin:6px 0 4px">📖 모양 ${D.got}/${D.total} · 🏅 업적 ${okA}/${A.length} · 📮 동네 ${ST.length}곳 · ✍️ 내 도안 ${designs().length}개</div>
    <div class="bar"><i style="width:${pct(D.got / D.total)}%"></i></div>`;
  const cardHtml = (c, extra = '') => `<div class="card${c.got ? '' : ' locked'}${c.gold ? ' gold' : ''}">
      ${c.gold ? '<span class="tag">✨</span>' : ''}<div class="e">${c.emoji}</div>
      <div class="n">${esc(c.name)}</div>
      <div class="m">${!c.got ? '아직이에요' : c.count ? `${c.count}번 · ${c.best}등성` : '안 걸었어요'}</div>${extra}</div>`; // 못 모은 칸도 흐린 그림·이름을 보여 줘 무엇을 모을지 알게 한다
  $('dexBase').innerHTML = D.base.map(c => cardHtml(c, c.got ? `<button class="sub" data-card="${c.key}">카드</button>` : '')).join('');
  const act = store.get('activeDesign', null);
  $('dexMine').innerHTML = D.mine.length ? D.mine.map(c => {
    const id = c.key.slice(2);
    return cardHtml({ ...c, got: true }, `<button class="${id === act && store.get('pick', 'all') === 'custom' ? '' : 'sub'}" data-use="${id}">${id === act && store.get('pick', 'all') === 'custom' ? '✔ 다음 원정' : '이걸로 걷기'}</button>
      ${c.count ? `<button class="sub" data-card="${c.key}">카드</button>` : ''}<button class="sub" data-del="${id}">지우기</button>`);
  }).join('') : '<p style="font-size:13px;color:var(--sub)">아직 도안이 없어요. 손으로 그리거나 그림을 올려 보세요.</p>';
  $('achList').innerHTML = A.map(a => `<div class="ach${a.ok ? '' : ' no'}"><div class="e">${a.emoji}</div>
      <div class="t"><b>${esc(a.title)}</b> ${a.ok ? '✅' : ''}<br><span style="color:var(--sub)">${esc(a.desc)}</span>
      ${a.ok ? '' : `<div class="bar" style="margin-top:4px"><i style="width:${pct(a.progress)}%"></i></div>`}</div></div>`).join('');
  $('stampList').innerHTML = ST.length ? ST.map(x => `<span class="chip">📮 ${esc(x.dong)}${x.n > 1 ? ' ×' + x.n : ''}</span>`).join('')
    : '<span style="font-size:13px;color:var(--sub)">원정을 다녀오면 도착한 동네 도장이 찍혀요</span>';
}
$('dDex').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.use) { store.set('activeDesign', t.dataset.use); store.set('pick', 'custom'); renderDex(); status('다음 원정은 이 도안으로 걸어요 ✍️'); }
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
    const bmp = await createImageBitmap(f);
    const k = 64 / Math.max(bmp.width, bmp.height), w = Math.max(8, Math.round(bmp.width * k)), h = Math.max(8, Math.round(bmp.height * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
    const d = addDesign(f.name.replace(/\.[^.]+$/, ''), outlineFromRGBA(g.getImageData(0, 0, w, h).data, w, h), 'image');
    $('customName').textContent = `🖼️ 「${d.name}」 도안을 만들었어요 — 다음 원정에 써요`;
    renderDex();
  } catch (err) { $('customName').textContent = err.message || '그림을 읽지 못했어요'; }
};

// 손그림 → 도안
let stroke = [], drawing = false;
const pad = $('pad'), pg = pad.getContext('2d');
function clearPad() {
  stroke = []; pg.fillStyle = '#fff'; pg.fillRect(0, 0, pad.width, pad.height);
  pg.fillStyle = '#c8cedb'; for (let x = 15; x < 300; x += 30) for (let y = 15; y < 300; y += 30) pg.fillRect(x, y, 2, 2); // 점 격자
  $('mMsg').textContent = '';
}
const padXY = e => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height]; };
pad.addEventListener('pointerdown', e => { clearPad(); drawing = true; pad.setPointerCapture(e.pointerId); stroke.push(padXY(e)); });
pad.addEventListener('pointermove', e => {
  if (!drawing) return;
  const p = padXY(e), q = stroke[stroke.length - 1];
  if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 3) return;
  stroke.push(p); pg.strokeStyle = '#ff6b6b'; pg.lineWidth = 5; pg.lineCap = 'round';
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
    $('dMake').close(); $('customName').textContent = `✍️ 「${d.name}」 도안을 만들었어요 — 다음 원정에 써요`; renderDex();
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
  g.font = 'bold 64px system-ui, sans-serif'; g.fillText(`${s.gold ? '✨ ' : ''}${shapeName(s)}`, W / 2, 1120);
  g.font = '40px system-ui, sans-serif'; g.fillStyle = '#c9d6ff';
  g.fillText(`${s.grade}등성 · ${s.totalKm ? s.totalKm + ' km 걸어서 그림 · ' : ''}20${s.date.slice(0, 2)}.${s.date.slice(2, 4)}.${s.date.slice(4, 6)}`, W / 2, 1190);
  g.font = '32px system-ui, sans-serif'; g.fillStyle = '#8fa0c8'; g.fillText('동네 별자리 · 걸으면 별이 돼요', W / 2, 1290);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `동네별자리_${shapeName(s)}_${s.date}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '동네 별자리' }); return; } catch { /* 취소하면 저장으로 */ }
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: file.name });
  a.click(); URL.revokeObjectURL(a.href);
  status('작품 카드를 저장했어요 — 지도 없이 모양만 담겨서 어디인지는 드러나지 않아요');
}

if (plan) drawPlan(plan);
window.__app = { setStart, C, outlineFromRGBA, map }; // 점검용
