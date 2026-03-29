const admin = require('firebase-admin');
const fs = require('fs');

async function checkNotifs() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(sa)
    });
  }
  const db = admin.firestore();
  const snapshot = await db.collection('scheduled_notifications').get();
  const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('--- NOTIFICATIONS ---');
  console.log(JSON.stringify(data, null, 2));
}

checkNotifs().catch(console.error);
