import UIKit

// MARK: - Tone definition

private struct Tone {
    let id: String
    let emoji: String
    let label: String
}

private let TONES: [Tone] = [
    Tone(id: "funny",      emoji: "😂", label: "Funny"),
    Tone(id: "flirty",     emoji: "😘", label: "Flirty"),
    Tone(id: "respectful", emoji: "🙏", label: "Genuine"),
    Tone(id: "confident",  emoji: "💪", label: "Bold"),
    Tone(id: "savage",     emoji: "🔥", label: "Savage"),
]

// MARK: - KeyboardViewController

final class KeyboardViewController: UIInputViewController {

    // MARK: State
    private var selectedTone: Tone = TONES[0]
    private var selectedMode: String = "opener"
    private var pastedImage: UIImage?
    private var isLoading = false

    // MARK: UI — bottom bar
    private lazy var bottomBar: UIView = makeBottomBar()

    // MARK: UI — scroll container
    private lazy var scrollView: UIScrollView = {
        let sv = UIScrollView()
        sv.alwaysBounceVertical = false
        sv.showsVerticalScrollIndicator = false
        return sv
    }()

    private lazy var contentStack: UIStackView = {
        let sv = UIStackView()
        sv.axis = .vertical
        sv.spacing = 14
        sv.layoutMargins = UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
        sv.isLayoutMarginsRelativeArrangement = true
        return sv
    }()

    // MARK: UI — controls
    private lazy var modeControl: UISegmentedControl = {
        let sc = UISegmentedControl(items: ["✨ Opener", "💬 Reply"])
        sc.selectedSegmentIndex = 0
        sc.addTarget(self, action: #selector(modeChanged), for: .valueChanged)
        return sc
    }()

    private lazy var toneScrollView: UIScrollView = {
        let sv = UIScrollView()
        sv.showsHorizontalScrollIndicator = false
        sv.alwaysBounceHorizontal = true
        sv.heightAnchor.constraint(equalToConstant: 40).isActive = true
        return sv
    }()

    private lazy var toneStack: UIStackView = {
        let sv = UIStackView()
        sv.axis = .horizontal
        sv.spacing = 8
        sv.alignment = .center
        sv.layoutMargins = UIEdgeInsets(top: 0, left: 0, bottom: 0, right: 0)
        sv.isLayoutMarginsRelativeArrangement = true
        return sv
    }()

    private var tonePills: [UIButton] = []

    private lazy var pasteButton: UIButton = {
        var cfg = UIButton.Configuration.tinted()
        cfg.title = "Paste Screenshot from Clipboard"
        cfg.image = UIImage(systemName: "doc.on.clipboard")
        cfg.imagePadding = 8
        cfg.cornerStyle = .medium
        cfg.baseBackgroundColor = .systemGray
        let btn = UIButton(configuration: cfg)
        btn.addTarget(self, action: #selector(pasteImage), for: .touchUpInside)
        return btn
    }()

    private lazy var imagePreview: UIImageView = {
        let iv = UIImageView()
        iv.contentMode = .scaleAspectFit
        iv.layer.cornerRadius = 8
        iv.clipsToBounds = true
        iv.isHidden = true
        iv.heightAnchor.constraint(lessThanOrEqualToConstant: 100).isActive = true
        return iv
    }()

    private lazy var generateButton: UIButton = {
        var cfg = UIButton.Configuration.filled()
        cfg.title = "Craft My Reply"
        cfg.image = UIImage(systemName: "sparkles")
        cfg.imagePadding = 8
        cfg.cornerStyle = .large
        cfg.baseBackgroundColor = UIColor(red: 0.96, green: 0.24, blue: 0.37, alpha: 1)
        cfg.baseForegroundColor = .white
        let btn = UIButton(configuration: cfg)
        btn.addTarget(self, action: #selector(generateTapped), for: .touchUpInside)
        return btn
    }()

    private lazy var activityIndicator: UIActivityIndicatorView = {
        let ai = UIActivityIndicatorView(style: .medium)
        ai.hidesWhenStopped = true
        return ai
    }()

    private lazy var errorLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 12)
        l.textColor = .systemRed
        l.numberOfLines = 0
        l.isHidden = true
        return l
    }()

    private lazy var suggestionsStack: UIStackView = {
        let sv = UIStackView()
        sv.axis = .vertical
        sv.spacing = 8
        sv.isHidden = true
        return sv
    }()

    private lazy var suggestionsHeader: UILabel = {
        let l = UILabel()
        l.text = "Tap a suggestion to insert it:"
        l.font = .systemFont(ofSize: 12, weight: .semibold)
        l.textColor = .secondaryLabel
        return l
    }()

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        setupLayout()
        buildTonePills()
    }

    // MARK: - Layout

    private func setupLayout() {
        // Scroll container
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentStack)

