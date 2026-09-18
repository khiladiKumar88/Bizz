package com.matchcraft.app.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.MediaStore
import android.util.Base64
import android.util.TypedValue
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.matchcraft.app.MainActivity
import com.matchcraft.app.R
import com.matchcraft.app.keyboard.APIClient
import java.io.ByteArrayOutputStream
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class OverlayService : Service() {

    companion object {
        private const val CHANNEL_ID = "matchcraft_overlay"
        private const val NOTIF_ID = 1001
        const val ACTION_STOP = "com.matchcraft.app.overlay.STOP"

        fun startIntent(ctx: Context) = Intent(ctx, OverlayService::class.java)
        fun stopIntent(ctx: Context) = Intent(ctx, OverlayService::class.java).apply {
            action = ACTION_STOP
        }
    }

    private lateinit var windowManager: WindowManager
    private var bubbleView: View? = null
    private var panelView: View? = null

    private var bubbleParams = WindowManager.LayoutParams()
    private val bubbleSizeDp = 60
    private val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else
        @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

    // Panel state
    private var selectedBitmap: Bitmap? = null
    private var selectedTone: String = "flirty"
    private var selectedPlatform: String? = null

    // Drag state
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var moved = false

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        startForegroundWithNotification()
        showBubble()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        removeBubble()
        removePanel()
        super.onDestroy()
    }

    // ── Foreground notification ──────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val chan = NotificationChannel(
                CHANNEL_ID,
                "MatchCraft Overlay",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Persistent bubble for MatchCraft AI suggestions"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(chan)
        }
    }

    private fun buildNotification(): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val stopIntent = PendingIntent.getService(
            this, 0,
            stopIntent(this),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_send)
            .setContentTitle("MatchCraft is running")
            .setContentText("Tap to open · your bubble is active")
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_delete, "Stop", stopIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun startForegroundWithNotification() {
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceCompat.startForeground(
                this, NOTIF_ID, notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    // ── Bubble ───────────────────────────────────────────────────────────────

    private fun showBubble() {
        if (bubbleView != null) return
        val view = LayoutInflater.from(this).inflate(R.layout.overlay_bubble, null)

        val sizePx = dp(bubbleSizeDp)
        val metrics = resources.displayMetrics

        bubbleParams = WindowManager.LayoutParams(
            sizePx, sizePx,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = metrics.widthPixels - sizePx - dp(8)
            y = metrics.heightPixels / 3
        }

        view.setOnTouchListener(bubbleTouchListener)
        windowManager.addView(view, bubbleParams)
        bubbleView = view
    }

    private fun removeBubble() {
        bubbleView?.let { windowManager.removeViewImmediate(it); bubbleView = null }
    }

    private val bubbleTouchListener = View.OnTouchListener { v, event ->
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                initialX = bubbleParams.x
                initialY = bubbleParams.y
                initialTouchX = event.rawX
                initialTouchY = event.rawY
                moved = false
                true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = (event.rawX - initialTouchX).toInt()
                val dy = (event.rawY - initialTouchY).toInt()
                if (abs(dx) > 8 || abs(dy) > 8) moved = true
                bubbleParams.x = max(0, initialX + dx)
                bubbleParams.y = max(0, min(resources.displayMetrics.heightPixels - dp(bubbleSizeDp), initialY + dy))
                windowManager.updateViewLayout(bubbleView, bubbleParams)
                true
            }
            MotionEvent.ACTION_UP -> {
                if (!moved) {
                    openPanel()
                } else {
                    snapToEdge()
                }
                true
            }
            else -> false
        }
    }

    private fun snapToEdge() {
        val w = resources.displayMetrics.widthPixels
        val halfW = w / 2
        // Snap to nearest vertical edge
        bubbleParams.x = if (bubbleParams.x + dp(bubbleSizeDp) / 2 < halfW) dp(8)
        else w - dp(bubbleSizeDp) - dp(8)
        windowManager.updateViewLayout(bubbleView, bubbleParams)
    }

    // ── Panel ────────────────────────────────────────────────────────────────

    private fun openPanel() {
        if (panelView != null) return
        removeBubble()

        val view = LayoutInflater.from(this).inflate(R.layout.overlay_panel, null)
        val metrics = resources.displayMetrics
        val panelW = min(dp(340), (metrics.widthPixels * 0.92f).toInt())

        val panelParams = WindowManager.LayoutParams(
            panelW,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = dp(12)
            y = metrics.heightPixels / 5
        }

        wirePanel(view)

        view.setOnTouchListener { _, ev ->
            if (ev.action == MotionEvent.ACTION_OUTSIDE) collapsePanel()
            false
        }

        windowManager.addView(view, panelParams)
        panelView = view
    }

    private fun collapsePanel() {
        removePanel()
        showBubble()
    }

    private fun removePanel() {
        panelView?.let { windowManager.removeViewImmediate(it); panelView = null }
    }

    private fun wirePanel(v: View) {
        // Close button
        v.findViewById<View>(R.id.btn_close_panel).setOnClickListener { collapsePanel() }

        // Screenshot: load latest from gallery
        val previewImg = v.findViewById<ImageView>(R.id.screenshot_preview)
        val previewLabel = v.findViewById<TextView>(R.id.screenshot_label)
        val btnPick = v.findViewById<MaterialButton>(R.id.btn_pick_screenshot)

        fun loadLatestScreenshot() {
            ScreenshotHelper.latestImage(this)?.let { bmp ->
                selectedBitmap = bmp
                previewImg.setImageBitmap(bmp)
                previewImg.visibility = View.VISIBLE
                previewLabel.text = "✓ Screenshot loaded"
            } ?: run {
                previewLabel.text = "No recent screenshot found"
            }
        }

        loadLatestScreenshot()

        btnPick.setOnClickListener { loadLatestScreenshot() }

        // Tone chips
        val toneGroup = v.findViewById<ChipGroup>(R.id.tone_chip_group)
        val tones = listOf("funny", "flirty", "genuine", "confident", "savage")
        tones.forEach { tone ->
            val chip = Chip(this).apply {
                text = tone.replaceFirstChar { it.uppercase() }
                isCheckable = true
                isChecked = tone == selectedTone
                setChipBackgroundColorResource(R.color.chip_selector)
                setTextColor(resources.getColorStateList(R.color.chip_text_selector, theme))
                id = View.generateViewId()
            }
            toneGroup.addView(chip)
        }
        toneGroup.setOnCheckedStateChangeListener { group, checkedIds ->
            val idx = checkedIds.firstOrNull()?.let { id ->
                (0 until group.childCount).firstOrNull { group.getChildAt(it).id == id }
            } ?: return@setOnCheckedStateChangeListener
            selectedTone = tones.getOrElse(idx) { "flirty" }
        }

        // Platform chips
        val platformGroup = v.findViewById<ChipGroup>(R.id.platform_chip_group)
        val platforms = listOf("tinder", "bumble", "hinge", "instagram")
        platforms.forEach { p ->
            val chip = Chip(this).apply {
                text = p.replaceFirstChar { it.uppercase() }
                isCheckable = true
                isChecked = p == selectedPlatform
                setChipBackgroundColorResource(R.color.chip_selector)
                setTextColor(resources.getColorStateList(R.color.chip_text_selector, theme))
                id = View.generateViewId()
            }
            platformGroup.addView(chip)
        }
        platformGroup.setOnCheckedStateChangeListener { group, checkedIds ->
            selectedPlatform = if (checkedIds.isEmpty()) null else {
                val idx = checkedIds.firstOrNull()?.let { id ->
                    (0 until group.childCount).firstOrNull { group.getChildAt(it).id == id }
                } ?: return@setOnCheckedStateChangeListener
                platforms.getOrNull(idx)
            }
        }

        // Generate
        val btnGenerate = v.findViewById<MaterialButton>(R.id.btn_generate)
        val statusText = v.findViewById<TextView>(R.id.status_text)
        val suggestionsContainer = v.findViewById<LinearLayout>(R.id.suggestions_container)

        btnGenerate.setOnClickListener {
            val bmp = selectedBitmap ?: run {
                statusText.text = "Load a screenshot first"
                return@setOnClickListener
            }
            val base64 = bitmapToBase64(bmp)
            statusText.text = "Generating…"
            btnGenerate.isEnabled = false
            suggestionsContainer.removeAllViews()

            APIClient.generate(
                imageBase64 = base64,
                imageMediaType = "image/jpeg",
                tone = selectedTone,
                mode = "reply",
                platform = selectedPlatform
            ) { result ->
                android.os.Handler(mainLooper).post {
                    btnGenerate.isEnabled = true
                    when (result) {
                        is APIClient.Result.Success -> {
                            statusText.text = "Tap a suggestion to copy it:"
                            suggestionsContainer.removeAllViews()
                            result.suggestions.forEach { text ->
                                addSuggestionCard(suggestionsContainer, text)
                            }
                        }
                        is APIClient.Result.Error -> {
                            statusText.text = result.message
                        }
                    }
                }
            }
        }
    }

    private fun addSuggestionCard(container: LinearLayout, text: String) {
        val card = MaterialCardView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(8) }
            radius = dp(12).toFloat()
            cardElevation = dp(2).toFloat()
            isClickable = true
            isFocusable = true
            setOnClickListener {
                val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("MatchCraft", text))
                Toast.makeText(this@OverlayService, "Copied!", Toast.LENGTH_SHORT).show()
            }
        }

        val tv = TextView(this).apply {
            this.text = text
            textSize = 13f
            setPadding(dp(12), dp(10), dp(12), dp(10))
            setTextColor(Color.parseColor("#111827"))
        }
        card.addView(tv)
        container.addView(card)
    }

    private fun bitmapToBase64(bmp: Bitmap): String {
        // Scale down to max 1200px on longest side
        val max = 1200
        val scaled = if (bmp.width > max || bmp.height > max) {
            val scale = max.toFloat() / maxOf(bmp.width, bmp.height)
            Bitmap.createScaledBitmap(bmp, (bmp.width * scale).toInt(), (bmp.height * scale).toInt(), true)
        } else bmp
        return ByteArrayOutputStream().use { out ->
            scaled.compress(Bitmap.CompressFormat.JPEG, 80, out)
            Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        }
    }

    private fun dp(dp: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp.toFloat(), resources.displayMetrics).toInt()
}
