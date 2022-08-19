const { ProvidePlugin } = require('webpack');

module.exports = function (config, env) {
    return {
        ...config,
        module: {
            ...config.module,
            rules: [
                ...config.module.rules,
                { test: /\.tsx?$/, loader: 'ts-loader' },
                {
                    test: /\.m?[jt]sx?$/,
                    resolve: {
                        fullySpecified: false,
                    },
                }
            ],
        },
        plugins: [
            ...config.plugins,
            new ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
                process: 'process/browser',
            }),
        ],
        // extensions: [...config.resolve, ".ts", ".js"],
        resolve: {
            ...config.resolve,
            fallback: {
                buffer: require.resolve('buffer'),
                stream: require.resolve('stream-browserify'),
                crypto: require.resolve('crypto-browserify'),
            },
        },
        ignoreWarnings: [/Failed to parse source map/],
    };
};