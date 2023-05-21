# @ernestoyoofi/local-db

Write and read file for your database in local data !

```js
const { SetupDatabase } = require("@ernestoyoofi/local-db")

// Setup Your Database
// Default paths is '{cwd_local}/database'
const db = SetupDatabase()

// Create Collection
await db.newCol("testing") // -> { success: true }

// Remove Collection
await db.rmCol("testing")  // -> { success: true }

// Get All Collection
await db.allCol()          // -> [""]

// Get One Collection
// Default params is test
const myCol = db.col()

// Create docs
await myCol.newDoc("user", {
  name: "Ondion"
})
// -> { _id: "user", data: { name: "Ondion" } }

// Edit docs
await myCol.editDoc("user", {
  checkout: true
})
// -> { name: "Ondion", checkout: true }

// Get All Docs
await myCol.getAllDocs()
// -> [ { _id: "user", data: { name: "Ondion", checkout: true } } ]

// Get One Docs
await myCol.getDoc("user")
// -> { name: "Ondion", checkout: true }
```
