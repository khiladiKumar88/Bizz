import Foundation

// Update this to your deployed Cloudflare Worker URL (no trailing slash)
let WORKER_BASE_URL = "https://matchcraft-api.YOUR-NAME.workers.dev"

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case serverError(String)
    case decodingError
    case rateLimitExceeded(String)
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid API URL — WORKER_BASE_URL in APIClient.swift must be a valid https:// address"
        case .noData: return "No response received"
        case .serverError(let msg): return msg
        case .decodingError: return "Unexpected response format"
        case .rateLimitExceeded(let msg): return msg
        case .networkError(let e): return e.localizedDescription
        }
    }
}

final class APIClient {

    static let shared = APIClient()
    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        return URLSession(configuration: config)
    }()

    func generate(
        imageBase64: String,
        imageMediaType: String = "image/jpeg",
        tone: String,
        mode: String,
        platform: String? = nil,
        completion: @escaping (Result<[String], APIError>) -> Void
    ) {
        // WORKER_BASE_URL is hand-edited above, so a typo'd or pasted "http://"
        // value would silently ship screenshots in plaintext. Reject anything
        // that is not HTTPS. Defence in depth behind App Transport Security.
        guard let url = URL(string: "\(WORKER_BASE_URL)/generate"),
              url.scheme?.lowercased() == "https" else {
            completion(.failure(.invalidURL))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: Any] = [
            "imageBase64": imageBase64,
            "imageMediaType": imageMediaType,
            "tone": tone,
            "mode": mode,
        ]
        if let platform { body["platform"] = platform }

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(.failure(.networkError(error)))
            return
        }

        session.dataTask(with: request) { data, response, error in
            if let error {
                completion(.failure(.networkError(error)))
                return
            }

            guard let data else {
                completion(.failure(.noData))
                return
            }

            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                completion(.failure(.decodingError))
                return
            }

            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 200

            if statusCode == 429, let msg = json["error"] as? String {
                completion(.failure(.rateLimitExceeded(msg)))
                return
            }

            if let errorMsg = json["error"] as? String {
                completion(.failure(.serverError(errorMsg)))
                return
            }

            guard let suggestions = json["suggestions"] as? [String], !suggestions.isEmpty else {
                completion(.failure(.decodingError))
                return
            }

            completion(.success(suggestions))
        }.resume()
    }
}
