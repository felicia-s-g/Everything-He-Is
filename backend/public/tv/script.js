let images = [];
let selectedIndex = 0;
const imageList = document.getElementById("image-list");
let isAutoScrolling = false; // Flag to track if auto-scrolling is in progress
let wsConnection = null; // WebSocket connection
let lastPunchTime = 0; // Track the last punch time
let PUNCH_COOLDOWN_MS = 300; // Shorter cooldown period between punches for more responsiveness
const imageContainer = document.getElementById("image-container"); // Make this global
let currentRotation = 0; // Track the current rotation in degrees
let skewAmount = 0; // Default to no skew
let perspectiveAmount = 1000; // Default perspective depth
let rotateXAmount = 0; // Default X rotation for 3D effect

// Source ID tracking
const sourceIds = new Set();
let currentSourceId = "all";

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
      baseMultiplier: 1.5,
      scalingFactor: 0.4,
      maxPhotos: 15,
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

// Simplified sync state - just tracks the server's counter
let syncState = {
  syncCounter: null,
  lastSyncTime: 0,
  syncInterval: 2000, // Add default sync intervals
  forceSyncInterval: 10000,
};

// Get the seed value from the server's sync counter or URL parameters
function getSeed() {
  // Fallback to URL parameters if no server counter
  const urlParams = new URLSearchParams(window.location.search);
  let seed = urlParams.get("seed");

  // If no seed provided in URL, generate one
  if (!seed) {
    // If we have a server-provided counter, use that
    if (syncState.syncCounter !== null) {
      console.log(
        `Using server sync counter as seed: ${syncState.syncCounter}`,
      );
      seed = syncState.syncCounter;
    } else {
      // Generate a random seed
      seed = Math.floor(Math.random() * 1000000).toString();
      console.log(`Generated random seed: ${seed}`);
    }
  } else {
    console.log(`Using URL seed: ${seed}`);
  }

  // Get skew parameter if available - this controls the horizontal skew effect
  const skewParam = urlParams.get("skew");
  if (skewParam !== null && !isNaN(parseFloat(skewParam))) {
    skewAmount = parseFloat(skewParam);
    console.log(`Using skew amount: ${skewAmount} for 3D effect`);
  }

  // Get perspective depth parameter if available
  const perspectiveParam = urlParams.get("perspective");
  if (perspectiveParam !== null && !isNaN(parseFloat(perspectiveParam))) {
    perspectiveAmount = parseFloat(perspectiveParam);
    console.log(`Using perspective depth: ${perspectiveAmount}px`);
  }

  // Get X rotation parameter if available
  const rotateXParam = urlParams.get("rotateX");
  if (rotateXParam !== null && !isNaN(parseFloat(rotateXParam))) {
    rotateXAmount = parseFloat(rotateXParam);
    console.log(`Using X rotation: ${rotateXAmount}deg`);
  }

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

// Initialize the source ID selector
function initSourceIdSelector() {
  const sourceIdSelector = document.getElementById("source-id-selector");
  if (!sourceIdSelector) return;

  sourceIdSelector.addEventListener("change", function () {
    currentSourceId = this.value;
    console.log(
      `Filtering to source ID: ${
        currentSourceId === "all" ? "All Sources" : currentSourceId
      }`,
    );
  });
}

// Update the source ID dropdown with new IDs
function updateSourceIdDropdown() {
  const sourceIdSelector = document.getElementById("source-id-selector");
  if (!sourceIdSelector) return;

  // Preserve the current selection if possible
  const currentSelection = sourceIdSelector.value;

  // Clear and add the "All Sources" and "Unclassified" options
  sourceIdSelector.innerHTML = `
    <option value="all">All Sources</option>
    <option value="unclassified">Unclassified</option>
  `;

  // Add all source IDs
  sourceIds.forEach((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    sourceIdSelector.appendChild(option);
  });

  // Try to restore the previous selection if it still exists
  if (sourceIdSelector.querySelector(`option[value="${currentSelection}"]`)) {
    sourceIdSelector.value = currentSelection;
  }
}

function nextImage(dynamicTimeout = 350) {
  console.log("nextImage called, current index:", selectedIndex);
  let currentImage = document.querySelectorAll(".image-slide")[selectedIndex];

  if (!currentImage) {
    console.error("Current image element not found!");
    return;
  }

  // Save current transform state if it exists - this preserves the zoom level and skew
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
      // Check if we have skew enabled
      if (skewAmount !== 0) {
        // Apply both zoom and skew for 3D effect
        const zoomFactor = nextImage.dataset.currentZoom;
        // Add subtle breathing animation
        const breathingAmplitude = 0.015;
        const breathingSpeed = 1.5; // Seconds per cycle
        const breathingOffset = Math.sin(Date.now() / (1000 * breathingSpeed)) *
          breathingAmplitude;

        // Get stored skew values or use defaults
        const storedSkew = nextImage.dataset.currentSkew || skewAmount;
        const storedRotateX = nextImage.dataset.currentRotateX || rotateXAmount;

        // Apply full 3D transform preserving any existing effects
        nextImage.style.transform = `perspective(${perspectiveAmount}px) 
           rotateY(${storedSkew}deg) 
           rotateX(${storedRotateX}deg)
           translate3d(0, 0, ${breathingOffset * 10}px)
           scale3d(${zoomFactor + breathingOffset}, ${
          zoomFactor + breathingOffset
        }, 1)`;
      } else {
        // Apply simple zoom with subtle breathing
        const zoomFactor = nextImage.dataset.currentZoom;
        const breathingOffset = Math.sin(Date.now() / (1000 * 1.5)) * 0.015;
        nextImage.style.transform = `scale(${zoomFactor + breathingOffset})`;
      }
    } else {
      // Apply default transform - either with or without skew
      if (skewAmount !== 0) {
        // Add subtle breathing animation even to default state
        const breathingOffset = Math.sin(Date.now() / (1000 * 1.5)) * 0.015;
        nextImage.style.transform = `perspective(${perspectiveAmount}px) 
           rotateY(${skewAmount}deg) 
           rotateX(${rotateXAmount}deg)
           translate3d(0, 0, ${breathingOffset * 10}px)
           scale3d(${1 + breathingOffset}, ${1 + breathingOffset}, 1)`;
      } else {
        // Simple scale with subtle breathing
        const breathingOffset = Math.sin(Date.now() / (1000 * 1.5)) * 0.015;
        nextImage.style.transform = `scale(${1 + breathingOffset})`;
      }
      nextImage.dataset.currentZoom = "1";
    }
  }

  // Use a shorter timeout for faster transitions
  const actualTimeout = Math.min(dynamicTimeout, 300);

  setTimeout(() => {
    const oldIndex = selectedIndex;
    selectedIndex = nextIndex;
    console.log(`Changing from index ${oldIndex} to ${selectedIndex}`);

    // No longer updating URL with index parameter

    let next = document.querySelectorAll(".image-slide")[selectedIndex];
    if (!next) {
      console.error("Next image element not found!");
      return;
    }

    // Show the next image (make it fully visible)
    next.style.opacity = "1";
    console.log("Made next image visible");

    // Hide the previous image only AFTER the next one is visible - use shorter delay for faster transitions
    setTimeout(() => {
      currentImage.style.display = "none";
      console.log("Hidden previous image");
    }, 30); // Shorter delay to ensure smoother transitions
  }, actualTimeout);
}

