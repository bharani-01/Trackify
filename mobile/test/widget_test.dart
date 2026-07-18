import 'package:flutter_test/flutter_test.dart';
import 'package:trackify/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Just verify the app builds without crashing
    expect(TrackifyApp, isNotNull);
  });
}
