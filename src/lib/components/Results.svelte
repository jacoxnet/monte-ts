<script lang="ts">
  import type { Comparison, Strategy, Summary } from '../sim/types';
  import { formatCurrency, formatPercent } from '../format';

  let { comparison }: { comparison: Comparison } = $props();

  const labels: Record<Strategy, string> = {
    standard: 'Standard',
    guardrails: 'Guardrails',
  };
  const rules: Record<Strategy, string> = {
    standard: 'Raised with inflation every year',
    guardrails: 'Adjusted each year by the Guyton-Klinger rules',
  };

  const columns = $derived([comparison.standard, comparison.guardrails]);
  const params = $derived(comparison.params);
  const standard = $derived(comparison.standard);
  const guardrails = $derived(comparison.guardrails);
  const gk = $derived(comparison.guardrails.guardrails!);

  /** Targets are shown as entered, e.g. 90% or 99.5%. */
  const formatTarget = (fraction: number) => `${+(fraction * 100).toFixed(2)}%`;

  const gap = $derived(guardrails.initialWithdrawal - standard.initialWithdrawal);
  const gapText = $derived.by(() => {
    if (Math.round(gap) === 0) return 'the same as';
    const amount = formatCurrency(Math.abs(gap));
    const pct = standard.initialWithdrawal > 0 ? ` (${formatPercent(Math.abs(gap) / standard.initialWithdrawal, 0)})` : '';
    return `${amount}${pct} ${gap > 0 ? 'higher than' : 'lower than'}`;
  });

  const rows: { key: keyof Summary; label: string }[] = [
    { key: 'mean', label: 'Mean' },
    { key: 'median', label: 'Median' },
    { key: 'p25', label: '25th percentile' },
    { key: 'p10', label: '10th percentile' },
    { key: 'min', label: 'Minimum' },
    { key: 'max', label: 'Maximum' },
  ];

  const sections: { key: 'averageWithdrawal' | 'real' | 'nominal'; label: string }[] = [
    { key: 'averageWithdrawal', label: "Average annual withdrawal, today's dollars" },
    { key: 'real', label: "Ending wealth, today's dollars" },
    { key: 'nominal', label: 'Ending wealth, nominal' },
  ];

  const vsFirst = (v: number) => {
    if (!(guardrails.initialWithdrawal > 0)) return '';
    const pct = Math.round((v / guardrails.initialWithdrawal - 1) * 100);
    return `${pct < 0 ? '−' : '+'}${Math.abs(pct)}%`;
  };
</script>

