const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdHR0eGx0aXBmZm1lcGJ1dHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1MzcyMjIsImV4cCI6MjA1NTExMzIyMn0.y7sdk3EWA49uTOO2b56rV-O4xKuYaE64JjCiB2HXxng";
const url = "https://witttxltipffmepbutsg.supabase.co";
const database = supabase.createClient(url, key);
const tableName = "realtimedatabase6";


const drawingArea = document.getElementById("drawingArea");
const distanceOutput = document.getElementById("distanceOutput");
const rotationOutput = document.getElementById("rotationOutput");
const lineSvg = document.getElementById("lineSvg");

const id = 1;
const activeTouches = {};
let line = null;



function updateLine() {
  const touchPoints = Object.values(activeTouches);
  if (touchPoints.length === 2) {
    if (!line) {
      line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("stroke", "black");
      line.setAttribute("stroke-width", "2");
      lineSvg.appendChild(line);
    }
    line.setAttribute("x1", touchPoints[0].style.left.replace("px", ""));
    line.setAttribute("y1", touchPoints[0].style.top.replace("px", ""));
    line.setAttribute("x2", touchPoints[1].style.left.replace("px", ""));
    line.setAttribute("y2", touchPoints[1].style.top.replace("px", ""));

    const xDiff =
      touchPoints[0].style.left.replace("px", "") -
      touchPoints[1].style.left.replace("px", "");
    const yDiff =
      touchPoints[0].style.top.replace("px", "") -
      touchPoints[1].style.top.replace("px", "");
    const distance = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
    distanceOutput.textContent = distance.toFixed(2);

    const rotation = Math.atan2(yDiff, xDiff);
    const rotationDeg = rotation * (180 / Math.PI);
    rotationOutput.textContent = rotationDeg.toFixed(2);

    updateSupabase(distance.toFixed(2), rotationDeg.toFixed(2));
  } else {
    if (line) {
      lineSvg.removeChild(line);
      line = null;
    }
  }
}

drawingArea.addEventListener(
  "touchstart",
  function (e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (Object.keys(activeTouches).length < 2) {
        const touchPointDiv = document.createElement("div");
        touchPointDiv.className = "touchPoint";
        touchPointDiv.style.left = `${touch.pageX}px`;
        touchPointDiv.style.top = `${touch.pageY}px`;
        drawingArea.appendChild(touchPointDiv);
        activeTouches[touch.identifier] = touchPointDiv;
      }
    }
    updateLine();
  },
  { passive: false }
);

drawingArea.addEventListener(
  "touchmove",
  function (e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const touchPointDiv = activeTouches[touch.identifier];
      if (touchPointDiv) {
        touchPointDiv.style.left = `${touch.pageX}px`;
        touchPointDiv.style.top = `${touch.pageY}px`;
      }
    }
    updateLine();
  },
  { passive: false }
);

drawingArea.addEventListener(
  "touchend",
  function (e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const touchPointDiv = activeTouches[touch.identifier];
      if (touchPointDiv) {
        touchPointDiv.remove();
        delete activeTouches[touch.identifier];
      }
    }
    updateLine();
  },
  { passive: false }
);

drawingArea.addEventListener(
  "touchcancel",
  function (e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const touchPointDiv = activeTouches[touch.identifier];
      if (touchPointDiv) {
        touchPointDiv.remove();
        delete activeTouches[touch.identifier];
      }
    }
    updateLine();
  },
  { passive: false }
);

async function updateSupabase(distance, rotation) {
  let res = await database
    .from(tableName)
    .update({
      values: {
        distance: distance,
        rotation: rotation,
      },
      updated_at: new Date(),
    })
    .eq("id", id);
}
