import { useState } from 'react'
import UploadScreen from './components/UploadScreen'
import ResultsScreen from './components/ResultsScreen'
import HistoryScreen from './components/HistoryScreen'

const HISTORY_KEY = 'matchcraft-history'
const API_BASE = import.meta.env.VITE_API_URL || '/api'

export default function App() {
  const [screen, setScreen] = useState('upload')
  const [suggestions, setSuggestions] = useState([])
  const [tone, setTone] = useState(null)
  const [mode, setMode] = useState('opener')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastRequest, setLastRequest] = useState(null)

  async function handleGenerate({ imageBase64, imageMediaType, tone, mode, platform }) {
    setLoading(true)
    setError(null)
    setLastRequest({ imageBase64, imageMediaType, tone, mode, platform })
    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, imageMediaType, tone, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate suggestions')
      setSuggestions(data.suggestions)
      setTone(tone)
      setMode(mode)
      saveToHistory(data.suggestions, tone, mode)
      setScreen('results')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegenerate() {
    if (!lastRequest) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lastRequest),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate')
      setSuggestions(data.suggestions)
      saveToHistory(data.suggestions, lastRequest.tone, lastRequest.mode)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function saveToHistory(suggestions, tone, mode) {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
      history.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        tone,
        mode,
        suggestions,
      })
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)))
    } catch {
      // localStorage unavailable — silently skip
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-500 via-pink-500 to-orange-400">
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        {screen === 'upload' && (
          <UploadScreen
            onGenerate={handleGenerate}
            loading={loading}
            error={error}
            onClearError={() => setError(null)}
            onHistory={() => setScreen('history')}
          />
        )}
        {screen === 'results' && (
          <ResultsScreen
            suggestions={suggestions}
            tone={tone}
            mode={mode}
            loading={loading}
            error={error}
            onRegenerate={handleRegenerate}
            onBack={() => setScreen('upload')}
            onHistory={() => setScreen('history')}
            onClearError={() => setError(null)}
          />
        )}
        {screen === 'history' && (
          <HistoryScreen onBack={() => setScreen('upload')} />
        )}
      </div>
    </div>
  )
}
