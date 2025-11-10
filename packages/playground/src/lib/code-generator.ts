export interface RequestConfig {
  method: string
  url: string
  headers: Record<string, string>
  body?: any
  params?: Record<string, string>
}

export interface GeneratedCode {
  language: string
  code: string
  filename: string
  extension: string
}

export type SupportedLanguage =
  | 'curl'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'php'
  | 'rust'
  | 'java'

export interface CodeGenerationOptions {
  includeComments?: boolean
  includeErrorHandling?: boolean
  useAsync?: boolean // For JS/TS
  includeTypes?: boolean // For TS
}

/**
 * Escapes shell special characters for safe usage in curl commands
 */
function escapeShellArg(arg: string): string {
  // Replace single quotes with '\'' and wrap in single quotes
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

/**
 * Escapes JSON strings for safe usage in code
 */
function escapeJsonString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/**
 * Converts headers object to string representation for different languages
 */
function formatHeaders(headers: Record<string, string>, language: SupportedLanguage): string {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return JSON.stringify(headers, null, 2)
    
    case 'python':
      return JSON.stringify(headers, null, 2).replace(/"/g, "'")
    
    case 'go':
      return Object.entries(headers)
        .map(([key, value]) => `  req.Header.Set("${escapeJsonString(key)}", "${escapeJsonString(value)}")`)
        .join('\n')
    
    case 'php':
      return Object.entries(headers)
        .map(([key, value]) => `    '${escapeJsonString(key)}: ${escapeJsonString(value)}'`)
        .join(',\n')
    
    default:
      return JSON.stringify(headers, null, 2)
  }
}

/**
 * Generate cURL command
 */
function generateCurl(config: RequestConfig): GeneratedCode {
  const { method, url, headers, body, params } = config

  // Build query string
  const queryString = params && Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : ''

  let curl = `curl -X ${method.toUpperCase()} ${escapeShellArg(url + queryString)}`

  // Add headers
  Object.entries(headers).forEach(([key, value]) => {
    if (value && value.trim()) {
      curl += ` \\\n  -H ${escapeShellArg(`${key}: ${value}`)}`
    }
  })

  // Add body for POST/PUT/PATCH
  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
    curl += ` \\\n  -d ${escapeShellArg(bodyStr)}`
  }

  return {
    language: 'curl',
    code: curl,
    filename: 'request.sh',
    extension: 'sh'
  }
}

/**
 * Generate JavaScript fetch code
 */
function generateJavaScript(config: RequestConfig, options: CodeGenerationOptions = {}): GeneratedCode {
  const { method, url, headers, body, params } = config
  const { includeComments = true, includeErrorHandling = true } = options

  const queryString = params && Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : ''

  const headersCode = formatHeaders(headers, 'javascript')
  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())
  const bodyCode = hasBody ? `,\n  body: JSON.stringify(${JSON.stringify(body, null, 2)})` : ''

  let code = ''

  if (includeComments) {
    code += `// API request to ${url}\n`
  }

  code += `const response = await fetch('${url}${queryString}', {
  method: '${method.toUpperCase()}',
  headers: ${headersCode}${bodyCode}
});`

  if (includeErrorHandling) {
    code += `

if (!response.ok) {
  throw new Error(\`HTTP error! status: \${response.status}\`);
}

const data = await response.json();
console.log(data);`
  } else {
    code += `

const data = await response.json();
console.log(data);`
  }

  return {
    language: 'javascript',
    code,
    filename: 'request.js',
    extension: 'js'
  }
}

/**
 * Generate TypeScript fetch code with types
 */
