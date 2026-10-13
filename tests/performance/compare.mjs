import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const [beforeLabel = 'baseline', afterLabel = 'after'] = process.argv.slice(2)
for (const label of [beforeLabel, afterLabel]) assert.match(label, /^[a-z0-9-]+$/)
const before = JSON.parse(readFileSync(`docs/performance-evidence/${beforeLabel}.json`, 'utf8'))
const after = JSON.parse(readFileSync(`docs/performance-evidence/${afterLabel}.json`, 'utf8'))
assert.deepEqual(before.procedure, after.procedure, 'Measurements need the same protocol')
assert.deepEqual(before.environment, after.environment, 'Measurements need the same environment')
const median = numbers => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)]
console.log('| Profile | Device | Body bytes before → after | Script bytes | Image bytes before → after | LCP ms before → after | CLS before → after |')
console.log('| --- | --- | --- | --- | --- | --- | --- |')
for (const profile of [...new Set(before.runs.map(run => `${run.profile}/${run.device}`))]) {
  const select = report => report.runs.filter(run => `${run.profile}/${run.device}` === profile)
  const oldRuns = select(before), newRuns = select(after)
  assert.equal(oldRuns.length, before.procedure.repetitions)
  assert.equal(newRuns.length, after.procedure.repetitions)
  const value = (runs, key) => median(runs.map(run => run.firstViewport[key]))
  const pair = key => `${value(oldRuns, key)} → ${value(newRuns, key)}`
  const [name, device] = profile.split('/')
  console.log(`| ${name} | ${device} | ${pair('encodedBytes')} | ${pair('scriptBytes')} | ${pair('imageBytes')} | ${Math.round(value(oldRuns, 'lcpMs'))} → ${Math.round(value(newRuns, 'lcpMs'))} | ${value(oldRuns, 'cls').toFixed(4)} → ${value(newRuns, 'cls').toFixed(4)} |`)
}
