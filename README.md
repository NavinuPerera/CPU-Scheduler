# CoreQueue - CPU Scheduling Simulator

A local React + TypeScript project using the supplied pixelated Figma design.
The uploaded Figma prototype used sample traces and metrics. This version
connects the interface to a standalone scheduling engine and removes Guided
Practice. There is no account, API key, database, or backend requirement.

## Start on Windows

Install Node.js 24 or later. Extract this ZIP, open the `corequeue-scheduler`
folder in VS Code, and open Terminal > New Terminal there.

```powershell
npm ci
npm run dev
```

Open the Local URL printed by Vite (normally http://localhost:5173).
Keep the terminal running. Stop it with Ctrl+C.

Save source edits and Vite updates the browser automatically.

## Files to edit

- `src/index.css`: original Figma styling plus responsive/accessibility additions.
- `src/App.tsx`: layout, controls, navigation, playback, metric display, presets.
- `src/scheduler.ts`: pure scheduling engine and typed tick/process snapshots.
- `src/main.tsx`: React entry point.
- `tests/scheduler.test.mjs`: engine regression checks.
- `vite.config.ts`: ordinary React/Tailwind Vite configuration; Figma runtime plugins are not required.

The engine is separate from the UI, so appearance changes can stay in App.tsx
and index.css. `public/favicon.png` comes from the supplied design.

## Available features

- FCFS, Round Robin, nonpreemptive SJF, SRTF, preemptive priority, and MLFQ.
- Editable arrivals, alternating CPU / I/O / CPU bursts, and priority.
- Add/remove up to 30 processes; duplicate IDs are prevented by generation.
- RR quantum, context-switch cost, MLFQ queue budgets and optional boost.
- Play/pause, reset playback, single-tick stepping, and a time scrubber.
- Horizontal timeline and vertical traces with boundary events and Ready state.
- New, Ready, Running, Waiting, and Done process states.
- Algorithm comparisons, per-process metrics, and metrics CSV download.
- Local browser persistence of valid workloads/settings.
- Rules and formulas, without Guided Practice.

Metric cards and comparison tables describe the *complete computed schedule*.
The trace playhead, Ready queue, and process table describe the inspected tick.
Pausing playback does not make a Running process Ready: CPU ownership is
shown at the selected simulation interval independently of animation state.

## Scheduling contract

An interval beginning at t is [t,t+1). At each boundary:

1. Resolve the prior CPU interval: burst completion, otherwise quantum expiry.
2. Admit arrivals in PID order.
3. Complete I/O in PID order.
4. Apply an MLFQ boost if configured, then consider preemption.
5. Complete/begin switching, select when the cost is paid, then execute one tick.

Burst completion wins over quantum expiry. Every dispatch pays context cost,
including initial dispatch and same-process RR redispatch. Arrivals/I/O during
switching are considered before final selection. I/O devices operate concurrently.

FCFS/RR preserve Ready-entry order. SJF uses shortest current burst without
preemption; SRTF only preempts for a strictly shorter remaining current burst.
Priority uses lower numbers first; equality does not preempt. Ties preserve
Ready-entry order; simultaneous arrivals and I/O events are ordered by PID.

**Compatibility note:** the old Scheduler Lab website admitted arrivals before
RR expiry re-enqueueing. This version follows the Assignment 1 handout instead:
expiry re-enqueueing precedes arrivals and I/O completions. Its four report
scenarios match the recorded assignment results.

MLFQ is a documented practice model: new jobs enter Q0; higher queues preempt
lower queues; FIFO within a queue; exhausting budget demotes (Q2 rotates);
preemption preserves budget; I/O resets budget at the same level. Optional
boosts move admitted processes to Q0 and reset budgets, preserving Ready order.
These MLFQ assumptions should be compared with course-specific exam rules.

All durations are abstract integer units. The limit is 10,000 ticks per policy.
For long schedules, vertical rendering shows a window around the inspected tick;
horizontal schedules over 600 segments ask for Vertical view.

## Verification

```bash
npm test
npm run build
```

Tests include Assignment 1's four scheduling runs and both I/O experiments,
RR boundary ordering, burst-vs-quantum priority, switch reselection, SRTF ties,
SJF/priority/MLFQ behavior, simultaneous I/O/arrival order, invalid inputs, and
360 workload/policy accounting and state-consistency runs.

Browser checks covered desktop layout, algorithm/preset selection, vertical
traces, stepping, add/remove, validation, MLFQ settings, completed state, and
run/pause. The mobile layout uses responsive CSS; it was not separately
verified on a mobile browser.

## Build / publish later

`npm run build` writes a static site to `dist/`. Use `npm run preview` to inspect
that production build. No published website was modified by this source export.
The CSS font import uses Google Fonts when reachable and falls back to monospace.

## Start Git history

```bash
git init
git add .
git commit -m "Add CoreQueue scheduler with Figma interface"
```

Create an empty GitHub repository, add its remote, and push when ready.
The ZIP excludes node_modules, build output, credentials, and Figma-only metadata.
