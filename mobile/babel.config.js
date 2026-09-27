module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Requis par les frame processors de react-native-vision-camera.
    plugins: [['react-native-worklets-core/plugin']],
  };
};
