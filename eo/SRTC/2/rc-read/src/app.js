const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdHR0eGx0aXBmZm1lcGJ1dHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1MzcyMjIsImV4cCI6MjA1NTExMzIyMn0.y7sdk3EWA49uTOO2b56rV-O4xKuYaE64JjCiB2HXxng";
const url = "https://witttxltipffmepbutsg.supabase.co";
const database = supabase.createClient(url, key);
const tableName = "realtimedatabase6";

//dom elements
const distance = document.getElementById("distance");
const rotation = document.getElementById("rotation");

document.addEventListener("DOMContentLoaded", async () => {
  //subscribe to changes in the
  database
    .channel(tableName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: tableName },
      (payload) => {
        handleInserts(payload.new);
      }
    )
    .subscribe();

  //select all data from touch
  let { data, error } = await database.from(tableName).select("*");
  handleInserts(data[0]);
});

function handleInserts(data) {
  distance.innerHTML = data.values.distance;
  rotation.innerHTML = data.values.rotation;
  const rect = document.getElementById("rect");
  rect.style.width = data.values.distance + "px";
  rect.style.transform = `rotate(${data.values.rotation}deg)`;
}
