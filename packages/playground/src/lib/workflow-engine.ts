/**
 * WorkflowEngine - Execute multi-step authentication workflows
 * API Playground Phase 3: Collections & Workflows
 */

import {
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  StepExecution,
  ExecutionError,
  VariableContext,
  ExpectedResponse
} from '../types/collections'
import { RequestConfig } from './request-executor'
import { variableResolver } from './variable-resolver'
import { generateId, sleep } from './utils'
import { playgroundStorage } from './storage'

export class WorkflowEngine {
  private activeExecutions: Map<string, WorkflowExecution> = new Map()
  private listeners: Map<string, Function[]> = new Map()

  constructor() {
    this.initializeEventListeners()
  }

  private initializeEventListeners(): void {
    this.listeners.set('execution:started', [])
    this.listeners.set('execution:step-started', [])
    this.listeners.set('execution:step-completed', [])
    this.listeners.set('execution:step-failed', [])
    this.listeners.set('execution:paused', [])
    this.listeners.set('execution:resumed', [])
    this.listeners.set('execution:completed', [])
    this.listeners.set('execution:failed', [])
    this.listeners.set('execution:cancelled', [])
  }

  /**
   * Execute a workflow with initial variables
   */
  async executeWorkflow(
    workflow: Workflow,
    initialVariables?: Record<string, string>,
    options?: {
      timeout?: number
      continueOnError?: boolean
      pauseOnFailure?: boolean
    }
  ): Promise<WorkflowExecution> {
    const executionId = generateId()
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      status: 'pending',
      currentStep: 0,
      totalSteps: workflow.steps.length,
      startedAt: new Date(),
      variables: this.createInitialContext(workflow, initialVariables),
      steps: [],
      stepExecutions: []
    }

    this.activeExecutions.set(executionId, execution)

    try {
      // Save execution to storage
      await playgroundStorage.saveExecution(execution)

      // Start execution
      execution.status = 'running'
      this.emit('execution:started', execution)

      // Execute steps sequentially
      for (let i = 0; i < workflow.steps.length; i++) {
        const currentStatus: string = execution.status
        if (currentStatus === 'cancelled' || currentStatus === 'failed') {
          break
        }

        execution.currentStep = i + 1
        const step = workflow.steps[i]

        try {
          // Check if execution is paused
          if (execution.status === 'paused') {
            await this.waitForResume(executionId)
          }

          const stepExecution = await this.executeStep(
            step,
            execution.variables,
            options?.timeout
          )

          execution.steps.push(stepExecution)
          execution.stepExecutions.push(stepExecution)

          // Update variables with extracted values
          if (stepExecution.extractedVariables) {
            Object.entries(stepExecution.extractedVariables).forEach(([key, value]) => {
              if (!execution.variables.resolved) {
                execution.variables.resolved = {}
              }
              execution.variables.resolved[key] = String(value)
            })
          }

          // Handle step failure
          if (stepExecution.status === 'failed') {
            if (options?.pauseOnFailure) {
              execution.status = 'paused'
              this.emit('execution:paused', execution)
              await this.waitForResume(executionId)
            } else if (!options?.continueOnError) {
              execution.status = 'failed'
              execution.error = stepExecution.error
              break
            }
          }

          // Determine next step
          const nextStepId = await this.determineNextStep(
            step, 
            stepExecution, 
            execution.variables
          )

          if (nextStepId && nextStepId !== workflow.steps[i + 1]?.id) {
            // Find the next step by ID
            const nextStepIndex = workflow.steps.findIndex(s => s.id === nextStepId)
            if (nextStepIndex !== -1) {
              i = nextStepIndex - 1 // -1 because loop will increment
            }
          }

        } catch (error) {
          const stepExecution: StepExecution = {
            stepId: step.id,
            name: step.name,
            status: 'failed',
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 0,
            error: {
              type: 'script',
              message: error instanceof Error ? error.message : 'Unknown error',
              details: error,
              step: step.id,
              timestamp: new Date()
            },
            retryCount: 0,
            success: false
          }

          execution.steps.push(stepExecution)
          execution.stepExecutions.push(stepExecution)

          if (!options?.continueOnError) {
            execution.status = 'failed'
            execution.error = stepExecution.error
            break
          }
        }
      }

      // Complete execution if not already failed or cancelled
      if (execution.status === 'running') {
        execution.status = 'completed'
        execution.completedAt = new Date()
        execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime()
        this.emit('execution:completed', execution)
      } else if (execution.status === 'failed') {
        execution.completedAt = new Date()
        execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime()
        this.emit('execution:failed', execution)
      }

    } catch (error) {
      execution.status = 'failed'
      execution.completedAt = new Date()
      execution.duration = execution.completedAt ? 
        execution.completedAt.getTime() - execution.startedAt.getTime() : 0
      execution.error = {
        type: 'script',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        timestamp: new Date()
      }
      this.emit('execution:failed', execution)
    } finally {
      // Save final execution state
      await playgroundStorage.saveExecution(execution)
      this.activeExecutions.delete(executionId)
    }

