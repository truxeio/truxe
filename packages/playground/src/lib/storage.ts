/**
 * PlaygroundStorage - IndexedDB persistence layer
 * API Playground Phase 3: Collections & Workflows
 */

import {
  Collection,
  SavedRequest,
  Folder,
  Variable,
  Workflow,
  Environment,
  WorkflowExecution,
  StorageMetadata,
  BackupData
} from '../types/collections'

export class PlaygroundStorage {
  private db: IDBDatabase | null = null
  private readonly DB_NAME = 'truxe-playground'
  private readonly DB_VERSION = 1

  private readonly STORES = {
    collections: 'collections',
    requests: 'requests',
    folders: 'folders',
    variables: 'variables',
    workflows: 'workflows',
    environments: 'environments',
    executions: 'executions',
    metadata: 'metadata'
  } as const

  /**
   * Initialize the database and create object stores
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Collections store
        if (!db.objectStoreNames.contains(this.STORES.collections)) {
          const collectionsStore = db.createObjectStore(this.STORES.collections, { keyPath: 'id' })
          collectionsStore.createIndex('name', 'name', { unique: false })
          collectionsStore.createIndex('createdAt', 'createdAt', { unique: false })
          collectionsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        }

        // Requests store
        if (!db.objectStoreNames.contains(this.STORES.requests)) {
          const requestsStore = db.createObjectStore(this.STORES.requests, { keyPath: 'id' })
          requestsStore.createIndex('collectionId', 'collectionId', { unique: false })
          requestsStore.createIndex('folderId', 'folderId', { unique: false })
          requestsStore.createIndex('method', 'method', { unique: false })
          requestsStore.createIndex('name', 'name', { unique: false })
          requestsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true })
          requestsStore.createIndex('createdAt', 'createdAt', { unique: false })
          requestsStore.createIndex('lastExecuted', 'lastExecuted', { unique: false })
        }

        // Folders store
        if (!db.objectStoreNames.contains(this.STORES.folders)) {
          const foldersStore = db.createObjectStore(this.STORES.folders, { keyPath: 'id' })
          foldersStore.createIndex('collectionId', 'collectionId', { unique: false })
          foldersStore.createIndex('parentId', 'parentId', { unique: false })
          foldersStore.createIndex('name', 'name', { unique: false })
        }

        // Variables store
        if (!db.objectStoreNames.contains(this.STORES.variables)) {
          const variablesStore = db.createObjectStore(this.STORES.variables, { keyPath: 'key' })
          variablesStore.createIndex('type', 'type', { unique: false })
          variablesStore.createIndex('scope', 'scope', { unique: false })
          variablesStore.createIndex('enabled', 'enabled', { unique: false })
        }

        // Workflows store
        if (!db.objectStoreNames.contains(this.STORES.workflows)) {
          const workflowsStore = db.createObjectStore(this.STORES.workflows, { keyPath: 'id' })
          workflowsStore.createIndex('category', 'category', { unique: false })
          workflowsStore.createIndex('isPrebuilt', 'isPrebuilt', { unique: false })
          workflowsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true })
          workflowsStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // Environments store
        if (!db.objectStoreNames.contains(this.STORES.environments)) {
          const environmentsStore = db.createObjectStore(this.STORES.environments, { keyPath: 'id' })
          environmentsStore.createIndex('name', 'name', { unique: false })
          environmentsStore.createIndex('isActive', 'isActive', { unique: false })
        }

        // Executions store
        if (!db.objectStoreNames.contains(this.STORES.executions)) {
          const executionsStore = db.createObjectStore(this.STORES.executions, { keyPath: 'id' })
          executionsStore.createIndex('workflowId', 'workflowId', { unique: false })
          executionsStore.createIndex('status', 'status', { unique: false })
          executionsStore.createIndex('startedAt', 'startedAt', { unique: false })
        }

        // Metadata store
        if (!db.objectStoreNames.contains(this.STORES.metadata)) {
          db.createObjectStore(this.STORES.metadata, { keyPath: 'key' })
        }
      }
    })
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initialize()
    }
    return this.db!
  }

  // ============================================
  // Collections
  // ============================================

  async saveCollection(collection: Collection): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.collections], 'readwrite')
    const store = transaction.objectStore(this.STORES.collections)
    
    const collectionToSave = {
      ...collection,
      updatedAt: new Date()
    }
    
    await this.promisifyTransaction(transaction, () => {
      store.put(collectionToSave)
    })

    // Also save associated folders and requests
    if (collection.folders.length > 0) {
      await this.saveFolders(collection.folders)
    }
    if (collection.requests.length > 0) {
      await this.saveRequests(collection.requests)
    }
  }

  async loadCollections(): Promise<Collection[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.collections], 'readonly')
    const store = transaction.objectStore(this.STORES.collections)
    
    return this.promisifyTransaction(transaction, () => {
      return store.getAll()
    })
  }

  async loadCollection(id: string): Promise<Collection | null> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.collections], 'readonly')
    const store = transaction.objectStore(this.STORES.collections)
    
    const collection = await this.promisifyTransaction(transaction, () => {
      return store.get(id)
    })

    if (!collection) return null

    // Load associated folders and requests
    collection.folders = await this.loadFoldersByCollection(id)
    collection.requests = await this.loadRequestsByCollection(id)
    
    return collection
  }

  async deleteCollection(id: string): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([
      this.STORES.collections,
      this.STORES.requests,
      this.STORES.folders
    ], 'readwrite')
    
    const collectionsStore = transaction.objectStore(this.STORES.collections)
    const requestsStore = transaction.objectStore(this.STORES.requests)
    const foldersStore = transaction.objectStore(this.STORES.folders)

    await this.promisifyTransaction(transaction, async () => {
      // Delete collection
      collectionsStore.delete(id)
      
      // Delete associated requests
      const requestsIndex = requestsStore.index('collectionId')
      const requestsCursor = requestsIndex.openCursor(id)
      requestsCursor.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
      
      // Delete associated folders
      const foldersIndex = foldersStore.index('collectionId')
      const foldersCursor = foldersIndex.openCursor(id)
      foldersCursor.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
    })
  }

  // ============================================
  // Requests
  // ============================================

  async saveRequest(request: SavedRequest): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.requests], 'readwrite')
    const store = transaction.objectStore(this.STORES.requests)
    
    const requestToSave = {
      ...request,
      updatedAt: new Date()
    }
    
    await this.promisifyTransaction(transaction, () => {
      store.put(requestToSave)
    })
  }

  async saveRequests(requests: SavedRequest[]): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.requests], 'readwrite')
    const store = transaction.objectStore(this.STORES.requests)
    
    await this.promisifyTransaction(transaction, () => {
      requests.forEach(request => {
        const requestToSave = {
          ...request,
          updatedAt: new Date()
        }
        store.put(requestToSave)
      })
    })
  }

  async loadRequestsByCollection(collectionId: string): Promise<SavedRequest[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.requests], 'readonly')
    const store = transaction.objectStore(this.STORES.requests)
    const index = store.index('collectionId')
    
    return this.promisifyTransaction(transaction, () => {
      return index.getAll(collectionId)
    })
  }

  async loadRequestsByFolder(folderId: string): Promise<SavedRequest[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.requests], 'readonly')
    const store = transaction.objectStore(this.STORES.requests)
    const index = store.index('folderId')
    
    return this.promisifyTransaction(transaction, () => {
      return index.getAll(folderId)
    })
  }

  async deleteRequest(id: string): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.requests], 'readwrite')
    const store = transaction.objectStore(this.STORES.requests)
    
    await this.promisifyTransaction(transaction, () => {
      store.delete(id)
    })
  }

  /**
   * Aliases for consistency with other components
   */
  async saveSavedRequest(request: SavedRequest): Promise<void> {
    return this.saveRequest(request)
  }

