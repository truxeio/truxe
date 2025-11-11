import { useState } from 'react'
import { Copy, Check, Clock, Download, Eye, Code, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import Editor from '@monaco-editor/react'
import { ExecutionResponse } from '@/lib/request-executor'
import { environmentManager } from '@/lib/environment-manager'

interface ResponseViewerProps {
  response: ExecutionResponse | null
  isLoading: boolean
}

export default function ResponseViewer({ response, isLoading }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body')
  const [copied, setCopied] = useState(false)
  const [bodyView, setBodyView] = useState<'formatted' | 'raw'>('formatted')

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
    if (status >= 300 && status < 400) return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
    if (status >= 400 && status < 500) return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30'
    if (status >= 500) return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
    return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30'
  }

  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  const downloadResponse = () => {
    if (!response) return
    
    const blob = new Blob([formatJson(response.data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `response-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Sending request...</p>
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex-1 flex items-center justify-center text-center">
        <div>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Eye className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No response yet</h3>
          <p className="text-muted-foreground">
            Send a request to see the response here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Response Status */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusColor(response.status)}`}>
              {response.status} {response.statusText}
            </span>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="w-4 h-4 mr-1" />
              {response.responseTime}ms
            </div>
            {environmentManager.isDemoMode() && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-primary dark:bg-blue-900/30 dark:text-primary">
                Mock
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(formatJson(response.data))}
            >
              {copied ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Copy className="w-4 h-4 mr-2" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadResponse}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        {/* Response Size */}
        <div className="text-xs text-muted-foreground">
          Size: {response.size} bytes
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex">
          {(['body', 'headers'] as const).map((tab) => (
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
              {tab === 'headers' && (
                <span className="ml-2 text-xs">({Object.keys(response.headers).length})</span>
              )}
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
                <h3 className="font-medium">Response Body</h3>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={bodyView === 'formatted' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBodyView('formatted')}
                  >
                    <Code className="w-4 h-4 mr-2" />
                    Formatted
                  </Button>
                  <Button
                    variant={bodyView === 'raw' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBodyView('raw')}
                  >
                    <Maximize2 className="w-4 h-4 mr-2" />
                    Raw
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1">
              {bodyView === 'formatted' ? (
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={formatJson(response.data)}
                  theme="light"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    folding: true,
                  }}
                />
              ) : (
                <div className="h-full p-4 bg-muted/30 font-mono text-sm overflow-auto">
                  <pre className="whitespace-pre-wrap">
                    {formatJson(response.data)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="p-4 space-y-2">
            <h3 className="font-medium mb-4">Response Headers</h3>
            <div className="space-y-2">
              {Object.entries(response.headers).map(([key, value]) => (
                <div key={key} className="flex flex-col space-y-1 p-3 bg-muted/30 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{key}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`${key}: ${value}`)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <span className="text-sm text-muted-foreground font-mono break-all">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}