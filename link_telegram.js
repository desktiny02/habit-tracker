const admin = require('firebase-admin');
const fs = require('fs');

async function run() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const match = env.match(/FIREBASE_SERVICE_ACCOUNT='(.+?)'/s) || env.match(/FIREBASE_SERVICE_ACCOUNT=(.+)/);
  if (!match) throw new Error('Could not find FIREBASE_SERVICE_ACCOUNT');
  
  const sa = JSON.parse(match[1]);
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const db = admin.firestore();
  
  const telegramChatId = "6518305117";
  const username = "mu"; 
  
  const userSnap = await db.collection('users').where('username', '==', username).get();
  if (userSnap.empty) throw new Error('User mu not found');
  
  const userRef = userSnap.docs[0].ref;
  await userRef.update({ telegramChatId });
  console.log(`Successfully linked Telegram Chat ID ${telegramChatId} to user ${username}`);
}

run().catch(console.error);
