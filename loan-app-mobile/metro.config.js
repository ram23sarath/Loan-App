// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Performance optimizations for production builds
config.transformer = {
    ...config.transformer,
    // Enable inline requires for smaller initial bundle
    inlineRequires: true,
    // Minify in production
    minifierConfig: {
        keep_fnames: false,
        mangle: {
            keep_fnames: false,
        },
        output: {
            ascii_only: true,
            quote_style: 3,
            wrap_iife: true,
        },
        compress: {
            // Remove dead code
            dead_code: true,
            // Remove console statements in production
            drop_console: process.env.NODE_ENV === 'production',
            // Collapse variables
            collapse_vars: true,
            // Reduce variable names
            reduce_vars: true,
        },
    },
};

// Enable memory-efficient caching
config.cacheStores = [];

module.exports = config;
