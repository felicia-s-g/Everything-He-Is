export function validateSensorData(sensorData) {
  if (
    sensorData.px === undefined ||
    sensorData.py === undefined ||
    sensorData.rotation_degrees === undefined ||
    sensorData.frontToBack_degrees === undefined ||
    sensorData.leftToRight_degrees === undefined ||
    sensorData.timestamp === undefined
  ) {
    console.error("Invalid sensor data format received");
    return;
  }
  return sensorData;
}

export const generateSignal = (
  sensorDataEntries,
  weights = {
    position: 1000,
    rotation: 500,
    angular: 500,
  },
) => {
  // Require at least 3 data points for better motion detection
  if (!Array.isArray(sensorDataEntries) || sensorDataEntries.length < 3) {
    return 0;
  }

  // Get the last 3 entries to analyze the motion pattern
  const current = sensorDataEntries[sensorDataEntries.length - 1];
  const previous = sensorDataEntries[sensorDataEntries.length - 2];
  const oldest = sensorDataEntries[sensorDataEntries.length - 3];

  // Calculate time deltas
  const currentTimeDelta = current.timestamp - previous.timestamp;
  const previousTimeDelta = previous.timestamp - oldest.timestamp;

  // Avoid division by zero
  if (currentTimeDelta === 0 || previousTimeDelta === 0) return 0;

  // Calculate position changes
  const currentPositionDelta = Math.sqrt(
    Math.pow(current.px - previous.px, 2) +
      Math.pow(current.py - previous.py, 2),
  );
  const previousPositionDelta = Math.sqrt(
    Math.pow(previous.px - oldest.px, 2) +
      Math.pow(previous.py - oldest.py, 2),
  );

  // Calculate velocities
  const currentVelocity = currentPositionDelta / currentTimeDelta;
  const previousVelocity = previousPositionDelta / previousTimeDelta;

  // Calculate acceleration (change in velocity)
  const acceleration = Math.abs(currentVelocity - previousVelocity) /
    currentTimeDelta;

  // Calculate angular acceleration
  const currentRotationDelta = Math.abs(
    current.rotation_degrees - previous.rotation_degrees,
  );
  const previousRotationDelta = Math.abs(
    previous.rotation_degrees - oldest.rotation_degrees,
  );
  const rotationAcceleration = Math.abs(
    currentRotationDelta / currentTimeDelta -
      previousRotationDelta / previousTimeDelta,
  );

  // Calculate orientation changes acceleration
  const currentOrientationDelta =
    Math.abs(current.frontToBack_degrees - previous.frontToBack_degrees) +
    Math.abs(current.leftToRight_degrees - previous.leftToRight_degrees);
  const previousOrientationDelta =
    Math.abs(previous.frontToBack_degrees - oldest.frontToBack_degrees) +
    Math.abs(previous.leftToRight_degrees - oldest.leftToRight_degrees);
  const orientationAcceleration = Math.abs(
    currentOrientationDelta / currentTimeDelta -
      previousOrientationDelta / previousTimeDelta,
  );

  // Thresholds for minimum acceleration to be considered a punch
  const MIN_ACCELERATION = 0.8;
  const MIN_ROTATION_ACCELERATION = 0.8;
  const MIN_ORIENTATION_ACCELERATION = 0.5;

  // Only consider it a punch if we exceed minimum thresholds
  if (
    acceleration < MIN_ACCELERATION &&
    rotationAcceleration < MIN_ROTATION_ACCELERATION &&
    orientationAcceleration < MIN_ORIENTATION_ACCELERATION
  ) {
    return 0;
  }

  // Calculate punch intensity based on accelerations
  const punchIntensity = Math.round(
    (acceleration * weights.position) +
      (rotationAcceleration * weights.rotation) +
      (orientationAcceleration * weights.angular),
  );

  // Return a value between 0 and 100 with a more aggressive curve
  return Math.min(100, Math.max(0, Math.pow(punchIntensity / 100, 1.5) * 100));
};
