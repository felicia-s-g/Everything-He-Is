//rc-write-1

const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdHR0eGx0aXBmZm1lcGJ1dHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1MzcyMjIsImV4cCI6MjA1NTExMzIyMn0.y7sdk3EWA49uTOO2b56rV-O4xKuYaE64JjCiB2HXxng";
const url = "https://witttxltipffmepbutsg.supabase.co";
const database = supabase.createClient(url, key);
const tableName = "realtimedatabase3";
const btns = document.querySelectorAll(".btn");
const id = 1;
let num = 0;
let zoom = 10;

//if row 1 not exists then insert row 1
document.addEventListener("DOMContentLoaded", async () => {
  let isExists = await checkRowExists(id);
  if (!isExists) {
    insertSupabase(id, { num: num, z: zoom });
  }
});

btns.forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    num = e.target.dataset.num;
    let values = { num: num, z: zoom };
    updateSupabase(1, values);
  });
});


//event id slider
document.getElementById("zoom").addEventListener("input", async (e) => {
  zoom = e.target.value;
  let values = { num: num, z: zoom };
  updateSupabase(1, values);
});

async function updateSupabase(id, values) {
  let res = await database
    .from(tableName)
    .update({
      values: values,
      updated_at: new Date(),
    })
    .eq("id", id);
}

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
