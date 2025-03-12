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

let updateRate = 1 / 60; // Sensor refresh rate

// WebSocket connection
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/data-input`);

ws.onopen = () => {
  console.log("WebSocket connection established");
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("WebSocket connection closed");
};

async function getAccel() {
  DeviceMotionEvent.requestPermission().then((response) => {
    if (response == "granted") {
      // Add a listener to get smartphone orientation
      // in the alpha-beta-gamma axes (units in degrees)
      window.addEventListener("deviceorientation", (event) => {
        // Expose each orientation angle in a more readable way
        rotation_degrees = event.alpha;
        frontToBack_degrees = event.beta;
        leftToRight_degrees = event.gamma;

        // Update raw velocities without clipping
        rawVx = rawVx + leftToRight_degrees * updateRate * 2;
        rawVy = rawVy + frontToBack_degrees * updateRate;

        // Update raw positions without clipping
        rawPx = rawPx + rawVx * 0.5;
        rawPy = rawPy + rawVy * 0.5;

        // Update display velocities (clipped)
        vx = vx + leftToRight_degrees * updateRate * 2;
        vy = vy + frontToBack_degrees * updateRate;

        // Update display position and clip it to bounds
        px = px + vx * 0.5;
        if (px > 98 || px < 0) {
          px = Math.max(0, Math.min(98, px));
          vx = 0;
        }

        py = py + vy * 0.5;
        if (py > 98 || py < 0) {
          py = Math.max(0, Math.min(98, py));
          vy = 0;
        }

        // Update display
        dot = document.getElementsByClassName("dot")[0];
        dot.setAttribute("style", "left:" + px + "%;" + "top:" + py + "%;");

        // Update display values
        contentX.innerHTML = Math.round(px);
        contentY.innerHTML = Math.round(py);
        contentTime.innerHTML = new Date();
        contentId.innerHTML = id;
        contentAlpha.innerHTML = Math.round(rotation_degrees);
        contentBeta.innerHTML = Math.round(frontToBack_degrees);
        contentGamma.innerHTML = Math.round(leftToRight_degrees);

        // Send raw (unclipped) data through WebSocket
        if (ws.readyState === WebSocket.OPEN) {
          const data = {
            px: rawPx,
            py: rawPy,
            rotation_degrees,
            frontToBack_degrees,
            leftToRight_degrees,
            timestamp: Date.now(),
          };
          ws.send(JSON.stringify(data));
        }
      });
    }
  });
}
