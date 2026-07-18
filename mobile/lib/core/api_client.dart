import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';
import '../env.dart';

class ApiClient {
  static const _tokenKey = 'trackify_token';
  static String? lastError;

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<void> saveToken(String t) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, t);
  }

  static Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

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
    // Sanitize base URL and path to avoid double slash issues
    var baseUrl = Env.apiBaseUrl.trim();
    while (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.substring(0, baseUrl.length - 1);
    }
    
    var cleanPath = path.trim();
    while (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }

    final url = Uri.parse('$baseUrl/$cleanPath');
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

      // Check and automatically extract cookie tokens (Set-Cookie fallback)
      final setCookie = response.headers['set-cookie'];
      if (setCookie != null && setCookie.contains('token=')) {
        final reg = RegExp(r'token=([^;]+)');
        final match = reg.firstMatch(setCookie);
        if (match != null && match.groupCount >= 1) {
          final cookieToken = match.group(1);
          if (cookieToken != null && cookieToken != 'none' && cookieToken.isNotEmpty) {
            await saveToken(cookieToken);
          }
        }
      }

      if (response.statusCode >= 400) {
        lastError = 'HTTP ${response.statusCode}: ${response.body}\nURL: $url\nMethod: $method\nHeaders: $headers';
        try {
          final data = jsonDecode(response.body);
          if (data is Map<String, dynamic>) {
            return {
              'success': false,
              'message': data['message'] ?? 'Server error (${response.statusCode})',
              'error_details': lastError,
            };
          }
        } catch (_) {}
        return {
          'success': false,
          'message': 'HTTP Error ${response.statusCode}',
          'error_details': lastError,
        };
      }

      final data = jsonDecode(response.body);
      if (data is Map<String, dynamic>) {
        // Fallback: If backend returns a token in the body, save it
        if (data['success'] == true && data['token'] != null) {
          await saveToken(data['token'].toString());
        }
        return data;
      }
      
      lastError = 'Invalid JSON: ${response.body}\nURL: $url';
      return {
        'success': false,
        'message': 'Invalid server response format.',
        'error_details': lastError,
      };
    } catch (e) {
      lastError = 'Exception: $e\nURL: $url\nMethod: $method';
      debugPrint('[ApiClient ERROR] $method $path → $e');
      return {
        'success': false,
        'message': 'Connection failed. Check network or server status.',
        'error_details': lastError,
      };
    }
  }
}
