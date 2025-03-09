function draw(mouthOpening, distanceNoseEye) {
  if (distanceNoseEye > 100) {
    document.querySelector("#toggle1").checked = true;
  } else {
    document.querySelector("#toggle1").checked = false;
  }
}
