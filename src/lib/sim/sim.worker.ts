import { simulate } from './simulate';
import type { WorkerRequest, WorkerResponse } from './types';

const post = (msg: WorkerResponse) => self.postMessage(msg);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  if (e.data.type !== 'run') return;
  try {
    let lastReported = 0;
    const result = simulate(e.data.params, (fraction) => {
      // Throttle to ~1% steps so the main thread isn't flooded.
      if (fraction - lastReported >= 0.01 || fraction === 1) {
        lastReported = fraction;
        post({ type: 'progress', fraction });
      }
    });
    post({ type: 'done', result });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
