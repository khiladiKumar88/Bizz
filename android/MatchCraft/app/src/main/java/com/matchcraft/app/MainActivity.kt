package com.matchcraft.app

import android.content.Context
import android.os.Bundle
import android.view.inputmethod.InputMethodManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView

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
        wireDataControls()
    }

    private fun wireDataControls() {
        findViewById<MaterialButton>(R.id.btn_clear_data).setOnClickListener {
            androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle(R.string.clear_local_data)
                .setMessage(R.string.clear_local_data_confirm)
                .setNegativeButton(android.R.string.cancel, null)
                .setPositiveButton(android.R.string.ok) { _, _ ->
                    getSharedPreferences("matchcraft", MODE_PRIVATE).edit().clear().apply()
                    android.widget.Toast.makeText(
                        this, R.string.clear_local_data_done, android.widget.Toast.LENGTH_SHORT
                    ).show()
                }
                .show()
        }
    }

    override fun onResume() {
        super.onResume()
        renderStatus()
    }

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
            card.setCardBackgroundColor(getColor(android.R.color.holo_green_light).let {
                android.graphics.Color.argb(30, 0, 200, 100)
            })
        } else {
            icon.text = "⚠️"
            title.text = "Keyboard Not Enabled"
            subtitle.text = "Tap here to open keyboard settings"
            card.setCardBackgroundColor(android.graphics.Color.argb(30, 255, 152, 0))
            card.setOnClickListener {
                startActivity(android.content.Intent(android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS))
            }
        }
    }

    private fun isMatchCraftEnabled(): Boolean {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        val enabledMethods = imm.enabledInputMethodList
        return enabledMethods.any { it.packageName == packageName }
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
}
