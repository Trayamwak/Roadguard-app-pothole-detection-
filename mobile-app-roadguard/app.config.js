module.exports = ({ config }) => {
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  return {
    ...config,
    ios: {
      ...config.ios,
      ...(mapsKey
        ? { config: { ...config.ios?.config, googleMapsApiKey: mapsKey } }
        : {}),
    },
    android: {
      ...config.android,
      ...(mapsKey
        ? {
            config: {
              ...config.android?.config,
              googleMaps: { apiKey: mapsKey },
            },
          }
        : {}),
    },
  };
};
