function draw(mouthOpening, distanceNoseEye) {
  document.querySelector("#emotion").innerHTML = distanceNoseEye;
  document.querySelector("#emotion").style.display = "block";
}

//function map
function map(value, x1, y1, x2, y2) {
  return ((value - x1) * (y2 - x2)) / (y1 - x1) + x2;
}