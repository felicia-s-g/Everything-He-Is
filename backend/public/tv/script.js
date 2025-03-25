let images = [];
let selectedIndex = 0;
const imageList = document.getElementById("image-list");
let isAutoScrolling = false; // Flag to track if auto-scrolling is in progress
let wsConnection = null; // WebSocket connection
let lastPunchTime = 0; // Track the last punch time
let PUNCH_COOLDOWN_MS = 300; // Shorter cooldown period between punches for more responsiveness
const imageContainer = document.getElementById("image-container"); // Make this global
let currentRotation = 0; // Track the current rotation in degrees
let perspectiveAmount = 5000; // Default perspective depth
const preloadCount = 5;
let alphaOfTv = 0; // Default alpha value
let tvSettings = {
  calibratedAlpha: 0,
};

// Source ID tracking
const sourceIds = new Set();
let currentSourceId = "felicia";

// Function to get URL parameters
function getURLParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Set alphaOfTv from URL parameter if available
function initAlphaFromURL() {
  const alphaParam = getURLParameter("alphaOfTV");
  if (alphaParam !== null) {
    // Parse the alpha value, allowing negative values for rotation
    const parsedAlpha = parseInt(alphaParam, 10);
    if (!isNaN(parsedAlpha)) {
      alphaOfTv = parsedAlpha;
      console.log(
        `Setting TV alpha rotation to ${alphaOfTv} from URL parameter`,
      );
    } else {
      console.warn(
        `Invalid alphaOfTV parameter: ${alphaParam}. Using default value: ${alphaOfTv}`,
      );
    }
  }
}

// Setup URL change listener to detect parameter changes
function setupURLChangeListener() {
  window.addEventListener("popstate", function () {
    // Re-read alpha value when URL changes
    initAlphaFromURL();
  });

  // Also monitor hash changes for single-page apps
  window.addEventListener("hashchange", function () {
    initAlphaFromURL();
  });
}

// Handle orientation changes to ensure images fit correctly
function setupOrientationChangeListener() {
  window.addEventListener("orientationchange", function () {
    // Force images to recalculate their size
    const currentImage = document.querySelector(
      `.image-slide[data-index="${selectedIndex}"]`,
    );
    if (currentImage) {
      // Trigger a small style recalculation to ensure proper fitting
      currentImage.style.maxWidth = "";
      currentImage.style.maxHeight = "";

      // Force reflow
      void currentImage.offsetWidth;

      // Reset to CSS values
      currentImage.style.maxWidth = "100%";
      currentImage.style.maxHeight = "100%";
    }
  });
}

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
  const sourceIdContainer = document.getElementById("source-id-container");
  if (!sourceIdSelector || !sourceIdContainer) return;

  sourceIdSelector.addEventListener("change", function () {
    currentSourceId = this.value;
    console.log(
      `Filtering to source ID: ${
        currentSourceId === "all" ? "All Sources" : currentSourceId
      }`,
    );
  });

  // Detect mouse movement to show/hide the source selector
  document.addEventListener("mousemove", (event) => {
    // Define the detection area (top right corner)
    const showAreaSize = 150; // Size of the detection area in pixels
    const isInTopRightCorner =
      event.clientX > window.innerWidth - showAreaSize &&
      event.clientY < showAreaSize;

    // Add or remove the 'visible' class based on mouse position
    if (isInTopRightCorner) {
      sourceIdContainer.classList.add("visible");
    } else {
      sourceIdContainer.classList.remove("visible");
    }
  });

  // Hide the source selector when mouse leaves the window
  document.addEventListener("mouseleave", () => {
    sourceIdContainer.classList.remove("visible");
  });
}

// Update the source ID dropdown with new IDs
function updateSourceIdDropdown() {
  const sourceIdSelector = document.getElementById("source-id-selector");
  if (!sourceIdSelector) return;

  // Clear and add options - with "bag" (felicia) first, then All Sources
  sourceIdSelector.innerHTML = `
    <option value="felicia">bag</option>
    <option value="all">All Sources</option>
    <option value="unclassified">Unclassified</option>
  `;

  // Add all other source IDs (excluding felicia since it's already added)
  sourceIds.forEach((id) => {
    if (id !== "felicia") {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id;
      sourceIdSelector.appendChild(option);
    }
  });

  // Set the default selection to "felicia"
  sourceIdSelector.value = "felicia";
  currentSourceId = "felicia";
}

