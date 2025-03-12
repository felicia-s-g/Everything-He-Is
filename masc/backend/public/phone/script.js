//dom elements
const contentX = document.getElementById("x");
const contentY = document.getElementById("y");
const contentTime = document.getElementById("time");
const contentId = document.getElementById("id");
const contentAlpha = document.getElementById("alpha");
const contentBeta = document.getElementById("beta");
const contentGamma = document.getElementById("gamma");
const id = 1;
let px = 50; // Position x and y for display
let py = 50;
let vx = 0.0; // Velocity x and y for display
let vy = 0.0;

// Actual sensor data values (unclipped)
let rawPx = 50;
let rawPy = 50;
let rawVx = 0.0;
let rawVy = 0.0;

// Current sensor readings for calibration
let currentAcceleration = { x: 0, y: 0, z: 0 };
let currentOrientation = { x: 0, y: 0, z: 0 };

// Calibration status
let isCalibrated = false;

let updateRate = 1 / 60; // Sensor refresh rate

// WebSocket connection
const ws = new WebSocket(`wss://${window.location.hostname}/ws/data-input`);

ws.onopen = () => {
  console.log("WebSocket connection established");
  // Check calibration status on connection
  checkCalibrationStatus();
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("WebSocket connection closed");
};

// Function to check current calibration status
async function checkCalibrationStatus() {
  try {
    const response = await fetch("/api/calibration");
    const data = await response.json();
    isCalibrated = data.isCalibrated;

    // Update UI to show calibration status
    updateCalibrationUI();
  } catch (error) {
    console.error("Error checking calibration status:", error);
  }
}

// Function to update UI based on calibration status
function updateCalibrationUI() {
  const calibrateButton = document.getElementById("calibrateButton");
  const resetButton = document.getElementById("resetCalibrationButton");

  if (calibrateButton) {
    calibrateButton.textContent = isCalibrated ? "Recalibrate" : "Calibrate";
  }

  if (resetButton) {
    resetButton.style.display = isCalibrated ? "inline-block" : "none";
  }
}

// Function to calibrate sensors
async function calibrateSensors() {
  try {
    const response = await fetch("/api/calibrate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        acceleration: currentAcceleration,
        orientation: currentOrientation,
      }),
    });

    const data = await response.json();
    isCalibrated = true;

    // Update UI
    updateCalibrationUI();

    // Show success message
    alert("Calibration successful!");
  } catch (error) {
    console.error("Error calibrating sensors:", error);
    alert("Calibration failed. Please try again.");
  }
}

// Function to reset calibration
async function resetCalibration() {
  try {
    const response = await fetch("/api/reset-calibration", {
      method: "POST",
    });

    const data = await response.json();
    isCalibrated = false;

    // Update UI
    updateCalibrationUI();

    // Show success message
    alert("Calibration reset successful!");
  } catch (error) {
    console.error("Error resetting calibration:", error);
    alert("Failed to reset calibration. Please try again.");
  }
}

async function getAccel() {
  DeviceMotionEvent.requestPermission().then((response) => {
    if (response == "granted") {
      window.addEventListener("devicemotion", (event) => {
        // Store current acceleration values for calibration
        currentAcceleration = {
          x: event.acceleration.x,
          y: event.acceleration.y,
          z: event.acceleration.z,
        };

        // Update UI
        contentX.innerHTML = currentAcceleration.x.toFixed(2);
        contentY.innerHTML = currentAcceleration.y.toFixed(2);
        contentTime.innerHTML = Date.now();
        contentId.innerHTML = id;

        ws.send(
          JSON.stringify({
            type: "acceleration",
            timestamp: Date.now(),
            acceleration: currentAcceleration,
          }),
        );
      });

      window.addEventListener("deviceorientation", (event) => {
        // Store current orientation values for calibration
        currentOrientation = {
          x: event.alpha,
          y: event.beta,
          z: event.gamma,
        };

        // Expose each orientation angle in a more readable way
        rotation_degrees = event.alpha;
        frontToBack_degrees = event.beta;
        leftToRight_degrees = event.gamma;

        // Update UI
        contentAlpha.innerHTML = currentOrientation.x.toFixed(2);
        contentBeta.innerHTML = currentOrientation.y.toFixed(2);
        contentGamma.innerHTML = currentOrientation.z.toFixed(2);

        ws.send(
          JSON.stringify({
            type: "orientation",
            timestamp: Date.now(),
            orientation: currentOrientation,
          }),
        );
      });

      // Add calibration buttons after permissions are granted
      addCalibrationButtons();
    }
  });
}

// Function to add calibration buttons to the UI
function addCalibrationButtons() {
  const mainDiv = document.getElementById("main");

  // Check if buttons already exist
  if (document.getElementById("calibrateButton")) {
    return;
  }

  // Create calibration button
  const calibrateButton = document.createElement("button");
  calibrateButton.id = "calibrateButton";
  calibrateButton.textContent = isCalibrated ? "Recalibrate" : "Calibrate";
  calibrateButton.style.height = "50px";
  calibrateButton.style.marginTop = "10px";
  calibrateButton.style.marginRight = "10px";
  calibrateButton.onclick = calibrateSensors;

  // Create reset button
  const resetButton = document.createElement("button");
  resetButton.id = "resetCalibrationButton";
  resetButton.textContent = "Reset Calibration";
  resetButton.style.height = "50px";
  resetButton.style.marginTop = "10px";
  resetButton.style.display = isCalibrated ? "inline-block" : "none";
  resetButton.onclick = resetCalibration;

  // Add buttons to the UI
  mainDiv.appendChild(document.createElement("br"));
  mainDiv.appendChild(calibrateButton);
  mainDiv.appendChild(resetButton);
}
