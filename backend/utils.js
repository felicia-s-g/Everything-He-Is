export function validateAccelerationData(sensorData) {
  if (
    sensorData.acceleration.x === undefined ||
    sensorData.acceleration.y === undefined ||
    sensorData.acceleration.z === undefined ||
    sensorData.timestamp === undefined
  ) {
    console.error("Invalid acceleration data format received");
    return;
  }

  return sensorData;
}

export function validateOrientationData(sensorData) {
  if (
    sensorData.orientation.x === undefined ||
    sensorData.orientation.y === undefined ||
    sensorData.orientation.z === undefined ||
    sensorData.timestamp === undefined
  ) {
    console.error("Invalid orientation data format received");
    return;
  }

  if (sensorData.orientation.absolute === undefined) {
    // Set default to false if not provided
    sensorData.orientation.absolute = false;
  }
  return sensorData;
}

export function extractSensorData(sensorData) {
  if (sensorData.type === "acceleration") {
    return validateAccelerationData(sensorData);
  } else if (sensorData.type === "orientation") {
    return validateOrientationData(sensorData);
  }
}

export function getAccelerationIndex(
  sensorData,
  weights = { x: 1.0, y: 1.0, z: 1.0 },
) {
  // Apply weights to each axis and return the largest acceleration value
  const weightedAcceleration = {
    x: Math.abs(sensorData.acceleration.x) * weights.x,
    y: Math.abs(sensorData.acceleration.y) * weights.y,
    z: Math.abs(sensorData.acceleration.z) * weights.z,
  };

  return Math.max(
    weightedAcceleration.x,
    weightedAcceleration.y,
    weightedAcceleration.z,
  );
}
