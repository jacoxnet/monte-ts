<script lang="ts">
  import type { Comparison, ReturnModel, SimResult, Summary } from '../sim/types';
  import { formatCurrency, formatPercent } from '../format';

  let { comparison }: { comparison: Comparison } = $props();

  const labels: Record<ReturnModel, string> = {
    normal: 'Normal',
    lognormal: 'Lognormal',
  };

  const columns = $derived([comparison.normal, comparison.lognormal]);
  const params = $derived(comparison.normal.params);

  const band = (r: SimResult) =>
    r.successRate >= 0.9 ? 'good' : r.successRate >= 0.75 ? 'warn' : 'bad';

  const rows: { key: keyof Summary; label: string }[] = [
    { key: 'mean', label: 'Mean' },
    { key: 'median', label: 'Median' },
    { key: 'p25', label: '25th percentile' },
    { key: 'p10', label: '10th percentile' },
    { key: 'min', label: 'Minimum' },
    { key: 'max', label: 'Maximum' },
  ];

  const sections: { key: 'nominal' | 'real'; label: string }[] = [
    { key: 'nominal', label: 'Ending wealth, nominal' },
    { key: 'real', label: "Ending wealth, today's dollars" },
  ];

  const difference = $derived(
    (comparison.lognormal.successRate - comparison.normal.successRate) * 100,
  );
  const elapsedMs = $derived(columns.reduce((sum, r) => sum + r.elapsedMs, 0));
</script>

<section class="results">
  <div class="headlines">
    {#each columns as r (r.model)}
      <div class="headline {band(r)}">
        <div class="model">{labels[r.model]}</div>
        <div class="rate">{formatPercent(r.successRate)}</div>
        <div class="caption">
          success rate: {r.successes.toLocaleString()} of {params.runs.toLocaleString()} runs
          lasted {params.years} years
        </div>
      </div>
    {/each}
  </div>
  <p class="difference">
    Lognormal minus normal: {difference < 0 ? '−' : '+'}{Math.abs(difference).toFixed(1)} percentage points
  </p>

  <table>
    <thead>
      <tr>
        <th scope="col"></th>
        <th scope="col">Normal</th>
        <th scope="col">Lognormal</th>
      </tr>
    </thead>
    <tbody>
      <tr class="group"><th scope="colgroup" colspan="3">Annual return</th></tr>
      <tr>
        <th scope="row">Arithmetic mean</th>
        {#each columns as r (r.model)}
          <td>{formatPercent(r.arithmeticMean)}</td>
        {/each}
      </tr>
      <tr>
        <th scope="row">Geometric mean</th>
        {#each columns as r (r.model)}
          <td>{r.model === 'normal' ? '≈ ' : ''}{formatPercent(r.geometricMean)}</td>
        {/each}
      </tr>
    </tbody>
    {#each sections as section (section.key)}
      <tbody>
        <tr class="group"><th scope="colgroup" colspan="3">{section.label}</th></tr>
        {#each rows as row (row.key)}
          <tr>
            <th scope="row">{row.label}</th>
            {#each columns as r (r.model)}
              <td>{formatCurrency(r[section.key][row.key])}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    {/each}
    <tbody>
      <tr class="group"><th scope="colgroup" colspan="3">Failed runs</th></tr>
      <tr>
        <th scope="row">Count</th>
        {#each columns as r (r.model)}
          <td>{(params.runs - r.successes).toLocaleString()}</td>
        {/each}
      </tr>
      <tr>
        <th scope="row">Median depletion year</th>
        {#each columns as r (r.model)}
          <td>{r.medianFailureYear ?? '—'}</td>
        {/each}
      </tr>
    </tbody>
  </table>

  <dl class="meta">
    <div>
      <dt>First-year withdrawal</dt>
      <dd>{formatCurrency(params.withdrawalRate * params.initialWealth)}</dd>
    </div>
    <div>
      <dt>Seed</dt>
      <dd>{params.seed}</dd>
    </div>
    <div>
      <dt>Time</dt>
      <dd>{elapsedMs.toFixed(0)} ms</dd>
    </div>
  </dl>
</section>

<style>
  .headlines {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }
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
  .model {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .rate {
    font-size: clamp(2.25rem, 6vw, 3rem);
    font-weight: 700;
    line-height: 1;
    color: var(--band);
    font-variant-numeric: tabular-nums;
  }
  .caption {
    margin-top: 6px;
    color: var(--muted);
  }
  .difference {
    margin: 12px 0 16px;
    font-size: 0.875rem;
    color: var(--muted);
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
  .group th {
    padding-top: 18px;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 700;
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
