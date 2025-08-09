// Load environment variables (works both locally with .env and in GitHub Actions)
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
  
  const { Client } = require('@notionhq/client');
  const { Octokit } = require('@octokit/rest');
  
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  
  async function getWednesdayCommits() {
    try {
      // Set to Wednesday, August 6th, 2025
      const wednesday = new Date('2025-08-06');
      const startOfWednesday = new Date(wednesday.setHours(0, 0, 0, 0));
      const endOfWednesday = new Date(wednesday.setHours(23, 59, 59, 999));
  
      console.log(`Fetching commits for ${startOfWednesday.toDateString()}`);
  
      // Get all repos for the user
      const repos = await octokit.rest.repos.listForUser({
        username: process.env.GITHUB_USERNAME,
        type: 'all',
        per_page: 100
      });
  
      let totalCommits = 0;
      const reposWithCommits = [];
  
      for (const repo of repos.data) {
        try {
          const commits = await octokit.rest.repos.listCommits({
            owner: process.env.GITHUB_USERNAME,
            repo: repo.name,
            author: process.env.GITHUB_USERNAME,
            since: startOfWednesday.toISOString(),
            until: endOfWednesday.toISOString()
          });
  
          totalCommits += commits.data.length;
          if (commits.data.length > 0) {
            reposWithCommits.push({
              name: repo.name,
              commits: commits.data.length
            });
            console.log(`✅ Found ${commits.data.length} commits in ${repo.name}`);
          }
        } catch (error) {
          console.log(`⏭️  Skipping repo ${repo.name}: ${error.message}`);
        }
      }
  
      // Show summary
      if (reposWithCommits.length > 0) {
        console.log(`\n📊 Summary for Wednesday:`);
        reposWithCommits.forEach(repo => {
          console.log(`   ${repo.name}: ${repo.commits} commits`);
        });
        console.log(`   Total: ${totalCommits} commits`);
      }
  
      return {
        date: startOfWednesday,
        totalCommits
      };
    } catch (error) {
      console.error('Error fetching commits:', error);
      throw error;
    }
  }
  
  async function addToNotion(commitData) {
    try {
      const { date, totalCommits } = commitData;
  
      const response = await notion.pages.create({
        parent: { 
          database_id: process.env.NOTION_DATABASE_ID 
        },
        properties: {
          'Repository': {
            title: [
              {
                text: {
                  content: `Daily Commits - ${date.toDateString()}`
                }
              }
            ]
          },
          'Date': {
            date: {
              start: date.toISOString().split('T')[0]
            }
          },
          'Commits': {
            number: totalCommits
          }
        }
      });
  
      console.log(`✅ Added ${totalCommits} total commits to Notion for ${date.toDateString()}`);
      return response;
    } catch (error) {
      console.error('Error adding to Notion:', error);
      throw error;
    }
  }
  
  async function main() {
    try {
      console.log('🚀 Starting GitHub to Notion sync for Wednesday...');
      
      const commitData = await getWednesdayCommits();
      
      if (commitData.totalCommits === 0) {
        console.log('📭 No commits found for Wednesday');
        console.log('💡 This is normal if you didn\'t code that day!');
        return;
      }
  
      await addToNotion(commitData);
      console.log('✨ Sync completed successfully!');
      
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      process.exit(1);
    }
  }
  
  main();