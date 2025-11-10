import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Play, Settings, Code, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { APIEndpoint, openAPIParser } from '@/lib/openapi-parser'
import { RequestConfig } from '@/lib/request-executor'
import AuthenticationTab from './AuthenticationTab'
import CodeGenerator from './CodeGenerator'
import { environmentManager } from '@/lib/environment-manager'

interface RequestBuilderProps {
  endpoint: APIEndpoint | null
  onSendRequest: (request: RequestConfig) => Promise<void>
  isLoading: boolean
}

export default function RequestBuilder({ endpoint, onSendRequest, isLoading }: RequestBuilderProps) {
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState<Array<{key: string, value: string, enabled: boolean}>>([
    { key: 'Content-Type', value: 'application/json', enabled: true },
    { key: 'Authorization', value: '', enabled: false }
  ])
  const [body, setBody] = useState('{}')
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'params' | 'auth' | 'code'>('body')
  const [params, setParams] = useState<Array<{key: string, value: string, enabled: boolean}>>([])
  const [showAuthHelper, setShowAuthHelper] = useState(false)

  useEffect(() => {
    if (endpoint) {
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
  }, [endpoint])

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
    const enabledHeaders = headers
      .filter(h => h.enabled && h.key && h.value)
      .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {})

    const enabledParams = params
      .filter(p => p.enabled && p.key && p.value)
      .reduce((acc, p) => ({ ...acc, [p.key]: p.value }), {})

    let requestBody
    try {
      requestBody = body ? JSON.parse(body) : undefined
    } catch (e) {
      requestBody = body
    }

    const config: RequestConfig = {
      method,
      url,
      headers: enabledHeaders,
      body: requestBody,
      params: enabledParams
    }

    await onSendRequest(config)
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

          <Button variant="outline" size="icon" onClick={() => setShowAuthHelper(!showAuthHelper)}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {endpoint && (
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium">{endpoint.description}</span>
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
    </div>
  )
}