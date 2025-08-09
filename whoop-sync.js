// Whoop to Notion sync script
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const notion = new Client({ auth: process.env.WHOOP_NOTION_TOKEN || process.env.NOTION_TOKEN });

// Whoop OAuth and API configuration
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer';

async function getWhoopAccessToken() {
  // For now, we'll use a stored access token
  // Later we'll implement full OAuth flow
  let accessToken = process.env.WHOOP_ACCESS_TOKEN;
  
  // If no access token, try to refresh using refresh token
  if (!accessToken && process.env.WHOOP_REFRESH_TOKEN) {
    console.log('🔄 No access token found, trying to refresh...');
    accessToken = await refreshWhoopToken();
  }
  
  return accessToken;
}

async function refreshWhoopToken() {
  console.log('🔄 Refreshing Whoop access token...');
  
  const refreshData = {
    grant_type: 'refresh_token',
    refresh_token: process.env.WHOOP_REFRESH_TOKEN,
    client_id: process.env.WHOOP_CLIENT_ID || 'ef2283d6-a0fd-400f-8883-2e71fd19fa79',
    client_secret: process.env.WHOOP_CLIENT_SECRET,
    scope: 'offline read:profile read:recovery read:cycles read:sleep read:workout'
  };
  
  try {
    const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(refreshData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Token refresh failed: ${response.status} ${response.statusText}`);
      console.log(`❌ Error details: ${errorText}`);
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
    }
    
    const tokenResponse = await response.json();
    console.log('✅ Token refreshed successfully');
    console.log(`🔑 New token: ${tokenResponse.access_token.substring(0, 20)}...`);
    
    // Note: In a real app, you'd save the new tokens
    // For now, we'll just use the new access token
    return tokenResponse.access_token;
    
  } catch (error) {
    console.error('❌ Error refreshing token:', error.message);
    throw error;
  }
}

async function makeWhoopRequest(endpoint, accessToken) {
  const url = `${WHOOP_API_BASE}${endpoint}`;
  console.log(`🔗 Making request to: ${url}`);
  console.log(`🔑 Using token: ${accessToken ? accessToken.substring(0, 20) + '...' : 'undefined'}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`📊 Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`❌ API Error: ${response.status} ${response.statusText}`);
    console.log(`❌ Error details: ${errorText}`);
    console.log(`❌ Response headers:`, Object.fromEntries(response.headers.entries()));
    throw new Error(`Whoop API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getYesterdayWhoopData() {
  try {
    const accessToken = await getWhoopAccessToken();
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    console.log(`🔑 Using access token: ${accessToken.substring(0, 10)}...`);
    
    // Test the token first with a simple profile request
    console.log('🧪 Testing access token...');
    try {
      await makeWhoopRequest('/v1/user/profile/basic', accessToken);
      console.log('✅ Access token is valid');
    } catch (testError) {
      console.log('❌ Access token test failed:', testError.message);
      console.log('💡 Token might be expired. You may need to regenerate it.');
      throw new Error('Access token is invalid or expired');
    }
    
    // Get yesterday's date range in ISO 8601 format
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const startDate = yesterday.toISOString().split('T')[0] + 'T00:00:00.000Z';
    const endDate = yesterday.toISOString().split('T')[0] + 'T23:59:59.999Z';

    console.log(`Fetching Whoop data for ${yesterday.toISOString().split('T')[0]}`);

    // Fetch sleep data using correct v1 endpoint
    console.log('🛌 Fetching sleep data...');
    const sleepData = await makeWhoopRequest(
      `/v1/activity/sleep?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&limit=25`, 
      accessToken
    );

    // Fetch recovery data using correct v1 endpoint
    console.log('🔋 Fetching recovery data...');
    const recoveryData = await makeWhoopRequest(
      `/v1/recovery?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&limit=25`, 
      accessToken
    );

    // Fetch cycle data (strain) using correct v1 endpoint
    console.log('💪 Fetching cycle/strain data...');
    const cycleData = await makeWhoopRequest(
      `/v1/cycle?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&limit=25`, 
      accessToken
    );

    // Process and extract relevant data
    const processedData = {
      date: yesterday,
      sleepScore: null,
      recoveryScore: null,
      strainScore: null,
      hrvRmssd: null,
      restingHR: null,
      sleepDuration: null,
      sleepEfficiency: null
    };

    console.log('🔍 Processing API responses...');

    // Process sleep data
    if (sleepData.records && sleepData.records.length > 0) {
      const sleep = sleepData.records[0];
      console.log('Sleep data found:', sleep.score ? 'Yes' : 'No');
      if (sleep.score && sleep.score.stage_summary) {
        // Use sleep_performance_percentage as the main sleep score
        processedData.sleepScore = sleep.score.sleep_performance_percentage;
        processedData.sleepEfficiency = sleep.score.sleep_efficiency_percentage;
        
        // Calculate total sleep duration in hours
        const totalSleepMs = sleep.score.stage_summary.total_light_sleep_time_milli + 
                            sleep.score.stage_summary.total_slow_wave_sleep_time_milli + 
                            sleep.score.stage_summary.total_rem_sleep_time_milli;
        processedData.sleepDuration = Math.round((totalSleepMs / (1000 * 60 * 60)) * 10) / 10; // Hours with 1 decimal
        
        console.log('  Sleep score:', processedData.sleepScore);
        console.log('  Sleep efficiency:', processedData.sleepEfficiency);
        console.log('  Sleep duration:', processedData.sleepDuration, 'hours');
      }
    }

    // Process recovery data
    if (recoveryData.records && recoveryData.records.length > 0) {
      const recovery = recoveryData.records[0];
      console.log('Recovery data found:', recovery.score ? 'Yes' : 'No');
      if (recovery.score) {
        processedData.recoveryScore = recovery.score.recovery_score;
        processedData.hrvRmssd = recovery.score.hrv_rmssd_milli;
        processedData.restingHR = recovery.score.resting_heart_rate;
        console.log('  Recovery score:', processedData.recoveryScore);
        console.log('  HRV RMSSD:', processedData.hrvRmssd);
        console.log('  Resting HR:', processedData.restingHR);
      }
    }

    // Process cycle data (strain)
    if (cycleData.records && cycleData.records.length > 0) {
      const cycle = cycleData.records[0];
      console.log('Cycle data found:', cycle.score ? 'Yes' : 'No');
      if (cycle.score) {
        processedData.strainScore = cycle.score.strain;
        console.log('  Strain score:', processedData.strainScore);
      }
    }

    console.log('📊 Processed Whoop data:', {
      sleepScore: processedData.sleepScore,
      recoveryScore: processedData.recoveryScore,
      strainScore: processedData.strainScore,
      hrvRmssd: processedData.hrvRmssd,
      restingHR: processedData.restingHR,
      sleepDuration: processedData.sleepDuration,
      sleepEfficiency: processedData.sleepEfficiency
    });
    
    return processedData;

  } catch (error) {
    console.error('Error fetching Whoop data:', error);
    throw error;
  }
}

function formatDuration(milliseconds) {
  if (!milliseconds) return null;
  
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
}

async function findExistingNotionEntry(date) {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID,
      filter: {
        property: 'Date',
        date: {
          equals: startOfDay.toISOString().split('T')[0]
        }
      }
    });

    return response.results.length > 0 ? response.results[0] : null;
  } catch (error) {
    console.error('Error finding existing Notion entry:', error);
    return null;
  }
}

