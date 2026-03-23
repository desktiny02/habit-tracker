const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

async function run() {
  const snap = await db.collection('tasks').get();
  for (const doc of snap.docs) {
    console.log(`Task ID: ${doc.id}`);
    console.log(doc.data());
    console.log('---');
  }
}

run();
