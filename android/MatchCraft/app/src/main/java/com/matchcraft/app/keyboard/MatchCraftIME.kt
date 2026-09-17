package com.matchcraft.app.keyboard

import android.content.ClipboardManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.drawable.BitmapDrawable
import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.button.MaterialButtonToggleGroup
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.matchcraft.app.R
import java.io.ByteArrayOutputStream
import android.util.Base64

/**
 * Main IME (Input Method Editor) — the custom keyboard service.
 *
 * Layout is inflated from keyboard_main.xml.
 * The panel lets the user:
 *   1. Choose mode (Opener / Reply)
 *   2. Choose tone via chip group
 *   3. Paste a screenshot from clipboard
 *   4. Hit Generate → 5 suggestion chips appear
 *   5. Tap a chip → text inserted into the active field
 */
class MatchCraftIME : InputMethodService() {

    private val mainHandler = Handler(Looper.getMainLooper())

    // IME input view (root of what's shown above content)
    private var inputView: View? = null

    // State
    private var selectedTone = "funny"
    private var selectedMode = "opener"
    private var pastedBitmap: Bitmap? = null

    // Lazy view refs (set after onCreateInputView)
    private lateinit var modeToggle: MaterialButtonToggleGroup
    private lateinit var toneChipGroup: ChipGroup
    private lateinit var pasteButton: MaterialButton
    private lateinit var imagePreview: ImageView
    private lateinit var generateButton: MaterialButton
    private lateinit var progressBar: ProgressBar
    private lateinit var errorLabel: TextView
    private lateinit var suggestionsHeader: TextView
    private lateinit var suggestionsContainer: LinearLayout
    private lateinit var scrollView: ScrollView

    // MARK: - IME lifecycle

    override fun onCreateInputView(): View {
        val root = layoutInflater.inflate(R.layout.keyboard_main, null)
        inputView = root

        // Bind views
        modeToggle = root.findViewById(R.id.mode_toggle)
        toneChipGroup = root.findViewById(R.id.tone_chip_group)
        pasteButton = root.findViewById(R.id.paste_button)
        imagePreview = root.findViewById(R.id.image_preview)
        generateButton = root.findViewById(R.id.generate_button)
        progressBar = root.findViewById(R.id.progress_bar)
        errorLabel = root.findViewById(R.id.error_label)
        suggestionsHeader = root.findViewById(R.id.suggestions_header)
        suggestionsContainer = root.findViewById(R.id.suggestions_container)
        scrollView = root.findViewById(R.id.scroll_view)

        setupModeToggle()
        setupTones()
        setupButtons(root)

        return root
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // Nothing extra needed; full UI is always shown
    }

    // MARK: - Setup

