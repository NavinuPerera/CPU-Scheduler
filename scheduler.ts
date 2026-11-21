export type Algorithm = 'FCFS' | 'RR' | 'SJF' | 'SRTF' | 'Priority' | 'MLFQ'
export const algorithms: Algorithm[] = ['FCFS', 'RR', 'SJF', 'SRTF', 'Priority', 'MLFQ']
export const algorithmLabels: Record<Algorithm, string> = {
  FCFS: 'FCFS', RR: 'ROUND ROBIN', SJF: 'SJF · NON-PREEMPTIVE',
  SRTF: 'SRTF', Priority: 'PREEMPTIVE PRIORITY', MLFQ: 'MLFQ',
}
export type ProcessInput = { id: string; color: string; arrival: number; bursts: string; priority: number }
export type Config = { quantum: number; switchCost: number; levels: number[]; boost: number }
export type State = 'NEW' | 'READY' | 'RUNNING' | 'WAITING' | 'DONE'
export type ProcessSnapshot = { id: string; state: State; remaining: number; currentBurst: number; wake: number | null; level: number }
export type Tick = { time: number; kind: 'process' | 'switch' | 'idle'; pid: string | null; ready: string[]; processes: ProcessSnapshot[]; events: string[] }
export type ProcessMetric = { id: string; completion: number; turnaround: number; waiting: number; response: number }
export type Result = { algorithm: Algorithm; ticks: Tick[]; final: ProcessSnapshot[]; metrics: ProcessMetric[]; makespan: number; busy: number; switches: number; idle: number; utilization: number; throughput: number; averageWaiting: number; averageResponse: number; averageTurnaround: number }

