
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const clientEmail = "firebase-adminsdk-fbsvc@reuniakbar.iam.gserviceaccount.com";
const privateKey = `-----BEGIN PRIVATE KEY-----`;
const projectId = "reuniakbar";
const referenceId = "ALF-1780305512056-954"; // ID donasi terbaru dari user

function getAccessToken() {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claimSet = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  })).toString('base64url');
  
  const signInput = header + "." + claimSet;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  const signature = signer.sign(privateKey, 'base64url');
  const jwt = signInput + "." + signature;
  
  return new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const data = JSON.parse(body);
        if (data.access_token) resolve(data.access_token);
        else reject(body);
      });
    });
    req.write('grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt);
    req.end();
  });
}

async function run() {
  try {
    const token = await getAccessToken();
    console.log("Token obtained successfully.");
    
    // Uji PATCH ke Firestore
    const updateUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/finance/${referenceId}?updateMask.fieldPaths=status&updateMask.fieldPaths=trx_id`;
    const payload = JSON.stringify({
      fields: {
        status: { stringValue: "pemasukan" },
        trx_id: { stringValue: "210432" }
      }
    });
    
    const parsedUrl = new URL(updateUrl);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log("Firestore PATCH Status Code:", res.statusCode);
        console.log("Firestore PATCH Response:", body);
      });
    });
    
    req.write(payload);
    req.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
