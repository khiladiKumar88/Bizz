/**
 * Generates a shareable "roast card" PNG from a suggestion text.
 * Returns a data URL suitable for download or display.
 */
export function generateRoastCard(message) {
  const SIZE = 1080
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  grad.addColorStop(0, '#f43f5e')
  grad.addColorStop(0.5, '#ec4899')
  grad.addColorStop(1, '#f97316')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Subtle noise texture overlay (dots)
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  for (let i = 0; i < SIZE; i += 40) {
    for (let j = 0; j < SIZE; j += 40) {
      ctx.beginPath()
      ctx.arc(i, j, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // White card in center
  const cardX = 80, cardY = 200, cardW = SIZE - 160, cardH = SIZE - 440
  roundRect(ctx, cardX, cardY, cardW, cardH, 40)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Quote marks
  ctx.font = 'bold 160px Georgia, serif'
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.textAlign = 'left'
  ctx.fillText('"', cardX + 30, cardY + 120)

  // Message text (word-wrapped)
  ctx.font = 'bold 52px Inter, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  const maxW = cardW - 120
  const lines = wrapText(ctx, `"${message}"`, maxW, 52)
  const lineHeight = 72
  const totalTextH = lines.length * lineHeight
  const startY = cardY + (cardH - totalTextH) / 2 + 30
  lines.forEach((line, i) => {
    ctx.fillText(line, SIZE / 2, startY + i * lineHeight)
  })

  // Emoji decoration
  ctx.font = '80px serif'
  ctx.textAlign = 'center'
  ctx.fillText('🔥', SIZE / 2 - 60, cardY + cardH + 80)
  ctx.fillText('💘', SIZE / 2 + 60, cardY + cardH + 80)

  // App branding
  ctx.font = 'bold 36px Inter, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.textAlign = 'center'
  ctx.fillText('MatchCraft AI 💘', SIZE / 2, SIZE - 60)

  ctx.font = '28px Inter, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText('matchcraft.app', SIZE / 2, SIZE - 20)

  return canvas.toDataURL('image/png')
}

export function downloadRoastCard(message) {
  const dataUrl = generateRoastCard(message)
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = 'matchcraft-roast.png'
  a.click()
}

function wrapText(ctx, text, maxWidth, fontSize) {
  const words = text.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
