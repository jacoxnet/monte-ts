# Monte Carlo Retirement Simulator

A single-page app (Vite + Svelte 5 + TypeScript) that estimates how likely a retirement portfolio is to last.

Each run draws normally distributed annual returns and makes a withdrawal at the start of each year.
Three withdrawal strategies are available:

- **Standard**: 4% of initial wealth in year one, raised with inflation every year.
- **Guardrails** (Guyton-Klinger): starts at 5.5%. Each year the withdrawal is raised with inflation,
  except after a losing year when the current rate is above 5.5%. If the current rate
  (withdrawal ÷ portfolio) is more than 20% above 5.5%, the withdrawal is cut 10% (not in the final
  15 years); if it is more than 20% below, it is raised 10%. Results also show the final-year and
  lowest-year withdrawals, the final withdrawal rate, and how often cuts, raises and skipped
  inflation raises happened.
- **Custom**: your own first-year rate, raised with inflation every year.

The headline output is the success
rate: the share of runs that fund every withdrawal. The app also reports the mean, median, 25th and 10th
percentiles, minimum and maximum of ending wealth, in nominal and today's dollars. The simulation runs
in a Web Worker so large runs don't freeze the page.

```sh
npm install
npm run dev      # start dev server
npm test         # unit tests (Vitest)
npm run check    # type-check (svelte-check)
npm run build    # static build in dist/
```

The simulation core lives in `src/lib/sim/` and has no UI dependencies.
