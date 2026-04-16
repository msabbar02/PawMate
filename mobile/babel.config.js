module.exports = function (api) {
    api.cache(true);
    return {
        presets: [require('expo/internal/babel-preset')],
        plugins: ['react-native-reanimated/plugin'],
    };
};
