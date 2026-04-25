const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local to get service account
const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT="([\s\S]+?)"\n/);
if (!match) {
  console.error('Could not find FIREBASE_SERVICE_ACCOUNT in .env.local');
  process.exit(1);
}

// Unescape the string content
const jsonString = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
const serviceAccount = JSON.parse(jsonString);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkRedemptions() {
  console.log('--- Database Check ---');
  console.log('Project:', serviceAccount.project_id);
  const snap = await db.collection('redemptions').orderBy('date', 'desc').limit(1).get();
  
  if (snap.empty) {
    console.log('No redemptions found.');
    return;
  }

  const doc = snap.docs[0];
  const data = doc.data();
  console.log('Latest Redemption:');
  console.log('ID:', doc.id);
  console.log('Status:', data.status);
  console.log('UserID (in DB):', data.userId);
  console.log('RewardName:', data.rewardName);
}

checkRedemptions().catch(err => {
  console.error('Firestore Error:', err);
});
