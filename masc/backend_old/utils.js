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
  return sensorData;
}

export function validateSensorData(sensorData) {
  if (sensorData.type === "acceleration") {
    return validateAccelerationData(sensorData);
  } else if (sensorData.type === "orientation") {
    return validateOrientationData(sensorData);
  }
}

export function getAccelerationIndex(sensorData) {
  // return the largest acceleration value
  const acceleration = Math.max(
    Math.abs(sensorData.acceleration.x),
    Math.abs(sensorData.acceleration.y),
    Math.abs(sensorData.acceleration.z),
  );
  return acceleration;
}

// Function to normalize sensor data after calibration
// This ensures values stay within expected ranges
export function normalizeSensorData(sensorData) {
  const normalizedData = { ...sensorData };

  // For orientation data, ensure values stay within expected ranges
  if (sensorData.type === "orientation" && sensorData.orientation) {
    // Alpha (x) should be 0-360
    let alpha = sensorData.orientation.x;
    while (alpha < 0) alpha += 360;
    while (alpha >= 360) alpha -= 360;

    // Beta (y) should be -180 to 180
    let beta = sensorData.orientation.y;
    beta = Math.max(-180, Math.min(180, beta));

    // Gamma (z) should be -90 to 90
    let gamma = sensorData.orientation.z;
    gamma = Math.max(-90, Math.min(90, gamma));

    normalizedData.orientation = { x: alpha, y: beta, z: gamma };
  }

  return normalizedData;
}
