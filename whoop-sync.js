// Whoop to Notion sync script
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Whoop OAuth and API configuration
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer';

async function getWhoopAccessToken() {
  // For now, we'll use a stored access token
  // Later we'll implement full OAuth flow
  return process.env.WHOOP_ACCESS_TOKEN;
}

async function makeWhoopRequest(endpoint, accessToken) {
  const response = await fetch(`${WHOOP_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Whoop API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getYesterdayWhoopData() {
  try {
    const accessToken = await getWhoopAccessToken();
    
    // Get yesterday's date range
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const startDate = yesterday.toISOString().split('T')[0];
    const endDate = startDate;

    console.log(`Fetching Whoop data for ${startDate}`);

    // Fetch sleep data
    console.log('🛌 Fetching sleep data...');
    const sleepData = await makeWhoopRequest(
      `/v2/sleep?start=${startDate}&end=${endDate}`, 
      accessToken
    );

    // Fetch recovery data  
    console.log('🔋 Fetching recovery data...');
    const recoveryData = await makeWhoopRequest(
      `/v2/recovery?start=${startDate}&end=${endDate}`, 
      accessToken
    );

    // Fetch cycle data (strain)
    console.log('💪 Fetching cycle/strain data...');
    const cycleData = await makeWhoopRequest(
      `/v2/cycle?start=${startDate}&end=${endDate}`, 
      accessToken
    );

    // Process and extract relevant data
    const processedData = {
      date: yesterday,
      sleepScore: null,
      sleepDuration: null,
      deepSleep: null,
      remSleep: null,
      recoveryScore: null,
      hrv: null,
      restingHR: null,
      strainScore: null
    };

    // Process sleep data
    if (sleepData.records && sleepData.records.length > 0) {
      const sleep = sleepData.records[0];
      processedData.sleepScore = sleep.score?.stage_summary?.score;
      
      if (sleep.score?.stage_summary) {
        const stages = sleep.score.stage_summary;
        processedData.sleepDuration = formatDuration(stages.total_in_bed_time_milli);
        processedData.deepSleep = formatDuration(stages.deep_sleep_duration_milli);
        processedData.remSleep = formatDuration(stages.rem_sleep_duration_milli);
      }
    }

    // Process recovery data
    if (recoveryData.records && recoveryData.records.length > 0) {
      const recovery = recoveryData.records[0];
      processedData.recoveryScore = recovery.score?.recovery_score;
      processedData.hrv = recovery.score?.hrv_rmssd_milli;
      processedData.restingHR = recovery.score?.resting_heart_rate;
    }

    // Process cycle data (strain)
    if (cycleData.records && cycleData.records.length > 0) {
      const cycle = cycleData.records[0];
      processedData.strainScore = cycle.score?.strain;
    }

    console.log('📊 Processed Whoop data:', processedData);
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
      
      if (whoopData.sleepScore !== null) {
        updateProperties.Sleep_Score = { number: whoopData.sleepScore };
      }
      if (whoopData.recoveryScore !== null) {
        updateProperties.Recovery_Score = { number: whoopData.recoveryScore };
      }
      if (whoopData.strainScore !== null) {
        updateProperties.Strain_Score = { number: whoopData.strainScore };
      }
      if (whoopData.sleepDuration) {
        updateProperties.Sleep_Duration = { rich_text: [{ text: { content: whoopData.sleepDuration } }] };
      }
      if (whoopData.deepSleep) {
        updateProperties.Deep_Sleep = { rich_text: [{ text: { content: whoopData.deepSleep } }] };
      }
      if (whoopData.remSleep) {
        updateProperties.REM_Sleep = { rich_text: [{ text: { content: whoopData.remSleep } }] };
      }
      if (whoopData.hrv !== null) {
        updateProperties.HRV = { number: whoopData.hrv };
      }
      if (whoopData.restingHR !== null) {
        updateProperties.Resting_HR = { number: whoopData.restingHR };
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
        'Repository': {
          title: [
            {
              text: {
                content: `Daily Health - ${date.toDateString()}`
              }
            }
          ]
        },
        'Date': {
          date: {
            start: date.toISOString().split('T')[0]
          }
        },
        'Commits': { number: 0 } // Default value
      };

      // Add Whoop data properties
      if (whoopData.sleepScore !== null) {
        properties.Sleep_Score = { number: whoopData.sleepScore };
      }
      if (whoopData.recoveryScore !== null) {
        properties.Recovery_Score = { number: whoopData.recoveryScore };
      }
      if (whoopData.strainScore !== null) {
        properties.Strain_Score = { number: whoopData.strainScore };
      }
      if (whoopData.sleepDuration) {
        properties.Sleep_Duration = { rich_text: [{ text: { content: whoopData.sleepDuration } }] };
      }
      if (whoopData.deepSleep) {
        properties.Deep_Sleep = { rich_text: [{ text: { content: whoopData.deepSleep } }] };
      }
      if (whoopData.remSleep) {
        properties.REM_Sleep = { rich_text: [{ text: { content: whoopData.remSleep } }] };
      }
      if (whoopData.hrv !== null) {
        properties.HRV = { number: whoopData.hrv };
      }
      if (whoopData.restingHR !== null) {
        properties.Resting_HR = { number: whoopData.restingHR };
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