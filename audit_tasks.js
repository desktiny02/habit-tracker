const admin = require('firebase-admin');

async function run() {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
  const db = admin.firestore();
  
  const snap = await db.collection('tasks').limit(20).get();
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('--- TASKS ---');
  console.log(JSON.stringify(tasks, null, 2));
}

run().catch(console.error);
