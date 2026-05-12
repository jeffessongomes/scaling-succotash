import axios, { type AxiosError } from 'axios'

export const apiClient = axios.create({
  baseURL: process.env['NEXT_PUBLIC_API_URL'],
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(error),
)
