import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'api_client.dart';
import 'app.dart';
import 'i18n.dart';
import 'push_service.dart';
import 'scaffold.dart';
import 'session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  assertProductionApiUrl(); // release builds must target the live API, not dev
  await initializeDateFormatting('en_IN');
  await ThemeController.instance.init();
  await Session.instance.init();
  await I18n.instance.init();

  // Push: initialise Firebase and wire FCM, then register this device if the
  // session was already restored above. A Firebase hiccup must not block launch.
  try {
    await Firebase.initializeApp();
    await PushService.instance.init();
    if (Session.instance.isAuthenticated) {
      PushService.instance.registerToken();
    }
  } catch (_) {
    // The app runs fine without push.
  }

  runApp(const PractestApp());
}
