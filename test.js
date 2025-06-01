const localDB = require("./lib/localdb")

const db = new localDB({ location: "./testing" })

console.log(db.getCol("testing").set("testing", { testing: true }))