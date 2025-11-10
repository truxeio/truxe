import { useState } from 'react'
import { Copy, Download, Check } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/Button'
import { codeGenerator, type SupportedLanguage, type RequestConfig } from '@/lib/code-generator'

interface CodeGeneratorProps {
  request: RequestConfig
}

interface LanguageOption {
  id: SupportedLanguage
  label: string
  icon: string
  description: string
}

const LANGUAGES: LanguageOption[] = [
  { 
    id: 'curl', 
    label: 'cURL', 
    icon: '🔧',
    description: 'Command line tool for HTTP requests'
  },
  { 
    id: 'javascript', 
    label: 'JavaScript', 
    icon: '🟨',
    description: 'Modern fetch API'
  },
  { 
    id: 'typescript', 
    label: 'TypeScript', 
    icon: '🔷',
    description: 'Typed JavaScript with interfaces'
  },
  { 
    id: 'python', 
    label: 'Python', 
    icon: '🐍',
    description: 'Using requests library'
  },
  { 
    id: 'go', 
    label: 'Go', 
    icon: '🔵',
    description: 'Native net/http package'
  },
  { 
    id: 'php', 
    label: 'PHP', 
    icon: '🐘',
    description: 'Using cURL extension'
  },
  { 
    id: 'rust', 
    label: 'Rust', 
    icon: '🦀',
    description: 'Using reqwest crate'
  },
  { 
    id: 'java', 
    label: 'Java', 
    icon: '☕',
    description: 'Using OkHttp library'
  },
]

function getMonacoLanguage(lang: SupportedLanguage): string {
  const mapping: Record<SupportedLanguage, string> = {
    curl: 'shell',
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    go: 'go',
    php: 'php',
    rust: 'rust',
    java: 'java',
  }
  return mapping[lang] || 'text'
}

export default function CodeGenerator({ request }: CodeGeneratorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('curl')
  const [copied, setCopied] = useState(false)

  // Generate code for selected language
  const generatedCode = codeGenerator.generate(request, selectedLanguage, {
    includeComments: true,
    includeErrorHandling: true,
    useAsync: true,
    includeTypes: selectedLanguage === 'typescript'
  })

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      // Fallback: Create a temporary textarea
      const textarea = document.createElement('textarea')
      textarea.value = generatedCode.code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([generatedCode.code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = generatedCode.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header with language selector and actions */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-3">
            Language:
          </span>
          {LANGUAGES.map((lang) => (
            <Button
              key={lang.id}
              variant={selectedLanguage === lang.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLanguage(lang.id)}
              className="min-w-0"
              title={lang.description}
            >
              <span className="mr-1.5 text-sm">{lang.icon}</span>
              <span className="hidden sm:inline">{lang.label}</span>
            </Button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="min-w-[80px]"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1.5" />
                Copy
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        </div>
      </div>

      {/* Language info */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{LANGUAGES.find(l => l.id === selectedLanguage)?.icon}</span>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {LANGUAGES.find(l => l.id === selectedLanguage)?.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {LANGUAGES.find(l => l.id === selectedLanguage)?.description}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {generatedCode.filename}
          </div>
        </div>
      </div>

      {/* Code editor */}
      <div className="flex-1 min-h-0">
        <Editor
          language={getMonacoLanguage(selectedLanguage)}
          value={generatedCode.code}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            folding: false,
            glyphMargin: false,
            contextmenu: false,
            selectOnLineNumbers: true,
            renderLineHighlight: 'none',
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            padding: { top: 16, bottom: 16 },
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
          }
        />
      </div>

      {/* Footer with helpful info */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div>
            Ready to copy - all authentication headers included
          </div>
          <div>
            {generatedCode.code.split('\\n').length} lines
          </div>
        </div>
      </div>
    </div>
  )
}

// Export for potential reuse
export { CodeGenerator, type LanguageOption }