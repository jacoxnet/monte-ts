<script lang="ts">
  import type { SimResult, Summary } from '../sim/types';
  import { formatCurrency, formatPercent } from '../format';

  let { result }: { result: SimResult } = $props();

  const band = $derived(
    result.successRate >= 0.9 ? 'good' : result.successRate >= 0.75 ? 'warn' : 'bad',
  );

  const rows: { key: keyof Summary; label: string }[] = [
    { key: 'mean', label: 'Mean' },
    { key: 'median', label: 'Median' },
    { key: 'p25', label: '25th percentile' },
    { key: 'p10', label: '10th percentile' },
    { key: 'min', label: 'Minimum' },
    { key: 'max', label: 'Maximum' },
  ];

  const failures = $derived(result.params.runs - result.successes);
</script>

<section class="results">
  <div class="headline {band}">
    <div class="rate">{formatPercent(result.successRate)}</div>
    <div class="caption">
      success rate: {result.successes.toLocaleString()} of {result.params.runs.toLocaleString()} runs
      lasted {result.params.years} years
    </div>
  </div>

  <h2>Ending wealth</h2>
  <table>
    <thead>
      <tr>
        <th scope="col"></th>
        <th scope="col">Nominal</th>
        <th scope="col">Today's dollars</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.key)}
        <tr>
          <th scope="row">{row.label}</th>
          <td>{formatCurrency(result.nominal[row.key])}</td>
          <td>{formatCurrency(result.real[row.key])}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <dl class="meta">
    {#if result.medianFailureYear !== null}
      <div>
        <dt>Failed runs</dt>
        <dd>{failures.toLocaleString()} (median depletion in year {result.medianFailureYear})</dd>
      </div>
    {/if}
    <div>
      <dt>First-year withdrawal</dt>
      <dd>{formatCurrency(result.params.withdrawalRate * result.params.initialWealth)}</dd>
    </div>
    <div>
      <dt>Seed</dt>
      <dd>{result.params.seed}</dd>
    </div>
    <div>
      <dt>Time</dt>
      <dd>{result.elapsedMs.toFixed(0)} ms</dd>
    </div>
  </dl>
</section>

<style>
  .headline {
    border-radius: 12px;
    padding: 20px;
    background: var(--surface-2);
    border-left: 6px solid var(--band);
  }
  .good {
    --band: var(--good);
  }
  .warn {
    --band: var(--warn);
  }
  .bad {
    --band: var(--bad);
  }
  .rate {
    font-size: clamp(2.5rem, 8vw, 3.5rem);
    font-weight: 700;
    line-height: 1;
    color: var(--band);
    font-variant-numeric: tabular-nums;
  }
  .caption {
    margin-top: 6px;
    color: var(--muted);
  }
  h2 {
    font-size: 1rem;
    margin: 24px 0 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 8px 6px;
    border-bottom: 1px solid var(--border);
    text-align: right;
  }
  th[scope='row'],
  thead th:first-child {
    text-align: left;
    font-weight: 500;
  }
  thead th {
    font-size: 0.8rem;
    color: var(--muted);
    font-weight: 600;
  }
  .meta {
    display: grid;
    gap: 6px;
    margin: 20px 0 0;
    font-size: 0.875rem;
  }
  .meta div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    text-align: right;
  }
</style>
