/**
 * CollectionManager - Main panel for managing collections, folders, and requests
 * API Playground Phase 3: Collections & Workflows
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  FolderOpen, 
  Folder, 
  File, 
  Plus, 
  MoreVertical,
  Search,
  ChevronDown,
  ChevronRight,
  Edit3,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { 
  Collection, 
  SavedRequest, 
  Folder as CollectionFolder
} from '@/types/collections'
import { collectionManager } from '@/lib/collection-manager'
import { playgroundStorage } from '@/lib/storage'


interface CollectionManagerProps {
  onRequestSelect?: (request: SavedRequest) => void
  onCollectionSelect?: (collection: Collection) => void
  selectedRequestId?: string
  selectedCollectionId?: string
}

interface TreeNode {
  id: string
  type: 'collection' | 'folder' | 'request'
  name: string
  description?: string
  children?: TreeNode[]
  parentId?: string
  collectionId: string
  data: Collection | CollectionFolder | SavedRequest
  isExpanded?: boolean
  level: number
}

interface CreateModalData {
  type: 'collection' | 'folder' | 'request'
  parentId?: string
  collectionId?: string
  isOpen: boolean
}

interface EditModalData {
  item: Collection | CollectionFolder | SavedRequest | null
  type: 'collection' | 'folder' | 'request'
  isOpen: boolean
}

export default function CollectionManager({
  onRequestSelect,
  onCollectionSelect,
  selectedRequestId,
  selectedCollectionId
}: CollectionManagerProps) {
  // State management
  const [collections, setCollections] = useState<Collection[]>([])
  const [folders, setFolders] = useState<CollectionFolder[]>([])
  const [requests, setRequests] = useState<SavedRequest[]>([])
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [loading, setLoading] = useState(true)

  // Modal states
  const [createModal, setCreateModal] = useState<CreateModalData>({
    type: 'collection',
    isOpen: false
  })
  const [editModal, setEditModal] = useState<EditModalData>({
    item: null,
    type: 'collection',
    isOpen: false
  })

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    nodeId: string
    type: string
  } | null>(null)

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  // Listen to collection manager events
  useEffect(() => {
    // Add event listeners if collectionManager has an event system
    // This would need to be implemented in the CollectionManager class

    return () => {
      // Remove listeners
    }
  }, [])

  /**
   * Load all collections, folders, and requests
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      
      const [collectionsData, foldersData, requestsData] = await Promise.all([
        collectionManager.getCollections(),
        playgroundStorage.loadFolders(),
        playgroundStorage.loadSavedRequests()
      ])
      
      setCollections(collectionsData)
      setFolders(foldersData)
      setRequests(requestsData)
      
    } catch (error) {
      console.error('Failed to load collections data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Build tree structure from collections, folders, and requests
   */
  const buildTreeNodes = useMemo(() => {
    const nodes: TreeNode[] = []
    
    // Build tree for each collection
    collections.forEach(collection => {
      const collectionNode: TreeNode = {
        id: collection.id,
        type: 'collection',
        name: collection.name,
        description: collection.description,
        collectionId: collection.id,
        data: collection,
        level: 0,
        children: []
      }
      
      // Add folders to collection
      const collectionFolders = folders.filter(f => f.collectionId === collection.id)
      collectionFolders.forEach(folder => {
        const folderNode: TreeNode = {
          id: folder.id,
          type: 'folder',
          name: folder.name,
          description: folder.description,
          parentId: collection.id,
          collectionId: collection.id,
          data: folder,
          level: 1,
          children: []
        }
        
        // Add requests to folder
        const folderRequests = requests.filter(r => r.folderId === folder.id)
        folderRequests.forEach(request => {
          const requestNode: TreeNode = {
            id: request.id,
            type: 'request',
            name: request.name,
            description: request.description,
            parentId: folder.id,
            collectionId: collection.id,
            data: request,
            level: 2
          }
          folderNode.children!.push(requestNode)
        })
        
        collectionNode.children!.push(folderNode)
      })
      
      // Add root-level requests to collection
      const collectionRequests = requests.filter(r => 
        r.collectionId === collection.id && !r.folderId
      )
      collectionRequests.forEach(request => {
        const requestNode: TreeNode = {
          id: request.id,
          type: 'request',
          name: request.name,
          description: request.description,
          parentId: collection.id,
          collectionId: collection.id,
          data: request,
          level: 1
        }
        collectionNode.children!.push(requestNode)
      })
      
      nodes.push(collectionNode)
    })
    
    return nodes
  }, [collections, folders, requests])

  // Update tree nodes when data changes
  useEffect(() => {
    setTreeNodes(buildTreeNodes)
  }, [buildTreeNodes])

  /**
   * Filter tree nodes based on search query
   */
  const filteredTreeNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return treeNodes
    }
    
    const query = searchQuery.toLowerCase()
    
    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.reduce((filtered: TreeNode[], node) => {
        const matches = node.name.toLowerCase().includes(query) ||
                       (node.description && node.description.toLowerCase().includes(query))
        
        if (matches) {
          filtered.push({
            ...node,
            children: node.children ? filterNodes(node.children) : undefined
          })
        } else if (node.children) {
          const filteredChildren = filterNodes(node.children)
          if (filteredChildren.length > 0) {
            filtered.push({
              ...node,
              children: filteredChildren
            })
          }
        }
        
        return filtered
      }, [])
    }
    
    return filterNodes(treeNodes)
  }, [treeNodes, searchQuery])

  /**
   * Toggle node expansion
   */
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }, [])

  /**
   * Handle node selection
   */
  const handleNodeSelect = useCallback((node: TreeNode) => {
    if (node.type === 'request' && onRequestSelect) {
      onRequestSelect(node.data as SavedRequest)
    } else if (node.type === 'collection' && onCollectionSelect) {
      onCollectionSelect(node.data as Collection)
    }
  }, [onRequestSelect, onCollectionSelect])

  /**
   * Handle right-click context menu
   */
  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId: node.id,
      type: node.type
    })
  }, [])

  /**
   * Close context menu
   */
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  /**
   * Handle creating new items
   */
  const handleCreate = async (data: {
    name: string
    description: string
    type: 'collection' | 'folder' | 'request'
    parentId?: string
    collectionId?: string
  }) => {
    try {
      switch (data.type) {
        case 'collection':
          await collectionManager.createCollection(
            data.name,
            data.description
          )
          break
          
        case 'folder':
          if (!data.collectionId) throw new Error('Collection ID required for folder')
          
          const folder: CollectionFolder = {
            id: `folder_${Date.now()}`,
            name: data.name,
            description: data.description,
            collectionId: data.collectionId,
            requests: [],
            folders: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }
          
          await playgroundStorage.saveFolders([folder])
          break
          
        case 'request':
          if (!data.collectionId) throw new Error('Collection ID required for request')
          
          const request: SavedRequest = {
            id: `request_${Date.now()}`,
            name: data.name,
            description: data.description,
            collectionId: data.collectionId,
            folderId: data.parentId && data.parentId !== data.collectionId ? data.parentId : undefined,
            config: {
              method: 'GET',
              url: '',
              headers: {},
              body: null
            },
            tags: [],
            executionCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          }
          
          await playgroundStorage.saveSavedRequest(request)
          break
      }
      
      setCreateModal({ ...createModal, isOpen: false })
      await loadData()
      
    } catch (error) {
      console.error('Failed to create item:', error)
    }
  }

  /**
   * Handle editing items
   */
  const handleEdit = async (data: {
    name: string
    description: string
  }) => {
    if (!editModal.item) return
    
    try {
      const updatedItem = {
        ...editModal.item,
        name: data.name,
        description: data.description,
        updatedAt: new Date()
      }
      
      switch (editModal.type) {
        case 'collection':
          await collectionManager.updateCollection(editModal.item.id, updatedItem as Collection)
          break
          
        case 'folder':
          await playgroundStorage.saveFolders([updatedItem as CollectionFolder])
          break
          
        case 'request':
          await playgroundStorage.saveSavedRequest(updatedItem as SavedRequest)
          break
      }
      
      setEditModal({ ...editModal, isOpen: false })
      await loadData()
      
    } catch (error) {
      console.error('Failed to edit item:', error)
    }
  }

  /**
   * Handle deleting items
   */
  const handleDelete = async (nodeId: string, type: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    try {
      switch (type) {
        case 'collection':
          await collectionManager.deleteCollection(nodeId)
          break
          
        case 'folder':
          await playgroundStorage.deleteFolder(nodeId)
          break
          
        case 'request':
          await playgroundStorage.deleteSavedRequest(nodeId)
          break
      }
      
      await loadData()
      
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  /**
   * Render tree node
   */
  const renderTreeNode = (node: TreeNode): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const isSelected = 
      (node.type === 'request' && node.id === selectedRequestId) ||
      (node.type === 'collection' && node.id === selectedCollectionId)

    const getIcon = () => {
      switch (node.type) {
        case 'collection':
          return <FolderOpen className="w-4 h-4 text-blue-500" />
        case 'folder':
          return isExpanded ? 
            <FolderOpen className="w-4 h-4 text-yellow-500" /> : 
            <Folder className="w-4 h-4 text-yellow-500" />
        case 'request':
          const request = node.data as SavedRequest
          const methodColors = {
            GET: 'text-green-500',
            POST: 'text-blue-500',
            PUT: 'text-orange-500',
            DELETE: 'text-red-500',
            PATCH: 'text-purple-500'
          }
          return <File className={`w-4 h-4 ${methodColors[request.config.method as keyof typeof methodColors] || 'text-gray-500'}`} />
        default:
          return <File className="w-4 h-4" />
      }
    }

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 py-1 px-2 hover:bg-muted rounded cursor-pointer group ${
            isSelected ? 'bg-accent' : ''
          }`}
          style={{ paddingLeft: `${8 + node.level * 16}px` }}
          onClick={() => handleNodeSelect(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {/* Expand/collapse button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleNode(node.id)
              }}
              className="p-0.5 hover:bg-accent rounded"
            >
              {isExpanded ? 
                <ChevronDown className="w-3 h-3" /> : 
                <ChevronRight className="w-3 h-3" />
              }
            </button>
          )}
          
          {/* Spacer for nodes without children */}
          {!hasChildren && <div className="w-4" />}
          
          {/* Icon */}
          {getIcon()}
          
          {/* Name */}
          <span className="flex-1 truncate text-sm">
            {node.name}
          </span>
          
          {/* Request method badge */}
          {node.type === 'request' && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
              {
                GET: 'bg-green-100 text-green-700',
                POST: 'bg-blue-100 text-blue-700',
                PUT: 'bg-orange-100 text-orange-700',
                DELETE: 'bg-red-100 text-red-700',
                PATCH: 'bg-purple-100 text-purple-700'
              }[(node.data as SavedRequest).config.method] || 'bg-gray-100 text-gray-700'
            }`}>
              {(node.data as SavedRequest).config.method}
            </span>
          )}
          
          {/* More options */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleContextMenu(e, node)
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded transition-opacity"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        </div>
        
        {/* Render children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading collections...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background border-r">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Collections</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCreateModal({
                type: 'collection',
                isOpen: true
              })}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Search */}
        {showSearch && (
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-2"
          />
        )}
      </div>
      
      {/* Tree view */}
      <div className="flex-1 overflow-auto p-2">
        {filteredTreeNodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {collections.length === 0 ? (
              <div>
                <p className="mb-2">No collections yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateModal({
                    type: 'collection',
                    isOpen: true
                  })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create Collection
                </Button>
              </div>
            ) : (
              'No matches found'
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTreeNodes.map(node => renderTreeNode(node))}
          </div>
        )}
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={closeContextMenu}
        >
          <button
            className="w-full px-3 py-1 text-sm hover:bg-muted text-left flex items-center gap-2"
            onClick={() => {
              setEditModal({
                item: treeNodes.find(n => n.id === contextMenu.nodeId)?.data || null,
                type: contextMenu.type as any,
                isOpen: true
              })
              closeContextMenu()
            }}
          >
            <Edit3 className="w-3 h-3" />
            Edit
          </button>
          
          {contextMenu.type !== 'request' && (
            <button
              className="w-full px-3 py-1 text-sm hover:bg-muted text-left flex items-center gap-2"
              onClick={() => {
                const node = treeNodes.find(n => n.id === contextMenu.nodeId)
                setCreateModal({
                  type: contextMenu.type === 'collection' ? 'folder' : 'request',
                  parentId: contextMenu.nodeId,
                  collectionId: node?.collectionId,
                  isOpen: true
                })
                closeContextMenu()
              }}
            >
              <Plus className="w-3 h-3" />
              Add {contextMenu.type === 'collection' ? 'Folder' : 'Request'}
            </button>
          )}
          
          <div className="border-t my-1" />
          
          <button
            className="w-full px-3 py-1 text-sm hover:bg-muted text-left flex items-center gap-2 text-destructive"
            onClick={() => {
              handleDelete(contextMenu.nodeId, contextMenu.type)
              closeContextMenu()
            }}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      )}
      
      {/* Click outside to close context menu */}
      {contextMenu && (
        <div 
          className="fixed inset-0 z-40"
          onClick={closeContextMenu}
        />
      )}
      
      {/* Create Modal */}
      <CreateItemModal
        open={createModal.isOpen}
        type={createModal.type}
        parentId={createModal.parentId}
        collectionId={createModal.collectionId}
        onClose={() => setCreateModal({ ...createModal, isOpen: false })}
        onCreate={handleCreate}
      />
      
      {/* Edit Modal */}
      <EditItemModal
        open={editModal.isOpen}
        item={editModal.item}
        type={editModal.type}
        onClose={() => setEditModal({ ...editModal, isOpen: false })}
        onSave={handleEdit}
      />
    </div>
  )
}

