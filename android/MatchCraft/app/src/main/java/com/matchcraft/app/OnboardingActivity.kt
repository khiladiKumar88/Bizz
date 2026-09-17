package com.matchcraft.app

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton

private data class Step(
    val emoji: String,
    val title: String,
    val body: String,
    val buttonText: String,
    val action: StepAction,
)

private enum class StepAction { NEXT, OPEN_IME_SETTINGS, NEXT_FROM_SETTINGS, FINISH }

class OnboardingActivity : AppCompatActivity() {

    private val steps = listOf(
        Step(
            "💘", "Welcome to MatchCraft",
            "Your AI wingman for Tinder, Bumble, Hinge & Instagram DMs.\n\nGet 5 clever, personalised replies in seconds — right from your keyboard.",
            "Get Started →", StepAction.NEXT,
        ),
        Step(
            "⌨️", "Enable the Keyboard",
            "To use MatchCraft while typing, add it as a keyboard:\n\nSettings → System → Language & Input → On-screen Keyboard → Manage keyboards\n\nToggle \"MatchCraft AI Keyboard\" on.",
            "Open Keyboard Settings", StepAction.OPEN_IME_SETTINGS,
        ),
        Step(
            "🔒", "Network Access",
            "MatchCraft needs internet access to reach the AI.\n\n⚡ Privacy promise:\n\nWe NEVER log your keystrokes or read anything you type. The AI only processes an image you explicitly paste — nothing else is transmitted, ever.",
            "Got It →", StepAction.NEXT_FROM_SETTINGS,
        ),
        Step(
            "✅", "You're All Set!",
            "How to use it:\n\n1. Open Tinder, Bumble, Hinge or Instagram\n2. Tap any message field\n3. Switch to MatchCraft using the keyboard icon (🌐)\n4. Tap ✨, paste a screenshot, pick a tone\n5. Tap a suggestion to insert it instantly",
            "Start Using MatchCraft 🚀", StepAction.FINISH,
        ),
    )

    private var currentIndex = 0

    private lateinit var progressContainer: LinearLayout
    private lateinit var emojiView: TextView
    private lateinit var titleView: TextView
    private lateinit var bodyView: TextView
    private lateinit var actionButton: MaterialButton
    private lateinit var skipButton: MaterialButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_onboarding)
        supportActionBar?.hide()

        progressContainer = findViewById(R.id.progress_container)
        emojiView = findViewById(R.id.emoji_view)
        titleView = findViewById(R.id.title_view)
        bodyView = findViewById(R.id.body_view)
        actionButton = findViewById(R.id.action_button)
        skipButton = findViewById(R.id.skip_button)

        buildProgressDots()
        render()

        actionButton.setOnClickListener { handleAction() }
        skipButton.setOnClickListener { finish() }
    }

    private fun buildProgressDots() {
        progressContainer.removeAllViews()
        val dp8 = (8 * resources.displayMetrics.density).toInt()
        val dp16 = dp8 * 2
        steps.forEachIndex { i ->
            val dot = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(dp8, dp8).apply {
                    marginEnd = dp8 / 2
                    marginStart = dp8 / 2
                }
                setBackgroundResource(R.drawable.dot_bg)
                alpha = if (i == currentIndex) 1f else 0.3f
            }
            progressContainer.addView(dot)
        }
    }

    private fun render() {
        val step = steps[currentIndex]
        emojiView.text = step.emoji
        titleView.text = step.title
        bodyView.text = step.body
        actionButton.text = step.buttonText
        skipButton.visibility = if (currentIndex == steps.size - 1) View.INVISIBLE else View.VISIBLE
        buildProgressDots()
    }

    private fun handleAction() {
        when (steps[currentIndex].action) {
            StepAction.NEXT, StepAction.NEXT_FROM_SETTINGS -> advance()
            StepAction.OPEN_IME_SETTINGS -> {
                startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
                advance()
            }
            StepAction.FINISH -> {
                getSharedPreferences("matchcraft", MODE_PRIVATE)
                    .edit().putBoolean("hasSeenOnboarding", true).apply()
                startActivity(Intent(this, MainActivity::class.java))
                finish()
            }
        }
    }

    private fun advance() {
        if (currentIndex < steps.size - 1) {
            currentIndex++
            render()
        }
    }

    override fun finish() {
        getSharedPreferences("matchcraft", MODE_PRIVATE)
            .edit().putBoolean("hasSeenOnboarding", true).apply()
        startActivity(Intent(this, MainActivity::class.java))
        super.finish()
    }
}

private inline fun <T> List<T>.forEachIndex(action: (Int) -> Unit) {
    for (i in indices) action(i)
}
