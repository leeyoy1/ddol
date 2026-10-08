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
// 단추를 누른 결과·거절은 엄지 가까이 한 줄로도 — 위 띠는 멀다(디자이너 검토). 4초 뒤 사라진다
function tell(t) { status(t); const h = $('hint'); h.textContent = t; h.hidden = false; clearTimeout(tell.timer); tell.timer = setTimeout(() => { h.hidden = true; }, 4000); }
// 색은 index.html :root 토큰에서 읽는다(밤하늘에선 같은 이름이 남색 값으로 바뀐다)
const T = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
// 툴팁·라벨·안내판은 HTML로 들어간다 — 가져온 기록 파일·파일 이름의 글이 코드로 실행되지 않게 바꿔 넣는다
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shapeName = p => p.shape === 'custom' ? (p.customName || p.name || '내 도안') : C.SHAPE_KO[p.shape] || '';
const stars5 = n => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
const emoji = s => C.EMOJI[s] || '⭐';
// 그림 아이콘(tools/gen_icons_nb.py) — 모양 14·업적·지도 핀. 이름이 없으면(내 도안 등) 이모지를 그대로 쓴다
const ICONS = new Set([...Object.keys(C.EMOJI), ...K.achievements([]).map(a => a.id), 'pin_start', 'pin_draw', 'pin_end']);
const ico = (name, fb) => ICONS.has(name) ? `<img class="ico" src="icons/${name}.png" alt="">` : fb;
const shapeIco = s => ico(s, emoji(s));
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
const fit = (b, pad = 24) => map.fitBounds(b, { maxZoom: 16, paddingTopLeft: [pad, $('top').offsetHeight + pad + 40], paddingBottomRight: [pad, $('sheet').offsetHeight + pad] });

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
let start = null, startMarker = null, end = null, endMarker = null, plan = store.get('plan', null), watchId = null, warned = false, follow = true, lastLL = null;
if (plan && !plan.goLL) plan = null; // 10-07 첫 판 산책은 모양 길(loopLL)이 없어 걸어도 별이 될 수 없다 — 버린다

function setStart(lat, lon, why) {
  start = [lat, lon];
  if (startMarker) map.removeLayer(startMarker);
  startMarker = pin(start, ico('pin_start', '🚩'), '출발', 'var(--path-go)').addTo(map)
    .on('click', () => { if (plan) return; map.removeLayer(startMarker); start = startMarker = null; clearEnd(); status('출발점을 지웠어요. 지도를 눌러 다시 골라 주세요.'); });
  status(`${why} 출발해요. 끝낼 곳이 따로 있으면 지도를 한 번 더 누르세요. 없으면 「산책 뽑기」.`);
}
// 끝에서 시작: 출발 다음에 누른 곳에서 산책이 끝난다(편도). 핀을 다시 누르면 지우고 왕복으로
const END_MAX_M = 2500; // 두 점 거리 상한 — 폰 실측 전 보수값(제안서 결정 2, 10-08 measure_end: 내려받기 2~2.5배)
let TILE_INDEX = null;
const inSeoul = async (lat, lon) => {
  try { TILE_INDEX = TILE_INDEX || await (await fetch('tiles/index.json')).json(); } catch { return true; } // 못 받으면 계산 쪽에서 다시 거른다
  return C.tileKeysAround(TILE_INDEX, lat, lon, 1).length > 0;
};
function clearEnd() { if (endMarker) map.removeLayer(endMarker); end = endMarker = null; }
async function setEnd(lat, lon) {
  if (!(await inSeoul(lat, lon))) return tell('서울 안에서만 고를 수 있어요.');
  if (!start || plan || mode !== 'plan') return; // 기다리는 사이 출발 핀을 지웠거나 산책을 뽑았거나 밤하늘로 갔으면 그만
  clearEnd();
  const d = map.distance(start, [lat, lon]);
  if (d < +store.get('radius', 1000) / 2) return tell('출발점과 너무 가까워서 한 바퀴 돌아 출발점으로 돌아와요.');
  end = [lat, lon];
  const far = d > END_MAX_M;
  endMarker = pin(end, ico('pin_end', ''), far ? '너무 멀어요' : '끝낼 곳', 'var(--path-back)', far ? 'below far' : 'below').addTo(map)
    .on('click', () => { clearEnd(); status('끝낼 곳을 지웠어요. 출발점으로 돌아오는 산책이에요.'); });
  endMarker.getElement()?.setAttribute('aria-label', '끝낼 곳 — 누르면 지워요');
  status(far ? '거기까지는 걸어가기엔 멀어요. 조금 더 가까운 곳을 눌러 주세요.' : '여기가 끝낼 곳이에요. 「산책 뽑기」를 누르세요. 끝낼 곳 표시를 다시 누르면 지워져요.');
  fit(L.latLngBounds([start, end]), 40); // 끝 핀이 시트 가장자리에 걸리지 않게
}
map.on('click', e => {
  if (mode !== 'plan' || watchId != null) return;
  if (plan) return status('지금 산책이 있어요. 새로 뽑으려면 「산책 뽑기」를 다시 누르세요. 새로 뽑으면 지금까지 걸은 길은 지워져요.'); // 산책 중에 핀만 옮겨지면 헷갈린다
  if (map.getZoom() < 15) { map.setView(e.latlng, 16); return status(`가까이 왔어요. ${start ? '끝낼 곳' : '출발할 곳'}을 다시 한 번 눌러 주세요.`); }
  if (!start) return setStart(e.latlng.lat, e.latlng.lng, '여기서');
  setEnd(e.latlng.lat, e.latlng.lng);
});

$('bLoc').onclick = () => {
  if (watchId != null) { follow = true; if (lastLL) map.setView(lastLL, Math.max(map.getZoom(), 17)); return status('내 위치를 따라가요. 지도를 끌면 멈춰요.'); }
  if (!navigator.geolocation) return status('이 브라우저는 위치를 알려 주지 않아요. 지도를 눌러 출발할 곳을 찍어 주세요.');
  status('위치를 찾는 중…');
  navigator.geolocation.getCurrentPosition(p => {
    const ll = [p.coords.latitude, p.coords.longitude];
    map.setView(ll, 16);
    if (plan) return status('지금 자리예요.');
    setStart(...ll, '지금 자리에서');
  }, () => status('위치를 받지 못했어요. 지도를 눌러 출발할 곳을 찍어 주세요.'), { enableHighAccuracy: true, timeout: 15000 });
};
map.on('dragstart', () => { if (watchId != null) follow = false; }); // 손으로 지도를 끌면 따라가기를 멈춘다

// ---------- 산책 계산: 작업자에서(화면이 굳지 않게). 작업자를 못 쓰는 브라우저는 화면 쪽에서 같은 코드로 ----------
let worker = null;
try { worker = new Worker('plan_worker.js', { type: 'module' }); } catch { worker = null; }
const onTiles = (n, total) => { if (total > 4) status(`길을 받는 중이에요 (${n}/${total})`); }; // 편도는 조각이 9개까지 — 오래 걸리면 고장으로 보인다
function planAsync(params) {
  if (!worker) return import('./plan_job.js').then(m => m.runPlan(params, onTiles));
  return new Promise((ok, bad) => {
    worker.onmessage = e => e.data.progress ? onTiles(...e.data.progress) : e.data.ok ? ok(e.data.plan) : bad(new Error(e.data.msg));
    worker.onerror = () => { worker = null; import('./plan_job.js').then(m => m.runPlan(params, onTiles)).then(ok, bad); };
    worker.postMessage(params);
  });
}