    return execution
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    context: VariableContext,
    timeout?: number
  ): Promise<StepExecution> {
    const startTime = new Date()
    
    const stepExecution: StepExecution = {
      stepId: step.id,
      name: step.name,
      status: 'running',
      startedAt: startTime,
      retryCount: 0,
      success: false
    }

    this.emit('execution:step-started', stepExecution)

    try {
      // Resolve variables in the request configuration
      const resolvedRequest = variableResolver.resolveObject(step.request, context)
      stepExecution.request = resolvedRequest

      // Execute the request with optional timeout
      const response = await this.executeRequest(resolvedRequest, timeout)
      stepExecution.response = response

      // Validate response against expected criteria
      if (step.expectedResponse) {
        const validationResult = this.validateResponse(response, step.expectedResponse)
        if (!validationResult.valid) {
          throw new Error(`Response validation failed: ${validationResult.errors.join(', ')}`)
        }
      }

      // Extract variables from response
      if (step.extractVariables) {
        stepExecution.extractedVariables = this.extractVariablesFromResponse(
          response.body,
          step.extractVariables
        )
      }

      // Execute success actions
      if (step.onSuccess) {
        await this.executeActions(step.onSuccess, context)
      }

      stepExecution.status = 'completed'
      stepExecution.success = true
      stepExecution.completedAt = new Date()
      stepExecution.duration = stepExecution.completedAt.getTime() - startTime.getTime()

      this.emit('execution:step-completed', stepExecution)

    } catch (error) {
      stepExecution.status = 'failed'
      stepExecution.completedAt = new Date()
      stepExecution.duration = stepExecution.completedAt.getTime() - startTime.getTime()
      stepExecution.error = {
        type: this.classifyError(error),
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
        step: step.id,
        timestamp: new Date()
      }

      // Execute failure actions
      if (step.onFailure) {
        try {
          await this.executeActions(step.onFailure, context)
        } catch (actionError) {
          console.warn('Failed to execute failure actions:', actionError)
        }
      }

      // Retry logic
      const maxRetries = step.retries || 0
      if (stepExecution.retryCount < maxRetries) {
        stepExecution.retryCount++
        const retryDelay = Math.pow(2, stepExecution.retryCount) * 1000 // Exponential backoff
        await sleep(retryDelay)
        return this.executeStep(step, context, timeout)
      }

      this.emit('execution:step-failed', stepExecution)
    }

    return stepExecution
  }

  /**
   * Execute HTTP request
   */
  private async executeRequest(
    request: RequestConfig,
    timeout?: number
  ): Promise<any> {
    const controller = new AbortController()
    let timeoutId: NodeJS.Timeout | undefined

    if (timeout) {
      timeoutId = setTimeout(() => controller.abort(), timeout)
    }

    try {
      const startTime = Date.now()
      
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal
      })

      const endTime = Date.now()
      const responseBody = await this.parseResponseBody(response)

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
        timestamp: new Date(),
        duration: endTime - startTime,
        size: new Blob([JSON.stringify(responseBody)]).size
      }

    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }

  /**
   * Parse response body handling different content types
   */
  private async parseResponseBody(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      try {
        return await response.json()
      } catch {
        return await response.text()
      }
    } else if (contentType.includes('text/')) {
      return await response.text()
    } else {
      // For binary content, return as base64
      const buffer = await response.arrayBuffer()
      return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    }
  }

  /**
   * Validate response against expected criteria
   */
  private validateResponse(
    response: any, 
    expected: ExpectedResponse
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate status code
    if (Array.isArray(expected.status)) {
      if (!expected.status.includes(response.status)) {
        errors.push(`Expected status ${expected.status.join(' or ')}, got ${response.status}`)
      }
    } else {
      if (response.status !== expected.status) {
        errors.push(`Expected status ${expected.status}, got ${response.status}`)
      }
    }

    // Validate headers
    if (expected.headers) {
      Object.entries(expected.headers).forEach(([key, value]) => {
        const actualValue = response.headers[key.toLowerCase()]
        if (actualValue !== value) {
          errors.push(`Expected header ${key}: ${value}, got ${actualValue}`)
        }
      })
    }

    // Validate body contains specific strings
    if (expected.bodyContains) {
      const bodyString = JSON.stringify(response.body)
      expected.bodyContains.forEach(searchString => {
        if (!bodyString.includes(searchString)) {
          errors.push(`Response body should contain "${searchString}"`)
        }
      })
    }

    // Validate required fields are present
    if (expected.extractFields && response.body && typeof response.body === 'object') {
      expected.extractFields.forEach(field => {
        if (!(field in response.body)) {
          errors.push(`Required field "${field}" not found in response`)
        }
      })
    }

    // TODO: Validate against JSON schema if provided
    if (expected.schema) {
      // JSON schema validation would go here
      // For now, we'll skip this advanced validation
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Extract variables from response using JSONPath expressions
   */
  private extractVariablesFromResponse(
    responseBody: any,
    extractors: Record<string, string>
  ): Record<string, any> {
    const extracted: Record<string, any> = {}

    Object.entries(extractors).forEach(([variableName, path]) => {
      try {
        const value = this.extractByPath(responseBody, path)
        if (value !== undefined) {
          extracted[variableName] = value
        }
      } catch (error) {
        console.warn(`Failed to extract variable "${variableName}" using path "${path}":`, error)
      }
    })

    return extracted
  }

  /**
   * Extract value from object using simple JSONPath-like syntax
   */
  private extractByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined

    // Handle simple JSONPath expressions
    if (path.startsWith('$.')) {
      path = path.substring(2) // Remove '$.'
    }

    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined
      }

      // Handle array access like items[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch
        current = current[arrayName]
        if (Array.isArray(current)) {
          current = current[parseInt(index)]
        } else {
          return undefined
        }
      } else {
        current = current[part]
      }
    }

    return current
  }

  /**
   * Determine the next step based on step configuration and results
   */
  private async determineNextStep(
    step: WorkflowStep,
    stepExecution: StepExecution,
    context: VariableContext
  ): Promise<string | undefined> {
    if (!step.nextStep) {
      return undefined
    }

    if (typeof step.nextStep === 'string') {
      return step.nextStep
    }

    if (typeof step.nextStep === 'function' && stepExecution.response) {
      try {
        return step.nextStep(stepExecution.response.body, context)
      } catch (error) {
        console.warn('Error in nextStep function:', error)
        return undefined
      }
    }

    return undefined
  }

  /**
   * Execute step actions (onSuccess/onFailure)
   */
  private async executeActions(
    actions: any[], 
    context: VariableContext
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'set-variable':
            if (!context.resolved) context.resolved = {}
            context.resolved[action.params.key] = action.params.value
            break
          
          case 'log':
            console.log('Workflow action log:', action.params.message)
            break
          
          case 'delay':
            await sleep(action.params.ms || 1000)
            break
          
          case 'custom':
            if (action.params.function && typeof action.params.function === 'function') {
              await action.params.function(context)
            }
            break
        }
      } catch (error) {
        console.warn(`Failed to execute action ${action.type}:`, error)
      }
    }
  }

  /**
   * Create initial variable context for execution
   */
  private createInitialContext(
    workflow: Workflow,
    initialVariables?: Record<string, string>
  ): VariableContext {
    const context: VariableContext = {
      environment: {},
      collection: {},
      request: {},
      workflow: {},
      resolved: initialVariables || {}
    }

    // Add workflow variables to context
    workflow.variables?.forEach(variable => {
      context.workflow[variable.key] = variable
    })

    return context
  }

  /**
   * Classify error type
   */
  private classifyError(error: any): ExecutionError['type'] {
    if (error.name === 'AbortError') return 'timeout'
    if (error.name === 'TypeError' && error.message.includes('fetch')) return 'network'
    if (error.message?.includes('validation')) return 'validation'
    return 'unknown'
  }

  /**
   * Wait for execution to be resumed
   */
  private async waitForResume(executionId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkStatus = () => {
        const execution = this.activeExecutions.get(executionId)
        if (!execution || execution.status !== 'paused') {
          resolve()
        } else {
          setTimeout(checkStatus, 1000)
        }
      }
      checkStatus()
    })
  }

  /**
   * Pause a running execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId)
    if (execution && execution.status === 'running') {
      execution.status = 'paused'
      await playgroundStorage.saveExecution(execution)
      this.emit('execution:paused', execution)
    }
  }

  /**
   * Resume a paused execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId)
    if (execution && execution.status === 'paused') {
      execution.status = 'running'
      await playgroundStorage.saveExecution(execution)
      this.emit('execution:resumed', execution)
    }
  }

  /**
   * Cancel a running or paused execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId)
    if (execution && ['running', 'paused'].includes(execution.status)) {
      execution.status = 'cancelled'
      execution.completedAt = new Date()
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime()
      
      await playgroundStorage.saveExecution(execution)
      this.activeExecutions.delete(executionId)
      this.emit('execution:cancelled', execution)
    }
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.activeExecutions.get(executionId)
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.activeExecutions.values())
  }

  /**
   * Get execution history for a workflow
   */
  async getExecutionHistory(workflowId: string): Promise<WorkflowExecution[]> {
    return playgroundStorage.loadExecutionsByWorkflow(workflowId)
  }

  /**
   * Event system for execution monitoring
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in workflow event callback for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Validate workflow structure
   */
  validateWorkflow(workflow: Workflow): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check basic structure
    if (!workflow.id) errors.push('Workflow ID is required')
    if (!workflow.name) errors.push('Workflow name is required')
    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step')
    }

    // Validate steps
    workflow.steps.forEach((step, index) => {
      if (!step.id) errors.push(`Step ${index + 1}: ID is required`)
      if (!step.name) errors.push(`Step ${index + 1}: Name is required`)
      if (!step.request) errors.push(`Step ${index + 1}: Request configuration is required`)
      
      // Validate request
      if (step.request) {
        if (!step.request.method) errors.push(`Step ${index + 1}: HTTP method is required`)
        if (!step.request.url) errors.push(`Step ${index + 1}: URL is required`)
      }

      // Validate extract variables JSONPath expressions
      if (step.extractVariables) {
        Object.entries(step.extractVariables).forEach(([varName, path]) => {
          if (!path.startsWith('$.') && !path.includes('.')) {
            errors.push(`Step ${index + 1}: Invalid JSONPath expression for variable "${varName}"`)
          }
        })
      }
    })

    // Check for duplicate step IDs
    const stepIds = workflow.steps.map(s => s.id)
    const duplicateIds = stepIds.filter((id, index) => stepIds.indexOf(id) !== index)
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate step IDs: ${duplicateIds.join(', ')}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine()