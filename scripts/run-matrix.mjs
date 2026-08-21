import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getRoundOrder } from './matrix.mjs'
import { run, runStreaming, sleep } from './process.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const readArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index === -1 ? fallback : args[index + 1]
}

const platform = readArg('--platform')
const device = readArg('--device', platform === 'android' ? undefined : 'booted')
const rounds = Number(readArg('--rounds', '14'))
const output = path.resolve(
  readArg('--output', path.join(repoRoot, 'benchmark-results/app-matrix', platform ?? 'unknown'))
)
const artifactsRoot = path.join(repoRoot, 'benchmark-artifacts', platform ?? 'unknown')
const adb =
  process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME
    ? path.join(process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME, 'platform-tools', 'adb')
    : 'adb'

if (!['android', 'ios'].includes(platform) || !Number.isInteger(rounds) || rounds < 1) {
  throw new Error(
    'Usage: bun benchmark:run --platform android|ios [--device serial|udid] [--rounds 14] [--output dir]'
  )
}
if (platform === 'android' && !device) {
  throw new Error('Android requires --device <adb serial>.')
}

mkdirSync(path.join(output, 'rounds'), { recursive: true })

async function waitForAndroidResult(variant) {
  const deadline = Date.now() + 45_000

  while (Date.now() < deadline) {
    const result = run(
      adb,
      ['-s', device, 'logcat', '-d', '-v', 'epoch', 'ReactNativeJS:I', '*:S'],
      { capture: true }
    )
    const lines = result.stdout.split('\n').filter((line) => line.includes('[UNIWIND_BENCHMARK]'))
    if (lines.some((line) => line.includes('"kind":"complete"'))) {
      return [`# variant=${variant.id}`, ...lines].join('\n')
    }
    await sleep(500)
  }

  throw new Error(`Timed out waiting for ${variant.id}.`)
}

async function runAndroid(variant) {
  const artifact = path.join(artifactsRoot, `${variant.id}.apk`)
  run(adb, ['-s', device, 'uninstall', variant.androidPackage], {
    allowFailure: true,
    capture: true,
  })
  run(adb, ['-s', device, 'install', artifact])
  run(adb, ['-s', device, 'logcat', '-c'])
  run(adb, [
    '-s',
    device,
    'shell',
    'am',
    'start',
    '-W',
    '-n',
    `${variant.androidPackage}/.MainActivity`,
  ])
  const log = await waitForAndroidResult(variant)
  run(adb, ['-s', device, 'shell', 'am', 'force-stop', variant.androidPackage])
  return log
}

async function runIos(variant) {
  const artifact = path.join(artifactsRoot, `${variant.id}.app`)
  run('xcrun', ['simctl', 'uninstall', device, variant.iosBundleId], {
    allowFailure: true,
    capture: true,
  })
  run('xcrun', ['simctl', 'install', device, artifact])

  const logProcess = runStreaming(
    'xcrun',
    [
      'simctl',
      'spawn',
      device,
      'log',
      'stream',
      '--style',
      'compact',
      '--level',
      'info',
      '--predicate',
      'composedMessage CONTAINS "[UNIWIND_BENCHMARK]"',
    ],
    { env: process.env }
  )

  let outputBuffer = ''
  logProcess.stdout.on('data', (chunk) => {
    outputBuffer += chunk.toString()
  })
  logProcess.stderr.on('data', (chunk) => {
    outputBuffer += chunk.toString()
  })

  await sleep(300)
  run('xcrun', ['simctl', 'launch', '--terminate-running-process', device, variant.iosBundleId])

  const deadline = Date.now() + 45_000
  while (
    Date.now() < deadline &&
    !outputBuffer.includes('[UNIWIND_BENCHMARK] {"kind":"complete"')
  ) {
    await sleep(250)
  }

  logProcess.kill('SIGTERM')
  run('xcrun', ['simctl', 'terminate', device, variant.iosBundleId], {
    allowFailure: true,
    capture: true,
  })

  if (!outputBuffer.includes('[UNIWIND_BENCHMARK] {"kind":"complete"')) {
    throw new Error(`Timed out waiting for ${variant.id}.`)
  }

  const lines = outputBuffer
    .split('\n')
    .filter((line) => line.includes('[UNIWIND_BENCHMARK]'))
  return [`# variant=${variant.id}`, ...lines].join('\n')
}

for (let round = 1; round <= rounds; round += 1) {
  const order = getRoundOrder(round)
  console.log(`\nRound ${round}/${rounds}: ${order.map((variant) => variant.id).join(', ')}`)

  for (const variant of order) {
    console.log(`Running ${variant.id}`)
    const log = platform === 'android' ? await runAndroid(variant) : await runIos(variant)
    writeFileSync(path.join(output, 'rounds', `r${round}-${variant.id}.log`), `${log}\n`)
  }
}

run('node', [path.join(repoRoot, 'scripts/summarize-results.mjs'), '--input', output])
