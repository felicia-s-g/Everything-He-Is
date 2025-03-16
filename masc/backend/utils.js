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

export function extractSensorData(sensorData) {
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
