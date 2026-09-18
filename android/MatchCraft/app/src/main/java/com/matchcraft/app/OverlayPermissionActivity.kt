package com.matchcraft.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.matchcraft.app.overlay.OverlayService

/**
 * Explains why the "Display over other apps" permission is needed, deep-links to
 * the system settings page, then detects on resume whether it was granted.
 */
class OverlayPermissionActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_overlay_permission)
        supportActionBar?.hide()

        // If already granted, jump straight to starting the service
        if (Settings.canDrawOverlays(this)) {
            startOverlayAndFinish()
            return
        }

        val btnGrant = findViewById<MaterialButton>(R.id.btn_grant_permission)
        val btnSkip = findViewById<MaterialButton>(R.id.btn_skip)

        btnGrant.setOnClickListener {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
        }

        btnSkip.setOnClickListener { finish() }
    }

    override fun onResume() {
        super.onResume()
        if (Settings.canDrawOverlays(this)) {
            startOverlayAndFinish()
        } else {
            // Update UI to re-prompt if user returned without granting
            findViewById<TextView?>(R.id.permission_status)?.apply {
                visibility = View.VISIBLE
                text = "Permission not yet granted — tap the button above to open Settings."
            }
        }
    }

    private fun startOverlayAndFinish() {
        val intent = OverlayService.startIntent(this)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        finish()
    }
}
