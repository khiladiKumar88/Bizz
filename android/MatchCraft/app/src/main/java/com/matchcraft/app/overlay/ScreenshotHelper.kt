package com.matchcraft.app.overlay

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.provider.MediaStore

/**
 * Queries MediaStore for the most recently added image so the user
 * doesn't have to navigate a picker — they just take a screenshot in the
 * dating app then tap the bubble.
 */
object ScreenshotHelper {

    fun latestImage(ctx: Context): Bitmap? = runCatching {
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        else
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI

        val projection = arrayOf(MediaStore.Images.Media._ID)
        val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"

        ctx.contentResolver.query(collection, projection, null, null, sortOrder)
            ?.use { cursor ->
                if (!cursor.moveToFirst()) return@use null
                val id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID))
                val uri = android.net.Uri.withAppendedPath(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id.toString()
                )
                ctx.contentResolver.openInputStream(uri)?.use { stream ->
                    val opts = BitmapFactory.Options().apply {
                        inSampleSize = 2 // halve resolution on load to save memory
                    }
                    BitmapFactory.decodeStream(stream, null, opts)
                }
            }
    }.getOrNull()
}
