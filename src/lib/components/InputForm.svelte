<script lang="ts">
  import type { FieldErrors, FormValues } from '../inputs';

  interface Props {
    values: FormValues;
    errors: FieldErrors;
    running: boolean;
    onrun: () => void;
    oncancel: () => void;
    onreset: () => void;
  }

  let { values = $bindable(), errors, running, onrun, oncancel, onreset }: Props = $props();

  type Field = {
    key: keyof FormValues;
    label: string;
    prefix?: string;
    suffix?: string;
    step: string;
    hint?: string;
    placeholder?: string;
  };

  const fields: Field[] = [
    { key: 'initialWealth', label: 'Initial wealth', prefix: '$', step: '1000' },
    { key: 'meanReturnPct', label: 'Mean annual return', suffix: '%', step: '0.1', hint: 'Arithmetic mean, nominal' },
    { key: 'volatilityPct', label: 'Volatility (std. dev.)', suffix: '%', step: '0.1' },
    { key: 'inflationPct', label: 'Inflation rate', suffix: '%', step: '0.1' },
    { key: 'withdrawalRatePct', label: 'Withdrawal rate', suffix: '%', step: '0.1', hint: 'Of initial wealth, then raised with inflation' },
    { key: 'years', label: 'Retirement years', step: '1' },
    { key: 'runs', label: 'Simulation runs', step: '1000' },
    { key: 'seed', label: 'Random seed', step: '1', hint: 'Optional; set for reproducible results', placeholder: 'random' },
  ];

  const hasErrors = $derived(Object.keys(errors).length > 0);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!hasErrors && !running) onrun();
  }
</script>

<form onsubmit={submit} novalidate>
  {#each fields as f (f.key)}
    <label class="field" class:invalid={errors[f.key]}>
      <span class="label">{f.label}</span>
      <span class="input-wrap">
        {#if f.prefix}<span class="affix">{f.prefix}</span>{/if}
        <input
          type="number"
          inputmode="decimal"
          step={f.step}
          placeholder={f.placeholder}
          disabled={running}
          bind:value={values[f.key]}
          aria-invalid={!!errors[f.key]}
        />
        {#if f.suffix}<span class="affix">{f.suffix}</span>{/if}
      </span>
      {#if errors[f.key]}
        <span class="msg error">{errors[f.key]}</span>
      {:else if f.hint}
        <span class="msg">{f.hint}</span>
      {/if}
    </label>
  {/each}

  <div class="actions">
    {#if running}
      <button type="button" class="secondary" onclick={oncancel}>Cancel</button>
    {:else}
      <button type="submit" disabled={hasErrors}>Run simulation</button>
      <button type="button" class="link" onclick={onreset}>Reset defaults</button>
    {/if}
  </div>
</form>

<style>
  form {
    display: grid;
    gap: 14px;
  }
  .field {
    display: grid;
    gap: 4px;
  }
  .label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  .input-wrap {
    display: flex;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--input-bg);
    padding: 0 10px;
  }
  .input-wrap:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-ring);
  }
  .invalid .input-wrap {
    border-color: var(--bad);
  }
  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-variant-numeric: tabular-nums;
    padding: 8px 4px;
    outline: none;
  }
  .affix {
    color: var(--muted);
  }
  .msg {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .msg.error {
    color: var(--bad);
  }
  .actions {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: 4px;
  }
  button {
    font: inherit;
    font-weight: 600;
    border-radius: 8px;
    padding: 10px 18px;
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button.secondary {
    background: transparent;
    color: var(--text);
    border-color: var(--border);
  }
  button.link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--muted);
    font-weight: 400;
    text-decoration: underline;
  }
</style>
