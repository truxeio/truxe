/**
 * VariableEditor - Comprehensive variable management for environments, collections, and requests
 * API Playground Phase 3: Collections & Workflows
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Copy,
  Download,
  Upload,
  Globe,
  FolderOpen,
  File,
  Lock,
  Check,
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { 
  Variable, 
  Collection,
  SavedRequest
} from '@/types/collections'
import { variableResolver } from '@/lib/variable-resolver'
import { playgroundStorage } from '@/lib/storage'
import { collectionManager } from '@/lib/collection-manager'

interface VariableEditorProps {
  selectedCollectionId?: string
  selectedRequestId?: string
  onVariableChange?: (variable: Variable) => void
}

interface VariableWithContext extends Variable {
  collectionName?: string
  requestName?: string
  isInherited?: boolean
  overriddenBy?: Variable
}

interface VariableGroup {
  scope: string
  title: string
  icon: React.ReactNode
  variables: VariableWithContext[]
  canAdd: boolean
}

interface EditVariableData {
  variable: Variable | null
  isNew: boolean
  isOpen: boolean
}

export default function VariableEditor({
  selectedCollectionId,
  selectedRequestId,
  onVariableChange
}: VariableEditorProps) {
  // State management
  const [variables, setVariables] = useState<Variable[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [requests, setRequests] = useState<SavedRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedScope, setSelectedScope] = useState<string>('all')
  const [showSecrets, setShowSecrets] = useState(false)
  const [loading, setLoading] = useState(true)

  // Modal states
  const [editModal, setEditModal] = useState<EditVariableData>({
    variable: null,
    isNew: false,
    isOpen: false
  })
  const [importModal, setImportModal] = useState(false)

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  /**
   * Load all variables and related data
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      
      const [variablesData, collectionsData, requestsData] = await Promise.all([
        playgroundStorage.loadVariables(),
        collectionManager.getCollections(),
        playgroundStorage.loadSavedRequests()
      ])

      setVariables(Array.isArray(variablesData) ? variablesData : Object.values(variablesData))
      setCollections(collectionsData)
      setRequests(requestsData)
      
    } catch (error) {
      console.error('Failed to load variables data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get variables with additional context
   */
  const variablesWithContext = useMemo(() => {
    return variables.map(variable => {
      const context: VariableWithContext = { ...variable }
      
      // Add collection name
      if (variable.scope === 'collection' && variable.collectionId) {
        const collection = collections.find(c => c.id === variable.collectionId)
        context.collectionName = collection?.name
      }
      
      // Add request name
      if (variable.scope === 'request' && variable.requestId) {
        const request = requests.find(r => r.id === variable.requestId)
        context.requestName = request?.name
        
        // Also add collection name for request variables
        if (request?.collectionId) {
          const collection = collections.find(c => c.id === request.collectionId)
          context.collectionName = collection?.name
        }
      }
      
      return context
    })
  }, [variables, collections, requests])

  /**
   * Group variables by scope
   */
  const variableGroups = useMemo(() => {
    const groups: VariableGroup[] = [
      {
        scope: 'environment',
        title: 'Environment Variables',
        icon: <Globe className="w-4 h-4 text-green-500" />,
        variables: [],
        canAdd: true
      },
      {
        scope: 'collection',
        title: 'Collection Variables',
        icon: <FolderOpen className="w-4 h-4 text-blue-500" />,
        variables: [],
        canAdd: !!selectedCollectionId
      },
      {
        scope: 'request',
        title: 'Request Variables',
        icon: <File className="w-4 h-4 text-purple-500" />,
        variables: [],
        canAdd: !!selectedRequestId
      }
    ]

    // Filter variables based on search and scope
    const filteredVariables = variablesWithContext.filter(variable => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          variable.key.toLowerCase().includes(query) ||
          (variable.description && variable.description.toLowerCase().includes(query)) ||
          (typeof variable.value === 'string' &&
           variable.value.toLowerCase().includes(query))

        if (!matchesSearch) return false
      }
      
      // Scope filter
      if (selectedScope !== 'all' && variable.scope !== selectedScope) {
        return false
      }
      
      // Collection/request context filter
      if (selectedCollectionId && variable.scope === 'collection') {
        return variable.collectionId === selectedCollectionId
      }
      
      if (selectedRequestId && variable.scope === 'request') {
        return variable.requestId === selectedRequestId
      }
      
      return true
    })

    // Group filtered variables
    filteredVariables.forEach(variable => {
      const group = groups.find(g => g.scope === variable.scope)
      if (group) {
        group.variables.push(variable)
      }
    })

    // Sort variables within groups
    groups.forEach(group => {
      group.variables.sort((a, b) => a.key.localeCompare(b.key))
    })

    return groups.filter(group => 
      selectedScope === 'all' || selectedScope === group.scope
    )
  }, [variablesWithContext, searchQuery, selectedScope, selectedCollectionId, selectedRequestId])

  /**
   * Handle creating/editing variables
   */
  const handleSaveVariable = useCallback(async (variableData: {
    key: string
    value: any
    type: string
    scope: string
    description: string
    enabled: boolean
    collectionId?: string
    requestId?: string
  }) => {
    try {
      const variable: Variable = {
        id: editModal.variable?.id || `var_${Date.now()}`,
        key: variableData.key.trim(),
        value: variableData.value,
        type: variableData.type as any,
        scope: variableData.scope as any,
        description: variableData.description.trim(),
        enabled: variableData.enabled,
        collectionId: variableData.collectionId,
        requestId: variableData.requestId,
        createdAt: editModal.variable?.createdAt || new Date(),
        updatedAt: new Date()
      }
      
      const variablesToSave: Record<string, Variable> = { [variable.id]: variable }
      await playgroundStorage.saveVariables(variablesToSave)
      
      if (onVariableChange) {
        onVariableChange(variable)
      }
      
      setEditModal({ variable: null, isNew: false, isOpen: false })
      await loadData()
      
    } catch (error) {
      console.error('Failed to save variable:', error)
    }
  }, [editModal.variable, onVariableChange])

  /**
   * Handle deleting variables
   */
  const handleDeleteVariable = useCallback(async (variableId: string) => {
    if (!confirm('Are you sure you want to delete this variable?')) return
    
    try {
      await playgroundStorage.deleteVariable(variableId)
      await loadData()
    } catch (error) {
      console.error('Failed to delete variable:', error)
    }
  }, [])

  /**
   * Handle copying variables
   */
  const handleCopyVariable = useCallback((variable: Variable) => {
    const variableText = `${variable.key}=${variable.value}`
    navigator.clipboard.writeText(variableText)
  }, [])

  /**
   * Handle bulk operations
   */
  const handleBulkExport = useCallback(async () => {
    try {
      const variablesToExport = variableGroups
        .flatMap(group => group.variables)
        .filter(v => !v.type || v.type !== 'secret')
      
      const exportData = {
        variables: variablesToExport,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })
      
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `variables-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      
      URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Failed to export variables:', error)
    }
  }, [variableGroups])

  /**
   * Handle bulk import
   */
  const handleBulkImport = useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const importData = JSON.parse(text)
      
      if (importData.variables && Array.isArray(importData.variables)) {
        for (const variable of importData.variables) {
          const newVariable: Variable = {
            ...variable,
            id: `var_${Date.now()}_${Math.random()}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }


          const newVarToSave: Record<string, Variable> = { [newVariable.id]: newVariable }
          await playgroundStorage.saveVariables(newVarToSave)
        }
        
        await loadData()
      }
      
    } catch (error) {
      console.error('Failed to import variables:', error)
    }
  }, [])

  /**
   * Get resolved variable value
   */
  const getResolvedValue = useCallback((variable: Variable): string => {
    try {
      const context = variableResolver.createContext({
        environment: {},
        collection: {},
        request: {},
        workflow: {}
      })

      return variableResolver.resolve(String(variable.value), context)
    } catch {
      return String(variable.value)
    }
  }, [selectedCollectionId, selectedRequestId])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading variables...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background border-r">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Variables</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSecrets(!showSecrets)}
              title={showSecrets ? 'Hide secrets' : 'Show secrets'}
            >
              {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkExport}
              title="Export variables"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setImportModal(true)}
              title="Import variables"
            >
              <Upload className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditModal({
                variable: null,
                isNew: true,
                isOpen: true
              })}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Search and filters */}
        <div className="space-y-2">
          <Input
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm"
          />
          
          <div className="flex items-center gap-2">
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="text-sm p-1 border rounded"
            >
              <option value="all">All Scopes</option>
              <option value="environment">Environment</option>
              <option value="collection">Collection</option>
              <option value="request">Request</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Variable groups */}
      <div className="flex-1 overflow-auto">
        {variableGroups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">No variables found</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModal({
                variable: null,
                isNew: true,
                isOpen: true
              })}
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Variable
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {variableGroups.map(group => (
              <VariableGroupSection
                key={group.scope}
                group={group}
                showSecrets={showSecrets}
                selectedCollectionId={selectedCollectionId}
                selectedRequestId={selectedRequestId}
                onEdit={(variable) => setEditModal({
                  variable,
                  isNew: false,
                  isOpen: true
                })}
                onDelete={handleDeleteVariable}
                onCopy={handleCopyVariable}
                onAdd={() => setEditModal({
                  variable: {
                    id: '',
                    key: '',
                    value: '',
                    type: 'environment' as any,
                    scope: group.scope as any,
                    description: '',
                    enabled: true,
                    collectionId: group.scope === 'collection' ? selectedCollectionId : undefined,
                    requestId: group.scope === 'request' ? selectedRequestId : undefined,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  },
                  isNew: true,
                  isOpen: true
                })}
                getResolvedValue={getResolvedValue}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Edit Variable Modal */}
      <EditVariableModal
        open={editModal.isOpen}
        variable={editModal.variable}
        isNew={editModal.isNew}
        selectedCollectionId={selectedCollectionId}
        selectedRequestId={selectedRequestId}
        collections={collections}
        requests={requests}
        onClose={() => setEditModal({ variable: null, isNew: false, isOpen: false })}
        onSave={handleSaveVariable}
      />
      
      {/* Import Modal */}
      <ImportVariablesModal
        open={importModal}
        onClose={() => setImportModal(false)}
        onImport={handleBulkImport}
      />
    </div>
  )
}

