const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const notificationRepository = require('../repositories/notificationRepository');

let firebaseInitialized = false;

try {
  const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    // 1. Initialize using local service account JSON file if present
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseInitialized = true;
    console.log('[FIREBASE] Admin SDK initialized successfully via local service account file.');
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    // 2. Fallback to initializing using individual environment variables (best for production hosting)
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      })
    });
    firebaseInitialized = true;
    console.log('[FIREBASE] Admin SDK initialized successfully via Environment Variables.');
  } else {
    console.warn('[FIREBASE WARNING] Firebase credentials not found. Push notifications will be mocked in console.');
  }
} catch (error) {
  console.error('[FIREBASE ERROR] Failed to initialize Firebase Admin SDK:', error.message);
}

/**
 * Send multicast push notifications to a list of user IDs
 * @param {Array<string>} userIds 
 * @param {string} title 
 * @param {string} body 
 * @param {Object} data 
 * @returns {Promise<Object>} { successCount, failureCount }
 */
const sendPush = async (userIds, title, body, data = {}) => {
  const result = { successCount: 0, failureCount: 0 };
  
  if (!userIds || userIds.length === 0) {
    return result;
  }

  try {
    // 1. Verify system-wide global push notification setting
    const systemSettingsRepository = require('../repositories/systemSettingsRepository');
    const globalPush = await systemSettingsRepository.getSetting('global_push_notifications', 'true');
    if (globalPush !== 'true') {
      console.log('[FIREBASE] Push notifications are globally disabled by administrator settings.');
      return result;
    }

    // 2. Filter users who have opted-out of push notifications in settings
    const settingsRepository = require('../repositories/settingsRepository');
    const allowedUserIds = [];
    for (const userId of userIds) {
      const userSettings = await settingsRepository.getByUserId(userId);
      if (!userSettings || userSettings.push_notifications !== false) {
        allowedUserIds.push(userId);
      }
    }

    if (allowedUserIds.length === 0) {
      console.log('[FIREBASE] All target users have opted-out of push notifications in settings.');
      return result;
    }

    // 3. Collect all device tokens for allowed user IDs
    let allTokens = [];
    for (const userId of allowedUserIds) {
      const userTokens = await notificationRepository.getTokensByUserId(userId);
      allTokens = allTokens.concat(userTokens);
    }

    if (allTokens.length === 0) {
      console.log(`[FIREBASE] No registered device tokens found for target user(s). 0 push notifications sent.`);
      return result;
    }

    const tokenStrings = [...new Set(allTokens.map(t => t.device_token))];

    // If Firebase Admin SDK is NOT initialized, mock it
    if (!firebaseInitialized) {
      console.log(`[FIREBASE MOCK] Sending push to ${tokenStrings.length} tokens:`);
      console.log(`   Title: ${title}`);
      console.log(`   Body: ${body}`);
      console.log(`   Data:`, data);
      result.successCount = tokenStrings.length;
      return result;
    }

    // 2. Prepare payload
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: '/student/dashboard' // Default web push click redirect
      },
      tokens: tokenStrings
    };

    // 3. Send multicast message
    const response = await admin.messaging().sendEachForMulticast(message);
    result.successCount = response.successCount;
    result.failureCount = response.failureCount;

    console.log(`[FIREBASE] Multicast summary: Sent ${response.successCount} successfully, ${response.failureCount} failed.`);

    // 4. Clean up invalid/expired tokens returned by FCM
    if (response.failureCount > 0) {
      for (let idx = 0; idx < response.responses.length; idx++) {
        const resp = response.responses[idx];
        if (!resp.success) {
          const errorCode = resp.error?.code;
          const badToken = tokenStrings[idx];
          
          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token'
          ) {
            console.log(`[FIREBASE] Cleaning up invalid token: ${badToken.substring(0, 15)}... Error: ${errorCode}`);
            await notificationRepository.deleteToken(badToken);
          }
        }
      }
    }
  } catch (error) {
    console.error('[FIREBASE] Error sending multicast push notification:', error.message);
  }

  return result;
};

module.exports = {
  sendPush
};
