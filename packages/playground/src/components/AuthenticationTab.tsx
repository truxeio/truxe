import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Settings, Key, Shield, Globe, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { environmentManager, EnvironmentConfig } from '@/lib/environment-manager'

export default function AuthenticationTab() {
  const [config, setConfig] = useState<EnvironmentConfig>({})
  const [showApiKey, setShowApiKey] = useState(false)
  const [showJwtToken, setShowJwtToken] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    const currentConfig = environmentManager.getEnvironmentConfig()
    setConfig(currentConfig)
  }, [])

  const updateConfig = (updates: Partial<EnvironmentConfig>) => {
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    environmentManager.setEnvironmentConfig(newConfig)
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const generateSampleJWT = () => {
    // Generate a sample JWT token structure for testing
    const header = { "alg": "HS256", "typ": "JWT" }
    const payload = {
      "sub": "user123",
      "email": "user@example.com", 
      "iat": Math.floor(Date.now() / 1000),
      "exp": Math.floor(Date.now() / 1000) + 3600
    }
    
    // This is just a demo token for testing - not actually signed
    const sampleToken = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.sample-signature`
    updateConfig({ jwtToken: sampleToken })
  }

  const clearAuth = () => {
    updateConfig({ apiKey: '', jwtToken: '', customHeaders: {} })
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Authentication</h3>
        <Button variant="outline" size="sm" onClick={clearAuth}>
          Clear All
        </Button>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          <Key className="w-4 h-4 inline mr-2" />
          API Key
        </label>
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <input
              type={showApiKey ? 'text' : 'password'}
              placeholder="Enter your API key (e.g., trx_live_...)"
              value={config.apiKey || ''}
              onChange={(e) => updateConfig({ apiKey: e.target.value })}
              className="w-full px-3 py-2 pr-10 bg-background border border-input rounded-md text-sm"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {config.apiKey && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(config.apiKey!, 'apiKey')}
            >
              {copied === 'apiKey' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Used for service-to-service authentication. Will be sent as X-API-Key header.
        </p>
      </div>

      {/* JWT Token */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          <Shield className="w-4 h-4 inline mr-2" />
          JWT Token
        </label>
        <div className="space-y-2">
          <div className="relative">
            <textarea
              placeholder="Paste JWT token here (Bearer token)"
              value={config.jwtToken || ''}
              onChange={(e) => updateConfig({ jwtToken: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm resize-none font-mono"
              style={{ fontSize: '11px' }}
            />
            {config.jwtToken && (
              <button
                type="button"
                onClick={() => setShowJwtToken(!showJwtToken)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              >
                {showJwtToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={generateSampleJWT}>
              Generate Sample
            </Button>
            {config.jwtToken && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(config.jwtToken!, 'jwt')}
              >
                {copied === 'jwt' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Copy
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Used for user authentication. Will be sent as Authorization: Bearer header.
        </p>
        
        {config.jwtToken && !showJwtToken && (
          <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Token preview:</span>
              <button
                onClick={() => setShowJwtToken(true)}
                className="text-primary hover:underline"
              >
                Show full token
              </button>
            </div>
            <div className="font-mono text-muted-foreground mt-1 break-all">
              {config.jwtToken.substring(0, 50)}...
            </div>
          </div>
        )}
      </div>

      {/* OAuth Quick Actions */}
      <div className="space-y-4">
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium mb-3">
            <Globe className="w-4 h-4 inline mr-2" />
            OAuth Quick Actions
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="w-full">
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIyLjU2IDEyLjI1QzIyLjU2IDExLjQ3IDIyLjQ5IDEwLjcyIDIyLjM2IDEwSDE2VjE0LjI1SDIwQzE5LjY4IDE1LjYzIDE4LjYgMTYuNzUgMTcuMDUgMTcuMzlWMjAuMjlIMTkuOTNDMjEuNzYgMTguNzggMjIuNTYgMTUuNzEgMjIuNTYgMTIuMjVaIiBmaWxsPSIjNDA5MUVCIi8+CjxwYXRoIGQ9Ik0xNiAyM0MxMy43IDIzIDEyLjU0IDIyLjE2IDExLjU0IDIwLjk0TDE0LjUzIDIwLjk0QzE1LjEgMjEuMjcgMTUuNTUgMjEuNTEgMTYgMjEuNTFDMTcuMDggMjEuNTEgMTcuMDcgMjAuNjggMTcuMDcgMjAuNjhWMjAuNjhIMTQuNTNWMjEuMDFIMTZWMjNaIiBmaWxsPSIjMzRBODUzIi8+CjxwYXRoIGQ9Ik0xMS41NCAyMC45NEMxMC41NCAyMi4xNiA5LjY5IDIzIDcuNCAyM0M2LjM5IDIzIDUuNzQgMjIuOTEgNS4zNCAyMS4wMVYyMC4zNkg3LjRWMjAuNjhDNy40IDIxLjE0IDcuOTMgMjEuNTEgOC40IDIxLjUxQzguODcgMjEuNTEgOS4yNCAyMS4yNyA5LjggMjAuOTRIMTEuNTRaIiBmaWxsPSIjRkJCQzA0Ii8+CjxwYXRoIGQ9Ik05LjggMjAuOTRWMjEuMDFINy40VjIwLjY4QzcuNCAyMC4yMiA2Ljg3IDE5Ljg1IDYuNCAyMC4zNlY5LjM5SDYuNEM2Ljg3IDkuOTEgNy40IDEwLjI5IDcuNCA5LjM5UzcuOTMgOS4wMSA4LjQgOS4wMUM4Ljg3IDkuMDEgOS4yNCA5LjQgOS44IDkuNzNDMTAuMjEgMTAuNDEgMTAuNSAxMS4zMSAxMC41IDEyLjMxQzEwLjUgMTMuMzEgMTAuMjEgMTQuMjEgOS44IDE0Ljg5VjE2LjMzSDExLjU0QzEyLjMzIDE1LjgyIDEzIDEzLjY3IDEzIDEyLjMxUzEyLjMzIDguOCAxMS41NCA4LjI5VjkuMzlIMTMuNDJWMTQuODlIMTEuNTRWMTYuMzNIMTNWMTQuODlIMTNWMTEuOTNIMTNWMTIuMzFIMTNDMTMgMTMuNjcgMTIuMzMgMTUuODIgMTEuNTQgMTYuMzNWMjAuOTRaIiBmaWxsPSIjRUE0MzM1Ii8+Cjwvc3ZnPg==" 
                    alt="Google" className="w-4 h-4 mr-2" />
              Google
            </Button>
            <Button variant="outline" size="sm" className="w-full">
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GitHub
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Quick OAuth authorization for testing flows
          </p>
        </div>

        {/* Custom Headers */}
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium mb-3">Custom Headers</h4>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Header name"
                className="px-3 py-2 bg-background border border-input rounded-md text-sm"
              />
              <input
                type="text"
                placeholder="Header value"
                className="px-3 py-2 bg-background border border-input rounded-md text-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Add Custom Header
            </Button>
          </div>
        </div>
      </div>

      {/* Authentication Status */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Authentication Status:</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            config.apiKey || config.jwtToken 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
          }`}>
            {config.apiKey || config.jwtToken ? 'Configured' : 'Not configured'}
          </span>
        </div>
      </div>
    </div>
  )
}