// Initialize WebSocket connections and set up counter refresh
function initWebSocket() {
  // Close any existing connections
  if (wsConnection) {
    wsConnection.close();
  }

  // Create a WebSocket connection to debug endpoint
  const wsDebugUrl = `wss://${window.location.host}/ws/debug`;
  const wsUrl = `wss://${window.location.host}/ws/ui-signals`;

  // First try connecting to the debug WebSocket
  wsConnection = new WebSocket(wsDebugUrl);

  // Connection opened
  wsConnection.addEventListener("open", (event) => {
    console.log("Connected to debug WebSocket");

    // Start periodic counter refresh
    startCounterRefresh();
  });

  // Listen for messages
  wsConnection.addEventListener("message", (event) => {
    console.log("Debug WebSocket message received");
    handleWebSocketMessage(event);
  });

  // Connection closed
  wsConnection.addEventListener("close", (event) => {
    console.log("Debug WebSocket connection closed");

    // Stop the counter refresh interval when connection is closed
    stopCounterRefresh();

    setTimeout(() => {
      console.log("Attempting to reconnect to debug WebSocket...");
      initWebSocket();
    }, 3000); // Try to reconnect after 3 seconds
  });

  // Also connect to the UI signals WebSocket
  window.uiSignalsWs = new WebSocket(wsUrl);

  window.uiSignalsWs.addEventListener("open", (event) => {
    console.log("Connected to UI signals WebSocket");
  });

  window.uiSignalsWs.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received UI signals message:", data);

      // Track source ID if present
      if (data.sourceId && data.sourceId !== "") {
        if (!sourceIds.has(data.sourceId)) {
          sourceIds.add(data.sourceId);
          updateSourceIdDropdown();
        }
      }

      // If the message contains a sync counter, update our sync state
      if (data.syncCounter !== undefined) {
        updateSyncCounter(data.syncCounter);
      }

      // Handle punch events
      if (data.type === "punch") {
        handlePunch(data);
      }
    } catch (error) {
      console.error("Error processing UI signals message:", error);
    }
  });

  window.uiSignalsWs.addEventListener("close", (event) => {
    console.log("UI signals WebSocket connection closed");
    setTimeout(() => {
      console.log("Attempting to reconnect to UI signals WebSocket...");
      // The main initWebSocket will handle reconnection of both
    }, 3000);
  });
}

