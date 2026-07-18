import 'legal_screen.dart';

/// Pre-built Privacy Policy screen
final privacyPolicyScreen = LegalScreen(
  badge: 'Legal',
  title: 'Privacy Policy',
  highlightNote:
      'Trackify is a student academic companion tool. We collect only the minimum data required to provide attendance tracking and scheduling features. We do not sell your data to any third party.',
  sections: const [
    LegalSection(
      title: '1. Who We Are',
      body:
          'Trackify ("we", "our", "us") is a student attendance tracking platform operated for academic institutions. This policy explains what personal information we collect, how we use it, and your rights over it.',
    ),
    LegalSection(
      title: '2. Information We Collect',
      bullets: [
        'Account Data: Your name, email address, department, semester, and registration number provided during sign-up.',
        'Attendance Records: Daily attendance status (Present / Absent / On Duty / Medical Leave) logged by you per subject.',
        'Timetable Data: Subject schedules and class periods you configure within the platform.',
        'Usage Preferences: Notification settings, reminder timer schedules, and attendance target thresholds set in your profile.',
        'Audit Logs: System-level logs of login events, profile changes, and administrative actions for security compliance.',
      ],
    ),
    LegalSection(
      title: '3. How We Use Your Information',
      bullets: [
        'To authenticate your account and maintain secure sessions.',
        'To calculate and display your real-time attendance percentages.',
        'To send scheduled reminder emails and low-attendance alerts you explicitly opt in to.',
        'To allow administrators to monitor aggregate platform health.',
        'To maintain security audit trails for compliance and abuse prevention.',
      ],
    ),
    LegalSection(
      title: '4. Data Storage & Security',
      body:
          'All data is stored in a PostgreSQL database hosted on a secured cloud provider. Passwords are hashed using bcrypt and never stored in plain text. Authentication uses short-lived JWT tokens stored securely on your device using platform keystore (Android Keystore / iOS Secure Enclave). We implement access control at the database layer — students can only access their own records.',
    ),
    LegalSection(
      title: '5. Email Notifications',
      body:
          'We send automated emails only when you explicitly enable them in your Settings page. These include daily attendance marking reminders and low-attendance threshold warnings. You may disable all email notifications at any time from your Student Profile settings.',
    ),
    LegalSection(
      title: '6. Data Sharing',
      body:
          'We do not sell, rent, or trade your personal data to any third party. The only external service we use is Resend (a transactional email provider) for dispatching system emails. Resend processes your email address solely for delivery purposes.',
    ),
    LegalSection(
      title: '7. Your Rights',
      bullets: [
        'Access: You may request a copy of all personal data we hold about you.',
        'Correction: You may update your name and email from the Student Settings page at any time.',
        'Deletion: You may contact your institution\'s Trackify administrator to request full account deletion.',
        'Opt-Out: You may disable all automated emails from your Student Profile preferences.',
      ],
    ),
    LegalSection(
      title: '8. Data Retention',
      body:
          'Academic attendance records are retained for the duration of your course enrollment and one academic year following graduation. After this period, records are purged. Audit logs are retained for up to 2 years for security compliance.',
    ),
    LegalSection(
      title: '9. Changes to This Policy',
      body:
          'We may update this Privacy Policy from time to time. We will notify registered users via email when material changes are made. Continued use of Trackify after such updates constitutes acceptance of the revised policy.',
    ),
    LegalSection(
      title: '10. Contact',
      body:
          'If you have questions about this Privacy Policy, contact your institution\'s system administrator or reach out via the Trackify support contact listed in your institution\'s academic portal.',
    ),
  ],
);

/// Pre-built Terms & Conditions screen
final termsScreen = LegalScreen(
  badge: 'Legal',
  title: 'Terms & Conditions',
  highlightNote:
      'By creating an account or using Trackify, you agree to these Terms. Please read them carefully. If you do not agree, you may not use the platform.',
  sections: const [
    LegalSection(
      title: '1. Acceptance of Terms',
      body:
          'These Terms and Conditions ("Terms") govern your access to and use of Trackify ("the Service"). By registering an account or accessing any part of the platform, you confirm that you have read, understood, and agreed to be bound by these Terms.',
    ),
    LegalSection(
      title: '2. Eligibility',
      body:
          'Trackify is intended for enrolled students and authorized academic staff at institutions that have deployed this platform. Use is restricted to individuals who have been granted account credentials by an authorized Trackify administrator. You must not share your login credentials with any other person.',
    ),
    LegalSection(
      title: '3. Acceptable Use',
      body: 'You agree to use Trackify only for legitimate academic attendance tracking purposes. You must not:',
      bullets: [
        'Enter false or fraudulent attendance records.',
        'Attempt to access another student\'s or administrator\'s account.',
        'Reverse engineer, scrape, or exploit any part of the platform.',
        'Use the platform to send unsolicited communications or spam.',
        'Perform any action that disrupts the service for other users.',
      ],
    ),
    LegalSection(
      title: '4. Account Responsibility',
      body:
          'You are solely responsible for maintaining the confidentiality of your password and account. You agree to notify an administrator immediately if you suspect unauthorized access. Trackify is not liable for losses resulting from unauthorized account use where you failed to safeguard your credentials.',
    ),
    LegalSection(
      title: '5. Data Accuracy',
      body:
          'Attendance records entered into Trackify are your responsibility. Trackify provides tools to help you track and analyze attendance but does not independently verify records against your institution\'s official system. Any discrepancies between Trackify data and official institutional records should be raised with your academic coordinator directly.',
    ),
    LegalSection(
      title: '6. Intellectual Property',
      body:
          'All software code, interface designs, and platform content comprising Trackify are the intellectual property of the platform developers. You are granted a limited, non-exclusive, non-transferable license to use the Service for your personal academic purposes only.',
    ),
    LegalSection(
      title: '7. Suspension & Termination',
      body:
          'Administrators may suspend or terminate your account at any time if they determine you have violated these Terms, misused the platform, or for any institutional policy reason. Upon account suspension, your access to all records will be revoked.',
    ),
    LegalSection(
      title: '8. Limitation of Liability',
      body:
          'Trackify is provided on an "as-is" and "as-available" basis. We make no warranties, express or implied, about the accuracy, reliability, or availability of the Service. To the maximum extent permitted by law, Trackify shall not be liable for any indirect, incidental, or consequential damages arising from your use of or inability to use the platform.',
    ),
    LegalSection(
      title: '9. Governing Law',
      body:
          'These Terms are governed by the laws of India. Any disputes arising from these Terms or your use of Trackify shall be subject to the exclusive jurisdiction of courts in Tamil Nadu, India.',
    ),
    LegalSection(
      title: '10. Contact',
      body:
          'If you have questions about these Terms, contact your institution\'s Trackify system administrator or the platform developer via the registered institutional support channel.',
    ),
  ],
);
