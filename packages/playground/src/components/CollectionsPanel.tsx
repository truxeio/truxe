/**
 * CollectionsPanel - Simplified panel for selecting collections and requests
 * Used in the main app sidebar for collection-based request navigation
 */

import { useState, useEffect } from 'react'
import { 
  FolderOpen, 
  Folder, 
  File, 
  ChevronDown,
  ChevronRight,
  Search,
  Plus
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { 
  Collection, 
  SavedRequest, 
  Folder as CollectionFolder
} from '@/types/collections'

import { playgroundStorage } from '@/lib/storage'

interface CollectionsPanelProps {
  selectedRequest: SavedRequest | null
  selectedCollectionId: string | null
  onSelectRequest: (request: SavedRequest | null) => void
  onSelectCollection: (collectionId: string | null) => void
}

interface TreeItem {
  id: string
  type: 'collection' | 'folder' | 'request'
  name: string
  item: Collection | CollectionFolder | SavedRequest
  children: TreeItem[]
  isExpanded: boolean
}

export default function CollectionsPanel({
  selectedRequest,
  selectedCollectionId,
  onSelectRequest,
  onSelectCollection
}: CollectionsPanelProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  // Load collections on mount
  useEffect(() => {
    loadCollections()
  }, [])

  const loadCollections = async () => {
    try {
      setIsLoading(true)
      const loadedCollections = await playgroundStorage.loadCollections()
      setCollections(loadedCollections)
    } catch (error) {
      console.error('Failed to load collections:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Build tree structure
  const buildTree = (collections: Collection[]): TreeItem[] => {
    return collections.map(collection => ({
      id: collection.id,
      type: 'collection' as const,
      name: collection.name,
      item: collection,
      isExpanded: expandedItems.has(collection.id),
      children: [
        // Add folders first
        ...collection.folders.map(folder => buildFolderTree(folder)),
        // Add direct requests
        ...collection.requests
          .filter(request => !request.folderId) // Only root-level requests
          .map(request => ({
            id: request.id,
            type: 'request' as const,
            name: request.name,
            item: request,
            children: [],
            isExpanded: false
          }))
      ]
    }))
  }

  const buildFolderTree = (folder: CollectionFolder): TreeItem => ({
    id: folder.id,
    type: 'folder' as const,
    name: folder.name,
    item: folder,
    isExpanded: expandedItems.has(folder.id),
    children: [
      // Add subfolders
      ...folder.folders.map(subfolder => buildFolderTree(subfolder)),
      // Add requests in this folder
      ...folder.requests.map(request => ({
        id: request.id,
        type: 'request' as const,
        name: request.name,
        item: request,
        children: [],
        isExpanded: false
      }))
    ]
  })

  // Filter tree based on search
  const filterTree = (items: TreeItem[], query: string): TreeItem[] => {
    if (!query.trim()) return items

    const lowerQuery = query.toLowerCase()
    
    return items.reduce<TreeItem[]>((filtered, item) => {
      const matchesName = item.name.toLowerCase().includes(lowerQuery)
      const filteredChildren = filterTree(item.children, query)
      
      if (matchesName || filteredChildren.length > 0) {
        filtered.push({
          ...item,
          children: filteredChildren,
          isExpanded: filteredChildren.length > 0 || item.isExpanded
        })
      }
      
      return filtered
    }, [])
  }

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  const handleItemClick = (item: TreeItem) => {
    if (item.type === 'collection') {
      const collection = item.item as Collection
      onSelectCollection(collection.id)
      toggleExpanded(item.id)
    } else if (item.type === 'folder') {
      toggleExpanded(item.id)
    } else if (item.type === 'request') {
      const request = item.item as SavedRequest
      onSelectRequest(request)
    }
  }

  const renderTreeItem = (item: TreeItem, depth: number = 0) => {
    const hasChildren = item.children.length > 0
    const isSelected = item.type === 'request' && selectedRequest?.id === item.id
    const isCollectionSelected = item.type === 'collection' && selectedCollectionId === item.id

    return (
      <div key={item.id}>
        <div
          className={`
            flex items-center px-2 py-1 rounded cursor-pointer hover:bg-muted/50 transition-colors
            ${isSelected ? 'bg-primary/10 text-primary' : ''}
            ${isCollectionSelected ? 'bg-muted' : ''}
          `}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => handleItemClick(item)}
        >
          {/* Expand/collapse button */}
          {hasChildren && (
            <button
              className="mr-1 p-0.5 hover:bg-muted rounded"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpanded(item.id)
              }}
            >
              {item.isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          )}
          
          {/* Icon */}
          <div className="mr-2 flex-shrink-0">
            {item.type === 'collection' && <FolderOpen className="w-4 h-4 text-blue-500" />}
            {item.type === 'folder' && <Folder className="w-4 h-4 text-yellow-500" />}
            {item.type === 'request' && <File className="w-4 h-4 text-primary" />}
          </div>
          
          {/* Name */}
          <span className="text-sm truncate flex-1">{item.name}</span>
          
          {/* Method badge for requests */}
          {item.type === 'request' && (
            <span className={`
              text-xs px-1.5 py-0.5 rounded font-mono ml-2
              ${getMethodColor((item.item as SavedRequest).config.method)}
            `}>
              {(item.item as SavedRequest).config.method}
            </span>
          )}
        </div>
        
        {/* Children */}
        {item.isExpanded && hasChildren && (
          <div>
            {item.children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const getMethodColor = (method: string) => {
    const colors = {
      GET: 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-semibold',
      POST: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold',
      PUT: 'bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-semibold',
      PATCH: 'bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-semibold',
      DELETE: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold'
    }
    return colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-700'
  }

  const tree = buildTree(collections)
  const filteredTree = filterTree(tree, searchQuery)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading collections...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">Collections</h2>
          <Button size="sm" variant="ghost">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto p-2">
        {filteredTree.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No matches found' : 'No collections yet'}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground mt-1">
                Import a collection or create your first request
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredTree.map(item => renderTreeItem(item))}
          </div>
        )}
      </div>
    </div>
  )
}