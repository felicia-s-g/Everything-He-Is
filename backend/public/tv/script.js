let images = [];
let selectedIndex = 0;
const imageList = document.getElementById("image-list");
let isAutoScrolling = false; // Flag to track if auto-scrolling is in progress
let wsConnection = null; // WebSocket connection
let lastPunchTime = 0; // Track the last punch time
let PUNCH_COOLDOWN_MS = 300; // Shorter cooldown period between punches for more responsiveness
const imageContainer = document.getElementById("image-container"); // Make this global
let currentRotation = 0; // Track the current rotation in degrees

// Add global config object with default values
let config = {
  punch: {
    weakThreshold: 3,
    normalThreshold: 6,
    strongThreshold: 15,
    coolDown: 100,
    maxValue: 40,
    minThreshold: 2,
    photoScroll: {
      baseMultiplier: 1.0,
      scalingFactor: 0.2,
      maxPhotos: 10,
    },
    accelWeights: {
      x: 1.0,
      y: 1.0,
      z: 1.0,
    },
    directionFilter: {
      enabled: true,
      tolerance: 45,
      direction: "positive-x",
    },
  },
};

// Add sync state variables
let syncState = {
  clientId: null,
  lastSyncTime: 0,
  syncInterval: 2000, // Sync every 2 seconds
  forceSyncInterval: 10000, // Force full sync every 10 seconds
  isSyncing: false,
  isLeader: false,
};

// Add function to get seed from URL or generate a random one
function getSeedFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  let seed = urlParams.get("seed");

  // If no seed provided in URL, generate one and update URL
  if (!seed) {
    seed = Math.floor(Math.random() * 1000000).toString();
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("seed", seed);
    window.history.replaceState({}, "", newUrl);
  }

  console.log(`Using seed: ${seed} for image shuffling`);
  return seed;
}

// Add seeded random number generator
function seededRandom(seed) {
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  let z = seed;

  return function () {
    z = (a * z + c) % m;
    return z / m;
  };
}

function nextImage(dynamicTimeout = 350) {
  console.log("nextImage called, current index:", selectedIndex);
  let currentImage = document.querySelectorAll(".image-slide")[selectedIndex];

  if (!currentImage) {
    console.error("Current image element not found!");
    return;
  }

  // Save current transform state if it exists - this preserves the zoom level
  const currentTransform = currentImage.style.transform || "scale(1)";
  console.log("Current image transform:", currentTransform);

  // Add flying away class while keeping current transform as starting point
  currentImage.style.transform = currentTransform;
  currentImage.classList.add("flying-away");
  console.log("Added flying-away class to current image");

  // Calculate the next image index BEFORE the timeout
  const nextIndex = (selectedIndex + 1) % images.length;

  // Make sure the next image is ready before transitioning
  const nextImage = document.querySelectorAll(".image-slide")[nextIndex];
  if (nextImage) {
    // Prepare next image but keep it invisible until the transition
    nextImage.style.display = "block";
    nextImage.style.opacity = "0";

    // If the next image already has a zoom factor, preserve it
    // Otherwise start with default scale of 1
    if (nextImage.dataset.currentZoom) {
      nextImage.style.transform = `scale(${nextImage.dataset.currentZoom})`;
    } else {
      nextImage.style.transform = "scale(1)";
      nextImage.dataset.currentZoom = "1";
    }
  }

  setTimeout(() => {
    const oldIndex = selectedIndex;
    selectedIndex = nextIndex;
    console.log(`Changing from index ${oldIndex} to ${selectedIndex}`);

    // Update URL with the new index
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("index", selectedIndex.toString());
    window.history.replaceState({}, "", newUrl);

    let next = document.querySelectorAll(".image-slide")[selectedIndex];
    if (!next) {
      console.error("Next image element not found!");
      return;
    }

    // Fade in the next image
    next.style.opacity = "1";
    console.log("Made next image visible");

    // Hide the previous image only AFTER the next one is visible
    setTimeout(() => {
      currentImage.style.display = "none";
      console.log("Hidden previous image");
    }, 50); // Short delay to ensure smooth transition
  }, dynamicTimeout);
}

