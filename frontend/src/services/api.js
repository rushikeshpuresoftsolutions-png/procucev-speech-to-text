import axios from 'axios'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000 })
export function socketUrl() {
  const url = new URL('/ws/transcribe', window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return import.meta.env.VITE_WS_URL || url.href
}
export const languages = { auto: 'Auto-detect', en: 'English', hi: 'Hindi', mixed: 'Hinglish' }
export function clock(value = 0) {
  const seconds = Math.floor(value)
  return [Math.floor(seconds / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':')
}
export const dateLabel = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
export function problem(error) {
  const detail = error.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Unable to complete the request. Check the connection and try again.'
}