<section class="results">
  <div class="headlines">
    {#each columns as r (r.strategy)}
      <div class="headline">
        <div class="strategy">{labels[r.strategy]}</div>
        <div class="amount">{formatCurrency(r.initialWithdrawal)}</div>
        <div class="caption">
          maximum first-year withdrawal, {formatPercent(r.initialRate, 2)} of initial wealth, for
          {formatTarget(r.targetSuccess)} success
        </div>
        <div class="caption">{rules[r.strategy]}</div>
      </div>
    {/each}
  </div>
  <p class="difference">
    The guardrails first-year withdrawal is {gapText} the standard one.
  </p>

  <table>
    <thead>
      <tr>
        <th scope="col"></th>
        <th scope="col">Standard</th>
        <th scope="col">Guardrails</th>
      </tr>
    </thead>
    <tbody>
      <tr class="group"><th scope="colgroup" colspan="3">Maximum first-year withdrawal</th></tr>
      <tr>
        <th scope="row">Amount</th>
        {#each columns as r (r.strategy)}
          <td>{formatCurrency(r.initialWithdrawal)}</td>
        {/each}
      </tr>
      <tr>
        <th scope="row">Share of initial wealth</th>
        {#each columns as r (r.strategy)}
          <td>{formatPercent(r.initialRate, 2)}</td>
        {/each}
      </tr>
    </tbody>
    <tbody>
      <tr class="group"><th scope="colgroup" colspan="3">Success over {params.years} years</th></tr>
      <tr>
        <th scope="row">Target success rate</th>
        {#each columns as r (r.strategy)}
          <td>{formatTarget(r.targetSuccess)}</td>
        {/each}
      </tr>
      <tr>
        <th scope="row">Simulated success rate</th>
        {#each columns as r (r.strategy)}
          <td>{formatPercent(r.successRate, 2)}</td>
        {/each}
      </tr>
      <tr>
        <th scope="row">Failed runs</th>
        {#each columns as r (r.strategy)}
          <td>{(params.runs - r.successes).toLocaleString()}</td>
        {/each}
      </tr>
      <tr>
        <th scope="row">Median depletion year</th>
        {#each columns as r (r.strategy)}
          <td>{r.medianFailureYear ?? '—'}</td>
        {/each}
      </tr>
    </tbody>
    {#each sections as section (section.key)}
      <tbody>
        <tr class="group"><th scope="colgroup" colspan="3">{section.label}</th></tr>
        {#each rows as row (row.key)}
          <tr>
            <th scope="row">{row.label}</th>
            {#each columns as r (r.strategy)}
              <td>{formatCurrency(r[section.key][row.key])}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    {/each}
  </table>

  <h2>How the guardrails changed withdrawals</h2>
  <p class="note">
    Today's dollars, with the change from the {formatCurrency(guardrails.initialWithdrawal)}
    first-year withdrawal. Failed runs count as $0. The standard withdrawal stays at
    {formatCurrency(standard.initialWithdrawal)} in today's dollars for as long as the money lasts.
  </p>
  <table>
    <thead>
      <tr>
        <th scope="col"></th>
        <th scope="col">Final year</th>
        <th scope="col">Lowest year</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.key)}
        <tr>
          <th scope="row">{row.label}</th>
          {#each [gk.finalWithdrawal, gk.lowestWithdrawal] as summary}
            <td>
              {formatCurrency(summary[row.key])}
              <span class="delta">{vsFirst(summary[row.key])}</span>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
    <tbody>
      <tr class="group"><th scope="colgroup" colspan="3">Guardrail activity</th></tr>
      <tr>
        <th scope="row" colspan="2">Final-year withdrawal rate (median of successful runs)</th>
        <td>{gk.finalRate ? formatPercent(gk.finalRate.median) : '—'}</td>
      </tr>
      <tr>
        <th scope="row" colspan="2">10% cuts per run</th>
        <td>{gk.avgCuts.toFixed(1)}</td>
      </tr>
      <tr>
        <th scope="row" colspan="2">Runs with a cut</th>
        <td>{formatPercent(gk.runsWithCut, 0)}</td>
      </tr>
      <tr>
        <th scope="row" colspan="2">10% raises per run</th>
        <td>{gk.avgRaises.toFixed(1)}</td>
      </tr>
      <tr>
        <th scope="row" colspan="2">Runs with a raise</th>
        <td>{formatPercent(gk.runsWithRaise, 0)}</td>
      </tr>
      <tr>
        <th scope="row" colspan="2">Skipped inflation raises per run</th>
        <td>{gk.avgSkippedInflation.toFixed(1)}</td>
      </tr>
    </tbody>
  </table>

  <dl class="meta">
    <div>
      <dt>Runs</dt>
      <dd>{params.runs.toLocaleString()}</dd>
    </div>
    <div>
      <dt>Seed</dt>
      <dd>{params.seed}</dd>
    </div>
    <div>
      <dt>Time</dt>
      <dd>{comparison.elapsedMs.toFixed(0)} ms</dd>
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
    border-left: 6px solid var(--accent);
  }
  .strategy {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .amount {
    font-size: clamp(2rem, 5vw, 2.75rem);
    font-weight: 700;
    line-height: 1;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
  .caption {
    margin-top: 6px;
    font-size: 0.875rem;
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
  h2 {
    font-size: 1rem;
    margin: 28px 0 4px;
  }
  .note {
    margin: 0 0 4px;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .delta {
    display: block;
    font-size: 0.75rem;
    color: var(--muted);
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