/**
 * Create Item Modal Component
 */
interface CreateItemModalProps {
  open: boolean
  type: 'collection' | 'folder' | 'request'
  parentId?: string
  collectionId?: string
  onClose: () => void
  onCreate: (data: {
    name: string
    description: string
    type: 'collection' | 'folder' | 'request'
    parentId?: string
    collectionId?: string
  }) => void
}

function CreateItemModal({ 
  open, 
  type, 
  parentId, 
  collectionId, 
  onClose, 
  onCreate 
}: CreateItemModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        type,
        parentId,
        collectionId
      })
      setName('')
      setDescription('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const titles = {
    collection: 'New Collection',
    folder: 'New Folder',
    request: 'New Request'
  }

  return (
    <Modal open={open} onClose={onClose} title={titles[type]}>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Enter ${type} name`}
            required
            autoFocus
          />
          
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`Describe this ${type}...`}
            rows={3}
          />
        </div>
        
        <ModalFooter>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? 'Creating...' : `Create ${type}`}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

/**
 * Edit Item Modal Component
 */
interface EditItemModalProps {
  open: boolean
  item: Collection | CollectionFolder | SavedRequest | null
  type: 'collection' | 'folder' | 'request'
  onClose: () => void
  onSave: (data: { name: string; description: string }) => void
}

function EditItemModal({ open, item, type, onClose, onSave }: EditItemModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (item && open) {
      setName(item.name)
      setDescription(item.description || '')
    }
  }, [item, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim()
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const titles = {
    collection: 'Edit Collection',
    folder: 'Edit Folder',
    request: 'Edit Request'
  }

  return (
    <Modal open={open} onClose={onClose} title={titles[type]}>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        
        <ModalFooter>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}