// Initialize WebSocket connections
function initWebSocket() {
  // Close any existing connections
  if (wsConnection) {
    wsConnection.close();
  }

  // Create a WebSocket connection to debug endpoint for orientation data
  const wsDebugUrl = `wss://${window.location.host}/ws/debug`;
  wsConnection = new WebSocket(wsDebugUrl);

  // Generate a unique client ID if we don't have one yet
  if (!syncState.clientId) {
    syncState.clientId = Date.now().toString(36) +
      Math.random().toString(36).substring(2);
    console.log(`Generated client ID: ${syncState.clientId}`);
  }

  // Connection opened
  wsConnection.addEventListener("open", (event) => {
    console.log("Connected to debug WebSocket");

    // Start state synchronization when websocket is connected
    initStateSync();
  });

  // Listen for messages
  wsConnection.addEventListener("message", (event) => {
    console.log("Debug WebSocket message received");
    handleWebSocketMessage(event);
  });

  // Connection closed
  wsConnection.addEventListener("close", (event) => {
    console.log("Debug WebSocket connection closed");
    // Attempt to reconnect after 5 seconds
    setTimeout(initWebSocket, 5000);
  });

  // Connection error
  wsConnection.addEventListener("error", (event) => {
    console.error("WebSocket error:", event);
  });

  // Create a second WebSocket connection to ui-signals endpoint for punch data
  const wsUiUrl = `wss://${window.location.host}/ws/ui-signals`;
  const uiSignalsWs = new WebSocket(wsUiUrl);
  window.uiSignalsWs = uiSignalsWs; // Store globally for debugging

  // Connection opened for UI signals
  uiSignalsWs.addEventListener("open", (event) => {
    console.log("Connected to ui-signals WebSocket");
  });

  // Listen for punch messages from UI signals
  uiSignalsWs.addEventListener("message", (event) => {
    console.log("UI signals WebSocket message received:", event.data);
    try {
      const data = JSON.parse(event.data);

      // Handle punch data from ui-signals
      if (data.type === "punch") {
        console.log("Punch event from ui-signals:", data);
        // Pass the complete data object to handlePunch for more flexibility
        handlePunch(data);
      }

      // Handle sync messages
      if (data.type === "sync") {
        handleSyncMessage(data);
      }
    } catch (error) {
      console.error("Error processing UI WebSocket message:", error);
    }
  });

  // Add error and close listeners for UI signals WebSocket
  uiSignalsWs.addEventListener("error", (event) => {
    console.error("UI signals WebSocket error:", event);
  });

  uiSignalsWs.addEventListener("close", (event) => {
    console.log("UI signals WebSocket connection closed");
    // Reconnect UI signals WebSocket after 5 seconds
    setTimeout(() => {
      console.log("Attempting to reconnect ui-signals WebSocket");
      const reconnectUrl = `wss://${window.location.host}/ws/ui-signals`;
      window.uiSignalsWs = new WebSocket(reconnectUrl);
      // Re-attach all event listeners
      window.uiSignalsWs.addEventListener("open", (event) => {
        console.log("Reconnected to ui-signals WebSocket");
        // Restart sync when reconnected
        initStateSync();
      });
      window.uiSignalsWs.addEventListener("message", (event) => {
        console.log(
          "UI signals WebSocket message received after reconnect:",
          event.data,
        );
        try {
          const data = JSON.parse(event.data);
          if (data.type === "punch") {
            console.log("Punch event from ui-signals after reconnect:", data);
            handlePunch(data);
          }
          if (data.type === "sync") {
            handleSyncMessage(data);
          }
        } catch (error) {
          console.error(
            "Error processing UI WebSocket message after reconnect:",
            error,
          );
        }
      });
    }, 5000);
  });
}

