import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';

/// Persistent key used to cache user profile in SharedPreferences.
const _kCachedUser = 'trackify_cached_user';
/// How many days a cached session is considered valid without re-validation.
const _kSessionTtlDays = 30;
/// SharedPreferences key for the last session validation timestamp.
const _kLastValidated = 'trackify_last_validated';

class AuthService extends ChangeNotifier {
  Map<String, dynamic>? _user;
  bool _loading = true;

  Map<String, dynamic>? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get loading => _loading;

  /// Called once at app startup.
  /// Strategy:
  /// 1. Load cached user from SharedPreferences immediately (instant UI).
  /// 2. If a token exists AND the last API validation is >1 hour old, silently
  ///    re-validate with /api/auth/me.
  /// 3. If the API fails (offline / expired), keep the cached session alive up
  ///    to [_kSessionTtlDays] days, then force re-login.
  Future<void> tryAutoLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final token = await ApiClient.getToken();
    final cachedJson = prefs.getString(_kCachedUser);
    final lastValidated = prefs.getInt(_kLastValidated) ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    final daysSinceValidation = (now - lastValidated) / (1000 * 60 * 60 * 24);

    if (token != null) {
      if (cachedJson != null) {
        try {
          _user = jsonDecode(cachedJson) as Map<String, dynamic>;
        } catch (_) {}
      }

      if (_user == null || daysSinceValidation > (1 / 24)) {
        final res = await ApiClient.get('/api/auth/me');
        if (res['success'] == true) {
          _user = res['user'];
          await prefs.setString(_kCachedUser, jsonEncode(_user));
          await prefs.setInt(_kLastValidated, now);
        } else {
          if (_user == null || daysSinceValidation > _kSessionTtlDays) {
            debugPrint('[AuthService] Auto-login failed: session invalid or unreachable.');
            await _clearSession(prefs);
          }
        }
      }
    } else {
      _user = null;
    }

    _loading = false;
    notifyListeners();
  }

  Future<String?> login(String email, String password) async {
    final res = await ApiClient.post('/api/auth/login', {
      'email': email,
      'password': password,
    });
    if (res['success'] == true) {
      if (res['token'] != null) await ApiClient.saveToken(res['token']);
      _user = res['user'];

      // Persist session to SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kCachedUser, jsonEncode(_user));
      await prefs.setInt(_kLastValidated, DateTime.now().millisecondsSinceEpoch);

      notifyListeners();
      return null;
    }
    return res['message'] ?? 'Login failed';
  }

  Future<void> logout() async {
    try {
      await ApiClient.post('/api/auth/logout', {});
    } catch (_) {}
    await ApiClient.clearToken();
    final prefs = await SharedPreferences.getInstance();
    await _clearSession(prefs);
  }

  Future<void> _clearSession(SharedPreferences prefs) async {
    await ApiClient.clearToken();
    await prefs.remove(_kCachedUser);
    await prefs.remove(_kLastValidated);
    _user = null;
    notifyListeners();
  }
}