function nextImage(dynamicTimeout = 350) {
  console.log("nextImage called, current index:", selectedIndex);
  let currentImage = document.querySelector(
    `.image-slide[data-index="${selectedIndex}"]`,
  );

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

  // Calculate the next image index BEFORE the timeout
  const nextIndex = (selectedIndex + 1) % images.length;

  // Make sure the next image is loaded
  loadSingleImage(nextIndex);

  // Preload a few more upcoming images
  for (let i = 1; i <= preloadCount; i++) {
    const preloadIndex = (nextIndex + i) % images.length;
    // Use setTimeout to stagger the loading and reduce initial load impact
    setTimeout(() => loadSingleImage(preloadIndex), i * 100);
  }

  // Find the next image element
  const nextImageEl = document.querySelector(
    `.image-slide[data-index="${nextIndex}"]`,
  );
  if (nextImageEl) {
    // Prepare next image but keep it invisible until the transition
    nextImageEl.style.display = "block";
    nextImageEl.style.opacity = "0";

    // If the next image already has a zoom factor, preserve it
    // Otherwise start with default scale of 1
    if (nextImageEl.dataset.currentZoom) {
      const zoomFactor = nextImageEl.dataset.currentZoom;
      nextImageEl.style.transform = `scale(${zoomFactor})`;
    }
  } else {
    console.error("Next image element not found!");
  }

  // After a dynamic timeout (longer for stronger punches), make the transition
  // Small amount of randomness in the timeout to make it feel more organic
  const jitter = Math.random() * 50;
  const adjustedTimeout = dynamicTimeout + jitter;

  setTimeout(() => {
    // Remove flying away class from old image
    currentImage.classList.remove("flying-away");
    currentImage.style.opacity = "0";
    currentImage.style.display = "none";

    if (nextImageEl) {
      // Show next image
      nextImageEl.style.opacity = "1";
    }

    // Update selected index
    selectedIndex = nextIndex;
    console.log("Updated selectedIndex to", selectedIndex);

    // Optionally remove unused images that are far from current view to save memory
    cleanupUnusedImages();
  }, adjustedTimeout);
}

// Function to remove images that are far from current view to save memory
function cleanupUnusedImages() {
  const keepRange = 5; // How many images to keep on either side of current
  const allImages = document.querySelectorAll(".image-slide");

  if (allImages.length <= keepRange * 2 + 1) return; // If we don't have many images, keep them all

  allImages.forEach((img) => {
    const imgIndex = parseInt(img.dataset.index);
    // Calculate distance from current image (accounting for wrapping)
    let distance = Math.abs(imgIndex - selectedIndex);
    // Account for wrapping around the end
    distance = Math.min(distance, images.length - distance);

    // If image is far away, remove it to save memory
    if (distance > keepRange) {
      img.remove();
    }
  });
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
    // Start periodic counter refresh
    startCounterRefresh();
  });

  // Listen for messages
  wsConnection.addEventListener("message", (event) => {
    handleWebSocketMessage(event);
  });

  // Connection closed
  wsConnection.addEventListener("close", (event) => {
    // Stop the counter refresh interval when connection is closed
    stopCounterRefresh();

    setTimeout(() => {
      initWebSocket();
    }, 3000); // Try to reconnect after 3 seconds
  });

  // Also connect to the UI signals WebSocket
  window.uiSignalsWs = new WebSocket(wsUrl);

  window.uiSignalsWs.addEventListener("open", (event) => {
  });

  window.uiSignalsWs.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);

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
    setTimeout(() => {
      // The main initWebSocket will handle reconnection of both
    }, 3000);
  });
}

