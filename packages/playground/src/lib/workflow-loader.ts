/**
 * WorkflowLoader - Load and register pre-built workflows
 * API Playground Phase 3: Collections & Workflows
 */

import { Workflow } from '../types/collections'
import { playgroundStorage } from './storage'

// Import all pre-built workflow definitions
import authPasswordFlow from '../data/workflows/auth-password.json'
import authMagicLinkFlow from '../data/workflows/auth-magic-link.json'
import oauthGithubFlow from '../data/workflows/oauth-github.json'
import mfaSetupFlow from '../data/workflows/mfa-setup.json'
import sessionManagementFlow from '../data/workflows/session-management.json'
import passwordResetFlow from '../data/workflows/password-reset.json'
import multiTenantSetupFlow from '../data/workflows/multi-tenant-setup.json'

export class WorkflowLoader {
  private prebuiltWorkflows: Map<string, Workflow> = new Map()
  private loaded = false

  constructor() {
    this.initializePrebuiltWorkflows()
  }

  /**
   * Initialize pre-built workflows
   */
  private initializePrebuiltWorkflows(): void {
    const workflows = [
      authPasswordFlow,
      authMagicLinkFlow, 
      oauthGithubFlow,
      mfaSetupFlow,
      sessionManagementFlow,
      passwordResetFlow,
      multiTenantSetupFlow
    ]

    workflows.forEach(workflowData => {
      const workflow = this.parseWorkflowData(workflowData)
      if (workflow) {
        this.prebuiltWorkflows.set(workflow.id, workflow)
      }
    })
  }

  /**
   * Parse workflow JSON data into Workflow object
   */
  private parseWorkflowData(data: any): Workflow | null {
    try {
      // Convert string dates to Date objects
      const workflow: Workflow = {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        variables: data.variables?.map((variable: any) => ({
          ...variable,
          createdAt: new Date(variable.createdAt),
          updatedAt: new Date(variable.updatedAt)
        })) || []
      }

      return workflow
    } catch (error) {
      console.error(`Failed to parse workflow data:`, error)
      return null
    }
  }

  /**
   * Load all pre-built workflows into storage
   */
  async loadPrebuiltWorkflows(): Promise<void> {
    if (this.loaded) {
      return
    }

    try {
      // Load existing workflows from storage to avoid duplicates
      const existingWorkflows = await playgroundStorage.loadWorkflows()
      const existingIds = new Set(existingWorkflows.map(w => w.id))

      // Save only new pre-built workflows
      const workflowsToSave = Array.from(this.prebuiltWorkflows.values())
        .filter(workflow => !existingIds.has(workflow.id))

      await Promise.all(
        workflowsToSave.map(workflow => 
          playgroundStorage.saveWorkflow(workflow)
        )
      )

      this.loaded = true
      console.log(`Loaded ${workflowsToSave.length} pre-built workflows`)

    } catch (error) {
      console.error('Failed to load pre-built workflows:', error)
      throw error
    }
  }

  /**
   * Get all pre-built workflows
   */
  getPrebuiltWorkflows(): Workflow[] {
    return Array.from(this.prebuiltWorkflows.values())
  }

  /**
   * Get pre-built workflow by ID
   */
  getPrebuiltWorkflow(id: string): Workflow | undefined {
    return this.prebuiltWorkflows.get(id)
  }

  /**
   * Get workflows by category
   */
  getWorkflowsByCategory(category: string): Workflow[] {
    return Array.from(this.prebuiltWorkflows.values())
      .filter(workflow => workflow.category === category)
  }

  /**
   * Get workflow categories
   */
  getCategories(): string[] {
    const categories = new Set(
      Array.from(this.prebuiltWorkflows.values())
        .map(workflow => workflow.category)
    )
    return Array.from(categories).sort()
  }

  /**
   * Search workflows by name, description, or tags
   */
  searchWorkflows(query: string): Workflow[] {
    const lowerQuery = query.toLowerCase()
    
    return Array.from(this.prebuiltWorkflows.values())
      .filter(workflow => 
        workflow.name.toLowerCase().includes(lowerQuery) ||
        workflow.description.toLowerCase().includes(lowerQuery) ||
        workflow.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      )
  }

