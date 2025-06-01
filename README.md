# LocalDB

LocalDB is a simple, lightweight, file-system-based document database for Node.js. It allows you to store data in collections of JSON documents directly on your local file system. It's designed for scenarios where a full-fledged database server is an overkill, but you still need persistent storage with basic database-like operations.

## Features

- **Collections and Documents**: Organize data into collections, with each document stored as a separate JSON file.
- **CRUD Operations**: Supports Create (set), Read (get), Update (set), and Delete (del) operations for documents.
- **Querying**: Basic querying capabilities to retrieve all documents or search by matching or likeness of fields.
- **Automatic Backup**: If saving a document fails, the data is automatically backed up to a `.backup` directory within the collection.
- **JSON Repair**: Attempts to repair corrupted JSON files upon reading.
- **Graceful Shutdown**: Includes handlers for process exit signals to perform cleanup (though data is generally persisted immediately).
- **No External Dependencies (besides `jsonrepair`)**: Pure Node.js file system operations.

## Installation

Since this is a local module provided as a set of files, you would typically place the `local-db` directory (containing `index.js`, `lib/`, `package.json`, etc.) into your project and require it locally.

```bash
npm i local-db@https://github.com/ernestoyoofi/local-db.git
```

## Usage

### Initializing the Database

```javascript
const LocalDB = require("local-db")

// Initialize the database.
// The 'location' option specifies the root directory for your database.
// This directory will be created if it doesn't exist.
const db = new LocalDB({ location: "./myAppData/database" })
```

### Managing Collections

**Create a new collection (or ensure it exists):**

```javascript
async function manageCollections() {
  try {
    const newColResult = await db.newCol("users")
    console.log(newColResult) // { success: true, name: 'users', path: '...', message: "Collection 'users' ensured." }
    // If the collection already exists, it will still return success.
    await db.newCol("products")
  } catch (error) {
    console.error("Error managing collections:", error)
  }
}
manageCollections()
```

**Get a collection instance:**

The `getCol` method returns a `Collection` instance. If the collection doesn't exist, its directory will be created.

```javascript
const usersCollection = db.getCol("users")
const defaultCollection = db.getCol() // Defaults to 'default' collection
```

**Delete a collection:**

```javascript
async function deleteUserCollection() {
  try {
    const deleteResult = await db.delCol("users")
    console.log(deleteResult)
    // { success: true, name: 'users', message: "Collection 'users' deleted." }
    // or { success: false, name: 'users", message: "Collection 'users' not found." }
  } catch (error) {
    console.error("Error deleting collection:", error)
  }
}
// deleteUserCollection()
```

**List all collections:**

```javascript
async function listAllCollections() {
  try {
    const collectionNames = await db.allCol()
    console.log("All collections:", Array.from(collectionNames)) // e.g., ['products', 'default']
  } catch (error) {
    console.error("Error listing collections:", error)
  }
}
// listAllCollections()
```

### Managing Documents within a Collection

All document operations are performed on a `Collection` instance.

**Set (Create/Update) a document:**

Documents are stored as JSON. The data provided must be JSON serializable.

```javascript
const productsCollection = db.getCol("products")

async function addProducts() {
  try {
    // Document ID can be any string, but avoid special characters that are problematic for filenames.
    // The module sanitizes common problematic characters.
    const product1 = await productsCollection.set("item001", {
      name: 'Laptop Pro',
      category: 'Electronics',
      price: 1200,
      tags: ['computer', 'powerful', 'new']
    })
    console.log("Product 1 set:", product1)
    // { success: true, id: 'item001', path: 'item001.json' }

    const product2 = await productsCollection.set("item002", {
      name: 'Wireless Mouse',
      category: 'Electronics',
      price: 25,
      stock: 150
    })
    console.log("Product 2 set:", product2)

    // Update a document
    const updatedProduct1 = await productsCollection.set("item001", {
      name: 'Laptop Pro X',
      category: 'Electronics',
      price: 1250,
      tags: ['computer', 'powerful', 'latest'],
      status: 'active'
    })
    console.log("Product 1 updated:", updatedProduct1)

  } catch (error) {
    console.error("Error setting document:", error)
  }
}
// addProducts()
```

**Get a document:**

```javascript
async function getProduct() {
  try {
    const product = await productsCollection.get("item001")
    if (product) {
      console.log("Found product item001:", product)
    } else {
      console.log("Product item001 not found.")
    }

    const nonExistent = await productsCollection.get("item999")
    console.log("Non-existent product:", nonExistent) // null
  } catch (error) {
    console.error("Error getting document:", error)
  }
}
// getProduct()
```

