const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
var jwt = require('jsonwebtoken');



// Parse CLI arguments
const args = process.argv.slice(2);
const passphraseIndex = args.indexOf('--passphrase');
const stateTrackerIndex = args.indexOf('--stateTracker');

if (passphraseIndex === -1 || stateTrackerIndex === -1) {
 console.error('Usage: node script.js --passphrase <passphrase> --stateTracker <stateTracker>');
 process.exit(1);
}

const mypassphrase = args[passphraseIndex + 1];
const stateTracker = args[stateTrackerIndex + 1];



var privateKeyFile = fs.readFileSync('/path/to/key.pem'); // Change this as required
var qualified_username = "ORG.USER"; // Change this as required

privateKeyObject = crypto.createPrivateKey({ key: privateKeyFile, format: 'pem', passphrase: mypassphrase });
var privateKey = privateKeyObject.export({ format: 'pem', type: 'pkcs8' });

publicKeyObject = crypto.createPublicKey({ key: privateKey, format: 'pem' });
var publicKey = publicKeyObject.export({ format: 'der', type: 'spki' });
var publicKeyFingerprint = 'SHA256:' + crypto.createHash('sha256').update(publicKey, 'utf8').digest('base64');

var signOptions = {
    iss: qualified_username + '.' + publicKeyFingerprint,
    sub: qualified_username,
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // Token expires in 1 hour
};

var token = jwt.sign(signOptions, privateKey, { algorithm: 'RS256' });

// Define the headers
var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
};

// Define the data to be sent in the POST request
var data = JSON.stringify({
  "statement": "SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY WHERE  EVENT_TIMESTAMP > ? ORDER BY EVENT_TIMESTAMP;",
  "timeout": 60,
  "database": "SNOWFLAKE",  
  "schema": "ACCOUNT_USAGE", 
  "warehouse": "YOUR WAREHOUSE ",   // Your warehouse, change this as required
  "role": "YOUR ROLE ", // Your role, change this as required
  "bindings": {
    "1": {
      "type": "DATE",
      "value": stateTracker
    }
}
});

// Define the options for the HTTPS request
var options = {
    hostname: 'YOUR-ORG.snowflakecomputing.com',  // snowflake hostname, change here 
    port: 443,
    path: '/api/v2/statements',
    method: 'POST',
    headers: headers
};

// Make the POST request using the https module
var req = https.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {


try {
  let jsonResponse = JSON.parse(responseData);

  const keys = [
    "EVENT_ID", "EVENT_TIMESTAMP", "EVENT_TYPE", "USER_NAME", "CLIENT_IP",
    "REPORTED_CLIENT_TYPE", "REPORTED_CLIENT_VERSION", "FIRST_AUTHENTICATION_FACTOR",
    "SECOND_AUTHENTICATION_FACTOR", "IS_SUCCESS", "ERROR_CODE", "ERROR_MESSAGE",
    "RELATED_EVENT_ID", "CONNECTION", "CLIENT_PRIVATE_LINK_ID"
  ];

  let lastEventTimestamp = null;

  if (Array.isArray(jsonResponse.data)) {
    jsonResponse.data.forEach(innerArray => {
      if (innerArray.length === keys.length) {
        const obj = Object.fromEntries(keys.map((key, i) => [key, innerArray[i]]));
        process.stdout.write(JSON.stringify(obj) + '\n');
        lastEventTimestamp = innerArray[1]; // EVENT_TIMESTAMP is the second element
      } else {
        console.error('Array length mismatch:', innerArray);
      }
    });

    // Write the last EVENT_TIMESTAMP to the file /tmp/statepoch

if (lastEventTimestamp !== null) {
const fs = require('fs');
fs.writeFileSync('/tmp/statepoch', lastEventTimestamp.split('.')[0]);
}

  } else {
    console.error('jsonResponse.data is not an array');
    process.stdout.write(responseData + '\n');
  }
} catch (error) {
  console.error('Error parsing JSON:', error);
  process.stdout.write(responseData + '\n');
}
 });

});

req.on('error', (e) => {
    console.error('Error:', e);
});

// Write data to request body
req.write(data);
req.end();