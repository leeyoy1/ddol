// 원정 계산 작업자 — 계산이 화면 스레드를 붙잡지 않게(10-08 검토: 큰 설정에서 수 초 멈춤)
import { runPlan } from './plan_job.js';

self.onmessage = async e => {
  try { self.postMessage({ ok: true, plan: await runPlan(e.data, (n, total) => self.postMessage({ progress: [n, total] })) }); }
  catch (err) { self.postMessage({ ok: false, msg: err.message || '원정을 짜지 못했어요.' }); }
};
