import axios, { type AxiosError } from 'axios'

export const apiClient = axios.create({
  baseURL: process.env['NEXT_PUBLIC_API_URL'],
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status
    if (status === 401) {
      // Auth errors are handled by NextAuth session logic
      return Promise.reject(error)
    }
    return Promise.reject(error)
  },
)
