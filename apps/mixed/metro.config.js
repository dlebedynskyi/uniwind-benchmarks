const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { withUniwindConfig } = require('uniwind/metro')
const { withCommunityPr640 } = require('../../packages/benchmark/metro')
const path = require('node:path')

const workspaceRoot = path.resolve(__dirname, '../../')

const defaultConfig = getDefaultConfig(__dirname)
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: ['../../node_modules', './node_modules'],
  },
}
const mergedConfigs = mergeConfig(defaultConfig, config)

module.exports = withCommunityPr640(mergedConfigs, {
  baselineWithUniwindConfig: withUniwindConfig,
  cssEntryFile: './global.css',
})
