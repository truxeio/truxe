export interface Environment {
  id: string
  name: string
  baseUrl: string
  description: string
  color: string
}

export interface EnvironmentConfig {
  apiKey?: string
  jwtToken?: string
  customHeaders?: Record<string, string>
}

export const DEFAULT_ENVIRONMENTS: Environment[] = [
  {
    id: 'local',
    name: 'Local',
    baseUrl: 'http://localhost:3456',
    description: 'Local development server (Truxe default port)',
    color: 'blue'
  },
  {
    id: 'local-docker',
    name: 'Local (Docker)',
    baseUrl: 'http://localhost:87001',
    description: 'Docker deployment port',
    color: 'cyan'
  },
  {
    id: 'custom',
    name: 'Custom',
    baseUrl: 'http://localhost:3000',
    description: 'Custom API endpoint (editable)',
    color: 'purple'
  },
  {
    id: 'production',
    name: 'Production',
    baseUrl: 'https://api.truxe.io',
    description: 'Production environment (when available)',
    color: 'red'
  }
]

class EnvironmentManager {
  private currentEnvironment: Environment = DEFAULT_ENVIRONMENTS[0]
  private configs: Map<string, EnvironmentConfig> = new Map()

  getCurrentEnvironment(): Environment {
    return this.currentEnvironment
  }

  setCurrentEnvironment(environmentId: string): void {
    const env = DEFAULT_ENVIRONMENTS.find(e => e.id === environmentId)
    if (env) {
      this.currentEnvironment = env
      this.saveToStorage()
    }
  }

  getEnvironmentConfig(environmentId?: string): EnvironmentConfig {
    const id = environmentId || this.currentEnvironment.id
    return this.configs.get(id) || {}
  }

  setEnvironmentConfig(config: EnvironmentConfig, environmentId?: string): void {
    const id = environmentId || this.currentEnvironment.id
    this.configs.set(id, { ...this.configs.get(id), ...config })
    this.saveToStorage()
  }

  getFullUrl(path: string): string {
    const baseUrl = this.currentEnvironment.baseUrl.replace(/\/$/, '')
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${baseUrl}${cleanPath}`
  }

  getAuthHeaders(): Record<string, string> {
    const config = this.getEnvironmentConfig()
    const headers: Record<string, string> = {}

    if (config.apiKey) {
      headers['X-API-Key'] = config.apiKey
    }

    if (config.jwtToken) {
      headers['Authorization'] = `Bearer ${config.jwtToken}`
    }

    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders)
    }

    return headers
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('truxe-playground-environment', this.currentEnvironment.id)
      localStorage.setItem('truxe-playground-configs', JSON.stringify(Object.fromEntries(this.configs)))
    } catch (error) {
      console.warn('Failed to save environment to localStorage:', error)
    }
  }

  loadFromStorage(): void {
    try {
      const savedEnvironment = localStorage.getItem('truxe-playground-environment')
      if (savedEnvironment) {
        this.setCurrentEnvironment(savedEnvironment)
      }

      const savedConfigs = localStorage.getItem('truxe-playground-configs')
      if (savedConfigs) {
        const configs = JSON.parse(savedConfigs)
        this.configs = new Map(Object.entries(configs))
      }
    } catch (error) {
      console.warn('Failed to load environment from localStorage:', error)
    }
  }
}

export const environmentManager = new EnvironmentManager()

// Load saved settings on initialization
environmentManager.loadFromStorage()