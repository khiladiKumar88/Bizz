package com.matchcraft.app.keyboard

import com.matchcraft.app.BuildConfig
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Thin wrapper around the v1 Cloudflare Worker's /generate endpoint.
 * Uses OkHttp on a background thread; results are delivered via callback.
 * The Worker URL comes from BuildConfig so it's set per-build in build.gradle.kts.
 */
object APIClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    /**
     * WORKER_BASE_URL is hand-edited in build.gradle.kts, so a typo'd or pasted
     * "http://" value would silently ship screenshots in plaintext. Fail loudly
     * instead. Defence in depth behind network_security_config.xml.
     */
    private val baseUrl: String = BuildConfig.WORKER_BASE_URL.trimEnd('/').also {
        require(it.startsWith("https://")) {
            "WORKER_BASE_URL must use https:// — refusing to send screenshots over plaintext"
        }
    }

    sealed class Result {
        data class Success(val suggestions: List<String>) : Result()
        data class Error(val message: String) : Result()
    }

    fun generate(
        imageBase64: String,
        imageMediaType: String = "image/jpeg",
        tone: String,
        mode: String,
        platform: String? = null,
        onResult: (Result) -> Unit,
    ) {
        val body = JSONObject().apply {
            put("imageBase64", imageBase64)
            put("imageMediaType", imageMediaType)
            put("tone", tone)
            put("mode", mode)
            platform?.let { put("platform", it) }
        }

        val request = Request.Builder()
            .url("$baseUrl/generate")
            .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                onResult(Result.Error(e.message ?: "Network error"))
            }

            override fun onResponse(call: Call, response: Response) {
                val rawBody = response.body?.string() ?: run {
                    onResult(Result.Error("Empty response"))
                    return
                }

                runCatching {
                    val json = JSONObject(rawBody)

                    if (response.code == 429) {
                        onResult(Result.Error(json.optString("error", "Daily limit reached. Try again tomorrow 💘")))
                        return
                    }

                    val errorMsg = json.optString("error", "")
                    if (errorMsg.isNotEmpty()) {
                        onResult(Result.Error(errorMsg))
                        return
                    }

                    val arr = json.getJSONArray("suggestions")
                    val list = (0 until arr.length()).map { arr.getString(it) }

                    if (list.isEmpty()) {
                        onResult(Result.Error("No suggestions returned"))
                    } else {
                        onResult(Result.Success(list))
                    }
                }.onFailure { e ->
                    onResult(Result.Error("Parse error: ${e.message}"))
                }
            }
        })
    }
}
