<script lang="ts">
  import InputForm from './lib/components/InputForm.svelte';
  import Results from './lib/components/Results.svelte';
  import { DEFAULTS, loadInputs, saveInputs, toParams, validate, type FormValues } from './lib/inputs';
  import type { SimResult, WorkerRequest, WorkerResponse } from './lib/sim/types';

  let values: FormValues = $state(loadInputs());
  const errors = $derived(validate(values));

  let running = $state(false);
  let progress = $state(0);
  let result: SimResult | null = $state(null);
  let error: string | null = $state(null);
  let worker: Worker | null = null;

  $effect(() => {
    saveInputs($state.snapshot(values));
  });

  function getWorker(): Worker {
    if (!worker) {
      worker = new Worker(new URL('./lib/sim/sim.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === 'progress') progress = msg.fraction;
        else if (msg.type === 'done') {
          result = msg.result;
          running = false;
        } else {
          error = msg.message;
          running = false;
        }
      };
      worker.onerror = (e) => {
        error = e.message || 'Simulation worker failed';
        running = false;
        stopWorker();
      };
    }
    return worker;
  }

  function stopWorker() {
    worker?.terminate();
    worker = null;
  }

  function run() {
    error = null;
    progress = 0;
    running = true;
    const req: WorkerRequest = { type: 'run', params: toParams(values) };
    getWorker().postMessage(req);
  }

  function cancel() {
    stopWorker();
    running = false;
  }

  function reset() {
    values = { ...DEFAULTS };
  }
</script>

<main>
  <header>
    <h1>Monte Carlo Retirement Simulator</h1>
    <p>
      Each run draws normally distributed annual returns and makes a withdrawal at the start of each
      year, either a constant inflation-adjusted amount or one governed by Guyton-Klinger guardrails.
      A run succeeds if the money lasts through every withdrawal.
    </p>
  </header>

  <div class="layout">
    <div class="panel">
      <InputForm bind:values {errors} {running} onrun={run} oncancel={cancel} onreset={reset} />
    </div>

    <div class="panel output" aria-live="polite">
      {#if running}
        <div class="progress">
          <div class="bar"><div class="fill" style:width="{progress * 100}%"></div></div>
          <span>Simulating… {Math.round(progress * 100)}%</span>
        </div>
      {/if}
      {#if error}
        <p class="error">{error}</p>
      {/if}
      {#if result}
        <div class:stale={running}>
          <Results {result} />
        </div>
      {:else if !running}
        <p class="empty">Enter your assumptions and run the simulation.</p>
      {/if}
    </div>
  </div>

  <footer>
    <p>
      Notes: returns are nominal and drawn independently each year from a normal distribution,
      clamped at −100%. The mean is arithmetic; compound growth is roughly mean − σ²/2. Ending
      wealth counts failed runs as $0. Today's dollars divide by (1 + inflation)<sup>years</sup>.
    </p>
    <p>
      Guardrails (Guyton-Klinger): the first withdrawal is 5.5% of initial wealth. Each later year it is
      raised by inflation, unless the previous year's return was negative and the current withdrawal
      rate is above 5.5%. If the current rate (withdrawal ÷ portfolio) then exceeds 6.6%, the withdrawal
      is cut 10%, except in the final 15 years; if it falls below 4.4%, it is raised 10%.
    </p>
  </footer>
</main>

<style>
  main {
    max-width: 1040px;
    margin: 0 auto;
    padding: 24px 16px 40px;
  }
  header h1 {
    font-size: clamp(1.5rem, 4vw, 2rem);
    margin: 0 0 8px;
  }
  header p {
    color: var(--muted);
    margin: 0 0 24px;
    max-width: 70ch;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
  }
  .progress {
    display: grid;
    gap: 6px;
    margin-bottom: 16px;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width 80ms linear;
  }
  .stale {
    opacity: 0.45;
  }
  .empty {
    color: var(--muted);
    margin: 0;
  }
  .error {
    color: var(--bad);
  }
  footer {
    margin-top: 24px;
    font-size: 0.8rem;
    color: var(--muted);
    max-width: 80ch;
  }
</style>
