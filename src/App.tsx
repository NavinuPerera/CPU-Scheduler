import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { simulate, algorithms, algorithmLabels, type Algorithm, type Config, type ProcessInput, type Result } from './scheduler'

const palette = ['#c8ff4a', '#58d6ff', '#ff6bbb', '#ffb454', '#b99cff', '#ff7558']
const initialProcesses: ProcessInput[] = [
  { id: 'P1', color: palette[0], arrival: 0, bursts: '4 / 3 / 4', priority: 2 },
  { id: 'P2', color: palette[1], arrival: 1, bursts: '3 / 2 / 2', priority: 1 },
  { id: 'P3', color: palette[2], arrival: 2, bursts: '6', priority: 3 },
  { id: 'P4', color: palette[3], arrival: 4, bursts: '3', priority: 2 },
]
const defaultConfig: Config = { quantum: 2, switchCost: 1, levels: [2, 4, 8], boost: 0 }
function loadWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem('corequeue-workspace') || 'null')
    if (saved && algorithms.includes(saved.algorithm)) {
      simulate(saved.processes, saved.algorithm, saved.config)
      return saved as { processes: ProcessInput[]; algorithm: Algorithm; config: Config }
    }
  } catch { /* A stale or unavailable browser store should not prevent startup. */ }
  return { processes: initialProcesses, algorithm: 'RR' as Algorithm, config: defaultConfig }
}
const starting = loadWorkspace()
const fmt = (n: number) => n.toFixed(2)
const paint = (color: string): CSSProperties => ({ '--process-color': color } as CSSProperties)

