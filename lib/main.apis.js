const fs = require("fs")
const collections = require("./db.collection")
const documentSetup = require("./db.document")
const ptjn = require("path").join

class SetupDatabase {
  /**
   * @name SetupDatabase
   * @param {string||"{cwd_local}/database"} paths 
   */
  constructor(paths = "{cwd_local}/database") {
    this.paths = ptjn(paths.replace(/{cwd_local}/g, process.cwd()))
    this.valid = fs.existsSync(this.paths)? fs.lstatSync(this.paths).isDirectory() : false
  }

  async newCol(ref) {
    if(typeof ref != "string" || ref.length < 1) {
      return Promise.reject(new Error("Please Input Your Refrens Data !"))
    }
    const paths = ptjn(this.paths, ref)

    return collections.createCollection(paths)
  }

  async rmCol(ref) {
    if(typeof ref != "string" || ref.length < 1) {
      return Promise.reject(new Error("Please Input Your Refrens Data !"))
    }
    const paths = ptjn(this.paths, ref)

    return collections.removeCollection(paths)
  }

  async allCol() {
    return collections.allCollection(this.paths)
  }

  col(ref="test") {
    if(typeof ref != "string" || ref.length < 1) {
      return new Error("Please Input Your Refrens Data !")
    }
    const paths = ptjn(this.paths, ref)

    return new documentSetup(paths)
  }
}
module.exports = {
  SetupDatabase
}