// Fetch images from the API endpoint
async function fetchImages() {
  try {
    console.log("Fetching images from API...");
    const response = await fetch("/api/images");
    if (!response.ok) {
      throw new Error(
        `Failed to fetch images: ${response.status} ${response.statusText}`,
      );
    }

    const imageData = await response.json();
    console.log("Raw image data received:", imageData.length, "images");

    if (!imageData || !Array.isArray(imageData) || imageData.length === 0) {
      console.error("No images received from API");
      return;
    }

    images = imageData.map((img) => img.url);

    console.log("Processed images:", images.length);
    console.log("First few images:", images.slice(0, 3));

    // Get seed from URL or create one
    const seed = parseInt(getSeedFromURL(), 10);

    // Use seeded random generator for consistent shuffling across devices
    const random = seededRandom(seed);

    // Fisher-Yates shuffle with seeded random
    for (let i = images.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [images[i], images[j]] = [images[j], images[i]];
    }

    // Attempt to restore selected index from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const indexParam = urlParams.get("index");
    if (indexParam !== null && !isNaN(parseInt(indexParam))) {
      const parsedIndex = parseInt(indexParam);
      if (parsedIndex >= 0 && parsedIndex < images.length) {
        selectedIndex = parsedIndex;
        console.log(`Restored selectedIndex from URL: ${selectedIndex}`);
      }
    }

    localStorage.setItem("shuffledImages", JSON.stringify(images));
    localStorage.setItem("imageSeed", seed.toString());
    console.log("Loading images into DOM...");
    loadImages();
    console.log("Images loaded successfully");
  } catch (error) {
    console.error("Error fetching images:", error);
  }
}

// Function to load images into the DOM
function loadImages() {
  if (!imageContainer) {
    console.error("Cannot load images - image container not found");
    return;
  }

  imageContainer.innerHTML = ""; // Clear container before loading new images
  console.log(`Loading ${images.length} images into the DOM`);

  if (images.length === 0) {
    console.error("No images to load");
    return;
  }

  images.forEach((src, index) => {
    let img = document.createElement("img");
    img.src = src;
    img.classList.add("image-slide");
    img.alt = `Image ${index + 1}`;

    // Set initial styles with faster transitions for better performance
    img.style.transition = "transform 0.15s ease-out, opacity 0.3s ease-out";
    img.style.transformOrigin = "center center";
    img.dataset.currentZoom = "1"; // Initialize zoom value for all images

    if (index === 0) {
      // First image is visible
      img.style.transform = "scale(1)";
      img.style.opacity = "1";
      img.style.display = "block";
    } else {
      // Other images are hidden
      img.style.opacity = "0";
      img.style.display = "none";
      img.style.transform = "scale(1)"; // Initialize with normal scale
    }

    // Add a load event handler to ensure images are properly loaded
    img.onload = function () {
      console.log(`Image ${index + 1} loaded successfully`);
      // Make first image visible once loaded
      if (index === 0) {
        img.style.opacity = "1";
      }
    };

    // Add an error handler
    img.onerror = function () {
      console.error(`Failed to load image at index ${index}: ${src}`);
      // Replace with a placeholder if the image fails to load
      img.src =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%23cccccc'/%3E%3Ctext x='150' y='100' font-family='Arial' font-size='16' text-anchor='middle' fill='%23999999'%3EImage not found%3C/text%3E%3C/svg%3E";
    };

    imageContainer.appendChild(img);
  });

  console.log(
    `${images.length} images loaded into DOM with index ${selectedIndex} visible`,
  );
}

// Function to update which image is selected without rebuilding the entire list
function updateSelectedImage(newIndex) {
  // Remove selected class from all images
  document.querySelectorAll(".preview-image").forEach((img) => {
    img.classList.remove("selected");
  });

  // Add selected class to the new selected image
  const newSelectedImage = document.getElementById(`image-${newIndex}`);
  if (newSelectedImage) {
    newSelectedImage.classList.add("selected");
    selectedIndex = newIndex;

    // Store the selected index in localStorage
    localStorage.setItem("selectedIndex", selectedIndex);

    // Update URL with current index for sharing/syncing
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("index", selectedIndex.toString());
    window.history.replaceState({}, "", newUrl);

    // Broadcast state change to other clients
    broadcastStateUpdate();

    window.dispatchEvent(new Event("storage"));
  }
}

// Setup scroll event listener to detect which image is in view
function setupScrollListener() {
  const container = document.getElementById("preview-container");

  container.addEventListener("scroll", () => {
    // Skip if auto-scrolling is in progress to avoid interference
    if (isAutoScrolling) return;

    // Find which image is most centered in the viewport
    const containerHeight = container.clientHeight;
    const containerCenter = container.scrollTop + (containerHeight / 2);

    let closestImage = null;
    let closestDistance = Infinity;

    document.querySelectorAll(".preview-image").forEach((img) => {
      const imgCenter = img.offsetTop + (img.clientHeight / 2);
      const distance = Math.abs(containerCenter - imgCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestImage = img;
      }
    });

    if (
      closestImage && parseInt(closestImage.dataset.index) !== selectedIndex
    ) {
      updateSelectedImage(parseInt(closestImage.dataset.index));
    }
  }, { passive: true }); // Use passive listener for better scroll performance
}

