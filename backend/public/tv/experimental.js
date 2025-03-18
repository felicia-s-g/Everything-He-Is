let images = [];
let currentIndex = 0;
let wsConnection = null;
let lastActionTime = 0;
const ACTION_COOLDOWN_MS = 250;
let isTransitioning = false;

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
        handlePunchAction(data.acceleration);
      }

      // Handle tilt data
      if (data.type === "tilt" && data.tilt) {
        handleTiltAction(data.tilt);
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

// Handle punch-based actions with snap animations
function handlePunchAction(acceleration) {
  // Apply cooldown and check if images exist
  if (isTransitioning || !images.length) return;

  const now = Date.now();
  if (now - lastActionTime < ACTION_COOLDOWN_MS) return;
  lastActionTime = now;

  // Set minimum threshold and normalize acceleration
  const minAcceleration = 5;
  const maxAcceleration = 40;

  if (acceleration < minAcceleration) return;

  const normalizedStrength = Math.min(
    (acceleration - minAcceleration) / (maxAcceleration - minAcceleration),
    1.0,
  );

  // Trigger glitch effect followed by snap transition
  const currentImage = document.querySelectorAll(".gallery-item")[currentIndex];
  if (!currentImage) return;

  isTransitioning = true;

  // Apply glitch effect first
  currentImage.classList.add("glitch-effect");

  // Calculate how many images to skip based on punch strength
  const imagesCount = Math.max(1, Math.floor(normalizedStrength * 5));

  setTimeout(() => {
    // Remove glitch effect and add exit animation
    currentImage.classList.remove("glitch-effect");
    currentImage.classList.add("exit-animation");

    setTimeout(() => {
      // Update index and show next image with snap animation
      currentImage.style.display = "none";
      currentImage.classList.remove("exit-animation");

      currentIndex = (currentIndex + imagesCount) % images.length;
      showCurrentImage(true); // true = use snap animation

      isTransitioning = false;
    }, 400); // Match the exit animation duration
  }, 200); // Match the glitch animation duration
}

// Handle tilt-based distortion effects
function handleTiltAction(tilt) {
  if (!images.length || isTransitioning) return;

  // Ensure tilt is a number with reasonable value
  const tiltValue = typeof tilt === "number" ? tilt : parseFloat(tilt);
  if (isNaN(tiltValue)) return;

  // Get current image
  const currentImage = document.querySelectorAll(".gallery-item")[currentIndex];
  if (!currentImage) return;

  // Map tilt value to distortion effect strength
  const normalizedTilt = Math.min(Math.max(tiltValue, 0), 1);

  // Apply chromatic aberration effect proportional to tilt
  const redOffset = normalizedTilt * 10;
  const blueOffset = normalizedTilt * -10;

  // Apply filter transforms based on tilt value
  currentImage.style.filter = `
    hue-rotate(${normalizedTilt * 30}deg)
    contrast(${100 + normalizedTilt * 50}%)
    saturate(${100 + normalizedTilt * 100}%)
  `;

  // Apply skew and rotation effects
  const skewAmount = normalizedTilt * 5;
  const rotateAmount = normalizedTilt * 3;

  currentImage.style.transform = `
    perspective(800px)
    skew(${skewAmount}deg, ${skewAmount * 0.5}deg)
    rotate(${rotateAmount}deg)
    scale(${1 + normalizedTilt * 0.15})
  `;
}

// Show the current image with optional snap animation
function showCurrentImage(withSnap = false) {
  const galleryContainer = document.getElementById("gallery-container");
  const items = document.querySelectorAll(".gallery-item");

  // Hide all images first
  items.forEach((item) => {
    item.style.opacity = "0";
    item.style.display = "none";
  });

  // Show the current image
  const currentImage = items[currentIndex];
  if (currentImage) {
    currentImage.style.display = "block";

    // Reset filter and transform
    currentImage.style.filter = "none";

    if (withSnap) {
      // Start from a slightly offset position
      currentImage.style.transform = "scale(0.9) translateY(10px)";
      currentImage.classList.add("snap-transition");

      // Force reflow to ensure the animation triggers
      void currentImage.offsetWidth;

      // Snap into final position
      currentImage.style.transform = "scale(1) translateY(0)";
      currentImage.style.opacity = "1";

      // Remove transition class after animation completes
      setTimeout(() => {
        currentImage.classList.remove("snap-transition");
      }, 100);
    } else {
      currentImage.style.transform = "scale(1)";
      currentImage.style.opacity = "1";
    }
  }
}

// Trigger random glitch effect
function triggerRandomGlitch() {
  if (!images.length || isTransitioning) return;

  const currentImage = document.querySelectorAll(".gallery-item")[currentIndex];
  if (!currentImage) return;

  // Apply random glitch styles
  const glitchTypes = [
    "hue-rotate(90deg) saturate(200%)",
    "contrast(180%) brightness(120%)",
    "invert(80%) hue-rotate(-60deg)",
    "blur(2px) brightness(150%)",
    "saturate(0%) brightness(150%)",
  ];

  const randomGlitch =
    glitchTypes[Math.floor(Math.random() * glitchTypes.length)];
  currentImage.style.filter = randomGlitch;

  // Reset after short delay
  setTimeout(() => {
    currentImage.style.filter = "none";
  }, 100 + Math.random() * 200);
}

// Set up periodic random glitches
function setupRandomGlitches() {
  // Trigger a random glitch every 3-8 seconds
  setInterval(() => {
    if (Math.random() > 0.5 && !isTransitioning) { // 50% chance to glitch
      triggerRandomGlitch();
    }
  }, 3000 + Math.random() * 5000);
}

// Load images from API
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

    loadImages();
  } catch (error) {
    console.error("Error fetching images:", error);
  }
}

// Load images into gallery
function loadImages() {
  const galleryContainer = document.getElementById("gallery-container");
  galleryContainer.innerHTML = ""; // Clear container

  images.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.classList.add("gallery-item");

    // Set initial styles
    img.style.opacity = index === currentIndex ? "1" : "0";
    img.style.display = index === currentIndex ? "block" : "none";
    img.style.transform = "scale(1)";

    galleryContainer.appendChild(img);
  });
}

// Next image with glitch transition
function nextImage() {
  if (isTransitioning || !images.length) return;

  isTransitioning = true;

  const currentImage = document.querySelectorAll(".gallery-item")[currentIndex];
  if (!currentImage) {
    isTransitioning = false;
    return;
  }

  // Apply glitch effect
  currentImage.classList.add("glitch-effect");

  setTimeout(() => {
    // Remove glitch and add exit animation
    currentImage.classList.remove("glitch-effect");
    currentImage.classList.add("exit-animation");

    setTimeout(() => {
      // Update index and display next image
      currentImage.style.display = "none";
      currentImage.classList.remove("exit-animation");

      currentIndex = (currentIndex + 1) % images.length;
      showCurrentImage(true);

      isTransitioning = false;
    }, 400);
  }, 200);
}

// Initialize everything when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  initWebSocket();
  fetchImages();
  setupRandomGlitches();

  // Set up event listeners
  document.addEventListener("click", nextImage);
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === " ") {
      nextImage();
    }
  });

  // Handle window resize
  window.addEventListener("resize", () => {
    // Re-center current image if needed
    const currentImage =
      document.querySelectorAll(".gallery-item")[currentIndex];
    if (currentImage && !isTransitioning) {
      currentImage.style.transform = "scale(1)";
    }
  });
});
