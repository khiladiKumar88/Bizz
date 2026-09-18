import UIKit

class MainViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        navigationController?.setNavigationBarHidden(false, animated: false)
        title = "MatchCraft 💘"
        view.backgroundColor = .systemBackground
        setupUI()
        checkKeyboardStatus()
    }

    // MARK: - UI

    private lazy var statusCard: UIView = makeStatusCard()
    private lazy var howToLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 20, weight: .bold)
        l.text = "How to use the keyboard"
        return l
    }()

    private func setupUI() {
        let steps = [
            ("1", "Open Tinder, Bumble, Hinge or Instagram"),
            ("2", "Tap any message field to open the keyboard"),
            ("3", "Switch to MatchCraft using the 🌐 globe key"),
            ("4", "Tap ✨, paste a screenshot, pick a tone"),
            ("5", "Tap a suggestion to insert it instantly"),
        ]

        let stepsStack = UIStackView()
        stepsStack.axis = .vertical
        stepsStack.spacing = 12

        for (num, text) in steps {
            let row = UIStackView()
            row.spacing = 12
            row.alignment = .center

            let badge = UILabel()
            badge.text = num
            badge.font = .systemFont(ofSize: 13, weight: .bold)
            badge.textColor = .white
            badge.textAlignment = .center
            badge.backgroundColor = UIColor(red: 0.96, green: 0.24, blue: 0.37, alpha: 1)
            badge.layer.cornerRadius = 13
            badge.clipsToBounds = true
            badge.translatesAutoresizingMaskIntoConstraints = false
            badge.widthAnchor.constraint(equalToConstant: 26).isActive = true
            badge.heightAnchor.constraint(equalToConstant: 26).isActive = true

            let label = UILabel()
            label.text = text
            label.font = .systemFont(ofSize: 15)
            label.numberOfLines = 0

            row.addArrangedSubview(badge)
            row.addArrangedSubview(label)
            stepsStack.addArrangedSubview(row)
        }

        let privacyCard = makePrivacyCard()

        let outerStack = UIStackView(arrangedSubviews: [statusCard, howToLabel, stepsStack, privacyCard])
        outerStack.axis = .vertical
        outerStack.spacing = 24
        outerStack.layoutMargins = UIEdgeInsets(top: 24, left: 20, bottom: 32, right: 20)
        outerStack.isLayoutMarginsRelativeArrangement = true
        outerStack.translatesAutoresizingMaskIntoConstraints = false

        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)
        scroll.addSubview(outerStack)

        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            outerStack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            outerStack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            outerStack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            outerStack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            outerStack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor),
        ])
    }

    private func makeStatusCard() -> UIView {
        let card = UIView()
        card.backgroundColor = UIColor.secondarySystemBackground
        card.layer.cornerRadius = 16

        let icon = UILabel()
        icon.font = .systemFont(ofSize: 28)

        let title = UILabel()
        title.font = .systemFont(ofSize: 15, weight: .semibold)

        let subtitle = UILabel()
        subtitle.font = .systemFont(ofSize: 13)
        subtitle.textColor = .secondaryLabel

        let textStack = UIStackView(arrangedSubviews: [title, subtitle])
        textStack.axis = .vertical
        textStack.spacing = 2

        let row = UIStackView(arrangedSubviews: [icon, textStack])
        row.spacing = 12
        row.alignment = .center
        row.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        row.isLayoutMarginsRelativeArrangement = true
        row.translatesAutoresizingMaskIntoConstraints = false

        card.addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: card.topAnchor),
            row.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            row.bottomAnchor.constraint(equalTo: card.bottomAnchor),
        ])

        // Store refs for dynamic update
        card.accessibilityElements = [icon, title, subtitle]
        icon.accessibilityIdentifier = "statusIcon"
        title.accessibilityIdentifier = "statusTitle"
        subtitle.accessibilityIdentifier = "statusSubtitle"

        return card
    }

    private func checkKeyboardStatus() {
        let keyboards = UserDefaults.standard.array(
            forKey: "AppleKeyboards"
        ) as? [String] ?? []
        let isEnabled = keyboards.contains("com.matchcraft.app.keyboard")

        guard let icon = statusCard.accessibilityElements?.first as? UILabel,
              let title = statusCard.accessibilityElements?[1] as? UILabel,
              let subtitle = statusCard.accessibilityElements?[2] as? UILabel
        else { return }

        if isEnabled {
            icon.text = "✅"
            title.text = "Keyboard is enabled"
            subtitle.text = "Switch to MatchCraft using the 🌐 key in any app"
            statusCard.backgroundColor = UIColor.systemGreen.withAlphaComponent(0.1)
        } else {
            icon.text = "⚠️"
            title.text = "Keyboard not enabled yet"
            subtitle.text = "Tap here to open Settings and add MatchCraft"
            statusCard.backgroundColor = UIColor.systemOrange.withAlphaComponent(0.1)

            let tap = UITapGestureRecognizer(target: self, action: #selector(openKeyboardSettings))
            statusCard.addGestureRecognizer(tap)
        }
    }

    private func makePrivacyCard() -> UIView {
        let card = UIView()
        card.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.06)
        card.layer.cornerRadius = 16

        let icon = UILabel()
        icon.text = "🔒"
        icon.font = .systemFont(ofSize: 24)

        let title = UILabel()
        title.text = "Your Privacy"
        title.font = .systemFont(ofSize: 15, weight: .bold)

        let body = UILabel()
        body.text = "MatchCraft does NOT log keystrokes, read messages you type, or store screenshots.\n\nThe keyboard only inserts and deletes text — it never reads the field you're typing in. Full Access is used solely to send an image you explicitly paste to the AI service. Nothing else is ever transmitted.\n\nStored on this device: a single flag recording that you finished onboarding. No message history. Screenshots are held in memory only while a request is in flight, then discarded."
        body.font = .systemFont(ofSize: 13)
        body.textColor = .secondaryLabel
        body.numberOfLines = 0

        let clearButton = UIButton(type: .system)
        clearButton.setTitle("Clear Local App Data", for: .normal)
        clearButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .medium)
        clearButton.contentHorizontalAlignment = .leading
        clearButton.addTarget(self, action: #selector(clearLocalData), for: .touchUpInside)

        let textStack = UIStackView(arrangedSubviews: [title, body, clearButton])
        textStack.axis = .vertical
        textStack.spacing = 4

        let row = UIStackView(arrangedSubviews: [icon, textStack])
        row.spacing = 12
        row.alignment = .top
        row.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        row.isLayoutMarginsRelativeArrangement = true
        row.translatesAutoresizingMaskIntoConstraints = false

        card.addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: card.topAnchor),
            row.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            row.bottomAnchor.constraint(equalTo: card.bottomAnchor),
        ])
        return card
    }

    @objc private func clearLocalData() {
        let alert = UIAlertController(
            title: "Clear Local App Data",
            message: "This clears the onboarding flag — the only thing MatchCraft stores on this device. Continue?",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Clear", style: .destructive) { _ in
            UserDefaults.standard.removeObject(forKey: "hasSeenOnboarding")
            let done = UIAlertController(
                title: nil, message: "Local app data cleared.", preferredStyle: .alert
            )
            done.addAction(UIAlertAction(title: "OK", style: .default))
            self.present(done, animated: true)
        })
        present(alert, animated: true)
    }

    @objc private func openKeyboardSettings() {
        guard let url = URL(string: "App-prefs:General&path=Keyboard/KEYBOARDS") else { return }
        UIApplication.shared.open(url)
    }
}