// Function to scroll forward based on punch intensity
function forceBasedScroll(acceleration) {
  console.log("forceBasedScroll called with acceleration:", acceleration);

  // Verify we have a valid image container
  if (!imageContainer) {
    console.error("Image container not found, cannot scroll");
    return;
  }

  // Check if we have images loaded
  console.log(
    "Current images array:",
    images.length ? `${images.length} images` : "empty",
  );

  // Check if we have images and apply cooldown
  if (!images.length) {
    console.warn("No images available, skipping punch processing");
    return;
  }

  // Check if the image elements actually exist in the DOM
  const imageElements = document.querySelectorAll(".image-slide");
  if (imageElements.length === 0) {
    console.error("No image elements found in the DOM");
    return;
  }

  // Verify current image is actually visible
  const currentImage = imageElements[selectedIndex];
  if (!currentImage) {
    console.error(`Current image at index ${selectedIndex} not found`);
    return;
  }

  // Apply cooldown to prevent too many rapid transitions
  const now = Date.now();
  if (now - lastPunchTime < PUNCH_COOLDOWN_MS) {
    console.log(
      `Cooldown active, skipping (last punch: ${now - lastPunchTime}ms ago)`,
    );
    return;
  }
  lastPunchTime = now;

  // Use configuration values instead of hardcoded values
  const minAcceleration = config.punch.weakThreshold || 3;
  const maxAcceleration = config.punch.maxValue || 40;

  if (acceleration < minAcceleration) {
    console.log(
      `Punch too weak (${acceleration} < ${minAcceleration}), ignoring`,
    );
    return;
  } // Ignore very weak movements

  // Linear mapping from acceleration to normalized strength (0.0 to 1.0)
  const normalizedStrength = Math.min(
    (acceleration - minAcceleration) / (maxAcceleration - minAcceleration),
    1.0,
  );

  // Apply photo scrolling configuration
  const baseMultiplier = config.punch.photoScroll?.baseMultiplier || 1.0;
  const scalingFactor = config.punch.photoScroll?.scalingFactor || 0.2;
  const maxPhotos = config.punch.photoScroll?.maxPhotos || 10;

  // Calculate number of photos to scroll based on punch strength
  // using the same formula as in the debug UI
  let imagesToScroll = Math.min(
    Math.round(baseMultiplier * (1 + (acceleration * scalingFactor))),
    maxPhotos,
  );

  // Ensure at least one photo is scrolled
  imagesToScroll = Math.max(1, imagesToScroll);

  console.log(
    `Processing punch: strength=${
      acceleration.toFixed(2)
    }, scrolling ${imagesToScroll} photos`,
    {
      minAccel: minAcceleration,
      maxAccel: maxAcceleration,
      baseMultiplier,
      scalingFactor,
      maxPhotos,
    },
  );

  // Scroll the calculated number of photos
  advancePhotos(imagesToScroll);

  // Return value to aid in console debugging
  return {
    status: "success",
    strength: acceleration,
    imagesToScroll,
    previousImage: selectedIndex,
    nextImage: (selectedIndex + imagesToScroll) % images.length,
  };
}

// Function to zoom/enlarge images based on beta rotation
function tiltBasedZoom(betaRotation) {
  // Skip if no images
  if (!images.length) return;

  console.log("Beta rotation zoom:", betaRotation);

  // Ensure beta rotation is a number and has a reasonable value
  const beta = typeof betaRotation === "number"
    ? betaRotation
    : parseFloat(betaRotation);
  if (isNaN(beta)) return;

  // neutral zoom is at beta 180 degrees
  // zoom at 100 degrees is 2.0
  // zoom at 0 degrees is 0.5
  let zoomFactor;

  if (beta <= 90) {
    // For 0-90 degrees, map from 0.75 to 1.0
    zoomFactor = 0.75 + (beta / 90 * 0.25);
  } else {
    // For 90-180 degrees, map from 1.0 to 1.5
    zoomFactor = 1.0 + ((beta - 90) / 90 * 0.5);
  }

  // Apply zoom to the currently selected image
  const currentImage = document.querySelectorAll(".image-slide")[selectedIndex];
  if (currentImage) {
    // Apply responsive transition
    currentImage.style.transition = "transform 0.15s ease-out";

    // Apply zoom centered on the image
    currentImage.style.transform = `scale(${zoomFactor})`;

    // Store the current zoom value for potential use elsewhere
    currentImage.dataset.currentZoom = zoomFactor;
  }
}