type PCB = { input: ProcessInput; bursts: number[]; state: State; burstIndex: number; remaining: number; wake: number | null; used: number; level: number; order: number; waiting: number; first: number | null; completion: number | null }
const MAX_TICKS = 10000
export function parseBursts(text: string): number[] {
  if (!/^\s*\d+(?:\s*[,/]\s*\d+)*\s*$/.test(text)) throw new Error('Use alternating CPU / I/O / CPU bursts, for example 4 / 3 / 2.')
  const values = text.split(/[,/]/).map(Number)
  if (values.length % 2 !== 1 || values.some(n => !Number.isSafeInteger(n) || n < 1 || n > MAX_TICKS)) {
    throw new Error('Bursts must be positive whole numbers (up to 10,000), starting and ending with CPU.')
  }
  return values
}
export function simulate(inputs: ProcessInput[], algorithm: Algorithm, config: Config): Result {
  if (!algorithms.includes(algorithm)) throw new Error('Choose a supported scheduling algorithm.')
  if (!inputs.length || inputs.length > 30) throw new Error('Enter between 1 and 30 processes.')
  const integer = (n: number) => Number.isSafeInteger(n)
  if (!integer(config.quantum) || config.quantum < 1 || !integer(config.switchCost) || config.switchCost < 0 ||
      config.levels.length !== 3 || config.levels.some(n => !integer(n) || n < 1) || !integer(config.boost) || config.boost < 0) {
    throw new Error('Quantum and MLFQ budgets must be positive integers; switch cost and boost must be nonnegative integers.')
  }
  if (new Set(inputs.map(p => p.id)).size !== inputs.length) throw new Error('Process IDs must be unique.')
  const pcbs: PCB[] = inputs.map((input): PCB => {
    if (!integer(input.arrival) || input.arrival < 0 || input.arrival > MAX_TICKS || !integer(input.priority)) {
      throw new Error(`${input.id}: use a nonnegative integer arrival (up to 10,000) and an integer priority.`)
    }
    const bursts = parseBursts(input.bursts)
    return { input, bursts, state: 'NEW', burstIndex: 0, remaining: bursts[0], wake: null, used: 0, level: 0, order: 0, waiting: 0, first: null, completion: null }
  }).sort((a, b) => Number(a.input.id.slice(1)) - Number(b.input.id.slice(1)))
  let time = 0, sequence = 0, completed = 0, switching = false, switchRemaining = 0
  let running: PCB | null = null
  const ready: PCB[] = [], ticks: Tick[] = []
  const enqueue = (p: PCB) => { p.state = 'READY'; p.order = sequence++; ready.push(p) }
  const rank = (a: PCB, b: PCB) =>
    (algorithm === 'SRTF' || algorithm === 'SJF' ? a.remaining - b.remaining :
      algorithm === 'Priority' ? a.input.priority - b.input.priority : algorithm === 'MLFQ' ? a.level - b.level : 0) || a.order - b.order
  const ordered = () => [...ready].sort(rank)
  const snapshot = (): ProcessSnapshot[] => pcbs.map(p => ({ id: p.input.id, state: p.state,
    remaining: p.state === 'DONE' ? 0 : p.remaining + p.bursts.slice(p.burstIndex + 1).filter((_, i) => (p.burstIndex + 1 + i) % 2 === 0).reduce((a, b) => a + b, 0),
    currentBurst: p.remaining, wake: p.wake, level: p.level }))
  while (true) {
    const events: string[] = []
    // Resolve the interval ending at t before admitting new Ready entries.
    if (running) {
      const p = running
      if (p.remaining === 0) {
        if (p.burstIndex === p.bursts.length - 1) {
          p.state = 'DONE'; p.completion = time; completed++; events.push(`${p.input.id} completes.`)
        } else {
          p.wake = time + p.bursts[p.burstIndex + 1]; p.burstIndex += 2; p.remaining = p.bursts[p.burstIndex]; p.state = 'WAITING'
          if (algorithm === 'MLFQ') p.used = 0
          events.push(`${p.input.id} starts I/O; returns at ${p.wake}.`)
        }
        running = null
      } else if ((algorithm === 'RR' && p.used === config.quantum) || (algorithm === 'MLFQ' && p.used === config.levels[p.level])) {
        if (algorithm === 'MLFQ') { p.level = Math.min(2, p.level + 1); p.used = 0 }
        enqueue(p); running = null; events.push(`${p.input.id} exhausts its ${algorithm === 'MLFQ' ? 'queue budget' : 'quantum'} and rejoins Ready.`)
      }
    }
    if (completed === pcbs.length) break
    if (time >= MAX_TICKS) throw new Error('Schedule exceeds 10,000 time units. Reduce arrivals, bursts, or switch overhead.')
    for (const p of pcbs) if (p.state === 'NEW' && p.input.arrival === time) { enqueue(p); events.push(`${p.input.id} arrives.`) }
    for (const p of pcbs) if (p.state === 'WAITING' && p.wake === time) { p.wake = null; enqueue(p); events.push(`${p.input.id} returns from I/O.`) }
    if (algorithm === 'MLFQ' && config.boost > 0 && time > 0 && time % config.boost === 0) {
      pcbs.filter(p => p.state !== 'NEW' && p.state !== 'DONE').forEach(p => { p.level = 0; p.used = 0 })
      events.push('Priority boost: admitted processes return to Q0; budgets reset.')
    }
    const best = ordered()[0]
    if (running && best && ((algorithm === 'SRTF' && best.remaining < running.remaining) ||
        (algorithm === 'Priority' && best.input.priority < running.input.priority) ||
        (algorithm === 'MLFQ' && best.level < running.level))) {
      events.push(`${best.input.id} strictly outranks ${running.input.id}; preempt.`)
      enqueue(running); running = null
    }
    if (!running && ready.length && !switching) { switching = true; switchRemaining = config.switchCost }
    if (switching && switchRemaining === 0) {
      running = ordered()[0]; ready.splice(ready.indexOf(running), 1); running.state = 'RUNNING'; switching = false
      if (algorithm !== 'MLFQ') running.used = 0
      if (running.first === null) running.first = time
      events.push(`Dispatch ${running.input.id}${algorithm === 'MLFQ' ? ` from Q${running.level}` : ''}.`)
    }
    const kind = running ? 'process' : switching ? 'switch' : 'idle'
    ticks.push({ time, kind, pid: running?.input.id ?? null, ready: ordered().map(p => p.input.id), processes: snapshot(), events })
    ready.forEach(p => p.waiting++)
    if (running) { running.remaining--; running.used++ }
    else if (switching) switchRemaining--
    time++
  }
  const metrics: ProcessMetric[] = pcbs.map(p => ({ id: p.input.id, completion: p.completion!, turnaround: p.completion! - p.input.arrival, waiting: p.waiting, response: p.first! - p.input.arrival }))
  const busy = ticks.filter(t => t.kind === 'process').length, switches = ticks.filter(t => t.kind === 'switch').length
  const avg = (key: 'waiting' | 'turnaround' | 'response') => metrics.reduce((s, p) => s + p[key], 0) / metrics.length
  return { algorithm, ticks, final: snapshot(), metrics, makespan: time, busy, switches, idle: time - busy - switches,
    utilization: 100 * busy / time, throughput: metrics.length / time, averageWaiting: avg('waiting'), averageResponse: avg('response'), averageTurnaround: avg('turnaround') }
}
