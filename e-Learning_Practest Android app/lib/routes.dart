import 'package:flutter/material.dart';

import 'screens/auth/forgot_password_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/auth/verify_email_notice_screen.dart';
import 'screens/course_outline_screen.dart';
import 'screens/lesson_player_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/search_screen.dart';
import 'screens/test_result_screen.dart';
import 'screens/test_series_screen.dart';
import 'screens/test_taking_screen.dart';
import 'screens/vajini_screen.dart';

/// One route table, replacing the imperative `MaterialPageRoute` pushes that
/// used to be scattered through the screens below the dashboard.
///
/// The point is not tidiness. Every one of those pushes named a widget *and*
/// its constructor arguments at the call site, so a screen could not be reached
/// from anywhere that did not already import it — which is how test series and
/// results ended up behind two unlabelled header glyphs. A table is a map of
/// the app, and anything on it is reachable from anywhere.
///
/// Transitions come from [AppTheme]'s `pageTransitionsTheme`: 180ms, eased out.
class Routes {
  Routes._();

  static const login = '/login';
  static const register = '/register';
  static const forgotPassword = '/forgot-password';
  static const verifyEmailNotice = '/verify-email-notice';

  static const courseOutline = '/course';
  static const lesson = '/lesson';
  static const testSeriesDetail = '/series';
  static const test = '/test';
  static const result = '/result';

  static const search = '/search';
  static const notifications = '/notifications';
  static const vajini = '/vajini';

  static Route<dynamic>? onGenerateRoute(RouteSettings settings) {
    Route<T> page<T>(Widget child) =>
        MaterialPageRoute<T>(builder: (_) => child, settings: settings);

    switch (settings.name) {
      case login:
        return page(const LoginScreen());
      case register:
        return page(const RegisterScreen());
      case forgotPassword:
        return page(const ForgotPasswordScreen());
      case verifyEmailNotice:
        return page(const VerifyEmailNoticeScreen());

      case courseOutline:
        return page(CourseOutlineScreen(courseId: settings.arguments! as int));
      case lesson:
        return page(LessonPlayerScreen(lessonId: settings.arguments! as int));
      case testSeriesDetail:
        return page(
          TestSeriesDetailScreen(seriesId: settings.arguments! as int),
        );
      case test:
        return page(TestTakingScreen(sessionId: settings.arguments! as int));
      case result:
        return page(TestResultScreen(sessionId: settings.arguments! as int));

      case search:
        return page(const SearchScreen());
      case notifications:
        return page(const NotificationsScreen());
      case vajini:
        return page(const VajiniScreen());
    }
    return null;
  }
}

/// Typed helpers, so an `int` argument cannot silently become the wrong `int`.
extension AppNavigation on BuildContext {
  Future<T?> openCourse<T>(int courseId) => Navigator.of(
    this,
  ).pushNamed<T>(Routes.courseOutline, arguments: courseId);

  Future<T?> openLesson<T>(int lessonId) =>
      Navigator.of(this).pushNamed<T>(Routes.lesson, arguments: lessonId);

  Future<T?> openSeries<T>(int seriesId) => Navigator.of(
    this,
  ).pushNamed<T>(Routes.testSeriesDetail, arguments: seriesId);

  Future<T?> openTest<T>(int sessionId) =>
      Navigator.of(this).pushNamed<T>(Routes.test, arguments: sessionId);

  Future<T?> openResult<T>(int sessionId) =>
      Navigator.of(this).pushNamed<T>(Routes.result, arguments: sessionId);

  Future<T?> openSearch<T>() => Navigator.of(this).pushNamed<T>(Routes.search);

  Future<T?> openNotifications<T>() =>
      Navigator.of(this).pushNamed<T>(Routes.notifications);

  Future<T?> openVajini<T>() => Navigator.of(this).pushNamed<T>(Routes.vajini);

  /// Submitting a paper replaces it rather than stacking on it, so `back`
  /// cannot return to a paper that has already been submitted.
  void replaceWithResult(int sessionId) => Navigator.of(
    this,
  ).pushReplacementNamed(Routes.result, arguments: sessionId);
}
