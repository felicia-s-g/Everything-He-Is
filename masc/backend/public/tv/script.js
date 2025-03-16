let images = [];
let selectedIndex = 0;
const imageList = document.getElementById("image-list");
let isAutoScrolling = false; // Flag to track if auto-scrolling is in progress
let wsConnection = null; // WebSocket connection
let lastPunchTime = 0; // Track the last punch time
const PUNCH_COOLDOWN_MS = 1000; // Cooldown period between punches (1 second)
let lastOrientationTime = 0; // Track the last time orientation data was received
const ORIENTATION_TIMEOUT_MS = 3000; // If no orientation data for 3 seconds, use subtle breathing

function nextImage() {
  let currentImage = document.querySelectorAll(".image-slide")[selectedIndex];

  // Save current transform state if it exists
  const currentTransform = currentImage.style.transform || "scale(1)";

  // Add flying away class while keeping current transform as starting point
  currentImage.style.transform = currentTransform;
  currentImage.classList.add("flying-away");

  setTimeout(() => {
    selectedIndex = (selectedIndex + 1) % images.length;
    let next = document.querySelectorAll(".image-slide")[selectedIndex];

    // Reset the new image's transform before making it visible
    next.style.transform = "scale(1)";
    next.style.opacity = "1";

    // Hide the previous image
    currentImage.style.display = "none";
  }, 350);
}

// Initialize WebSocket connection
function initWebSocket() {
  // Close any existing connection
  if (wsConnection) {
    wsConnection.close();
  }

  // Create a new WebSocket connection
  const wsUrl = `wss://${window.location.host}/ws/ui-signals`;
  wsConnection = new WebSocket(wsUrl);

  // Connection opened
  wsConnection.addEventListener("open", (event) => {
    console.log("Connected to ui-signals WebSocket");
  });

  // Listen for messages
  wsConnection.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);

      // Handle punch intensity data
      if (data.type === "punch") {
        forceBasedScroll(data.acceleration);
      }

      // Handle tilt data
      if (data.type === "tilt" && data.tilt) {
        tiltBasedZoom(data.tilt);
      }

      // Handle orientation data
      console.log("data", data);
      if (
        data.type === "orientation" &&
        data.orientation
      ) {
        orientationBasedScaling(data.orientation);
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });

  // Connection closed
  wsConnection.addEventListener("close", (event) => {
    console.log("WebSocket connection closed");
    // Try to reconnect after a delay
    setTimeout(initWebSocket, 5000);
  });

  // Connection error
  wsConnection.addEventListener("error", (event) => {
    console.error("WebSocket error:", event);
    wsConnection.close();
  });
}

