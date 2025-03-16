import { getAccelerationIndex } from "./utils.js";

export function punchDetected(threshold = 7) {
  let lastAcceleration = 0;
  let coolDown = 300;
  let lastPunch = 0;

  return function (sensorData) {
    if (sensorData.type === "acceleration") {
      const acceleration = getAccelerationIndex(sensorData);
      if (acceleration > lastAcceleration) {
        if (acceleration > threshold) {
          lastAcceleration = acceleration;
          if (Date.now() - lastPunch > coolDown) {
            lastPunch = Date.now();
            return {
              type: "punch",
              acceleration,
            };
          }
        }
      }
      lastAcceleration = acceleration;
    }
  };
}

export function aggressionLevel(decayRate = 0.9) {
  let detectPunch = punchDetected(7);
  let level = 0.1;

  return function (sensorData) {
    if (sensorData.type === "acceleration") {
      if (level < 0.5) {
        level = 0.5;
      }

      let punch = detectPunch(sensorData);
      if (punch) {
        level = level * decayRate + punch.acceleration;
      } else {
        level = level * decayRate;
      }
      return {
        type: "aggression",
        level,
      };
    }
  };
}

export function tiltDetected() {
  let lastTilt = 0;

  return function (sensorData) {
    if (sensorData.type === "orientation") {
      let largestTilt = Math.max(
        Math.abs(sensorData.orientation.x),
        Math.abs(sensorData.orientation.y),
        Math.abs(sensorData.orientation.z),
      );
      if (largestTilt > lastTilt) {
        lastTilt = largestTilt;
        return {
          type: "tilt",
          tilt: largestTilt,
        };
      }
      lastTilt = largestTilt;
    }
  };
}
