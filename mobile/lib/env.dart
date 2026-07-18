import 'package:flutter_dotenv/flutter_dotenv.dart';

class Env {
  static String get apiBaseUrl =>
      dotenv.env['API_BASE_URL'] ?? 'https://trackify-z5y3.onrender.com';
  static int get apiTimeout =>
      int.tryParse(dotenv.env['API_TIMEOUT'] ?? '15000') ?? 15000;
  static String get appVersion => dotenv.env['APP_VERSION'] ?? '1.0.0';
  static String get appBuild => dotenv.env['APP_BUILD'] ?? '1';
  static String get appOrg =>
      dotenv.env['APP_ORG'] ?? 'com.forwardstudio.trackify';
}
