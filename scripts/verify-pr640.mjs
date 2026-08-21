import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PR640_COMMIT } from './matrix.mjs'
import { run } from './process.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = path.resolve(
  process.env.UNIWIND_PR640_PACKAGE_ROOT ?? path.join(repoRoot, '../uniwind/packages/uniwind')
)
const uniwindRoot = path.resolve(packageRoot, '../..')
const requiredFiles = [
  'dist/metro/index.cjs',
  'dist/metro/babel-transformer.cjs',
  'src/bundler/adapters/metro/raw-components.ts',
]

for (const relativePath of requiredFiles) {
  if (!existsSync(path.join(packageRoot, relativePath))) {
    throw new Error(`Missing ${relativePath}. Run "bun run build" in ${packageRoot}.`)
  }
}

const revision = run('git', ['-C', uniwindRoot, 'rev-parse', 'HEAD'], { capture: true }).stdout.trim()
if (revision !== PR640_COMMIT) {
  throw new Error(`Expected PR 640 at ${PR640_COMMIT}, found ${revision}.`)
}

console.log(`PR 640 verified at ${revision}`)
console.log(`Package root: ${packageRoot}`)
