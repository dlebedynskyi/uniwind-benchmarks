import type { ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { calculateStats } from './index'

const ITEM_COUNTS = [100, 250, 500, 1000, 2000] as const
const WARMUP_RUNS = 2
const MEASURED_RUNS = 7
const DELAY_BETWEEN_RUNS_MS = 250

const now = () => {
  const timer = (globalThis as { performance?: { now: () => number } }).performance
  return timer?.now() ?? Date.now()
}

interface ActiveSample {
  itemCount: number
  runIndex: number
  token: number
}

interface Cursor {
  countIndex: number
  runIndex: number
}

export interface ScalingBenchmarkProps {
  renderTree: (itemCount: number) => ReactNode
  variant: string
}

interface CommitMarkerProps {
  onCommit: (token: number) => void
  token: number
}

function CommitMarker({ onCommit, token }: CommitMarkerProps) {
  useLayoutEffect(() => {
    onCommit(token)
  }, [onCommit, token])

  return null
}

export function ScalingBenchmark({ renderTree, variant }: ScalingBenchmarkProps) {
  const [activeSample, setActiveSample] = useState<ActiveSample | null>(null)
  const [cursor, setCursor] = useState<Cursor>({ countIndex: 0, runIndex: 0 })
  const [sequence, setSequence] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [lastDuration, setLastDuration] = useState<number | null>(null)
  const startTimeRef = useRef(0)
  const measurementsRef = useRef<number[]>([])
  const committedTokensRef = useRef(new Set<number>())

  useEffect(() => {
    if (isComplete) {
      return
    }

    const timer = setTimeout(() => {
      const itemCount = ITEM_COUNTS[cursor.countIndex]
      const token = sequence + 1

      startTimeRef.current = now()
      setActiveSample({ itemCount, runIndex: cursor.runIndex, token })
    }, DELAY_BETWEEN_RUNS_MS)

    return () => clearTimeout(timer)
  }, [cursor, isComplete, sequence])

  const handleCommit = useCallback(
    (token: number) => {
      if (committedTokensRef.current.has(token)) {
        return
      }
      committedTokensRef.current.add(token)

      const duration = now() - startTimeRef.current
      const isWarmup = cursor.runIndex < WARMUP_RUNS
      const itemCount = ITEM_COUNTS[cursor.countIndex]

      if (!isWarmup) {
        measurementsRef.current.push(duration)
        setLastDuration(duration)
      }

      const isLastRun = cursor.runIndex === WARMUP_RUNS + MEASURED_RUNS - 1
      const isLastCount = cursor.countIndex === ITEM_COUNTS.length - 1

      if (isLastRun) {
        const publicNodes = itemCount * 2 + 1
        const stats = calculateStats(measurementsRef.current)
        const result = {
          kind: 'result',
          variant,
          itemCount,
          publicNodes,
          warmupRuns: WARMUP_RUNS,
          measuredRuns: MEASURED_RUNS,
          averageMs: stats.average,
          medianMs: stats.median,
          minMs: stats.min,
          maxMs: stats.max,
          stdDevMs: stats.stdDev,
          medianMsPerNode: stats.median / publicNodes,
          samplesMs: measurementsRef.current,
        }

        console.info(`[UNIWIND_BENCHMARK] ${JSON.stringify(result)}`)
        measurementsRef.current = []
      }

      setActiveSample(null)

      setTimeout(() => {
        if (isLastRun && isLastCount) {
          console.info(`[UNIWIND_BENCHMARK] ${JSON.stringify({ kind: 'complete', variant })}`)
          setIsComplete(true)
          return
        }

        setCursor((current) =>
          isLastRun
            ? { countIndex: current.countIndex + 1, runIndex: 0 }
            : { ...current, runIndex: current.runIndex + 1 }
        )
        setSequence((current) => current + 1)
      }, 0)
    },
    [cursor, variant]
  )

  const itemCount = ITEM_COUNTS[cursor.countIndex]
  const measuredRun = Math.max(0, cursor.runIndex - WARMUP_RUNS + 1)

  return (
    <View style={styles.screen}>
      <View style={styles.status}>
        <Text style={styles.title}>{variant}</Text>
        <Text style={styles.detail}>
          {isComplete
            ? 'Complete'
            : `${itemCount} items · ${Math.min(measuredRun, MEASURED_RUNS)}/${MEASURED_RUNS}`}
        </Text>
        {lastDuration !== null && (
          <Text style={styles.detail}>Last measured mount: {lastDuration.toFixed(2)}ms</Text>
        )}
      </View>

      {activeSample !== null && renderTree(activeSample.itemCount)}
      {activeSample !== null && <CommitMarker onCommit={handleCommit} token={activeSample.token} />}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  status: {
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  title: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  detail: {
    color: '#000',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
})
