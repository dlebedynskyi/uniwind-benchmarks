import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { variants } from './matrix.mjs'

const args = process.argv.slice(2)
const inputIndex = args.indexOf('--input')
if (inputIndex === -1) {
  throw new Error('Usage: bun benchmark:summarize --input benchmark-results/app-matrix/android')
}

const input = path.resolve(args[inputIndex + 1])
const roundFiles = readdirSync(path.join(input, 'rounds')).filter((file) => file.endsWith('.log'))

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}
const standardDeviation = (values) => {
  if (values.length < 2) {
    return 0
  }

  const mean = average(values)
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
  )
}
const confidenceInterval95 = (values) => {
  if (values.length === 1) {
    return [values[0], values[0]]
  }

  const criticalValues = {
    2: 12.706,
    3: 4.303,
    4: 3.182,
    5: 2.776,
    6: 2.571,
    7: 2.447,
    8: 2.365,
    9: 2.306,
    10: 2.262,
    11: 2.228,
    12: 2.201,
    13: 2.179,
    14: 2.16,
  }
  const critical = criticalValues[values.length] ?? 1.96
  const margin = critical * (standardDeviation(values) / Math.sqrt(values.length))
  const mean = average(values)
  return [mean - margin, mean + margin]
}

const records = roundFiles.map((file) => {
  const content = readFileSync(path.join(input, 'rounds', file), 'utf8')
  const variant = content.match(/^# variant=(.+)$/m)?.[1]
  const resultLine = content
    .split('\n')
    .find((line) => line.includes('[UNIWIND_BENCHMARK] {"kind":"result"'))

  if (!variant || !resultLine) {
    throw new Error(`Invalid benchmark log: ${file}`)
  }

  const payload = JSON.parse(resultLine.slice(resultLine.indexOf('{')))
  const round = Number(file.match(/^r(\d+)-/)?.[1])
  return { file, round, ...payload, appVariant: payload.variant, variant }
})

const summary = variants.map((variant) => {
  const runs = records.filter((record) => record.variant === variant.id)
  const medians = runs.map((record) => record.median)
  return {
    variant: variant.id,
    rounds: runs.length,
    medianOfRoundMediansMs: median(medians),
    meanOfRoundMediansMs: average(medians),
    minRoundMedianMs: Math.min(...medians),
    maxRoundMedianMs: Math.max(...medians),
  }
})

const comparisons = [
  ['mixed', 'mixed-pr640'],
  ['uniwind', 'uniwind-pr640'],
  ['uniwind-pro', 'uniwind-pro-pr640'],
].map(([off, on]) => {
  const offByRound = new Map(
    records.filter((record) => record.variant === off).map((record) => [record.round, record.median])
  )
  const deltas = records
    .filter((record) => record.variant === on)
    .map((record) => {
      const offMedian = offByRound.get(record.round)
      if (offMedian === undefined) {
        throw new Error(`Missing ${off} result for round ${record.round}.`)
      }
      return record.median - offMedian
    })
  const [ciLowMs, ciHighMs] = confidenceInterval95(deltas)
  return {
    comparison: `${on} vs ${off}`,
    rounds: deltas.length,
    meanDeltaMs: average(deltas),
    medianDeltaMs: median(deltas),
    ciLowMs,
    ciHighMs,
  }
})

const summaryCsv = [
  'variant,rounds,median_of_round_medians_ms,mean_of_round_medians_ms,min_round_median_ms,max_round_median_ms',
  ...summary.map((row) =>
    [
      row.variant,
      row.rounds,
      row.medianOfRoundMediansMs,
      row.meanOfRoundMediansMs,
      row.minRoundMedianMs,
      row.maxRoundMedianMs,
    ].join(',')
  ),
].join('\n')

const comparisonCsv = [
  'comparison,rounds,mean_delta_ms,median_delta_ms,ci_low_ms,ci_high_ms',
  ...comparisons.map((row) =>
    [
      row.comparison,
      row.rounds,
      row.meanDeltaMs,
      row.medianDeltaMs,
      row.ciLowMs,
      row.ciHighMs,
    ].join(',')
  ),
].join('\n')

writeFileSync(path.join(input, 'summary.csv'), `${summaryCsv}\n`)
writeFileSync(path.join(input, 'comparisons.csv'), `${comparisonCsv}\n`)
writeFileSync(
  path.join(input, 'summary.json'),
  `${JSON.stringify({ summary, comparisons, records }, null, 2)}\n`
)

console.table(summary)
console.table(comparisons)
