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
  // Ensure the absolute property is present, but allow it to be false
  if (sensorData.orientation.absolute === undefined) {
    console.log("Orientation data missing absolute property");
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

// Add THREE.js Math functionality for quaternions (simplified version)
const MathUtils = {
  degToRad: function (degrees) {
    return degrees * Math.PI / 180;
  },
};

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class Euler {
  constructor(x = 0, y = 0, z = 0, order = "XYZ") {
    this.x = x;
    this.y = y;
    this.z = z;
    this.order = order;
  }
}

class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  setFromEuler(euler) {
    const x = euler.x, y = euler.y, z = euler.z;
    const order = euler.order;

    // Implementation of quaternion from euler angles
    // Simplified version of THREE.js implementation
    const cos = Math.cos;
    const sin = Math.sin;

    const c1 = cos(x / 2);
    const c2 = cos(y / 2);
    const c3 = cos(z / 2);

    const s1 = sin(x / 2);
    const s2 = sin(y / 2);
    const s3 = sin(z / 2);

    if (order === "XYZ") {
      this.x = s1 * c2 * c3 + c1 * s2 * s3;
      this.y = c1 * s2 * c3 - s1 * c2 * s3;
      this.z = c1 * c2 * s3 + s1 * s2 * c3;
      this.w = c1 * c2 * c3 - s1 * s2 * s3;
    } else if (order === "ZXY") {
      this.x = s1 * c2 * c3 - c1 * s2 * s3;
      this.y = c1 * s2 * c3 + s1 * c2 * s3;
      this.z = c1 * c2 * s3 + s1 * s2 * c3;
      this.w = c1 * c2 * c3 - s1 * s2 * s3;
    }

    return this;
  }

  multiply(q) {
    const qax = this.x, qay = this.y, qaz = this.z, qaw = this.w;
    const qbx = q.x, qby = q.y, qbz = q.z, qbw = q.w;

    this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

    return this;
  }

  clone() {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  invert() {
    // Quaternion conjugate for unit quaternions
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }
}

// Calibration state
let calibrationQuaternion = new Quaternion();
let inverseCalibrationQuaternion = new Quaternion();
let isCalibrated = false;

// Function to calibrate orientation
export function calibrateOrientation(orientation) {
  if (!orientation) return false;

  // Convert to radians following standard orientation
  const alphaRad = MathUtils.degToRad(orientation.x); // Z-axis rotation
  const betaRad = MathUtils.degToRad(orientation.y); // X-axis rotation
  const gammaRad = MathUtils.degToRad(orientation.z); // Y-axis rotation

  // Create calibration quaternion based on standard device orientation
  const baseQuaternion = new Quaternion().setFromEuler(
    new Euler(
      betaRad,
      gammaRad,
      alphaRad,
      "ZXY", // This order matches device orientation standard
    ),
  );

  // Apply flat correction (90 degrees around X-axis) to align with expected screen orientation
  const flatCorrection = new Quaternion().setFromEuler(
    new Euler(Math.PI / 2, 0, 0), // 90° around X-axis
  );

  calibrationQuaternion = baseQuaternion.clone();
  calibrationQuaternion.multiply(flatCorrection);

  // Create inverse quaternion for calibration
  inverseCalibrationQuaternion = calibrationQuaternion.clone().invert();

  isCalibrated = true;
  console.log("Calibration completed with quaternion:", calibrationQuaternion);

  return true;
}

// Implement proper quaternion to Euler conversion (simplified)
function quaternionToEuler(q) {
  // This is a simplified implementation
  // In a real app, you'd use a more robust conversion method

  // Extract Euler angles from quaternion
  const x = Math.atan2(
    2 * (q.w * q.x + q.y * q.z),
    1 - 2 * (q.x * q.x + q.y * q.y),
  );
  const y = Math.asin(2 * (q.w * q.y - q.z * q.x));
  const z = Math.atan2(
    2 * (q.w * q.z + q.x * q.y),
    1 - 2 * (q.y * q.y + q.z * q.z),
  );

  // Convert to degrees
  return {
    x: z * 180 / Math.PI, // alpha
    y: x * 180 / Math.PI, // beta
    z: y * 180 / Math.PI, // gamma
  };
}

// Enhanced getNormalizedOrientation to properly transform orientation
export function getNormalizedOrientation(orientation) {
  // If not calibrated or using absolute orientation, return original data
  if (!isCalibrated || orientation.absolute) {
    return orientation;
  }

  // Create quaternion from device orientation following standards
  const alphaRad = MathUtils.degToRad(orientation.x); // Z-axis rotation
  const betaRad = MathUtils.degToRad(orientation.y); // X-axis rotation
  const gammaRad = MathUtils.degToRad(orientation.z); // Y-axis rotation

  const deviceQuaternion = new Quaternion().setFromEuler(
    new Euler(betaRad, gammaRad, alphaRad, "ZXY"),
  );

  // Apply flat correction to align with expected screen orientation
  const flatCorrection = new Quaternion().setFromEuler(
    new Euler(Math.PI / 2, 0, 0),
  );
  deviceQuaternion.multiply(flatCorrection);

  // Apply calibration
  deviceQuaternion.multiply(inverseCalibrationQuaternion);

  // Convert back to euler angles
  const calibratedEuler = quaternionToEuler(deviceQuaternion);

  // Create normalized orientation object
  return {
    x: calibratedEuler.x,
    y: calibratedEuler.y,
    z: calibratedEuler.z,
    absolute: orientation.absolute,
    normalized: true,
    calibrationApplied: true,
  };
}

export function isOrientationCalibrated() {
  return isCalibrated;
}

export function resetCalibration() {
  isCalibrated = false;
  calibrationQuaternion = new Quaternion();
  inverseCalibrationQuaternion = new Quaternion();
  return true;
}
