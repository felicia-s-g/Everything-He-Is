//rc-write-2

const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdHR0eGx0aXBmZm1lcGJ1dHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1MzcyMjIsImV4cCI6MjA1NTExMzIyMn0.y7sdk3EWA49uTOO2b56rV-O4xKuYaE64JjCiB2HXxng";
const url = "https://witttxltipffmepbutsg.supabase.co";
const database = supabase.createClient(url, key);
const tableName = "realtimedatabase2";
let id = null;

//update the values on mouse move
document.addEventListener("mousemove", async (e) => {
  let values = { x: e.clientX, y: e.clientY };
  if (id) {
    updateSupabase(id, values);
  }
});

//chek if page is loaded
document.addEventListener("DOMContentLoaded", async () => {
  //get neext id
  id = await getNextId();
  //check if row exists
  if (id) {
    let isExists = await checkRowExists(id);
    if (!isExists) {
      //insert row
      insertSupabase(id, { x: 0, y: 0 });
      document.getElementById("your-id").innerText = id;
    }
  }
});

//get next id
async function getNextId() {
  let res = await database.from(tableName).select("id");
  return res.data.length + 1;
}

//update row
async function updateSupabase(id, values) {
  //get time now in Zurich
  let now = new Date();

  let res = await database
    .from(tableName)
    .update({
      values: values,
      updated_at: new Date(),
    })
    .eq("id", id);
}

//insert row
async function insertSupabase(id, values) {
  let res = await database.from(tableName).insert([
    {
      id: id,
      values: values,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}

//check the row exists or not
async function checkRowExists(id) {
  let res = await database.from(tableName).select("*").eq("id", id);
  return res.data.length > 0;
}