  async deleteSavedRequest(id: string): Promise<void> {
    return this.deleteRequest(id)
  }

  // ============================================
  // Folders
  // ============================================

  async saveFolders(folders: Folder[]): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.folders], 'readwrite')
    const store = transaction.objectStore(this.STORES.folders)
    
    await this.promisifyTransaction(transaction, () => {
      folders.forEach(folder => {
        const folderToSave = {
          ...folder,
          updatedAt: new Date()
        }
        store.put(folderToSave)
      })
    })
  }

  async loadFoldersByCollection(collectionId: string): Promise<Folder[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.folders], 'readonly')
    const store = transaction.objectStore(this.STORES.folders)
    const index = store.index('collectionId')
    
    return this.promisifyTransaction(transaction, () => {
      return index.getAll(collectionId)
    })
  }

  async deleteFolder(id: string): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([
      this.STORES.folders,
      this.STORES.requests
    ], 'readwrite')
    
    const foldersStore = transaction.objectStore(this.STORES.folders)
    const requestsStore = transaction.objectStore(this.STORES.requests)

    await this.promisifyTransaction(transaction, () => {
      // Delete folder
      foldersStore.delete(id)
      
      // Update requests to remove folder association
      const requestsIndex = requestsStore.index('folderId')
      const cursor = requestsIndex.openCursor(id)
      cursor.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const request = cursor.value
          request.folderId = undefined
          request.updatedAt = new Date()
          cursor.update(request)
          cursor.continue()
        }
      }
    })
  }

  /**
   * Load all folders across all collections
   */
  async loadFolders(): Promise<Folder[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.folders], 'readonly')
    const store = transaction.objectStore(this.STORES.folders)
    
    return this.promisifyTransaction(transaction, () => {
      return store.getAll()
    })
  }

  /**
   * Load all saved requests across all collections
   */
  async loadSavedRequests(): Promise<SavedRequest[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.requests], 'readonly')
    const store = transaction.objectStore(this.STORES.requests)
    
    return this.promisifyTransaction(transaction, () => {
      return store.getAll()
    })
  }

  // ============================================
  // Variables
  // ============================================

  async saveVariables(variables: Record<string, Variable>): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.variables], 'readwrite')
    const store = transaction.objectStore(this.STORES.variables)
    
    await this.promisifyTransaction(transaction, () => {
      Object.values(variables).forEach(variable => {
        const variableToSave = {
          ...variable,
          updatedAt: new Date()
        }
        store.put(variableToSave)
      })
    })
  }

  async loadVariables(): Promise<Record<string, Variable>> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.variables], 'readonly')
    const store = transaction.objectStore(this.STORES.variables)
    
    const variables = await this.promisifyTransaction(transaction, () => {
      return store.getAll()
    })
    
    const result: Record<string, Variable> = {}
    variables.forEach(variable => {
      result[variable.key] = variable
    })
    
    return result
  }

  async deleteVariable(key: string): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.variables], 'readwrite')
    const store = transaction.objectStore(this.STORES.variables)
    
    await this.promisifyTransaction(transaction, () => {
      store.delete(key)
    })
  }

  // ============================================
  // Workflows
  // ============================================

  async saveWorkflow(workflow: Workflow): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.workflows], 'readwrite')
    const store = transaction.objectStore(this.STORES.workflows)
    
    const workflowToSave = {
      ...workflow,
      updatedAt: new Date()
    }
    
    await this.promisifyTransaction(transaction, () => {
      store.put(workflowToSave)
    })
  }

  async loadWorkflows(): Promise<Workflow[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.workflows], 'readonly')
    const store = transaction.objectStore(this.STORES.workflows)
    
    return this.promisifyTransaction(transaction, () => {
      return store.getAll()
    })
  }

  async loadWorkflowsByCategory(category: string): Promise<Workflow[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.workflows], 'readonly')
    const store = transaction.objectStore(this.STORES.workflows)
    const index = store.index('category')
    
    return this.promisifyTransaction(transaction, () => {
      return index.getAll(category)
    })
  }

  async deleteWorkflow(id: string): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([
      this.STORES.workflows,
      this.STORES.executions
    ], 'readwrite')
    
    const workflowsStore = transaction.objectStore(this.STORES.workflows)
    const executionsStore = transaction.objectStore(this.STORES.executions)

    await this.promisifyTransaction(transaction, () => {
      // Delete workflow
      workflowsStore.delete(id)
      
      // Delete associated executions
      const executionsIndex = executionsStore.index('workflowId')
      const cursor = executionsIndex.openCursor(id)
      cursor.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
    })
  }

  // ============================================
  // Environments
  // ============================================

  async saveEnvironment(environment: Environment): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.environments], 'readwrite')
    const store = transaction.objectStore(this.STORES.environments)
    
    const environmentToSave = {
      ...environment,
      updatedAt: new Date()
    }
    
    await this.promisifyTransaction(transaction, () => {
      store.put(environmentToSave)
    })
  }

  async loadEnvironments(): Promise<Environment[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.environments], 'readonly')
    const store = transaction.objectStore(this.STORES.environments)
    
    return this.promisifyTransaction(transaction, () => {
      return store.getAll()
    })
  }

  async getActiveEnvironment(): Promise<Environment | null> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.environments], 'readonly')
    const store = transaction.objectStore(this.STORES.environments)
    const index = store.index('isActive')
    
    const environments = await this.promisifyTransaction(transaction, () => {
      return index.getAll(IDBKeyRange.only(true))
    })
    
    return environments.length > 0 ? environments[0] : null
  }

  // ============================================
  // Workflow Executions
  // ============================================

  async saveExecution(execution: WorkflowExecution): Promise<void> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.executions], 'readwrite')
    const store = transaction.objectStore(this.STORES.executions)
    
    await this.promisifyTransaction(transaction, () => {
      store.put(execution)
    })
  }

  async loadExecutionsByWorkflow(workflowId: string): Promise<WorkflowExecution[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.executions], 'readonly')
    const store = transaction.objectStore(this.STORES.executions)
    const index = store.index('workflowId')
    
    return this.promisifyTransaction(transaction, () => {
      return index.getAll(workflowId)
    })
  }

  // ============================================
  // Search
  // ============================================

  async searchRequests(query: string, options?: {
    collections?: string[]
    methods?: string[]
    tags?: string[]
  }): Promise<SavedRequest[]> {
    const db = await this.ensureDB()
    const transaction = db.transaction([this.STORES.requests], 'readonly')
    const store = transaction.objectStore(this.STORES.requests)
    
    const allRequests = await this.promisifyTransaction(transaction, () => {
      return store.getAll()
    })
    
    const lowerQuery = query.toLowerCase()
    
    return allRequests.filter(request => {
      // Text matching
      const textMatch = (
        request.name.toLowerCase().includes(lowerQuery) ||
        request.description?.toLowerCase().includes(lowerQuery) ||
        request.path.toLowerCase().includes(lowerQuery) ||
        request.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery))
      )
      
      if (!textMatch) return false
      
      // Filter by options
      if (options?.collections && !options.collections.includes(request.collectionId)) {
        return false
      }
      
      if (options?.methods && !options.methods.includes(request.method)) {
        return false
      }
      
      if (options?.tags) {
        const hasTag = request.tags.some((tag: string) => options.tags!.includes(tag))
        if (!hasTag) return false
      }
      
      return true
    })
  }

  // ============================================
  // Backup & Export
  // ============================================

  async createBackup(): Promise<BackupData> {
    const [collections, variables, workflows, environments] = await Promise.all([
      this.loadCollections(),
      this.loadVariables(),
      this.loadWorkflows(),
      this.loadEnvironments()
    ])

    const metadata: StorageMetadata = {
      version: '1.0.0',
      createdAt: new Date(),
      totalCollections: collections.length,
      totalRequests: collections.reduce((sum, col) => sum + col.requests.length, 0),
      totalWorkflows: workflows.length,
      storageSize: 0 // TODO: Calculate actual size
    }

    return {
      metadata,
      collections,
      environments,
      workflows,
      variables,
      timestamp: new Date()
    }
  }

  async restoreFromBackup(backup: BackupData): Promise<void> {
    // Clear existing data
    await this.clearAllData()
    
    // Restore data
    await Promise.all([
      ...backup.collections.map(collection => this.saveCollection(collection)),
      ...backup.workflows.map(workflow => this.saveWorkflow(workflow)),
      ...backup.environments.map(environment => this.saveEnvironment(environment)),
      this.saveVariables(backup.variables)
    ])
  }

  async clearAllData(): Promise<void> {
    const db = await this.ensureDB()
    const storeNames = Object.values(this.STORES)
    const transaction = db.transaction(storeNames, 'readwrite')
    
    await this.promisifyTransaction(transaction, () => {
      storeNames.forEach(storeName => {
        const store = transaction.objectStore(storeName)
        store.clear()
      })
    })
  }

  // ============================================
  // Utilities
  // ============================================

  private promisifyTransaction<T>(
    transaction: IDBTransaction,
    operation: () => IDBRequest<T> | T | void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      transaction.onerror = () => reject(transaction.error)

      try {
        // Execute operation once during active transaction
        const result = operation()

        if (result instanceof IDBRequest) {
          // For IDBRequest, wait for the request to complete
          result.onsuccess = () => resolve(result.result)
          result.onerror = () => reject(result.error)
        } else {
          // For non-request results, resolve immediately
          resolve(result as T)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  async getStorageInfo(): Promise<StorageMetadata> {
    const [collections, workflows] = await Promise.all([
      this.loadCollections(),
      this.loadWorkflows()
    ])

    const totalRequests = collections.reduce((sum, col) => sum + col.requests.length, 0)

    return {
      version: '1.0.0',
      createdAt: new Date(),
      totalCollections: collections.length,
      totalRequests,
      totalWorkflows: workflows.length,
      storageSize: 0 // TODO: Implement size calculation
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// Export singleton instance
export const playgroundStorage = new PlaygroundStorage()