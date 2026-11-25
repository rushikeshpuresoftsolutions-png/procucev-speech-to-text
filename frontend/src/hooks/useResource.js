import { useEffect, useState } from 'react'
import { api, problem } from '../services/api'

export function useResource(path) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ loading: true })
  useEffect(() => {
    const controller = new AbortController()
    setResult({ loading: true })
    api.get(path, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setResult({ data }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ error: problem(error) }) })
    return () => controller.abort()
  }, [path, attempt])
  return { ...result, retry: () => setAttempt(n => n + 1) }
}
