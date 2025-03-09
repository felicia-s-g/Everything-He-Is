# Connected Objects

Realtime connection

## Description

To enable real-time connections during this course, we will use Supabase, an open-source system that allows real-time database connections.

## Topics

- How to create a database and how to configure it
- How to write data to a database (js)
- How to read data from a database (js)

## Software requirements

- [Supabase](https://supabase.com/)

## How to create a database and how to configure it

### 1. Login on supabase (https://supabase.com/)

- Username: \*\*\*
- Password: \*\*\*

### 2. How to create a database

- Click on the all projects. Then click on new project and select SUPSI.
  ![supabase](https://github.com/leonardoa/maind-2025/blob/main/assets/supabase/1.png?raw=true)
- Enter your group name, select a password (copy it), and select region central EU. Press the green “Create new project” button.
  ![supabase](https://github.com/leonardoa/maind-2025/blob/main/assets/supabase/2.png?raw=true)
- Copy all the information to a txt file. of this screen. Save the txt file in a safe place that you can access when needed..
  ![supabase](https://github.com/leonardoa/maind-2025/blob/main/assets/supabase/3.png?raw=true)
- An example of the main information we will need save in our txt.
  ![supabase](https://github.com/leonardoa/maind-2025/blob/main/assets/supabase/4.png?raw=true)
- Once the project is created or selected click on “Databases” in the sidebar. Then click in “Create new Table”
  ![supabase](https://github.com/leonardoa/maind-2025/blob/main/assets/supabase/5.png?raw=true)
- Enter the name of your database. A description if needed. Remove the click to “Enable Row Level Security (RLS) and click on ”Enable Realtime”
  ![supabase](https://github.com/leonardoa/maind-2025/blob/main/assets/supabase/6.png?raw=true)
- Create your fields as shown in the image. Then press the green button "Save".
  ![supabase](https://github.com/leonardoa/maind-2025/blob/main/assets/supabase/7.png?raw=true)

## How to write data to a database (js)

- In your html you need to connect to the supabase library as well as connect our javascript.

```html
<!DOCTYPE html>
<html>
  <head> </head>
  <body></body>
  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <script src="src/app.js"></script>
</html>
```

- At the beginning javascript must be initialized with i the key variables. Use the data saved in your txt.

```javascript
const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdHR0eGx0aXBmZm1lcGJ1dHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk1MzcyMjIsImV4cCI6MjA1NTExMzIyMn0.y7sdk3EWA49uTOO2b56rV-O4xKuYaE64JjCiB2H***";
const url = "https://witttxltipffmepbutsg.supabase.co";
const database = supabase.createClient(url, key);
const tableName = "realtimedatabase1";
```

- you can insert a new row in your database by following this code:

```javascript
async function insertSupabase(id, values) {
  let res = await database.from("tableName").insert([
    {
      id: id,
      values: values,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}

insertSupabase(id, values);
```

- you can update a row in your database by following this code:

```javascript
async function updateSupabase(id, values) {
  let res = await database
    .from("tableName")
    .update({
      values: {
        values,
      },
      updated_at: new Date(),
    })
    .eq("id", id);
}

updateSupabase(id, values);
```

- you can check if a row exists in your database by following this code

```javascript
async function checkRowExists(id) {
  let res = await database.from("tableName").select("*").eq("id", id);
  return res.data.length > 0;
}

let isExists = await checkRowExists(id);
if (!isExists) {
  insertSupabase(id, values);
} else {
  console.log("Row already exists");
}
```

- You can read the data in real time like this

```javascript
async function readSupabaseRealTime() {
  //Listen to changes in the database
  database
    .channel("tableName")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: tableName },
      (data) => {
        //do something with the data
      }
    )
    .subscribe();
}
```

- You can read the data without opening the real time channel like this

```javascript
async function readSupabase() {
  let { data, error } = await database.from("tableName").select("*");
  //do something with the data
}

```

