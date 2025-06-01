
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { backupDocument, tryRepairAndParseJson, ensureDirExists } = require('./utils')

class Collection {
  constructor(rootDbPath, collectionName) {
    if(!rootDbPath || typeof rootDbPath !== 'string') {
      throw new Error('Collection constructor requires a valid rootDbPath string.')
    }
    if(!collectionName || typeof collectionName !== 'string') {
      throw new Error('Collection constructor requires a valid collectionName string.')
    }
    this.rootDbPath = rootDbPath
    this.collectionName = collectionName
    this.collectionPath = path.join(this.rootDbPath, this.collectionName)
    try {
      if(!fs.existsSync(this.collectionPath)) {
        fs.mkdirSync(this.collectionPath, { recursive: true })
      } else if(!fs.statSync(this.collectionPath).isDirectory()) {
        throw new Error(`Path for collection '${collectionName}' exists but is not a directory: ${this.collectionPath}`)
      }
    } catch(mkdirError) {
      throw new Error(`Failed to initialize collection directory '${this.collectionPath}': ${mkdirError.message}`)
    }
  }

  _getDocPath(docId) {
    if(typeof docId !== 'string' || docId.trim() === '') {
      throw new Error('Document ID must be a non-empty string.')
    }
    const sanitizedDocId = docId.replace(/[/\\]/g, '_').replace(/[<>:"|?*]/g, '')
    if(sanitizedDocId.includes('..')) {
      throw new Error(`Invalid document ID format. Cannot contain '..': ${docId}`)
    }
    if(sanitizedDocId.length > 200) {
       throw new Error(`Document ID is too long: ${docId}`)
    }
    return path.join(this.collectionPath, `${sanitizedDocId}.json`)
  }

  async set(docId, data) {
    if(data === undefined) {
      throw new Error('Data to set cannot be undefined. Use null or an empty object/array ifneeded.')
    }
    let jsonDataString
    try {
      jsonDataString = JSON.stringify(data, null, 2)
    } catch(e) {
      throw new Error(`Data for document ID '${docId}' is not JSON serializable: ${e.message}`)
    }

    const docPath = this._getDocPath(docId)
    try {
      await fsp.writeFile(docPath, jsonDataString, 'utf8')
      return { success: true, id: docId, path: path.basename(docPath) }
    } catch(writeError) {
      console.error(`Error setting document '${docId}' in collection '${this.collectionName}' at '${docPath}':`, writeError.message)
      try {
        await backupDocument(this.rootDbPath, this.collectionName, docId, jsonDataString)
      } catch(backupFailureError) {
        throw new Error(`Failed to set document '${docId}' and also failed to backup: ${writeError.message}. Backup failure: ${backupFailureError.message}`)
      }
      throw new Error(`Failed to set document '${docId}': ${writeError.message}. Data was backed up.`)
    }
  }

  async get(docId) {
    const docPath = this._getDocPath(docId)
    try {
      const rawContent = await fsp.readFile(docPath, 'utf8')
      return tryRepairAndParseJson(rawContent, docPath)
    } catch(error) {
      if(error.code === 'ENOENT') {
        return null
      }
      console.error(`Error getting document '${docId}' from collection '${this.collectionName}' at '${docPath}':`, error.message)
      throw new Error(`Failed to get document '${docId}': ${error.message}`)
    }
  }

  async del(docId) {
    const docPath = this._getDocPath(docId)
    try {
      await fsp.unlink(docPath)
      return { success: true, id: docId }
    } catch(error) {
      if(error.code === 'ENOENT') {
        return { success: false, id: docId, message: 'Document not found.' }
      }
      console.error(`Error deleting document '${docId}' from collection '${this.collectionName}' at '${docPath}':`, error)
      throw new Error(`Failed to delete document '${docId}': ${error.message}`)
    }
  }

  _checkMatch(docValue, queryValue) {
    if(queryValue === null || typeof queryValue !== 'object') {
      if(Array.isArray(docValue)) {
        return docValue.includes(queryValue)
      }
      return docValue === queryValue
    }
    if(typeof docValue !== 'object' || docValue === null) return false
    if(Array.isArray(queryValue)) {
      if(!Array.isArray(docValue) || docValue.length !== queryValue.length) return false
      for(let i = 0; i < queryValue.length; i++) {
        if(!this._checkMatch(docValue[i], queryValue[i])) return false
      }
      return true
    }
    if(Array.isArray(docValue)) return false 
    for(const key in queryValue) {
      if(!docValue.hasOwnProperty(key) || !this._checkMatch(docValue[key], queryValue[key])) {
        return false
      }
    }
    return true
  }

  _checkLike(docValue, queryValue) {
    if(typeof queryValue === 'string') {
      const qvLower = queryValue.toLowerCase()
      if(typeof docValue === 'string') {
        return docValue.toLowerCase().includes(qvLower)
      }
      if(Array.isArray(docValue)) {
        return docValue.some(item => typeof item === 'string' && item.toLowerCase().includes(qvLower))
      }
      return false
    }
    if(queryValue === null || typeof queryValue !== 'object') {
      if(Array.isArray(docValue)) {
        return docValue.includes(queryValue)
      }
      return docValue === queryValue
    }
    if(typeof docValue !== 'object' || docValue === null) return false
    if(Array.isArray(queryValue) || Array.isArray(docValue)) return false 
    for(const key in queryValue) {
      if(!docValue.hasOwnProperty(key) || !this._checkLike(docValue[key], queryValue[key])) {
        return false
      }
    }
    return true
  }

  async all(query) {
    let filesInDir
    try {
      await ensureDirExists(this.collectionPath)
      filesInDir = await fsp.readdir(this.collectionPath)
    } catch(error) {
      if(error.code === 'ENOENT') return []
      console.error(`Error reading collection directory '${this.collectionName}' at '${this.collectionPath}':`, error)
      throw new Error(`Failed to read collection '${this.collectionName}': ${error.message}`)
    }
    const results = []
    for(const fileName of filesInDir) {
      if(!fileName.endsWith('.json')) continue
      const docPath = path.join(this.collectionPath, fileName)
      let docContent
      try {
        const rawContent = await fsp.readFile(docPath, 'utf8')
        docContent = tryRepairAndParseJson(rawContent, docPath)
      } catch(readOrParseError) {
        console.warn(`Skipping unreadable/corrupted file '${fileName}' in collection '${this.collectionName}' due to: ${readOrParseError.message}`)
        continue
      }
      if(!docContent) continue
      if(!query || !query.search) {
        results.push(docContent)
        continue
      }
      let matchesQuery = true
      if(query.search.match) {
        for(const key in query.search.match) {
          if(!docContent.hasOwnProperty(key) || !this._checkMatch(docContent[key], query.search.match[key])) {
            matchesQuery = false
            break
          }
        }
      }
      if(matchesQuery && query.search.like) {
        for(const key in query.search.like) {
          if(!docContent.hasOwnProperty(key) || !this._checkLike(docContent[key], query.search.like[key])) {
            matchesQuery = false
            break
          }
        }
      }
      if(matchesQuery) {
        results.push(docContent)
      }
    }
    return results
  }
}

module.exports = Collection
