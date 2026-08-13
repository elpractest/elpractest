import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'i18n.dart';
import 'scaffold.dart';
import 'session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('en_IN');
  await ThemeController.instance.init();
  await Session.instance.init();
  await I18n.instance.init();
  runApp(const PractestApp());
}
