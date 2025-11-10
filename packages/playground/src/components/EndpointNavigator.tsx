import { useState, useEffect } from 'react'
import { Search, ChevronRight, ChevronDown, Globe, Shield, Key, Users, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { openAPIParser, loadOpenAPISpec, APIEndpoint } from '@/lib/openapi-parser'
import { environmentManager, DEFAULT_ENVIRONMENTS } from '@/lib/environment-manager'

const categoryIcons = {
  'Authentication': Shield,
  'Multi-Factor Authentication': Key,
  'OAuth': Globe,
  'Session Management': Users,
  'Webhooks': Webhook
}

interface EndpointNavigatorProps {
  onSelectEndpoint: (endpoint: APIEndpoint) => void
  selectedEndpoint: APIEndpoint | null
}

export default function EndpointNavigator({ onSelectEndpoint, selectedEndpoint }: EndpointNavigatorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Authentication']))
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([])
  const [currentEnvironment, setCurrentEnvironment] = useState(environmentManager.getCurrentEnvironment())

  useEffect(() => {
    const initializeData = async () => {
      try {
        await loadOpenAPISpec()
        const loadedEndpoints = openAPIParser.getEndpoints()
        setEndpoints(loadedEndpoints)
      } catch (error) {
        console.error('Failed to load OpenAPI spec:', error)
      }
    }
    
    initializeData()
  }, [])

  const filteredEndpoints = endpoints.filter(endpoint =>
    endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    endpoint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    endpoint.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
    endpoint.summary.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const groupedEndpoints = filteredEndpoints.reduce((acc, endpoint) => {
    if (!acc[endpoint.category]) {
      acc[endpoint.category] = []
    }
    acc[endpoint.category].push(endpoint)
    return acc
  }, {} as Record<string, APIEndpoint[]>)

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
      case 'POST': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
      case 'PUT': return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30'
      case 'DELETE': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
      case 'PATCH': return 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30'
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30'
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
      </div>

      {/* Endpoint List */}
      <div className="flex-1 overflow-auto">
        {Object.entries(groupedEndpoints).map(([category, endpoints]) => {
          const IconComponent = categoryIcons[category as keyof typeof categoryIcons] || Shield
          const isExpanded = expandedCategories.has(category)

          return (
            <div key={category} className="border-b border-border">
              <Button
                variant="ghost"
                onClick={() => toggleCategory(category)}
                className="w-full justify-start px-4 py-3 h-auto font-medium text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 mr-2" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-2" />
                )}
                <IconComponent className="w-4 h-4 mr-2" />
                <span>{category}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {endpoints.length}
                </span>
              </Button>

              {isExpanded && (
                <div className="pb-2">
                  {endpoints.map((endpoint) => (
                    <button
                      key={endpoint.id}
                      onClick={() => onSelectEndpoint(endpoint)}
                      className={`w-full text-left px-8 py-2 hover:bg-accent hover:text-accent-foreground transition-colors ${
                        selectedEndpoint?.id === endpoint.id ? 'bg-accent text-accent-foreground' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getMethodColor(endpoint.method)}`}>
                          {endpoint.method}
                        </span>
                        <span className="text-sm font-mono text-foreground truncate">
                          {endpoint.path}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-0">
                        {endpoint.description}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-border">
        <div className="space-y-2">
          <select
            value={currentEnvironment.id}
            onChange={(e) => {
              environmentManager.setCurrentEnvironment(e.target.value)
              setCurrentEnvironment(environmentManager.getCurrentEnvironment())
            }}
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
          >
            {DEFAULT_ENVIRONMENTS.map(env => (
              <option key={env.id} value={env.id}>
                {env.name} - {env.description}
              </option>
            ))}
          </select>
          <div className="text-xs text-muted-foreground">
            Base URL: {currentEnvironment.baseUrl}
          </div>
        </div>
      </div>
    </div>
  )
}