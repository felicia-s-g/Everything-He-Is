const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdHR0eGx0aXBmZm1lcGJ1dHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1MzcyMjIsImV4cCI6MjA1NTExMzIyMn0.y7sdk3EWA49uTOO2b56rV-O4xKuYaE64JjCiB2HXxng";
const url = "https://witttxltipffmepbutsg.supabase.co";
const database = supabase.createClient(url, key);
const tableName = "realtimedatabase7";
const id = 1;
let main = document.getElementById("main");
let touchCount = 0;
main.addEventListener(
  "touchstart",
  function (event) {
    touchCount = event.touches.length; // Update the count with the number of touches currently on the screen
    updateSupabase(touchCount);
    console.log("Fingers touching:", touchCount);
    document.getElementById("touchCount").innerHTML = touchCount;

  },
  { passive: false }
);

main.addEventListener(
  "touchmove",
  function (event) {
    touchCount = event.touches.length; // Update the count with the number of touches currently on the screen
    updateSupabase(touchCount);
    console.log("Fingers touching:", touchCount);
    document.getElementById("touchCount").innerHTML = touchCount;

  },
  { passive: false }
);


main.addEventListener(
  "touchend",
  function (e) {
    e.preventDefault();
    updateSupabase(0);
    document.getElementById("touchCount").innerHTML = "0";
  },
  { passive: false }
);



async function updateSupabase(num) {
  let res = await database
    .from(tableName)
    .update({
      values: {
        num: num,
      },
      updated_at: new Date(),
    })
    .eq("id", id);
}