// 도착지 근처 이름(OpenStreetMap 역지오코딩) — 도착지 좌표만 보낸다. 실패하면 이름 없이 간다
async function placeName(ll, zoom = 18) {
  try {
    const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=${zoom}&accept-language=ko&lat=${ll[0]}&lon=${ll[1]}`;
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
  $('sheet').classList.toggle('active', !!p); $('sheet').classList.remove('celebrate');
  $('bPlan').classList.toggle('primary', !p); $('bWalk').classList.toggle('primary', !!p && watchId == null);
  if (!p) { $('info').innerHTML = ''; $('bDone').classList.remove('primary'); return; }
  L.polyline(p.tgtLL, { color: T('--path-back'), dashArray: '4 6', weight: 2 }).addTo(planLayer);
  L.polyline(p.goLL, { color: T('--path-go'), weight: 5, opacity: .85, dashArray: '1 9', lineCap: 'round' }).addTo(planLayer);
  L.polyline(p.backLL, { color: '#fff', weight: 8, opacity: .8 }).addTo(planLayer);
  L.polyline(p.backLL, { color: T('--path-back'), weight: 5, opacity: .9, dashArray: '2 8', lineCap: 'round' }).addTo(planLayer);
  L.polyline(p.loopLL, { color: T('--accent'), weight: 6, opacity: .9 }).addTo(planLayer);
  const bb = L.polyline(p.fullLL).getBounds(), sp = start || p.goLL[0];
  const nearStart = map.distance(sp, p.loopStart) < map.distance(bb.getSouthWest(), bb.getNorthEast()) * 0.15; // 이름표가 「출발」에 가리던 일(지도 검토)
  const ls = pin(p.loopStart, ico('pin_draw', '✏️'), '그리기 시작점', 'var(--accent)', nearStart ? '' : 'below').addTo(planLayer);
  if (nearStart) ls.setZIndexOffset(900);
  // 도는 방향: 모양 길의 15·40·65·90% 자리에 작은 화살표(걷는 순서 = loopLL 순서)
  const LL = p.loopLL, cum = [0];
  for (let i = 1; i < LL.length; i++) cum.push(cum[i - 1] + map.distance(LL[i - 1], LL[i]));
  for (const f of [0.15, 0.4, 0.65, 0.9]) {
    const i = Math.max(1, cum.findIndex(c => c >= f * cum[cum.length - 1])), a = LL[i - 1], b = LL[i];
    const ang = Math.atan2(-(b[0] - a[0]), (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180)) * 180 / Math.PI;
    L.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { icon: L.divIcon({ className: 'arrowwrap', iconSize: null, html: `<div class="arrow" style="transform:rotate(${ang.toFixed(0)}deg)"></div>` }), interactive: false }).addTo(planLayer);
  }
  if (p.oneWay) pin(p.backLL[p.backLL.length - 1], ico('pin_end', ''), '끝낼 곳', 'var(--path-back)', 'below').addTo(planLayer);
  // 도착 핀은 모양 위쪽 가장자리에 — 가운데에 두면 그릴 모양을 덮는다
  const topLat = Math.max(...p.tgtLL.map(q => q[0])), midLon = p.tgtLL.reduce((s, q) => s + q[1], 0) / p.tgtLL.length;
  pin([topLat, midLon], shapeIco(p.shape), `${p.gold ? '반짝 ' : ''}${shapeName(p)} 그리는 곳`, p.gold ? 'var(--gold)' : 'var(--navy)', p.gold ? 'big gold' : 'big').addTo(planLayer);
  matMarkers.clear();
  for (const m of p.mats || []) matMarkers.set(m.k, L.marker(m.ll, { icon: L.divIcon({ className: 'mpin t' + m.t, iconSize: null, html: '<div>단</div>' }) })
    .addTo(planLayer).bindTooltip(esc(`${m.n} · 시청 결제 ${esc(Number(m.v).toLocaleString())}건`)));
  const e = shapeIco(p.shape), n = esc(shapeName(p));
  $('info').innerHTML = `<div class="ttl">${p.gold ? '반짝 ' : ''}${e} ${n} 산책 <span class="sub">출발점에서 ${p.dir}쪽 ${p.distKm} km</span></div>
       <ol class="steps">
         <li><i class="sw go"></i><span>그리기 시작점(${ico('pin_draw', '✏️')})까지 가기</span><b>${p.goKm} km</b></li>
         <li><i class="sw loop"></i><span>${n} 그리며 한 바퀴(${p.turn} 방향)</span><b>${p.loopKm} km</b></li>
         <li><i class="sw back"></i><span>${p.oneWay ? `<span id="endPlace">${esc(p.endPlace || '끝낼 곳')}</span>까지 가기` : '출발점으로 돌아오기'}</span><b>${p.backKm} km</b></li>
       </ol>
       <div class="meta">모두 ${p.totalKm} km(모양 길 ${p.loopKm} + 오가는 길 ${(p.goKm + p.backKm).toFixed(2)})</div>
       <div class="rule">모양 길(파란 실선)의 60%를 지나면 별이 떠요</div>${p.backBy ? `
       <div class="meta"><label>돌아갈 시각 <input type="time" id="backBy" value="${esc(p.backBy)}"></label> · 화면을 켜 두면 알려요</div>` : ''}
       <details class="more"><summary>자세히</summary>
         <div class="meta">모양 그리는 곳: <span id="place">${p.place ? esc(p.place) : '근처 이름을 찾는 중…'}</span></div>
         ${p.likeness ? `<div class="meta">길이 모양을 닮은 정도 ${stars5(p.likeness)} — 골목이 모양을 얼마나 따라가는지예요. 별의 밝기(등성)는 걸은 비율로 따로 정해져요</div>` : ''}
         ${p.minutes ? `<div class="meta">${p.minutes}분쯤 산책은 짧게 그리느라 도형(별·하트·세모 등)만 나와요</div>` : ''}
         ${matListHtml(p)}
         <details class="promise"${p.promise ? ' open' : ''}><summary>나와 약속하기 — 이 시각에 걷기</summary><label>언제 걸을까요 <input type="datetime-local" id="promise" value="${esc(p.promise || '')}"></label>
           <small>나 혼자 하는 약속이에요(아무에게도 보내지 않아요). 그 시각 15분 안에 「걷기 시작」을 누르면 한 등급 밝은 별이 떠요. 못 지켜도 별은 그대로예요.</small></details>
         <button type="button" class="link" id="bHomeLink">돌아갈 곳 방향 보기</button>
         <button type="button" class="link" id="bQuit">이 산책 그만두기</button>
       </details>`;
  $('bQuit').onclick = quitPlan; $('bHomeLink').onclick = () => $('bHome').click();
  document.querySelector('#info .more').addEventListener('toggle', () => fit(L.polyline(p.fullLL).getBounds())); // 펼치고 접을 때 남은 지도에 길 전체가 들어오게(D5)
  $('bWalk').disabled = $('bGpx').disabled = false;
  $('bDone').disabled = !(store.get('track', null)?.id === p.id);
  // 가게를 누르면 목록을 접고(지도를 가리지 않게) 그 가게로 간다
  for (const b of document.querySelectorAll('[data-mat]')) b.onclick = () => {
    const m = (p.mats || []).find(x => x.k === b.dataset.mat); if (!m) return;
    b.closest('details').open = false;
    map.once('moveend', () => matMarkers.get(m.k)?.openTooltip());
    map.flyTo(m.ll, 17, { duration: 0.6 });
  };
  $('promise').onchange = e => { const v = e.target.value; p.promise = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v) ? v : null; store.set('plan', p); if (p.promise) status(`약속했어요 · ${promiseText(p.promise)}에 걷기 시작하면 한 등급 밝은 별이 떠요.`); };
  if ($('backBy')) $('backBy').onchange = e => { if (/^\d\d:\d\d$/.test(e.target.value)) { p.backBy = e.target.value; warned = false; backAlert(false); store.set('plan', p); } };
  fit(L.polyline(p.fullLL).getBounds()); // 안내판을 채운 뒤 높이를 재서 맞춘다
  if (p.oneWay && !p.endPlace) placeName(p.backLL[p.backLL.length - 1].map(v => +v.toFixed(3)), 14).then(({ label, dong }) => {
    if (plan !== p || !(dong || label)) return;
    p.endPlace = dong || label; store.set('plan', p);
    const el = $('endPlace'); if (el) el.textContent = p.endPlace;
  });
  if (!p.place) placeName(p.center).then(({ label, dong, failed }) => {
    if (plan !== p) return;
    if (failed) { const el = $('place'); if (el) el.textContent = '이름은 다음에 다시 찾아볼게요'; return; } // 저장하지 않으면 다음에 다시 부른다
    p.place = label ? label + ' 근처' : '이름 없는 골목'; p.dong = dong; store.set('plan', p);
    const el = $('place'); if (el) el.textContent = p.place;
  });
}

$('bPlan').onclick = async () => {
  if (end && map.distance(start, end) > END_MAX_M) return status('끝낼 곳이 걸어가기엔 멀어요. 조금 더 가까운 곳을 눌러 주세요.');
  if (plan && !confirm('지금 산책을 버리고 새로 뽑을까요? 지금까지 걸은 길은 지워져요.')) return; // 출발점을 옮기기 전에 묻는다
  $('bPlan').disabled = true; // 위치를 기다리는 동안에도 두 번 눌리지 않게
  try {
    if (!start) { // 지도를 안 눌렀으면 지금 자리에서(위치를 못 받으면 지도 가운데에서) — 첫 화면에서 「무엇부터 누르나」가 갈리지 않게(10-08 가상 테스트 5/5)
      status('지금 자리를 찾는 중…');
      const here = await new Promise(ok => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => ok([p.coords.latitude, p.coords.longitude]), () => ok(null), { enableHighAccuracy: true, timeout: 8000 }) : ok(null));
      if (mode !== 'plan') return; // 기다리는 사이 밤하늘로 갔으면 멈춘다 — 밤하늘에 출발 핀을 그리지 않는다
      if (!here) return status('위치를 받지 못했어요. 지도를 눌러 출발할 곳을 찍고 다시 「산책 뽑기」를 누르세요.'); // 말없이 시청 둘레를 뽑던 일(디자이너 검토)
      setStart(...here, '지금 자리에서');
    }
    const radius = +store.get('radius', 1000), size = +store.get('size', 400);
    const pick = radius <= 500 && store.get('pick', 'all') === 'all' ? 'geo' : store.get('pick', 'all'); // 짧게: 동물·식물은 600 m 넘게 그려야 해서 도형으로
    status('동네 길을 불러오는 중…');
    const d = activeDesign(), mats = await loadMat();
    status('어디로 갈지 고르는 중…');
    const L0 = lens()[curLen()], minutes = store.get('unit', 'km') === 'min' && L0 ? L0.min : null;
    // 다시 뽑을 때도 끝낼 곳을 잇는다 — 끝 핀은 뽑은 뒤 지워지므로 지금 산책의 끝 마디에서(새로 고침 뒤에도)
    let fin = end || (plan && plan.oneWay ? plan.backLL[plan.backLL.length - 1] : null);
    if (fin && map.distance(start, fin) > END_MAX_M) fin = null; // 출발이 지금 자리로 바뀌어 멀어졌으면 왕복으로
    plan = await planAsync({ lat: start[0], lon: start[1], endLat: fin ? fin[0] : null, endLon: fin ? fin[1] : null,
      maxTotalKm: minutes ? minutes * WALK_M_PER_MIN / 1000 * 1.2 : null, radius, size, pick, seed: Math.floor(Math.random() * 1e6),
      custom: d && { id: d.id, name: d.name, pts: d.pts },
      nearLL: store.get('matRoute', 'off') === 'on' && mats ? mats.map(m => m.ll) : null });
    plan.mats = matsOnRoute(plan.fullLL);
    plan.gold = todayGold().includes(K.suIndex(plan.center)); // 계산부의 무작위 반짝 대신 오늘의 반짝 칸
    if (minutes) { plan.minutes = minutes; plan.backBy = defaultBackBy(minutes); }
    warned = false; clearEnd(); // 끝 핀은 이제 산책 그림(planLayer)에 그린다
    store.set('plan', plan); store.set('track', null);
    drawPlan(plan);
    status(`${plan.gold ? '반짝 산책이에요. ' : ''}파란 점선을 따라 그리기 시작점(✏️)까지 가서, 파란 실선을 따라 ${shapeName(plan)}${eulReul(shapeName(plan))} 그리고 ${plan.oneWay ? '회색 점선을 따라 끝낼 곳까지 가세요' : '돌아오세요'}. 출발할 때 「걷기 시작」을 눌러 주세요.`);
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
  const tr = t && plan && t.id === plan.id ? t : { id: plan.id, pts: [], skip: [], t0: Date.now() };
  tr.pts.push(ll.map(v => +v.toFixed(6))); store.set('track', tr);
  return tr;
}
function stopWalk() {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  keepAwake(false);
  $('bWalk').lastChild.textContent = '걷기 시작'; $('bWalk').classList.remove('walking'); $('bSkip').hidden = true;
  $('status').setAttribute('aria-live', 'polite'); backAlert(false);
  $('walkBar').hidden = true; if (plan) $('bWalk').classList.add('primary'); $('homeBar').hidden = true;
}
$('bWalk').onclick = () => {
  if (watchId != null) { stopWalk(); return tell('잠시 멈췄어요. 다시 누르면 이어서 기록해요.'); }
  if (!navigator.geolocation || !plan) return status('이 브라우저는 위치를 알려 주지 않아요.');
  meLayer.clearLayers();
  const prev = store.get('track', null);
  const line = L.polyline(prev && prev.id === plan.id ? prev.pts : [], { color: T('--path-go'), weight: 4 }).addTo(meLayer);
  const me = L.marker([0, 0], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16, 16] }) });
  keepAwake(true);
  // 처음엔 내 자리로 다가가고, 그 뒤로는 따라간다(지도를 끌면 멈춤 — 오른쪽 아래 「내 위치로」로 다시)
  follow = true; let first = true, lastGood = Date.now(), acc = null; const marks = new Set();
  let onLine = null, farSince = null; const corners = plan.tgtLL.length <= 12 ? plan.tgtLL : [], hit = new Set(); // 모퉁이는 도형(꼭짓점 12개 이하)만 센다
  $('status').setAttribute('aria-live', 'off'); // 위치마다 바뀌는 띠는 낭독하지 않고, 이정표만 따로 읽는다(접근성 검토)
  watchId = navigator.geolocation.watchPosition(p => {
    if (p.coords.accuracy > 60) { // 실내·지하에서 튀는 점은 버리되, 오래 못 받으면 말한다
      if (Date.now() - lastGood > 20000) status(`위치가 흔들려요(±${Math.round(p.coords.accuracy)} m). 하늘이 트인 곳에서 잠깐 기다려 주세요.`);
      return;
    }
    lastGood = Date.now();
    const ll = [p.coords.latitude, p.coords.longitude], tr = addPoint(ll); lastLL = ll;
    line.addLatLng(ll); me.setLatLng(ll).addTo(meLayer);
    (acc = acc || L.circle(ll, { radius: p.coords.accuracy, color: T('--accent'), weight: 1, opacity: .5, fillOpacity: .08, interactive: false }).addTo(meLayer)).setLatLng(ll).setRadius(p.coords.accuracy);
    if (first) { first = false; map.setView(ll, Math.max(map.getZoom(), 17)); } else if (follow) map.panTo(ll, { animate: false });
    $('bDone').disabled = false;
    const cov = Math.round(C.coverage(plan.loopLL, tr.pts, 20, 40, tr.skip) * 100);
    $('bDone').classList.toggle('primary', cov >= C.NEED * 100); // 별 조건을 채우면 「다녀왔어요」가 주 단추
    $('walkBar').firstChild.style.width = Math.min(100, cov) + '%'; $('walkBar').classList.toggle('met', cov >= C.NEED * 100);
    if (cov >= C.NEED * 100 && !marks.has('met')) { marks.add('met'); tell('별 조건을 채웠어요 — 더 걸으면 더 밝은 별이 돼요.'); say('별 조건을 채웠어요.'); }
    for (const m of [25, 50, 75]) if (cov >= m && !marks.has(m)) { marks.add(m); say(`모양 길 ${m}%를 지났어요.`); }
    // ① 화면 안 보고 걷기: 모양 길에 들어서면 한 번, 벗어나면 두 번(30·50 m 사이는 그대로 — 튀는 점에 떨지 않게), 모퉁이를 밟으면 길게
    const dLoop = distTo(ll, plan.loopLL);
    if (dLoop < 30 && onLine !== true) { if (onLine === false) cue('on'); onLine = true; }
    else if (dLoop > 50 && onLine !== false) { if (onLine === true) cue('off'); onLine = false; }
    corners.forEach((c, i) => { if (!hit.has(i) && map.distance(ll, c) < 30) { hit.add(i); cue('corner'); tell(`모퉁이 ${hit.size}/${corners.length}`); say(`모퉁이 ${hit.size}, ${corners.length}개 중.`); } });
    // ② 산책 길(오가는 길 포함)에서 150 m 넘게 2분 넘게 떨어져 있으면 돌아갈 곳 쪽 큰 화살표
    if (distTo(ll, plan.fullLL) > 150) { farSince = farSince || Date.now(); if (Date.now() - farSince > 120000 && $('homeBar').hidden) showHome(ll); }
    else farSince = null;
    if (!plan.backBy) return status(`걷는 중 · ${trackKm(tr.pts).toFixed(2)} km · 모양 길의 ${cov}%를 지났어요`);
    // 돌아갈 시각: 남은 분 ≤ 지금 자리→끝 곳 직선거리×1.3을 걷는 분이면 알린다(서버가 없어 앱을 켜 둔 동안만)
    const left = minutesUntil(plan.backBy), need = map.distance(ll, plan.backLL[plan.backLL.length - 1]) * 1.3 / WALK_M_PER_MIN;
    for (const m of [10, 5]) if (left <= m && left > 0 && !marks.has('t' + m)) { marks.add('t' + m); say(`돌아갈 시각까지 ${m}분 남았어요.`); }
    if (left > need) return status(`걷는 중 · 모양 길 ${cov}% · ${hm(plan.backBy)}까지 ${Math.round(left)}분`);
    if (!warned) {
      warned = true; backAlert(true);
      if (store.get('vib', 'on') === 'on' && navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 600]);
      say(`돌아갈 시각이에요. 지금 돌아가면 ${hm(plan.backBy)}에 맞춰요.`, true);
    }
    status(left > 0 ? `지금 돌아가면 ${hm(plan.backBy)}에 맞춰요 · 모양 길 ${cov}%` : `${hm(plan.backBy)}이 지났어요 · 모양 길 ${cov}%`);
  }, err => { if (err.code === 1) { stopWalk(); status('위치 권한이 꺼져 있어요. 브라우저 설정에서 켜 주세요.'); } else status('위치를 받지 못하고 있어요. 하늘이 트인 곳으로 가 보세요.'); }, { enableHighAccuracy: true });
  $('bWalk').lastChild.textContent = '잠깐 멈춤'; $('bWalk').classList.add('walking'); $('bWalk').classList.remove('primary'); $('bSkip').hidden = false; $('walkBar').hidden = false;
  setFold(true, false); // 걷는 동안엔 지도를 넓게
  status('기록을 시작했어요. 화면을 켜 둔 채 걸어 주세요. 메뉴는 아래 손잡이로 펼쳐요.');
};

$('bDone').onclick = () => {
  if (!plan) return;
  const tr = store.get('track', null), mine = tr && tr.id === plan.id, pts = mine ? tr.pts : [], skip = mine ? tr.skip || [] : [];
  const cov = C.coverage(plan.loopLL, pts, 20, 40, skip), skipped = C.skippedFrac(plan.loopLL, skip);
  if (cov < C.NEED) return tell(`별은 아직이에요. 모양 길 ${Math.round(cov * 100)}%${skipped ? '(못 가는 길은 빼고)' : ''} — 60%까지 ${Math.ceil((C.NEED - cov) * 100)}%만 더 걸어요. 끝내려면 「자세히」의 「이 산책 그만두기」.`);
  // 약속: 약속한 시각 15분 안에 걷기 시작했나 · 정각: 돌아갈 시각과 1분 안
  const kept = !!(plan.promise && mine && tr.t0 && Math.abs(tr.t0 - new Date(plan.promise).getTime()) <= 15 * 60000);
  const late = plan.backBy ? Math.round(-minutesUntil(plan.backBy) * 60) : null, ontime = late != null && Math.abs(late) <= 60 ? late : null;
  const walked = store.get('walked', {}), stars = store.get('stars', { stars: [], names: {} });
  if (stars.stars.some(s => s.id === plan.id)) return status('이미 별이 된 산책이에요.');
  // 되돌릴 수 없으니 걷는 중이거나 1등성 아래면 묻는다 — 「잠깐 멈춤」 옆이라 잘못 누르기 쉬웠다(디자이너 검토)
  if ((watchId != null || cov < 0.9) && !confirm(`지금 끝내고 별을 받을까요? 모양 길 ${Math.round(cov * 100)}%예요${cov < 0.9 ? ' — 90%를 넘기면 1등성이 돼요' : ''}.`)) return;
  const before = stars.stars.slice(), firstOfKind = !before.some(x => x.shape === plan.shape && (plan.shape !== 'custom' || x.designId === plan.designId));
  const s = C.done(plan, walked, stars, { coverage: cov, walkedKm: +trackKm(pts).toFixed(2), skipped, kept, ontime });
  if (skip.length) s.skipGrid = toSpots(skip);
  if (!store.set('stars', stars)) return; // 저장 실패 — 산책과 걸은 기록을 그대로 둔다
  store.set('walked', walked); store.set('plan', null); store.set('track', null);
  stopWalk(); plan = null; drawPlan(null); meLayer.clearLayers();
  $('bWalk').disabled = $('bDone').disabled = $('bGpx').disabled = true;
  const unlocked = K.newlyUnlocked(before, stars.stars);
  status(`${s.gold ? '반짝 별' : '새 별'}이 떴어요. 별 ${stars.stars.length}개째예요.`);
  const su = K.suName(K.suIndex(s.ll)), suNew = !before.some(x => Array.isArray(x.ll) && K.suIndex(x.ll) === K.suIndex(s.ll));
  const DIR = { 북방현무: '북쪽', 동방청룡: '동쪽', 남방주작: '남쪽', 서방백호: '서쪽' };
  const notes = [`모양 길의 ${Math.round(cov * 100)}%를 걸었어요${skipped ? ` (못 가는 길 ${Math.round(skipped * 100)}%는 빼고 셌어요)` : ''}`,
    `서울시청에서 본 ${DIR[su.group]} 칸 「${su.name}수」${suNew ? '를 처음 채웠어요 — 도감 「28수 둥근 판」에 칠해져요' : '에 별이 하나 더 떴어요'}`,
    kept ? '약속한 시각에 걸어서 한 등급 더 밝아요' : '', ontime != null ? `돌아갈 시각에 딱 맞춰 왔어요(${Math.abs(ontime)}초 ${ontime > 0 ? '늦게' : ontime < 0 ? '일찍' : '차이 없이'})` : '',
    (s.mats || []).length ? `단골집 도장 ${s.mats.length}곳` : '', firstOfKind ? '도감 「모양」 칸에 새로 올랐어요' : '',
    unlocked.length ? `업적: ${unlocked.map(a => esc(a.title)).join(' · ')}` : ''].filter(Boolean);
  const GR = ['', '가장 밝은 별', '밝은 별', '보통 별', '흐린 별', '아주 흐린 별'];
  $('info').innerHTML = `<div class="cele"><div class="bigstar${s.gold ? ' gold' : ''}" aria-hidden="true">★</div>
      <div><b>${s.gold ? '반짝 별' : '별'}이 떴어요</b><br>${shapeIco(s.shape)} ${esc(shapeName(s))} · ${s.grade}등성(${GR[s.grade]})</div></div>
    <div class="rule">${notes[0]}</div>
    <div class="row" style="margin-top:8px"><button id="bSeeSky" class="primary">밤하늘에서 보기</button></div>
    <div class="row links"><button class="link" id="bCard">작품 카드 만들기</button><button class="link" id="bDex2">도감 보기</button></div>
    <details class="more"><summary>자세히</summary><ul class="got">${notes.slice(1).map(x => `<li>${x}</li>`).join('')}</ul>${skip.length ? `
      <button type="button" id="bReport">못 가는 길 민원 문구 복사</button><p class="note" style="margin-top:4px">서울시 응답소·안전신문고에 붙여 넣어요. 앱은 아무 데도 보내지 않아요. 도감에서도 다시 복사할 수 있어요.</p>` : ''}</details>`;
  if (skip.length) $('bReport').onclick = () => copyReport(s.skipGrid, s.date);
  $('bSeeSky').onclick = () => $('bSky').click();
  $('sheet').classList.add('celebrate'); $('hint').hidden = true;
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
    L.circleMarker(s.ll, { radius: 22, stroke: false, fillColor: s.gold ? T('--gold') : T('--star'), fillOpacity: .18, interactive: false }).addTo(skyLayer);
    L.circleMarker(s.ll, { radius: [0, 11, 8, 6, 4, 3][s.grade] || 3, color: s.gold ? T('--gold') : T('--star'), fillColor: s.gold ? T('--gold') : T('--star'), fillOpacity: 1, weight: s.gold ? 3 : 1 })
      .addTo(skyLayer).bindTooltip(esc(`${s.grade}등성 · ${shapeName(s)} · ${s.date} · 처음 걷는 길 ${s.newKm} km`));
    L.marker(s.ll, { icon: L.divIcon({ className: 'skyewrap', iconSize: null, html: `<div class="skye">${shapeIco(s.shape)}</div>` }), interactive: false }).addTo(skyLayer);
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
    map.removeLayer(planLayer); map.removeLayer(meLayer); if (startMarker) map.removeLayer(startMarker); if (endMarker) map.removeLayer(endMarker); // 밤하늘엔 출발점·오가는 길을 그리지 않는다
    map.setMaxZoom(14); // 밤하늘에선 동네 단위까지만 — 별 하나일 때 거리 이름까지 읽히던 일
    setBase(store.get('base', 'osm'), true); skyLayer.addTo(map); drawSky(); $('bSky').lastChild.textContent = '산책으로'; $('bSky').setAttribute('aria-pressed', 'true');
    $('sheet').classList.remove('celebrate');
    $('bPlan').disabled = $('bLoc').disabled = true; // 밤하늘에선 산책을 짜지 않는다(안 보이는 층에 그려진다)
    $('info').style.display = 'none';
  } else {
    mode = 'plan'; delete document.documentElement.dataset.theme;
    map.removeLayer(skyLayer); planLayer.addTo(map); meLayer.addTo(map); if (startMarker) startMarker.addTo(map); if (endMarker) endMarker.addTo(map);
    map.setMaxZoom(19);
    setBase(store.get('base', 'osm'), false); $('bSky').lastChild.textContent = '밤하늘'; $('bSky').setAttribute('aria-pressed', 'false'); $('bPlan').disabled = $('bLoc').disabled = false;
    $('info').style.display = '';
    // 돌아오면 새 화면으로 — 별 받은 축하 화면이 그대로 다시 떠서 「밤하늘에서 보기」와 오가며 뒤로 가는 것처럼 보였다(10-08 사용자 보고)
    if (plan) { drawPlan(plan); status('하던 산책이 있어요.'); }
    else { drawPlan(null); status(start ? '「산책 뽑기」를 누르면 같은 출발점에서 새 산책을 뽑아요. 다른 곳에서 하려면 출발 깃발을 눌러 지우세요.' : '지도를 눌러 출발할 곳을 골라 주세요.'); }
  }
};

// ---------- 설정 ----------
$('bSet').onclick = () => {
  $('sRadius').value = store.get('radius', 1000); $('sSize').value = store.get('size', 400);
  $('sBase').value = store.get('base', 'osm'); $('sKey').value = store.get('vwkey', '');
  $('sPick').value = store.get('pick', 'all'); $('sMat').value = store.get('matRoute', 'off'); $('sVib').value = store.get('vib', 'on'); $('sCue').value = store.get('cue', 'navigator' in self && navigator.vibrate ? 'vib' : 'off');
  $('dSet').showModal();
};
$('dSet').addEventListener('close', () => {
  store.set('radius', +$('sRadius').value); store.set('size', +$('sSize').value);
  store.set('vwkey', $('sKey').value.trim()); store.set('base', $('sBase').value); store.set('pick', $('sPick').value); store.set('matRoute', $('sMat').value); store.set('vib', $('sVib').value); store.set('cue', $('sCue').value);
  if ($('sBase').value.startsWith('vw-') && !$('sKey').value.trim()) status('V-World 키가 없어 OpenStreetMap으로 보여요');
  if ($('sPick').value === 'custom' && !activeDesign()) status('「내 도안」을 고르셨어요. 도감에서 도안을 먼저 만들어 주세요.');
  setBase(store.get('base', 'osm'), mode === 'sky');
  setLen(curLen(), false); // 고급에서 고친 거리를 단추에도(맞는 단추가 없으면 모두 꺼짐)
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
  && (s.skipGrid == null || (Array.isArray(s.skipGrid) && s.skipGrid.length <= 50 && s.skipGrid.every(x => isStr(x, 30))))
  && (s.skipped == null || isNum(s.skipped)) && (s.ontime == null || isNum(s.ontime)) && (s.rule == null || Number.isInteger(s.rule)) && (s.kept == null || typeof s.kept === 'boolean')
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
// 분 눈금(「점심 산책」): 10-08 measure_lunch.mjs — 5곳×6회 도형 산책의 총거리 가운데값 1.5·1.93·2.78 km를 4.5 km/h로 환산
const WALK_M_PER_MIN = 75; // 4.5 km/h — 가정이라 단추에 「쯤」을 붙인다
const LENS = {
  km: { short: { radius: 500, size: 300, label: '짧게 · 2~3.5 km' }, mid: { radius: 1000, size: 400, label: '보통 · 4.5~6 km' }, long: { radius: 2000, size: 600, label: '길게 · 6 km 이상' } },
  min: { short: { radius: 250, size: 150, min: 20, label: '20분쯤 · 1.5 km' }, mid: { radius: 350, size: 200, min: 30, label: '30분쯤 · 2 km' }, long: { radius: 500, size: 300, min: 40, label: '40분쯤 · 3 km' } },
};
const lens = () => LENS[store.get('unit', 'km')] || LENS.km;
const curLen = () => Object.keys(lens()).find(k => lens()[k].radius === +store.get('radius', 1000) && lens()[k].size === +store.get('size', 400));
function setLen(k, save = true) {
  for (const b of document.querySelectorAll('#lenRow [data-len]')) { b.setAttribute('aria-pressed', String(b.dataset.len === k)); b.textContent = lens()[b.dataset.len].label; }
  $('bUnit').textContent = store.get('unit', 'km') === 'min' ? 'km로 보기' : '분으로 보기';
  $('lenNote').hidden = !!lens()[k];
  if (!lens()[k]) $('lenNote').textContent = `설정에서 고른 값 · 반경 ${store.get('radius', 1000)} m · 모양 ${store.get('size', 400)} m`;
  if (save && lens()[k]) { store.set('radius', lens()[k].radius); store.set('size', lens()[k].size); }
}
for (const b of document.querySelectorAll('#lenRow [data-len]')) b.onclick = () => setLen(b.dataset.len);
$('bUnit').onclick = () => { const k = curLen() || 'mid'; store.set('unit', store.get('unit', 'km') === 'min' ? 'km' : 'min'); setLen(k); }; // 같은 칸 자리를 다른 눈금으로
setLen(curLen(), false);
// 돌아갈 시각 기본값: 점심때(11:30~13:00)면 13:00과 「지금 + 고른 분」 중 늦은 쪽 — 12:50에 40분을 뽑고 바로 「돌아가세요」를 듣지 않게(10-08 사용자 결정)
function defaultBackBy(min, now = new Date()) {
  const m = now.getHours() * 60 + now.getMinutes(), t = m >= 690 && m < 780 ? Math.max(780, m + min) : m + min;
  return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
const minutesUntil = (hhmm, now = new Date()) => { const [h, m] = hhmm.split(":").map(Number), d = h * 60 + m - (now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60); return d < -720 ? d + 1440 : d; }; // 자정을 넘는 시각(23:50에 뽑은 00:10)은 다음 날로

// ---------- 메뉴 접기: 손잡이를 누르거나 아래로 밀면 접히고 위로 밀면 펼쳐진다 ----------
function setFold(on, save = true) {
  $('sheet').classList.toggle('folded', on);
  $('fold').setAttribute('aria-expanded', String(!on));
  $('fold').setAttribute('aria-label', on ? '메뉴 펼치기' : '메뉴 접기');
  $('fold').querySelector('em').textContent = on ? '메뉴 펼치기' : '접기';
  if (save) store.set('fold', on);
}
// 누르기는 click에서 바꾼다 — pointerup에서 펼치면 시트가 먼저 커지고, 폰이 그 뒤에 만드는 click이
// 손가락 아래로 올라온 「걷기 시작」에 떨어졌다(10-08 사용자 보고). 밀기만 pointerup에서, 뒤따르는 click은 버린다
let foldY = null, swiped = false;
$('fold').addEventListener('pointerdown', e => { foldY = e.clientY; swiped = false; });
$('fold').addEventListener('pointerup', e => {
  if (foldY == null) return;
  const dy = e.clientY - foldY; foldY = null;
  if (Math.abs(dy) > 30) { swiped = true; setFold(dy > 0); }
});
$('fold').addEventListener('click', () => { if (swiped) { swiped = false; return; } setFold(!$('sheet').classList.contains('folded')); }); // 키보드 Enter·Space도 click으로 온다
setFold(store.get('fold', false), false);

// ---------- 28수 성도: 서울시청을 가운데 두고 방위 28칸 ----------
function suSvg(S) {
  const f = K.suFilled(S), cx = 160, cy = 160, R = 150, r0 = 78, step = 360 / 28;
  const pt = (b, r) => [cx + r * Math.sin(b * Math.PI / 180), cy - r * Math.cos(b * Math.PI / 180)];
  const done = K.SU.map((_, g) => [0, 1, 2, 3, 4, 5, 6].every(k => f.has(g * 7 + k)));
  let w = '', t = '';
  for (let i = 0; i < 28; i++) {
    const b0 = 315 + i * step, b1 = b0 + step, [x0, y0] = pt(b0, R), [x1, y1] = pt(b1, R), [x2, y2] = pt(b1, r0), [x3, y3] = pt(b0, r0);
    const g = Math.floor(i / 7), on = f.has(i), cls = (done[g] ? 'w done' : on ? 'w on' : 'w') + (todayGold().includes(i) ? ' gold' : ''), { name } = K.suName(i);
    w += `<path data-i="${i}" class="${cls}" d="M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z"><title>${K.SU[g][0]} ${name}${on ? ` · 별 ${f.get(i)}개` : ''}</title></path>`;
    const [tx, ty] = pt(b0 + step / 2, (R + r0) / 2);
    t += `<text x="${tx}" y="${ty - 4}" class="${on || done[g] ? 'on' : ''}">${name.slice(2, 3)}</text><text x="${tx}" y="${ty + 9}" class="hg${on || done[g] ? ' on' : ''}">${name.slice(0, 1)}</text>`;
  }
  const q = K.SU.map(([, short], g) => { const [x, y] = pt(g * 90, r0 - 16); return `<text class="q" x="${x}" y="${y}">${short}${done[g] ? ' ✓' : ''}</text>`; }).join('');
  const filled = [...f.keys()].sort((a, b) => a - b).map(i => { const n = K.suName(i); return `${n.group} ${n.name}수 별 ${f.get(i)}개`; });
  $('suInfo').textContent = K.SU.map(([, short], g) => `${short} ${[0, 1, 2, 3, 4, 5, 6].filter(k => f.has(g * 7 + k)).length}/7`).join(' · ') + ' — 칸을 누르면 이름이 보여요';
  $('goldInfo').textContent = `오늘의 반짝 칸(금테): ${todayGold().map(i => { const n = K.suName(i); return `${n.group.slice(0, 2)} 「${n.name}수」`; }).join(' · ')} — 모양이 이 칸에 들면 반짝 별이에요. 날마다 바뀌어요.`;
  return `<svg viewBox="0 0 320 320" role="img" aria-label="28수 둥근 판: 28칸 중 ${f.size}칸 채움${filled.length ? ' — ' + filled.join(', ') : ''}">${w}${t}${q}<text x="${cx}" y="${cy - 8}">서울시청</text><text class="q" x="${cx}" y="${cy + 10}">${f.size} / 28수</text></svg>`;
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
      ${c.gold ? '<span class="tag">✨</span>' : ''}<div class="e">${ico(c.key, c.emoji)}</div>
      <div class="n">${esc(c.name)}</div>
      <div class="m">${!c.got ? hintOf(c.key) : c.count ? `${c.count}번 · ${c.best}등성` : '안 걸었어요'}</div>${extra}</div>`; // 못 모은 칸도 흐린 그림·이름을 보여 줘 무엇을 모을지 알게 한다
  $('suRing').innerHTML = suSvg(S);
  $('dexBase').innerHTML = D.base.map(c => cardHtml(c, c.got ? `<button class="sub" data-card="${c.key}">작품 카드</button>` : '')).join('');
  const act = store.get('activeDesign', null);
  $('dexMine').innerHTML = D.mine.length ? D.mine.map(c => {
    const id = c.key.slice(2);
    return cardHtml({ ...c, got: true }, `<button class="${id === act && store.get('pick', 'all') === 'custom' ? '' : 'sub'}" data-use="${id}">${id === act && store.get('pick', 'all') === 'custom' ? '✔ 다음 산책' : '이걸로 걷기'}</button>
      ${c.count ? `<button class="sub" data-card="${c.key}">작품 카드</button>` : ''}<button class="sub" data-del="${id}">지우기</button>`);
  }).join('') : '<p style="grid-column:1/-1;padding:var(--space-sm);font-size:13px;color:var(--sub)">아직 도안이 없어요. 손으로 그리거나 그림을 올려 보세요.</p>';
  const achRow = a => `<div class="ach${a.ok ? '' : ' no'}"><div class="e${ICONS.has(a.id) ? ' i' : ''}">${ico(a.id, a.emoji)}</div>
      <div class="t"><b>${esc(a.title)}</b> ${a.ok ? '<span class="ok">✓ 완료</span>' : `<span class="pc">${pct(a.progress)}%</span>`}<br><span style="color:var(--sub)">${esc(a.desc)}</span>
      ${a.ok ? '' : `<div class="bar" style="margin-top:4px" role="progressbar" aria-valuenow="${pct(a.progress)}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(a.title)} 진행"><i style="width:${pct(a.progress)}%"></i></div>`}</div></div>`;
  const todo = A.filter(a => !a.ok).sort((x, y) => y.progress - x.progress), doneA = A.filter(a => a.ok);
  $('achList').innerHTML = `<div class="achhead">지금 가까운 것</div>${todo.slice(0, 2).map(achRow).join('') || '<p class="note">모두 깼어요!</p>'}
    ${todo.length > 2 ? `<details class="achmore"><summary>나머지 업적 ${todo.length - 2}개</summary>${todo.slice(2).map(achRow).join('')}</details>` : ''}
    ${doneA.length ? `<details class="achmore"><summary>완료 ${doneA.length}개</summary>${doneA.map(achRow).join('')}</details>` : ''}`;
  // D3 못 가는 길 기록: 별마다 뭉갠 자리 — 언제든 민원 문구로
  const SK = S.filter(s => Array.isArray(s.skipGrid) && s.skipGrid.length);
  $('skipList').innerHTML = SK.length ? SK.map(s => `<div class="mat"><span><b>${esc(shapeName(s))}</b> · 20${esc(s.date.slice(0, 2))}.${esc(s.date.slice(2, 4))}.${esc(s.date.slice(4, 6))}<br><small>${s.skipGrid.length}곳(약 50 m 단위)</small></span><button class="sub" data-rep="${esc(s.id)}">민원 문구 복사</button></div>`).join('')
    : '<span style="font-size:13px;color:var(--sub)">걷다가 「못 가는 길」을 누르면 여기 남아요.</span>';
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
  if (t.dataset.rep) { const st = store.get('stars', { stars: [] }).stars.find(x => x.id === t.dataset.rep); if (st && st.skipGrid) copyReport(st.skipGrid, st.date); }
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
  const im = ICONS.has(s.shape) ? await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = `icons/${s.shape}.png`; }) : null;
  if (im) g.drawImage(im, W / 2 - 80, 50, 160, 160); else { g.font = '120px serif'; g.fillText(emoji(s.shape), W / 2, 170); }
  g.font = 'bold 64px "IBM Plex Sans KR", sans-serif'; g.fillText(`${s.gold ? '반짝 ' : ''}${shapeName(s)}`, W / 2, 1100);
  const suc = K.suName(K.suIndex(s.ll)); g.font = '600 40px "IBM Plex Sans KR", sans-serif'; g.fillStyle = '#f2d98a'; g.fillText(`${suc.group} ${suc.name}수`, W / 2, 1160); g.fillStyle = '#fff';
  g.font = '36px "IBM Plex Sans KR", sans-serif'; g.fillStyle = '#c9d6ff';
  g.fillText(`${s.grade}등성 · ${s.walkedKm ? s.walkedKm + ' km 걸어서 그림 · ' : ''}20${s.date.slice(0, 2)}.${s.date.slice(2, 4)}.${s.date.slice(4, 6)}`, W / 2, 1220);
  if (s.coverage != null) { g.font = '24px "IBM Plex Sans KR", sans-serif'; g.fillStyle = '#8fa0c8'; g.fillText(ruleNote(s), W / 2, 1258); }
  g.font = '30px "IBM Plex Sans KR", sans-serif'; g.fillStyle = '#8fa0c8'; g.fillText('동네 별자리 · leeyoy1.github.io/ddol', W / 2, 1305);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `동네별자리_${shapeName(s)}_${s.date}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '동네 별자리' }); return; } catch { /* 취소하면 저장으로 */ }
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: file.name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  status('작품 카드를 저장했어요. 지도와 좌표는 담기지 않아요.');
}

// ---------- 못 걷는 길: 지금 자리 둘레 60 m의 모양 길을 판정에서 뺀다(뺀 몫은 40%까지) ----------
$('bSkip').onclick = () => {
  const tr = store.get('track', null);
  if (!plan || !tr || tr.id !== plan.id || !tr.pts.length) return tell('위치를 받은 뒤에 눌러 주세요.');
  const here = tr.pts[tr.pts.length - 1], skip = [...(tr.skip || []), here];
  const before = C.skippedFrac(plan.loopLL, tr.skip || []), after = C.skippedFrac(plan.loopLL, skip);
  if (after === before) return tell('여기는 모양 길에서 멀어요. 모양 길 위에서 눌러 주세요.');
  if (!(tr.skip || []).length && !confirm('이 근처 모양 길(약 50 m)을 별 판정에서 뺄까요?\n계단·막힌 길처럼 못 가는 곳에서 눌러 주세요. 길을 다시 짜 주지는 않아요.')) return;
  if (after > C.SKIP_MAX) return tell(before ? `모양 길의 ${Math.round(C.SKIP_MAX * 100)}%까지만 뺄 수 있어요. 다른 날 다시 걸어도 좋아요.`
    : '이 근처는 모양 길이 여러 번 겹쳐 지나서 한 번에 너무 많이 빠져요. 조금 옮겨서 눌러 주세요.');
  tr.skip = skip; store.set('track', tr);
  L.marker(here, { icon: L.divIcon({ className: 'skipwrap', html: '<div class="skip">✕</div>', iconSize: null }), interactive: false }).addTo(meLayer);
  tell(`이 근처 모양 길을 판정에서 뺐어요 · 지금까지 ${Math.round(after * 100)}% 뺌. 다녀온 뒤 민원 문구를 복사할 수 있어요.`);
};
// 알림 문구: 자리는 약 50 m 단위로 뭉갠다. 앱은 어디로도 보내지 않는다 — 사용자가 직접 붙여 넣는다
const grid = v => (Math.round(v / 0.0005) * 0.0005).toFixed(4);
const toSpots = skip => [...new Set(skip.map(([a, b]) => `${grid(a)},${grid(b)}`))];
function reportText(spots0, date) {
  const spots = spots0.map(x => { const [a, b] = x.split(','); return `위도 ${a}, 경도 ${b} 부근`; });
  return ['[보행 불편 구간 알림]', '아래 자리 부근은 걸어서 지나기 어려웠습니다. (계단·보도 끊김·어두움·공사 등 — 구체적인 사정을 덧붙여 주세요)',
    ...spots.map(x => '- ' + x + ' (약 50 m 범위)'), `※ ${date ? `20${date.slice(0, 2)}.${+date.slice(2, 4)}.${+date.slice(4, 6)}` : localDate()} 산책 기록에서 뽑음 · 위치는 약 50 m 단위로 뭉갬`].join('\n');
}
const localDate = (d = new Date()) => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
async function copyReport(spots, date) {
  const t = reportText(spots, date);
  try { await navigator.clipboard.writeText(t); status('문구를 복사했어요. 서울시 응답소나 안전신문고 같은 곳에 직접 붙여 넣어 보내 주세요. 앱은 아무 데도 보내지 않아요.'); }
  catch { prompt('이 문구를 복사해 직접 보내 주세요', t); }
}
const promiseText = v => { const d = new Date(v); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
// 판정 쪽지: 이 별이 어느 규칙으로 떴는지(규칙이 바뀌어도 남는다). 좌표는 담지 않는다
function ruleNote(s) {
  return [`판정 규칙 ${s.rule || 2} · 모양 길 ${Math.round(s.coverage * 100)}% 지남(기준 ${Math.round(C.NEED * 100)}%)`,
    s.skipped ? `못 가는 길 ${Math.round(s.skipped * 100)}% 뺌` : '', s.kept ? '약속 지킴' : '', s.ontime != null ? `정각 ${s.ontime >= 0 ? '+' : ''}${s.ontime}초` : ''].filter(Boolean).join(' · ');
}

// 지도 위 단추(내 위치로)가 아래 시트에 가리지 않게 시트 높이를 CSS에 넘긴다
const syncH = () => { const s = document.documentElement.style; s.setProperty('--sheet-h', $('sheet').offsetHeight + 'px'); s.setProperty('--top-h', $('top').offsetHeight + 'px'); };
const ro = new ResizeObserver(syncH); ro.observe($('sheet')); ro.observe($('top'));
if (!('vibrate' in navigator)) $('vibNote').hidden = false;
$('alertBar').onclick = () => { $('alertBar').hidden = true; };
$('homeBar').onclick = () => { $('homeBar').hidden = true; };
$('bHome').onclick = () => { if (!lastLL) return tell('걷기를 시작하고 위치를 받은 뒤에 보여요.'); showHome(lastLL); };
// 숨긴 낭독 칸: 이정표·경고만 읽는다(급하면 assertive 칸)
function say(t, urgent = false) { const el = $(urgent ? 'srAlert' : 'srLive'); el.textContent = ''; setTimeout(() => { el.textContent = t; }, 50); }
// 돌아갈 시각 경고: 위 띠 색 + 지도 위 배너(진동이 없는 폰에서도 보이게)
// 점에서 선(위경도 점 배열)까지의 가장 가까운 거리(m) — 짧은 구간이라 평면으로 근사
function distTo(ll, line) {
  const k = Math.cos(ll[0] * Math.PI / 180) * 111320, P = ([a, b]) => [(b - ll[1]) * k, (a - ll[0]) * 110540];
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = P(line[i - 1]), [bx, by] = P(line[i]), dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
// 걷는 중 신호: 진동(안드로이드) 또는 짧은 소리(진동이 없는 아이폰) — 설정에서 끌 수 있다
let audioCtx = null;
function cue(kind) {
  const how = store.get('cue', navigator.vibrate ? 'vib' : 'off');
  if (how === 'vib' && navigator.vibrate) navigator.vibrate({ on: 80, off: [80, 80, 80], corner: 350 }[kind]);
  else if (how === 'sound') {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const beeps = { on: [[880, 0]], off: [[440, 0], [440, 0.18]], corner: [[660, 0], [990, 0.15]] }[kind];
      for (const [f, at] of beeps) { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = f; g.gain.value = 0.15; o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + at); o.stop(audioCtx.currentTime + at + 0.12); }
    } catch { /* 소리를 못 내는 브라우저는 그냥 간다 */ }
  }
}
// ② 귀가 화살표: 지도 대신 돌아갈 곳 방향 하나와 거리만(지도 위쪽 = 북쪽)
function showHome(ll) {
  if (!plan) return;
  const to = plan.backLL[plan.backLL.length - 1], km = map.distance(ll, to) / 1000;
  const ang = Math.atan2((to[1] - ll[1]) * Math.cos(ll[0] * Math.PI / 180), to[0] - ll[0]) * 180 / Math.PI; // 북쪽 0°, 시계 방향
  const dir = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][((Math.round(ang / 45) % 8) + 8) % 8];
  $('homeArrow').style.transform = `rotate(${ang.toFixed(0)}deg)`;
  $('homeText').textContent = `${plan.oneWay ? '끝낼 곳' : '출발점'}까지 ${km.toFixed(1)} km · ${dir}쪽(지도 위쪽이 북쪽)`;
  $('homeBar').hidden = false;
  say(`길에서 멀어졌어요. ${plan.oneWay ? '끝낼 곳' : '출발점'}은 ${dir}쪽 ${km.toFixed(1)} 킬로미터예요.`, true);
}
// ③ 오늘의 반짝 칸: 날짜(yymmdd)로 정하는 28수 세 칸(서로 다른 방위)
function todayGold(d = new Date()) {
  const s = String(d.getFullYear()) + (d.getMonth() + 1) + '-' + d.getDate();
  let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const i = h % 28; return [i, (i + 9) % 28, (i + 18) % 28];
}
function backAlert(on) {
  $('top').classList.toggle('alert', on); $('alertBar').hidden = !on;
  if (on && plan && plan.backBy) $('alertBar').textContent = `지금 돌아가면 ${hm(plan.backBy)}에 맞춰요 · 누르면 닫혀요`;
}
// 「13:00」 → 「오후 1:00」(입력칸의 표기와 맞춘다)
function hm(hhmm) { const [h, m] = hhmm.split(':').map(Number); return `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`; }
function quitPlan() {
  const tr = store.get('track', null), km = tr && plan && tr.id === plan.id ? trackKm(tr.pts) : 0;
  if (!confirm(`이 산책을 그만둘까요?${km > 0.01 ? ` 걸은 길 ${km.toFixed(2)} km 기록은 지워져요.` : ''}`)) return;
  store.set('plan', null); store.set('track', null); stopWalk(); plan = null; drawPlan(null); meLayer.clearLayers();
  $('bWalk').disabled = $('bDone').disabled = $('bGpx').disabled = true;
  setFold(false, false);
  status('산책을 그만뒀어요. 지도를 눌러 다시 시작해요.');
}

const trPrev = plan && store.get('track', null);
// 도감의 못 모은 모양 칸: 「아직이에요」 대신 얻는 길의 단서
function hintOf(key) { return C.CATEGORY.geo.includes(key) ? '도형 · 짧게도 돼요' : C.CATEGORY.animal.includes(key) ? '동물 · 600 m 넘게' : C.CATEGORY.plant.includes(key) ? '식물 · 600 m 넘게' : '아직이에요'; }
$('suRing').addEventListener('click', e => {
  const el = e.target.closest('path[data-i]'); if (!el) return;
  const i = +el.dataset.i, n = K.suName(i), c = K.suFilled(store.get('stars', { stars: [] }).stars).get(i) || 0;
  $('suInfo').textContent = `${n.group} · ${n.name}수 · ${c ? `별 ${c}개` : '아직 비어 있어요'}`;
});
if (plan && trPrev && trPrev.id === plan.id && trPrev.pts.length) {
  drawPlan(plan);
  L.polyline(trPrev.pts, { color: T('--path-go'), weight: 4 }).addTo(meLayer);
  status(`하던 산책이 있어요 · 걸은 길 ${trackKm(trPrev.pts).toFixed(2)} km · 모양 길 ${Math.round(C.coverage(plan.loopLL, trPrev.pts, 20, 40, trPrev.skip) * 100)}%. 「걷기 시작」으로 이어요.`);
} else if (plan) { drawPlan(plan); status(plan.promise ? `약속한 산책이 있어요 · ${promiseText(plan.promise)}. 그때 「걷기 시작」을 눌러 주세요.` : '하던 산책이 있어요. 「걷기 시작」으로 이어서 걸어요.'); }
syncH(); // 처음 한 번은 바로(관찰 콜백은 그리기 단계에서야 온다)
if (plan) setTimeout(() => plan && fit(L.polyline(plan.fullLL).getBounds()), 400); // 다시 열 때는 글꼴·시트 높이가 자리 잡은 뒤 한 번 더 맞춘다
loadMat(); // 단골집 자료가 있으면 설정·도감에 그 칸을 보인다
window.__app = { setStart, C, outlineFromRGBA, map, addPoint, get plan() { return plan; } }; // 점검용
