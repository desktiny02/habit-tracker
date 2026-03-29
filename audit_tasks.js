const admin = require('firebase-admin');
const fs = require('fs');

async function run() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const match = env.match(/FIREBASE_SERVICE_ACCOUNT='(.+?)'/s) || env.match(/FIREBASE_SERVICE_ACCOUNT=(.+)/);
  if (!match) throw new Error('Could not find FIREBASE_SERVICE_ACCOUNT in .env.local');
  
  let saJson = match[1].trim();
  if (saJson.startsWith("'") && saJson.endsWith("'")) saJson = saJson.slice(1, -1);
  if (saJson.startsWith('"') && saJson.endsWith('"')) saJson = saJson.slice(1, -1);
  
  const sa = JSON.parse(saJson);
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });
  const db = admin.firestore();
  
  console.log('--- AUDITING TASKS ---');
  const snap = await db.collection('tasks').get();
  snap.forEach(d => {
    const data = d.data();
    console.log(`DocID: ${d.id} | Name: ${data.name} | userId: ${data.userId} | itemType: ${data.itemType}`);
  });
}

run().catch(console.error);
