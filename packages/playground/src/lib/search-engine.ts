/**
 * SearchEngine - Full-text search across collections, requests, and workflows
 * API Playground Phase 3: Collections & Workflows
 */

import {
  Collection,
  SavedRequest,
  Folder,
  Variable,
  Workflow,
  SearchResult,
  SearchFilters,
  SearchOptions
} from '../types/collections'
import { playgroundStorage } from './storage'

export interface SearchIndex {
  collections: Map<string, SearchableCollection>
  requests: Map<string, SearchableRequest>
  folders: Map<string, SearchableFolder>
  workflows: Map<string, SearchableWorkflow>
  variables: Map<string, SearchableVariable>
}

interface SearchableCollection {
  id: string
  name: string
  description: string
  tags: string[]
  searchableText: string
  collection: Collection
}

interface SearchableRequest {
  id: string
  name: string
  description: string
  url: string
  method: string
  tags: string[]
  collectionId: string
  folderId?: string
  searchableText: string
  request: SavedRequest
}

interface SearchableFolder {
  id: string
  name: string
  description: string
  collectionId: string
  searchableText: string
  folder: Folder
}

interface SearchableWorkflow {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  searchableText: string
  workflow: Workflow
}

interface SearchableVariable {
  id: string
  key: string
  value: string
  description: string
  type: string
  scope: string
  searchableText: string
  variable: Variable
}

export class SearchEngine {
  private index: SearchIndex = {
    collections: new Map(),
    requests: new Map(),
    folders: new Map(),
    workflows: new Map(),
    variables: new Map()
  }
  
