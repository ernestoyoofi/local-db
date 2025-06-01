
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const Collection = require('./collection')
const { deleteDirectory, ensureDirExists } = require('./utils')

class LocalDB {
  constructor(options = {}) {
    if(!options || typeof options.location !== 'string' || options.location.trim() === '') {
      throw new Error('Database location must be specified as a non-empty string in options.location.')
    }
    this.dbPath = path.resolve(options.location)
    this._collectionsCache = new Map()
    this._ensureDbPathExists()

    this._gracefulShutdownHandler = this._onProcessExit.bind(this, 'exit')
    process.on('exit', this._gracefulShutdownHandler)
    process.on('SIGINT',() => this._onProcessExit('SIGINT'))
    process.on('SIGTERM',() => this._onProcessExit('SIGTERM'))
  }

  _ensureDbPathExists() {
    try {
      if(!fs.existsSync(this.dbPath)) {
        fs.mkdirSync(this.dbPath, { recursive: true })
      } else {
        if(!fs.statSync(this.dbPath).isDirectory()) {
          throw new Error(`Database location '${this.dbPath}' exists but is not a directory.`)
        }
      }
    } catch(error) {
      throw new Error(`Failed to initialize database directory at '${this.dbPath}': ${error.message}`)
    }
  }
  
  _validateCollectionName(collectionName) {
    if(typeof collectionName !== 'string' || collectionName.trim() === '') {
      throw new Error('Collection name must be a non-empty string.')
    }
    if(collectionName.startsWith('.') || /[/\\]|\.\./.test(collectionName) || /[<>:"|?*]/.test(collectionName)) {
      throw new Error(`Invalid collection name: '${collectionName}'. Cannot contain path traversal, reserved characters, or start with a dot.`)
    }
    if(collectionName.length > 100) {
      throw new Error(`Collection name is too long: ${collectionName}`)
    }
    return collectionName.trim()
  }

  async newCol(collectionName) {
    const validName = this._validateCollectionName(collectionName)
    const collectionPath = path.join(this.dbPath, validName)
    try {
      await ensureDirExists(collectionPath)
      if(!this._collectionsCache.has(validName)) {
         this._collectionsCache.set(validName, new Collection(this.dbPath, validName))
      }
      return { success: true, name: validName, path: collectionPath, message: `Collection '${validName}' ensured.` }
    } catch(error) {
      console.error(`Error ensuring collection '${validName}' at '${collectionPath}':`, error)
      throw new Error(`Failed to ensure collection '${validName}': ${error.message}`)
    }
  }

  getCol(collectionName = 'default') {
    const validName = this._validateCollectionName(collectionName)
    if(this._collectionsCache.has(validName)) {
      return this._collectionsCache.get(validName)
    }
    const collectionInstance = new Collection(this.dbPath, validName)
    this._collectionsCache.set(validName, collectionInstance)
    return collectionInstance
  }

  async delCol(collectionName) {
    const validName = this._validateCollectionName(collectionName)
    const collectionPath = path.join(this.dbPath, validName)
    const backupPath = path.join(this.dbPath, '.backup', validName)

    try {
      await fsp.access(collectionPath, fs.constants.F_OK) 
      await deleteDirectory(collectionPath)
      if(fs.existsSync(backupPath)) {
         await deleteDirectory(backupPath).catch(err => {
          console.warn(`Could not delete backup directory for collection '${validName}' at '${backupPath}': ${err.message}`)
         })
      }
      this._collectionsCache.delete(validName)
      return { success: true, name: validName, message: `Collection '${validName}' deleted.` }
    } catch(error) {
      if(error.code === 'ENOENT') {
        return { success: false, name: validName, message: `Collection '${validName}' not found.` }
      }
      console.error(`Error deleting collection '${validName}' at '${collectionPath}':`, error)
      throw new Error(`Failed to delete collection '${validName}': ${error.message}`)
    }
  }

  async allCol() {
    try {
      await ensureDirExists(this.dbPath)
      const entries = await fsp.readdir(this.dbPath, { withFileTypes: true })
      const collectionNames = new Set()
      for(const entry of entries) {
        if(entry.isDirectory() && entry.name !== '.backup' && !entry.name.startsWith('._')) {
           try {
            this._validateCollectionName(entry.name)
            collectionNames.add(entry.name)
          } catch(validationError) {
            // Ignore directories that don't match collection name criteria
            // console.debug(`Skipping directory '${entry.name}' as it's not a valid collection name: ${validationError.message}`)
          }
        }
      }
      return collectionNames
    } catch(error) {
      if(error.code === 'ENOENT') { 
        return new Set()
      }
      console.error(`Error listing all collections from '${this.dbPath}':`, error)
      throw new Error(`Failed to list collections: ${error.message}`)
    }
  }

  _onProcessExit(sourceOrSignal, code) {
    // This is a best-effort handler.
    // SourceOrSignal can be 'exit', 'SIGINT', 'SIGTERM'. Code is present for 'exit'.
    const exitReason =(typeof sourceOrSignal === 'string') ? 
     (sourceOrSignal === 'exit' ? `exit with code ${code}` : `signal ${sourceOrSignal}`) :
      `unknown reason ${sourceOrSignal}`

    console.log(`LocalDB: Process exiting due to ${exitReason}. Database location: ${this.dbPath}`)
    process.removeListener('exit', this._gracefulShutdownHandler)
    process.removeListener('SIGINT', this._gracefulShutdownHandler)
    process.removeListener('SIGTERM', this._gracefulShutdownHandler)

    if(sourceOrSignal === 'SIGINT' || sourceOrSignal === 'SIGTERM') {
      // ifkilled by signal, Node.js will terminate the process.
      // We might want to ensure a clean exit code or allow default signal behavior.
      // For SIGINT/SIGTERM, it's common to re-signal or process.exit() after cleanup.
      // However, simply logging and letting the default handler terminate is often sufficient.
    }
  }
}

module.exports = LocalDB
