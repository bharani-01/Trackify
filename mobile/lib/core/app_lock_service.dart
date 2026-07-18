import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kAppLockEnabled = 'app_lock_enabled';
const _kBiometricEnabled = 'biometric_enabled';
const _kPinKey = 'trackify_app_pin';

class AppLockService extends ChangeNotifier {
  static final _storage = FlutterSecureStorage();
  static final _localAuth = LocalAuthentication();

  bool _lockEnabled = false;
  bool _biometricEnabled = false;
  bool _isLocked = true; // starts locked until authenticated
  bool _biometricAvailable = false;

  bool get lockEnabled => _lockEnabled;
  bool get biometricEnabled => _biometricEnabled;
  bool get isLocked => _isLocked;
  bool get biometricAvailable => _biometricAvailable;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _lockEnabled = prefs.getBool(_kAppLockEnabled) ?? false;
    _biometricEnabled = prefs.getBool(_kBiometricEnabled) ?? false;

    // Check if device supports biometrics
    try {
      _biometricAvailable = await _localAuth.canCheckBiometrics ||
          await _localAuth.isDeviceSupported();
    } catch (_) {
      _biometricAvailable = false;
    }

    // If lock is not enabled, the app is never "locked"
    if (!_lockEnabled) _isLocked = false;
    notifyListeners();
  }

  /// Lock the app (called when going to background)
  void lock() {
    if (_lockEnabled) {
      _isLocked = true;
      notifyListeners();
    }
  }

  /// Authenticate with biometrics
  Future<bool> authenticateWithBiometrics() async {
    try {
      final success = await _localAuth.authenticate(
        localizedReason: 'Authenticate to access Trackify',
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
      if (success) {
        _isLocked = false;
        notifyListeners();
      }
      return success;
    } catch (e) {
      debugPrint('[AppLock] Biometric error: $e');
      return false;
    }
  }

  /// Authenticate with PIN
  Future<bool> authenticateWithPin(String enteredPin) async {
    final savedPin = await _storage.read(key: _kPinKey);
    if (savedPin == enteredPin) {
      _isLocked = false;
      notifyListeners();
      return true;
    }
    return false;
  }

  /// Save a new PIN to secure storage
  Future<void> setPin(String pin) async {
    await _storage.write(key: _kPinKey, value: pin);
  }

  /// Check whether a PIN has been set
  Future<bool> hasPin() async {
    final pin = await _storage.read(key: _kPinKey);
    return pin != null && pin.isNotEmpty;
  }

  /// Remove PIN from secure storage
  Future<void> clearPin() async {
    await _storage.delete(key: _kPinKey);
  }

  Future<void> setLockEnabled(bool value) async {
    _lockEnabled = value;
    if (!value) _isLocked = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kAppLockEnabled, value);
    notifyListeners();
  }

  Future<void> setBiometricEnabled(bool value) async {
    _biometricEnabled = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kBiometricEnabled, value);
    notifyListeners();
  }
}
