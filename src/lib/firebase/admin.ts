import * as admin from 'firebase-admin';

let dbAdmin: admin.firestore.Firestore;

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Fallback for local testing or when serviceAccount is missing loaded variables
    console.warn('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT is missing. Fallback setup triggered.');
    admin.initializeApp();
  }
}

dbAdmin = admin.firestore();

export { dbAdmin };
