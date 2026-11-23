# CoreQueue — CPU Scheduling Simulator

**[Try the live website](https://navinuperera.github.io/CPU-Scheduler/)**

I built CoreQueue inspired by my **SYSC 4001: Operating Systems** class at
Carleton University. Learning about CPU scheduling made me want a way to see
how each algorithm makes decisions, rather than only working through examples
on paper.

This project turns those concepts into an interactive website: enter a workload,
step through its execution, and compare how different scheduling policies affect
waiting time, response time, and CPU utilization.

## Features

- **Six scheduling policies:** FCFS, Round Robin, SJF, SRTF, preemptive priority, and MLFQ.
- Editable process arrivals, priorities, and alternating CPU/I/O bursts.
- Configurable quantum, context-switch cost, MLFQ budgets, and priority boosts.
- Horizontal timelines and vertical traces with Ready queues and boundary events.
- Play, pause, reset, single-tick stepping, and a time scrubber.
- Process states: New, Ready, Running, Waiting, and Done.
- Algorithm comparisons, per-process metrics, and CSV export.
- Browser-local saving of workloads and settings.

The metric cards show results for the **complete schedule**. The playhead,
Ready queue, and process table show the state at the **selected tick**.

## Built with

React · TypeScript · Vite · Tailwind CSS · Figma · GitHub Actions · GitHub Pages

The simulator runs entirely in the browser, with no backend or account required.
I used Figma for the pixelated interface design.

## Run locally

Requires **Node.js 24 or later**.

```bash
git clone https://github.com/NavinuPerera/CPU-Scheduler.git
cd CPU-Scheduler
npm ci
npm run dev
```

Open the local URL printed in the terminal. If port 5173 is already being used:

```bash
npm run dev -- --port 5174
```

## Project structure

| File | Purpose |
| --- | --- |
| `src/App.tsx` | Interface, playback, presets, and metric display |
| `src/index.css` | Pixelated styling and responsive layouts |
| `src/scheduler.ts` | Scheduling engine and process snapshots |
| `src/main.tsx` | React entry point |
| `tests/scheduler.test.mjs` | Scheduling regression tests |
| `.github/workflows/deploy.yml` | Tests, builds, and deploys to GitHub Pages |

The scheduling engine is separate from the interface so visual changes can be
made without changing the scheduling rules.

## Scheduling rules

Time uses abstract integer units. A trace row at time `t` represents `[t, t + 1)`.
Each boundary follows this order:

1. Resolve CPU burst completion or quantum expiry. Completion takes precedence.
2. Admit new arrivals in PID order.
3. Complete I/O operations in PID order.
4. Apply a configured MLFQ boost, then consider preemption.
5. Complete or begin dispatch, then execute one time unit.

Every dispatch pays the context-switch cost, including the first dispatch and
redispatching the same process. A process is selected when the switch finishes.
I/O operations run concurrently without device contention.

FCFS and RR preserve Ready-entry order. SJF is nonpreemptive. SRTF only preempts
for a strictly shorter remaining current CPU burst. Priority scheduling uses
lower numbers first; equal priority does not preempt. Selection ties preserve
Ready-entry order, with simultaneous events processed in PID order.

**MLFQ assumptions:** new processes enter Q0; higher queues preempt lower ones;
FIFO within a queue; exhausting a budget demotes a process, while Q2 rotates.
Preemption preserves unused budget. I/O resets the budget at the same level.
Optional boosts move admitted processes to Q0 and reset budgets, preserving
Ready order. These are explicit practice rules; course examples may use other
MLFQ conventions.

Workloads support up to 30 processes and 10,000 simulated ticks per policy.

## Tests and production build

```bash
npm test
npm run build
```

The tests cover the SYSC 4001 assignment scenarios, RR boundaries, I/O overlap,
context switches, preemption, ties, invalid inputs, and 360 additional
workload/policy runs checking accounting and process-state consistency.

The production build is generated in `dist/`. To view it locally:

```bash
npm run preview
```

## Deployment

GitHub Actions installs dependencies, runs tests, builds the website, and
publishes it to GitHub Pages whenever changes are pushed to `main`.

**Live demo:** https://navinuperera.github.io/CPU-Scheduler/

---

