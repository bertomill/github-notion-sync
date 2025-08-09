// Whoop OAuth Helper - Get your access token
import dotenv from 'dotenv';
import http from 'http';
import url from 'url';

dotenv.config();

const WHOOP_CLIENT_ID = process.env.WHOOP_CLIENT_ID || '2d48bb21-defd-49b6-89dd-a049c7cde3a5';
const WHOOP_CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET; // You need to get this from your Whoop dashboard
const REDIRECT_URI = 'http://localhost:3000/callback';
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

// Include all necessary scopes for accessing user data
const SCOPES = 'offline read:profile read:recovery read:cycles read:sleep read:workout';

function startLocalServer() {
  return new Promise((resolve, reject) => {
    // Create a simple HTTP server (we'll handle HTTPS redirect manually)
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      
      if (parsedUrl.pathname === '/callback') {
        const { code, error, state } = parsedUrl.query;
        
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Error: ${error}</h1><p>Authorization failed. Please try again.</p>`);
          reject(new Error(`OAuth error: ${error}`));
          return;
        }
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <h1>✅ Authorization Successful!</h1>
            <p>You can close this window and return to your terminal.</p>
            <p>Your authorization code has been received.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          `);
          
          server.close();
          resolve(code);
          return;
        }
      }
      
      // Default response
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Waiting for Whoop authorization...</h1><p>Please complete authorization in your browser...</p>');
    });
    
    server.listen(3000, () => {
      console.log('🌐 Local server started on http://localhost:3000');
      console.log('📱 Please complete the authorization in your browser...');
    });
    
    server.on('error', reject);
  });
}

async function exchangeCodeForToken(authCode) {
  const tokenData = {
    grant_type: 'authorization_code',
    client_id: WHOOP_CLIENT_ID,
    client_secret: WHOOP_CLIENT_SECRET,
    code: authCode,
    redirect_uri: REDIRECT_URI
  };
  
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(tokenData)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }
  
  return response.json();
}

async function testAccessToken(accessToken) {
  console.log('\n🧪 Testing access token...');
  
  try {
    const response = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const profile = await response.json();
      console.log('✅ Token works! Your profile:', profile);
      return true;
    } else {
      console.log('❌ Token test failed:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.log('❌ Token test error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🏃‍♂️ Whoop OAuth Helper - Getting your access token\n');
  
  // Check if we have client secret
  if (!WHOOP_CLIENT_SECRET) {
    console.log('❌ Missing WHOOP_CLIENT_SECRET');
    console.log('📝 Please add your Whoop client secret to your .env file:');
    console.log('   WHOOP_CLIENT_SECRET=your_secret_here');
    console.log('\n💡 Get it from: https://developer.whoop.com/dashboard');
    process.exit(1);
  }
  
  try {
    // Build authorization URL with proper parameters
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: WHOOP_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      state: 'oauth123'  // 8+ characters as required
    });
    
    const authUrl = `${WHOOP_AUTH_URL}?${authParams.toString()}`;
    
    console.log('🔗 Authorization URL:');
    console.log(authUrl);
    console.log('\n📋 Steps:');
    console.log('1. Click the URL above (or copy/paste into browser)');
    console.log('2. Log in to Whoop and authorize the app');
    console.log('3. You\'ll be redirected back here automatically');
    console.log('\n⏳ Starting local server to capture the callback...\n');
    
    // Start local server and wait for authorization
    const authCode = await startLocalServer();
    
    console.log('\n🔄 Exchanging authorization code for access token...');
    
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForToken(authCode);
    
    console.log('\n🎉 Success! Here are your tokens:');
    console.log('\n📝 Add these to your GitHub repository secrets:');
    console.log(`WHOOP_ACCESS_TOKEN=${tokenResponse.access_token}`);
    console.log(`WHOOP_REFRESH_TOKEN=${tokenResponse.refresh_token}`);
    
    console.log('\n📋 Token Details:');
    console.log(`Access Token: ${tokenResponse.access_token.substring(0, 20)}...`);
    console.log(`Refresh Token: ${tokenResponse.refresh_token?.substring(0, 20)}...`);
    console.log(`Expires In: ${tokenResponse.expires_in} seconds (${Math.round(tokenResponse.expires_in / 3600)} hours)`);
    console.log(`Token Type: ${tokenResponse.token_type}`);
    console.log(`Scope: ${tokenResponse.scope}`);
    
    // Test the token
    await testAccessToken(tokenResponse.access_token);
    
    console.log('\n✨ OAuth setup complete!');
    console.log('🔧 Next steps:');
    console.log('1. Add WHOOP_ACCESS_TOKEN to your GitHub repository secrets');
    console.log('2. Add WHOOP_REFRESH_TOKEN to your GitHub repository secrets (for future token refresh)');
    console.log('3. Run the Whoop sync script');
    
  } catch (error) {
    console.error('\n❌ OAuth failed:', error.message);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 OAuth helper stopped. You can restart anytime.');
  process.exit(0);
});

main();