function generateTypeScript(config: RequestConfig, options: CodeGenerationOptions = {}): GeneratedCode {
  const { method, url, headers, body, params } = config
  const { includeComments = true, includeErrorHandling = true, includeTypes = true } = options

  const queryString = params && Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : ''

  const headersCode = formatHeaders(headers, 'typescript')
  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())
  const bodyCode = hasBody ? `,\n  body: JSON.stringify(${JSON.stringify(body, null, 2)})` : ''

  let code = ''

  if (includeTypes) {
    code += `// Response type - customize based on your API
interface ApiResponse {
  [key: string]: any;
}

`
  }

  if (includeComments) {
    code += `// API request to ${url}\n`
  }

  const responseType = includeTypes ? ': ApiResponse' : ''

  code += `const response = await fetch('${url}${queryString}', {
  method: '${method.toUpperCase()}',
  headers: ${headersCode}${bodyCode}
});`

  if (includeErrorHandling) {
    code += `

if (!response.ok) {
  throw new Error(\`HTTP error! status: \${response.status}\`);
}

const data${responseType} = await response.json();
console.log(data);`
  } else {
    code += `

const data${responseType} = await response.json();
console.log(data);`
  }

  return {
    language: 'typescript',
    code,
    filename: 'request.ts',
    extension: 'ts'
  }
}

/**
 * Generate Python requests code
 */
function generatePython(config: RequestConfig, options: CodeGenerationOptions = {}): GeneratedCode {
  const { method, url, headers, body, params } = config
  const { includeComments = true, includeErrorHandling = true } = options

  const headersCode = formatHeaders(headers, 'python')

  const paramsCode = params && Object.keys(params).length > 0
    ? `,\n    params=${JSON.stringify(params, null, 2).replace(/"/g, "'")}`
    : ''

  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())
  const jsonCode = hasBody
    ? `,\n    json=${JSON.stringify(body, null, 2).replace(/"/g, "'")}`
    : ''

  let code = 'import requests\n\n'

  if (includeComments) {
    code += `# API request to ${url}\n`
  }

  code += `response = requests.${method.toLowerCase()}(
    '${url}',
    headers=${headersCode}${paramsCode}${jsonCode}
)`

  if (includeErrorHandling) {
    code += `

response.raise_for_status()
data = response.json()
print(data)`
  } else {
    code += `

data = response.json()
print(data)`
  }

  return {
    language: 'python',
    code,
    filename: 'request.py',
    extension: 'py'
  }
}

/**
 * Generate Go net/http code
 */
function generateGo(config: RequestConfig, options: CodeGenerationOptions = {}): GeneratedCode {
  const { method, url, headers, body, params } = config
  const { includeComments = true, includeErrorHandling = true } = options

  const queryString = params && Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : ''

  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())
  const bodyCode = hasBody
    ? `
  payload := []byte(\`${JSON.stringify(body, null, 2)}\`)
  req, err := http.NewRequest("${method.toUpperCase()}", "${url}${queryString}", bytes.NewBuffer(payload))`
    : `
  req, err := http.NewRequest("${method.toUpperCase()}", "${url}${queryString}", nil)`

  const headersCode = formatHeaders(headers, 'go')

  let code = `package main

import (`

  if (hasBody) {
    code += `
  "bytes"`
  }

  code += `
  "encoding/json"
  "fmt"
  "io"
  "net/http"
)

func main() {`

  if (includeComments) {
    code += `
  // API request to ${url}`
  }

  code += bodyCode

  if (includeErrorHandling) {
    code += `
  if err != nil {
    panic(err)
  }`
  }

  if (headersCode) {
    code += `

${headersCode}`
  }

  code += `

  client := &http.Client{}
  resp, err := client.Do(req)`

  if (includeErrorHandling) {
    code += `
  if err != nil {
    panic(err)
  }
  defer resp.Body.Close()

  body, err := io.ReadAll(resp.Body)
  if err != nil {
    panic(err)
  }

  var result map[string]interface{}
  json.Unmarshal(body, &result)
  fmt.Printf("%+v\\n", result)`
  } else {
    code += `
  defer resp.Body.Close()

  body, err := io.ReadAll(resp.Body)
  var result map[string]interface{}
  json.Unmarshal(body, &result)
  fmt.Printf("%+v\\n", result)`
  }

  code += `
}`

  return {
    language: 'go',
    code,
    filename: 'request.go',
    extension: 'go'
  }
}

