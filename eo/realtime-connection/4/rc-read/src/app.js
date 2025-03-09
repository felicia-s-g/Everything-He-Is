const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdHR0eGx0aXBmZm1lcGJ1dHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1MzcyMjIsImV4cCI6MjA1NTExMzIyMn0.y7sdk3EWA49uTOO2b56rV-O4xKuYaE64JjCiB2HXxng";
const url = "https://witttxltipffmepbutsg.supabase.co";
const database = supabase.createClient(url, key);
const tableName = "realtimedatabase4";
const content = document.getElementById("content");

//read in realtime when dom is ready
document.addEventListener("DOMContentLoaded", async () => {
  //this will read the data from the database when we load the page
  readSupabase();
  //this will listen to the changes in the database
  readSupabaseRealTime();

  //iterate assets/data.json and add in the dom
  const data = await fetch("assets/data.json");
  const json = await data.json();
  json.data.forEach((element) => {
    const div = document.createElement("div");
    div.innerHTML = `<img src='assets/${element.image}' alt='${element.name}' data-tags='${element.tags}' />`;
    document.getElementById('content').appendChild(div);
  });
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
  } else {
    data = data[0];
  }
  const num = document.getElementById("num");
  num.innerHTML = data.values.num;

  //loop all the images, if they don't have the tag in the data.tags then hide them
  const images = document.querySelectorAll("img");
  images.forEach((element) => {
    if (element.dataset.tags.includes(data.values.num)) {
      element.style.opacity = 1;
    } else {
      element.style.opacity = 0.1;
    }
  });

}
