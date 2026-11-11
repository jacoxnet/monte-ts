import { compare } from './simulate';
import type { WorkerRequest, WorkerResponse } from './types';

const post = (msg: WorkerResponse) => self.postMessage(msg);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  if (e.data.type !== 'run') return;
  try {
    const result = compare(e.data.params, (fraction) => post({ type: 'progress', fraction }));
    post({ type: 'done', result });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
