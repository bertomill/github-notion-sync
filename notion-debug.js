// Debug script to inspect Notion database properties
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const notion = new Client({ 
  auth: process.env.WHOOP_NOTION_TOKEN || process.env.NOTION_TOKEN 
});

async function inspectNotionDatabase() {
  try {
    console.log('🔍 Inspecting Notion database...');
    console.log('📊 Database ID:', process.env.WHOOP_NOTION_DATABASE_ID);
    console.log('🔑 Using token:', (process.env.WHOOP_NOTION_TOKEN || process.env.NOTION_TOKEN)?.substring(0, 20) + '...');
    
    // Get database schema
    const database = await notion.databases.retrieve({
      database_id: process.env.WHOOP_NOTION_DATABASE_ID
    });
    
    console.log('\n✅ Database found!');
    console.log('📝 Database title:', database.title?.[0]?.plain_text || 'Untitled');
    
    console.log('\n📋 Available properties:');
    const properties = database.properties;
    
    for (const [propName, propDetails] of Object.entries(properties)) {
      console.log(`  • ${propName} (${propDetails.type})`);
    }
    
    console.log('\n🎯 Properties we\'re trying to use:');
    const requiredProps = [
      'Sleep_Score',
      'Recovery_Score', 
      'Strain_Score',
      'HRV_RMSSD',
      'Resting_HR',
      'Sleep_Duration',
      'Sleep_Efficiency'
    ];
    
    requiredProps.forEach(prop => {
      const exists = properties[prop] ? '✅' : '❌';
      console.log(`  ${exists} ${prop}`);
    });
    
    // Try to query the database
    console.log('\n🔍 Testing database query...');
    const queryResult = await notion.databases.query({
      database_id: process.env.WHOOP_NOTION_DATABASE_ID,
      page_size: 1
    });
    
    console.log(`📊 Query successful! Found ${queryResult.results.length} pages.`);
    
    if (queryResult.results.length > 0) {
      console.log('\n📄 Sample page properties:');
      const samplePage = queryResult.results[0];
      for (const [propName, propValue] of Object.entries(samplePage.properties)) {
        console.log(`  • ${propName}: ${propValue.type}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error inspecting database:', error.message);
    console.error('🔍 Error details:', error);
  }
}

// Run the inspection
inspectNotionDatabase();