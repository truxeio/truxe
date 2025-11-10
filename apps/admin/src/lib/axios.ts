import axios from 'axios'

// Configure base URL from environment or window runtime config
const API_BASE_URL =
  (typeof window !== 'undefined' && (window as any).__TRUXE_API_BASE_URL__) ||
  process.env.TRUXE_API_BASE_URL ||
  '/'

axios.defaults.baseURL = API_BASE_URL
axios.defaults.withCredentials = true

export default axios


