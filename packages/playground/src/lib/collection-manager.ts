/**
 * CollectionManager - Manages request collections and folders
 * API Playground Phase 3: Collections & Workflows
 */

import {
  Collection,
  SavedRequest,
  Folder,
  Variable,
  SearchOptions,
  SearchResult,
  ValidationResult,
  ValidationError
} from '../types/collections'
import { playgroundStorage } from './storage'
import { generateId } from './utils'

export class CollectionManager {
  private collections: Map<string, Collection> = new Map()
  private folders: Map<string, Folder> = new Map()
  private requests: Map<string, SavedRequest> = new Map()
  private listeners: Map<string, Function[]> = new Map()

  constructor() {
    this.initializeEventListeners()
  }

  private initializeEventListeners(): void {
    this.listeners.set('collection:created', [])
    this.listeners.set('collection:updated', [])
    this.listeners.set('collection:deleted', [])
    this.listeners.set('folder:created', [])
    this.listeners.set('folder:updated', [])
    this.listeners.set('folder:deleted', [])
    this.listeners.set('request:created', [])
    this.listeners.set('request:updated', [])
    this.listeners.set('request:deleted', [])
    this.listeners.set('request:moved', [])
  }

  /**
   * Initialize the manager by loading data from storage
   */
  async initialize(): Promise<void> {
    try {
      await playgroundStorage.initialize()
      await this.loadCollections()
    } catch (error) {
      console.error('Failed to initialize CollectionManager:', error)
      throw error
    }
  }

  /**
   * Load all collections from storage
   */
  async loadCollections(): Promise<void> {
    try {
      const collections = await playgroundStorage.loadCollections()
      
      // Clear existing data
      this.collections.clear()
      this.folders.clear()
      this.requests.clear()

      // Load collections
      for (const collection of collections) {
        const fullCollection = await playgroundStorage.loadCollection(collection.id)
        if (fullCollection) {
          this.collections.set(collection.id, fullCollection)
          
          // Index folders
          this.indexFolders(fullCollection.folders)
          
          // Index requests
          fullCollection.requests.forEach(request => {
            this.requests.set(request.id, request)
          })
        }
      }
    } catch (error) {
      console.error('Failed to load collections:', error)
      throw error
    }
  }

  private indexFolders(folders: Folder[]): void {
    folders.forEach(folder => {
      this.folders.set(folder.id, folder)
      if (folder.folders.length > 0) {
        this.indexFolders(folder.folders)
      }
      folder.requests.forEach(request => {
        this.requests.set(request.id, request)
      })
    })
  }

  // ============================================
  // Collection Operations
  // ============================================

  /**
   * Create a new collection
   */
  async createCollection(
    name: string, 
    description?: string,
    variables?: Record<string, Variable>
  ): Promise<Collection> {
    const validation = this.validateCollectionName(name)
    if (!validation.valid) {
      throw new Error(validation.errors[0].message)
    }

    const collection: Collection = {
      id: generateId(),
      name: name.trim(),
      description: description?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      requests: [],
      folders: [],
      variables: variables || {},
      metadata: {
        version: '1.0.0',
        tags: [],
        requestCount: 0,
        folderCount: 0
      }
    }

    try {
      await playgroundStorage.saveCollection(collection)
      this.collections.set(collection.id, collection)
      this.emit('collection:created', collection)
      return collection
    } catch (error) {
      console.error('Failed to create collection:', error)
      throw error
    }
  }

