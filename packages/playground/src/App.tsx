import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Moon, Sun, Code, BookOpen, FolderOpen, Globe } from 'lucide-react'
import EndpointNavigator from '@/components/EndpointNavigator'
import RequestBuilder from '@/components/RequestBuilder'
import ResponseViewer from '@/components/ResponseViewer'
import CollectionsPanel from '@/components/CollectionsPanel'
import ImportExport from '@/components/ImportExport'
import { APIEndpoint } from '@/lib/openapi-parser'
import { requestExecutor, RequestConfig, ExecutionResponse } from '@/lib/request-executor'
import { SavedRequest } from '@/types/collections'

function App() {
  const [isDark, setIsDark] = useState(false)
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<SavedRequest | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [response, setResponse] = useState<ExecutionResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [leftSidebarMode, setLeftSidebarMode] = useState<'endpoints' | 'collections'>('endpoints')
  const [showImportExport, setShowImportExport] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-16 border-b border-border px-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Code className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Truxe API Playground</h1>
              <p className="text-xs text-muted-foreground">Interactive API testing environment</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowImportExport(true)}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Import/Export
          </Button>
          <Button variant="ghost" size="sm">
            <BookOpen className="w-4 h-4 mr-2" />
            Docs
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Left sidebar */}
        <div className="w-80 border-r border-border flex flex-col">
          {/* Sidebar Mode Toggle */}
          <div className="p-2 border-b border-border">
            <div className="flex rounded-md bg-muted p-1">
              <button
                onClick={() => {
                  setLeftSidebarMode('endpoints')
                  setSelectedRequest(null)
                }}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                  leftSidebarMode === 'endpoints'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="w-4 h-4 mr-2 inline" />
                API Endpoints
              </button>
              <button
                onClick={() => {
                  setLeftSidebarMode('collections')
                  setSelectedEndpoint(null)
                }}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                  leftSidebarMode === 'collections'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FolderOpen className="w-4 h-4 mr-2 inline" />
                Collections
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          {leftSidebarMode === 'endpoints' ? (
            <EndpointNavigator 
              onSelectEndpoint={setSelectedEndpoint}
              selectedEndpoint={selectedEndpoint}
            />
          ) : (
            <CollectionsPanel
              selectedRequest={selectedRequest}
              selectedCollectionId={selectedCollectionId}
              onSelectRequest={(request) => {
                setSelectedRequest(request)
                setSelectedEndpoint(null)
                setSelectedCollectionId(request?.collectionId || null)
              }}
              onSelectCollection={setSelectedCollectionId}
            />
          )}
        </div>

        {/* Center - Request Builder */}
        <div className="flex-1 flex flex-col">
          <RequestBuilder
            endpoint={selectedEndpoint}
            selectedRequest={selectedRequest}
            selectedCollectionId={selectedCollectionId || undefined}
            onRequestSave={(request) => {
              // Refresh collections panel if needed
              console.log('Request saved:', request.name)
            }}
            onSendRequest={async (request: RequestConfig) => {
              setIsLoading(true)
              try {
                const result = await requestExecutor.execute(request)
                setResponse(result)
              } catch (error) {
                setResponse({
                  status: 0,
                  statusText: 'Request Failed',
                  headers: {},
                  data: { 
                    error: 'REQUEST_FAILED',
                    message: error instanceof Error ? error.message : 'Unknown error occurred' 
                  },
                  responseTime: 0,
                  size: 0
                })
              } finally {
                setIsLoading(false)
              }
            }}
            isLoading={isLoading}
          />
        </div>

        {/* Right sidebar - Response Viewer */}
        <div className="w-96 border-l border-border flex flex-col">
          <ResponseViewer
            response={response}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="h-6 border-t border-border px-4 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
        <div className="flex items-center space-x-4">
          <span>Ready</span>
          {selectedEndpoint && (
            <span>Selected: {selectedEndpoint.method} {selectedEndpoint.path}</span>
          )}
          {selectedRequest && (
            <span>Collection Request: {selectedRequest.name}</span>
          )}
          {leftSidebarMode === 'collections' && (
            <span>Mode: Collections</span>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <span>Truxe API v0.4.0</span>
        </div>
      </div>

      {/* Import/Export Modal */}
      {showImportExport && (
        <ImportExport
          onClose={() => setShowImportExport(false)}
          onImportComplete={() => {
            // Refresh collections if on collections tab
            if (leftSidebarMode === 'collections') {
              window.location.reload() // Simple refresh for now
            }
          }}
        />
      )}
    </div>
  )
}

export default App