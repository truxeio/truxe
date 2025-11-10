import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CodeGenerator from '../../src/components/CodeGenerator'
import { type RequestConfig } from '../../src/lib/code-generator'

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language, onChange }: any) => (
    <textarea
      data-testid={`monaco-editor-${language}`}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      readOnly
    />
  )
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve(''))
  }
})

describe('CodeGenerator Component', () => {
  const mockRequest: RequestConfig = {
    method: 'POST',
    url: 'http://localhost:3456/auth/login',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: {
      email: 'test@example.com',
      password: 'secret123'
    },
    params: {
      redirect: '/dashboard'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset clipboard mock
    if (navigator.clipboard?.writeText) {
      vi.mocked(navigator.clipboard.writeText).mockClear()
    }
  })

  it('should render with default cURL selection', () => {
    render(<CodeGenerator request={mockRequest} />)

    expect(screen.getByText('cURL')).toBeInTheDocument()
    expect(screen.getByTestId('monaco-editor-shell')).toBeInTheDocument()
    expect(screen.getByText('Command line tool for HTTP requests')).toBeInTheDocument()
  })

  it('should display all supported languages', () => {
    render(<CodeGenerator request={mockRequest} />)

    const expectedLanguages = [
      'cURL', 'JavaScript', 'TypeScript', 'Python', 'Go', 'PHP', 'Rust', 'Java'
    ]

    // Check that all language buttons are rendered
    const languageButtons = screen.getAllByRole('button').filter(button => 
      expectedLanguages.some(lang => button.textContent?.includes(lang))
    )
    
    expect(languageButtons).toHaveLength(expectedLanguages.length)
  })

  it('should switch languages when language button is clicked', async () => {
    render(<CodeGenerator request={mockRequest} />)

    // Initially should show cURL
    expect(screen.getByTestId('monaco-editor-shell')).toBeInTheDocument()

    // Click JavaScript button
    const jsButton = screen.getByRole('button', { name: /JavaScript/i })
    fireEvent.click(jsButton)

    // Should now show JavaScript editor
    expect(screen.getByTestId('monaco-editor-javascript')).toBeInTheDocument()
    expect(screen.getByText('Modern fetch API')).toBeInTheDocument()
  })

  it('should show correct file information for each language', () => {
    render(<CodeGenerator request={mockRequest} />)

    // Test different languages and their expected file extensions
    const languageTests = [
      { button: 'cURL', filename: 'request.sh' },
      { button: 'JavaScript', filename: 'request.js' },
      { button: 'TypeScript', filename: 'request.ts' },
      { button: 'Python', filename: 'request.py' },
      { button: 'Go', filename: 'request.go' },
      { button: 'PHP', filename: 'request.php' },
      { button: 'Rust', filename: 'request.rs' },
      { button: 'Java', filename: 'ApiRequest.java' }
    ]

    for (const test of languageTests) {
      const button = screen.getByRole('button', { name: new RegExp(test.button, 'i') })
      fireEvent.click(button)
      expect(screen.getByText(test.filename)).toBeInTheDocument()
    }
  })

  it('should copy code to clipboard when copy button is clicked', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    navigator.clipboard = { writeText: mockWriteText } as any

    render(<CodeGenerator request={mockRequest} />)

    const copyButton = screen.getByRole('button', { name: /Copy/i })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled()
    })
    
    const copiedText = mockWriteText.mock.calls[0][0]
    expect(copiedText).toContain('curl -X POST')
  })

  it('should show "Copied!" feedback after successful copy', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    navigator.clipboard = { writeText: mockWriteText } as any

    render(<CodeGenerator request={mockRequest} />)

    const copyButton = screen.getByRole('button', { name: /Copy/i })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })

  it('should download file when download button is clicked', () => {
    // Mock URL.createObjectURL and related APIs
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
    const mockRevokeObjectURL = vi.fn()
    const mockClick = vi.fn()
    
    Object.assign(URL, {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL
    })
    
    // Mock createElement to return a mock anchor element
    const mockAnchor = {
      href: '',
      download: '',
      click: mockClick
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)

    render(<CodeGenerator request={mockRequest} />)

    const downloadButton = screen.getByRole('button', { name: /Download/i })
    fireEvent.click(downloadButton)

    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockAnchor.download).toBe('request.sh')
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalled()
  })

  it('should update generated code when request changes', () => {
    const { rerender } = render(<CodeGenerator request={mockRequest} />)

    // Initial render should contain the original request data
    expect(screen.getByTestId('monaco-editor-shell')).toHaveTextContent('curl -X POST')

    // Update request
    const updatedRequest: RequestConfig = {
      ...mockRequest,
      method: 'GET',
      body: undefined
    }

    rerender(<CodeGenerator request={updatedRequest} />)

    // Should now show GET method
    expect(screen.getByTestId('monaco-editor-shell')).toHaveTextContent('curl -X GET')
  })

  it('should show correct line count in footer', () => {
    render(<CodeGenerator request={mockRequest} />)

    // Check that line count is displayed
    expect(screen.getByText(/\d+ lines/)).toBeInTheDocument()
  })

  it('should handle empty request gracefully', () => {
    const emptyRequest: RequestConfig = {
      method: '',
      url: '',
      headers: {}
    }

    render(<CodeGenerator request={emptyRequest} />)

    // Should still render without errors
    expect(screen.getByRole('button', { name: /cURL/i })).toBeInTheDocument()
    expect(screen.getByTestId('monaco-editor-shell')).toBeInTheDocument()
  })

  it('should show language descriptions on hover/focus', () => {
    render(<CodeGenerator request={mockRequest} />)

    const jsButton = screen.getByRole('button', { name: /JavaScript/i })
    
    // Should show description (via title attribute)
    expect(jsButton).toHaveAttribute('title', 'Modern fetch API')
  })

  it('should handle special characters in request data', () => {
    const specialRequest: RequestConfig = {
      method: 'POST',
      url: 'https://api.example.com/test',
      headers: {
        'X-Special': 'value with "quotes" and \\backslashes\\',
        'Content-Type': 'application/json'
      },
      body: {
        message: 'Hello "world" with \\special\\ chars',
        data: 'Line 1\\nLine 2'
      }
    }

    render(<CodeGenerator request={specialRequest} />)

    // Should render without errors
    expect(screen.getByTestId('monaco-editor-shell')).toBeInTheDocument()
  })

  it('should maintain language selection after request updates', () => {
    const { rerender } = render(<CodeGenerator request={mockRequest} />)

    // Switch to Python
    const pythonButton = screen.getByRole('button', { name: /Python/i })
    fireEvent.click(pythonButton)
    expect(screen.getByTestId('monaco-editor-python')).toBeInTheDocument()

    // Update request
    const updatedRequest = { ...mockRequest, url: 'https://api.different.com/endpoint' }
    rerender(<CodeGenerator request={updatedRequest} />)

    // Should still be showing Python
    expect(screen.getByTestId('monaco-editor-python')).toBeInTheDocument()
  })

  it('should show authentication headers info in footer', () => {
    render(<CodeGenerator request={mockRequest} />)

    expect(screen.getByText('Ready to copy - all authentication headers included')).toBeInTheDocument()
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<CodeGenerator request={mockRequest} />)

      // Language buttons should be focusable
      const curlButton = screen.getByRole('button', { name: /cURL/i })
      expect(curlButton).toHaveAttribute('type', 'button')

      // Copy and download buttons should have descriptive text
      expect(screen.getByText('Copy')).toBeInTheDocument()
      expect(screen.getByText('Download')).toBeInTheDocument()
    })

    it('should support keyboard navigation between language buttons', () => {
      render(<CodeGenerator request={mockRequest} />)

      const curlButton = screen.getByRole('button', { name: /cURL/i })
      const jsButton = screen.getByRole('button', { name: /JavaScript/i })

      // Buttons should be focusable
      expect(curlButton).toBeInTheDocument()
      expect(jsButton).toBeInTheDocument()
      
      // Test focus behavior
      curlButton.focus()
      expect(curlButton).toHaveFocus()
    })
  })
})