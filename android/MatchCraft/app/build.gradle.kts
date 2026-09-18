plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.matchcraft.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.matchcraft.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "3.0"

        // Update this to your deployed Cloudflare Worker URL
        buildConfigField(
            "String",
            "WORKER_BASE_URL",
            "\"https://matchcraft-api.YOUR-NAME.workers.dev\""
        )
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.constraintlayout)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.lifecycle.runtime.ktx)
}
