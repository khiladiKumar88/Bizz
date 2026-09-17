import UIKit

private struct Step {
    let emoji: String
    let title: String
    let body: String
    let buttonTitle: String
    let buttonAction: OnboardingViewController.StepAction
}

class OnboardingViewController: UIViewController {

    enum StepAction {
        case next
        case openKeyboardSettings
        case openFullAccessSettings
        case finish
    }

    // MARK: - Steps

    private let steps: [Step] = [
        Step(
            emoji: "💘",
            title: "Welcome to MatchCraft",
            body: "Your AI wingman for Tinder, Bumble, Hinge & Instagram DMs.\n\nGet 5 clever, personalised replies in seconds — right from your keyboard, without leaving the app.",
            buttonTitle: "Get Started →",
            buttonAction: .next
        ),
        Step(
            emoji: "⌨️",
            title: "Enable the Keyboard",
            body: "To use MatchCraft while typing in a dating app, you need to add it as a keyboard.\n\nGo to:\nSettings → General → Keyboard → Keyboards → Add New Keyboard\n\nSelect "MatchCraft" from the list.",
            buttonTitle: "Open Keyboard Settings",
            buttonAction: .openKeyboardSettings
        ),
        Step(
            emoji: "🔒",
            title: "Allow Full Access",
            body: "MatchCraft needs Full Access to reach the AI over the internet.\n\n⚡ Privacy promise:\nWe NEVER log your keystrokes or read anything you type. Full Access is used only to send the screenshot you explicitly choose — nothing else, ever.\n\nEnable it in:\nSettings → General → Keyboard → Keyboards → MatchCraft → Allow Full Access",
            buttonTitle: "Open Settings",
            buttonAction: .openFullAccessSettings
        ),
        Step(
            emoji: "✅",
            title: "You're All Set!",
            body: "Here's how to use it:\n\n1. Open Tinder, Bumble, Hinge or Instagram\n2. Tap any text field to bring up the keyboard\n3. Switch to MatchCraft using the 🌐 key\n4. Tap ✨, paste a screenshot, pick a tone\n5. Tap a suggestion to insert it instantly",
            buttonTitle: "Start Using MatchCraft 🚀",
            buttonAction: .finish
        ),
    ]

    private var currentIndex = 0

    // MARK: - UI

    private lazy var progressStack: UIStackView = {
        let sv = UIStackView()
        sv.axis = .horizontal
        sv.spacing = 6
        sv.alignment = .center
        for _ in steps {
            let dot = UIView()
            dot.layer.cornerRadius = 4
            dot.translatesAutoresizingMaskIntoConstraints = false
            dot.widthAnchor.constraint(equalToConstant: 8).isActive = true
            dot.heightAnchor.constraint(equalToConstant: 8).isActive = true
            sv.addArrangedSubview(dot)
        }
        return sv
    }()

    private lazy var emojiLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 72)
        l.textAlignment = .center
        return l
    }()

    private lazy var titleLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 26, weight: .bold)
        l.textAlignment = .center
        l.numberOfLines = 0
        return l
    }()

    private lazy var bodyLabel: UILabel = {
        let l = UILabel()
        l.font = .systemFont(ofSize: 16)
        l.textAlignment = .center
        l.textColor = .secondaryLabel
        l.numberOfLines = 0
        l.lineBreakMode = .byWordWrapping
        return l
    }()

    private lazy var actionButton: UIButton = {
        var config = UIButton.Configuration.filled()
        config.cornerStyle = .large
        config.baseBackgroundColor = UIColor(red: 0.96, green: 0.24, blue: 0.37, alpha: 1)
        config.baseForegroundColor = .white
        config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attrs in
            var a = attrs
            a.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
            return a
        }
        config.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 24, bottom: 16, trailing: 24)
        let btn = UIButton(configuration: config)
        btn.addTarget(self, action: #selector(actionTapped), for: .touchUpInside)
        return btn
    }()

    private lazy var skipButton: UIButton = {
        let btn = UIButton(type: .system)
        btn.setTitle("Skip", for: .normal)
        btn.setTitleColor(.tertiaryLabel, for: .normal)
        btn.addTarget(self, action: #selector(skipTapped), for: .touchUpInside)
        return btn
    }()

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        navigationController?.setNavigationBarHidden(true, animated: false)
        setupLayout()
        render(animated: false)
    }

    // MARK: - Layout

    private func setupLayout() {
        view.backgroundColor = .systemBackground

        // Gradient background
        let gradientLayer = CAGradientLayer()
        gradientLayer.colors = [
            UIColor(red: 0.96, green: 0.24, blue: 0.37, alpha: 0.07).cgColor,
            UIColor.systemBackground.cgColor,
        ]
        gradientLayer.frame = view.bounds
        view.layer.insertSublayer(gradientLayer, at: 0)

        let contentStack = UIStackView(arrangedSubviews: [emojiLabel, titleLabel, bodyLabel])
        contentStack.axis = .vertical
        contentStack.spacing = 16
        contentStack.alignment = .center

        let outerStack = UIStackView(arrangedSubviews: [progressStack, contentStack, actionButton, skipButton])
        outerStack.axis = .vertical
        outerStack.spacing = 32
        outerStack.alignment = .center
        outerStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(outerStack)

        NSLayoutConstraint.activate([
            outerStack.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -20),
            outerStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            outerStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),

            actionButton.leadingAnchor.constraint(equalTo: outerStack.leadingAnchor),
            actionButton.trailingAnchor.constraint(equalTo: outerStack.trailingAnchor),
        ])
    }

    // MARK: - Rendering

    private func render(animated: Bool) {
        let step = steps[currentIndex]
        let block = {
            self.emojiLabel.text = step.emoji
            self.titleLabel.text = step.title
            self.bodyLabel.text = step.body
            self.actionButton.setTitle(step.buttonTitle, for: .normal)
            self.skipButton.isHidden = currentIndex == steps.count - 1

            for (i, dot) in self.progressStack.arrangedSubviews.enumerated() {
                dot.backgroundColor = i == self.currentIndex
                    ? UIColor(red: 0.96, green: 0.24, blue: 0.37, alpha: 1)
                    : UIColor.systemGray4
            }
        }

        if animated {
            UIView.transition(with: view, duration: 0.25, options: .transitionCrossDissolve, animations: block)
        } else {
            block()
        }
    }

    // MARK: - Actions

    @objc private func actionTapped() {
        let step = steps[currentIndex]
        switch step.buttonAction {
        case .next:
            advance()
        case .openKeyboardSettings:
            openURL("App-prefs:General&path=Keyboard/KEYBOARDS")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.advance() }
        case .openFullAccessSettings:
            openURL("App-prefs:General&path=Keyboard/KEYBOARDS")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.advance() }
        case .finish:
            UserDefaults.standard.set(true, forKey: "hasSeenOnboarding")
            let main = MainViewController()
            navigationController?.setViewControllers([main], animated: true)
        }
    }

    @objc private func skipTapped() {
        UserDefaults.standard.set(true, forKey: "hasSeenOnboarding")
        let main = MainViewController()
        navigationController?.setViewControllers([main], animated: true)
    }

    private func advance() {
        guard currentIndex < steps.count - 1 else { return }
        currentIndex += 1
        render(animated: true)
    }

    private func openURL(_ string: String) {
        guard let url = URL(string: string) else { return }
        UIApplication.shared.open(url)
    }
}