// Fetch images from the API endpoint
async function fetchImages() {
  try {
    const response = await fetch("/api/images");
    if (!response.ok) {
      console.error("Error fetching images:", response.statusText);
      return;
    }

    const data = await response.json();
    console.log(`Fetched ${data.length} images`);

    // Store the original array
    const originalImages = data;

    // Try to fetch server-side sync counter BEFORE shuffling images
    if (syncState.syncCounter === null) {
      try {
        const counterResponse = await fetch("/api/sync-counter");
        if (counterResponse.ok) {
          const counterData = await counterResponse.json();
          if (counterData.counter !== undefined) {
            updateSyncCounter(counterData.counter);
          }
        }
      } catch (error) {
        console.error("Error fetching sync counter:", error);
      }
    }

    // Get the current seed for deterministic shuffling
    const seed = getSeed();
    console.log(`Using seed ${seed} for deterministic shuffling`);

    // Create a seeded random number generator
    const random = seededRandom(parseInt(seed));

    // Create a copy to shuffle
    images = [...originalImages];

    // Shuffle the array using Fisher-Yates algorithm with our seeded random
    for (let i = images.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [images[i], images[j]] = [images[j], images[i]];
    }

    console.log(`Shuffled ${images.length} images with seed ${seed}`);

    // Always reset to first image
    selectedIndex = 0;

    // Load the shuffled images into the DOM
    loadImages();

    return images;
  } catch (error) {
    console.error("Error in fetchImages:", error);
    return [];
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

  // Read URL parameters before applying to images
  const urlParams = new URLSearchParams(window.location.search);

  // Update global 3D parameters from URL if they exist
  const skewParam = urlParams.get("skew");
  if (skewParam !== null && !isNaN(parseFloat(skewParam))) {
    skewAmount = parseFloat(skewParam);
    console.log(`Applied skew from URL: ${skewAmount}`);
  }

  const perspectiveParam = urlParams.get("perspective");
  if (perspectiveParam !== null && !isNaN(parseFloat(perspectiveParam))) {
    perspectiveAmount = parseFloat(perspectiveParam);
    console.log(`Applied perspective from URL: ${perspectiveAmount}`);
  }

  const rotateXParam = urlParams.get("rotateX");
  if (rotateXParam !== null && !isNaN(parseFloat(rotateXParam))) {
    rotateXAmount = parseFloat(rotateXParam);
    console.log(`Applied rotateX from URL: ${rotateXAmount}`);
  }

  images.forEach((image, index) => {
    let img = document.createElement("img");
    img.src = image.url;
    img.classList.add("image-slide");
    img.alt = image.alt || `Image ${index + 1}`;
    img.dataset.id = image.id;

    // Set initial styles with faster transitions for better performance
    img.style.transition = "transform 0.15s ease-out, opacity 0.3s ease-out";
    img.style.transformOrigin = "center center";
    img.dataset.currentZoom = "1"; // Initialize zoom value for all images

    if (index === selectedIndex) {
      // First image is visible - apply 3D effect if skew is enabled
      if (skewAmount !== 0) {
        img.style.transform = `perspective(${perspectiveAmount}px)
        rotateY(${skewAmount}deg)
        rotateX(${rotateXAmount}deg)
        scale3d(1, 1, 1)`;
      } else {
        img.style.transform = "scale(1)";
      }
      img.style.opacity = "1";
      img.style.display = "block";
    } else {
      // Other images are hidden
      img.style.opacity = "0";
      img.style.display = "none";
      // Still init the transform to ensure consistency when they appear
      if (skewAmount !== 0) {
        img.style.transform = `perspective(${perspectiveAmount}px)
        rotateY(${skewAmount}deg)
        rotateX(${rotateXAmount}deg)
        scale3d(1, 1, 1)`;
      } else {
        img.style.transform = "scale(1)";
      }
    }

    imageContainer.appendChild(img);
  });

  console.log(
    `${images.length} images loaded into DOM with index ${selectedIndex} visible`,
  );
}

// Function to update which image is selected without rebuilding the entire list
function updateSelectedImage(newIndex) {
  // Skip if no image container or no images
  if (!images.length) return;

  // Update selectedIndex
  selectedIndex = newIndex;

  // Update preview UI if it exists
  document.querySelectorAll(".preview-image").forEach((img) => {
    img.classList.toggle(
      "selected",
      parseInt(img.dataset.index) === selectedIndex,
    );
  });

  // Update main display
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

// Setup scroll event listener to detect which image is in view
function setupScrollListener() {
  const container = document.getElementById("preview-container");

  if (!container) return; // Skip if container doesn't exist (main view)

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
      selectedIndex = parseInt(closestImage.dataset.index);

      // Update preview UI but don't update URL parameters
      document.querySelectorAll(".preview-image").forEach((img) => {
        img.classList.toggle(
          "selected",
          parseInt(img.dataset.index) === selectedIndex,
        );
      });
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

  // Enhanced intensity calculation - provide progressive scaling for stronger punches
  if (acceleration > config.punch.strongThreshold) {
    // Add an additional boost for stronger punches using a progressive curve
    const intensityBoost = Math.pow(
      (acceleration - config.punch.strongThreshold) / 10,
      1.5,
    );
    imagesToScroll = Math.min(
      Math.round(imagesToScroll + intensityBoost),
      maxPhotos,
    );
  }

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

// Function to update zoom level based on device tilt
function tiltBasedZoom(betaRotation, alphaRotation = 0, gammaRotation = 0) {
  // Get the current image
  const currentImage = document.querySelectorAll(".image-slide")[selectedIndex];
  if (!currentImage) return;

  // Normalize the beta rotation (device tilt)
  // Beta ranges from -180 to 180, most comfortable viewing angle is around beta = 0

  let sign = 1; // Initialize sign variable with default value
  if (betaRotation < 0) {
    sign = -1;
  }
  let adjustedBeta = betaRotation;
  if (adjustedBeta > 90) adjustedBeta = 180 - adjustedBeta;
  if (adjustedBeta < -90) adjustedBeta = -180 - adjustedBeta;

  // Normalize alpha rotation (0-360, compass direction)
  const adjustedAlpha = ((alphaRotation % 360) + 360) % 360;

  // Normalize gamma rotation (-90 to 90, left-right tilt)
  let adjustedGamma = gammaRotation;
  if (adjustedGamma > 90) adjustedGamma = 180 - adjustedGamma;
  if (adjustedGamma < -90) adjustedGamma = -180 - adjustedGamma;

  // Calculate zoom factor - higher tilt = more zoom, but keep it subtle
  const baseZoom = 1.0; // Base zoom level (no zoom)
  const maxZoom = 1.2; // Reduced maximum zoom for subtlety
  // Use sign to determine zoom in or out
  const zoomFactor = sign < 0
    ? baseZoom + Math.abs(adjustedBeta / 90) * (maxZoom - baseZoom) // Zoom in for positive tilt
    : baseZoom - Math.abs(adjustedBeta / 90) * (baseZoom - (2 - maxZoom)); // Zoom out for negative tilt

  // Store current zoom level in dataset for persistence during animations
  currentImage.dataset.currentZoom = zoomFactor;

  // Apply responsive transition with 3D transform for better performance
  currentImage.style.transition = "transform 0.2s ease-out";

  // Apply dynamic breathing effect using time-based oscillation
  const breathingAmplitude = 0.015; // Subtle breathing effect
  const breathingSpeed = 1.5; // Seconds per cycle
  const breathingOffset = Math.sin(Date.now() / (1000 * breathingSpeed)) *
    breathingAmplitude;

  // If skew is enabled, apply a perspective transform for 3D effect
  if (skewAmount !== 0) {
    // This creates a subtle dynamic 3D effect that changes with device tilt
    const tiltMultiplier = 0.8; // Reduced multiplier for subtler effects
    const betaFactor = (adjustedBeta / 90) * tiltMultiplier; // Reduced range based on tilt

    // Add alpha and gamma factors (compass direction and device roll)
    const alphaFactor = ((adjustedAlpha / 180) - 1) * 0.4; // -0.4 to 0.4 range
    const gammaFactor = (adjustedGamma / 90) * 0.6; // -0.6 to 0.6 range

    // Dynamic adjustments based on all three axes
    const dynamicSkew = skewAmount + (betaFactor * 3) + (gammaFactor * 2); // Primary skew from beta + gamma
    const dynamicRotateX = rotateXAmount + (betaFactor * 1.5) +
      (breathingOffset * 2); // X rotation from beta + breathing
    const dynamicRotateY = (alphaFactor * 2) + (breathingOffset * 1.5); // Y rotation from alpha + breathing
    const dynamicRotateZ = (gammaFactor * 1.2) + (betaFactor * 0.3); // Z rotation primarily from gamma

    // Perspective depth varies with both beta and gamma
    const dynamicPerspective = perspectiveAmount -
      (Math.abs(betaFactor) * 100) - (Math.abs(gammaFactor) * 50);

    // Apply refined 3D transform with all axes and breathing effect
    currentImage.style.transform = `
      perspective(${dynamicPerspective}px)
      rotateY(${dynamicSkew + dynamicRotateY}deg)
      rotateX(${dynamicRotateX}deg)
      rotateZ(${dynamicRotateZ}deg)
      translate3d(${betaFactor * -2 + gammaFactor * 3}px, ${
      betaFactor * 1 + alphaFactor * 2
    }px, ${breathingOffset * 10}px)
      scale3d(${zoomFactor + breathingOffset}, ${
      zoomFactor + breathingOffset
    }, 1)`;

    // Store current values for reference in other functions
    currentImage.dataset.currentSkew = dynamicSkew;
    currentImage.dataset.currentRotateX = dynamicRotateX;
  } else {
    // Simple zoom if 3D effects are disabled, but still add breathing effect
    currentImage.style.transform = `
      scale(${zoomFactor + breathingOffset}) 
      rotate(${(gammaRotation / 90) * 1.5}deg)`;
  }

  // Return the calculated zoom factor for other functions to use
  return zoomFactor;
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

  // Add this at the beginning of the advancePhotos function
  console.log(
    `advancePhotos called with count=${count}, currentIndex=${selectedIndex}, images.length=${images.length}`,
  );

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
    // Make transitions faster as count increases, with a lower minimum
    const transitionSpeed = Math.max(100, 350 - (count * 40));

    // For very high counts (high intensity), make transitions even faster
    const speedAdjustment = count > 5
      ? Math.max(50, transitionSpeed - 50)
      : transitionSpeed;

    // Trigger the image transition with appropriate speed
    nextImage(speedAdjustment);

    // Decrement counter and set up next transition with a smaller gap for smoother transitions
    remainingPhotos--;
    setTimeout(advanceNext, speedAdjustment + 30);
  }

  // Start the sequence
  advanceNext();
}

// Initialize the application
window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded, initializing app...");

  // Initialize the source ID selector
  initSourceIdSelector();

  // Fetch configuration before initializing WebSocket
  fetchConfiguration();

  // Try to fetch sync counter first, before loading images
  fetchSyncCounter().then(() => {
    // Then fetch and load images with the correct seed
    fetchImages().then(() => {
      // Initialize WebSocket after images are loaded
      initWebSocket();

      // Initialize state sync after WebSocket is connected
      setTimeout(initStateSync, 1000);

      // Start the continuous breathing animation once images are loaded
      requestAnimationFrame(startBreathingAnimation);
    });
  });

  // Initialize rotation button and URL change listener
  initRotationButton();
  setupURLChangeListener();

  // Initialize the sync indicator
  initSyncIndicator();

  // Initialize 3D effect controls
  init3DControls();

  // Setup click event listener for manual navigation
  document.addEventListener("click", (event) => {
    console.log("Click detected");
    nextImage();
  });

  // Setup keyboard navigation
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") nextImage();
  });

  // Setup scroll listener
  setupScrollListener();

  // Update rotation position
  updateRotationPosition();

  // Make various test functions available for debugging
  window.testScroll = testScroll;
  window.testPunch = testPunch;
  window.testSkew = testSkew;
  window.test3D = test3D;

  // Refresh configuration periodically (every 5 minutes)
  setInterval(fetchConfiguration, 5 * 60 * 1000);

  console.log("TV interface initialized successfully");
});

