const { SetupDatabase } = require("./")

const db = new SetupDatabase()

console.log(db)

// db.newCol("test").then(console.log)
// db.rmCol("test").then(console.log)
// db.allCol().then(console.log)
const myCol = db.col("test")
// console.log(myCol)
// myCol.newDoc(null, {
//   name: "Adit"
// })
// myCol.getAllDocs().then(console.log)
async function Test() {
  const getAll = await myCol.getAllDocs()
  console.log(myCol.getAllDocsSync(), {})
  console.log(getAll)
}
Test()