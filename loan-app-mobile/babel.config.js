module.exports = function (api) {
    api.cache(true);

    const plugins = [];

    // Remove console.log statements in production builds for better performance
    if (process.env.NODE_ENV === 'production') {
        plugins.push('transform-remove-console');
    }

    plugins.push('react-native-reanimated/plugin');

    return {
        presets: ['babel-preset-expo'],
        plugins,
    };
};
