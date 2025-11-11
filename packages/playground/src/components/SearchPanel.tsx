/**
 * SearchPanel - Full-text search across collections, requests, workflows with advanced filtering
 * API Playground Phase 3: Collections & Workflows
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  File,
  FolderOpen,
  Zap,
  Settings,
  Clock,
  Hash,
  ExternalLink,
  Copy,
  Play,
  Edit3
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { 
  SearchResult, 
  SearchFilters, 
  SearchOptions,
  Collection,
  SavedRequest,
  Workflow,
  Variable
} from '@/types/collections'
import { searchEngine } from '@/lib/search-engine'

interface SearchPanelProps {
  onRequestSelect?: (request: SavedRequest) => void
  onCollectionSelect?: (collection: Collection) => void
  onWorkflowSelect?: (workflow: Workflow) => void
  onVariableSelect?: (variable: Variable) => void
  selectedCollectionId?: string
}

interface FilterState {
  types: string[]
  methods: string[]
  tags: string[]
  collectionIds: string[]
  category?: string
  variableScope?: string
  variableType?: string
  url?: string
}

interface SearchState {
  query: string
  filters: FilterState
  results: SearchResult[]
  loading: boolean
  suggestions: string[]
  showFilters: boolean
  selectedResultIndex: number
  hasSearched: boolean
}

interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  action: (result: SearchResult) => void
  condition?: (result: SearchResult) => boolean
}

export default function SearchPanel({
  onRequestSelect,
  onCollectionSelect,
  onWorkflowSelect,
  onVariableSelect,
  selectedCollectionId
}: SearchPanelProps) {
  // State management
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    filters: {
      types: [],
      methods: [],
      tags: [],
      collectionIds: selectedCollectionId ? [selectedCollectionId] : []
    },
    results: [],
    loading: false,
    suggestions: [],
    showFilters: false,
    selectedResultIndex: -1,
    hasSearched: false
  })

  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [popularTerms, setPopularTerms] = useState<string[]>([])
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Load popular terms on mount
  useEffect(() => {
    loadPopularTerms()
    loadRecentSearches()
  }, [])

  // Update collection filter when selectedCollectionId changes
  useEffect(() => {
    if (selectedCollectionId) {
      setSearchState(prev => ({
        ...prev,
        filters: {
          ...prev.filters,
          collectionIds: [selectedCollectionId]
        }
      }))
    }
  }, [selectedCollectionId])

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchState.query.trim()) {
        performSearch()
      } else {
        setSearchState(prev => ({ 
          ...prev, 
          results: [], 
          hasSearched: false 
        }))
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchState.query, searchState.filters])

  // Load suggestions as user types
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchState.query.trim().length >= 2) {
        loadSuggestions(searchState.query)
      } else {
        setSearchState(prev => ({ ...prev, suggestions: [] }))
      }
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [searchState.query])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target === searchInputRef.current) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSearchState(prev => ({
            ...prev,
            selectedResultIndex: Math.min(
              prev.selectedResultIndex + 1,
              prev.results.length - 1
            )
          }))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSearchState(prev => ({
            ...prev,
            selectedResultIndex: Math.max(prev.selectedResultIndex - 1, -1)
          }))
        } else if (e.key === 'Enter' && searchState.selectedResultIndex >= 0) {
          e.preventDefault()
          const result = searchState.results[searchState.selectedResultIndex]
          handleResultSelect(result)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          clearSearch()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchState.selectedResultIndex, searchState.results])

  /**
   * Load popular search terms
   */
  const loadPopularTerms = useCallback(async () => {
    try {
      const terms = searchEngine.getPopularTerms(10)
      setPopularTerms(terms)
    } catch (error) {
      console.error('Failed to load popular terms:', error)
    }
  }, [])

  /**
   * Load recent searches from localStorage
   */
  const loadRecentSearches = useCallback(() => {
    try {
      const recent = JSON.parse(localStorage.getItem('truxe_recent_searches') || '[]')
      setRecentSearches(recent.slice(0, 10))
    } catch (error) {
      console.error('Failed to load recent searches:', error)
    }
  }, [])

  /**
   * Save recent search
   */
  const saveRecentSearch = useCallback((query: string) => {
    try {
      const recent = JSON.parse(localStorage.getItem('truxe_recent_searches') || '[]')
      const updated = [query, ...recent.filter((q: string) => q !== query)].slice(0, 10)
      localStorage.setItem('truxe_recent_searches', JSON.stringify(updated))
      setRecentSearches(updated)
    } catch (error) {
      console.error('Failed to save recent search:', error)
    }
  }, [])

  /**
   * Load search suggestions
   */
  const loadSuggestions = useCallback(async (query: string) => {
    try {
      const suggestions = await searchEngine.getSuggestions(query, 8)
      setSearchState(prev => ({ ...prev, suggestions }))
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }, [])

  /**
   * Perform search
   */
  const performSearch = useCallback(async () => {
    const { query, filters } = searchState
    if (!query.trim()) return

    setSearchState(prev => ({ ...prev, loading: true }))
    
    try {
      const searchFilters: SearchFilters = {
        types: filters.types.length > 0 ? filters.types as any : undefined,
        methods: filters.methods.length > 0 ? filters.methods as any : undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
        collectionIds: filters.collectionIds.length > 0 ? filters.collectionIds : undefined,
        category: filters.category || undefined,
        variableScope: filters.variableScope as any,
        variableType: filters.variableType as any,
        url: filters.url || undefined
      }

      const searchOptions: SearchOptions = {
        limit: 50,
        typeOrder: ['request', 'collection', 'workflow', 'folder', 'variable']
      }

      const results = await searchEngine.search(query, searchFilters, searchOptions)
      
      setSearchState(prev => ({ 
        ...prev, 
        results, 
        loading: false,
        hasSearched: true,
        selectedResultIndex: -1
      }))

      // Save to recent searches
      saveRecentSearch(query)
      
    } catch (error) {
      console.error('Search failed:', error)
      setSearchState(prev => ({ 
        ...prev, 
        results: [], 
        loading: false,
        hasSearched: true
      }))
    }
  }, [searchState.query, searchState.filters, saveRecentSearch])

  /**
   * Clear search
   */
  const clearSearch = useCallback(() => {
    setSearchState(prev => ({
      ...prev,
      query: '',
      results: [],
      suggestions: [],
      selectedResultIndex: -1,
      hasSearched: false
    }))
    
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  /**
   * Handle result selection
   */
  const handleResultSelect = useCallback((result: SearchResult) => {
    switch (result.type) {
      case 'request':
        if (onRequestSelect) {
          onRequestSelect(result.data as SavedRequest)
        }
        break
      case 'collection':
        if (onCollectionSelect) {
          onCollectionSelect(result.data as Collection)
        }
        break
      case 'workflow':
        if (onWorkflowSelect) {
          onWorkflowSelect(result.data as Workflow)
        }
        break
      case 'variable':
        if (onVariableSelect) {
          onVariableSelect(result.data as Variable)
        }
        break
    }
  }, [onRequestSelect, onCollectionSelect, onWorkflowSelect, onVariableSelect])

  /**
   * Toggle result expansion
   */
  const toggleResultExpansion = useCallback((resultId: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(resultId)) {
        newSet.delete(resultId)
      } else {
        newSet.add(resultId)
      }
      return newSet
    })
  }, [])

  /**
   * Update search query
   */
  const updateQuery = useCallback((query: string) => {
    setSearchState(prev => ({ ...prev, query }))
  }, [])

  /**
   * Update filters
   */
  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    setSearchState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...updates }
    }))
  }, [])

  /**
   * Quick actions for search results
   */
  const quickActions = useMemo((): QuickAction[] => [
    {
      id: 'open',
      label: 'Open',
      icon: <ExternalLink className="w-3 h-3" />,
      action: handleResultSelect
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: <Copy className="w-3 h-3" />,
      action: (result) => {
        const text = result.type === 'request' 
          ? (result.data as SavedRequest).config.url
          : result.title
        navigator.clipboard.writeText(text)
      }
    },
    {
      id: 'execute',
      label: 'Execute',
      icon: <Play className="w-3 h-3" />,
      action: handleResultSelect,
      condition: (result) => result.type === 'request' || result.type === 'workflow'
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: <Edit3 className="w-3 h-3" />,
      action: handleResultSelect
    }
  ], [handleResultSelect])

  /**
   * Get result icon
   */
  const getResultIcon = useCallback((result: SearchResult) => {
    switch (result.type) {
      case 'collection':
        return <FolderOpen className="w-4 h-4 text-blue-500" />
      case 'folder':
        return <FolderOpen className="w-4 h-4 text-yellow-500" />
      case 'request':
        const request = result.data as SavedRequest
        const methodColors = {
          GET: 'text-green-500',
          POST: 'text-blue-500',
          PUT: 'text-orange-500',
          DELETE: 'text-red-500',
          PATCH: 'text-purple-500'
        }
        return <File className={`w-4 h-4 ${methodColors[request.config.method as keyof typeof methodColors] || 'text-gray-500'}`} />
      case 'workflow':
        return <Zap className="w-4 h-4 text-indigo-500" />
      case 'variable':
        return <Settings className="w-4 h-4 text-emerald-500" />
      default:
        return <File className="w-4 h-4 text-gray-500" />
    }
  }, [])

  /**
   * Highlight search terms in text
   */
  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim()) return text
    
    const terms = query.toLowerCase().split(/\s+/)
    let highlighted = text
    
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi')
      highlighted = highlighted.replace(regex, '<mark className="bg-yellow-200">$1</mark>')
    })
    
    return highlighted
  }, [])

  return (
    <div className="h-full flex flex-col bg-background border-r">
      {/* Search Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search collections, requests, workflows..."
              value={searchState.query}
              onChange={(e) => updateQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchState.query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-muted rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchState(prev => ({ 
              ...prev, 
              showFilters: !prev.showFilters 
            }))}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Search suggestions */}
        {searchState.suggestions.length > 0 && searchState.query.length >= 2 && (
          <div className="mt-2">
            <div className="text-xs text-muted-foreground mb-1">Suggestions:</div>
            <div className="flex flex-wrap gap-1">
              {searchState.suggestions.map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => updateQuery(suggestion)}
                  className="text-xs px-2 py-1 bg-muted hover:bg-accent rounded"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        {searchState.showFilters && (
          <div className="mt-3 p-3 border rounded-md space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Type filter */}
              <div>
                <label className="text-xs font-medium block mb-1">Types</label>
                <div className="space-y-1">
                  {['collection', 'request', 'workflow', 'variable'].map(type => (
                    <label key={type} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={searchState.filters.types.includes(type)}
                        onChange={(e) => {
                          const types = e.target.checked
                            ? [...searchState.filters.types, type]
                            : searchState.filters.types.filter(t => t !== type)
                          updateFilters({ types })
                        }}
                        className="rounded"
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              {/* Method filter */}
              <div>
                <label className="text-xs font-medium block mb-1">Methods</label>
                <div className="space-y-1">
                  {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(method => (
                    <label key={method} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={searchState.filters.methods.includes(method)}
                        onChange={(e) => {
                          const methods = e.target.checked
                            ? [...searchState.filters.methods, method]
                            : searchState.filters.methods.filter(m => m !== method)
                          updateFilters({ methods })
                        }}
                        className="rounded"
                      />
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        {
                          GET: 'bg-green-100 text-green-700',
                          POST: 'bg-blue-100 text-blue-700',
                          PUT: 'bg-orange-100 text-orange-700',
                          DELETE: 'bg-red-100 text-red-700',
                          PATCH: 'bg-purple-100 text-purple-700'
                        }[method]
                      }`}>
                        {method}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Clear filters */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateFilters({
                  types: [],
                  methods: [],
                  tags: [],
                  collectionIds: selectedCollectionId ? [selectedCollectionId] : [],
                  category: undefined,
                  variableScope: undefined,
                  variableType: undefined,
                  url: undefined
                })}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-auto" ref={resultsRef}>
        {searchState.loading && (
          <div className="p-4 text-center text-muted-foreground">
            <div className="animate-spin w-4 h-4 border border-primary border-t-transparent rounded-full mx-auto mb-2" />
            Searching...
          </div>
        )}

        {!searchState.loading && !searchState.hasSearched && !searchState.query && (
          <div className="p-4 space-y-4">
            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Recent Searches
                </h3>
                <div className="space-y-1">
                  {recentSearches.map(search => (
                    <button
                      key={search}
                      onClick={() => updateQuery(search)}
                      className="w-full text-left px-2 py-1 text-sm hover:bg-muted rounded"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular terms */}
            {popularTerms.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  Popular Terms
                </h3>
                <div className="flex flex-wrap gap-1">
                  {popularTerms.map(term => (
                    <button
                      key={term}
                      onClick={() => updateQuery(term)}
                      className="text-xs px-2 py-1 bg-muted hover:bg-accent rounded"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!searchState.loading && searchState.hasSearched && searchState.results.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            <p>No results found for "{searchState.query}"</p>
            <p className="text-xs mt-1">Try different keywords or adjust your filters</p>
          </div>
        )}

        {!searchState.loading && searchState.results.length > 0 && (
          <div className="p-4">
            <div className="text-sm text-muted-foreground mb-3">
              {searchState.results.length} results for "{searchState.query}"
            </div>
            
            <div className="space-y-2">
              {searchState.results.map((result, index) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  isSelected={index === searchState.selectedResultIndex}
                  isExpanded={expandedResults.has(result.id)}
                  query={searchState.query}
                  icon={getResultIcon(result)}
                  quickActions={quickActions.filter(action => 
                    !action.condition || action.condition(result)
                  )}
                  onSelect={() => handleResultSelect(result)}
                  onToggleExpansion={() => toggleResultExpansion(result.id)}
                  onQuickAction={(action) => action.action(result)}
                  highlightText={highlightText}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search stats */}
      {searchState.hasSearched && (
        <div className="p-2 border-t text-xs text-muted-foreground">
          {searchState.results.length} results • {searchEngine.getIndexStats().totalItems} items indexed
        </div>
      )}
    </div>
  )
}

/**
 * Search Result Card Component
 */
interface SearchResultCardProps {
  result: SearchResult
  isSelected: boolean
  isExpanded: boolean
  query: string
  icon: React.ReactNode
  quickActions: QuickAction[]
  onSelect: () => void
  onToggleExpansion: () => void
  onQuickAction: (action: QuickAction) => void
  highlightText: (text: string, query: string) => string
}

function SearchResultCard({
  result,
  isSelected,
  isExpanded,
  query,
  icon,
  quickActions,
  onSelect,
  onToggleExpansion,
  onQuickAction,
  highlightText
}: SearchResultCardProps) {
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'collection': return 'Collection'
      case 'folder': return 'Folder'
      case 'request': return 'Request'
      case 'workflow': return 'Workflow'
      case 'variable': return 'Variable'
      default: return type
    }
  }

  const getMethodBadge = () => {
    if (result.type === 'request') {
      const request = result.data as SavedRequest
      return (
        <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
          {
            GET: 'bg-green-100 text-green-700',
            POST: 'bg-blue-100 text-blue-700',
            PUT: 'bg-orange-100 text-orange-700',
            DELETE: 'bg-red-100 text-red-700',
            PATCH: 'bg-purple-100 text-purple-700'
          }[request.config.method] || 'bg-gray-100 text-gray-700'
        }`}>
          {request.config.method}
        </span>
      )
    }
    return null
  }

  return (
    <div className={`border rounded-md ${isSelected ? 'bg-accent border-primary' : 'hover:bg-muted/50'}`}>
      <div
        className="flex items-start gap-3 p-3 cursor-pointer"
        onClick={onSelect}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          {icon}
          <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
            {getTypeLabel(result.type)}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 
              className="text-sm font-medium truncate"
              dangerouslySetInnerHTML={{ 
                __html: highlightText(result.title, query) 
              }}
            />
            
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {getMethodBadge()}
              
              <span className="text-xs text-muted-foreground">
                Score: {result.score}
              </span>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpansion()
                }}
                className="p-1 hover:bg-accent rounded"
              >
                {isExpanded ? 
                  <ChevronDown className="w-3 h-3" /> : 
                  <ChevronRight className="w-3 h-3" />
                }
              </button>
            </div>
          </div>
          
          <p 
            className="text-xs text-muted-foreground truncate"
            dangerouslySetInnerHTML={{ 
              __html: highlightText(result.description || '', query) 
            }}
          />
          
          {/* Highlights */}
          {result.highlights && result.highlights.length > 0 && (
            <div className="mt-2 text-xs">
              {result.highlights.slice(0, 2).map((highlight, index) => {
                const highlightText = typeof highlight === 'string' ? highlight : highlight.text
                return (
                  <div
                    key={index}
                    className="text-muted-foreground truncate"
                    dangerouslySetInnerHTML={{
                      __html: highlightText
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t px-3 pb-3">
          <div className="mt-3 space-y-2">
            {/* Additional details */}
            <div className="text-xs space-y-1">
              {result.type === 'request' && (
                <div>
                  <strong>URL:</strong> 
                  <span 
                    className="ml-1 font-mono"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightText((result.data as SavedRequest).config.url, query) 
                    }}
                  />
                </div>
              )}
              
              {result.type === 'workflow' && (
                <div>
                  <strong>Category:</strong> {(result.data as Workflow).category}
                </div>
              )}
              
              {result.type === 'variable' && (
                <div>
                  <strong>Scope:</strong> {(result.data as Variable).scope} • 
                  <strong> Type:</strong> {(result.data as Variable).type}
                </div>
              )}
            </div>
            
            {/* Quick actions */}
            <div className="flex items-center gap-1 pt-2">
              {quickActions.map(action => (
                <Button
                  key={action.id}
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onQuickAction(action)
                  }}
                  className="h-6 px-2 text-xs"
                >
                  {action.icon}
                  <span className="ml-1">{action.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}