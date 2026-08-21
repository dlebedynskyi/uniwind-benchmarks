import { spawn, spawnSync } from 'node:child_process'

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    ...options,
  })

  if (result.status !== 0 && !options.allowFailure) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n')
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}\n${details}`)
  }

  return result
}

export function runStreaming(command, args, options = {}) {
  return spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
