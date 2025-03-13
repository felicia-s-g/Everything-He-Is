let images = [];
let selectedIndex = 0;
const imageList = document.getElementById("image-list");
let isAutoScrolling = false; // Flag to track if auto-scrolling is in progress
let wsConnection = null; // WebSocket connection
let lastPunchTime = 0; // Track the last punch time
const PUNCH_COOLDOWN_MS = 1000; // Cooldown period between punches (1 second)
let lastOrientationTime = 0; // Track the last time orientation data was received
const ORIENTATION_TIMEOUT_MS = 3000; // If no orientation data for 3 seconds, use subtle breathing

// Initialize WebSocket connection
function initWebSocket() {
  // Close any existing connection
  if (wsConnection) {
    wsConnection.close();
  }

  // Create a new WebSocket connection
  const wsUrl = `wss://${window.location.hostname}/ws/data-output`;
  wsConnection = new WebSocket(wsUrl);

  // Connection opened
  wsConnection.addEventListener("open", (event) => {
    console.log("Connected to data-output WebSocket");
  });

  // Listen for messages
  wsConnection.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);

      // Handle punch intensity data
      if (data.punchIntensity !== undefined) {
        forceBasedScroll(data.punchIntensity);
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
async function fetchImages() {
  try {
    const response = await fetch("/api/images");
    if (!response.ok) {
      throw new Error("Failed to fetch images");
    }

    const imageData = await response.json();

    // Map the API response to the format we need
    images = imageData.map((img) => img.url);

    // Shuffle the images
    for (let i = images.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [images[i], images[j]] = [images[j], images[i]];
    }

    localStorage.setItem("shuffledImages", JSON.stringify(images));
    updatePreview();

    // Add scroll event listener after images are loaded
    setupScrollListener();

    // Setup the breathing animation
    setupBreathingAnimation();

    // Initialize WebSocket connection after images are loaded
    initWebSocket();
  } catch (error) {
    console.error("Error fetching images:", error);
    imageList.innerHTML =
      "<p>Error loading images. Please try again later.</p>";
  }
}

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
  if (!images.length || acceleration === undefined) return;

  // Check if we're still in cooldown period from the last punch
  const currentTime = Date.now();
  if (currentTime - lastPunchTime < PUNCH_COOLDOWN_MS) {
    console.log("Ignoring punch during cooldown period");
    return;
  }

  // Update the last punch time
  lastPunchTime = currentTime;

  // We already know the punch intensity is > 10 from the backend
  // Map the punch intensity to determine how many images to scroll
  // Higher intensity = more images scrolled
  const container = document.getElementById("preview-container");

  // Set auto-scrolling flag to prevent interference from scroll event listener
  // and to prevent scaling during punch scrolling
  isAutoScrolling = true;

  // Calculate how many images to scroll (3-10 based on intensity)
  // Modified formula to scroll more images at once
  const imagesToScroll = Math.ceil((acceleration - 8) / 10) + 3;

  // Calculate the normalized intensity (10-100)
  const normalizedIntensity = Math.min(Math.max(acceleration, 10), 100);

  // Always scroll forward (direction = 1)
  const direction = 1;

  // Calculate new index, ensuring it stays within bounds
  let newIndex = selectedIndex + (direction * imagesToScroll);
  newIndex = Math.max(0, Math.min(newIndex, images.length - 1));

  // Get the target image element
  const targetImage = document.getElementById(`image-${newIndex}`);

  if (targetImage) {
    // Reset any scaling during punch scrolling
    document.querySelectorAll(".preview-image").forEach((img) => {
      if (parseInt(img.dataset.index) === selectedIndex) {
        img.style.transform = "scale(1.0)";
      }
    });

    // Calculate scroll duration based on intensity (faster for stronger punches)
    // Inverse relationship: higher intensity = shorter duration
    const scrollDuration = Math.max(300, 1000 - (normalizedIntensity * 5));

    // Scroll to the target image
    smoothScrollTo(
      container,
      targetImage.offsetTop - (container.clientHeight / 2) +
        (targetImage.clientHeight / 2),
      scrollDuration,
      () => {
        // Reset auto-scrolling flag when animation completes
        isAutoScrolling = false;
        // Update the selected image
        updateSelectedImage(newIndex);
      },
    );

    // Log the punch event for debugging
    console.log(
      `Punch detected! Intensity: ${acceleration}, Scrolling ${imagesToScroll} images forward`,
    );
  } else {
    isAutoScrolling = false;
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


document.addEventListener("DOMContentLoaded", function() {
  const imageContainer = document.getElementById("image-container");
  let images = [];
  let selectedIndex = 0;

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
      images.forEach((src, index) => {
          let img = document.createElement("img");
          img.src = src;
          img.classList.add("image-slide");
          if (index !== 0) {
              img.style.opacity = "0";
          }
          imageContainer.appendChild(img);
      });
  }

  function nextImage() {
      let currentImage = document.querySelectorAll(".image-slide")[selectedIndex];
      currentImage.classList.add("flying-away");
      
      setTimeout(() => {
          currentImage.style.display = "none";
          selectedIndex = (selectedIndex + 1) % images.length;
          let nextImage = document.querySelectorAll(".image-slide")[selectedIndex];
          nextImage.style.opacity = "1";
      }, 800);
  }

  document.addEventListener("click", nextImage);
  document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") nextImage();
  });

  fetchImages();
});
