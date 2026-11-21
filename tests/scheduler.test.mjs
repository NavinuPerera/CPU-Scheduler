import test from 'node:test'
import assert from 'node:assert/strict'
import { simulate, algorithms } from '../src/scheduler.ts'
const p = (arrival, bursts, priority = 1, id = 'P1') => ({ id, arrival, bursts, priority, color: '#c8ff4a' })
const config = { quantum: 2, switchCost: 1, levels: [2, 4, 8], boost: 0 }
const run = (jobs, policy = 'FCFS', settings = {}) => simulate(jobs.map((x, i) => ({ ...x, id: `P${i + 1}` })), policy, { ...config, ...settings })

test('Assignment 1 report workload: all four reference runs', () => {
 const jobs = [p(0,'12'),p(2,'2'),p(4,'1'),p(6,'3')]
 for (const [policy, q, expected] of [['FCFS',1,[22,4,14.25,9.75,13]],['SRTF',1,[23,5,8.5,1.5,23]],['RR',1,[36,18,17,4,36]],['RR',12,[22,4,14.25,9.75,13]]]) {
  const r = run(jobs,policy,{quantum:q})
  assert.deepEqual([r.makespan,r.switches,r.averageTurnaround,r.averageResponse,r.metrics[0].turnaround],expected)
 }
})
test('CPU and I/O overlap reference results', () => {
 const a = run([p(0,'3 / 8 / 3'),p(0,'5')]), b = run([p(0,'3 / 8 / 3')])
 assert.deepEqual([a.makespan,a.busy,a.idle,a.utilization],[16,11,2,68.75])
 assert.deepEqual([b.makespan,b.busy,b.idle,b.utilization],[16,6,8,37.5])
 assert.equal(a.ticks[5].pid,'P2');assert.equal(a.ticks[5].processes[0].state,'WAITING')
})
test('RR expiry enters Ready before simultaneous arrivals (assignment ordering)', () => {
 const r=run([p(0,'5'),p(2,'2')],'RR',{switchCost:0})
 assert.equal(r.ticks[2].pid,'P1');assert.deepEqual(r.metrics.map(x=>x.completion),[7,6])
})
test('Burst completion beats RR expiry; first/same-process dispatch costs apply', () => {
 const a=run([p(0,'2')],'RR');assert.equal(a.makespan,3);assert.equal(a.switches,1)
 const b=run([p(0,'5')],'RR');assert.equal(b.makespan,8);assert.equal(b.switches,3)
 assert.deepEqual(b.final.map(p=>p.state),['DONE'])
})
test('Switch does not reserve a PID; strictly shorter preemption only', () => {
 const a=run([p(0,'10'),p(1,'1')],'SRTF',{switchCost:2});assert.equal(a.ticks[2].pid,'P2')
 const b=run([p(0,'5'),p(2,'3')],'SRTF',{switchCost:0});assert.equal(b.ticks[2].pid,'P1')
 const c=run([p(0,'5'),p(2,'2')],'SRTF',{switchCost:0});assert.equal(c.ticks[2].pid,'P2')
})
test('SJF is nonpreemptive; priority is preemptive with strict comparison', () => {
 assert.equal(run([p(0,'5'),p(1,'1')],'SJF',{switchCost:0}).ticks[1].pid,'P1')
 assert.equal(run([p(0,'5',2),p(1,'1',1)],'Priority',{switchCost:0}).ticks[1].pid,'P2')
 assert.equal(run([p(0,'5',1),p(1,'1',1)],'Priority',{switchCost:0}).ticks[1].pid,'P1')
})
test('MLFQ demotion, budgets and switching', () => {
 const r=run([p(0,'9')],'MLFQ');assert.equal(r.makespan,12);assert.equal(r.switches,3)
 assert.equal(r.ticks[4].processes[0].level,1);assert.equal(r.ticks[9].processes[0].level,2)
})
test('Arrival before simultaneous I/O completion; deterministic PID ordering', () => {
 const r=run([p(2,'1'),p(0,'1 / 1 / 1')],'FCFS',{switchCost:0})
 assert.equal(r.ticks[2].pid,'P1');assert.deepEqual(r.ticks[2].ready,['P2'])
 assert.deepEqual(r.ticks[2].events.slice(0,2),['P1 arrives.','P2 returns from I/O.'])
})
test('Invalid and excessive workloads report errors', () => {
 for (const bursts of ['', '1 / 2', '1 / 0 / 1', '2x', '1 / / 3']) assert.throws(()=>run([p(0,bursts)]))
 assert.throws(()=>run([]));assert.throws(()=>run([p(-1,'2')]));assert.throws(()=>run([p(0,'2')],'RR',{quantum:0}))
 assert.throws(()=>run([p(0,'10000')],'RR',{quantum:1}),/10,000/)
})
test('360 workload/policy runs: accounting and exclusive process states', () => {
 for (let seed=1;seed<=60;seed++) for (const policy of algorithms) {
  const jobs=[p(seed%4,`${2+seed%7} / ${1+seed%3} / ${1+seed%5}`,2),p(seed%6,`${1+seed%8}`,1),p(seed%3,`${1+seed%4} / 2 / 2`,3)]
  const r=run(jobs,policy,{switchCost:seed%3,boost:seed%2?0:13})
  assert.equal(r.makespan,r.busy+r.switches+r.idle)
  assert.equal(r.ticks.length,r.makespan)
  for (const [i,m] of r.metrics.entries()) {
   const bursts=jobs[i].bursts.split('/').map(Number)
   assert.equal(m.turnaround,bursts.reduce((a,b)=>a+b,0)+m.waiting)
   assert(m.response>=0)
  }
  for (const t of r.ticks) {
   const running=t.processes.filter(p=>p.state==='RUNNING')
   assert.equal(running.length,t.kind==='process'?1:0)
   assert.equal(t.ready.length,new Set(t.ready).size)
   assert(t.ready.every(id=>t.processes.find(p=>p.id===id).state==='READY'))
   assert(!t.ready.includes(t.pid))
  }
 }
})
