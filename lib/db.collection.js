const fs = require("fs").promises
const { existsSync } = require("fs")

const createCollection = async (paths) => {
  try {
    const isReadyBefore = existsSync(paths)
    if(!isReadyBefore) {
      await fs.mkdir(paths, { recursive: true })
    }
    return {
      success: true,
      isReadyBefore
    }
  } catch(err) {
    return Promise.reject(err)
  }
}

const removeCollection = async (paths) => {
  try {
    const isNotExistBefore = !existsSync(paths)
    if(!isNotExistBefore) {
      await fs.rm(paths, { recursive: true, force: true })
    }
    return {
      success: true,
      isNotExistBefore
    }
  } catch(err) {
    return Promise.reject(err)
  }
}

const allCollection = async (paths) => {
  try {
    return await fs.readdir(paths)
  } catch(err) {
    return Promise.reject(err)
  }
}

module.exports = {
  createCollection,
  removeCollection,
  allCollection
}