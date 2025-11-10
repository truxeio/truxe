import axios, { AxiosResponse, AxiosError } from 'axios'
import { environmentManager } from './environment-manager'

export interface RequestConfig {
  method: string
  url: string
  headers: Record<string, string>
  body?: any
  params?: Record<string, string>
}

export interface ExecutionResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  data: any
  responseTime: number
  size: number
}

export interface ExecutionError extends ExecutionResponse {
  error: string
}

class RequestExecutor {
  async execute(config: RequestConfig): Promise<ExecutionResponse> {
    const startTime = performance.now()
    
    try {
      // Build full URL
      const fullUrl = environmentManager.getFullUrl(config.url)
      
      // Merge headers with environment auth headers
      const authHeaders = environmentManager.getAuthHeaders()
      const headers = {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...config.headers
      }

      // Filter out empty headers
      const cleanHeaders = Object.fromEntries(
        Object.entries(headers).filter(([_, value]) => value && value.trim())
      )

      // Make the request
      const response: AxiosResponse = await axios({
        method: config.method.toLowerCase() as any,
        url: fullUrl,
        headers: cleanHeaders,
        data: config.body,
        params: config.params,
        timeout: 30000, // 30 second timeout
        validateStatus: () => true // Accept all status codes
      })

      const endTime = performance.now()
      const responseTime = Math.round(endTime - startTime)

      // Calculate response size
      const responseText = JSON.stringify(response.data)
      const size = new Blob([responseText]).size

      // Convert Axios headers to plain Record<string, string>
      const plainHeaders: Record<string, string> = {}
      Object.entries(response.headers).forEach(([key, value]) => {
        if (value !== undefined) {
          plainHeaders[key] = String(value)
        }
      })

      return {
        status: response.status,
        statusText: response.statusText,
        headers: plainHeaders,
        data: response.data,
        responseTime,
        size
      }

    } catch (error) {
      const endTime = performance.now()
      const responseTime = Math.round(endTime - startTime)

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError
        
        if (axiosError.response) {
          // Server responded with error status
          const size = new Blob([JSON.stringify(axiosError.response.data)]).size
          
          return {
            status: axiosError.response.status,
            statusText: axiosError.response.statusText,
            headers: axiosError.response.headers,
            data: axiosError.response.data,
            responseTime,
            size,
            error: 'HTTP_ERROR'
          } as ExecutionError

        } else if (axiosError.request) {
          // Network error
          return {
            status: 0,
            statusText: 'Network Error',
            headers: {},
            data: { 
              error: 'NETWORK_ERROR',
              message: 'Unable to connect to the server. Please check your network connection and the server URL.' 
            },
            responseTime,
            size: 0,
            error: 'NETWORK_ERROR'
          } as ExecutionError

        } else {
          // Request setup error
          return {
            status: 0,
            statusText: 'Request Error',
            headers: {},
            data: { 
              error: 'REQUEST_ERROR',
              message: axiosError.message 
            },
            responseTime,
            size: 0,
            error: 'REQUEST_ERROR'
          } as ExecutionError
        }
      }

      // Unknown error
      return {
        status: 0,
        statusText: 'Unknown Error',
        headers: {},
        data: { 
          error: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'An unknown error occurred' 
        },
        responseTime,
        size: 0,
        error: 'UNKNOWN_ERROR'
      } as ExecutionError
    }
  }

  async validateEndpoint(url: string): Promise<boolean> {
    try {
      const fullUrl = environmentManager.getFullUrl(url)
      await axios.head(fullUrl, { timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  getRequestPreview(config: RequestConfig): string {
    const fullUrl = environmentManager.getFullUrl(config.url)
    const authHeaders = environmentManager.getAuthHeaders()
    const headers = { ...authHeaders, ...config.headers }
    
    let preview = `${config.method.toUpperCase()} ${fullUrl}\n`
    
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      if (value && value.trim()) {
        preview += `${key}: ${value}\n`
      }
    })
    
    // Add query parameters
    if (config.params && Object.keys(config.params).length > 0) {
      preview += '\nQuery Parameters:\n'
      Object.entries(config.params).forEach(([key, value]) => {
        preview += `${key}=${value}\n`
      })
    }
    
    // Add body
    if (config.body) {
      preview += '\n' + JSON.stringify(config.body, null, 2)
    }
    
    return preview
  }
}

export const requestExecutor = new RequestExecutor()