        // Bottom bar
        bottomBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bottomBar)

        NSLayoutConstraint.activate([
            bottomBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            bottomBar.heightAnchor.constraint(equalToConstant: 44),

            scrollView.topAnchor.constraint(equalTo: view.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomBar.topAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
        ])

        // Header row inside contentStack
        let headerLabel = UILabel()
        headerLabel.text = "💘 MatchCraft AI"
        headerLabel.font = .systemFont(ofSize: 15, weight: .bold)

        // Tone pills inside a scroll view
        toneStack.translatesAutoresizingMaskIntoConstraints = false
        toneScrollView.addSubview(toneStack)
        NSLayoutConstraint.activate([
            toneStack.topAnchor.constraint(equalTo: toneScrollView.topAnchor),
            toneStack.leadingAnchor.constraint(equalTo: toneScrollView.leadingAnchor),
            toneStack.trailingAnchor.constraint(equalTo: toneScrollView.trailingAnchor),
            toneStack.bottomAnchor.constraint(equalTo: toneScrollView.bottomAnchor),
            toneStack.heightAnchor.constraint(equalTo: toneScrollView.heightAnchor),
        ])

        [headerLabel, modeControl, toneScrollView, pasteButton, imagePreview,
         generateButton, activityIndicator, errorLabel, suggestionsHeader, suggestionsStack]
            .forEach { contentStack.addArrangedSubview($0) }
    }

    private func makeBottomBar() -> UIView {
        let bar = UIView()
        bar.backgroundColor = UIColor.secondarySystemBackground

        let nextBtn = UIButton(type: .system)
        nextBtn.setImage(UIImage(systemName: "globe"), for: .normal)
        nextBtn.tintColor = .secondaryLabel
        nextBtn.addTarget(self, action: #selector(nextKeyboard), for: .allTouchEvents)

        let deleteBtn = UIButton(type: .system)
        deleteBtn.setImage(UIImage(systemName: "delete.left"), for: .normal)
        deleteBtn.tintColor = .secondaryLabel
        deleteBtn.addTarget(self, action: #selector(deleteBack), for: .touchUpInside)

        let privacyLabel = UILabel()
        privacyLabel.text = "No keystrokes logged"
        privacyLabel.font = .systemFont(ofSize: 10)
        privacyLabel.textColor = .tertiaryLabel

        for v in [nextBtn, privacyLabel, deleteBtn] {
            v.translatesAutoresizingMaskIntoConstraints = false
            bar.addSubview(v)
        }

        NSLayoutConstraint.activate([
            nextBtn.leadingAnchor.constraint(equalTo: bar.leadingAnchor, constant: 12),
            nextBtn.centerYAnchor.constraint(equalTo: bar.centerYAnchor),
            nextBtn.widthAnchor.constraint(equalToConstant: 44),
            nextBtn.heightAnchor.constraint(equalToConstant: 44),

            privacyLabel.centerXAnchor.constraint(equalTo: bar.centerXAnchor),
            privacyLabel.centerYAnchor.constraint(equalTo: bar.centerYAnchor),

            deleteBtn.trailingAnchor.constraint(equalTo: bar.trailingAnchor, constant: -12),
            deleteBtn.centerYAnchor.constraint(equalTo: bar.centerYAnchor),
            deleteBtn.widthAnchor.constraint(equalToConstant: 44),
            deleteBtn.heightAnchor.constraint(equalToConstant: 44),
        ])

        return bar
    }

    private func buildTonePills() {
        for tone in TONES {
            var cfg = UIButton.Configuration.filled()
            cfg.title = "\(tone.emoji) \(tone.label)"
            cfg.cornerStyle = .capsule
            cfg.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12)
            let btn = UIButton(configuration: cfg)
            btn.accessibilityIdentifier = tone.id
            btn.addTarget(self, action: #selector(toneTapped(_:)), for: .touchUpInside)
            tonePills.append(btn)
            toneStack.addArrangedSubview(btn)
        }
        refreshTonePills()
    }

    private func refreshTonePills() {
        for btn in tonePills {
            let isSelected = btn.accessibilityIdentifier == selectedTone.id
            var cfg = btn.configuration
            cfg?.baseBackgroundColor = isSelected
                ? UIColor(red: 0.96, green: 0.24, blue: 0.37, alpha: 1)
                : UIColor.systemGray5
            cfg?.baseForegroundColor = isSelected ? .white : .label
            btn.configuration = cfg
        }
    }

    // MARK: - Actions

    @objc private func modeChanged() {
        selectedMode = modeControl.selectedSegmentIndex == 0 ? "opener" : "reply"
        clearSuggestions()
    }

    @objc private func toneTapped(_ sender: UIButton) {
        guard let id = sender.accessibilityIdentifier,
              let tone = TONES.first(where: { $0.id == id }) else { return }
        selectedTone = tone
        refreshTonePills()
        clearSuggestions()
    }

    @objc private func pasteImage() {
        guard hasFullAccess else {
            showError("Full Access is required to make API calls.\n\nEnable it: Settings → General → Keyboard → Keyboards → MatchCraft → Allow Full Access")
            return
        }

        if let img = UIPasteboard.general.image {
            pastedImage = img
            imagePreview.image = img
            imagePreview.isHidden = false
            var cfg = pasteButton.configuration
            cfg?.title = "✓ Screenshot ready"
            cfg?.baseBackgroundColor = .systemGreen
            pasteButton.configuration = cfg
            errorLabel.isHidden = true
        } else {
            showError("No image in clipboard.\n\nTake or screenshot the profile, copy it, then come back here and tap Paste.")
        }
    }

    @objc private func generateTapped() {
        guard hasFullAccess else {
            showError("Full Access required. Enable it in Settings → General → Keyboard → Keyboards → MatchCraft → Allow Full Access")
            return
        }
        guard let image = pastedImage else {
            showError("Paste a screenshot first.")
            return
        }
        guard !isLoading else { return }

        guard let jpegData = image.jpegData(compressionQuality: 0.8) else {
            showError("Could not process the image.")
            return
        }

        isLoading = true
        generateButton.isEnabled = false
        activityIndicator.startAnimating()
        errorLabel.isHidden = true
        clearSuggestions()

        APIClient.shared.generate(
            imageBase64: jpegData.base64EncodedString(),
            tone: selectedTone.id,
            mode: selectedMode
        ) { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isLoading = false
                self.generateButton.isEnabled = true
                self.activityIndicator.stopAnimating()
                switch result {
                case .success(let suggestions):
                    self.showSuggestions(suggestions)
                case .failure(let err):
                    self.showError(err.localizedDescription)
                }
            }
        }
    }

    @objc private func nextKeyboard() {
        advanceToNextInputMode()
    }

    @objc private func deleteBack() {
        textDocumentProxy.deleteBackward()
    }

    // MARK: - Suggestions display

    private func clearSuggestions() {
        suggestionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        suggestionsStack.isHidden = true
        suggestionsHeader.isHidden = true
    }

    private func showSuggestions(_ texts: [String]) {
        clearSuggestions()
        suggestionsHeader.isHidden = false
        suggestionsStack.isHidden = false

        for (i, text) in texts.enumerated() {
            let card = makeSuggestionCard(text: text, index: i)
            suggestionsStack.addArrangedSubview(card)
        }

        // Scroll down to show results
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            guard let self else { return }
            let bottom = CGPoint(
                x: 0,
                y: max(0, self.scrollView.contentSize.height - self.scrollView.bounds.height)
            )
            self.scrollView.setContentOffset(bottom, animated: true)
        }
    }

    private func makeSuggestionCard(text: String, index: Int) -> UIView {
        let card = UIView()
        card.backgroundColor = UIColor.secondarySystemBackground
        card.layer.cornerRadius = 10
        card.layer.borderWidth = 1
        card.layer.borderColor = UIColor.separator.cgColor

        let badge = UILabel()
        badge.text = "\(index + 1)"
        badge.font = .systemFont(ofSize: 11, weight: .bold)
        badge.textColor = .white
        badge.textAlignment = .center
        badge.backgroundColor = UIColor(red: 0.96, green: 0.24, blue: 0.37, alpha: 1)
        badge.layer.cornerRadius = 10
        badge.clipsToBounds = true

        let label = UILabel()
        label.text = text
        label.font = .systemFont(ofSize: 13)
        label.numberOfLines = 0

        let insertBtn = UIButton(type: .system)
        insertBtn.setTitle("Insert", for: .normal)
        insertBtn.titleLabel?.font = .systemFont(ofSize: 12, weight: .semibold)
        insertBtn.setTitleColor(UIColor(red: 0.96, green: 0.24, blue: 0.37, alpha: 1), for: .normal)
        insertBtn.accessibilityValue = text
        insertBtn.addTarget(self, action: #selector(insertTapped(_:)), for: .touchUpInside)

        for v in [badge, label, insertBtn] {
            v.translatesAutoresizingMaskIntoConstraints = false
            card.addSubview(v)
        }

        NSLayoutConstraint.activate([
            badge.topAnchor.constraint(equalTo: card.topAnchor, constant: 10),
            badge.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 10),
            badge.widthAnchor.constraint(equalToConstant: 20),
            badge.heightAnchor.constraint(equalToConstant: 20),

            label.topAnchor.constraint(equalTo: card.topAnchor, constant: 10),
            label.leadingAnchor.constraint(equalTo: badge.trailingAnchor, constant: 8),
            label.trailingAnchor.constraint(equalTo: insertBtn.leadingAnchor, constant: -8),
            label.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -10),

            insertBtn.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            insertBtn.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -12),
            insertBtn.widthAnchor.constraint(equalToConstant: 50),
        ])

        return card
    }

    @objc private func insertTapped(_ sender: UIButton) {
        guard let text = sender.accessibilityValue else { return }
        textDocumentProxy.insertText(text)

        // Pulse feedback
        UIView.animate(withDuration: 0.08, animations: {
            sender.transform = CGAffineTransform(scaleX: 0.92, y: 0.92)
        }) { _ in
            UIView.animate(withDuration: 0.08) { sender.transform = .identity }
        }
    }

    private func showError(_ message: String) {
        errorLabel.text = message
        errorLabel.isHidden = false
    }
}