function PixelIcon({ name }: { name: 'grid' | 'queue' | 'chart' | 'gear' | 'help' }) {
  const paths = {
    grid: <><rect x="2" y="2" width="7" height="7" /><rect x="15" y="2" width="7" height="7" /><rect x="2" y="15" width="7" height="7" /><rect x="15" y="15" width="7" height="7" /></>,
    queue: <><path d="M3 5h18v4H3zM3 15h13v4H3z" /><path d="M19 14h3v6h-3z" /></>,
    chart: <><path d="M3 3h3v18H3zM3 18h18v3H3z" /><path d="m8 15 4-5 3 3 5-7v6l-5 5-3-3-4 4z" /></>,
    gear: <><path d="M10 2h4l1 3 3-1 2 3-2 2 3 2v4l-3 1 1 3-3 2-2-2-2 3H8l-1-3-3 1-2-3 2-2-3-2V9l3-1-1-3 3-2 2 2z" /><rect className="cutout" x="9" y="9" width="6" height="6" /></>,
    help: <><path d="M9 8H6V5l3-3h7l3 3v5l-5 4v2h-4v-4l5-4V6h-5z" /><rect x="10" y="19" width="4" height="4" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>
}

export default function App() {
  const [algorithm, setAlgorithm] = useState<Algorithm>(starting.algorithm)
  const [quantum, setQuantum] = useState(starting.config.quantum)
  const [switchCost, setSwitchCost] = useState(starting.config.switchCost)
  const [levels, setLevels] = useState(starting.config.levels.join(', '))
  const [boost, setBoost] = useState(starting.config.boost)
  const [processes, setProcesses] = useState<ProcessInput[]>(starting.processes)
  const [running, setRunning] = useState(false)
  const [time, setTime] = useState(0)
  const [selected, setSelected] = useState(starting.processes[0].id)
  const [view, setView] = useState<'horizontal' | 'vertical'>('horizontal')
  const [speed, setSpeed] = useState(500)
  const [nav, setNav] = useState('scheduler')
  const [storageNotice, setStorageNotice] = useState('')
  const config = useMemo<Config>(() => ({ quantum, switchCost, levels: levels.split(',').map(Number), boost }), [quantum, switchCost, levels, boost])
  const computed = useMemo(() => {
    try { return { result: simulate(processes, algorithm, config), error: '' } }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : 'Invalid workload.' } }
  }, [processes, algorithm, config])
  const result = computed.result
  const comparisons = useMemo(() => result ? algorithms.map(a => { try { return { algorithm: a, result: simulate(processes, a, config), error: '' } } catch (error) { return { algorithm: a, result: null, error: error instanceof Error ? error.message : 'Schedule unavailable' } } }) : [], [processes, config, result])
  // Any workload/algorithm change invalidates playback and starts a fresh trace.
  useEffect(() => { setTime(0); setRunning(false) }, [result])
  useEffect(() => {
    if (!running || !result) return
    const timer = window.setInterval(() => setTime(current => {
      return Math.min(current + 1, result.makespan)
    }), speed)
    return () => window.clearInterval(timer)
  }, [running, result, speed])
  useEffect(() => { if (result && time >= result.makespan) setRunning(false) }, [time, result])
  useEffect(() => {
    if (!result) return
    try { localStorage.setItem('corequeue-workspace', JSON.stringify({ algorithm, processes, config })); setStorageNotice('') }
    catch { setStorageNotice('Browser storage is unavailable. This workspace will last until the page is closed.') }
  }, [algorithm, processes, config, result])

  const t = Math.min(time, result?.makespan ?? 0)
  const tick = result?.ticks[t]
  const snapshots = tick?.processes ?? result?.final ?? []
  const ready = (tick?.ready ?? []).map(id => snapshots.find(p => p.id === id)!)
  const waiting = snapshots.filter(p => p.state === 'WAITING')
  const selectedInput = processes.find(p => p.id === selected) ?? processes[0]
  const selectedSnapshot = snapshots.find(p => p.id === selectedInput.id)
  const status = !result ? 'CHECK INPUT' : t === result.makespan ? 'COMPLETE' : running ? 'RUNNING' : 'PAUSED'
  const segments = useMemo(() => {
    const grouped: { id: string; start: number; end: number; kind: 'process' | 'switch' | 'idle' }[] = []
    for (const row of result?.ticks ?? []) {
      const id = row.pid ?? (row.kind === 'switch' ? 'CS' : 'IDLE'), last = grouped[grouped.length - 1]
      if (last && last.id === id && last.kind === row.kind) last.end++
      else grouped.push({ id, start: row.time, end: row.time + 1, kind: row.kind })
    }
    return grouped
  }, [result])
  const axisStep = Math.max(1, Math.ceil((result?.makespan ?? 1) / 12))
  const axisTicks = result ? [...new Set([...Array.from({ length: Math.floor(result.makespan / axisStep) + 1 }, (_, i) => i * axisStep), result.makespan])] : []
  const inspect = (next: number) => { setRunning(false); setTime(next) }
  const updateProcess = (id: string, field: 'arrival' | 'bursts' | 'priority', value: number | string) =>
    setProcesses(current => current.map(p => p.id === id ? { ...p, [field]: value } : p))
  const addProcess = () => {
    const number = Math.max(...processes.map(p => Number(p.id.slice(1)))) + 1
    setProcesses(current => [...current, { id: `P${number}`, color: palette[(number - 1) % palette.length], arrival: 0, bursts: '5', priority: 2 }])
    setSelected(`P${number}`)
  }
  const removeProcess = (id: string) => {
    const next = processes.filter(p => p.id !== id)
    if (next.length) { setProcesses(next); if (selected === id) setSelected(next[0].id) }
  }
  const navigate = (id: string) => { setNav(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const usePreset = (name: string) => {
    const items = name === 'assignment' ? [[0, '12', 2], [2, '2', 1], [4, '1', 3], [6, '3', 2]] : name === 'overlap' ? [[0, '3 / 8 / 3', 2], [0, '5', 1]] : name === 'boundary' ? [[0, '5', 2], [2, '2', 1]] : null
    setProcesses(items ? items.map((p, i) => ({ id: `P${i + 1}`, color: palette[i], arrival: p[0] as number, bursts: p[1] as string, priority: p[2] as number })) : initialProcesses)
    setSelected('P1')
  }
  const exportMetrics = () => {
    if (!result) return
    const text = 'pid,completion,turnaround,waiting,response\n' + result.metrics.map(p => [p.id, p.completion, p.turnaround, p.waiting, p.response].join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' })), a = document.createElement('a')
    a.href = url; a.download = `corequeue-${algorithm.toLowerCase()}-metrics.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const compareRow = (r: Result) => <tr key={r.algorithm} className={r.algorithm === algorithm ? 'active-row' : ''}>
    <td><button className="text-action" onClick={() => setAlgorithm(r.algorithm)}>{algorithmLabels[r.algorithm]}</button></td>
    <td>{r.makespan}</td><td>{fmt(r.averageWaiting)}</td><td>{fmt(r.averageResponse)}</td><td>{fmt(r.averageTurnaround)}</td><td>{r.switches}</td><td>{fmt(r.utilization)}%</td>
  </tr>
  return <div className="app-shell">
    <a className="skip-link" href="#scheduler">Skip to scheduler</a>
    <aside className="sidebar">
      <div className="brand-mark" aria-label="CoreQueue"><span className="brand-c">C</span><span className="brand-q">Q</span></div>
      <nav className="side-nav" aria-label="Primary navigation">
        {([['scheduler', 'grid', 'SCHEDULER'], ['queue', 'queue', 'QUEUE'], ['analytics', 'chart', 'ANALYTICS'], ['settings', 'gear', 'SETTINGS']] as const).map(([id, icon, label]) =>
          <button key={id} className={`nav-item ${nav === id ? 'active' : ''}`} onClick={() => navigate(id)} aria-label={label}><PixelIcon name={icon} /><span>{label}</span></button>)}
      </nav>
      <div className="side-bottom"><button className={`nav-item ${nav === 'rules' ? 'active' : ''}`} onClick={() => navigate('rules')} aria-label="Rules and formulas"><PixelIcon name="help" /><span>RULES</span></button></div>
    </aside>
    <main>
      <header className="topbar"><div><div className="eyebrow">CPU SCHEDULER / SYSC 4001</div><h1>PROCESS <span>CONTROL</span></h1></div>
        <div className="core-chip"><i className={running ? '' : 'paused'} /> CORE 01 <b>{status}</b></div>
      </header>
      <section className="control-strip" id="settings" aria-label="Simulation settings">
        <div className="control-block algorithm-control"><label htmlFor="algorithm">01 // ALGORITHM</label><div className="select-wrap"><select id="algorithm" value={algorithm} onChange={e => setAlgorithm(e.target.value as Algorithm)}>{algorithms.map(a => <option key={a} value={a}>{algorithmLabels[a]}</option>)}</select></div></div>
        <div className="control-block quantum-control"><label>02 // RR QUANTUM</label><div className="stepper"><button disabled={algorithm !== 'RR'} onClick={() => setQuantum(Math.max(1, quantum - 1))} aria-label="Decrease quantum">−</button><strong>{quantum}</strong><button disabled={algorithm !== 'RR'} onClick={() => setQuantum(quantum + 1)} aria-label="Increase quantum">+</button><span>units</span></div></div>
        <div className="control-block switch-control"><label>03 // SWITCH COST</label><div className="stepper"><button onClick={() => setSwitchCost(Math.max(0, switchCost - 1))} aria-label="Decrease switch cost">−</button><strong>{switchCost}</strong><button onClick={() => setSwitchCost(switchCost + 1)} aria-label="Increase switch cost">+</button><span>units</span></div></div>
        <div className="run-controls"><button className="reset-button" onClick={() => inspect(0)}>↺ RESET PLAYBACK</button><button className="run-button" disabled={!result} onClick={() => { if (result && t === result.makespan) setTime(0); setRunning(!running) }}><span className={running ? 'pause-icon' : 'play-icon'} />{running ? 'PAUSE' : 'RUN'} SIMULATION</button></div>
      </section>
      <div className="extra-controls"><label htmlFor="preset">EXAMPLE WORKLOAD</label><div className="select-wrap"><select id="preset" defaultValue="" onChange={e => { usePreset(e.target.value); e.target.value = '' }}><option value="" disabled>Load an example…</option><option value="classic">CPU / I/O mix</option><option value="assignment">Assignment 1 tradeoffs</option><option value="overlap">CPU / I/O overlap</option><option value="boundary">RR arrival boundary</option></select></div><label htmlFor="speed">PLAYBACK</label><div className="select-wrap"><select id="speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={1000}>Slow · 1 tick/s</option><option value={500}>Normal · 2 ticks/s</option><option value={150}>Fast</option></select></div><button className="text-action" onClick={() => navigate('rules')}>Rules & formulas</button>
        {algorithm === 'MLFQ' && <div className="mlfq-controls"><label>Q0 / Q1 / Q2 budgets<input aria-label="MLFQ budgets" value={levels} onChange={e => setLevels(e.target.value)} /></label><label>Boost interval · 0 = off<input aria-label="MLFQ boost interval" type="number" min="0" value={boost} onChange={e => setBoost(e.target.value === '' ? NaN : Number(e.target.value))} /></label></div>}
      </div>
      {computed.error && <p className="input-error" role="alert">{computed.error}</p>}{storageNotice && <p className="input-error">{storageNotice}</p>}
      <div className="workspace" id="scheduler">
        <section className="panel timeline-panel">
          <div className="panel-heading"><div><span className="section-index">01</span><h2>EXECUTION TRACE</h2></div><div className="heading-tools"><div className="view-toggle" aria-label="Trace orientation"><button aria-pressed={view === 'horizontal'} className={view === 'horizontal' ? 'active' : ''} onClick={() => setView('horizontal')}>HORIZONTAL</button><button aria-pressed={view === 'vertical'} className={view === 'vertical' ? 'active' : ''} onClick={() => setView('vertical')}>VERTICAL</button></div><div className="live-status"><i className={running ? '' : 'paused'} />{status}<span>T+{t} UNITS</span></div></div></div>
          {!result ? <p className="empty-state">Fix the highlighted input to generate the trace.</p> : view === 'horizontal' ? <div className="timeline-area"><div className="cpu-label"><span>CPU</span><b>CORE_01</b></div><div className="gantt-scroll"><div className="gantt" style={{ minWidth: Math.min(12000, Math.max(600, result.makespan * 32)) }}>
            <div className="tick-labels">{axisTicks.map(value => <span key={value} style={{ left: `${100 * value / result.makespan}%`, transform: value === 0 ? 'none' : 'translateX(-100%)' }}>{value}</span>)}</div>
            <div className="gantt-track">{segments.length > 600 ? <p className="empty-state">Long trace: switch to Vertical to inspect individual ticks.</p> : segments.map(item => <button key={item.start} title={`${item.id}: [${item.start}, ${item.end})`} className={`process-block ${item.kind} ${selected === item.id ? 'selected' : ''}`} style={{ ...paint(processes.find(p => p.id === item.id)?.color ?? '#a3a7ad'), flex: item.end - item.start }} onClick={() => { inspect(item.start); if (item.kind === 'process') setSelected(item.id) }}><b>{item.id}</b>{item.end - item.start > 1 && <span>{item.end - item.start} units</span>}</button>)}<div className="playhead" style={{ left: `${100 * t / result.makespan}%` }}><span /></div></div>
          </div></div></div> : <div className="vertical-trace"><div className="vertical-trace-head"><span>TIME</span><span>CPU STATE</span><span>READY / BOUNDARY EVENTS</span></div>{result.ticks.slice(Math.max(0, t - 35), Math.max(150, t + 115)).map(row => <button key={row.time} className={`${row.kind} ${row.time === t ? 'current' : ''}`} onClick={() => { inspect(row.time); if (row.pid) setSelected(row.pid) }}><span>{row.time}</span><b style={paint(processes.find(p => p.id === row.pid)?.color ?? '#a3a7ad')}>{row.pid ?? (row.kind === 'switch' ? 'CS' : 'IDLE')}</b><small>Ready: {row.ready.join(', ') || 'empty'}{row.events.length ? ` · ${row.events.join(' ')}` : ''}</small></button>)}</div>}
          <div className="trace-legend"><span><i className="legend-process" />PROCESS</span><span><i className="legend-switch" />CONTEXT SWITCH</span><span><i className="legend-idle" />IDLE</span></div>
          <label className="scrubber">INSPECT TIME <input aria-label="Inspect simulation time" type="range" min="0" max={result?.makespan ?? 0} value={t} disabled={!result} onChange={e => inspect(Number(e.target.value))} /><output>{t} / {result?.makespan ?? 0}</output></label>
          <div className="queue-strip" id="queue"><div><small>READY QUEUE</small><b>{String(ready.length).padStart(2, '0')}</b></div><div className="queue-items">{ready.map((p, i) => <button key={p.id} onClick={() => setSelected(p.id)} style={paint(processes.find(item => item.id === p.id)!.color)}><span>{i + 1}</span><b>{p.id}{algorithm === 'MLFQ' ? ` Q${p.level}` : ''}</b><small>{p.currentBurst} burst units left</small></button>)}{!ready.length && <span className="queue-empty">No Ready processes at t = {t}</span>}</div><button className="step-button" disabled={!result || t === result.makespan} onClick={() => inspect(t + 1)}>STEP 1 UNIT</button></div>
          <div className="decision-detail"><b>{t === result?.makespan ? 'All processes complete.' : tick?.kind === 'process' ? `${tick.pid} owns the CPU during [${t}, ${t + 1}).` : tick?.kind === 'switch' ? `Context switching during [${t}, ${t + 1}); select when the cost is paid.` : tick ? 'CPU idle: no process is Ready.' : 'Waiting for valid input.'}</b><p>{tick?.events.join(' ') || 'No boundary event.'}</p><p>I/O waiting: {waiting.map(p => `${p.id} returns at ${p.wake}`).join(' · ') || 'none'}</p></div>
        </section>
        <aside className="metrics" aria-label="Full schedule metrics"><div className="metric-card primary"><small>AVG. WAIT TIME · FULL RUN</small><strong>{result ? fmt(result.averageWaiting) : '—'}<span>units</span></strong><p>READY TIME INCLUDES DISPATCH</p></div><div className="metric-card"><small>CPU UTILIZATION · FULL RUN</small><strong>{result ? fmt(result.utilization) : '—'}<span>%</span></strong><div className="util-bar"><i style={{ width: `${result?.utilization ?? 0}%` }} /></div><p><b>{result?.busy ?? '—'}</b> / {result?.makespan ?? '—'} UNITS ACTIVE</p></div><div className="metric-card"><small>THROUGHPUT · FULL RUN</small><strong>{result ? result.throughput.toFixed(3) : '—'}<span>P/unit</span></strong><p>{result?.metrics.length ?? '—'} PROCESSES / {result?.makespan ?? '—'} UNITS</p></div></aside>
        <section className="panel process-panel"><div className="panel-heading"><div><span className="section-index">02</span><h2>WORKLOAD / CPU–I/O BURSTS</h2></div><button className="add-button" onClick={addProcess} disabled={processes.length >= 30}>+ ADD PROCESS</button></div><p className="panel-note">Alternate CPU / I/O / CPU. Editing any input resets playback. Remaining = all CPU service still needed; snapshots are at the start of tick {t}.</p><div className="table-wrap"><table><thead><tr><th>PID</th><th>ARRIVAL</th><th>CPU / I/O / CPU</th><th>REMAINING</th><th>PRIORITY ↓</th><th>STATE</th><th>REMOVE</th></tr></thead><tbody>{processes.map(process => {
          const snapshot = snapshots.find(p => p.id === process.id), state = snapshot?.state ?? 'NEW'
          return <tr key={process.id} className={selectedInput.id === process.id ? 'active-row' : ''} onClick={() => setSelected(process.id)}><td><i style={{ background: process.color }} /><b>{process.id}</b></td><td><input aria-label={`${process.id} arrival`} type="number" min="0" value={Number.isNaN(process.arrival) ? '' : process.arrival} onClick={e => e.stopPropagation()} onChange={e => updateProcess(process.id, 'arrival', e.target.value === '' ? NaN : Number(e.target.value))} /></td><td><input className="burst-input" aria-label={`${process.id} CPU and IO bursts`} value={process.bursts} onClick={e => e.stopPropagation()} onChange={e => updateProcess(process.id, 'bursts', e.target.value)} /></td><td>{snapshot?.remaining ?? '—'} units</td><td><input aria-label={`${process.id} priority`} type="number" value={Number.isNaN(process.priority) ? '' : process.priority} onClick={e => e.stopPropagation()} onChange={e => updateProcess(process.id, 'priority', e.target.value === '' ? NaN : Number(e.target.value))} /></td><td><span className={`state ${state.toLowerCase()}`}>{state}</span></td><td><button className="remove-button" aria-label={`Remove ${process.id}`} disabled={processes.length === 1} onClick={e => { e.stopPropagation(); removeProcess(process.id) }}>×</button></td></tr>
        })}</tbody></table></div><div className="process-detail"><span style={{ background: selectedInput.color }} />SELECTED: <b>{selectedInput.id}</b><i />BURSTS <b>{selectedInput.bursts}</b><i />CURRENT BURST <b>{selectedSnapshot?.currentBurst ?? '—'} units</b></div></section>
        <section className="panel process-panel" id="analytics"><div className="panel-heading"><div><span className="section-index">03</span><h2>ALGORITHM COMPARISON</h2></div><button className="reset-button" onClick={exportMetrics} disabled={!result}>EXPORT METRICS CSV</button></div><p className="panel-note">Complete-run results for the same workload and settings. Select a policy to inspect its trace.</p><div className="table-wrap"><table><thead><tr><th>POLICY</th><th>MAKESPAN</th><th>AVG. WAIT</th><th>AVG. RESPONSE</th><th>AVG. TURNAROUND</th><th>SWITCH TIME</th><th>UTILIZATION</th></tr></thead><tbody>{comparisons.map(item => item.result ? compareRow(item.result) : <tr key={item.algorithm}><td>{algorithmLabels[item.algorithm]}</td><td colSpan={6}>{item.error}</td></tr>)}</tbody></table></div><div className="panel-heading"><h2>PROCESS ACCOUNTING · {algorithmLabels[algorithm]}</h2></div><div className="table-wrap"><table><thead><tr><th>PID</th><th>COMPLETION</th><th>TURNAROUND</th><th>WAITING</th><th>RESPONSE</th></tr></thead><tbody>{result?.metrics.map(p => <tr key={p.id}><td>{p.id}</td><td>{p.completion}</td><td>{p.turnaround}</td><td>{p.waiting}</td><td>{p.response}</td></tr>)}</tbody></table></div></section>
        <section className="panel process-panel" id="rules"><div className="panel-heading"><div><span className="section-index">04</span><h2>RULES & FORMULAS</h2></div></div><div className="rules-content"><article><h3>Timing contract</h3><p>Each row t is [t, t + 1). Resolve CPU completion or quantum expiry first, admit arrivals by PID, complete I/O by PID, then consider preemption and dispatch. Burst completion wins over simultaneous quantum expiry.</p><p>Every dispatch pays the switch cost, including the first and same-PID redispatch. Selection occurs after the switch ends. I/O devices are unlimited and operate concurrently.</p></article><article><h3>Selection</h3><p>FCFS and RR use Ready-entry order. SJF chooses the shortest next CPU burst and never preempts. SRTF preempts only for a strictly shorter remaining current burst. Preemptive priority uses lower numbers first; equality does not preempt. Selection ties retain Ready-entry order, then PID for simultaneous events.</p></article><article><h3>MLFQ practice model</h3><p>New processes enter Q0. Higher queues preempt lower ones; FIFO within a queue. Exhausting a budget demotes a process; Q2 rotates. Higher-queue preemption preserves unused budget. I/O resets the budget at the same level. Optional boosts reset admitted processes to Q0, retaining Ready order. These are explicit practice assumptions.</p></article><article><h3>Accounting</h3><p>Turnaround = completion − arrival. Response = first CPU execution − arrival. Waiting counts Ready intervals, including switching. Turnaround = CPU service + I/O service + waiting.</p><p>Utilization = CPU busy / makespan × 100%. Throughput = completed processes / makespan. Makespan starts at time 0. Metric cards describe the complete schedule; the playhead and process table describe the inspected tick.</p></article></div></section>
      </div><footer><span>COREQUEUE / CPU SCHEDULER</span><span>{status} AT T+{t}</span><span>ABSTRACT TIME UNITS</span></footer>
    </main>
  </div>
}