  /**
   * Validate workflow structure
   */
  validateWorkflow(workflow: Workflow): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Basic validation
    if (!workflow.id) errors.push('Workflow ID is required')
    if (!workflow.name) errors.push('Workflow name is required')
    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step')
    }

    // Validate steps
    workflow.steps.forEach((step, index) => {
      if (!step.id) errors.push(`Step ${index + 1}: ID is required`)
      if (!step.name) errors.push(`Step ${index + 1}: Name is required`)
      if (!step.request) {
        errors.push(`Step ${index + 1}: Request configuration is required`)
      } else {
        if (!step.request.method) {
          errors.push(`Step ${index + 1}: HTTP method is required`)
        }
        if (!step.request.url) {
          errors.push(`Step ${index + 1}: URL is required`)
        }
      }
    })

    // Check for duplicate step IDs
    const stepIds = workflow.steps.map(s => s.id)
    const duplicateIds = stepIds.filter((id, index) => stepIds.indexOf(id) !== index)
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate step IDs: ${duplicateIds.join(', ')}`)
    }

    // Validate variables
    if (workflow.variables) {
      workflow.variables.forEach((variable, index) => {
        if (!variable.key) {
          errors.push(`Variable ${index + 1}: Key is required`)
        }
        if (variable.value === undefined || variable.value === null) {
          errors.push(`Variable ${index + 1}: Value is required`)
        }
      })
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get workflow statistics
   */
  getStats() {
    const workflows = Array.from(this.prebuiltWorkflows.values())
    const categories = this.getCategories()
    
    const categoryStats = categories.reduce((acc, category) => {
      acc[category] = workflows.filter(w => w.category === category).length
      return acc
    }, {} as Record<string, number>)

    const tagStats = new Map<string, number>()
    workflows.forEach(workflow => {
      workflow.tags.forEach(tag => {
        tagStats.set(tag, (tagStats.get(tag) || 0) + 1)
      })
    })

    return {
      totalWorkflows: workflows.length,
      totalCategories: categories.length,
      categoryDistribution: categoryStats,
      tagDistribution: Object.fromEntries(tagStats),
      averageStepsPerWorkflow: workflows.length > 0 
        ? workflows.reduce((sum, w) => sum + w.steps.length, 0) / workflows.length 
        : 0
    }
  }

  /**
   * Export workflows in different formats
   */
  exportWorkflows(format: 'json' | 'yaml' = 'json'): string {
    const workflows = this.getPrebuiltWorkflows()
    
    if (format === 'json') {
      return JSON.stringify(workflows, null, 2)
    } else if (format === 'yaml') {
      // For YAML export, would need a YAML library
      throw new Error('YAML export not yet implemented')
    }
    
    throw new Error(`Unsupported export format: ${format}`)
  }

  /**
   * Create workflow template from existing workflow
   */
  createTemplate(workflowId: string, templateName: string): Workflow | null {
    const workflow = this.prebuiltWorkflows.get(workflowId)
    if (!workflow) {
      return null
    }

    // Create a template by removing execution-specific data
    const template: Workflow = {
      ...workflow,
      id: `template-${Date.now()}`,
      name: templateName,
      description: `Template based on ${workflow.name}`,
      isPrebuilt: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Reset variables to empty or default values
      variables: workflow.variables?.map(variable => ({
        ...variable,
        value: variable.type === 'dynamic' ? variable.value : '',
        createdAt: new Date(),
        updatedAt: new Date()
      })) || []
    }

    return template
  }

  /**
   * Get workflow execution order (topological sort if dependencies exist)
   */
  getExecutionOrder(workflow: Workflow): string[] {
    // For now, return simple order based on step.order
    return workflow.steps
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(step => step.id)
  }

  /**
   * Validate workflow can be executed with given variables
   */
  canExecuteWorkflow(
    workflow: Workflow, 
    availableVariables: Record<string, any>
  ): { canExecute: boolean; missingVariables: string[] } {
    const missingVariables: string[] = []
    
    // Check required variables from workflow definition
    workflow.variables?.forEach(variable => {
      if (variable.enabled && variable.type !== 'dynamic') {
        const hasValue = variable.value && variable.value.trim().length > 0
        const hasAvailableValue = availableVariables[variable.key]
        
        if (!hasValue && !hasAvailableValue) {
          missingVariables.push(variable.key)
        }
      }
    })

    // TODO: Could also check for variables referenced in step templates
    // that aren't defined in the workflow variables

    return {
      canExecute: missingVariables.length === 0,
      missingVariables
    }
  }
}

// Export singleton instance
export const workflowLoader = new WorkflowLoader()