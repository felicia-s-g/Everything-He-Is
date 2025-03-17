// Global variables
let images = [];
let currentIndex = 0;
let wsConnection = null;
let lastPunchTime = 0;
let isTransitioning = false;
let zoomLevel = 1;
let rotationX = 0;
let rotationY = 0;
let canvasContext;
let particles = [];
let lastScrollDirection = 0;

// Configuration
const config = {
  punch: {
    threshold: 3,
    cooldown: 200,
    maxStrength: 30,
  },
  zoom: {
    min: 0.5,
    max: 2.5,
    speed: 0.05,
  },
  rotation: {
    maxDegrees: 25,
    damping: 0.95,
  },
  particles: {
    count: 100,
    maxSize: 5,
    minSize: 1,
    speed: 1.5,
  },
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initCanvas();
  fetchImages();
  initWebSocket();
  setupEventListeners();
  animateBackground();
});

// WebSocket connection for gesture data
function initWebSocket() {
  if (wsConnection) wsConnection.close();

  const wsUrl = `wss://${window.location.host}/ws/ui-signals`;
  wsConnection = new WebSocket(wsUrl);

  wsConnection.addEventListener("open", () => {
    console.log("Connected to WebSocket");
  });

  wsConnection.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);

      // Handle punch data
      if (data.type === "punch") {
        handlePunch(data.acceleration);
      }

      // Handle orientation/tilt data
      if (data.type === "tilt" && data.tilt) {
        handleTilt(data.tilt);
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });

  wsConnection.addEventListener("close", () => {
    console.log("WebSocket connection closed");
    setTimeout(initWebSocket, 3000);
  });

  wsConnection.addEventListener("error", (event) => {
    console.error("WebSocket error:", event);
  });
}

// Handle punch gestures for image transitions
function handlePunch(acceleration) {
  const now = Date.now();

  if (now - lastPunchTime < config.punch.cooldown || isTransitioning) {
    return;
  }

  if (acceleration < config.punch.threshold) {
    return;
  }

  lastPunchTime = now;
  isTransitioning = true;

  // Normalize punch strength
  const strength = Math.min(acceleration / config.punch.maxStrength, 1);

  // Add specific visual effects based on punch strength
  const currentImage = document.querySelector(
    `.image-slide[data-index="${currentIndex}"]`,
  );
  if (!currentImage) return;

  // Add punch animation
  currentImage.classList.add("punch-transition");

  // Generate particles based on punch strength
  createParticleBurst(strength * 15 + 5);

  // Wait for animation to complete
  setTimeout(() => {
    // Remove animation class and hide current image
    currentImage.classList.remove("punch-transition");
    currentImage.style.display = "none";

    // Update index and show next image
    const skipCount = Math.max(1, Math.round(strength * 3));
    currentIndex = (currentIndex + skipCount) % images.length;
    showCurrentImage();

    setTimeout(() => {
      isTransitioning = false;
    }, 100);
  }, 500);
}

// Handle tilt data for orientation effects
function handleTilt(tilt) {
  // Extract tilt data
  const { beta, gamma } = tilt;

  // Apply tilt/orientation to current image
  rotationX = (beta / 180) * config.rotation.maxDegrees;
  rotationY = (gamma / 90) * config.rotation.maxDegrees;

  // Apply rotation to current image
  const currentImage = document.querySelector(
    `.image-slide[data-index="${currentIndex}"]`,
  );
  if (!currentImage) return;

  updateImageTransform(currentImage);
}

// Fetch images from server
async function fetchImages() {
  try {
    const response = await fetch("/api/images");
    const data = await response.json();

    if (data && data.images) {
      images = data.images;
      loadImages();
    }
  } catch (error) {
    console.error("Error fetching images:", error);

    // Fallback to using placeholder images for testing
    images = Array.from(
      { length: 10 },
      (_, i) => `/placeholder/image${i + 1}.jpg`,
    );
    loadImages();
  }
}

// Load and display images
function loadImages() {
  const container = document.getElementById("trippy-container");
  container.innerHTML = "";

  images.forEach((image, index) => {
    const img = document.createElement("img");
    img.src = image;
    img.className = "image-slide";
    img.dataset.index = index;
    img.style.display = index === currentIndex ? "block" : "none";

    // Set initial transform
    if (index === currentIndex) {
      updateImageTransform(img);
    }

    container.appendChild(img);
  });

  // Trigger initial warping effect
  const currentImage = document.querySelector(
    `.image-slide[data-index="${currentIndex}"]`,
  );
  if (currentImage) {
    currentImage.classList.add("warped");
    setTimeout(() => currentImage.classList.remove("warped"), 500);
  }
}

// Show current image with effects
function showCurrentImage() {
  const allImages = document.querySelectorAll(".image-slide");

  allImages.forEach((img) => {
    const index = parseInt(img.dataset.index);
    img.style.display = index === currentIndex ? "block" : "none";

    if (index === currentIndex) {
      // Reset transform
      img.style.transform = "scale(1) rotateX(0deg) rotateY(0deg)";
      zoomLevel = 1;

      // Add initial warping effect
      img.classList.add("warped");
      img.classList.add("glow-effect");

      setTimeout(() => {
        img.classList.remove("warped");
        updateImageTransform(img);
      }, 500);
    }
  });
}

// Update image transform based on zoom and rotation
function updateImageTransform(imageElement) {
  if (!imageElement) return;

  const transform = `
    scale(${zoomLevel})
    rotateX(${rotationX}deg)
    rotateY(${rotationY}deg)
  `;

  imageElement.style.transform = transform;
}

// Setup event listeners for scroll and touch
function setupEventListeners() {
  // Scroll for zoom
  window.addEventListener("wheel", (event) => {
    // Determine scroll direction
    const direction = event.deltaY > 0 ? -1 : 1;

    // Apply zoom
    zoomLevel += direction * config.zoom.speed;
    zoomLevel = Math.max(config.zoom.min, Math.min(config.zoom.max, zoomLevel));

    // Apply to current image
    const currentImage = document.querySelector(
      `.image-slide[data-index="${currentIndex}"]`,
    );
    if (currentImage) {
      updateImageTransform(currentImage);
    }

    // Detect rapid direction changes for image transitions
    if (lastScrollDirection !== 0 && lastScrollDirection !== direction) {
      const now = Date.now();
      if (now - lastPunchTime > config.punch.cooldown && !isTransitioning) {
        handlePunch(config.punch.threshold + 1); // Trigger a minimal strength punch
      }
    }

    lastScrollDirection = direction;
  });

  // Button for testing (can be removed in production)
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      handlePunch(15); // Medium punch
    }
  });
}

// Initialize canvas for background effects
function initCanvas() {
  const canvas = document.getElementById("background-canvas");
  canvasContext = canvas.getContext("2d");

  // Set canvas size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Initialize particles
  createParticles();

  // Handle resize
  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createParticles();
  });
}

// Create background particles
function createParticles() {
  particles = [];

  for (let i = 0; i < config.particles.count; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size:
        Math.random() * (config.particles.maxSize - config.particles.minSize) +
        config.particles.minSize,
      speedX: (Math.random() - 0.5) * config.particles.speed,
      speedY: (Math.random() - 0.5) * config.particles.speed,
      color: getRandomColor(0.5),
    });
  }
}

// Create a burst of particles for punch effect
function createParticleBurst(count) {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;

    particles.push({
      x: centerX,
      y: centerY,
      size: Math.random() * 8 + 2,
      speedX: Math.cos(angle) * speed,
      speedY: Math.sin(angle) * speed,
      color: getRandomColor(0.7),
      life: 100,
    });
  }
}

// Generate random color
function getRandomColor(alpha = 1) {
  const hue = Math.floor(Math.random() * 360);
  return `hsla(${hue}, 80%, 60%, ${alpha})`;
}

// Animate background
function animateBackground() {
  if (!canvasContext) return;

  // Clear canvas
  canvasContext.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // Update and draw particles
  particles.forEach((particle, index) => {
    // Update position
    particle.x += particle.speedX;
    particle.y += particle.speedY;

    // Wrap around screen
    if (particle.x < 0) particle.x = window.innerWidth;
    if (particle.x > window.innerWidth) particle.x = 0;
    if (particle.y < 0) particle.y = window.innerHeight;
    if (particle.y > window.innerHeight) particle.y = 0;

    // Decrease life for burst particles
    if (particle.life !== undefined) {
      particle.life -= 1;
      if (particle.life <= 0) {
        particles.splice(index, 1);
        return;
      }
    }

    // Draw particle
    canvasContext.beginPath();
    canvasContext.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    canvasContext.fillStyle = particle.color;
    canvasContext.fill();
  });

  // Apply subtle distortion based on current rotation
  const gradient = canvasContext.createRadialGradient(
    window.innerWidth / 2,
    window.innerHeight / 2,
    10,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerWidth * 0.8,
  );

  gradient.addColorStop(
    0,
    `rgba(${Math.abs(rotationY * 10)}, ${Math.abs(rotationX * 10)}, 100, 0.05)`,
  );
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  canvasContext.fillStyle = gradient;
  canvasContext.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // Continue animation loop
  requestAnimationFrame(animateBackground);
}

// Update rotation with smooth damping
function updateRotation() {
  // Apply damping
  rotationX *= config.rotation.damping;
  rotationY *= config.rotation.damping;

  // Update image transform
  const currentImage = document.querySelector(
    `.image-slide[data-index="${currentIndex}"]`,
  );
  if (currentImage) {
    updateImageTransform(currentImage);
  }

  requestAnimationFrame(updateRotation);
}

// Start rotation update loop
requestAnimationFrame(updateRotation);
