const express = require("express");
const path = require("path");
const https = require("https");
const WebSocket = require("ws");
const cors = require("cors");
const {
  extractSensorData,
  getAccelerationIndex,
} = require("./utils");
const fs = require("fs");
const { classifiedPunchDetected } = require("./signals");
const { config, updateConfig, getConfig } = require("./config");

// SSL certificate configuration
const sslOptions = {
  key: fs.readFileSync("./private/hub-selfsigned.key"),
  cert: fs.readFileSync("./certs/hub-selfsigned.crt"),
};

const app = express();
const server = https.createServer(sslOptions, app);

// Enable CORS for all routes
app.use(cors());

// Create WebSocket server
const websocketsServer = new WebSocket.Server({
  server,
  perMessageDeflate: false,
  clientTracking: true,
});

// HTTP Routes for serving web pages / script files / images.
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Route to serve phone interface
app.get("/phone", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "phone", "index.html"));
});

// Route to serve TV interface
app.get("/tv", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tv", "index.html"));
});

// Route to serve TV fullscreen view
app.get("/tv/fullscreen", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "tv", "fullscreen", "index.html"),
  );
});

// Route to serve TV preview view
app.get("/tv/preview", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tv", "preview", "index.html"));
});

// Redirect root to phone interface by default
app.get("/", (req, res) => {
  res.redirect("/phone");
});

// Route to return array of strings
app.get("/api/images", (req, res) => {
  const archivePath = path.join(__dirname, "public", "archive");

  fs.readdir(archivePath, (err, files) => {
    if (err) {
      console.error("Error reading archive directory:", err);
      return res.status(500).json({
        error: "Failed to read archive directory",
      });
    }

    // Filter for image files only (jpg, jpeg, png, gif)
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|gif)$/i.test(file)
    );

    // Create array of image objects with necessary properties
    const imageUrls = imageFiles.map((file, index) => ({
      id: index + 1,
      url: `/archive/${file}`,
      alt: file.replace(/\.[^/.]+$/, ""), // Remove file extension for alt text
      filename: file,
    }));

    res.json(imageUrls);
  });
});

// REST API for getting/updating config
app.use(express.json());

// Get current config
app.get("/api/config", (req, res) => {
  res.json(getConfig());
});

// Update config
app.post("/api/config", (req, res) => {
  try {
    updateConfig(req.body);
    res.json({
      success: true,
      message: "Configuration updated",
      config: getConfig(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update configuration",
      error: error.message,
    });
  }
});

function sendToClients(server, channel, message) {
  let clientCount = 0;
  if (server.clients && server.clients.size > 0) {
    server.clients.forEach((client) => {
      if (client.path === channel && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
        clientCount++;
      }
    });
  }
}

function classifiedPunchDetector(server) {
  // Use the punch detector from signals.js which now uses the config singleton
  const signal = classifiedPunchDetected();

  return (sensorData) => {
    const punch = signal(sensorData);
    if (punch) {
      // Send to UI signals for the TV interface
      sendToClients(server, "/ws/ui-signals", punch);

      // Also send to debug interface
      sendToClients(server, "/ws/debug", punch);
    }
  };
}

function throttledDebug(server) {
  // Remove throttling entirely
  return (sensorData) => {
    sendToClients(server, "/ws/debug", sensorData);
  };
}

// WebSocket connection handling
websocketsServer.on("connection", (ws, req) => {
  // Store the path in the WebSocket object for later reference
  ws.path = req.url;

  let detectPunch = classifiedPunchDetector(websocketsServer);
  let debug = throttledDebug(websocketsServer);

  // The phone sends sensor data here
  if (req.url === "/ws/data-input") {
    // Data input handling
    ws.on("message", (message) => {
      try {
        const sensorData = extractSensorData(JSON.parse(message.toString()));

        if (!sensorData) {
          return;
        }

        // Log the absolute flag for orientation data
        if (
          sensorData.type === "orientation" &&
          sensorData.orientation.absolute !== undefined
        ) {
          console.log(
            `Orientation absolute flag: ${sensorData.orientation.absolute}`,
          );
        }

        // Send data immediately without throttling
        debug(sensorData);
        detectPunch(sensorData);
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });
  } // Debug interface
  else if (req.url === "/ws/debug") {
    // Send current configuration to the newly connected client
    ws.send(JSON.stringify({
      type: "system",
      message: "Current punch configuration",
      punchConfig: config.punch,
    }));

    // Handle configuration messages from the debug interface
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Handle configuration updates
        if (data.type === "config" && data.punchConfig) {
          // Update the global config through the singleton
          updateConfig({ punch: data.punchConfig });

          console.log("Updated punch configuration:", config.punch);

          // Re-initialize the punch detector with new configuration
          detectPunch = classifiedPunchDetector(websocketsServer);

          // Send confirmation back to all debug clients
          sendToClients(websocketsServer, "/ws/debug", {
            type: "system",
            message: "Punch configuration updated",
            punchConfig: config.punch,
          });
        } else if (data.type === "getConfig") {
          // Send current configuration to the client that requested it
          ws.send(JSON.stringify({
            type: "system",
            message: "Current punch configuration",
            punchConfig: config.punch,
          }));
        }
      } catch (error) {
        console.error("Error processing debug WebSocket message:", error);
      }
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
