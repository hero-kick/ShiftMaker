import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
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