**Delete a document:**

```javascript
async function deleteProduct() {
  try {
    const deleteResult = await productsCollection.del("item002")
    console.log("Delete result for item002:", deleteResult)
    // { success: true, id: 'item002' }
    // or { success: false, id: 'item002", message: 'Document not found.' }
  } catch (error) {
    console.error("Error deleting document:", error)
  }
}
// deleteProduct()
```

**Get all documents (with optional query):**

```javascript
async function getAllProducts() {
  try {
    // Get all documents in the 'products' collection
    const allDocs = await productsCollection.all()
    console.log(`All products (${allDocs.length}):`, allDocs)

    // Get documents matching specific criteria
    const electronics = await productsCollection.all({
      search: {
        match: { // Strict equality for specified fields
          category: 'Electronics'
        }
      }
    })
    console.log("Electronics products:", electronics)

    // Get documents with 'powerful' in tags (like query on array element)
    // and name containing 'laptop' (case-insensitive like query on string)
    const powerfulLaptops = await productsCollection.all({
      search: {
        like: { // Substring/element matching (case-insensitive for strings)
          name: 'laptop',
          tags: 'powerful' // Checks if 'powerful' is one of the tags
        },
        match: { // Can combine with match
          status: 'active'
        }
      }
    })
    console.log("Powerful active laptops:", powerfulLaptops)

    // Example of a more complex 'like' query
    const specificSearch = await productsCollection.all({
      search: {
        like: {
          name: 'pro x' // case-insensitive substring match
        }
      }
    })
    console.log("Products with 'pro x' in name:", specificSearch)

  } catch (error) {
    console.error("Error getting all documents:", error)
  }
}
// getAllProducts()
```

### Querying Logic

- **`match`**: Performs a deep equality check for the given fields and values.
  - For primitive values, it's strict equality (`===`).
  - For objects, it recursively checks that all properties in the query object match the document's properties.
  - For arrays, it checks if the document's array contains the queried primitive value, or if the document's array is identical to the queried array (for array-to-array match).
- **`like`**: Performs a "similarity" check.
  - For string values, it checks if the document's string field contains the query string (case-insensitive).
  - For arrays in the document, it checks if any string element in the document's array contains the query string (case-insensitive), or if the query primitive is present in the array.
  - For objects, it recursively applies the `like` logic to nested properties.

### JSON Format

All documents are stored in JSON format. When using `collection.set(id, data)`, the `data` provided **must** be serializable to JSON (e.g., objects, arrays, strings, numbers, booleans). Functions, `undefined`, Symbols, and circular references will cause errors or be handled as per `JSON.stringify`'s behavior (e.g., functions and `undefined` are removed from objects or converted to `null` in arrays).

### Backup System

If an error occurs while writing a document file to disk (e.g., disk full, unexpected permissions issue after initial check), `local-db` will attempt to save the intended JSON data to a backup location. This backup directory is created at `<db_location>/.backup/<collection_name>/`. Backup files are timestamped to prevent overwrites, e.g., `docId_timestamp.json.bak`.

### JSON Repair

When reading a document (`.get()` or `.all()`), if a `.json` file is found to be corrupted (i.e., `JSON.parse` fails), `local-db` will attempt to repair the JSON content using the `jsonrepair` library. If successful, the repaired data is returned. A warning will be logged to the console. This helps in recovering data from minor corruptions.

## Error Handling

Methods are generally asynchronous and return Promises. Use `try...catch` blocks or `.catch()` to handle potential errors (e.g., I/O errors, invalid input).

## Graceful Shutdown

The module registers listeners for `exit`, `SIGINT`, and `SIGTERM` process events. This is primarily for logging the shutdown. Since data is written to files immediately, there's typically no explicit "save all" operation needed on shutdown unless you've built a caching layer on top.

## Limitations

- **Performance**: Being file-system based, performance might not scale well for extremely high-throughput applications or very large numbers of small documents compared to dedicated database systems. Each document read/write involves file system operations.
- **Concurrency**: While basic file operations are atomic at the OS level, complex transactions or concurrent writes to the *same document ID from multiple processes without external locking* could lead to race conditions. This module is best suited for single-process access or scenarios where concurrent access is managed externally or infrequent.
- **Querying**: Query capabilities are basic. Complex queries, indexing, and aggregations are not supported. For such needs, a more robust database solution is recommended.
- **Security**: Files are stored as plain JSON. If data sensitivity is a concern, ensure appropriate file system permissions and consider encrypting the data at rest using other tools.
- **Atomicity**: Operations are generally atomic at the single document level. Multi-document transactions are not supported.