    private fun setupModeToggle() {
        modeToggle.check(R.id.btn_opener)
        modeToggle.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            selectedMode = if (checkedId == R.id.btn_opener) "opener" else "reply"
            clearSuggestions()
        }
    }

    private val tones = listOf(
        Triple("funny",      "😂 Funny",    true),
        Triple("flirty",     "😘 Flirty",   false),
        Triple("respectful", "🙏 Genuine",  false),
        Triple("confident",  "💪 Bold",     false),
        Triple("savage",     "🔥 Savage",   false),
    )

    private fun setupTones() {
        tones.forEach { (id, label, isDefault) ->
            val chip = Chip(this).apply {
                text = label
                isCheckable = true
                isChecked = isDefault
                tag = id
                chipBackgroundColor = ContextCompat.getColorStateList(context, R.color.chip_selector)
                setOnCheckedChangeListener { _, checked ->
                    if (checked) {
                        selectedTone = id
                        clearSuggestions()
                    }
                }
            }
            toneChipGroup.addView(chip)
        }
        toneChipGroup.isSingleSelection = true
        toneChipGroup.isSelectionRequired = true
    }

    private fun setupButtons(root: View) {
        pasteButton.setOnClickListener { pasteScreenshot() }
        generateButton.setOnClickListener { generate() }

        root.findViewById<ImageButton>(R.id.btn_switch_keyboard).setOnClickListener {
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showInputMethodPicker()
        }

        root.findViewById<ImageButton>(R.id.btn_delete).setOnClickListener {
            currentInputConnection?.deleteSurroundingText(1, 0)
        }
    }

    // MARK: - Actions

    private fun pasteScreenshot() {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = clipboard.primaryClip

        if (clip == null || clip.itemCount == 0) {
            showError(getString(R.string.no_image_error))
            return
        }

        val item = clip.getItemAt(0)
        val uri = item.uri

        if (uri != null) {
            runCatching {
                val bitmap = MediaStore.Images.Media.getBitmap(contentResolver, uri)
                onImageReady(bitmap)
            }.onFailure {
                showError("Could not load the image from clipboard: ${it.message}")
            }
        } else {
            showError(getString(R.string.no_image_error))
        }
    }

    private fun onImageReady(bitmap: Bitmap) {
        pastedBitmap = bitmap
        imagePreview.setImageBitmap(bitmap)
        imagePreview.visibility = View.VISIBLE
        pasteButton.text = getString(R.string.screenshot_ready)
        hideError()
    }

    private fun generate() {
        val bitmap = pastedBitmap ?: run {
            showError(getString(R.string.no_image_error))
            return
        }

        setLoading(true)
        clearSuggestions()

        // Compress to JPEG; resize to max 1200px to stay under Worker limits
        val scaled = scaleBitmap(bitmap, 1200)
        val baos = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, 82, baos)
        val base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)

        APIClient.generate(
            imageBase64 = base64,
            tone = selectedTone,
            mode = selectedMode,
        ) { result ->
            mainHandler.post {
                setLoading(false)
                when (result) {
                    is APIClient.Result.Success -> showSuggestions(result.suggestions)
                    is APIClient.Result.Error -> showError(result.message)
                }
            }
        }
    }

    // MARK: - Suggestions

    private fun showSuggestions(suggestions: List<String>) {
        suggestionsContainer.removeAllViews()
        suggestionsHeader.visibility = View.VISIBLE
        suggestionsContainer.visibility = View.VISIBLE

        suggestions.forEachIndexed { i, text ->
            val card = layoutInflater.inflate(R.layout.suggestion_item, suggestionsContainer, false)
            card.findViewById<TextView>(R.id.suggestion_number).text = "${i + 1}"
            card.findViewById<TextView>(R.id.suggestion_text).text = text
            card.findViewById<MaterialButton>(R.id.insert_button).setOnClickListener {
                currentInputConnection?.commitText(text, 1)
            }
            suggestionsContainer.addView(card)
        }

        // Scroll down
        scrollView.post { scrollView.fullScroll(View.FOCUS_DOWN) }
    }

    private fun clearSuggestions() {
        suggestionsContainer.removeAllViews()
        suggestionsContainer.visibility = View.GONE
        suggestionsHeader.visibility = View.GONE
    }

    // MARK: - State helpers

    private fun setLoading(loading: Boolean) {
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        generateButton.isEnabled = !loading
        generateButton.text = if (loading) getString(R.string.generating) else getString(R.string.generate_button)
        if (loading) hideError()
    }

    private fun showError(msg: String) {
        errorLabel.text = msg
        errorLabel.visibility = View.VISIBLE
    }

    private fun hideError() {
        errorLabel.visibility = View.GONE
    }

    // MARK: - Utilities

    private fun scaleBitmap(src: Bitmap, maxPx: Int): Bitmap {
        val w = src.width; val h = src.height
        if (w <= maxPx && h <= maxPx) return src
        val scale = maxPx.toFloat() / maxOf(w, h)
        return Bitmap.createScaledBitmap(src, (w * scale).toInt(), (h * scale).toInt(), true)
    }
}
