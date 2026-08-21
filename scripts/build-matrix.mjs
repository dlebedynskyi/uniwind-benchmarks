import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getVariant, variants } from './matrix.mjs'
import { run } from './process.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const platformIndex = args.indexOf('--platform')
const variantIndex = args.indexOf('--variant')
const deviceIndex = args.indexOf('--device')
const platform = platformIndex === -1 ? undefined : args[platformIndex + 1]
const selectedVariants = variantIndex === -1 ? variants : [getVariant(args[variantIndex + 1])]
const device = deviceIndex === -1 ? process.env.IOS_SIMULATOR_UDID : args[deviceIndex + 1]
const artifactsRoot = path.join(repoRoot, 'benchmark-artifacts', platform ?? 'unknown')

if (!['android', 'ios'].includes(platform)) {
  throw new Error(
    'Usage: bun benchmark:build --platform android|ios [--variant id] [--device ios-udid]'
  )
}

if (selectedVariants.some((variant) => variant.optimize)) {
  run('node', [path.join(repoRoot, 'scripts/verify-pr640.mjs')])
}

mkdirSync(artifactsRoot, { recursive: true })

for (const variant of selectedVariants) {
  const appRoot = path.join(repoRoot, 'apps', variant.app)
  const env = {
    ...process.env,
    UNIWIND_OPTIMIZE_CLASSLESS_COMPONENTS: variant.optimize ? '1' : '0',
    ...(variant.entryFile ? { ENTRY_FILE: variant.entryFile } : {}),
  }

  console.log(`\nBuilding ${platform} ${variant.id}`)

  if (platform === 'android') {
    const apk = path.join(appRoot, 'android/app/build/outputs/apk/release/app-release.apk')
    run('./gradlew', ['app:createBundleReleaseJsAndAssets', '--rerun-tasks'], {
      cwd: path.join(appRoot, 'android'),
      env,
    })
    rmSync(apk, { force: true })
    run('./gradlew', ['assembleRelease'], {
      cwd: path.join(appRoot, 'android'),
      env,
    })

    if (!existsSync(apk)) {
      throw new Error(`Missing APK: ${apk}`)
    }
    cpSync(apk, path.join(artifactsRoot, `${variant.id}.apk`))
    continue
  }

  const podfileLock = path.join(appRoot, 'ios/Podfile.lock')
  const manifest = path.join(appRoot, 'ios/Pods/Manifest.lock')
  const podsAreCurrent =
    existsSync(podfileLock) &&
    existsSync(manifest) &&
    readFileSync(podfileLock, 'utf8') === readFileSync(manifest, 'utf8')

  if (!podsAreCurrent) {
    run('pod', ['install'], {
      cwd: path.join(appRoot, 'ios'),
      env,
    })
  }

  const derivedData = path.join(
    artifactsRoot,
    'derived-data',
    variant.iosDerivedDataKey ?? variant.id
  )
  run(
    'xcodebuild',
    [
      '-workspace',
      path.join(appRoot, 'ios', `${variant.iosScheme}.xcworkspace`),
      '-scheme',
      variant.iosScheme,
      '-configuration',
      'Release',
      '-sdk',
      'iphonesimulator',
      '-destination',
      device ? `platform=iOS Simulator,id=${device}` : 'generic/platform=iOS Simulator',
      '-derivedDataPath',
      derivedData,
      '-quiet',
      'CODE_SIGNING_ALLOWED=NO',
      ...(device ? ['ONLY_ACTIVE_ARCH=YES'] : []),
      'build',
    ],
    { cwd: appRoot, env }
  )

  const builtApp = path.join(
    derivedData,
    'Build/Products/Release-iphonesimulator',
    `${variant.iosProduct}.app`
  )
  if (!existsSync(builtApp)) {
    throw new Error(`Missing iOS app: ${builtApp}`)
  }
  const destination = path.join(artifactsRoot, `${variant.id}.app`)
  rmSync(destination, { recursive: true, force: true })
  cpSync(builtApp, destination, { recursive: true })
}
