# Monte Carlo Retirement Simulator

A single-page app (Vite + Svelte 5 + TypeScript) that estimates how likely a retirement portfolio is to last.

Each run draws normally distributed annual returns and withdraws an inflation-adjusted amount at the
start of each year (first-year withdrawal = rate × initial wealth). The headline output is the success
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