function getAccelerationMagnitude(accelerationData) {
  // Extract X, Y, Z components
  const { x, y, z } = accelerationData;

  // Calculate the magnitude using the Euclidean norm (sqrt(x² + y² + z²))
  // This gives us the total acceleration regardless of direction
  const magnitude = Math.sqrt(x * x + y * y + z * z);

  return magnitude;
}

function getHighestAcceleration(accelerationDataArray) {
  // If no data is provided, return 0
  if (!accelerationDataArray || accelerationDataArray.length === 0) {
    return 0;
  }

  // Calculate magnitude for each data point
  const magnitudes = accelerationDataArray.map(getAccelerationMagnitude);

  // Return the highest acceleration value
  return Math.max(...magnitudes);
}

// Add this function to scroll forward by a specified number of photos
function advancePhotos(count = 1) {
  if (!images.length) return;

  // Set flag to prevent interference with scroll detection
  // but allow zoom to continue working
  isAutoScrolling = true;

  // Call nextImage for each photo we want to advance through
  let remainingPhotos = count;

  // Function to handle sequential transitions
  function advanceNext() {
    if (remainingPhotos <= 0) {
      // We're done with all transitions
      isAutoScrolling = false;
      return;
    }

    // Calculate dynamic timeout - faster for multiple images
    const transitionSpeed = Math.max(150, 350 - (count * 30));

    // Trigger the image transition with appropriate speed
    nextImage(transitionSpeed);

    // Decrement counter and set up next transition
    remainingPhotos--;
    setTimeout(advanceNext, transitionSpeed + 50);
  }

  // Start the sequence
  advanceNext();

  // Add this at the beginning of the advancePhotos function
  console.log(
    `advancePhotos called with count=${count}, currentIndex=${selectedIndex}, images.length=${images.length}`,
  );
}

// Ensure imageContainer is properly initialized when page loads
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded");

  // Check if imageContainer was found
  if (!imageContainer) {
    console.error(
      "Image container not found on initial load, attempting to get it again",
    );
    // Try to get it again now that DOM is fully loaded
    const container = document.getElementById("image-container");
    if (container) {
      // If found now, assign it to the global variable
      window.imageContainer = container;
      console.log("Image container found and assigned");
    } else {
      console.error(
        "Image container element still not found. Check your HTML!",
      );
    }
  } else {
    console.log("Image container already available:", imageContainer);
  }

  // Fetch configuration before initializing WebSocket
  fetchConfiguration();

  // Initialize WebSocket after a short delay to allow config to load
  setTimeout(initWebSocket, 500);

  // Start loading images
  fetchImages();

  // Setup URL parameter change listener for syncing
  setupURLChangeListener();

  // Refresh configuration periodically (every 5 minutes)
  setInterval(fetchConfiguration, 5 * 60 * 1000);

  // Setup click event listener
  document.removeEventListener("click", nextImage); // Remove old listener to avoid duplicates
  document.addEventListener("click", (event) => {
    console.log("Click detected");
    nextImage();
  });

  // Setup keyboard navigation
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") nextImage();
  });

  // Initialize the rotation button functionality
  initRotationButton();

  // Initialize visual sync indicator
  initSyncIndicator();
});

// Replace the stub function with a proper implementation
function fetchConfiguration() {
  fetch("/api/config")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch configuration");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Configuration loaded from server:", data);

      // Update the global config object
      if (data && data.punch) {
        // Deep merge to preserve any fields not returned by the server
        config.punch = {
          ...config.punch,
          ...data.punch,
          // Make sure nested objects are properly merged
          photoScroll: {
            ...config.punch.photoScroll,
            ...(data.punch.photoScroll || {}),
          },
          accelWeights: {
            ...config.punch.accelWeights,
            ...(data.punch.accelWeights || {}),
          },
          directionFilter: {
            ...config.punch.directionFilter,
            ...(data.punch.directionFilter || {}),
          },
        };
      }

      // Update the PUNCH_COOLDOWN_MS variable if provided
      if (config.punch.coolDown) {
        PUNCH_COOLDOWN_MS = config.punch.coolDown;
      }

      console.log("Applied configuration:", config);
    })
    .catch((error) => {
      console.error("Error fetching configuration:", error);
      // Continue with default values if fetch fails
    });
}