// Initialize 3D effect controls
function init3DControls() {
  const effectPresets = document.getElementById("effect-presets");
  const effectToggle = document.getElementById("effect-toggle");

  if (!effectPresets || !effectToggle) return;

  // Define all available presets to use throughout the function
  const presets = {
    default: { skew: 5, perspective: 1500, rotateX: 0 },
    minimal: { skew: 2, perspective: 2000, rotateX: 0.5 },
    gentle: { skew: 8, perspective: 1800, rotateX: 1 },
    medium: { skew: 12, perspective: 1200, rotateX: -2 },
    clean: { skew: 7, perspective: 1600, rotateX: 0 },
    elegant: { skew: -5, perspective: 2200, rotateX: 1 },
    flatScreen: { skew: 0, perspective: 2000, rotateX: 0 },
    classic: { skew: 15, perspective: 1000, rotateX: -3 },
  };

  // Update effect based on preset selection
  effectPresets.addEventListener("change", function () {
    test3D(this.value);
  });

  // Toggle 3D effect on/off
  effectToggle.addEventListener("change", function () {
    if (this.checked) {
      // Enable 3D - use the currently selected preset
      test3D(effectPresets.value);
    } else {
      // Disable 3D effects
      testSkew(0, 2000, 0); // Set all 3D parameters to neutral values
    }
  });

  // Check URL parameters to set initial UI state
  const urlParams = new URLSearchParams(window.location.search);
  const skewParam = urlParams.get("skew");
  const perspectiveParam = urlParams.get("perspective") || perspectiveAmount;
  const rotateXParam = urlParams.get("rotateX") || rotateXAmount;

  // If skew is explicitly set to 0, disable 3D effect
  if (skewParam !== null && parseFloat(skewParam) === 0) {
    effectToggle.checked = false;
  } // If any URL parameters are present, find matching preset or closest match
  else if (
    skewParam !== null || perspectiveParam !== null || rotateXParam !== null
  ) {
    // Parse the URL parameters
    const skew = skewParam !== null ? parseFloat(skewParam) : skewAmount;
    const perspective = perspectiveParam !== null
      ? parseFloat(perspectiveParam)
      : perspectiveAmount;
    const rotateX = rotateXParam !== null
      ? parseFloat(rotateXParam)
      : rotateXAmount;

    // Find the closest preset to the URL parameters
    let closestPreset = "default";
    let minDifference = Infinity;

    for (const [preset, values] of Object.entries(presets)) {
      // Calculate how closely this preset matches the URL parameters
      const difference = Math.abs(values.skew - skew) +
        Math.abs(values.perspective - perspective) / 200 +
        Math.abs(values.rotateX - rotateX) * 2;

      if (difference < minDifference) {
        minDifference = difference;
        closestPreset = preset;
      }
    }

    // Set the dropdown to the closest preset
    effectPresets.value = closestPreset;

    // Make sure the toggle is checked if there are any 3D effects
    effectToggle.checked = skew !== 0;
  } // If no URL parameters, apply default preset
  else {
    // No need to explicitly call test3D here since the 3D effect
    // is already applied during image loading
    effectPresets.value = "default";
  }
}

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