// Fetch images from the API endpoint
async function fetchImages() {
  try {
    // Add a timestamp parameter to avoid browser caching if needed
    // The server already sets cache headers, so we'll respect those most of the time
    // Only add cache busting if a URL parameter is set
    const urlParams = new URLSearchParams(window.location.search);
    const noCacheParam = urlParams.get("nocache");

    let url = "/api/images";
    if (noCacheParam === "true") {
      // Add cache-busting timestamp only when explicitly requested
      url += `?t=${Date.now()}`;
      console.log("Using cache-busting for image list");
    }

    console.log("Fetching image list...");
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Error fetching images:", response.statusText);
      // Display error message to user
      const errorMessage = document.createElement("div");
      errorMessage.style.color = "white";
      errorMessage.style.padding = "20px";
      errorMessage.textContent =
        `Error loading images: ${response.status} ${response.statusText}`;
      imageContainer.appendChild(errorMessage);
      return [];
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

    // Load the shuffled images into the DOM (now with lazy loading)
    loadImages();

    return images;
  } catch (error) {
    console.error("Error in fetchImages:", error);

    // Display error message to user
    const errorMessage = document.createElement("div");
    errorMessage.style.color = "white";
    errorMessage.style.padding = "20px";
    errorMessage.textContent = `Failed to load images: ${error.message}`;
    imageContainer.appendChild(errorMessage);

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
  console.log(`Loading images into the DOM with lazy loading`);

  if (images.length === 0) {
    console.error("No images to load");
    return;
  }

  // Read URL parameters before applying to images
  const urlParams = new URLSearchParams(window.location.search);

  // Update global 3D parameters from URL if they exist
  const perspectiveParam = urlParams.get("perspective");
  if (perspectiveParam !== null && !isNaN(parseFloat(perspectiveParam))) {
    perspectiveAmount = parseFloat(perspectiveParam);
    console.log(`Applied perspective from URL: ${perspectiveAmount}`);
  }

  // Calculate which images to preload (current + a few next ones)
  const imagesToLoad = new Set();

  // Add current image
  imagesToLoad.add(selectedIndex);

  // Add next few images for preloading
  for (let i = 1; i <= preloadCount; i++) {
    imagesToLoad.add((selectedIndex + i) % images.length);
  }

  // Only create and load the images we need now
  Array.from(imagesToLoad).forEach((index) => {
    loadSingleImage(index);
  });

  // Ensure proper positioning and sizing based on current rotation
  setTimeout(updateRotationPosition, 50);

  console.log(
    `Lazy loaded initial set of ${imagesToLoad.size} images with index ${selectedIndex} visible`,
  );
}

// Helper function to load a single image
function loadSingleImage(index) {
  if (index < 0 || index >= images.length) return;

  const image = images[index];

  // Skip if this image is already loaded
  if (document.querySelector(`.image-slide[data-id="${image.id}"]`)) {
    return;
  }

  let img = document.createElement("img");
  img.src = image.url;
  img.classList.add("image-slide");
  img.alt = image.alt || `Image ${index + 1}`;
  img.dataset.id = image.id;
  img.dataset.index = index;

  // Set initial styles with faster transitions for better performance
  img.style.transition = "transform 0.15s ease-out, opacity 0.3s ease-out";
  img.style.transformOrigin = "center center";
  img.dataset.currentZoom = "1"; // Initialize zoom value for all images

  // Ensure proper image sizing regardless of orientation
  img.style.maxWidth = "100%";
  img.style.maxHeight = "100%";
  img.style.width = "auto";
  img.style.height = "auto";
  img.style.objectFit = "contain";

  if (index === selectedIndex) {
    // First image is visible
    img.style.transform =
      `perspective(${perspectiveAmount}px) scale3d(1, 1, 1)`;
    img.style.opacity = "1";
    img.style.display = "block";
  } else {
    // Other images are hidden
    img.style.opacity = "0";
    img.style.display = "none";
    // Still init the transform to ensure consistency when they appear
    img.style.transform =
      `perspective(${perspectiveAmount}px) scale3d(1, 1, 1)`;
  }

  // Add onload handler to ensure proper sizing after image loads
  img.onload = function () {
    // Force a reflow to ensure proper fitting
    void img.offsetWidth;
  };

  imageContainer.appendChild(img);
  console.log(`Loaded image at index ${index}`);
}

// Function to update which image is selected without rebuilding the entire list
function updateSelectedImage(newIndex) {
  // Skip if no image container or no images
  if (!images.length) return;

  // Update selectedIndex
  selectedIndex = newIndex;

  // Make sure the selected image is loaded
  loadSingleImage(selectedIndex);

  // Preload a few upcoming images
  for (let i = 1; i <= preloadCount; i++) {
    const preloadIndex = (selectedIndex + i) % images.length;
    // Use setTimeout to stagger loading
    setTimeout(() => loadSingleImage(preloadIndex), i * 100);
  }

  // Hide all images and show only the selected one
  document.querySelectorAll(".image-slide").forEach((img) => {
    const imgIndex = parseInt(img.dataset.index);

    if (imgIndex === selectedIndex) {
      img.style.display = "block";
      img.style.opacity = "1";

      // Get stored values or use defaults
      const storedZoom = img.dataset.currentZoom || "1";
      img.style.transform =
        `perspective(${perspectiveAmount}px) scale3d(${storedZoom}, ${storedZoom}, 1)`;

      // Optimize the image sizing for current rotation
      setTimeout(() => optimizeImageForRotation(), 50);
    } else {
      img.style.opacity = "0";
      img.style.display = "none";
    }
  });

  // Apply current rotation positioning to ensure images are properly sized and centered
  updateRotationPosition();

  // Clean up distant images to save memory
  cleanupUnusedImages();

  console.log(`Selected image updated to index ${selectedIndex}`);
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
  // Verify we have a valid image container
  if (!imageContainer) {
    console.error("Image container not found, cannot scroll");
    return;
  }

  // Check if we have images and apply cooldown
  if (!images.length) {
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
    return;
  }
  lastPunchTime = now;

  // Use configuration values instead of hardcoded values
  const minAcceleration = config.punch.weakThreshold || 3;
  const maxAcceleration = config.punch.maxValue || 40;

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
function tiltBasedZoom(betaRotation, alphaRotation, gammaRotation) {
  // Get the current image
  const currentImage = document.querySelectorAll(".image-slide")[selectedIndex];
  if (!currentImage) return;

  // Normalize the beta rotation (device tilt)
  // -90 to 90
  let adjustedBeta = betaRotation;
  // -90 to 90
  if (adjustedBeta > 90) adjustedBeta = 180 - adjustedBeta;
  // -90 to 90
  if (adjustedBeta < -90) adjustedBeta = -180 - adjustedBeta;

  let adjustedAlpha = alphaRotation - 180;
  if (adjustedAlpha > 90) adjustedAlpha = 180 - adjustedAlpha;
  if (adjustedAlpha < -90) adjustedAlpha = -180 - adjustedAlpha;
  adjustedAlpha = -adjustedAlpha;

  const side = alphaOfTv > 0 ? 1 : -1;

  const facingTvOffset = alphaOfTv - adjustedAlpha;
  const facingTvOffsetScale = facingTvOffset / 90;

  // Normalize gamma rotation (-90 to 90, left-right tilt)
  let adjustedGamma = gammaRotation * -1;
  if (adjustedGamma > 90) adjustedGamma = 180 - adjustedGamma;
  if (adjustedGamma < -90) adjustedGamma = -180 - adjustedGamma;

  // normalize to -1 to 1
  const alphaScale = adjustedAlpha / 50;
  const betaScale = adjustedBeta / 50;
  const gammaScale = 0.2 + (adjustedGamma / 50);

  // Apply responsive transition with 3D transform for better performance
  currentImage.style.transition = "transform 0.2s ease-out";

  // Calculate movement amount (px) based on tilt
  let moveX = gammaScale * 80; // Left-right movement based on gamma (side tilt)
  // const moveZ = alphaScale * 50; // Z-axis movement based on alpha (rotation)
  const moveZ = 0; // Z-axis movement based on alpha (rotation)

  // when moving away or towards the user, also right or left
  let zoomFactor = -betaScale + 1;
  zoomFactor += gammaScale * 0.5 * -side;

  let cappedZoomFactor = Math.min(Math.max(zoomFactor, 0.9), 1.5) - 0.2;

  if (side === -1) {
    moveX = -moveX;
  }

  // NEW: Calculate subtle rotation angles based on phone orientation
  // This creates a subtle 3D effect while preserving aspect ratio
  // betaScale indicates if the phone is pointing toward the screen (positive) or away (negative)
  const rotateX = betaScale * 10; // Subtle X-axis rotation (up/down tilt) - max 3 degrees
  const rotateY = gammaScale * -10; // Subtle Y-axis rotation (left/right tilt) - max 5 degrees

  // Adjust rotateY based on which direction the phone is pointing
  const rotateYAdjusted = (facingTvOffsetScale > 0) ? rotateY : -rotateY;

  // Apply 3D transform combining translation, rotation and scale
  currentImage.style.transform =
    `perspective(${perspectiveAmount}px) translate3d(${-moveX}px, 0px, ${moveZ}px) rotateX(${rotateX}deg) rotateY(${rotateYAdjusted}deg) scale(${cappedZoomFactor})`;
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
  // Initialize the source ID selector
  initSourceIdSelector();

  // Initialize alpha value from URL
  initAlphaFromURL();

  // Set up orientation change listener for proper image fitting
  setupOrientationChangeListener();

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
    });
  });

  // Initialize rotation button and URL change listener
  initRotationButton();
  setupURLChangeListener();

  // Initialize the sync indicator
  initSyncIndicator();

  // Setup click event listener for manual navigation
  document.addEventListener("click", (event) => {
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

  // Refresh configuration periodically (every 5 minutes)
  setInterval(fetchConfiguration, 5 * 60 * 1000);
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
      if (data && data.tv) {
        tvSettings = {
          ...tvSettings,
          ...data.tv,
        };
      }
      console.log("tvSettings", tvSettings);
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
    })
    .catch((error) => {
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
        return;
      }
    } else if (sourceId !== currentSourceId) {
      // Skip if doesn't match selected source ID
      return;
    }
  }

  // Apply cooldown to punches
  const now = Date.now();
  if (now - lastPunchTime < PUNCH_COOLDOWN_MS) {
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
    return;
  }

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
      const alpha = tvSettings.calibratedAlpha - data.orientation.x; // Alpha is rotation around vertical axis
      const gamma = data.orientation.z; // Gamma is left-right tilt

      // Use all three axes for dynamic effects
      tiltBasedZoom(beta, alpha, gamma);
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

  // Apply rotation to the container via CSS custom property
  document.documentElement.style.setProperty(
    "--ui-rotation",
    `${currentRotation}deg`,
  );

  // Update position and dimensions based on orientation
  updateRotationPosition();

  // Optimize image fitting for this rotation
  optimizeImageForRotation();

  // Update rotation button text based on current rotation
  const rotateButton = document.getElementById("rotate-button");
  if (rotateButton) {
    rotateButton.textContent = "↻";
    // Optionally add a data attribute for rotation state
    rotateButton.setAttribute("data-rotation", currentRotation.toString());
  }
}

