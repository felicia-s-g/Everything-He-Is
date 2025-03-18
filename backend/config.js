/**
 * Singleton configuration module for sensor data processing
 */

// Default configuration for punch detection
const config = {
  punch: {
    weakThreshold: 3,
    normalThreshold: 6,
    strongThreshold: 15,
    coolDown: 300,
    maxValue: 40,
    minThreshold: 2,
    accelWeights: {
      x: 1.0,
      y: 1.0,
      z: 1.0,
    },
    directionFilter: {
      enabled: false,
      tolerance: 45,
      direction: "positive-x",
    },
  },
};

/**
 * Updates configuration values
 * @param {Object} newConfig - New configuration values to merge
 */
function updateConfig(newConfig) {
  if (newConfig.punch) {
    // Deep merge the punch configuration
    config.punch = {
      ...config.punch,
      ...newConfig.punch,
      // Handle nested objects
      accelWeights: {
        ...config.punch.accelWeights,
        ...(newConfig.punch.accelWeights || {}),
      },
      directionFilter: {
        ...config.punch.directionFilter,
        ...(newConfig.punch.directionFilter || {}),
      },
    };
  }
}

/**
 * Gets a copy of the current configuration
 * @returns {Object} Current configuration
 */
function getConfig() {
  return JSON.parse(JSON.stringify(config));
}

module.exports = {
  config,
  updateConfig,
  getConfig,
};
