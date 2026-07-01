module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    plugins: [
      // Reanimated 4: o plugin de worklets vive em react-native-worklets.
      // Deve ser o último plugin da lista.
      'react-native-worklets/plugin',
    ],
  };
};