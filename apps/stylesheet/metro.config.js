const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('node:path')

const workspaceRoot = path.resolve(__dirname, '../../')

const config = getDefaultConfig(__dirname)
const customConfig = {
  watchFolders: [workspaceRoot],
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'react' || moduleName === 'react-native') {
        return context.resolveRequest(
          context,
          require.resolve(moduleName, { paths: [__dirname] }),
          platform
        )
      }

      return context.resolveRequest(context, moduleName, platform)
    },
  },
}

module.exports = mergeConfig(config, customConfig)
