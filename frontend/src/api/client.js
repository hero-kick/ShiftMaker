import axios from 'axios'

// ローカル開発: Vite proxyで /api → localhost:8000
// 本番: VITE_API_URL 環境変数でRenderのURLを指定
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 90000, // 90 seconds for solver
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.message ||
      'サーバーとの通信に失敗しました'
    return Promise.reject(new Error(message))
  }
)

export const generateShift = (data) => apiClient.post('/generate', data)
export const getSampleData = () => apiClient.get('/sample')
export const checkHealth = () => apiClient.get('/health')

export default apiClient
