const { withAndroidManifest } = require("@expo/config-plugins");

// Import environment variables from .env file
require("dotenv").config();

module.exports = ({ config }) => {
  // Clone the config to avoid mutating the original
  const updatedConfig = { ...config };

  // Copy the app.json configuration
  updatedConfig.name = "Nudge";
  updatedConfig.slug = "nudge";
  updatedConfig.version = "1.0.0";
  updatedConfig.orientation = "portrait";
  updatedConfig.icon = "./assets/images/icon.png";
  updatedConfig.scheme = "myapp";
  updatedConfig.userInterfaceStyle = "automatic";
  updatedConfig.newArchEnabled = true;

  // iOS configuration
  updatedConfig.ios = {
    supportsTablet: true,
    bundleIdentifier: "com.dreadfire.nudge",
  };

  // Android configuration
  updatedConfig.android = {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.dreadfire.nudge",
  };

  // Web configuration
  updatedConfig.web = {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  };

  // Plugins configuration
  updatedConfig.plugins = [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
  ];

  // Experiments
  updatedConfig.experiments = {
    typedRoutes: true,
  };

  // Extra configuration
  updatedConfig.extra = {
    router: {
      origin: false,
    },
    eas: {
      projectId: "e66884c7-1189-4f49-8f49-046461b2954a",
    },
  };

  // Owner

  // We need to add custom plugin configuration for native modules
  // The prebuild command will detect these modules and configure them appropriately

  return updatedConfig;
};
