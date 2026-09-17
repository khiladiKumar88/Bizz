import { useState } from 'react'
import { downloadRoastCard } from '../utils/roastCard'

const TONE_LABELS = {
  funny: { label: 'Funny', emoji: '😂' },
  flirty: { label: 'Flirty', emoji: '😘' },
  respectful: { label: 'Genuine', emoji: '🙏' },
  confident: { label: 'Confident', emoji: '💪' },
  savage: { label: 'Savage', emoji: '🔥' },
}

export default function ResultsScreen({
  suggestions, tone, mode, loading, error,
  onRegenerate, onBack, onHistory, onClearError,
}) {
  const [copied, setCopied] = useState(null)
  const [exporting, setExporting] = useState(null)

  async function handleCopy(text, idx) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(idx)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Fallback for older Safari
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(idx)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  function handleExport(text, idx) {
    setExporting(idx)
    setTimeout(() => {
      downloadRoastCard(text)
      setExporting(null)
    }, 100)
  }

  const { label: toneLabel, emoji: toneEmoji } = TONE_LABELS[tone] || { label: tone, emoji: '💬' }
  const modeLabel = mode === 'opener' ? 'Openers' : 'Replies'

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
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-white">Your {modeLabel}</h1>
          <p className="text-white/70 text-xs font-medium">{toneEmoji} {toneLabel} tone</p>
        </div>
        <button
          onClick={onHistory}
          className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white rounded-xl px-4 py-2 text-sm font-semibold active:scale-95 transition-transform"
        >
          <span>⏱</span>
        </button>
      </div>

      {/* Suggestions */}
      <div className="flex-1 mx-4 mt-4 space-y-3">
        {suggestions.map((text, idx) => (
          <div
            key={idx}
            className="suggestion-card"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center text-white text-xs font-bold">
                {idx + 1}
              </div>
              <p className="flex-1 text-gray-800 text-sm leading-relaxed font-medium pt-0.5">{text}</p>
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => handleCopy(text, idx)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95
                  ${copied === idx ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-rose-50 text-rose-500 border border-rose-200'}`}
              >
                <span>{copied === idx ? '✓' : '📋'}</span>
                {copied === idx ? 'Copied!' : 'Copy'}
              </button>

              {tone === 'savage' && (
                <button
                  onClick={() => handleExport(text, idx)}
                  disabled={exporting === idx}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-orange-50 text-orange-500 border border-orange-200 active:scale-95 transition-transform disabled:opacity-50"
                >
                  <span>{exporting === idx ? '⏳' : '🚀'}</span>
                  {exporting === idx ? '' : 'Card'}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <span className="text-red-500 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-red-700 text-sm font-medium">{error}</p>
            </div>
            <button onClick={onClearError} className="text-red-400 font-bold text-lg leading-none">×</button>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="mx-4 mt-5 space-y-3">
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="btn-primary flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Generating…
            </>
          ) : (
            <><span>🔄</span> Get Different Options</>
          )}
        </button>

        <button
          onClick={onBack}
          className="w-full py-3 rounded-2xl font-semibold text-white/80 text-sm bg-white/10 active:scale-95 transition-transform"
        >
          ← Upload New Screenshot
        </button>
      </div>

      {tone === 'savage' && (
        <p className="text-center text-white/50 text-xs mt-3 px-8">
          Tap 🚀 Card on any message to export a shareable roast card
        </p>
      )}
    </div>
  )
}
