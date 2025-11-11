/**
 * ImportExport - File upload and download interface for collections and workflows
 * API Playground Phase 3: Collections & Workflows
 */

import React, { useState, useCallback, useRef } from 'react'
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  File,
  Archive
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import {
  ExportFormat,
  ImportResult
} from '@/types/collections'
import { importExportManager } from '@/lib/import-export-manager'

interface ImportExportProps {
  onClose: () => void
  onImportComplete?: () => void
}

interface ImportState {
  file: File | null
  format: ExportFormat | null
  autoDetected: boolean
  validating: boolean
  importing: boolean
  result: ImportResult | null
  preview: any | null
  error: string | null
}

interface ExportState {
  format: ExportFormat
  includeVariables: boolean
  includeWorkflows: boolean
  minify: boolean
  filename: string
  exporting: boolean
  result: { data: string; filename: string; mimeType: string } | null
  error: string | null
}

const FORMAT_INFO = {
  truxe: {
    name: 'Truxe Format',
    description: 'Native format with full feature support',
    extensions: ['.json'],
    supportsVariables: true,
    supportsWorkflows: true,
    icon: <Archive className="w-4 h-4 text-blue-500" />
  },
  postman: {
    name: 'Postman Collection',
    description: 'Compatible with Postman v2.1',
    extensions: ['.json'],
    supportsVariables: true,
    supportsWorkflows: false,
    icon: <FileText className="w-4 h-4 text-orange-500" />
  },
  openapi: {
    name: 'OpenAPI Specification',
    description: 'OpenAPI 3.0+ compatible format',
    extensions: ['.json', '.yaml'],
    supportsVariables: false,
    supportsWorkflows: false,
    icon: <File className="w-4 h-4 text-green-500" />
  },
  curl: {
    name: 'cURL Commands',
    description: 'Shell script with cURL commands',
    extensions: ['.sh'],
    supportsVariables: false,
    supportsWorkflows: false,
    icon: <FileText className="w-4 h-4 text-gray-500" />
  },
  insomnia: {
    name: 'Insomnia Collection',
    description: 'Compatible with Insomnia REST client',
    extensions: ['.json'],
    supportsVariables: true,
    supportsWorkflows: false,
    icon: <FileText className="w-4 h-4 text-purple-500" />
  }
}

