import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';
import '../env.dart';

class ApiClient {
  static final _storage = FlutterSecureStorage();
  static const _tokenKey = 'trackify_token';

  static Future<String?> getToken() => _storage.read(key: _tokenKey);
  static Future<void> saveToken(String t) => _storage.write(key: _tokenKey, value: t);
  static Future<void> clearToken() => _storage.delete(key: _tokenKey);

  static Future<Map<String, dynamic>> get(String path) async {
    return _request('GET', path);
  }

  static Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    return _request('POST', path, body: body);
  }

  static Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    return _request('PUT', path, body: body);
  }

  static Future<Map<String, dynamic>> delete(String path) async {
    return _request('DELETE', path);
  }

  static Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final url = Uri.parse('${Env.apiBaseUrl}$path');
    final token = await getToken();
    final headers = {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };

    try {
      http.Response response;
      final timeout = Duration(milliseconds: Env.apiTimeout);

      if (method == 'GET') {
        response = await http.get(url, headers: headers).timeout(timeout);
      } else if (method == 'PUT') {
        response = await http.put(url, headers: headers, body: jsonEncode(body)).timeout(timeout);
      } else if (method == 'DELETE') {
        response = await http.delete(url, headers: headers).timeout(timeout);
      } else {
        response = await http.post(url, headers: headers, body: jsonEncode(body)).timeout(timeout);
      }

      return jsonDecode(response.body) as Map<String, dynamic>;
    } catch (e) {
      debugPrint('[ApiClient ERROR] $method $path → $e');
      return {'success': false, 'message': 'Network error. Please try again.'};
    }
  }
}