  /**
   * Update an existing collection
   */
  async updateCollection(
    id: string, 
    updates: Partial<Pick<Collection, 'name' | 'description' | 'variables'>>
  ): Promise<Collection> {
    const collection = this.collections.get(id)
    if (!collection) {
      throw new Error(`Collection with id ${id} not found`)
    }

    if (updates.name !== undefined) {
      const validation = this.validateCollectionName(updates.name, id)
      if (!validation.valid) {
        throw new Error(validation.errors[0].message)
      }
    }

    const updatedCollection: Collection = {
      ...collection,
      ...updates,
      updatedAt: new Date()
    }

    try {
      await playgroundStorage.saveCollection(updatedCollection)
      this.collections.set(id, updatedCollection)
      this.emit('collection:updated', updatedCollection)
      return updatedCollection
    } catch (error) {
      console.error('Failed to update collection:', error)
      throw error
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(id: string): Promise<void> {
    const collection = this.collections.get(id)
    if (!collection) {
      throw new Error(`Collection with id ${id} not found`)
    }

    try {
      await playgroundStorage.deleteCollection(id)
      
      // Remove from local cache
      this.collections.delete(id)
      
      // Remove associated folders and requests from cache
      collection.folders.forEach(folder => this.removeFolderFromCache(folder))
      collection.requests.forEach(request => this.requests.delete(request.id))
      
      this.emit('collection:deleted', collection)
    } catch (error) {
      console.error('Failed to delete collection:', error)
      throw error
    }
  }

  private removeFolderFromCache(folder: Folder): void {
    this.folders.delete(folder.id)
    folder.folders.forEach(subfolder => this.removeFolderFromCache(subfolder))
    folder.requests.forEach(request => this.requests.delete(request.id))
  }

  /**
   * Get a collection by ID
   */
  getCollection(id: string): Collection | undefined {
    return this.collections.get(id)
  }

  /**
   * Get all collections
   */
  getAllCollections(): Collection[] {
    return Array.from(this.collections.values())
  }

  /**
   * Get all collections (alias for getAllCollections)
   */
  getCollections(): Collection[] {
    return this.getAllCollections()
  }

  /**
   * Duplicate a collection
   */
  async duplicateCollection(id: string, newName?: string): Promise<Collection> {
    const original = this.collections.get(id)
    if (!original) {
      throw new Error(`Collection with id ${id} not found`)
    }

    const duplicatedCollection: Collection = {
      ...original,
      id: generateId(),
      name: newName || `${original.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      requests: original.requests.map(request => ({
        ...request,
        id: generateId(),
        collectionId: '',
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      folders: this.duplicateFolders(original.folders, '')
    }

    // Update collection ID in duplicated requests and folders
    duplicatedCollection.requests.forEach(request => {
      request.collectionId = duplicatedCollection.id
    })

    this.updateFolderCollectionIds(duplicatedCollection.folders, duplicatedCollection.id)

    try {
      await playgroundStorage.saveCollection(duplicatedCollection)
      this.collections.set(duplicatedCollection.id, duplicatedCollection)
      this.indexFolders(duplicatedCollection.folders)
      duplicatedCollection.requests.forEach(request => {
        this.requests.set(request.id, request)
      })
      
      this.emit('collection:created', duplicatedCollection)
      return duplicatedCollection
    } catch (error) {
      console.error('Failed to duplicate collection:', error)
      throw error
    }
  }

  private duplicateFolders(folders: Folder[], collectionId: string): Folder[] {
    return folders.map(folder => ({
      ...folder,
      id: generateId(),
      collectionId,
      createdAt: new Date(),
      updatedAt: new Date(),
      requests: folder.requests.map(request => ({
        ...request,
        id: generateId(),
        collectionId,
        folderId: '',
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      folders: this.duplicateFolders(folder.folders, collectionId)
    }))
  }

  private updateFolderCollectionIds(folders: Folder[], collectionId: string): void {
    folders.forEach(folder => {
      folder.collectionId = collectionId
      folder.requests.forEach(request => {
        request.folderId = folder.id
      })
      this.updateFolderCollectionIds(folder.folders, collectionId)
    })
  }

  // ============================================
  // Folder Operations
  // ============================================

  /**
   * Create a new folder
   */
  async createFolder(
    collectionId: string,
    name: string,
    parentId?: string,
    description?: string
  ): Promise<Folder> {
    const collection = this.collections.get(collectionId)
    if (!collection) {
      throw new Error(`Collection with id ${collectionId} not found`)
    }

    const validation = this.validateFolderName(name, collectionId, parentId)
    if (!validation.valid) {
      throw new Error(validation.errors[0].message)
    }

    const folder: Folder = {
      id: generateId(),
      name: name.trim(),
      description: description?.trim(),
      collectionId,
      parentId,
      requests: [],
      folders: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      collapsed: false
    }

    try {
      // Add to appropriate parent
      if (parentId) {
        const parentFolder = this.folders.get(parentId)
        if (!parentFolder) {
          throw new Error(`Parent folder with id ${parentId} not found`)
        }
        parentFolder.folders.push(folder)
        parentFolder.updatedAt = new Date()
      } else {
        collection.folders.push(folder)
      }

      collection.updatedAt = new Date()
      collection.metadata!.folderCount++

      await playgroundStorage.saveCollection(collection)
      this.folders.set(folder.id, folder)
      this.collections.set(collectionId, collection)
      
      this.emit('folder:created', folder)
      return folder
    } catch (error) {
      console.error('Failed to create folder:', error)
      throw error
    }
  }

  /**
   * Update a folder
   */
  async updateFolder(
    id: string,
    updates: Partial<Pick<Folder, 'name' | 'description' | 'collapsed'>>
  ): Promise<Folder> {
    const folder = this.folders.get(id)
    if (!folder) {
      throw new Error(`Folder with id ${id} not found`)
    }

    if (updates.name !== undefined) {
      const validation = this.validateFolderName(updates.name, folder.collectionId, folder.parentId, id)
      if (!validation.valid) {
        throw new Error(validation.errors[0].message)
      }
    }

    const updatedFolder: Folder = {
      ...folder,
      ...updates,
      updatedAt: new Date()
    }

    try {
      const collection = this.collections.get(folder.collectionId)!
      collection.updatedAt = new Date()
      
      await playgroundStorage.saveCollection(collection)
      this.folders.set(id, updatedFolder)
      
      this.emit('folder:updated', updatedFolder)
      return updatedFolder
    } catch (error) {
      console.error('Failed to update folder:', error)
      throw error
    }
  }

  /**
   * Delete a folder
   */
  async deleteFolder(id: string): Promise<void> {
    const folder = this.folders.get(id)
    if (!folder) {
      throw new Error(`Folder with id ${id} not found`)
    }

    const collection = this.collections.get(folder.collectionId)
    if (!collection) {
      throw new Error(`Collection with id ${folder.collectionId} not found`)
    }

    try {
      // Remove folder from parent
      if (folder.parentId) {
        const parentFolder = this.folders.get(folder.parentId)!
        parentFolder.folders = parentFolder.folders.filter(f => f.id !== id)
        parentFolder.updatedAt = new Date()
      } else {
        collection.folders = collection.folders.filter(f => f.id !== id)
      }

      // Move child requests to parent or collection root
      const requestsToMove = this.getAllRequestsInFolder(folder)
      requestsToMove.forEach(request => {
        request.folderId = folder.parentId
        request.updatedAt = new Date()
      })

      // Update collection metadata
      collection.updatedAt = new Date()
      collection.metadata!.folderCount--

      await playgroundStorage.saveCollection(collection)
      
      // Remove from cache
      this.removeFolderFromCache(folder)
      this.collections.set(collection.id, collection)
      
      this.emit('folder:deleted', folder)
    } catch (error) {
      console.error('Failed to delete folder:', error)
      throw error
    }
  }

  private getAllRequestsInFolder(folder: Folder): SavedRequest[] {
    let requests = [...folder.requests]
    folder.folders.forEach(subfolder => {
      requests = requests.concat(this.getAllRequestsInFolder(subfolder))
    })
    return requests
  }

  /**
   * Move a folder to a new parent
   */
  async moveFolder(
    folderId: string, 
    newParentId?: string
  ): Promise<void> {
    const folder = this.folders.get(folderId)
    if (!folder) {
      throw new Error(`Folder with id ${folderId} not found`)
    }

    // Prevent moving folder into itself or its children
    if (newParentId && this.isFolderDescendant(newParentId, folderId)) {
      throw new Error('Cannot move folder into itself or its descendants')
    }

    const collection = this.collections.get(folder.collectionId)!
    const oldParentId = folder.parentId

    try {
      // Remove from old parent
      if (oldParentId) {
        const oldParent = this.folders.get(oldParentId)!
        oldParent.folders = oldParent.folders.filter(f => f.id !== folderId)
        oldParent.updatedAt = new Date()
      } else {
        collection.folders = collection.folders.filter(f => f.id !== folderId)
      }

      // Add to new parent
      folder.parentId = newParentId
      folder.updatedAt = new Date()

      if (newParentId) {
        const newParent = this.folders.get(newParentId)!
        newParent.folders.push(folder)
        newParent.updatedAt = new Date()
      } else {
        collection.folders.push(folder)
      }

      collection.updatedAt = new Date()
      await playgroundStorage.saveCollection(collection)
      
      this.folders.set(folderId, folder)
      this.collections.set(collection.id, collection)
      
      this.emit('folder:updated', folder)
    } catch (error) {
      console.error('Failed to move folder:', error)
      throw error
    }
  }

  private isFolderDescendant(potentialDescendantId: string, ancestorId: string): boolean {
    const folder = this.folders.get(potentialDescendantId)
    if (!folder) return false
    
    if (folder.parentId === ancestorId) return true
    if (folder.parentId) {
      return this.isFolderDescendant(folder.parentId, ancestorId)
    }
    
    return false
  }

  // ============================================
  // Request Operations
  // ============================================

  /**
   * Add a request to a collection
   */
  async addRequest(
    collectionId: string,
    request: Omit<SavedRequest, 'id' | 'collectionId' | 'createdAt' | 'updatedAt' | 'executionCount'>,
    folderId?: string
  ): Promise<SavedRequest> {
    const collection = this.collections.get(collectionId)
    if (!collection) {
      throw new Error(`Collection with id ${collectionId} not found`)
    }

    if (folderId && !this.folders.has(folderId)) {
      throw new Error(`Folder with id ${folderId} not found`)
    }

    const savedRequest: SavedRequest = {
      ...request,
      id: generateId(),
      collectionId,
      folderId,
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0
    }

    try {
      // Add to appropriate location
      if (folderId) {
        const folder = this.folders.get(folderId)!
        folder.requests.push(savedRequest)
        folder.updatedAt = new Date()
      } else {
        collection.requests.push(savedRequest)
      }

      // Update collection metadata
      collection.updatedAt = new Date()
      collection.metadata!.requestCount++

      await playgroundStorage.saveCollection(collection)
      this.requests.set(savedRequest.id, savedRequest)
      this.collections.set(collectionId, collection)
      
      this.emit('request:created', savedRequest)
      return savedRequest
    } catch (error) {
      console.error('Failed to add request:', error)
      throw error
    }
  }

  /**
   * Update a saved request
   */
  async updateRequest(
    id: string,
    updates: Partial<Omit<SavedRequest, 'id' | 'collectionId' | 'createdAt'>>
  ): Promise<SavedRequest> {
    const request = this.requests.get(id)
    if (!request) {
      throw new Error(`Request with id ${id} not found`)
    }

    const updatedRequest: SavedRequest = {
      ...request,
      ...updates,
      updatedAt: new Date()
    }

    try {
      const collection = this.collections.get(request.collectionId)!
      collection.updatedAt = new Date()
      
      await playgroundStorage.saveCollection(collection)
      this.requests.set(id, updatedRequest)
      
      this.emit('request:updated', updatedRequest)
      return updatedRequest
    } catch (error) {
      console.error('Failed to update request:', error)
      throw error
    }
  }

  /**
   * Delete a request
   */
  async deleteRequest(id: string): Promise<void> {
    const request = this.requests.get(id)
    if (!request) {
      throw new Error(`Request with id ${id} not found`)
    }

    const collection = this.collections.get(request.collectionId)!

    try {
      // Remove from appropriate location
      if (request.folderId) {
        const folder = this.folders.get(request.folderId)!
        folder.requests = folder.requests.filter(r => r.id !== id)
        folder.updatedAt = new Date()
      } else {
        collection.requests = collection.requests.filter(r => r.id !== id)
      }

      // Update collection metadata
      collection.updatedAt = new Date()
      collection.metadata!.requestCount--

      await playgroundStorage.saveCollection(collection)
      this.requests.delete(id)
      this.collections.set(collection.id, collection)
      
      this.emit('request:deleted', request)
    } catch (error) {
      console.error('Failed to delete request:', error)
      throw error
    }
  }

  /**
   * Move a request to a different folder
   */
  async moveRequest(
    requestId: string, 
    newFolderId?: string
  ): Promise<void> {
    const request = this.requests.get(requestId)
    if (!request) {
      throw new Error(`Request with id ${requestId} not found`)
    }

    if (newFolderId && !this.folders.has(newFolderId)) {
      throw new Error(`Folder with id ${newFolderId} not found`)
    }

    const collection = this.collections.get(request.collectionId)!
    const oldFolderId = request.folderId

    try {
      // Remove from old location
      if (oldFolderId) {
        const oldFolder = this.folders.get(oldFolderId)!
        oldFolder.requests = oldFolder.requests.filter(r => r.id !== requestId)
        oldFolder.updatedAt = new Date()
      } else {
        collection.requests = collection.requests.filter(r => r.id !== requestId)
      }

      // Add to new location
      request.folderId = newFolderId
      request.updatedAt = new Date()

      if (newFolderId) {
        const newFolder = this.folders.get(newFolderId)!
        newFolder.requests.push(request)
        newFolder.updatedAt = new Date()
      } else {
        collection.requests.push(request)
      }

      collection.updatedAt = new Date()
      await playgroundStorage.saveCollection(collection)
      
      this.requests.set(requestId, request)
      this.collections.set(collection.id, collection)
      
      this.emit('request:moved', { request, oldFolderId, newFolderId })
    } catch (error) {
      console.error('Failed to move request:', error)
      throw error
    }
  }

  /**
   * Duplicate a request
   */
  async duplicateRequest(id: string, newName?: string): Promise<SavedRequest> {
    const original = this.requests.get(id)
    if (!original) {
      throw new Error(`Request with id ${id} not found`)
    }

    const duplicatedRequest: Omit<SavedRequest, 'id' | 'collectionId' | 'createdAt' | 'updatedAt' | 'executionCount'> = {
      ...original,
      name: newName || `${original.name} (Copy)`,
      lastExecuted: undefined,
      response: undefined
    }

    return this.addRequest(original.collectionId, duplicatedRequest, original.folderId)
  }

  // ============================================
  // Search & Filter
  // ============================================

  /**
   * Search requests across all collections
   */
  searchRequests(options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = []
    const query = (options.query || '').toLowerCase()

    this.requests.forEach(request => {
      let score = 0
      const matchedFields: string[] = []

      // Check collection filter
      if (options.collections && !options.collections.includes(request.collectionId)) {
        return
      }

      // Check method filter
      if (options.methods && !options.methods.includes(request.config.method)) {
        return
      }

      // Check tags filter
      if (options.tags) {
        const hasTag = request.tags.some(tag => options.tags!.includes(tag))
        if (!hasTag) return
      }

      // Text matching with scoring
      if (request.name.toLowerCase().includes(query)) {
        score += 10
        matchedFields.push('name')
      }

      if (request.description?.toLowerCase().includes(query)) {
        score += 8
        matchedFields.push('description')
      }

      if (request.config.url.toLowerCase().includes(query)) {
        score += 6
        matchedFields.push('path')
      }

      if (request.tags.some(tag => tag.toLowerCase().includes(query))) {
        score += 4
        matchedFields.push('tags')
      }

      // Check method match
      if (request.config.method.toLowerCase().includes(query)) {
        score += 3
        matchedFields.push('method')
      }

      // Only include if there's a match
      if (score > 0) {
        results.push({
          type: 'request',
          id: request.id,
          title: request.name,
          description: `${request.config.method} ${request.config.url}`,
          score,
          data: request,
          highlights: [this.generateSnippet(request, query)],
          matches: [],
          item: request
        })
      }
    })

    // Sort by relevance score
    return results.sort((a, b) => b.score - a.score)
  }

  private generateSnippet(request: SavedRequest, query: string): string {
    const text = `${request.name} ${request.description || ''} ${request.config.url}`.toLowerCase()
    const index = text.indexOf(query.toLowerCase())

    if (index === -1) return ''

    const start = Math.max(0, index - 50)
    const end = Math.min(text.length, index + query.length + 50)
    let snippet = text.slice(start, end)

    if (start > 0) snippet = '...' + snippet
    if (end < text.length) snippet = snippet + '...'

    return snippet
  }

  // ============================================
  // Validation
  // ============================================

  private validateCollectionName(name: string, excludeId?: string): ValidationResult {
    const errors: ValidationError[] = []

    if (!name || name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Collection name is required',
        code: 'REQUIRED',
        value: name
      })
    }

    if (name && name.trim().length > 100) {
      errors.push({
        field: 'name',
        message: 'Collection name must be 100 characters or less',
        code: 'MAX_LENGTH',
        value: name
      })
    }

    // Check for duplicate names
    const trimmedName = name.trim()
    const duplicate = Array.from(this.collections.values()).find(
      collection => collection.name === trimmedName && collection.id !== excludeId
    )

    if (duplicate) {
      errors.push({
        field: 'name',
        message: 'A collection with this name already exists',
        code: 'DUPLICATE',
        value: name
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    }
  }

  private validateFolderName(
    name: string, 
    collectionId: string, 
    parentId?: string,
    excludeId?: string
  ): ValidationResult {
    const errors: ValidationError[] = []

    if (!name || name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Folder name is required',
        code: 'REQUIRED',
        value: name
      })
    }

    if (name && name.trim().length > 100) {
      errors.push({
        field: 'name',
        message: 'Folder name must be 100 characters or less',
        code: 'MAX_LENGTH',
        value: name
      })
    }

    // Check for duplicate names in same parent
    const trimmedName = name.trim()
    const siblings = parentId 
      ? this.folders.get(parentId)?.folders || []
      : this.collections.get(collectionId)?.folders || []

    const duplicate = siblings.find(
      folder => folder.name === trimmedName && folder.id !== excludeId
    )

    if (duplicate) {
      errors.push({
        field: 'name',
        message: 'A folder with this name already exists in the same location',
        code: 'DUPLICATE',
        value: name
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    }
  }

  // ============================================
  // Event System
  // ============================================

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error)
        }
      })
    }
  }

  // ============================================
  // Statistics
  // ============================================

  getStats() {
    const collections = this.getAllCollections()
    const totalRequests = Array.from(this.requests.values()).length
    const totalFolders = Array.from(this.folders.values()).length
    
    const methodStats = new Map<string, number>()
    const tagStats = new Map<string, number>()
    
    this.requests.forEach(request => {
      // Method statistics
      methodStats.set(request.config.method, (methodStats.get(request.config.method) || 0) + 1)
      
      // Tag statistics
      request.tags.forEach(tag => {
        tagStats.set(tag, (tagStats.get(tag) || 0) + 1)
      })
    })

    return {
      totalCollections: collections.length,
      totalRequests,
      totalFolders,
      methodDistribution: Object.fromEntries(methodStats),
      tagDistribution: Object.fromEntries(tagStats),
      collectionsWithRequests: collections.filter(c => c.requests.length > 0).length,
      averageRequestsPerCollection: collections.length > 0 ? totalRequests / collections.length : 0
    }
  }
}

// Export singleton instance
export const collectionManager = new CollectionManager()