// Handle punch messages from WebSocket
function handlePunch(punchData) {
  console.log("handlePunch called with:", punchData);

  let punchValue;

  // Check if punchData is a complete object (new format) or a simple value (old format)
  if (typeof punchData === "object" && punchData !== null) {
    // New format: extract the acceleration value
    if (punchData.acceleration !== undefined) {
      punchValue = punchData.acceleration;
    } else if (punchData.value !== undefined) {
      punchValue = punchData.value;
    } else if (punchData.punchStrength !== undefined) {
      punchValue = punchData.punchStrength;
    } else {
      // Try to find any property that might contain the punch value
      const possibleValues = ["strength", "force", "magnitude", "impact"];
      for (const key of possibleValues) {
        if (punchData[key] !== undefined) {
          punchValue = punchData[key];
          break;
        }
      }

      if (punchValue === undefined) {
        console.warn("Unable to extract punch value from data:", punchData);
        return;
      }
    }
    console.log("Extracted punch value from object:", punchValue);
  } else {
    // Old format or direct value passed
    punchValue = punchData;
  }

  // Make sure the punch value is a number
  const acceleration = typeof punchValue === "number"
    ? punchValue
    : parseFloat(punchValue);

  // Skip if not a valid number
  if (isNaN(acceleration)) {
    console.warn("Invalid punch value received:", punchValue);
    return;
  }

  console.log("Punch received with acceleration:", acceleration);

  // Call the existing forceBasedScroll function with the acceleration value
  forceBasedScroll(acceleration);
}

// Handle WebSocket messages
function handleWebSocketMessage(event) {
  try {
    const data = JSON.parse(event.data);

    // Handle different message types
    if (data.type === "punch") {
      handlePunch(data);
    } else if (data.type === "acceleration" || data.type === "accel") {
      // Handle acceleration data that may also indicate a punch
      if (data.acceleration) {
        handlePunch(data);
      }
    } else if (data.type === "orientation") {
      // Extract beta/y rotation from orientation data
      // In device orientation, beta is the front-to-back tilt (y-axis)
      const beta = data.orientation.y;

      // Use beta rotation for zoom effect
      tiltBasedZoom(beta);
    } else if (data.type === "deviceOrientation") {
      // Extract beta rotation (front-to-back tilt)
      // Some systems use different property names
      const beta = data.orientation.beta || data.orientation.y;

      // Use beta rotation for zoom effect
      tiltBasedZoom(beta);
    } else if (data.type === "tilt") {
      // For backward compatibility, if any code still sends generic tilt values
      tiltBasedZoom(data.value * 180); // Scale to beta-equivalent range
    }
  } catch (error) {
    console.error("Error parsing WebSocket message:", error);
  }
}

// Add this function to the end of your script
function testScroll(count = 1) {
  console.log("Testing scroll with count:", count);
  console.log("Current images array length:", images.length);
  console.log("Current selected index:", selectedIndex);

  if (images.length > 0) {
    console.log("Attempting to advance photos...");
    advancePhotos(count);
  } else {
    console.log("No images loaded, can't scroll");
  }
}

// Make it globally accessible
window.testScroll = testScroll;

// Test function to simulate a punch - can be called from console
function testPunch(strength = 10) {
  console.log(`Testing punch with strength ${strength}`);

  // Create a test punch data object that mimics the data from the WebSocket
  const testPunchData = {
    type: "punch",
    timestamp: Date.now(),
    acceleration: strength,
    value: strength, // Include both formats for testing
  };

  // Process the test punch
  handlePunch(testPunchData);

  // Return a helper message for the console
  return `Sent test punch with strength ${strength}. Try different values like: testPunch(5), testPunch(15), testPunch(25)`;
}

// Make it globally accessible for console testing
window.testPunch = testPunch;

