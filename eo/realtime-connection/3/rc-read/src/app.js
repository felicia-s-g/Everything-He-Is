const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdHR0eGx0aXBmZm1lcGJ1dHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1MzcyMjIsImV4cCI6MjA1NTExMzIyMn0.y7sdk3EWA49uTOO2b56rV-O4xKuYaE64JjCiB2HXxng";
const url = "https://witttxltipffmepbutsg.supabase.co";
const database = supabase.createClient(url, key);
const tableName = "realtimedatabase3";

//read in realtime when dom is ready
document.addEventListener("DOMContentLoaded", async () => {
  //this will read the data from the database when we load the page
  readSupabase();
  //this will listen to the changes in the database
  readSupabaseRealTime();
});

async function readSupabaseRealTime() {
  //Listen to changes in the database
  database
    .channel(tableName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: tableName },
      (data) => {
        draw(data);
      }
    )
    .subscribe();
}

async function readSupabase() {
  let { data, error } = await database.from(tableName).select("*");
  draw(data);
}

async function draw(data) {
  //data from realtime database and from the normal query is different so we unify it
  if (data.new) {
    data = data.new;
  }
  else {
    data = data[0];
  }
  const num = document.getElementById("num");
  const z = document.getElementById("z");
  num.innerHTML = data.values.num;
  z.innerHTML = data.values.z;

  //change image based on the value num and zoom
  const img = document.getElementById("img");
  img.src = `assets/${data.values.num}.jpg`;
  img.style.width = `${data.values.z}%`;
}