// Handle punch data
function handlePunch(punchData) {
  // Extract source ID from the punch data
  const sourceId = punchData.sourceId || "";

  // Track new source IDs
  if (sourceId !== "" && !sourceIds.has(sourceId)) {
    sourceIds.add(sourceId);
    updateSourceIdDropdown();
  }

  // Filter by selected source ID
  if (currentSourceId !== "all") {
    if (currentSourceId === "unclassified") {
      // Skip if has a sourceId (not unclassified)
      if (sourceId !== "") {
        console.log(
          `Skipping punch from source ${sourceId} - only showing unclassified punches`,
        );
        return;
      }
    } else if (sourceId !== currentSourceId) {
      // Skip if doesn't match selected source ID
      console.log(
        `Skipping punch from source ${
          sourceId || "unclassified"
        } - filtering for ${currentSourceId}`,
      );
      return;
    }
  }

  // Apply cooldown to punches
  const now = Date.now();
  if (now - lastPunchTime < PUNCH_COOLDOWN_MS) {
    console.log("Punch ignored due to cooldown period");
    return;
  }
  lastPunchTime = now;

  let punchValue;

  // Extract punch value, handling different message formats
  if (punchData.acceleration) {
    // New format with acceleration
    if (typeof punchData.acceleration === "object") {
      // Extract magnitude if it's an object with x,y,z
      punchValue = getAccelerationMagnitude(punchData.acceleration);
    } else {
      // Direct number value
      punchValue = punchData.acceleration;
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

    // Track source ID if present
    if (data.sourceId && data.sourceId !== "") {
      if (!sourceIds.has(data.sourceId)) {
        sourceIds.add(data.sourceId);
        updateSourceIdDropdown();
      }
    }

    // Check for sync counter in system messages
    if (data.type === "system" && data.syncCounter !== undefined) {
      updateSyncCounter(data.syncCounter);
    }

    // Filter by source ID
    if (currentSourceId !== "all") {
      const sourceId = data.sourceId || "";
      if (currentSourceId === "unclassified") {
        // Skip if has sourceId
        if (sourceId !== "") {
          return;
        }
      } else if (sourceId !== currentSourceId) {
        // Skip if doesn't match current sourceId
        return;
      }
    }

    // Handle different message types
    if (data.type === "punch") {
      handlePunch(data);
    } else if (data.type === "acceleration" || data.type === "accel") {
      // Handle acceleration data that may also indicate a punch
      if (data.acceleration) {
        handlePunch(data);
      }
    } else if (data.type === "orientation") {
      // Extract all rotation values from orientation data
      const beta = data.orientation.y;
      const alpha = data.orientation.x || 0; // Alpha is rotation around vertical axis
      const gamma = data.orientation.z || 0; // Gamma is left-right tilt

      // Use all three axes for dynamic effects
      tiltBasedZoom(beta, alpha, gamma);
    } else if (data.type === "deviceOrientation") {
      // Extract all rotation values
      // Some systems use different property names
      const beta = data.orientation.beta || data.orientation.y || 0;
      const alpha = data.orientation.alpha || data.orientation.x || 0;
      const gamma = data.orientation.gamma || data.orientation.z || 0;

      // Use all three axes for dynamic effects
      tiltBasedZoom(beta, alpha, gamma);
    } else if (data.type === "tilt") {
      // For backward compatibility, if any code still sends generic tilt values
      // We'll just use beta for now since we don't have alpha/gamma
      tiltBasedZoom(data.value * 180);
    } else if (data.type === "sync") {
      // Update sync counter from sync messages
      if (data.syncCounter !== undefined) {
        updateSyncCounter(data.syncCounter);
      }
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

// Add a test function to simulate a punch with a given strength
function testPunch(strength = 10) {
  console.log(`Testing punch with strength ${strength}`);

  // Create a sample data object to simulate a punch message
  const punchData = {
    acceleration: strength,
    sourceId: "test",
  };

  // Process the punch using the main handler
  const result = handlePunch(punchData);

  // Log the expected scrolling behavior
  console.log(
    `Test punch of intensity ${strength} would scroll ${
      result?.imagesToScroll || "unknown"
    } images`,
  );

  return result;
}

// Make it globally accessible for console testing
window.testPunch = testPunch;

// Add function to handle URL parameter changes
function setupURLChangeListener() {
  // Listen for URL parameter changes
  window.addEventListener("popstate", function () {
    const urlParams = new URLSearchParams(window.location.search);

    // Handle skew parameter
    const skewParam = urlParams.get("skew");
    if (skewParam !== null && !isNaN(parseFloat(skewParam))) {
      skewAmount = parseFloat(skewParam);
      console.log(`URL skew changed to ${skewAmount}, updating display`);
    }

    // Handle perspective parameter
    const perspectiveParam = urlParams.get("perspective");
    if (perspectiveParam !== null && !isNaN(parseFloat(perspectiveParam))) {
      perspectiveAmount = parseFloat(perspectiveParam);
      console.log(
        `URL perspective changed to ${perspectiveAmount}, updating display`,
      );
    }

    // Handle rotateX parameter
    const rotateXParam = urlParams.get("rotateX");
    if (rotateXParam !== null && !isNaN(parseFloat(rotateXParam))) {
      rotateXAmount = parseFloat(rotateXParam);
      console.log(`URL rotateX changed to ${rotateXAmount}, updating display`);
    }

    // Apply to current image with all 3D parameters
    const currentImage =
      document.querySelectorAll(".image-slide")[selectedIndex];
    if (currentImage) {
      const zoomFactor = currentImage.dataset.currentZoom || 1;
      currentImage.style.transform = `perspective(${perspectiveAmount}px) 
         rotateY(${skewAmount}deg) 
         rotateX(${rotateXAmount}deg) 
         scale3d(${zoomFactor}, ${zoomFactor}, 1)`;
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
    timestamp: Date.now(),
    data: {
      selectedIndex,
      seed: getSeed(),
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
    timestamp: Date.now(),
    data: {
      selectedIndex,
      seed: getSeed(),
    },
  };

  window.uiSignalsWs.send(JSON.stringify(stateMessage));
  console.log("Broadcast state update:", stateMessage);
}

// Function to handle incoming sync messages
function handleSyncMessage(message) {
  // No longer filtering messages by clientId
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

        // No longer update URL with index parameter
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
      }, 1000);
    } else if (status === "synced") {
      indicator.style.backgroundColor = "#0f0"; // Green
      indicator.style.opacity = "0.8";
      setTimeout(() => {
        indicator.style.opacity = "0.5";
      }, 1000);
    } else if (status === "error") {
      indicator.style.backgroundColor = "red";
      indicator.style.opacity = "0.8";
    }
  };

  // Expose the update function globally for other parts of the code
  window.updateSyncIndicator = updateSyncIndicator;
}

// Add function to test the 3D skew effect
function testSkew(amount = 15, perspective = 1000, rotateX = 0) {
  console.log(
    `Testing 3D effect with skew: ${amount}, perspective: ${perspective}, rotateX: ${rotateX}`,
  );

  // Update the global skew amount
  skewAmount = amount;
  perspectiveAmount = perspective;
  rotateXAmount = rotateX;

  // Update URL without reloading page
  const newUrl = new URL(window.location);
  newUrl.searchParams.set("skew", amount.toString());
  newUrl.searchParams.set("perspective", perspective.toString());
  newUrl.searchParams.set("rotateX", rotateX.toString());
  window.history.replaceState({}, "", newUrl);

  // Apply effect to current image
  const currentImage = document.querySelectorAll(".image-slide")[selectedIndex];
  if (currentImage) {
    const zoomFactor = currentImage.dataset.currentZoom || 1;
    currentImage.style.transform = `perspective(${perspective}px) 
       rotateY(${amount}deg) 
       rotateX(${rotateX}deg) 
       scale3d(${zoomFactor}, ${zoomFactor}, 1)`;
  }

  // Update UI controls to match new settings
  const effectToggle = document.getElementById("effect-toggle");
  const effectPresets = document.getElementById("effect-presets");

  if (effectToggle && effectPresets) {
    // Update toggle state based on whether 3D is enabled
    effectToggle.checked = amount !== 0;

    // Try to find a matching preset
    const presets = {
      default: { skew: 5, perspective: 1500, rotateX: 0 },
      minimal: { skew: 2, perspective: 2000, rotateX: 0.5 },
      gentle: { skew: 8, perspective: 1800, rotateX: 1 },
      medium: { skew: 12, perspective: 1200, rotateX: -2 },
      clean: { skew: 7, perspective: 1600, rotateX: 0 },
      elegant: { skew: -5, perspective: 2200, rotateX: 1 },
      flatScreen: { skew: 0, perspective: 2000, rotateX: 0 },
      classic: { skew: 15, perspective: 1000, rotateX: -3 },
    };

    // Find closest preset
    let closestPreset = "default";
    let minDifference = Infinity;

    for (const [preset, values] of Object.entries(presets)) {
      const difference = Math.abs(values.skew - amount) +
        Math.abs(values.perspective - perspective) / 200 +
        Math.abs(values.rotateX - rotateX) * 2;

      if (difference < minDifference) {
        minDifference = difference;
        closestPreset = preset;
      }
    }

    effectPresets.value = closestPreset;
  }

  return `Set 3D effect: skew=${amount}, perspective=${perspective}, rotateX=${rotateX}. 
  Try different values like: testSkew(30, 800, 5), testSkew(-15, 1200, -3), testSkew(0)`;
}

// New function for testing different 3D presets - updated with more subtle presets
function test3D(preset = "default") {
  const presets = {
    default: { skew: 5, perspective: 1500, rotateX: 0 }, // More subtle default
    minimal: { skew: 2, perspective: 2000, rotateX: 0.5 }, // Very subtle effect
    gentle: { skew: 8, perspective: 1800, rotateX: 1 }, // Gentle effect
    medium: { skew: 12, perspective: 1200, rotateX: -2 }, // Medium intensity
    clean: { skew: 7, perspective: 1600, rotateX: 0 }, // Clean look without X rotation
    elegant: { skew: -5, perspective: 2200, rotateX: 1 }, // Elegant backwards tilt
    flatScreen: { skew: 0, perspective: 2000, rotateX: 0 }, // No 3D effect
    classic: { skew: 15, perspective: 1000, rotateX: -3 }, // Original stronger effect
  };

  // Get the preset values or use default if preset not found
  const { skew, perspective, rotateX } = presets[preset] || presets.default;

  // Apply the preset using testSkew
  testSkew(skew, perspective, rotateX);

  // Return info about available presets
  return `Applied 3D preset: ${preset}. 
  Available presets: ${Object.keys(presets).join(", ")}
  Example: test3D('gentle') or test3D('minimal')`;
}

// Make test functions globally accessible for console testing
window.testSkew = testSkew;
window.test3D = test3D;

// Function to update the sync counter and possibly reload/reshuffle images
function updateSyncCounter(counter) {
  if (counter === syncState.syncCounter) {
    return; // No change
  }

  console.log(
    `Updating sync counter from ${syncState.syncCounter} to ${counter}`,
  );
  syncState.syncCounter = counter;
  syncState.lastSyncTime = Date.now();

  // If images are already loaded, we need to reshuffle them with the new seed
  if (images.length > 0) {
    console.log("Reshuffling images with new sync counter as seed");
    // Shuffle images using the new sync counter as seed
    shuffleImagesWithSeed(counter);
    // Update the display to show the first image
    selectedIndex = 0;
    updateImageDisplay();
  }

  // Update sync indicator if it exists
  if (window.updateSyncIndicator) {
    window.updateSyncIndicator("synced");
  }
}

// Shuffle images using the deterministic seed
function shuffleImagesWithSeed(seed) {
  console.log(`Shuffling images with seed: ${seed}`);

  // Use parseInt to ensure we have a number for the seeded random generator
  const numericSeed = typeof seed === "number" ? seed : parseInt(seed);
  const random = seededRandom(numericSeed);

  // Create a copy of the original unshuffled images if available
  const originalImages = [...images];

  // Reset the images array
  images = [];

  // Shuffle the copy using Fisher-Yates algorithm with seeded random
  for (let i = originalImages.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [originalImages[i], originalImages[j]] = [
      originalImages[j],
      originalImages[i],
    ];
  }

  // Reassign the shuffled array
  images = originalImages;

  console.log(`Shuffled ${images.length} images with seed ${seed}`);
}

// Update the display to show the current image
function updateImageDisplay() {
  // Clear the container
  imageContainer.innerHTML = "";

  // Create and add each image
  images.forEach((image, index) => {
    const img = document.createElement("img");
    img.src = image.url;
    img.alt = image.alt || "";
    img.className = "image-slide";
    img.dataset.id = image.id;

    // Only show the current image
    if (index === selectedIndex) {
      img.style.opacity = "1";
      img.style.display = "block";
    } else {
      img.style.opacity = "0";
      img.style.display = "none";
    }

    imageContainer.appendChild(img);
  });
}

// Replace the complex sync functions with a simple update function
function updateSyncIndicator(status) {
  const indicator = document.getElementById("sync-indicator");
  if (!indicator) return;

  if (status === "synced") {
    indicator.style.backgroundColor = "#0f0"; // Green
    indicator.style.opacity = "0.8";

    // Fade out after a moment
    setTimeout(() => {
      indicator.style.opacity = "0.5";
    }, 1000);
  } else if (status === "syncing") {
    indicator.style.backgroundColor = "yellow";
    indicator.style.opacity = "0.8";
  } else if (status === "error") {
    indicator.style.backgroundColor = "red";
    indicator.style.opacity = "0.8";
  }
}

// Create a sync indicator element
function initSyncIndicator() {
  // Create sync indicator element if it doesn't exist
  if (!document.getElementById("sync-indicator")) {
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
  }
}

// Add this function to periodically refresh the counter from the server
let counterRefreshInterval = null;

function startCounterRefresh() {
  // Stop any existing interval
  stopCounterRefresh();

  // Fetch immediately
  fetchSyncCounter();

  // Then set up interval (every 10 seconds)
  counterRefreshInterval = setInterval(fetchSyncCounter, 10000);
}

function stopCounterRefresh() {
  if (counterRefreshInterval) {
    clearInterval(counterRefreshInterval);
    counterRefreshInterval = null;
  }
}

// Function to fetch counter from the server
async function fetchSyncCounter() {
  try {
    const response = await fetch("/api/sync-counter");
    if (response.ok) {
      const data = await response.json();
      if (data.counter !== undefined) {
        updateSyncCounter(data.counter);
      }
    }
  } catch (error) {
    console.error("Error fetching sync counter:", error);
  }
}

// Add this function to animate breathing effect continuously
function startBreathingAnimation() {
  // Get the current image
  const currentImage = document.querySelectorAll(".image-slide")[selectedIndex];
  if (!currentImage) return;

  // Only animate if we have at least some 3D effects enabled
  if (
    currentImage.style.transform &&
    currentImage.style.transform.includes("perspective")
  ) {
    // Get current zoom and transform values
    const zoomFactor = parseFloat(currentImage.dataset.currentZoom || "1");
    const storedSkew = parseFloat(
      currentImage.dataset.currentSkew || skewAmount.toString(),
    );
    const storedRotateX = parseFloat(
      currentImage.dataset.currentRotateX || rotateXAmount.toString(),
    );

    // Create subtle breathing animation
    const breathingAmplitude = 0.015;
    const breathingSpeed = 1.5; // Seconds per cycle
    const breathingOffset = Math.sin(Date.now() / (1000 * breathingSpeed)) *
      breathingAmplitude;

    // Apply subtle movement based on time
    currentImage.style.transform = `
      perspective(${perspectiveAmount}px)
      rotateY(${storedSkew + (breathingOffset * 3)}deg)
      rotateX(${storedRotateX + (breathingOffset * 2)}deg)
      translate3d(${breathingOffset * 5}px, ${breathingOffset * 3}px, ${
      breathingOffset * 10
    }px)
      scale3d(${zoomFactor + breathingOffset}, ${
      zoomFactor + breathingOffset
    }, 1)`;
  } else if (currentImage.style.transform) {
    // For simple transforms, just add subtle breathing to scale
    const zoomFactor = parseFloat(currentImage.dataset.currentZoom || "1");
    const breathingOffset = Math.sin(Date.now() / (1000 * 1.5)) * 0.015;
    currentImage.style.transform = `scale(${zoomFactor + breathingOffset})`;
  }

  // Request next animation frame
  requestAnimationFrame(startBreathingAnimation);
}