/**
 * Generate PHP cURL code
 */
function generatePHP(config: RequestConfig, options: CodeGenerationOptions = {}): GeneratedCode {
  const { method, url, headers, body, params } = config
  const { includeComments = true, includeErrorHandling = true } = options

  const queryString = params && Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : ''

  const headersArray = formatHeaders(headers, 'php')

  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())
  const bodyCode = hasBody
    ? `curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(${JSON.stringify(body, null, 2)}));\n`
    : ''

  let code = '<?php\n\n'

  if (includeComments) {
    code += `// API request to ${url}\n`
  }

  code += `$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, '${url}${queryString}');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method.toUpperCase()}');`

  if (headersArray) {
    code += `
curl_setopt($ch, CURLOPT_HTTPHEADER, [
${headersArray}
]);`
  }

  if (bodyCode) {
    code += `\n${bodyCode}`
  }

  code += `
$response = curl_exec($ch);`

  if (includeErrorHandling) {
    code += `

if (curl_errno($ch)) {
    echo 'Error: ' . curl_error($ch);
    exit;
}

curl_close($ch);

$data = json_decode($response, true);
print_r($data);`
  } else {
    code += `

curl_close($ch);

$data = json_decode($response, true);
print_r($data);`
  }

  return {
    language: 'php',
    code,
    filename: 'request.php',
    extension: 'php'
  }
}

/**
 * Generate Rust reqwest code
 */
function generateRust(config: RequestConfig, options: CodeGenerationOptions = {}): GeneratedCode {
  const { method, url, headers, body, params } = config
  const { includeComments = true, includeErrorHandling = true } = options

  const queryString = params && Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : ''

  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())

  let code = `use reqwest;
use serde_json::Value;
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {`

  if (includeComments) {
    code += `
    // API request to ${url}`
  }

  code += `
    let client = reqwest::Client::new();
    
    let mut headers = reqwest::header::HeaderMap::new();`

  // Add headers
  Object.entries(headers).forEach(([key, value]) => {
    if (value && value.trim()) {
      code += `
    headers.insert("${key.toLowerCase()}", "${escapeJsonString(value)}".parse()?);`
    }
  })

  code += `
    
    let mut request = client.${method.toLowerCase()}("${url}${queryString}")
        .headers(headers)`

  // Add query parameters
  if (params && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([key, value]) => {
      code += `
        .query(&[("${escapeJsonString(key)}", "${escapeJsonString(value)}")])`
    })
  }

  // Add body
  if (hasBody) {
    code += `
        .json(&serde_json::json!(${JSON.stringify(body, null, 2)}))`
  }

  code += `;
    
    let response = request.send().await?;`

  if (includeErrorHandling) {
    code += `
    
    if !response.status().is_success() {
        eprintln!("HTTP error! status: {}", response.status());
        return Ok(());
    }
    
    let data: Value = response.json().await?;
    println!("{:#}", data);
    
    Ok(())
}`
  } else {
    code += `
    
    let data: Value = response.json().await?;
    println!("{:#}", data);
    
    Ok(())
}`
  }

  return {
    language: 'rust',
    code,
    filename: 'request.rs',
    extension: 'rs'
  }
}

/**
 * Generate Java OkHttp code
 */
