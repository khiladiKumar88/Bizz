import { useState, useRef, useCallback } from 'react'

const PLATFORMS = [
  { id: 'tinder', label: 'Tinder', emoji: '🔥' },
  { id: 'bumble', label: 'Bumble', emoji: '🐝' },
  { id: 'hinge', label: 'Hinge', emoji: '💛' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
]

const TONES = [
  { id: 'funny', label: 'Funny', emoji: '😂', desc: 'Witty & humorous' },
  { id: 'flirty', label: 'Flirty', emoji: '😘', desc: 'Playfully charming' },
  { id: 'respectful', label: 'Genuine', emoji: '🙏', desc: 'Warm & authentic' },
  { id: 'confident', label: 'Confident', emoji: '💪', desc: 'Bold & direct' },
  { id: 'savage', label: 'Savage', emoji: '🔥', desc: 'Playful roast' },
]

export default function UploadScreen({ onGenerate, loading, error, onClearError, onHistory }) {
  const [image, setImage] = useState(null) // { base64, mediaType, previewUrl }
  const [tone, setTone] = useState(null)
  const [mode, setMode] = useState('opener')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const processFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX = 1200
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const previewUrl = canvas.toDataURL('image/jpeg', 0.85)
        const base64 = previewUrl.split(',')[1]
        setImage({ base64, mediaType: 'image/jpeg', previewUrl })
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    processFile(file)
  }, [processFile])

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  const handleSubmit = () => {
    if (!image || !tone) return
    onClearError()
    onGenerate({ imageBase64: image.base64, imageMediaType: image.mediaType, tone, mode })
  }

  const canGenerate = image && tone && !loading

  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-2">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">MatchCraft</h1>
          <p className="text-white/70 text-sm font-medium mt-0.5">AI-powered dating replies 💘</p>
        </div>
        <button
          onClick={onHistory}
          className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white rounded-xl px-4 py-2 text-sm font-semibold active:scale-95 transition-transform"
        >
          <span>⏱</span> History
        </button>
      </div>

      {/* Main card */}
      <div className="flex-1 mx-4 mt-4 bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-5 space-y-5">

          {/* Upload area */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Upload Screenshot
            </label>
            <div
              onClick={() => fileRef.current.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden
                ${dragging ? 'border-rose-400 bg-rose-50 scale-[1.01]' : image ? 'border-rose-200 bg-gray-50' : 'border-gray-200 bg-gray-50 hover:border-rose-300 hover:bg-rose-50/30'}`}
              style={{ minHeight: image ? 180 : 140 }}
            >
              {image ? (
                <div className="relative">
                  <img src={image.previewUrl} alt="Screenshot" className="w-full max-h-56 object-cover rounded-xl" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                    <span className="text-white font-semibold text-sm bg-black/50 px-3 py-1.5 rounded-full">
                      Click to change
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
                  <div className="text-4xl">📸</div>
                  <p className="font-semibold text-gray-600 text-sm">Drop screenshot here</p>
                  <p className="text-gray-400 text-xs">or tap to browse</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => processFile(e.target.files[0])}
            />
          </div>

          {/* Platform selector */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Platform
            </label>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => (
                <button key={p.id} className="flex-1 text-center text-xs font-semibold py-2 rounded-xl bg-gray-100 text-gray-500 active:scale-95 transition-transform hover:bg-rose-50 hover:text-rose-500">
                  <div className="text-base">{p.emoji}</div>
                  <div>{p.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Mode toggle */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Mode
            </label>
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              {['opener', 'reply'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150 active:scale-95
                    ${mode === m ? 'bg-white text-rose-500 shadow-sm' : 'text-gray-500'}`}
                >
                  {m === 'opener' ? '✨ Opener' : '💬 Reply'}
                </button>
              ))}
            </div>
          </div>

          {/* Tone selector */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Tone
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`tone-btn ${tone === t.id ? 'tone-btn-active' : 'tone-btn-inactive'}`}
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span className="text-[11px] leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

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

          {/* CTA */}
          <button
            onClick={handleSubmit}
            disabled={!canGenerate}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Crafting your reply…
              </>
            ) : (
              <>
                <span>✨</span> Craft My {mode === 'opener' ? 'Opener' : 'Reply'}
              </>
            )}
          </button>

          {!image && (
            <p className="text-center text-xs text-gray-400">Upload a screenshot to get started</p>
          )}
          {image && !tone && (
            <p className="text-center text-xs text-gray-400">Choose a tone to unlock generation</p>
          )}
        </div>
      </div>

      <p className="text-center text-white/50 text-xs mt-4 px-8">
        Your screenshots are never stored — we process them in memory only.
      </p>
    </div>
  )
}
