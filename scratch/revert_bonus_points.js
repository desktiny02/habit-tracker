const admin = require('firebase-admin');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');

const project_id = envContent.match(/"project_id":\s*"(.*?)"/)[1];
const client_email = envContent.match(/"client_email":\s*"(.*?)"/)[1];
const private_key_raw = envContent.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/)[0];
// The private key in the file might have literal \n or real newlines. 
// Standard cert() expects real newlines.
const private_key = private_key_raw.replace(/\\n/g, '\n');

const serviceAccount = { project_id, client_email, private_key };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  console.log('Auditing points...');
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    const [logsSnap, redemptionsSnap] = await Promise.all([
      db.collection('logs').where('userId', '==', userId).get(),
      db.collection('redemptions').where('userId', '==', userId).get()
    ]);
    
    let logPoints = 0;
    logsSnap.forEach(d => logPoints += (d.data().pointsAwarded || 0));
    
    let spentPoints = 0;
    redemptionsSnap.forEach(d => spentPoints += (d.data().pointsSpent || 0));
    
    const calculated = Math.max(0, logPoints - spentPoints);
    if (userData.totalPoints !== calculated) {
      console.log(`[!] Reverting ${userData.username || userId}: ${userData.totalPoints} -> ${calculated}`);
      await userDoc.ref.update({ 
        totalPoints: calculated, 
        lastLoginDate: admin.firestore.FieldValue.delete() 
      });
    } else {
      console.log(`[✓] ${userData.username || userId}: ${calculated} (OK)`);
      await userDoc.ref.update({ 
        lastLoginDate: admin.firestore.FieldValue.delete() 
      });
    }
  }
}

run().catch(console.error);