function generateJava(config: RequestConfig, options: CodeGenerationOptions = {}): GeneratedCode {
  const { method, url, headers, body, params } = config
  const { includeComments = true, includeErrorHandling = true } = options

  const queryString = params && Object.keys(params).length > 0
    ? '?' + new URLSearchParams(params).toString()
    : ''

  const hasBody = body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())

  let code = `import okhttp3.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;

public class ApiRequest {
    public static void main(String[] args) throws IOException {`

  if (includeComments) {
    code += `
        // API request to ${url}`
  }

  code += `
        OkHttpClient client = new OkHttpClient();
        
        Request.Builder requestBuilder = new Request.Builder()
            .url("${url}${queryString}")`

  // Add headers
  Object.entries(headers).forEach(([key, value]) => {
    if (value && value.trim()) {
      code += `
            .addHeader("${escapeJsonString(key)}", "${escapeJsonString(value)}")`
    }
  })

  // Add body and method
  if (hasBody) {
    code += `
            .${method.toLowerCase()}(RequestBody.create(
                MediaType.parse("application/json"), 
                "${escapeJsonString(JSON.stringify(body))}"
            ));`
  } else {
    code += `
            .${method.toLowerCase()}();`
  }

  code += `
        
        Request request = requestBuilder.build();
        
        try (Response response = client.newCall(request).execute()) {`

  if (includeErrorHandling) {
    code += `
            if (!response.isSuccessful()) {
                throw new IOException("HTTP error! status: " + response.code());
            }
            
            String responseBody = response.body().string();
            System.out.println(responseBody);
        }
    }
}`
  } else {
    code += `
            String responseBody = response.body().string();
            System.out.println(responseBody);
        }
    }
}`
  }

  return {
    language: 'java',
    code,
    filename: 'ApiRequest.java',
    extension: 'java'
  }
}

/**
 * Main CodeGenerator class
 */
class CodeGenerator {
  private generators: Record<SupportedLanguage, (config: RequestConfig, options?: CodeGenerationOptions) => GeneratedCode> = {
    curl: generateCurl,
    javascript: generateJavaScript,
    typescript: generateTypeScript,
    python: generatePython,
    go: generateGo,
    php: generatePHP,
    rust: generateRust,
    java: generateJava,
  }

  /**
   * Generate code for specific language
   */
  generate(config: RequestConfig, language: SupportedLanguage, options?: CodeGenerationOptions): GeneratedCode {
    const generator = this.generators[language]
    if (!generator) {
      throw new Error(`Unsupported language: ${language}`)
    }

    // Clean up the config
    const cleanConfig = this.cleanRequestConfig(config)
    return generator(cleanConfig, options)
  }

  /**
   * Generate code for all languages
   */
  generateAll(config: RequestConfig, options?: CodeGenerationOptions): Record<SupportedLanguage, GeneratedCode> {
    const cleanConfig = this.cleanRequestConfig(config)
    const result: Record<SupportedLanguage, GeneratedCode> = {} as Record<SupportedLanguage, GeneratedCode>

    Object.keys(this.generators).forEach((language) => {
      const lang = language as SupportedLanguage
      result[lang] = this.generate(cleanConfig, lang, options)
    })

    return result
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return Object.keys(this.generators) as SupportedLanguage[]
  }

  /**
   * Clean and validate request config
   */
  private cleanRequestConfig(config: RequestConfig): RequestConfig {
    return {
      method: config.method || 'GET',
      url: config.url || '',
      headers: this.cleanHeaders(config.headers || {}),
      body: config.body,
      params: this.cleanParams(config.params || {}),
    }
  }

  /**
   * Remove empty headers
   */
  private cleanHeaders(headers: Record<string, string>): Record<string, string> {
    const cleaned: Record<string, string> = {}
    Object.entries(headers).forEach(([key, value]) => {
      if (key && value && value.trim()) {
        cleaned[key] = value.trim()
      }
    })
    return cleaned
  }

  /**
   * Remove empty params
   */
  private cleanParams(params: Record<string, string>): Record<string, string> {
    const cleaned: Record<string, string> = {}
    Object.entries(params).forEach(([key, value]) => {
      if (key && value && value.trim()) {
        cleaned[key] = value.trim()
      }
    })
    return cleaned
  }
}

// Export singleton instance
export const codeGenerator = new CodeGenerator()

// Export individual generator functions for testing
export {
  generateCurl,
  generateJavaScript,
  generateTypeScript,
  generatePython,
  generateGo,
  generatePHP,
  generateRust,
  generateJava,
}