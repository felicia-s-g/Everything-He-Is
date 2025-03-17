const { getAccelerationIndex } = require("./utils");
const { config } = require("./config");

// I want to clasify punches into different types:
// - normal punch
// - strong punch
// - weak punch

function classifiedPunchDetected() {
  let lastAcceleration = 0;
  let lastPunch = 0;

  return function (sensorData) {
    if (sensorData.type === "acceleration") {
      // Get current config values
      const {
        weakThreshold,
        normalThreshold,
        strongThreshold,
        coolDown,
        minThreshold,
        accelWeights,
        directionFilter,
      } = config.punch;

      // Apply weighted acceleration calculation
      const weightedAcceleration = {
        x: Math.abs(sensorData.acceleration.x) * accelWeights.x,
        y: Math.abs(sensorData.acceleration.y) * accelWeights.y,
        z: Math.abs(sensorData.acceleration.z) * accelWeights.z,
      };

      // Find the maximum acceleration value
      const acceleration = Math.max(
        weightedAcceleration.x,
        weightedAcceleration.y,
        weightedAcceleration.z,
      );

      // Check if we should apply direction filtering
      let passesDirectionFilter = true;
      if (directionFilter.enabled) {
        // Determine the dominant axis and its direction
        const dominantAxis = getDominantAxis(sensorData.acceleration);
        const preferredAxis = directionFilter.direction.split("-")[1]; // e.g., "positive-x" → "x"
        const preferredDirection = directionFilter.direction.split("-")[0]; // e.g., "positive-x" → "positive"

        // Check if the dominant axis matches the preferred direction
        if (dominantAxis.axis !== preferredAxis) {
          passesDirectionFilter = false;
        } else {
          // Check if the direction matches the preferred direction
          const isPositive = dominantAxis.value > 0;
          if (
            (preferredDirection === "positive" && !isPositive) ||
            (preferredDirection === "negative" && isPositive)
          ) {
            passesDirectionFilter = false;
          }
        }
      }

      // Check if acceleration is above minimum threshold and passes direction filter
      if (acceleration > minThreshold && passesDirectionFilter) {
        lastAcceleration = acceleration;

        // Check if acceleration exceeds weak threshold and cooldown period has passed
        if (
          acceleration > weakThreshold && (Date.now() - lastPunch > coolDown)
        ) {
          lastPunch = Date.now();
          let classification = "weak";
          if (acceleration >= strongThreshold) {
            classification = "strong";
          } else if (acceleration >= normalThreshold) {
            classification = "normal";
          }
          return {
            type: "punch",
            acceleration,
            classification,
          };
        }
      }
      lastAcceleration = acceleration;
    }
  };
}

// Helper function to determine the dominant axis of acceleration
function getDominantAxis(acceleration) {
  const axes = ["x", "y", "z"];
  let maxAxis = "x";
  let maxValue = Math.abs(acceleration.x);

  axes.forEach((axis) => {
    const value = Math.abs(acceleration[axis]);
    if (value > maxValue) {
      maxValue = value;
      maxAxis = axis;
    }
  });

  return {
    axis: maxAxis,
    value: acceleration[maxAxis],
  };
}

module.exports = {
  classifiedPunchDetected,
};