// Add function to handle URL parameter changes
function setupURLChangeListener() {
  // Listen for changes to the URL (like when someone pastes a new URL with different params)
  window.addEventListener("popstate", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const indexParam = urlParams.get("index");

    if (indexParam !== null && !isNaN(parseInt(indexParam))) {
      const newIndex = parseInt(indexParam);
      if (
        newIndex >= 0 && newIndex < images.length && newIndex !== selectedIndex
      ) {
        console.log(`URL index changed to ${newIndex}, updating display`);
        selectedIndex = newIndex;
        updatePreview();

        // Make the current image visible and hide others
        document.querySelectorAll(".image-slide").forEach((img, idx) => {
          if (idx === selectedIndex) {
            img.style.opacity = "1";
            img.style.display = "block";
          } else {
            img.style.opacity = "0";
            img.style.display = "none";
          }
        });
      }
    }
  });
}

// Initialize the rotation button functionality
function initRotationButton() {
  const rotateButton = document.getElementById("rotate-button");
  if (rotateButton) {
    rotateButton.addEventListener("click", rotateUI);

    // Detect mouse movement to show/hide the button
    document.addEventListener("mousemove", (event) => {
      // Define the detection area (bottom right corner)
      const showAreaSize = 150; // Size of the detection area in pixels
      const isInBottomRightCorner =
        event.clientX > window.innerWidth - showAreaSize &&
        event.clientY > window.innerHeight - showAreaSize;

      // Add or remove the 'visible' class based on mouse position
      if (isInBottomRightCorner) {
        rotateButton.classList.add("visible");
      } else {
        rotateButton.classList.remove("visible");
      }
    });

    // Hide the button when mouse leaves the window
    document.addEventListener("mouseleave", () => {
      rotateButton.classList.remove("visible");
    });
  }

  // Add resize event handler to update positioning when status bar changes
  window.addEventListener("resize", () => {
    // Only update if we're in portrait mode (90° or 270°)
    if (currentRotation === 90 || currentRotation === 270) {
      updateRotationPosition();
    }
  });
}

// Handle UI rotation in 90-degree increments
function rotateUI() {
  currentRotation = (currentRotation + 90) % 360;

  // Apply rotation to the container
  // We use a separate CSS custom property for rotation to avoid conflicts with other transforms
  document.documentElement.style.setProperty(
    "--ui-rotation",
    `${currentRotation}deg`,
  );
  imageContainer.style.transform = `rotate(var(--ui-rotation))`;

  // Update position and dimensions based on orientation
  updateRotationPosition();

  // Update rotation button text based on current rotation
  const rotateButton = document.getElementById("rotate-button");
  if (rotateButton) {
    rotateButton.textContent = "↻";
    // Optionally add a data attribute for rotation state
    rotateButton.setAttribute("data-rotation", currentRotation.toString());
  }
}

// Separate function to update position based on current rotation and window size
function updateRotationPosition() {
  const isPortrait = currentRotation === 90 || currentRotation === 270;

  if (isPortrait) {
    // In portrait mode (rotated 90 or 270 degrees)
    imageContainer.style.width = "100vh";
    imageContainer.style.height = "100vw";

    // Center the container
    imageContainer.style.position = "absolute";
    imageContainer.style.top = `${
      (window.innerHeight - window.innerWidth) / 2
    }px`;
    imageContainer.style.left = `${
      (window.innerWidth - window.innerHeight) / 2
    }px`;
  } else {
    // In landscape mode (0 or 180 degrees)
    imageContainer.style.width = "100vw";
    imageContainer.style.height = "100vh";
    imageContainer.style.top = "0";
    imageContainer.style.left = "0";
  }
}

// Add function for state synchronization
function initStateSync() {
  // Clear any existing sync intervals
  if (window.syncIntervalId) {
    clearInterval(window.syncIntervalId);
  }

  // Set up periodic sync
  window.syncIntervalId = setInterval(() => {
    // Only send sync messages if we have images loaded
    if (
      images.length > 0 && window.uiSignalsWs &&
      window.uiSignalsWs.readyState === WebSocket.OPEN
    ) {
      // Every forceSyncInterval, do a full state sync
      const now = Date.now();
      if (now - syncState.lastSyncTime > syncState.forceSyncInterval) {
        sendFullStateSync();
      } else {
        // Otherwise just send a heartbeat with current state
        broadcastStateUpdate();
      }
    }
  }, syncState.syncInterval);

  // Initialize with a full sync request
  setTimeout(sendFullStateSync, 500);
}