async function updateNotionWithWhoopData(whoopData) {
  try {
    const { date } = whoopData;
    
    // Check if entry already exists (from GitHub sync)
    const existingEntry = await findExistingNotionEntry(date);
    
    if (existingEntry) {
      // Update existing entry with Whoop data
      console.log('📝 Updating existing Notion entry with Whoop data...');
      
      const updateProperties = {};
      
      if (whoopData.sleepScore !== null && whoopData.sleepScore !== undefined) {
        updateProperties.Sleep_Score = { number: whoopData.sleepScore };
      }
      if (whoopData.recoveryScore !== null && whoopData.recoveryScore !== undefined) {
        updateProperties.Recovery_Score = { number: whoopData.recoveryScore };
      }
      if (whoopData.strainScore !== null && whoopData.strainScore !== undefined) {
        updateProperties.Strain_Score = { number: whoopData.strainScore };
      }
      if (whoopData.hrvRmssd !== null && whoopData.hrvRmssd !== undefined) {
        updateProperties.HRV_RMSSD = { number: whoopData.hrvRmssd };
      }
      if (whoopData.restingHR !== null && whoopData.restingHR !== undefined) {
        updateProperties.Resting_HR = { number: whoopData.restingHR };
      }
      if (whoopData.sleepDuration !== null && whoopData.sleepDuration !== undefined) {
        updateProperties.Sleep_Duration = { number: whoopData.sleepDuration };
      }
      if (whoopData.sleepEfficiency !== null && whoopData.sleepEfficiency !== undefined) {
        updateProperties.Sleep_Efficiency = { number: whoopData.sleepEfficiency };
      }

      await notion.pages.update({
        page_id: existingEntry.id,
        properties: updateProperties
      });

      console.log(`✅ Updated existing Notion entry with Whoop data for ${date.toDateString()}`);
    } else {
      // Create new entry with just Whoop data
      console.log('📝 Creating new Notion entry with Whoop data...');
      
      const properties = {
        'Title': {
          title: [
            {
              text: {
                content: `Health Data - ${date.toDateString()}`
              }
            }
          ]
        },
        'Date': {
          date: {
            start: date.toISOString().split('T')[0]
          }
        }
      };

      // Add Whoop data properties
      if (whoopData.sleepScore !== null && whoopData.sleepScore !== undefined) {
        properties.Sleep_Score = { number: whoopData.sleepScore };
      }
      if (whoopData.recoveryScore !== null && whoopData.recoveryScore !== undefined) {
        properties.Recovery_Score = { number: whoopData.recoveryScore };
      }
      if (whoopData.strainScore !== null && whoopData.strainScore !== undefined) {
        properties.Strain_Score = { number: whoopData.strainScore };
      }
      if (whoopData.hrvRmssd !== null && whoopData.hrvRmssd !== undefined) {
        properties.HRV_RMSSD = { number: whoopData.hrvRmssd };
      }
      if (whoopData.restingHR !== null && whoopData.restingHR !== undefined) {
        properties.Resting_HR = { number: whoopData.restingHR };
      }
      if (whoopData.sleepDuration !== null && whoopData.sleepDuration !== undefined) {
        properties.Sleep_Duration = { number: whoopData.sleepDuration };
      }
      if (whoopData.sleepEfficiency !== null && whoopData.sleepEfficiency !== undefined) {
        properties.Sleep_Efficiency = { number: whoopData.sleepEfficiency };
      }

      await notion.pages.create({
        parent: { database_id: process.env.NOTION_DATABASE_ID },
        properties
      });

      console.log(`✅ Created new Notion entry with Whoop data for ${date.toDateString()}`);
    }

  } catch (error) {
    console.error('Error updating Notion with Whoop data:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🏃‍♂️ Starting Whoop to Notion sync...');
    
    const whoopData = await getYesterdayWhoopData();
    
    // Check if we have any data
    const hasData = Object.values(whoopData).some(value => 
      value !== null && value !== undefined && value !== whoopData.date
    );
    
    if (!hasData) {
      console.log('📭 No Whoop data found for yesterday');
      return;
    }

    await updateNotionWithWhoopData(whoopData);
    console.log('✨ Whoop sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Whoop sync failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();