// Fetch images from the API endpoint
function updatePreview() {
  imageList.innerHTML = "";
  images.forEach((imgSrc, index) => {
    const imgElement = document.createElement("img");
    imgElement.src = imgSrc;
    imgElement.className = "preview-image";
    imgElement.id = `image-${index}`;
    imgElement.dataset.index = index; // Store index as data attribute
    if (index === selectedIndex) {
      imgElement.classList.add("selected");
    }
    imgElement.onclick = () => {
      selectedIndex = index;
      localStorage.setItem("selectedIndex", selectedIndex);
      window.dispatchEvent(new Event("storage"));
      updateSelectedImage(index);
    };
    imageList.appendChild(imgElement);
  });
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
// acceleration starts from 10, as by the IoS accelerometer
function forceBasedScroll(acceleration) {
  // Only process if we have images and the punch intensity is provided
  for (let i = 0; i < Math.floor(acceleration / 2); i++) {
    nextImage();
  }
}

// Function to apply a subtle breathing effect when no orientation data is received
function applySubtleBreathing() {
  const currentTime = Date.now();

  // Only apply breathing if we haven't received orientation data recently
  if (currentTime - lastOrientationTime > ORIENTATION_TIMEOUT_MS) {
    // Create a subtle pulsing effect using sine wave
    const breatheFactor = 1 + (Math.sin(currentTime / 1000) * 0.03); // Subtle 3% variation

    document.querySelectorAll(".preview-image").forEach((img) => {
      const index = parseInt(img.dataset.index);
      const isSelected = index === selectedIndex;

      // Base scale is different for selected vs non-selected images
      const baseScale = isSelected ? 1.15 : 1.0;

      // Calculate distance from selected for a wave-like effect
      const distanceFromSelected = Math.abs(index - selectedIndex);

      // Create a wave effect by offsetting the sine wave based on distance
      const waveOffset = distanceFromSelected * 0.5; // Half a second offset per image away
      const waveBreatheFactor = 1 +
        (Math.sin((currentTime / 1000) + waveOffset) * 0.03);

      // Apply the breathing effect with subtle rotation
      const rotationAmount = Math.sin((currentTime / 1500) + waveOffset) * 0.5; // Very subtle rotation

      img.style.transform = `scale(${baseScale * waveBreatheFactor}) 
                            rotateY(${rotationAmount}deg) 
                            rotateZ(${rotationAmount * 0.5}deg)`;

      // Add a subtle transition delay based on distance from selected image
      img.style.transitionDelay = `${distanceFromSelected * 20}ms`;
    });
  }

  // Continue the animation
  requestAnimationFrame(applySubtleBreathing);
}

// Update orientationBasedScaling to track the last time orientation data was received
function orientationBasedScaling(orientation) {
  console.log("orientationBasedScaling", orientation);
  // Only process if we have orientation data and images
  if (!orientation || !images.length) return;

  // Skip scaling if auto-scrolling is in progress (during punch)
  if (isAutoScrolling) return;

  // Update the last orientation time
  lastOrientationTime = Date.now();

  // Extract orientation values
  const { x } = orientation;

  // Convert x to a value between 0 and 1 for scaling
  // First normalize to -180 to 180 range
  const normalizedX = x > 180 ? x - 360 : x;

  // Calculate scaling factor based on tilt
  // Use absolute value to make both left and right tilts increase scale
  // This matches the oscillation pattern of the device/punching bag
  const tiltAmount = Math.min(Math.abs(normalizedX) / 45, 1); // 0 to 1 based on tilt angle, capped at 45 degrees

  // Apply scaling to all images
  document.querySelectorAll(".preview-image").forEach((img) => {
    const index = parseInt(img.dataset.index);
    const isSelected = index === selectedIndex;

    if (isSelected) {
      // For selected image: scale between 100% and 200% based on tilt
      const selectedScaleFactor = 1 + tiltAmount; // Scale between 1.0 and 2.0
      img.style.transform = `scale(${selectedScaleFactor})`;
    } else {
      // For non-selected images: keep at normal scale
      img.style.transform = `scale(1.0)`;
    }

    // Add a subtle transition delay based on distance from selected image
    const distanceFromSelected = Math.abs(index - selectedIndex);
    img.style.transitionDelay = `${distanceFromSelected * 30}ms`;
  });
}

// Function to zoom/enlarge images based on tilt value
function tiltBasedZoom(tilt) {
  // Skip if no images or auto-scrolling is in progress
  if (!images.length || isAutoScrolling) return;

  console.log("Tilt-based zoom:", tilt);

  // Track when we last received tilt data
  lastOrientationTime = Date.now();

  // Ensure tilt is a number and has a reasonable value
  const tiltValue = typeof tilt === "number" ? tilt : parseFloat(tilt);
  if (isNaN(tiltValue)) return;

  // Map tilt values to a much subtler zoom range (approx. 10x weaker)
  // Assuming tilt values can be between 0 and 1 (normalized in the server)
  const minZoom = 1.0; // No zoom
  const maxZoom = 1.15; // Maximum zoom level - much subtler (was 2.5)
  const zoomFactor = minZoom +
    (Math.min(Math.max(tiltValue, 0), 1) * (maxZoom - minZoom));

  // Apply zoom to the currently selected image
  const currentImage = document.querySelectorAll(".image-slide")[selectedIndex];
  if (currentImage) {
    // Apply faster transition for more responsiveness
    currentImage.style.transition = "transform 0.15s ease-out";

    // Calculate a much subtler rotation based on tilt value
    const rotationAmount = tiltValue * 0.5; // Reduced rotation (was 5 degrees)

    // Apply both zoom and rotation
    currentImage.style.transform =
      `scale(${zoomFactor}) rotate(${rotationAmount}deg)`;

    // Store the current tilt value for potential use in other animations
    currentImage.dataset.currentTilt = tiltValue;
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const imageContainer = document.getElementById("image-container");
  initWebSocket();

  async function fetchImages() {
    try {
      const response = await fetch("/api/images");
      if (!response.ok) {
        throw new Error("Failed to fetch images");
      }

      const imageData = await response.json();
      images = imageData.map((img) => img.url);

      // Shuffle the images
      for (let i = images.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [images[i], images[j]] = [images[j], images[i]];
      }

      localStorage.setItem("shuffledImages", JSON.stringify(images));
      loadImages();
    } catch (error) {
      console.error("Error fetching images:", error);
    }
  }

  // this the current function for the weird image effect
  function loadImages() {
    imageContainer.innerHTML = ""; // Clear container before loading new images

    images.forEach((src, index) => {
      let img = document.createElement("img");
      img.src = src;
      img.classList.add("image-slide");

      // Set initial styles with faster transitions matching the zoom function
      img.style.transition = "transform 0.15s ease-out, opacity 0.3s ease-out";
      img.style.transformOrigin = "center center";

      if (index !== 0) {
        img.style.opacity = "0";
      } else {
        // Apply initial transform to the first (visible) image
        img.style.transform = "scale(1)";
      }

      imageContainer.appendChild(img);
    });

    // Start the subtle breathing animation
    applySubtleBreathing();
  }

  document.addEventListener("click", nextImage);
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") nextImage();
  });

  fetchImages();
});