// Optimize image display for current rotation
function optimizeImageForRotation() {
  const currentImage = document.querySelector(
    `.image-slide[data-index="${selectedIndex}"]`,
  );
  if (!currentImage) return;

  // Reset inline styles to allow CSS media queries to take effect
  currentImage.style.maxWidth = "";
  currentImage.style.maxHeight = "";

  // Force reflow
  void currentImage.offsetWidth;

  // Apply optimal sizing based on rotation
  if (currentRotation === 0 || currentRotation === 180) {
    // Portrait device orientation
    currentImage.style.maxWidth = "100%";
    currentImage.style.maxHeight = "100%";
  } else {
    // Landscape device orientation (rotated 90 or 270 degrees)
    currentImage.style.maxWidth = "100%";
    currentImage.style.maxHeight = "100%";
  }
}

// Separate function to update position based on current rotation and window size
function updateRotationPosition() {
  const isPortrait = currentRotation === 90 || currentRotation === 270;

  // Always keep the container fullscreen and centered
  imageContainer.style.width = "100vw";
  imageContainer.style.height = "100vh";
  imageContainer.style.position = "absolute";
  imageContainer.style.top = "0";
  imageContainer.style.left = "0";

  // Only apply the rotation transformation
  imageContainer.style.transform = `rotate(var(--ui-rotation))`;

  // Ensure images inside are properly centered and scaled regardless of rotation
  document.querySelectorAll(".image-slide").forEach((img) => {
    if (isPortrait) {
      // For portrait mode rotations (90 or 270 degrees)
      // Adjust the object-fit behavior to maintain maximum size and centering
      img.style.maxWidth = "100vh";
      img.style.maxHeight = "100vw";
    } else {
      // For landscape mode rotations (0 or 180 degrees)
      img.style.maxWidth = "100vw";
      img.style.maxHeight = "100vh";
    }
  });
}

// Add window resize listener to ensure images maintain proper sizing
window.addEventListener("resize", () => {
  // Small delay to ensure all DOM measurements are accurate after resize
  setTimeout(updateRotationPosition, 100);
});

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
  setTimeout(sendFullStateSync, 5000);
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
