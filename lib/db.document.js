const ptjn = require("path").join
const fs = require("fs").promises
const { existsSync, readdirSync, readFileSync } = require("fs")
const generateId = () => {
  return require("crypto").randomBytes(10).toString("hex")
}

class DocumentDatabase {
  constructor(paths) {
    this.paths = paths
    this.success = true
    if(!existsSync(paths)) {
      fs.mkdir(paths, { recursive: true })
    }
  }

  async newDoc(id, data = {}) {
    let dataDocs = this.paths
    let idBuild = generateId()
    if(typeof id != "string" || id.length < 1) {
      dataDocs = ptjn(this.paths, `${idBuild}.json`)
    } else {
      dataDocs = id
    }

    if(typeof data != "object" || Array.isArray(data)) {
      return Promise.reject(new Error("Only Object Can't Create Document, Not Array !"))
    }

    if(existsSync(dataDocs)) {
      return Promise.reject(new Error("Can't Create New Document With Same Id !"))
    }

    try {
      await fs.writeFile(dataDocs, JSON.stringify(data,null,2), "utf-8")
      return {
        _id: idBuild,
        data: data
      }
    } catch(err) {
      return Promise.reject(err)
    }
  }

  async editDoc(id, data = {}) {
    const dataDocs = ptjn(this.paths, `${id}.json`)
    if(typeof id != "string" || id.length < 1) {
      return Promise.reject(new Error("Please Put Your Id Document To Edit !"))
    }

    if(!existsSync(dataDocs)) {
      return Promise.reject(new Error(`Document ${id} Is Not Found !`))
    }

    try {
      const dataDB = JSON.parse(await fs.readFile(dataDocs, "utf-8"))
      Object.keys(data).forEach(key => {
        dataDB[key] = data[key]
      })
      await fs.writeFile(dataDocs, JSON.stringify(dataDB,null,2), "utf-8")

      return dataDB
    } catch(err) {
      return Promise.reject(err)
    }
  }

  getAllDocsSync() {
    const rdr = readdirSync(this.paths)
    const rdrPt = rdr.map(z => `${ptjn(this.paths, z)}`)
    let data = []
    rdrPt.map((a, i) => {
      const dataDB = JSON.parse(readFileSync(a, "utf-8"))
      data.push({
        _id: rdr[i],
        data: dataDB
      })
    })
    return data
  }

  async getAllDocs() {
    return new Promise(async (resolve, reject) => {
      try {
        const rdr = await fs.readdir(this.paths)
        const rdrPt = rdr.map(z => `${ptjn(this.paths, z)}`)
        let data = []
        rdrPt.map(async (a, i) => {
          const dataDB = JSON.parse(await fs.readFile(a))
          data.push({
            _id: rdr[i],
            data: dataDB
          })
          if(rdr.length - 1 === i) {
            resolve(data)
          }
        })
      } catch(err) {
        reject(err)
      }
    })
  }

  async getDoc(id) {
    const dataDocs = ptjn(this.paths, `${id}.json`)
    if(typeof id != "string" || id.length < 1) {
      return Promise.reject(new Error("Please Put Your Id Document To View !"))
    }

    if(!existsSync(dataDocs)) {
      return Promise.reject(new Error(`Document ${id} Is Not Found !`))
    }

    try {
      return JSON.parse(await fs.readFile(dataDocs, "utf-8"))
    } catch(err) {
      return Promise.reject(err)
    }
  }
}

module.exports = DocumentDatabase