  private indexLastUpdated = 0
  private readonly INDEX_REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.initializeIndex()
  }

  /**
   * Initialize search index
   */
  async initializeIndex(): Promise<void> {
    try {
      await this.rebuildIndex()
    } catch (error) {
      console.error('Failed to initialize search index:', error)
    }
  }

  /**
   * Rebuild the entire search index
   */
  async rebuildIndex(): Promise<void> {
    try {
      // Clear existing index
      this.index.collections.clear()
      this.index.requests.clear()
      this.index.folders.clear()
      this.index.workflows.clear()
      this.index.variables.clear()

      // Load all data
      const [collections, savedRequests, folders, workflows, variables] = await Promise.all([
        playgroundStorage.loadCollections(),
        playgroundStorage.loadSavedRequests(),
        playgroundStorage.loadFolders(),
        playgroundStorage.loadWorkflows(),
        playgroundStorage.loadVariables()
      ])

      // Index collections
      collections.forEach(collection => {
        this.indexCollection(collection)
      })

      // Index requests
      savedRequests.forEach(request => {
        this.indexRequest(request)
      })

      // Index folders
      folders.forEach(folder => {
        this.indexFolder(folder)
      })

      // Index workflows
      workflows.forEach(workflow => {
        this.indexWorkflow(workflow)
      })

      // Index variables
      Object.values(variables).forEach(variable => {
        this.indexVariable(variable)
      })

      this.indexLastUpdated = Date.now()
      console.log(`Search index rebuilt with ${this.getIndexStats().totalItems} items`)

    } catch (error) {
      console.error('Failed to rebuild search index:', error)
      throw error
    }
  }

  /**
   * Check if index needs refresh and update if necessary
   */
  private async ensureIndexFresh(): Promise<void> {
    const now = Date.now()
    if (now - this.indexLastUpdated > this.INDEX_REFRESH_INTERVAL) {
      await this.rebuildIndex()
    }
  }

  /**
   * Index a collection
   */
  private indexCollection(collection: Collection): void {
    const searchableText = this.createSearchableText([
      collection.name,
      collection.description,
      ...(collection.tags || [])
    ])

    const searchableCollection: SearchableCollection = {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      tags: collection.tags || [],
      searchableText,
      collection
    }

    this.index.collections.set(collection.id, searchableCollection)
  }

  /**
   * Index a saved request
   */
  private indexRequest(request: SavedRequest): void {
    const headers = request.config.headers ?
      Object.entries(request.config.headers).map(([k, v]) => `${k}: ${v}`).join(' ') : ''

    const body = typeof request.config.body === 'string' ? request.config.body :
      request.config.body ? JSON.stringify(request.config.body) : ''

    const searchableText = this.createSearchableText([
      request.name,
      request.description || '',
      request.config.url,
      request.config.method,
      headers,
      body,
      ...request.tags
    ])

    const searchableRequest: SearchableRequest = {
      id: request.id,
      name: request.name,
      description: request.description || '',
      url: request.config.url,
      method: request.config.method,
      tags: request.tags,
      collectionId: request.collectionId,
      folderId: request.folderId,
      searchableText,
      request
    }

    this.index.requests.set(request.id, searchableRequest)
  }

  /**
   * Index a folder
   */
  private indexFolder(folder: Folder): void {
    const searchableText = this.createSearchableText([
      folder.name,
      folder.description || ''
    ])

    const searchableFolder: SearchableFolder = {
      id: folder.id,
      name: folder.name,
      description: folder.description || '',
      collectionId: folder.collectionId,
      searchableText,
      folder
    }

    this.index.folders.set(folder.id, searchableFolder)
  }

  /**
   * Index a workflow
   */
  private indexWorkflow(workflow: Workflow): void {
    const stepsText = workflow.steps.map(step => 
      `${step.name} ${step.description || ''} ${step.request.url} ${step.request.method}`
    ).join(' ')

    const variablesText = workflow.variables?.map(v => 
      `${v.key} ${v.description || ''}`
    ).join(' ') || ''

    const searchableText = this.createSearchableText([
      workflow.name,
      workflow.description,
      workflow.category,
      stepsText,
      variablesText,
      ...workflow.tags
    ])

    const searchableWorkflow: SearchableWorkflow = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      category: workflow.category,
      tags: workflow.tags,
      searchableText,
      workflow
    }

    this.index.workflows.set(workflow.id, searchableWorkflow)
  }

  /**
   * Index a variable
   */
  private indexVariable(variable: Variable): void {
    const valueText = typeof variable.value === 'string' ? variable.value :
      JSON.stringify(variable.value)

    const searchableText = this.createSearchableText([
      variable.key,
      variable.description || '',
      valueText,
      variable.type,
      variable.scope
    ])

    const searchableVariable: SearchableVariable = {
      id: variable.id,
      key: variable.key,
      value: valueText,
      description: variable.description || '',
      type: variable.type,
      scope: variable.scope,
      searchableText,
      variable
    }

    this.index.variables.set(variable.id, searchableVariable)
  }

  /**
   * Create searchable text from multiple fields
   */
  private createSearchableText(fields: string[]): string {
    return fields
      .filter(field => field && typeof field === 'string')
      .join(' ')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Search across all indexed content
   */
  async search(
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    
    await this.ensureIndexFresh()
    
    if (!query.trim()) {
      return []
    }

    const results: SearchResult[] = []
    const processedQuery = this.preprocessQuery(query)
    const searchTerms = this.extractSearchTerms(processedQuery)

    // Search collections
    if (!filters.types || filters.types.includes('collection')) {
      this.searchCollections(searchTerms, filters, results)
    }

    // Search requests
    if (!filters.types || filters.types.includes('request')) {
      this.searchRequests(searchTerms, filters, results)
    }

    // Search folders
    if (!filters.types || filters.types.includes('folder')) {
      this.searchFolders(searchTerms, filters, results)
    }

    // Search workflows
    if (!filters.types || filters.types.includes('workflow')) {
      this.searchWorkflows(searchTerms, filters, results)
    }

    // Search variables
    if (!filters.types || filters.types.includes('variable')) {
      this.searchVariables(searchTerms, filters, results)
    }

    // Sort and limit results
    const sortedResults = this.sortResults(results, options)
    const limit = options.limit || 50
    
    return sortedResults.slice(0, limit)
  }

  /**
   * Preprocess search query
   */
  private preprocessQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s"]/g, ' ')
      .replace(/\s+/g, ' ')
  }

  /**
   * Extract search terms from query
   */
  private extractSearchTerms(query: string): string[] {
    const terms: string[] = []
    const regex = /"([^"]+)"|(\S+)/g
    let match

    while ((match = regex.exec(query)) !== null) {
      terms.push(match[1] || match[2])
    }

    return terms.filter(term => term.length > 0)
  }

  /**
   * Search collections
   */
  private searchCollections(
    searchTerms: string[], 
    filters: SearchFilters, 
    results: SearchResult[]
  ): void {
    
    for (const [id, collection] of this.index.collections) {
      const score = this.calculateScore(collection.searchableText, searchTerms)
      
      if (score > 0) {
        // Apply collection-specific filters
        if (filters.collectionIds && !filters.collectionIds.includes(id)) {
          continue
        }

        if (filters.tags && !collection.tags.some(tag => 
          filters.tags!.some(filterTag => tag.toLowerCase().includes(filterTag.toLowerCase()))
        )) {
          continue
        }

        results.push({
          type: 'collection',
          id,
          title: collection.name,
          description: collection.description,
          score,
          data: collection.collection,
          highlights: this.generateHighlights(collection.searchableText, searchTerms),
          matches: [],
          item: collection.collection
        })
      }
    }
  }

  /**
   * Search requests
   */
  private searchRequests(
    searchTerms: string[], 
    filters: SearchFilters, 
    results: SearchResult[]
  ): void {
    
    for (const [id, request] of this.index.requests) {
      const score = this.calculateScore(request.searchableText, searchTerms)
      
      if (score > 0) {
        // Apply request-specific filters
        if (filters.collectionIds && !filters.collectionIds.includes(request.collectionId)) {
          continue
        }

        if (filters.methods && !filters.methods.includes(request.method)) {
          continue
        }

        if (filters.tags && !request.tags.some(tag => 
          filters.tags!.some(filterTag => tag.toLowerCase().includes(filterTag.toLowerCase()))
        )) {
          continue
        }

        if (filters.url && !request.url.toLowerCase().includes(filters.url.toLowerCase())) {
          continue
        }

        results.push({
          type: 'request',
          id,
          title: request.name,
          description: `${request.method} ${request.url}`,
          score,
          data: request.request,
          highlights: this.generateHighlights(request.searchableText, searchTerms),
          matches: [],
          item: request.request
        })
      }
    }
  }

  /**
   * Search folders
   */
  private searchFolders(
    searchTerms: string[], 
    filters: SearchFilters, 
    results: SearchResult[]
  ): void {
    
    for (const [id, folder] of this.index.folders) {
      const score = this.calculateScore(folder.searchableText, searchTerms)
      
      if (score > 0) {
        if (filters.collectionIds && !filters.collectionIds.includes(folder.collectionId)) {
          continue
        }

        results.push({
          type: 'folder',
          id,
          title: folder.name,
          description: folder.description || '',
          score,
          data: folder.folder,
          highlights: this.generateHighlights(folder.searchableText, searchTerms),
          matches: [],
          item: folder.folder
        })
      }
    }
  }

  /**
   * Search workflows
   */
  private searchWorkflows(
    searchTerms: string[], 
    filters: SearchFilters, 
    results: SearchResult[]
  ): void {
    
    for (const [id, workflow] of this.index.workflows) {
      const score = this.calculateScore(workflow.searchableText, searchTerms)
      
      if (score > 0) {
        if (filters.category && workflow.category !== filters.category) {
          continue
        }

        if (filters.tags && !workflow.tags.some(tag => 
          filters.tags!.some(filterTag => tag.toLowerCase().includes(filterTag.toLowerCase()))
        )) {
          continue
        }

        results.push({
          type: 'workflow',
          id,
          title: workflow.name,
          description: workflow.description,
          score,
          data: workflow.workflow,
          highlights: this.generateHighlights(workflow.searchableText, searchTerms),
          matches: [],
          item: workflow.workflow
        })
      }
    }
  }

  /**
   * Search variables
   */
  private searchVariables(
    searchTerms: string[], 
    filters: SearchFilters, 
    results: SearchResult[]
  ): void {
    
    for (const [id, variable] of this.index.variables) {
      const score = this.calculateScore(variable.searchableText, searchTerms)
      
      if (score > 0) {
        if (filters.variableScope && variable.scope !== filters.variableScope) {
          continue
        }

        if (filters.variableType && variable.type !== filters.variableType) {
          continue
        }

        results.push({
          type: 'variable',
          id,
          title: variable.key,
          description: variable.description || variable.value,
          score,
          data: variable.variable,
          highlights: this.generateHighlights(variable.searchableText, searchTerms),
          matches: [],
          item: variable.variable
        })
      }
    }
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateScore(text: string, searchTerms: string[]): number {
    let score = 0
    const words = text.toLowerCase().split(/\s+/)
    
    for (const term of searchTerms) {
      const termLower = term.toLowerCase()
      
      // Exact match bonus
      if (text.includes(termLower)) {
        score += 10
      }
      
      // Word boundary matches
      const wordMatches = words.filter(word => word.includes(termLower)).length
      score += wordMatches * 5
      
      // Prefix matches
      const prefixMatches = words.filter(word => word.startsWith(termLower)).length
      score += prefixMatches * 3
      
      // Partial matches
      const partialMatches = words.filter(word => 
        word.length > 3 && termLower.length > 2 && word.includes(termLower)
      ).length
      score += partialMatches * 1
    }
    
    return score
  }

  /**
   * Generate search highlights
   */
  private generateHighlights(text: string, searchTerms: string[]): string[] {
    const highlights: string[] = []
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    for (const sentence of sentences) {
      for (const term of searchTerms) {
        if (sentence.toLowerCase().includes(term.toLowerCase())) {
          highlights.push(sentence.trim())
          break
        }
      }
    }
    
    return highlights.slice(0, 3) // Limit to 3 highlights per result
  }

  /**
   * Sort search results by relevance and other factors
   */
  private sortResults(results: SearchResult[], options: SearchOptions): SearchResult[] {
    return results.sort((a, b) => {
      // Primary sort by score
      if (a.score !== b.score) {
        return b.score - a.score
      }
      
      // Secondary sort by type priority (if specified)
      if (options.typeOrder) {
        const aIndex = options.typeOrder.indexOf(a.type)
        const bIndex = options.typeOrder.indexOf(b.type)
        if (aIndex !== bIndex) {
          return aIndex - bIndex
        }
      }
      
      // Tertiary sort by title
      return a.title.localeCompare(b.title)
    })
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(partialQuery: string, limit = 10): Promise<string[]> {
    await this.ensureIndexFresh()
    
    if (!partialQuery.trim() || partialQuery.length < 2) {
      return []
    }
    
    const suggestions = new Set<string>()
    const queryLower = partialQuery.toLowerCase()
    
    // Collect suggestions from all indexed content
    const allText = [
      ...Array.from(this.index.collections.values()).map(c => c.searchableText),
      ...Array.from(this.index.requests.values()).map(r => r.searchableText),
      ...Array.from(this.index.workflows.values()).map(w => w.searchableText),
      ...Array.from(this.index.variables.values()).map(v => v.searchableText)
    ].join(' ')
    
    const words = allText.split(/\s+/)
    
    for (const word of words) {
      if (word.length >= 3 && word.toLowerCase().includes(queryLower)) {
        suggestions.add(word)
        if (suggestions.size >= limit * 2) break // Collect more than needed for filtering
      }
    }
    
    // Return sorted suggestions
    return Array.from(suggestions)
      .sort((a, b) => {
        // Prefer words that start with the query
        const aStarts = a.toLowerCase().startsWith(queryLower)
        const bStarts = b.toLowerCase().startsWith(queryLower)
        if (aStarts !== bStarts) {
          return bStarts ? 1 : -1
        }
        return a.length - b.length // Prefer shorter words
      })
      .slice(0, limit)
  }

  /**
   * Get popular search terms
   */
  getPopularTerms(limit = 20): string[] {
    const termCounts = new Map<string, number>()
    
    // Count word frequencies across all indexed content
    const allText = [
      ...Array.from(this.index.collections.values()).map(c => c.searchableText),
      ...Array.from(this.index.requests.values()).map(r => r.searchableText),
      ...Array.from(this.index.workflows.values()).map(w => w.searchableText),
      ...Array.from(this.index.variables.values()).map(v => v.searchableText)
    ].join(' ')
    
    const words = allText.split(/\s+/)
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'])
    
    for (const word of words) {
      if (word.length >= 3 && !stopWords.has(word)) {
        termCounts.set(word, (termCounts.get(word) || 0) + 1)
      }
    }
    
    return Array.from(termCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([term]) => term)
  }

  /**
   * Get index statistics
   */
  getIndexStats() {
    return {
      collections: this.index.collections.size,
      requests: this.index.requests.size,
      folders: this.index.folders.size,
      workflows: this.index.workflows.size,
      variables: this.index.variables.size,
      totalItems: this.index.collections.size + 
                  this.index.requests.size + 
                  this.index.folders.size + 
                  this.index.workflows.size + 
                  this.index.variables.size,
      lastUpdated: new Date(this.indexLastUpdated)
    }
  }

  /**
   * Clear search index
   */
  clearIndex(): void {
    this.index.collections.clear()
    this.index.requests.clear()
    this.index.folders.clear()
    this.index.workflows.clear()
    this.index.variables.clear()
    this.indexLastUpdated = 0
  }

  /**
   * Add item to index
   */
  async addToIndex(type: string, item: any): Promise<void> {
    switch (type) {
      case 'collection':
        this.indexCollection(item)
        break
      case 'request':
        this.indexRequest(item)
        break
      case 'folder':
        this.indexFolder(item)
        break
      case 'workflow':
        this.indexWorkflow(item)
        break
      case 'variable':
        this.indexVariable(item)
        break
    }
  }

  /**
   * Remove item from index
   */
  removeFromIndex(type: string, id: string): void {
    switch (type) {
      case 'collection':
        this.index.collections.delete(id)
        break
      case 'request':
        this.index.requests.delete(id)
        break
      case 'folder':
        this.index.folders.delete(id)
        break
      case 'workflow':
        this.index.workflows.delete(id)
        break
      case 'variable':
        this.index.variables.delete(id)
        break
    }
  }
}

// Export singleton instance
export const searchEngine = new SearchEngine()