/**
 * Variable Group Section Component
 */
interface VariableGroupSectionProps {
  group: VariableGroup
  showSecrets: boolean
  selectedCollectionId?: string
  selectedRequestId?: string
  onEdit: (variable: Variable) => void
  onDelete: (variableId: string) => void
  onCopy: (variable: Variable) => void
  onAdd: () => void
  getResolvedValue: (variable: Variable) => string
}

function VariableGroupSection({
  group,
  showSecrets,
  onEdit,
  onDelete,
  onCopy,
  onAdd,
  getResolvedValue
}: VariableGroupSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2 text-sm font-medium hover:text-primary"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {group.icon}
          <span>{group.title}</span>
          <span className="text-xs text-muted-foreground">
            ({group.variables.length})
          </span>
          {isExpanded ? 
            <ChevronDown className="w-3 h-3" /> : 
            <ChevronRight className="w-3 h-3" />
          }
        </button>
        
        {group.canAdd && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAdd}
          >
            <Plus className="w-3 h-3" />
          </Button>
        )}
      </div>
      
      {isExpanded && (
        <div className="space-y-1 ml-6">
          {group.variables.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">
              No variables in this scope
            </div>
          ) : (
            group.variables.map(variable => (
              <VariableCard
                key={variable.id}
                variable={variable}
                showSecrets={showSecrets}
                onEdit={() => onEdit(variable)}
                onDelete={() => onDelete(variable.id)}
                onCopy={() => onCopy(variable)}
                getResolvedValue={getResolvedValue}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Variable Card Component
 */
interface VariableCardProps {
  variable: VariableWithContext
  showSecrets: boolean
  onEdit: () => void
  onDelete: () => void
  onCopy: () => void
  getResolvedValue: (variable: Variable) => string
}

function VariableCard({
  variable,
  showSecrets,
  onEdit,
  onDelete,
  onCopy,
  getResolvedValue
}: VariableCardProps) {
  const [showValue, setShowValue] = useState(false)
  const [showResolved, setShowResolved] = useState(false)

  const isSecret = variable.type === 'secret'
  const displayValue = isSecret && !showSecrets && !showValue 
    ? '••••••••' 
    : String(variable.value)
  
  const resolvedValue = useMemo(() => {
    try {
      return getResolvedValue(variable)
    } catch {
      return String(variable.value)
    }
  }, [variable, getResolvedValue])

  const hasTemplate = String(variable.value).includes('{{')
  const isDifferentResolved = resolvedValue !== String(variable.value)

  return (
    <div className={`border rounded-md p-3 ${!variable.enabled ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-medium">
              {variable.key}
            </span>
            
            {isSecret && <Lock className="w-3 h-3 text-amber-500" />}
            {!variable.enabled && <X className="w-3 h-3 text-red-500" />}
            {variable.enabled && <Check className="w-3 h-3 text-green-500" />}
            
            <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
              {variable.type}
            </span>
          </div>
          
          <div className="text-sm text-muted-foreground mb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono break-all">
                {displayValue}
              </span>
              
              {isSecret && (
                <button
                  onClick={() => setShowValue(!showValue)}
                  className="p-0.5 hover:bg-muted rounded"
                >
                  {showValue ? 
                    <EyeOff className="w-3 h-3" /> : 
                    <Eye className="w-3 h-3" />
                  }
                </button>
              )}
              
              {hasTemplate && isDifferentResolved && (
                <button
                  onClick={() => setShowResolved(!showResolved)}
                  className="p-0.5 hover:bg-muted rounded"
                  title="Show resolved value"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
            
            {showResolved && hasTemplate && isDifferentResolved && (
              <div className="mt-1 p-2 bg-muted rounded text-xs font-mono">
                <strong>Resolved:</strong> {resolvedValue}
              </div>
            )}
          </div>
          
          {variable.description && (
            <p className="text-xs text-muted-foreground mb-2">
              {variable.description}
            </p>
          )}
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{variable.scope}</span>
            {variable.collectionName && (
              <span>• Collection: {variable.collectionName}</span>
            )}
            {variable.requestName && (
              <span>• Request: {variable.requestName}</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={onCopy}
            className="p-1 hover:bg-muted rounded"
            title="Copy variable"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={onEdit}
            className="p-1 hover:bg-muted rounded"
            title="Edit variable"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-muted rounded text-destructive"
            title="Delete variable"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Edit Variable Modal Component
 */
interface EditVariableModalProps {
  open: boolean
  variable: Variable | null
  isNew: boolean
  selectedCollectionId?: string
  selectedRequestId?: string
  collections: Collection[]
  requests: SavedRequest[]
  onClose: () => void
  onSave: (data: {
    key: string
    value: any
    type: string
    scope: string
    description: string
    enabled: boolean
    collectionId?: string
    requestId?: string
  }) => void
}

function EditVariableModal({
  open,
  variable,
  isNew,
  selectedCollectionId,
  selectedRequestId,
  collections,
  requests,
  onClose,
  onSave
}: EditVariableModalProps) {
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    type: 'string',
    scope: 'environment',
    description: '',
    enabled: true,
    collectionId: '',
    requestId: ''
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize form data when modal opens
  useEffect(() => {
    if (open) {
      if (variable) {
        setFormData({
          key: variable.key,
          value: String(variable.value),
          type: variable.type,
          scope: variable.scope,
          description: variable.description || '',
          enabled: variable.enabled,
          collectionId: variable.collectionId || '',
          requestId: variable.requestId || ''
        })
      } else {
        setFormData({
          key: '',
          value: '',
          type: 'string',
          scope: selectedCollectionId ? 'collection' : 'environment',
          description: '',
          enabled: true,
          collectionId: selectedCollectionId || '',
          requestId: selectedRequestId || ''
        })
      }
    }
  }, [open, variable, selectedCollectionId, selectedRequestId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.key.trim()) return

    setIsSubmitting(true)
    try {
      await onSave({
        key: formData.key.trim(),
        value: formData.value,
        type: formData.type,
        scope: formData.scope,
        description: formData.description.trim(),
        enabled: formData.enabled,
        collectionId: formData.scope === 'collection' ? formData.collectionId : undefined,
        requestId: formData.scope === 'request' ? formData.requestId : undefined
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredCollections = collections
  const filteredRequests = formData.collectionId 
    ? requests.filter(r => r.collectionId === formData.collectionId)
    : requests

  return (
    <Modal 
      open={open} 
      onClose={onClose} 
      title={isNew ? 'Create Variable' : 'Edit Variable'}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Key"
              value={formData.key}
              onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value }))}
              placeholder="VARIABLE_NAME"
              required
              autoFocus
            />
            
            <div>
              <label className="block text-sm font-medium mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="w-full p-2 border rounded-md text-sm"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="secret">Secret</option>
                <option value="dynamic">Dynamic</option>
              </select>
            </div>
          </div>
          
          <Textarea
            label="Value"
            value={formData.value}
            onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
            placeholder="Variable value..."
            rows={3}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Scope</label>
              <select
                value={formData.scope}
                onChange={(e) => setFormData(prev => ({ ...prev, scope: e.target.value }))}
                className="w-full p-2 border rounded-md text-sm"
              >
                <option value="environment">Environment</option>
                <option value="collection">Collection</option>
                <option value="request">Request</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 mt-8">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="enabled" className="text-sm">
                Enabled
              </label>
            </div>
          </div>
          
          {/* Collection selector */}
          {formData.scope === 'collection' && (
            <div>
              <label className="block text-sm font-medium mb-2">Collection</label>
              <select
                value={formData.collectionId}
                onChange={(e) => setFormData(prev => ({ ...prev, collectionId: e.target.value }))}
                className="w-full p-2 border rounded-md text-sm"
                required
              >
                <option value="">Select collection...</option>
                {filteredCollections.map(collection => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Request selector */}
          {formData.scope === 'request' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Collection</label>
                <select
                  value={formData.collectionId}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    collectionId: e.target.value,
                    requestId: '' // Reset request selection
                  }))}
                  className="w-full p-2 border rounded-md text-sm"
                  required
                >
                  <option value="">Select collection...</option>
                  {filteredCollections.map(collection => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Request</label>
                <select
                  value={formData.requestId}
                  onChange={(e) => setFormData(prev => ({ ...prev, requestId: e.target.value }))}
                  className="w-full p-2 border rounded-md text-sm"
                  required
                  disabled={!formData.collectionId}
                >
                  <option value="">Select request...</option>
                  {filteredRequests.map(request => (
                    <option key={request.id} value={request.id}>
                      {request.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          
          <Textarea
            label="Description"
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe this variable..."
            rows={2}
          />
        </div>
        
        <ModalFooter>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={!formData.key.trim() || isSubmitting}>
            {isSubmitting ? 'Saving...' : (isNew ? 'Create Variable' : 'Save Changes')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

/**
 * Import Variables Modal Component
 */
interface ImportVariablesModalProps {
  open: boolean
  onClose: () => void
  onImport: (file: File) => void
}

function ImportVariablesModal({ open, onClose, onImport }: ImportVariablesModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const handleImport = async () => {
    if (!file) return

    setIsImporting(true)
    try {
      await onImport(file)
      setFile(null)
      onClose()
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import Variables">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Select JSON file
          </label>
          <input
            type="file"
            accept=".json"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full p-2 border rounded-md text-sm"
          />
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p>Expected format:</p>
          <pre className="bg-muted p-2 rounded mt-1 text-xs">
{`{
  "variables": [
    {
      "key": "API_KEY",
      "value": "your-api-key",
      "type": "secret",
      "scope": "environment",
      "description": "API key for authentication"
    }
  ]
}`}
          </pre>
        </div>
      </div>
      
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleImport} disabled={!file || isImporting}>
          {isImporting ? 'Importing...' : 'Import Variables'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}