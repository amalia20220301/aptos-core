const path = require('path')
const webpack = require('webpack')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
console.log('---------------');
module.exports = {
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
    fallback: {
      buffer: require.resolve('buffer'),
      stream: false,
    },
    plugins: [new TsconfigPathsPlugin({
      configFile: 'tsconfig.json'
    })],
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    })
  ],
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader' }
    ]
  }
}
