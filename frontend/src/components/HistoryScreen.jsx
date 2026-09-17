import { useState, useEffect } from 'react'

const HISTORY_KEY = 'matchcraft-history'

const TONE_META = {
  funny: { emoji: '😂', label: 'Funny' },
  flirty: { emoji: '😘', label: 'Flirty' },
  respectful: { emoji: '🙏', label: 'Genuine' },
  confident: { emoji: '💪', label: 'Confident' },
  savage: { emoji: '🔥', label: 'Savage' },
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function groupByDay(entries) {
  const groups = {}
  for (const entry of entries) {
    const d = new Date(entry.timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    let key
    if (d.toDateString() === today.toDateString()) key = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) key = 'Yesterday'
    else key = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
  }
  return groups
}

function HistoryEntry({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(null)
  const { emoji, label } = TONE_META[entry.tone] || { emoji: '💬', label: entry.tone }

  async function handleCopy(text, idx) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="card border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left active:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center text-lg flex-shrink-0">
            {emoji}
          </div>
          <div>
            <div className="font-semibold text-gray-800 text-sm">
              {label} {entry.mode === 'opener' ? 'Opener' : 'Reply'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{timeAgo(entry.timestamp)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
            {entry.suggestions?.length || 0} options
          </span>
          <span className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {(entry.suggestions || []).map((text, idx) => (
            <div key={idx} className="flex items-start gap-3 px-4 py-3">
              <p className="flex-1 text-sm text-gray-700 leading-relaxed">{text}</p>
              <button
                onClick={() => handleCopy(text, idx)}
                className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95
                  ${copied === idx ? 'bg-green-100 text-green-600' : 'bg-rose-50 text-rose-500'}`}
              >
                {copied === idx ? '✓' : '📋'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistoryScreen({ onBack }) {
  const [history, setHistory] = useState([])
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
      setHistory(stored)
    } catch {
      setHistory([])
    }
  }, [])

  function clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch {}
    setHistory([])
    setShowConfirm(false)
  }

  const groups = groupByDay(history)

  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white rounded-xl px-4 py-2 text-sm font-semibold active:scale-95 transition-transform"
        >
          ← Back
        </button>
        <h1 className="text-xl font-extrabold text-white">History</h1>
        {history.length > 0 ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="bg-white/20 backdrop-blur-sm text-white/80 rounded-xl px-3 py-2 text-sm font-semibold active:scale-95 transition-transform"
          >
            🗑️
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 mx-4 mt-4">
        {history.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-6xl">💭</div>
            <h2 className="font-bold text-gray-700 text-lg">No history yet</h2>
            <p className="text-gray-400 text-sm">Your generated replies will appear here once you start crafting some magic.</p>
            <button
              onClick={onBack}
              className="mt-2 bg-gradient-to-r from-rose-500 to-orange-400 text-white font-bold px-6 py-3 rounded-2xl active:scale-95 transition-transform shadow-lg shadow-rose-500/30"
            >
              ✨ Get Started
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(groups).map(([day, entries]) => (
              <div key={day}>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-2 px-1">{day}</p>
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <HistoryEntry key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm clear dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 pb-10 space-y-4">
            <h3 className="font-bold text-gray-800 text-lg text-center">Clear all history?</h3>
            <p className="text-gray-500 text-sm text-center">This will permanently delete all {history.length} saved entries. This can't be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={clearHistory}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-red-500 active:scale-95 transition-transform"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
