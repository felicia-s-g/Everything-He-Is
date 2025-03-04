let mongolfiera = document.querySelector("#mongolfiera");

function draw(distanceNoseEye) {
  document.querySelector("#emotion").innerHTML = distanceNoseEye;
  document.querySelector("#emotion").style.display = "block";
  let blur = map(distanceNoseEye, 100, 0, 0, 10);
  mongolfiera.style.filter = `blur(${blur}px)`;
}

//function map
function map(value, x1, y1, x2, y2) {
  return ((value - x1) * (y2 - x2)) / (y1 - x1) + x2;
}
