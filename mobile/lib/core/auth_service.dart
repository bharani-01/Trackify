import 'package:flutter/foundation.dart';
import 'api_client.dart';

class AuthService extends ChangeNotifier {
  Map<String, dynamic>? _user;
  bool _loading = true;

  Map<String, dynamic>? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get loading => _loading;

  Future<void> tryAutoLogin() async {
    final token = await ApiClient.getToken();
    if (token != null) {
      final res = await ApiClient.get('/api/auth/me');
      if (res['success'] == true) {
        _user = res['user'];
      } else {
        await ApiClient.clearToken();
      }
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
      notifyListeners();
      return null;
    }
    return res['message'] ?? 'Login failed';
  }

  Future<void> logout() async {
    await ApiClient.post('/api/auth/logout', {});
    await ApiClient.clearToken();
    _user = null;
    notifyListeners();
  }
}