// Function to send full state sync
function sendFullStateSync() {
  if (!window.uiSignalsWs || window.uiSignalsWs.readyState !== WebSocket.OPEN) {
    return;
  }

  syncState.lastSyncTime = Date.now();

  const syncMessage = {
    type: "sync",
    action: "fullSync",
    clientId: syncState.clientId,
    timestamp: Date.now(),
    data: {
      selectedIndex,
      seed: getSeedFromURL(),
      totalImages: images.length,
    },
  };

  window.uiSignalsWs.send(JSON.stringify(syncMessage));
  console.log("Sent full sync request:", syncMessage);
}

// Function to broadcast state updates
function broadcastStateUpdate() {
  if (!window.uiSignalsWs || window.uiSignalsWs.readyState !== WebSocket.OPEN) {
    return;
  }

  const stateMessage = {
    type: "sync",
    action: "update",
    clientId: syncState.clientId,
    timestamp: Date.now(),
    data: {
      selectedIndex,
      seed: getSeedFromURL(),
    },
  };

  window.uiSignalsWs.send(JSON.stringify(stateMessage));
  console.log("Broadcast state update:", stateMessage);
}

// Function to handle incoming sync messages
function handleSyncMessage(message) {
  if (message.clientId === syncState.clientId) {
    // Ignore our own messages
    return;
  }

  console.log("Received sync message:", message);

  if (message.action === "fullSync" || message.action === "update") {
    // Check if the message is newer than our last sync
    if (message.timestamp > syncState.lastSyncTime) {
      syncState.lastSyncTime = message.timestamp;

      // Update our state to match the incoming message
      if (
        message.data.selectedIndex !== undefined &&
        message.data.selectedIndex !== selectedIndex &&
        message.data.selectedIndex >= 0 &&
        message.data.selectedIndex < images.length
      ) {
        console.log(
          `Syncing index from ${selectedIndex} to ${message.data.selectedIndex}`,
        );

        // Update the selected index without triggering another broadcast
        selectedIndex = message.data.selectedIndex;

        // Update the UI to reflect the new state
        document.querySelectorAll(".image-slide").forEach((img, idx) => {
          if (idx === selectedIndex) {
            img.style.opacity = "1";
            img.style.display = "block";
          } else {
            img.style.opacity = "0";
            img.style.display = "none";
          }
        });

        // Update URL without broadcasting (to avoid sync loops)
        const newUrl = new URL(window.location);
        newUrl.searchParams.set("index", selectedIndex.toString());
        window.history.replaceState({}, "", newUrl);
      }
    }
  }
}

// Add a visual sync indicator
function initSyncIndicator() {
  // Create sync indicator element
  const syncIndicator = document.createElement("div");
  syncIndicator.id = "sync-indicator";
  syncIndicator.style.position = "fixed";
  syncIndicator.style.bottom = "10px";
  syncIndicator.style.left = "10px";
  syncIndicator.style.width = "10px";
  syncIndicator.style.height = "10px";
  syncIndicator.style.borderRadius = "50%";
  syncIndicator.style.backgroundColor = "#ccc";
  syncIndicator.style.opacity = "0.5";
  syncIndicator.style.transition = "all 0.3s ease";
  document.body.appendChild(syncIndicator);

  // Update indicator when sync occurs
  const updateSyncIndicator = (status) => {
    const indicator = document.getElementById("sync-indicator");
    if (!indicator) return;

    if (status === "syncing") {
      indicator.style.backgroundColor = "yellow";
      indicator.style.opacity = "0.8";

      // Restore to normal after brief delay
      setTimeout(() => {
        indicator.style.backgroundColor = "#0f0";
        indicator.style.opacity = "0.5";
      }, 300);
    } else if (status === "success") {
      indicator.style.backgroundColor = "#0f0";
      indicator.style.opacity = "0.5";
    } else if (status === "error") {
      indicator.style.backgroundColor = "red";
      indicator.style.opacity = "0.8";
    }
  };

  // Store the function globally
  window.updateSyncIndicator = updateSyncIndicator;

  // Update indicator status on sync events
  const originalBroadcastStateUpdate = broadcastStateUpdate;
  window.broadcastStateUpdate = function () {
    updateSyncIndicator("syncing");
    originalBroadcastStateUpdate();
  };

  // Override the sync handler to update the indicator
  const originalHandleSyncMessage = handleSyncMessage;
  window.handleSyncMessage = function (message) {
    updateSyncIndicator("syncing");
    originalHandleSyncMessage(message);
    updateSyncIndicator("success");
  };
}
