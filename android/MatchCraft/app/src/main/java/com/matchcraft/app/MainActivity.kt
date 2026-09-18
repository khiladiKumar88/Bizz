package com.matchcraft.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.matchcraft.app.overlay.OverlayService

class MainActivity : AppCompatActivity() {

    private val steps = listOf(
        Pair("1️⃣", "Open Tinder, Bumble, Hinge, or Instagram"),
        Pair("2️⃣", "Tap any message or reply field"),
        Pair("3️⃣", "Tap the keyboard/globe icon (🌐) and select MatchCraft"),
        Pair("4️⃣", "Tap ✨, paste a screenshot, choose a tone"),
        Pair("5️⃣", "Tap any suggestion to insert it instantly"),
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        supportActionBar?.hide()

        renderStatus()
        renderSteps()
        wireOverlayControls()
    }

    override fun onResume() {
        super.onResume()
        renderStatus()
        updateOverlayStatus()
    }

    // ── Keyboard status ──────────────────────────────────────────────────────

    private fun renderStatus() {
        val enabled = isMatchCraftEnabled()
        val icon = findViewById<TextView>(R.id.status_icon)
        val title = findViewById<TextView>(R.id.status_title)
        val subtitle = findViewById<TextView>(R.id.status_subtitle)
        val card = findViewById<MaterialCardView>(R.id.status_card)

        if (enabled) {
            icon.text = "✅"
            title.text = "Keyboard Active"
            subtitle.text = "MatchCraft AI Keyboard is enabled and ready"
            card.setCardBackgroundColor(android.graphics.Color.argb(30, 0, 200, 100))
        } else {
            icon.text = "⚠️"
            title.text = "Keyboard Not Enabled"
            subtitle.text = "Tap here to open keyboard settings"
            card.setCardBackgroundColor(android.graphics.Color.argb(30, 255, 152, 0))
            card.setOnClickListener {
                startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            }
        }
    }

    private fun isMatchCraftEnabled(): Boolean {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        return imm.enabledInputMethodList.any { it.packageName == packageName }
    }

    private fun renderSteps() {
        val container = findViewById<LinearLayout>(R.id.steps_container)
        container.removeAllViews()
        val dp8 = (8 * resources.displayMetrics.density).toInt()
        val dp12 = (12 * resources.displayMetrics.density).toInt()

        steps.forEach { (emoji, text) ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply { bottomMargin = dp12 }
            }
            val emojiView = TextView(this).apply {
                this.text = emoji
                textSize = 20f
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply { marginEnd = dp8 }
            }
            val textView = TextView(this).apply {
                this.text = text
                textSize = 15f
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            row.addView(emojiView)
            row.addView(textView)
            container.addView(row)
        }
    }

    // ── Overlay (v3) controls ────────────────────────────────────────────────

    private fun wireOverlayControls() {
        val btnStart = findViewById<MaterialButton>(R.id.btn_start_bubble)
        val btnStop = findViewById<MaterialButton>(R.id.btn_stop_bubble)

        btnStart.setOnClickListener {
            if (Settings.canDrawOverlays(this)) {
                launchOverlayService()
            } else {
                startActivity(Intent(this, OverlayPermissionActivity::class.java))
            }
        }

        btnStop.setOnClickListener {
            stopService(OverlayService.stopIntent(this))
            updateOverlayStatus()
        }
    }

    private fun launchOverlayService() {
        val intent = OverlayService.startIntent(this)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        // Move app to background so the bubble is visible immediately
        moveTaskToBack(true)
    }

    private fun updateOverlayStatus() {
        val running = isOverlayServiceRunning()
        val statusText = findViewById<TextView>(R.id.overlay_status_text)
        val btnStart = findViewById<MaterialButton>(R.id.btn_start_bubble)
        val btnStop = findViewById<MaterialButton>(R.id.btn_stop_bubble)
        val hasPermission = Settings.canDrawOverlays(this)

        statusText.text = when {
            running -> getString(R.string.overlay_active)
            !hasPermission -> getString(R.string.overlay_permission_needed)
            else -> getString(R.string.overlay_inactive)
        }

        btnStart.visibility = if (running) View.GONE else View.VISIBLE
        btnStop.visibility = if (running) View.VISIBLE else View.GONE
    }

    private fun isOverlayServiceRunning(): Boolean {
        val manager = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        @Suppress("DEPRECATION")
        return manager.getRunningServices(Int.MAX_VALUE)
            .any { it.service.className == OverlayService::class.java.name }
    }
}