export default function ImportExport({
  onClose
}: ImportExportProps) {
  // Default values for the component
  const mode: 'import' | 'export' = 'import' // Default to import mode
  const selectedCollectionIds: string[] = [] // Default to empty array
  const open = true // Component is always open when rendered
  // Import state
  const [importState, setImportState] = useState<ImportState>({
    file: null,
    format: null,
    autoDetected: false,
    validating: false,
    importing: false,
    result: null,
    preview: null,
    error: null
  })

  // Export state
  const [exportState, setExportState] = useState<ExportState>({
    format: 'truxe',
    includeVariables: true,
    includeWorkflows: true,
    minify: false,
    filename: '',
    exporting: false,
    result: null,
    error: null
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Handle file selection for import
   */
  const handleFileSelect = useCallback(async (file: File) => {
    setImportState(prev => ({
      ...prev,
      file,
      format: null,
      autoDetected: false,
      validating: true,
      preview: null,
      error: null
    }))

    try {
      // Validate file
      const validation = importExportManager.validateFile(file)
      if (!validation.valid) {
        setImportState(prev => ({
          ...prev,
          validating: false,
          error: validation.errors.join(', ')
        }))
        return
      }

      // Read file content
      const content = await file.text()
      
      // Auto-detect format
      const detectedFormat = importExportManager.detectFormat(content)
      
      // Generate preview
      let preview = null
      try {
        const parsed = JSON.parse(content)
        preview = {
          size: file.size,
          collections: parsed.collections?.length || (parsed.info ? 1 : 0),
          variables: parsed.variables?.length || parsed.variable?.length || 0,
          workflows: parsed.workflows?.length || 0,
          format: detectedFormat || 'unknown'
        }
      } catch {
        preview = {
          size: file.size,
          format: detectedFormat || 'unknown',
          isTextFile: content.includes('curl ') || content.includes('#!/bin/bash')
        }
      }

      setImportState(prev => ({
        ...prev,
        format: detectedFormat || null,
        autoDetected: !!detectedFormat,
        validating: false,
        preview
      }))

    } catch (error) {
      setImportState(prev => ({
        ...prev,
        validating: false,
        error: error instanceof Error ? error.message : 'Failed to process file'
      }))
    }
  }, [])

  /**
   * Handle import execution
   */
  const handleImport = useCallback(async () => {
    if (!importState.file || !importState.format) return

    setImportState(prev => ({ ...prev, importing: true, error: null }))

    try {
      const content = await importState.file.text()
      
      const result = await importExportManager.import(content, importState.format, {
        mergeStrategy: 'merge',
        includeVariables: true,
        includeWorkflows: true,
        validateBeforeImport: true
      })

      setImportState(prev => ({ ...prev, importing: false, result }))

      if (result.success) {
        // Refresh data in other components
        // This would trigger through events or context updates
      }

    } catch (error) {
      setImportState(prev => ({
        ...prev,
        importing: false,
        error: error instanceof Error ? error.message : 'Import failed'
      }))
    }
  }, [importState.file, importState.format])

  /**
   * Handle export execution
   */
  const handleExport = useCallback(async () => {
    if (selectedCollectionIds.length === 0) {
      setExportState(prev => ({ 
        ...prev, 
        error: 'No collections selected for export' 
      }))
      return
    }

    setExportState(prev => ({ ...prev, exporting: true, error: null }))

    try {
      const result = await importExportManager.export(selectedCollectionIds, {
        format: exportState.format,
        includeVariables: exportState.includeVariables,
        includeWorkflows: exportState.includeWorkflows,
        minify: exportState.minify,
        filename: exportState.filename || undefined
      })

      setExportState(prev => ({ ...prev, exporting: false, result }))

      // Auto-download file
      const blob = new Blob([result.data], { type: result.mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      link.click()
      URL.revokeObjectURL(url)

    } catch (error) {
      setExportState(prev => ({
        ...prev,
        exporting: false,
        error: error instanceof Error ? error.message : 'Export failed'
      }))
    }
  }, [selectedCollectionIds, exportState])

  /**
   * Reset states when modal opens/closes
   */
  React.useEffect(() => {
    if (open) {
      setImportState({
        file: null,
        format: null,
        autoDetected: false,
        validating: false,
        importing: false,
        result: null,
        preview: null,
        error: null
      })
      
      setExportState({
        format: 'truxe',
        includeVariables: true,
        includeWorkflows: true,
        minify: false,
        filename: '',
        exporting: false,
        result: null,
        error: null
      })
    }
  }, [open])

  /**
   * Render import interface
   */
  const renderImportInterface = () => (
    <div className="space-y-6">
      {/* File Upload */}
      <div>
        <h3 className="text-lg font-medium mb-4">Import Collections & Workflows</h3>
        
        <div className="border-2 border-dashed border-muted rounded-lg p-6">
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <div className="mb-4">
              <p className="text-sm font-medium">Choose a file to import</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports Truxe, Postman, OpenAPI formats
              </p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml,.sh"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
              className="hidden"
            />
            
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Select File
            </Button>
          </div>
        </div>
      </div>

      {/* File Analysis */}
      {importState.file && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">File Analysis</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">File:</span>
              <span className="text-sm font-mono">{importState.file.name}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Size:</span>
              <span className="text-sm">{(importState.file.size / 1024).toFixed(1)} KB</span>
            </div>
            
            {importState.validating && (
              <div className="flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing file...
              </div>
            )}
            
            {importState.format && (
              <div className="flex items-center justify-between">
                <span className="text-sm">Format:</span>
                <div className="flex items-center gap-2">
                  {FORMAT_INFO[importState.format].icon}
                  <span className="text-sm">{FORMAT_INFO[importState.format].name}</span>
                  {importState.autoDetected && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                      Auto-detected
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {importState.preview && (
              <div className="mt-4 p-3 bg-muted rounded">
                <h5 className="text-sm font-medium mb-2">Preview</h5>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {importState.preview.collections !== undefined && (
                    <div>Collections: {importState.preview.collections}</div>
                  )}
                  {importState.preview.variables !== undefined && (
                    <div>Variables: {importState.preview.variables}</div>
                  )}
                  {importState.preview.workflows !== undefined && (
                    <div>Workflows: {importState.preview.workflows}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Format Selection */}
      {importState.file && !importState.format && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Select Format</h4>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(FORMAT_INFO).map(([format, info]) => (
              <button
                key={format}
                onClick={() => setImportState(prev => ({ 
                  ...prev, 
                  format: format as ExportFormat 
                }))}
                className="flex items-center gap-3 p-3 border rounded hover:bg-muted text-left"
              >
                {info.icon}
                <div>
                  <div className="font-medium">{info.name}</div>
                  <div className="text-xs text-muted-foreground">{info.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Import Result */}
      {importState.result && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            {importState.result.success ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            Import Result
          </h4>
          
          {importState.result.success ? (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>Collections: {importState.result.collectionsImported}</div>
                <div>Requests: {importState.result.requestsImported}</div>
                <div>Variables: {importState.result.variablesImported}</div>
                <div>Workflows: {importState.result.workflowsImported}</div>
              </div>
              
              {importState.result.errors.length > 0 && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm font-medium text-yellow-800">Warnings:</p>
                  <ul className="text-xs text-yellow-700 list-disc list-inside mt-1">
                    {importState.result.errors.map((error, index) => (
                      <li key={index}>{error.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-red-600">Import failed</p>
              <ul className="text-xs text-red-500 list-disc list-inside">
                {importState.result.errors.map((error, index) => (
                  <li key={index}>{error.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Errors */}
      {importState.error && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Error</span>
          </div>
          <p className="text-sm text-red-600">{importState.error}</p>
        </div>
      )}
    </div>
  )

  /**
   * Render export interface
   */
  const renderExportInterface = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Export Collections & Workflows</h3>
        
        {selectedCollectionIds.length === 0 ? (
          <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
            <div className="flex items-center gap-2 text-yellow-600 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">No Collections Selected</span>
            </div>
            <p className="text-sm text-yellow-600">
              Please select one or more collections from the Collections panel to export.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg p-4 bg-muted/20">
            <p className="text-sm mb-2">
              <strong>{selectedCollectionIds.length}</strong> collection{selectedCollectionIds.length !== 1 ? 's' : ''} selected for export
            </p>
          </div>
        )}
      </div>

      {/* Export Format */}
      <div>
        <h4 className="font-medium mb-3">Export Format</h4>
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(FORMAT_INFO).map(([format, info]) => (
            <label
              key={format}
              className={`flex items-center gap-3 p-3 border rounded cursor-pointer ${
                exportState.format === format ? 'border-primary bg-primary/5' : 'hover:bg-muted'
              }`}
            >
              <input
                type="radio"
                name="export-format"
                value={format}
                checked={exportState.format === format}
                onChange={(e) => setExportState(prev => ({ 
                  ...prev, 
                  format: e.target.value as ExportFormat 
                }))}
                className="sr-only"
              />
              {info.icon}
              <div className="flex-1">
                <div className="font-medium">{info.name}</div>
                <div className="text-xs text-muted-foreground">{info.description}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Extensions: {info.extensions.join(', ')}
                </div>
              </div>
              {exportState.format === format && (
                <CheckCircle className="w-4 h-4 text-primary" />
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Export Options */}
      <div>
        <h4 className="font-medium mb-3">Export Options</h4>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportState.includeVariables}
              onChange={(e) => setExportState(prev => ({ 
                ...prev, 
                includeVariables: e.target.checked 
              }))}
              disabled={!FORMAT_INFO[exportState.format].supportsVariables}
              className="rounded"
            />
            <span className="text-sm">Include variables</span>
            {!FORMAT_INFO[exportState.format].supportsVariables && (
              <span className="text-xs text-muted-foreground">(Not supported in this format)</span>
            )}
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportState.includeWorkflows}
              onChange={(e) => setExportState(prev => ({ 
                ...prev, 
                includeWorkflows: e.target.checked 
              }))}
              disabled={!FORMAT_INFO[exportState.format].supportsWorkflows}
              className="rounded"
            />
            <span className="text-sm">Include workflows</span>
            {!FORMAT_INFO[exportState.format].supportsWorkflows && (
              <span className="text-xs text-muted-foreground">(Not supported in this format)</span>
            )}
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={exportState.minify}
              onChange={(e) => setExportState(prev => ({ 
                ...prev, 
                minify: e.target.checked 
              }))}
              className="rounded"
            />
            <span className="text-sm">Minify output</span>
          </label>
        </div>
      </div>

      {/* Custom Filename */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Custom Filename (optional)
        </label>
        <input
          type="text"
          value={exportState.filename}
          onChange={(e) => setExportState(prev => ({ 
            ...prev, 
            filename: e.target.value 
          }))}
          placeholder={`my-export${FORMAT_INFO[exportState.format].extensions[0]}`}
          className="w-full p-2 border rounded-md text-sm"
        />
      </div>

      {/* Export Result */}
      {exportState.result && (
        <div className="border rounded-lg p-4 bg-green-50">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">Export Successful</span>
          </div>
          <p className="text-sm text-green-600">
            File "{exportState.result.filename}" has been downloaded.
          </p>
          <div className="text-xs text-green-500 mt-2">
            Size: {(exportState.result.data.length / 1024).toFixed(1)} KB
          </div>
        </div>
      )}

      {/* Export Errors */}
      {exportState.error && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium">Export Error</span>
          </div>
          <p className="text-sm text-red-600">{exportState.error}</p>
        </div>
      )}
    </div>
  )

  return (
    <Modal 
      open={open} 
      onClose={onClose} 
      title={mode === 'import' ? 'Import Data' : 'Export Data'}
      size="lg"
    >
      {mode === 'import' ? renderImportInterface() : renderExportInterface()}
      
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        
        {mode === 'import' ? (
          <Button
            onClick={handleImport}
            disabled={!importState.file || !importState.format || importState.importing}
          >
            {importState.importing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleExport}
            disabled={selectedCollectionIds.length === 0 || exportState.exporting}
          >
            {exportState.exporting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export & Download
              </>
            )}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}