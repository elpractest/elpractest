package com.practest.practest_app

import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onStart() {
        super.onStart()
        // SECURITY: prevent screenshots and screen recording (exam-integrity requirement).
        // FLAG_SECURE hides app content in recents, on screenshots, and on screen capture.
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
    }
}
