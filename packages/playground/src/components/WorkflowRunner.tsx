/**
 * WorkflowRunner - Execute and monitor multi-step authentication workflows
 * API Playground Phase 3: Collections & Workflows
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Play,
  Pause,
  Square,
  SkipForward,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Settings,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import {
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  StepExecution,
  Variable,
  StepExecution as WorkflowStepExecution
} from '@/types/collections'
import { workflowEngine } from '@/lib/workflow-engine'
import { workflowLoader } from '@/lib/workflow-loader'
import { playgroundStorage } from '@/lib/storage'

interface WorkflowRunnerProps {
  selectedWorkflowId?: string
  onWorkflowSelect?: (workflow: Workflow) => void
  onStepComplete?: (stepId: string, response: any) => void
}

interface StepExecutionDisplay {
  step: WorkflowStep
  execution?: WorkflowStepExecution
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  isExpanded: boolean
}

export default function WorkflowRunner({
  selectedWorkflowId,
  onWorkflowSelect,
  onStepComplete
}: WorkflowRunnerProps) {
  // State management
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null)
  const [stepDisplays, setStepDisplays] = useState<StepExecutionDisplay[]>([])
  const [executionHistory, setExecutionHistory] = useState<WorkflowExecution[]>([])
  const [variables, setVariables] = useState<Record<string, any>>({})
  const [showVariableModal, setShowVariableModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows()
  }, [])

  // Load selected workflow
  useEffect(() => {
    if (selectedWorkflowId) {
      loadWorkflow(selectedWorkflowId)
    }
  }, [selectedWorkflowId])

  // Listen to workflow engine events
  useEffect(() => {
    if (!selectedWorkflow) return

    // Event listeners would be set up here if WorkflowEngine exposed them
    // For now, this is just a placeholder for future implementation

    return () => {
      // Remove listeners
    }
  }, [selectedWorkflow, onStepComplete])

  /**
   * Load all available workflows
   */
  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true)
      
      // Load pre-built workflows
      await workflowLoader.loadPrebuiltWorkflows()
      
      // Load all workflows
      const workflowsData = await playgroundStorage.loadWorkflows()
      setWorkflows(workflowsData)
      
    } catch (error) {
      console.error('Failed to load workflows:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Load specific workflow
   */
  const loadWorkflow = useCallback(async (workflowId: string) => {
    try {
      const workflows = await playgroundStorage.loadWorkflows()
      const workflow = workflows.find(w => w.id === workflowId)
      if (workflow) {
        setSelectedWorkflow(workflow)
        setCurrentExecution(null)


        // Initialize step displays
        const displays: StepExecutionDisplay[] = workflow.steps.map((step: WorkflowStep) => ({
          step,
          status: 'pending' as const,
          isExpanded: false
        }))
        setStepDisplays(displays)
        
        // Load workflow variables
        const workflowVars = workflow.variables?.reduce((acc: Record<string, any>, variable: Variable) => {
          acc[variable.key] = variable.value
          return acc
        }, {} as Record<string, any>) || {}
        setVariables(workflowVars)
        
        if (onWorkflowSelect) {
          onWorkflowSelect(workflow)
        }
      }
    } catch (error) {
      console.error('Failed to load workflow:', error)
    }
  }, [onWorkflowSelect])

  /**
   * Load execution history
   */
  const loadExecutionHistory = useCallback(async () => {
    if (!selectedWorkflow) return

    try {
      const executions = await playgroundStorage.loadExecutionsByWorkflow(selectedWorkflow.id)
      setExecutionHistory(executions.slice(0, 10)) // Keep last 10 executions
    } catch (error) {
      console.error('Failed to load execution history:', error)
    }
  }, [selectedWorkflow])

  // Load execution history when workflow is selected
  useEffect(() => {
    if (selectedWorkflow) {
      loadExecutionHistory()
    }
  }, [selectedWorkflow, loadExecutionHistory])

  /**
   * Start workflow execution
   */
  const startExecution = useCallback(async () => {
    if (!selectedWorkflow || isExecuting) return
    
    try {
      setIsExecuting(true)
      
      // Reset step displays
      setStepDisplays(prev => prev.map(display => ({
        ...display,
        status: 'pending' as const,
        execution: undefined
      })))
      
      // Start execution
      const execution = await workflowEngine.executeWorkflow(
        selectedWorkflow,
        variables
      )
      
      setCurrentExecution(execution)
      
    } catch (error) {
      console.error('Workflow execution failed:', error)
      setIsExecuting(false)
    }
  }, [selectedWorkflow, variables, isExecuting])

  /**
   * Pause workflow execution
   */
  const pauseExecution = useCallback(async () => {
    if (!currentExecution) return
    
    try {
      await workflowEngine.pauseExecution(currentExecution.id)
      setIsExecuting(false)
    } catch (error) {
      console.error('Failed to pause execution:', error)
    }
  }, [currentExecution])

  /**
   * Resume workflow execution
   */
  const resumeExecution = useCallback(async () => {
    if (!currentExecution) return
    
    try {
      await workflowEngine.resumeExecution(currentExecution.id)
      setIsExecuting(true)
    } catch (error) {
      console.error('Failed to resume execution:', error)
    }
  }, [currentExecution])

  /**
   * Stop workflow execution
   */
  const stopExecution = useCallback(async () => {
    if (!currentExecution) return

    try {
      await workflowEngine.cancelExecution(currentExecution.id)
      setIsExecuting(false)
      setCurrentExecution(null)

      // Reset step displays
      setStepDisplays(prev => prev.map(display => ({
        ...display,
        status: 'pending' as const,
        execution: undefined
      })))
    } catch (error) {
      console.error('Failed to stop execution:', error)
    }
  }, [currentExecution])

  /**
   * Skip current step (not implemented in engine yet)
   */
  const skipCurrentStep = useCallback(async () => {
    if (!currentExecution) return

    try {
      // TODO: Implement skipCurrentStep in workflowEngine
      console.warn('Skip step not yet implemented')
    } catch (error) {
      console.error('Failed to skip step:', error)
    }
  }, [currentExecution])

  /**
   * Restart workflow
   */
  const restartWorkflow = useCallback(() => {
    setCurrentExecution(null)
    setIsExecuting(false)
    
    if (selectedWorkflow) {
      setStepDisplays(selectedWorkflow.steps.map(step => ({
        step,
        status: 'pending',
        isExpanded: false
      })))
    }
  }, [selectedWorkflow])

  /**
   * Toggle step expansion
   */
  const toggleStepExpansion = useCallback((stepId: string) => {
    setStepDisplays(prev => prev.map(display => 
      display.step.id === stepId 
        ? { ...display, isExpanded: !display.isExpanded }
        : display
    ))
  }, [])

  /**
   * Update variable value
   */
  const updateVariable = useCallback((key: string, value: any) => {
    setVariables(prev => ({ ...prev, [key]: value }))
  }, [])

  /**
   * Get execution status
   */
  const executionStatus = useMemo(() => {
    if (!currentExecution) return 'idle'
    if (isExecuting) return 'running'
    if (currentExecution.status === 'paused') return 'paused'
    return currentExecution.status
  }, [currentExecution, isExecuting])

  /**
   * Get execution progress
   */
  const executionProgress = useMemo(() => {
    if (!selectedWorkflow || !currentExecution) return 0
    
    const completedSteps = stepDisplays.filter(
      display => display.status === 'completed' || display.status === 'failed'
    ).length
    
    return Math.round((completedSteps / selectedWorkflow.steps.length) * 100)
  }, [selectedWorkflow, currentExecution, stepDisplays])

  /**
   * Render workflow selector
   */
  const renderWorkflowSelector = () => (
    <div className="p-4 border-b">
      <h3 className="text-sm font-medium mb-2">Select Workflow</h3>
      <select
        value={selectedWorkflow?.id || ''}
        onChange={(e) => e.target.value && loadWorkflow(e.target.value)}
        className="w-full p-2 border rounded-md text-sm"
      >
        <option value="">Choose a workflow...</option>
        {workflows.map(workflow => (
          <option key={workflow.id} value={workflow.id}>
            {workflow.name} ({workflow.category})
          </option>
        ))}
      </select>
    </div>
  )

  /**
   * Render execution controls
   */
  const renderExecutionControls = () => {
    if (!selectedWorkflow) return null

    const canExecute = workflowLoader.canExecuteWorkflow(selectedWorkflow, variables)

    return (
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Execution Controls</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVariableModal(true)}
            >
              <Settings className="w-3 h-3 mr-1" />
              Variables
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistoryModal(true)}
            >
              <Clock className="w-3 h-3 mr-1" />
              History
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          {executionStatus === 'idle' && (
            <Button
              onClick={startExecution}
              disabled={!canExecute.canExecute}
              className="flex-1"
            >
              <Play className="w-3 h-3 mr-1" />
              Start Workflow
            </Button>
          )}
          
          {executionStatus === 'running' && (
            <>
              <Button
                variant="outline"
                onClick={pauseExecution}
              >
                <Pause className="w-3 h-3 mr-1" />
                Pause
              </Button>
              <Button
                variant="outline"
                onClick={skipCurrentStep}
              >
                <SkipForward className="w-3 h-3 mr-1" />
                Skip Step
              </Button>
            </>
          )}
          
          {executionStatus === 'paused' && (
            <Button
              onClick={resumeExecution}
              className="flex-1"
            >
              <Play className="w-3 h-3 mr-1" />
              Resume
            </Button>
          )}
          
          {(executionStatus === 'running' || executionStatus === 'paused') && (
            <Button
              variant="destructive"
              onClick={stopExecution}
            >
              <Square className="w-3 h-3 mr-1" />
              Stop
            </Button>
          )}
          
          {(executionStatus === 'completed' || executionStatus === 'failed') && (
            <Button
              variant="outline"
              onClick={restartWorkflow}
              className="flex-1"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Restart
            </Button>
          )}
        </div>
        
        {/* Execution progress */}
        {currentExecution && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress: {executionProgress}%</span>
              <span className={`px-2 py-1 rounded-full text-xs ${
                {
                  idle: 'bg-gray-100 text-gray-700',
                  pending: 'bg-gray-100 text-gray-700',
                  running: 'bg-blue-100 text-blue-700',
                  paused: 'bg-yellow-100 text-yellow-700',
                  completed: 'bg-green-100 text-green-700',
                  failed: 'bg-red-100 text-red-700',
                  cancelled: 'bg-red-100 text-red-700'
                }[executionStatus] || 'bg-gray-100 text-gray-700'
              }`}>
                {executionStatus}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${executionProgress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Validation errors */}
        {!canExecute.canExecute && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Missing required variables:</p>
              <ul className="list-disc list-inside space-y-1">
                {canExecute.missingVariables.map(variable => (
                  <li key={variable}>{variable}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    )
  }

  /**
   * Render step execution list
   */
  const renderStepList = () => {
    if (!selectedWorkflow) return null

    return (
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium mb-3">Workflow Steps</h3>
          <div className="space-y-2">
            {stepDisplays.map((display, index) => (
              <StepExecutionCard
                key={display.step.id}
                display={display}
                index={index}
                onToggleExpansion={() => toggleStepExpansion(display.step.id)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading workflows...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background border-r">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Workflow Runner</h2>
          <Zap className="w-5 h-5 text-blue-500" />
        </div>
      </div>
      
      {/* Workflow selector */}
      {renderWorkflowSelector()}
      
      {/* Selected workflow info */}
      {selectedWorkflow && (
        <div className="p-4 border-b bg-muted/20">
          <h4 className="font-medium">{selectedWorkflow.name}</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedWorkflow.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {selectedWorkflow.category}
            </span>
            <span className="text-xs text-muted-foreground">
              {selectedWorkflow.steps.length} steps
            </span>
          </div>
        </div>
      )}
      
      {/* Execution controls */}
      {renderExecutionControls()}
      
      {/* Step list */}
      {renderStepList()}
      
      {/* Variable Configuration Modal */}
      <VariableConfigModal
        open={showVariableModal}
        workflow={selectedWorkflow}
        variables={variables}
        onClose={() => setShowVariableModal(false)}
        onUpdateVariable={updateVariable}
      />
      
      {/* Execution History Modal */}
      <ExecutionHistoryModal
        open={showHistoryModal}
        executions={executionHistory}
        onClose={() => setShowHistoryModal(false)}
      />
    </div>
  )
}

/**
 * Step Execution Card Component
 */
interface StepExecutionCardProps {
  display: StepExecutionDisplay
  index: number
  onToggleExpansion: () => void
}

function StepExecutionCard({ display, index, onToggleExpansion }: StepExecutionCardProps) {
  const { step, execution, status, isExpanded } = display

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
      case 'running':
        return <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <div className="w-4 h-4" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'pending': return 'border-gray-200'
      case 'running': return 'border-blue-200 bg-blue-50'
      case 'completed': return 'border-green-200 bg-green-50'
      case 'failed': return 'border-red-200 bg-red-50'
      case 'skipped': return 'border-yellow-200 bg-yellow-50'
      default: return 'border-gray-200'
    }
  }

  return (
    <div className={`border rounded-md ${getStatusColor()}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
        onClick={onToggleExpansion}
      >
        <span className="text-xs font-mono text-muted-foreground w-6">
          {index + 1}.
        </span>
        
        {getStatusIcon()}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium truncate">{step.name}</h4>
            <span className={`text-xs px-2 py-1 rounded font-semibold ${
              {
                GET: 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300',
                POST: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                PUT: 'bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
                DELETE: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                PATCH: 'bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
              }[step.request.method] || 'bg-gray-100 text-gray-700'
            }`}>
              {step.request.method}
            </span>
          </div>
          
          {step.description && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {step.description}
            </p>
          )}
          
          <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
            {step.request.url}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {execution && (
            <span className="text-xs text-muted-foreground">
              {execution.duration}ms
            </span>
          )}
          
          {isExpanded ? 
            <ChevronDown className="w-4 h-4" /> : 
            <ChevronRight className="w-4 h-4" />
          }
        </div>
      </div>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t px-3 pb-3">
          <div className="mt-3 space-y-3">
            {/* Request details */}
            <div>
              <h5 className="text-xs font-medium mb-2">Request Configuration</h5>
              <div className="text-xs space-y-1">
                <div><strong>URL:</strong> {step.request.url}</div>
                <div><strong>Method:</strong> {step.request.method}</div>
                {step.request.headers && Object.keys(step.request.headers).length > 0 && (
                  <div>
                    <strong>Headers:</strong>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(step.request.headers, null, 2)}
                    </pre>
                  </div>
                )}
                {step.request.body && (
                  <div>
                    <strong>Body:</strong>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                      {typeof step.request.body === 'string' 
                        ? step.request.body 
                        : JSON.stringify(step.request.body, null, 2)
                      }
                    </pre>
                  </div>
                )}
              </div>
            </div>
            
            {/* Execution results */}
            {execution && (
              <div>
                <h5 className="text-xs font-medium mb-2">Execution Result</h5>
                <div className="text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Status: {execution.response?.status || 'N/A'}</span>
                    <span>Duration: {execution.duration}ms</span>
                  </div>
                  
                  {execution.response && (
                    <div>
                      <strong>Response:</strong>
                      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-32">
                        {JSON.stringify(execution.response.data || execution.response.body, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {execution.extractedVariables && Object.keys(execution.extractedVariables).length > 0 && (
                    <div>
                      <strong>Extracted Variables:</strong>
                      <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(execution.extractedVariables, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {execution.error && (
                    <div>
                      <strong>Error:</strong>
                      <pre className="text-xs bg-red-50 text-red-700 p-2 rounded mt-1 overflow-x-auto">
                        {typeof execution.error === 'string' ? execution.error : execution.error.message}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Variable Configuration Modal
 */
interface VariableConfigModalProps {
  open: boolean
  workflow: Workflow | null
  variables: Record<string, any>
  onClose: () => void
  onUpdateVariable: (key: string, value: any) => void
}

function VariableConfigModal({ 
  open, 
  workflow, 
  variables, 
  onClose, 
  onUpdateVariable 
}: VariableConfigModalProps) {
  const [localVariables, setLocalVariables] = useState<Record<string, any>>({})

  useEffect(() => {
    if (open) {
      setLocalVariables({ ...variables })
    }
  }, [open, variables])

  const handleSave = () => {
    Object.entries(localVariables).forEach(([key, value]) => {
      onUpdateVariable(key, value)
    })
    onClose()
  }

  if (!workflow) return null

  const workflowVariables = workflow.variables || []

  return (
    <Modal open={open} onClose={onClose} title="Configure Variables" size="lg">
      <div className="space-y-4">
        {workflowVariables.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            This workflow has no configurable variables.
          </p>
        ) : (
          <div className="space-y-4">
            {workflowVariables.map(variable => (
              <div key={variable.key}>
                <Input
                  label={variable.key}
                  type={variable.type === 'secret' ? 'password' : 'text'}
                  value={localVariables[variable.key] || ''}
                  onChange={(e) => setLocalVariables(prev => ({
                    ...prev,
                    [variable.key]: e.target.value
                  }))}
                  placeholder={variable.description || `Enter ${variable.key}`}
                  helperText={variable.description}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save Variables
        </Button>
      </ModalFooter>
    </Modal>
  )
}

/**
 * Execution History Modal
 */
interface ExecutionHistoryModalProps {
  open: boolean
  executions: WorkflowExecution[]
  onClose: () => void
}

function ExecutionHistoryModal({ open, executions, onClose }: ExecutionHistoryModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Execution History" size="xl">
      <div className="space-y-4">
        {executions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No execution history available.
          </p>
        ) : (
          <div className="space-y-3">
            {executions.map(execution => (
              <div key={execution.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    {
                      pending: 'bg-gray-100 text-gray-700',
                      running: 'bg-blue-100 text-blue-700',
                      completed: 'bg-green-100 text-green-700',
                      failed: 'bg-red-100 text-red-700',
                      paused: 'bg-yellow-100 text-yellow-700',
                      cancelled: 'bg-red-100 text-red-700'
                    }[execution.status] || 'bg-gray-100 text-gray-700'
                  }`}>
                    {execution.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(execution.startedAt).toLocaleString()}
                  </span>
                </div>
                
                <div className="text-sm space-y-1">
                  <div>Duration: {execution.duration || 0}ms</div>
                  <div>Steps: {execution.stepExecutions?.length || execution.steps?.length || 0}</div>
                  <div>
                    Success: {(execution.stepExecutions || execution.steps || []).filter((s: StepExecution) => s.success).length}/
                    {execution.stepExecutions?.length || execution.steps?.length || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <ModalFooter>
        <Button onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  )
}