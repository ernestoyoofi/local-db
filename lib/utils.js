
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { jsonrepair } = require('jsonrepair')

async function rmRecursiveFallback(dirPath) {
  try {
    if(fs.existsSync(dirPath)) {
      const files = await fsp.readdir(dirPath)
      for(const file of files) {
        const curPath = path.join(dirPath, file)
        const fileStat = await fsp.stat(curPath)
        if(fileStat.isDirectory()) {
          await rmRecursiveFallback(curPath)
        } else {
          await fsp.unlink(curPath)
        }
      }
      await fsp.rmdir(dirPath)
    }
  } catch(err) {
    if(err.code !== 'ENOENT') {
      console.error(`Error during rmRecursiveFallback for ${dirPath}:`, err)
      throw err
    }
  }
}

const deleteDirectory = async(dirPath) => {
  try {
    await fsp.rm(dirPath, { recursive: true, force: true })
  } catch(err) {
    if(err.code === 'ERR_INVALID_ARG_TYPE' || typeof fsp.rm !== 'function') {
      await rmRecursiveFallback(dirPath)
    } else if(err.code !== 'ENOENT') {
      console.error(`Error during deleteDirectory for ${dirPath}:`, err)
      throw err
    }
  }
}

const ensureDirExists = async(dirPath) => {
  try {
    await fsp.mkdir(dirPath, { recursive: true })
  } catch(error) {
    const stat = await fsp.stat(dirPath).catch(() => null)
    if(!stat || !stat.isDirectory()) {
      throw new Error(`Failed to create directory or path is not a directory: ${dirPath}. ${error.message}`)
    }
  }
}


const backupDocument = async(rootDbPath, collectionName, docId, jsonDataString) => {
  const backupDirPath = path.join(rootDbPath, '.backup', collectionName)
  try {
    await ensureDirExists(backupDirPath)
    const timestamp = Date.now()
    const sanitizedDocId = docId.replace(/[/\\]/g, '_').replace(/[<>:"|?*]/g, '')
    const backupFilePath = path.join(backupDirPath, `${sanitizedDocId}_${timestamp}.json.bak`)
    await fsp.writeFile(backupFilePath, jsonDataString, 'utf8')
    console.warn(`Successfully backed up document '${docId}' from collection '${collectionName}' to '${backupFilePath}' due to original save failure.`)
    return backupFilePath
  } catch(backupError) {
    console.error(`CRITICAL: Failed to backup document '${docId}' from collection '${collectionName}' after a save error. Data might be lost. Backup error: ${backupError.message}`)
    throw backupError
  }
}

const tryRepairAndParseJson =(jsonString, filePathForLogging = 'unknown file') => {
  try {
    return JSON.parse(jsonString)
  } catch(parseError) {
    if(parseError instanceof SyntaxError) {
      console.warn(`Corrupted JSON content detected in ${filePathForLogging}. Attempting repair.`)
      try {
        const repairedJsonString = jsonrepair(jsonString)
        console.warn(`JSON content in ${filePathForLogging} successfully repaired.`)
        return JSON.parse(repairedJsonString)
      } catch(repairError) {
        console.error(`Failed to repair JSON content in ${filePathForLogging} after initial parse error. Repair attempt error: ${repairError.message}. Original parse error: ${parseError.message}`)
        throw parseError
      }
    }
    throw parseError
  }
}

module.exports = {
  deleteDirectory,
  ensureDirExists,
  backupDocument,
  tryRepairAndParseJson
}
