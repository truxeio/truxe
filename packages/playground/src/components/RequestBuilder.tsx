import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Play, Settings, Code, Plus, Trash2, Eye, EyeOff, Save } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { APIEndpoint, openAPIParser } from '@/lib/openapi-parser'
import { RequestConfig } from '@/lib/request-executor'
import { SavedRequest, Variable } from '@/types/collections'
import AuthenticationTab from './AuthenticationTab'
import CodeGenerator from './CodeGenerator'
import { environmentManager } from '@/lib/environment-manager'
import { variableResolver } from '@/lib/variable-resolver'
import { playgroundStorage } from '@/lib/storage'
import { collectionManager } from '@/lib/collection-manager'
import { Modal, ModalHeader, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

interface RequestBuilderProps {
  endpoint: APIEndpoint | null
  onSendRequest: (request: RequestConfig) => Promise<void>
  isLoading: boolean
  selectedRequest?: SavedRequest | null
  selectedCollectionId?: string
  onRequestSave?: (request: SavedRequest) => void
}

export default function RequestBuilder({ 
  endpoint, 
  onSendRequest, 
  isLoading, 
  selectedRequest,
  selectedCollectionId,
  onRequestSave
}: RequestBuilderProps) {
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState<Array<{key: string, value: string, enabled: boolean}>>([
    { key: 'Content-Type', value: 'application/json', enabled: true },
    { key: 'Authorization', value: '', enabled: false }
  ])
  const [body, setBody] = useState('{}')
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'params' | 'auth' | 'code' | 'variables'>('body')
  const [params, setParams] = useState<Array<{key: string, value: string, enabled: boolean}>>([])
  const [showAuthHelper, setShowAuthHelper] = useState(false)
  
  // Collections integration state
  const [variables, setVariables] = useState<Variable[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showVariablePreview, setShowVariablePreview] = useState(false)
  const [resolvedRequest, setResolvedRequest] = useState<RequestConfig | null>(null)
  const [saveRequestName, setSaveRequestName] = useState('')
  const [saveRequestDescription, setSaveRequestDescription] = useState('')

  // Load variables when collection changes
  useEffect(() => {
    loadVariables()
  }, [selectedCollectionId])

  // Load saved request when selected
  useEffect(() => {
    if (selectedRequest) {
      loadSavedRequest(selectedRequest)
    }
  }, [selectedRequest])

  // Update from endpoint
  useEffect(() => {
    if (endpoint && !selectedRequest) {
      setMethod(endpoint.method)
      setUrl(endpoint.path)
      
      // Set default body from OpenAPI spec
      const exampleBody = openAPIParser.getExampleRequest(endpoint)
      if (exampleBody && endpoint.method !== 'GET') {
        setBody(JSON.stringify(exampleBody, null, 2))
      } else {
        setBody('{}')
      }

      // Set query parameters from endpoint definition
      if (endpoint.parameters) {
        const queryParams = endpoint.parameters
          .filter(param => param.in === 'query')
          .map(param => ({
            key: param.name,
            value: param.schema?.example || '',
            enabled: param.required || false
          }))
        setParams(queryParams)
      } else {
        setParams([])
      }

      // Update auth requirements
      if (endpoint.security && endpoint.security.length > 0) {
        const hasBearerAuth = endpoint.security.some(sec => 'bearerAuth' in sec)
        if (hasBearerAuth) {
          setHeaders(prev => prev.map(h => 
            h.key === 'Authorization' ? { ...h, enabled: true } : h
          ))
        }
      }
    }
  }, [endpoint, selectedRequest])

  // Update resolved request when variables or form data changes
  useEffect(() => {
    updateResolvedRequest()
  }, [method, url, headers, body, params, variables])

  /**
   * Load variables for current context
   */
  const loadVariables = useCallback(async () => {
    try {
      const allVariables = await playgroundStorage.loadVariables()

      // Filter variables by scope and context
      const variablesArray = Array.isArray(allVariables) ? allVariables : Object.values(allVariables)
      const relevantVariables = variablesArray.filter((variable: Variable) => {
        switch (variable.scope) {
          case 'global':
            return true
          case 'collection':
            return variable.collectionId === selectedCollectionId
          case 'request':
            return variable.requestId === selectedRequest?.id
          case 'workflow':
            return false // Workflow variables not applicable in request builder
          default:
            return false
        }
      })
      
      setVariables(relevantVariables)
    } catch (error) {
      console.error('Failed to load variables:', error)
    }
  }, [selectedCollectionId, selectedRequest?.id])

  /**
   * Load saved request data
   */
  const loadSavedRequest = useCallback((request: SavedRequest) => {
    setMethod(request.config.method)
    setUrl(request.config.url)
    
    // Convert headers object to array
    const headerArray = Object.entries(request.config.headers || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }))
    setHeaders(headerArray)
    
    // Set body
    if (request.config.body) {
      const bodyStr = typeof request.config.body === 'string' 
        ? request.config.body 
        : JSON.stringify(request.config.body, null, 2)
      setBody(bodyStr)
    } else {
      setBody('{}')
    }
    
    // Convert params object to array
    const paramArray = Object.entries(request.config.params || {}).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true
    }))
    setParams(paramArray)
  }, [])

  /**
   * Update resolved request with variable substitution
   */
  const updateResolvedRequest = useCallback(() => {
    try {
      const context = {
        environment: selectedCollectionId || '',
        collection: selectedCollectionId || '',
        request: selectedRequest?.id || ''
      }
      
      // Resolve URL
      const resolvedUrl = variableResolver.resolve(url, context as any)

      // Resolve headers
      const resolvedHeaders: Record<string, string> = {}
      headers.filter(h => h.enabled && h.key && h.value).forEach(header => {
        resolvedHeaders[header.key] = variableResolver.resolve(header.value, context as any)
      })

      // Resolve params
      const resolvedParams: Record<string, string> = {}
      params.filter(p => p.enabled && p.key && p.value).forEach(param => {
        resolvedParams[param.key] = variableResolver.resolve(param.value, context as any)
      })

      // Resolve body
      let resolvedBody: any
      try {
        if (body && body.trim() !== '{}') {
          const resolvedBodyStr = variableResolver.resolve(body, context as any)
          resolvedBody = JSON.parse(resolvedBodyStr)
        }
      } catch {
        resolvedBody = variableResolver.resolve(body, context as any)
      }
      
      setResolvedRequest({
        method,
        url: resolvedUrl,
        headers: resolvedHeaders,
        body: resolvedBody,
        params: resolvedParams
      })
      
    } catch (error) {
      console.error('Failed to resolve variables:', error)
      setResolvedRequest(null)
    }
  }, [method, url, headers, body, params, variables, selectedCollectionId, selectedRequest?.id])

  /**
   * Handle saving current request as a collection item
   */
  const handleSaveRequest = useCallback(async () => {
    if (!saveRequestName.trim()) {
      return
    }
    
    try {
      const request: Omit<SavedRequest, 'id' | 'createdAt' | 'updatedAt'> = {
        name: saveRequestName.trim(),
        description: saveRequestDescription.trim() || undefined,
        collectionId: selectedCollectionId || 'default',
        config: {
          method,
          url,
          headers: headers.filter(h => h.enabled && h.key && h.value)
            .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
          params: params.filter(p => p.enabled && p.key && p.value)
            .reduce((acc, p) => ({ ...acc, [p.key]: p.value }), {}),
          body: body && body.trim() !== '{}' ? body : undefined
        },
        tags: [],
        executionCount: 0
      }

      await collectionManager.addRequest(selectedCollectionId || 'default', request as SavedRequest)
      
      // Call parent callback if provided
      onRequestSave?.(request as SavedRequest)
      
      // Reset save modal
      setShowSaveModal(false)
      setSaveRequestName('')
      setSaveRequestDescription('')
      
      console.log('Request saved successfully')
    } catch (error) {
      console.error('Failed to save request:', error)
    }
  }, [method, url, headers, params, body, saveRequestName, saveRequestDescription, selectedCollectionId, onRequestSave])

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '', enabled: true }])
  }

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const newHeaders = [...headers]
    newHeaders[index] = { ...newHeaders[index], [field]: value }
    setHeaders(newHeaders)
  }

  const addParam = () => {
    setParams([...params, { key: '', value: '', enabled: true }])
  }

  const removeParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index))
  }

  const updateParam = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const newParams = [...params]
    newParams[index] = { ...newParams[index], [field]: value }
    setParams(newParams)
  }

  const handleSend = async () => {
    // Use resolved request if available, otherwise build from form data
    const requestConfig = resolvedRequest || {
      method,
      url,
      headers: headers.filter(h => h.enabled && h.key && h.value)
        .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
      params: params.filter(p => p.enabled && p.key && p.value)
        .reduce((acc, p) => ({ ...acc, [p.key]: p.value }), {}),
      body: body && body.trim() !== '{}' ? (() => {
        try {
          return JSON.parse(body)
        } catch {
          return body
        }
      })() : undefined
    }

    await onSendRequest(requestConfig)
  }

  const formatBody = () => {
    try {
      const parsed = JSON.parse(body)
      setBody(JSON.stringify(parsed, null, 2))
    } catch (e) {
      // Invalid JSON, don't format
    }
  }

  // Helper to build current request config for code generation
  const buildRequestConfig = (): RequestConfig => {
    const enabledHeaders = headers
      .filter(h => h.enabled && h.key && h.value)
      .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {})

    const enabledParams = params
      .filter(p => p.enabled && p.key && p.value)
      .reduce((acc, p) => ({ ...acc, [p.key]: p.value }), {})

    let requestBody
    try {
      requestBody = body && body.trim() !== '{}' ? JSON.parse(body) : undefined
    } catch (e) {
      requestBody = body && body.trim() ? body : undefined
    }

    // Get the full URL with environment base URL
    const fullUrl = environmentManager.getFullUrl(url)
    
    // Merge with environment auth headers
    const authHeaders = environmentManager.getAuthHeaders()
    const allHeaders = { ...authHeaders, ...enabledHeaders }

    return {
      method,
      url: fullUrl,
      headers: allHeaders,
      body: requestBody,
      params: enabledParams
    }
  }

  if (!endpoint) {
    return (
      <div className="flex-1 flex items-center justify-center text-center">
        <div>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Code className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Select an endpoint</h3>
          <p className="text-muted-foreground">
            Choose an endpoint from the left sidebar to start building your request
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Request URL */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="px-3 py-2 bg-background border border-input rounded-md text-sm font-medium"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm font-mono"
            placeholder="Enter request URL"
          />

          <Button onClick={handleSend} disabled={isLoading}>
            <Play className="w-4 h-4 mr-2" />
            {isLoading ? 'Sending...' : 'Send'}
          </Button>

          {/* Save Request Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowSaveModal(true)}
            className="text-xs"
          >
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>

          {/* Variable Preview Toggle */}
          {variables.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowVariablePreview(!showVariablePreview)}
              className="text-xs"
            >
              <Eye className="w-4 h-4 mr-1" />
              Variables
            </Button>
          )}

          <Button variant="outline" size="icon" onClick={() => setShowAuthHelper(!showAuthHelper)}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {endpoint && (
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium">{endpoint.description}</span>
          </div>
        )}

        {/* Variable Preview */}
        {showVariablePreview && variables.length > 0 && (
          <div className="mt-3 p-3 bg-muted/50 rounded-md border">
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <Eye className="w-4 h-4 mr-1" />
              Available Variables
            </h4>
            <div className="space-y-1">
              {variables.map((variable, index) => (
                <div key={index} className="text-xs font-mono bg-background px-2 py-1 rounded border">
                  <span className="text-primary">{`{{${variable.key}}}`}</span>
                  <span className="text-muted-foreground mx-2">→</span>
                  <span className="text-foreground">{variable.value}</span>
                  <span className="text-muted-foreground ml-2">({variable.scope})</span>
                </div>
              ))}
            </div>
            {resolvedRequest && (
              <div className="mt-2 pt-2 border-t">
                <h5 className="text-xs font-medium mb-1 text-muted-foreground">Resolved URL:</h5>
                <code className="text-xs bg-background px-2 py-1 rounded border block">
                  {resolvedRequest.url}
                </code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex">
          {(['body', 'headers', 'params', 'auth', 'code'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'body' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Request Body</h3>
                <Button variant="outline" size="sm" onClick={formatBody}>
                  Format JSON
                </Button>
              </div>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                defaultLanguage="json"
                value={body}
                onChange={(value) => setBody(value || '{}')}
                theme="light"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Headers</h3>
              <Button variant="outline" size="sm" onClick={addHeader}>
                <Plus className="w-4 h-4 mr-2" />
                Add Header
              </Button>
            </div>

            <div className="space-y-2">
              {headers.map((header, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <button
                    onClick={() => updateHeader(index, 'enabled', !header.enabled)}
                    className="flex-shrink-0"
                  >
                    {header.enabled ? (
                      <Eye className="w-4 h-4 text-primary" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <input
                    type="text"
                    placeholder="Header name"
                    value={header.key}
                    onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Header value"
                    value={header.value}
                    onChange={(e) => updateHeader(index, 'value', e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHeader(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'params' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Query Parameters</h3>
              <Button variant="outline" size="sm" onClick={addParam}>
                <Plus className="w-4 h-4 mr-2" />
                Add Parameter
              </Button>
            </div>

            <div className="space-y-2">
              {params.map((param, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <button
                    onClick={() => updateParam(index, 'enabled', !param.enabled)}
                    className="flex-shrink-0"
                  >
                    {param.enabled ? (
                      <Eye className="w-4 h-4 text-primary" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <input
                    type="text"
                    placeholder="Parameter name"
                    value={param.key}
                    onChange={(e) => updateParam(index, 'key', e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Parameter value"
                    value={param.value}
                    onChange={(e) => updateParam(index, 'value', e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeParam(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'auth' && (
          <AuthenticationTab />
        )}

        {activeTab === 'code' && (
          <CodeGenerator request={buildRequestConfig()} />
        )}
      </div>

      {/* Save Request Modal */}
      <Modal open={showSaveModal} onClose={() => setShowSaveModal(false)}>
        <ModalHeader>
          <h2 className="text-lg font-semibold">Save Request</h2>
          <p className="text-sm text-muted-foreground">
            Save this request to a collection for reuse
          </p>
        </ModalHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Request Name *
            </label>
            <Input
              value={saveRequestName}
              onChange={(e) => setSaveRequestName(e.target.value)}
              placeholder="e.g., Get User Profile"
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <Textarea
              value={saveRequestDescription}
              onChange={(e) => setSaveRequestDescription(e.target.value)}
              placeholder="Optional description for this request..."
              rows={3}
              className="w-full"
            />
          </div>
          
          <div className="p-3 bg-muted rounded-md">
            <h4 className="text-sm font-medium mb-2">Request Preview</h4>
            <div className="text-sm font-mono text-muted-foreground">
              <div><span className="font-semibold text-primary">{method}</span> {url}</div>
              {headers.filter(h => h.enabled && h.key).length > 0 && (
                <div className="mt-1">Headers: {headers.filter(h => h.enabled && h.key).length}</div>
              )}
              {params.filter(p => p.enabled && p.key).length > 0 && (
                <div>Params: {params.filter(p => p.enabled && p.key).length}</div>
              )}
              {body && body.trim() !== '{}' && (
                <div>Body: Present</div>
              )}
            </div>
          </div>
        </div>
        
        <ModalFooter>
          <Button 
            variant="outline" 
            onClick={() => setShowSaveModal(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveRequest}
            disabled={!saveRequestName.trim()}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Request
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}