import { describe, it, expect } from 'vitest'
import { 
  codeGenerator,
  generateCurl,
  generateJavaScript,
  generateTypeScript,
  generatePython,
  generateGo,
  generatePHP,
  generateRust,
  generateJava,
  type RequestConfig,
  type SupportedLanguage 
} from '../../src/lib/code-generator'

describe('CodeGenerator', () => {
  const sampleRequest: RequestConfig = {
    method: 'POST',
    url: 'http://localhost:3456/auth/login',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
      'X-Custom-Header': 'custom-value'
    },
    body: { 
      email: 'test@example.com', 
      password: 'secret',
      remember: true
    },
    params: {
      redirect: '/dashboard',
      lang: 'en'
    }
  }

  const getRequest: RequestConfig = {
    method: 'GET',
    url: 'https://api.example.com/users/123',
    headers: {
      'Authorization': 'Bearer test-token',
      'Accept': 'application/json'
    },
    params: {
      include: 'profile,settings',
      format: 'json'
    }
  }

  describe('Core CodeGenerator class', () => {
    it('should generate code for all supported languages', () => {
      const allCode = codeGenerator.generateAll(sampleRequest)
      
      expect(Object.keys(allCode)).toHaveLength(8)
      expect(allCode.curl).toBeDefined()
      expect(allCode.javascript).toBeDefined()
      expect(allCode.typescript).toBeDefined()
      expect(allCode.python).toBeDefined()
      expect(allCode.go).toBeDefined()
      expect(allCode.php).toBeDefined()
      expect(allCode.rust).toBeDefined()
      expect(allCode.java).toBeDefined()
    })

    it('should generate code for specific language', () => {
      const code = codeGenerator.generate(sampleRequest, 'curl')
      
      expect(code.language).toBe('curl')
      expect(code.code).toContain("curl -X POST")
      expect(code.filename).toBe('request.sh')
      expect(code.extension).toBe('sh')
    })

    it('should throw error for unsupported language', () => {
      expect(() => {
        codeGenerator.generate(sampleRequest, 'unsupported' as SupportedLanguage)
      }).toThrow('Unsupported language: unsupported')
    })

    it('should return list of supported languages', () => {
      const languages = codeGenerator.getSupportedLanguages()
      
      expect(languages).toContain('curl')
      expect(languages).toContain('javascript')
      expect(languages).toContain('typescript')
      expect(languages).toContain('python')
      expect(languages).toContain('go')
      expect(languages).toContain('php')
      expect(languages).toContain('rust')
      expect(languages).toContain('java')
      expect(languages).toHaveLength(8)
    })

    it('should clean request config properly', () => {
      const dirtyRequest: RequestConfig = {
        method: '',
        url: '',
        headers: {
          'Valid-Header': 'value',
          'Empty-Header': '',
          '': 'no-key',
          'Whitespace-Header': '  trimmed  '
        },
        params: {
          'valid': 'param',
          '': 'no-key',
          'empty': ''
        }
      }

      const code = codeGenerator.generate(dirtyRequest, 'curl')
      expect(code.code).toContain('Valid-Header')
      expect(code.code).not.toContain('Empty-Header')
      expect(code.code).toContain('trimmed')
    })
  })

  describe('cURL generation', () => {
    it('should generate valid cURL command for POST request', () => {
      const code = generateCurl(sampleRequest)

      expect(code.code).toContain("curl -X POST")
      expect(code.code).toContain("'http://localhost:3456/auth/login?redirect=%2Fdashboard&lang=en'")
      expect(code.code).toContain("-H 'Content-Type: application/json'")
      expect(code.code).toContain("-H 'Authorization: Bearer test-token'")
      expect(code.code).toContain("-H 'X-Custom-Header: custom-value'")
      expect(code.code).toContain('-d ')
      expect(code.code).toContain('"email":"test@example.com"')
      expect(code.filename).toBe('request.sh')
    })

    it('should handle GET requests without body', () => {
      const code = generateCurl(getRequest)

      expect(code.code).toContain("curl -X GET")
      expect(code.code).toContain('include=profile%2Csettings')
      expect(code.code).not.toContain('-d')
    })

    it('should properly escape shell special characters', () => {
      const requestWithSpecialChars: RequestConfig = {
        method: 'POST',
        url: "http://example.com/test'with'quotes",
        headers: {
          'X-Test': "value'with'quotes"
        },
        body: { message: "Hello 'world'" }
      }

      const code = generateCurl(requestWithSpecialChars)
      expect(code.code).toContain("\\'")
      expect(code.code).not.toContain("'value'with'quotes'")
    })
  })

  describe('JavaScript generation', () => {
    it('should generate valid fetch code for POST request', () => {
      const code = generateJavaScript(sampleRequest)

      expect(code.code).toContain('await fetch(')
      expect(code.code).toContain("method: 'POST'")
      expect(code.code).toContain('body: JSON.stringify(')
      expect(code.code).toContain('if (!response.ok)')
      expect(code.code).toContain('response.json()')
      expect(code.code).toContain('"Authorization": "Bearer test-token"')
      expect(code.filename).toBe('request.js')
    })

    it('should handle GET requests without body', () => {
      const code = generateJavaScript(getRequest)

      expect(code.code).toContain('await fetch(')
      expect(code.code).toContain("method: 'GET'")
      expect(code.code).not.toContain('body:')
      expect(code.code).toContain('include=profile%2Csettings')
    })

    it('should respect options for error handling', () => {
      const codeWithoutError = generateJavaScript(sampleRequest, { includeErrorHandling: false })
      expect(codeWithoutError.code).not.toContain('if (!response.ok)')

      const codeWithError = generateJavaScript(sampleRequest, { includeErrorHandling: true })
      expect(codeWithError.code).toContain('if (!response.ok)')
    })

    it('should respect options for comments', () => {
      const codeWithoutComments = generateJavaScript(sampleRequest, { includeComments: false })
      expect(codeWithoutComments.code).not.toContain('// API request to')

      const codeWithComments = generateJavaScript(sampleRequest, { includeComments: true })
      expect(codeWithComments.code).toContain('// API request to')
    })
  })

  describe('TypeScript generation', () => {
    it('should generate valid TypeScript code with types', () => {
      const code = generateTypeScript(sampleRequest)

      expect(code.code).toContain('interface ApiResponse')
      expect(code.code).toContain(': ApiResponse')
      expect(code.code).toContain('await fetch(')
      expect(code.filename).toBe('request.ts')
    })

    it('should respect includeTypes option', () => {
      const codeWithoutTypes = generateTypeScript(sampleRequest, { includeTypes: false })
      expect(codeWithoutTypes.code).not.toContain('interface ApiResponse')
      expect(codeWithoutTypes.code).not.toContain(': ApiResponse')

      const codeWithTypes = generateTypeScript(sampleRequest, { includeTypes: true })
      expect(codeWithTypes.code).toContain('interface ApiResponse')
    })
  })

  describe('Python generation', () => {
    it('should generate valid requests code for POST request', () => {
      const code = generatePython(sampleRequest)

      expect(code.code).toContain('import requests')
      expect(code.code).toContain('requests.post(')
      expect(code.code).toContain("'http://localhost:3456/auth/login'")
      expect(code.code).toContain('headers=')
      expect(code.code).toContain('params=')
      expect(code.code).toContain('json=')
      expect(code.code).toContain('response.raise_for_status()')
      expect(code.code).toContain("'Authorization': 'Bearer test-token'")
      expect(code.filename).toBe('request.py')
    })

    it('should handle GET requests properly', () => {
      const code = generatePython(getRequest)

      expect(code.code).toContain('requests.get(')
      expect(code.code).not.toContain('json=')
      expect(code.code).toContain('params=')
    })
  })

  describe('Go generation', () => {
    it('should generate valid Go code for POST request', () => {
      const code = generateGo(sampleRequest)

      expect(code.code).toContain('package main')
      expect(code.code).toContain('import (')
      expect(code.code).toContain('"net/http"')
      expect(code.code).toContain('http.NewRequest("POST"')
      expect(code.code).toContain('req.Header.Set(')
      expect(code.code).toContain('bytes.NewBuffer(payload)')
      expect(code.code).toContain('client.Do(req)')
      expect(code.filename).toBe('request.go')
    })

    it('should handle GET requests without body', () => {
      const code = generateGo(getRequest)

      expect(code.code).toContain('http.NewRequest("GET"')
      expect(code.code).not.toContain('bytes.NewBuffer')
      expect(code.code).not.toContain('payload :=')
    })
  })

  describe('PHP generation', () => {
    it('should generate valid PHP cURL code', () => {
      const code = generatePHP(sampleRequest)

      expect(code.code).toContain('<?php')
      expect(code.code).toContain('curl_init()')
      expect(code.code).toContain("CURLOPT_CUSTOMREQUEST, 'POST'")
      expect(code.code).toContain('CURLOPT_HTTPHEADER')
      expect(code.code).toContain('CURLOPT_POSTFIELDS')
      expect(code.code).toContain('curl_exec($ch)')
      expect(code.code).toContain('curl_close($ch)')
      expect(code.filename).toBe('request.php')
    })

    it('should handle GET requests', () => {
      const code = generatePHP(getRequest)

      expect(code.code).toContain("CURLOPT_CUSTOMREQUEST, 'GET'")
      expect(code.code).not.toContain('CURLOPT_POSTFIELDS')
    })
  })

  describe('Rust generation', () => {
    it('should generate valid Rust code', () => {
      const code = generateRust(sampleRequest)

      expect(code.code).toContain('use reqwest;')
      expect(code.code).toContain('use serde_json::Value;')
      expect(code.code).toContain('#[tokio::main]')
      expect(code.code).toContain('reqwest::Client::new()')
      expect(code.code).toContain('.post(')
      expect(code.code).toContain('.headers(headers)')
      expect(code.code).toContain('.json(&serde_json::json!')
      expect(code.filename).toBe('request.rs')
    })

    it('should handle GET requests', () => {
      const code = generateRust(getRequest)

      expect(code.code).toContain('.get(')
      expect(code.code).not.toContain('.json(&serde_json::json!')
    })
  })

  describe('Java generation', () => {
    it('should generate valid Java code', () => {
      const code = generateJava(sampleRequest)

      expect(code.code).toContain('import okhttp3.*;')
      expect(code.code).toContain('public class ApiRequest')
      expect(code.code).toContain('OkHttpClient client')
      expect(code.code).toContain('.post(RequestBody.create(')
      expect(code.code).toContain('MediaType.parse("application/json")')
      expect(code.code).toContain('.addHeader(')
      expect(code.filename).toBe('ApiRequest.java')
    })

    it('should handle GET requests', () => {
      const code = generateJava(getRequest)

      expect(code.code).toContain('.get();')
      expect(code.code).not.toContain('RequestBody.create(')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle empty request config', () => {
      const emptyRequest: RequestConfig = {
        method: '',
        url: '',
        headers: {},
      }

      const code = codeGenerator.generate(emptyRequest, 'curl')
      expect(code.code).toContain('curl -X GET')
      expect(code.code).toContain("''")
    })

    it('should handle request with no headers', () => {
      const requestNoHeaders: RequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {}
      }

      const code = codeGenerator.generate(requestNoHeaders, 'javascript')
      expect(code.code).toContain('headers: {}')
    })

    it('should handle request with invalid JSON body', () => {
      const requestInvalidJson: RequestConfig = {
        method: 'POST',
        url: 'https://api.example.com/test',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json string'
      }

      const code = codeGenerator.generate(requestInvalidJson, 'javascript')
      expect(code.code).toContain('body: JSON.stringify("invalid json string")')
    })

    it('should handle special characters in URLs and headers', () => {
      const specialRequest: RequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/search',
        headers: {
          'X-Test-Header': 'value with spaces',
          'Authorization': 'Bearer token-with-special-chars!'
        },
        params: {
          'q': 'hello world',
          'type': 'user'
        }
      }

      const curlCode = codeGenerator.generate(specialRequest, 'curl')
      // URLSearchParams encodes spaces as '+' 
      expect(curlCode.code).toContain('hello+world')
      
      const jsCode = codeGenerator.generate(specialRequest, 'javascript')
      expect(jsCode.code).toContain('hello+world')
    })

    it('should generate unique filenames for each language', () => {
      const allCode = codeGenerator.generateAll(sampleRequest)
      
      const filenames = Object.values(allCode).map(c => c.filename)
      const uniqueFilenames = [...new Set(filenames)]
      
      expect(filenames.length).toBe(uniqueFilenames.length)
    })
  })

  describe('File metadata', () => {
    it('should provide correct filename and extension for each language', () => {
      const expectedFiles = {
        curl: { filename: 'request.sh', extension: 'sh' },
        javascript: { filename: 'request.js', extension: 'js' },
        typescript: { filename: 'request.ts', extension: 'ts' },
        python: { filename: 'request.py', extension: 'py' },
        go: { filename: 'request.go', extension: 'go' },
        php: { filename: 'request.php', extension: 'php' },
        rust: { filename: 'request.rs', extension: 'rs' },
        java: { filename: 'ApiRequest.java', extension: 'java' }
      }

      Object.entries(expectedFiles).forEach(([lang, expected]) => {
        const code = codeGenerator.generate(sampleRequest, lang as SupportedLanguage)
        expect(code.filename).toBe(expected.filename)
        expect(code.extension).toBe(expected.extension)
        expect(code.language).toBe(lang)
      })
    })
  })
})