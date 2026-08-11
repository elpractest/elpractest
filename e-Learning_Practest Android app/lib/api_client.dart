import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// API base URL. Override at build time for production:
///   flutter build apk --dart-define=API_BASE_URL=https://api.practest.live/api
/// Default targets the Laravel dev server as seen from an Android emulator
/// (10.0.2.2 == host loopback).
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8000/api',
);

/// Sent on every request. Without this, Dio identifies itself as
/// `Dart/3.x (dart:io)`, which the API host's Imunify360 bot-protection treats
/// as automation. A stable, identifiable agent is also what you whitelist or
/// rate-limit against server-side.
const String userAgent = 'PractestApp/1.0.0 (Android)';

class ApiException implements Exception {
  ApiException(this.statusCode, this.message);

  final int? statusCode;
  final String message;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._() {
    _dio = Dio(
      BaseOptions(
        baseUrl: apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 60),
        headers: {
          'Accept': 'application/json',
          'User-Agent': userAgent,
        },
      ),
    );
  }

  static final ApiClient instance = ApiClient._();
  late final Dio _dio;

  static const _tokenKey = 'auth_token';
  static const _tokenStorageKey = 'auth_token_stored';

  /// Callback invoked when any request returns 401 (token expired/revoked).
  void Function()? onUnauthorized;

  String? get token =>
      _dio.options.headers['Authorization'] as String?;

  bool get hasToken => token != null && token!.isNotEmpty;

  void _setToken(String? value) {
    _dio.options.headers['Authorization'] = value != null ? 'Bearer $value' : null;
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_tokenKey);
    _setToken(stored);
  }

  Future<void> storeToken(String value) async {
    _setToken(value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, value);
    await prefs.setBool(_tokenStorageKey, true);
  }

  Future<void> clearToken() async {
    _setToken(null);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_tokenStorageKey);
  }

  /// Extract a friendly message from an error response.
  static String _extractMessage(DioException e, {String fallback = 'Something went wrong.'}) {
    final data = e.response?.data;
    if (data is Map) {
      final message = data['message'];
      if (message is String && message.isNotEmpty) return message;
      final errors = data['errors'];
      if (errors is Map) {
        for (final entry in errors.entries) {
          final v = entry.value;
          if (v is List && v.isNotEmpty) return v.first.toString();
          if (v is String) return v;
        }
      }
    }
    if (e.response?.statusCode == 401) return 'Please sign in again.';
    return fallback;
  }

  Never _throw(DioException e) {
    final status = e.response?.statusCode;
    if (status == 401) {
      final cb = onUnauthorized;
      if (cb != null) {
        scheduleMicrotask(cb);
      }
    }
    throw ApiException(status, _extractMessage(e));
  }

  /// GET with dynamic result: some endpoints return a JSON object
  /// (`{...}`), others a bare JSON array (`[...]`). Returning `dynamic`
  /// lets callers handle either shape instead of hitting a type error.
  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final res = await _dio.get(path, queryParameters: query);
      return res.data ?? {};
    } on DioException catch (e) {
      _throw(e);
    }
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    FormData? formData,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        path,
        data: formData ?? body,
        options: Options(
          contentType: formData != null ? null : Headers.jsonContentType,
        ),
      );
      return res.data ?? {};
    } on DioException catch (e) {
      _throw(e);
    }
  }

  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    try {
      final res = await _dio.put<Map<String, dynamic>>(
        path,
        data: body,
        options: Options(contentType: Headers.jsonContentType),
      );
      return res.data ?? {};
    } on DioException catch (e) {
      _throw(e);
    }
  }

  Future<void> postRaw(String path, {Map<String, dynamic>? body}) async {
    try {
      await _dio.post(path, data: body,
        options: Options(contentType: Headers.jsonContentType));
    } on DioException catch (e) {
      _throw(e);
    }
  }
}

/// Safely extract a JSON array from a decoded response body that may be
/// a bare array (`[...]`) or an object holding the list under [key]
/// (`{key: [...]}`). Returns an empty list for anything else.
List<dynamic> extractList(dynamic data, [String? key]) {
  if (data is List) return data;
  if (data is Map) {
    if (key != null && data[key] is List) return data[key] as List;
  }
  return const [];
}

/// Multipart helper for activation-request proof upload.
Future<FormData> buildProofFormData({
  required int batchId,
  required String paymentReference,
  required File proofFile,
}) async {
  return FormData.fromMap({
    'batch_id': batchId.toString(),
    'payment_reference': paymentReference,
    'proof_document': await MultipartFile.fromFile(
      proofFile.path,
      filename: proofFile.path.split(Platform.pathSeparator).last,
    ),
  });
}
