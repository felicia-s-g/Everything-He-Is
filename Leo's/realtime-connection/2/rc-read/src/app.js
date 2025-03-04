const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdHR0eGx0aXBmZm1lcGJ1dHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1MzcyMjIsImV4cCI6MjA1NTExMzIyMn0.y7sdk3EWA49uTOO2b56rV-O4xKuYaE64JjCiB2HXxng";
const url = "https://witttxltipffmepbutsg.supabase.co";
const database = supabase.createClient(url, key);
const tableName = "realtimedatabase2";
const idleTime = 10000;
const content = document.getElementById("content");


//read in realtime when dom is ready
document.addEventListener("DOMContentLoaded", async () => {
  //this will read the data from the database when we load the page
  readSupabase();
  //this will listen to the changes in the database
  readSupabaseRealTime();
});

//Listen to changes in the database
async function readSupabaseRealTime() {
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
  console.log("Reading data from Supabase");
  const { data } = await database
    .from(tableName)
    .select("*")
    .gte("updated_at", new Date(new Date() - idleTime).toISOString())
    .order("updated_at", { ascending: false });

  if (data && data.length > 0) {
    data.forEach(draw);
  } else {
    //remove all items if there is no data tha matches the query
    content.innerHTML = "";
  }
}

async function draw(data) {

  //data from realtime database and from the normal query is different so we unify it
  if (data.new) {
    data = data.new;
  }

  // Select all items
  const items = content.querySelectorAll(".item");

  // Remove the items that are older than idle time
  items.forEach((item) => {
    const updateTime = new Date(item.dataset.update + "Z");
    const currentTime = new Date();
    const timeDifference = currentTime - updateTime;
    // if the time difference is greater than idle time, remove the item
    if (timeDifference > idleTime) {
      item.remove();
    }
  });

  // Select the item by ID
  const item = document.getElementById(data.id);
  // if not found, create a new element and append it to the content
  if (!item) {
    let div = document.createElement("div");
    div.classList.add("item");
    div.id = data.id;
    div.dataset.update = data.updated_at;
    div.innerHTML = `ID: ${data.id}, X: ${data.values.x}, Y: ${
      data.values.y
    }, Last update: ${new Date(data.updated_at).toLocaleString()}`;
    content.appendChild(div);
  } else {
    // Otherwise, update the content of the item
    item.dataset.update = data.updated_at;
    item.innerHTML = `ID: ${data.id}, X: ${data.values.x}, Y: ${
      data.values.y
    }, Last update: ${new Date(data.updated_at).toLocaleString()}`;

    //creat a new item with the x and y values do show the dot/cursor
    let dot = document.createElement("div");
    dot.classList.add("dot");
    dot.classList.add("item");
    dot.style.left = data.values.x + "px";
    dot.style.top = data.values.y + "px";
    dot.innerHTML = data.id;
    item.appendChild(dot);
  }
}

//frame rate check every 10 seconds
setInterval(() => {
  console.log("Checking for updates");
  readSupabase();
}, idleTime);
