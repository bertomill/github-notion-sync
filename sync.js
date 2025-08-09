// Load environment variables (works both locally with .env and in GitHub Actions)
if (process.env.NODE_ENV !== 'production') {
    // Load environment variables (works both locally with .env and in GitHub Actions)
  if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
  }
  const { Client } = require('@notionhq/client');
  const { Octokit } = require('@octokit/rest');
  
  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  
  async function getYesterdayCommits() {
    try {
      // Get yesterday's date in UTC to match GitHub's contribution graph
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      
      // Set to start and end of yesterday in UTC
      const startOfYesterday = new Date(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0);
      const endOfYesterday = new Date(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999);
  
      console.log(`Fetching commits for ${startOfYesterday.toDateString()}`);
  
      // Get ALL repos for authenticated user (public, private, and organization repos)
      let allRepos = [];
      let page = 1;
      let hasMore = true;
  
      while (hasMore) {
        const repos = await octokit.rest.repos.listForAuthenticatedUser({
          visibility: 'all',
          affiliation: 'owner,collaborator,organization_member',
          per_page: 100,
          page: page,
          sort: 'updated'
        });
  
        allRepos = allRepos.concat(repos.data);
        hasMore = repos.data.length === 100;
        page++;
      }
  
      let totalCommits = 0;
  
      for (const repo of allRepos) {
        try {
          const commits = await octokit.rest.repos.listCommits({
            owner: repo.owner.login,  // Use repo.owner.login instead of hardcoded username
            repo: repo.name,
            author: process.env.GITHUB_USERNAME,
            since: startOfYesterday.toISOString(),
            until: endOfYesterday.toISOString()
          });
  
          totalCommits += commits.data.length;
        } catch (error) {
          console.log(`Skipping repo ${repo.owner.login}/${repo.name}: ${error.message}`);
        }
      }
  
      return {
        date: startOfYesterday,
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
      console.log('🚀 Starting GitHub to Notion sync...');
      
      const commitData = await getYesterdayCommits();
      
      if (commitData.totalCommits === 0) {
        console.log('📭 No commits found for yesterday');
        return;
      }
  
      await addToNotion(commitData);
      console.log('✨ Sync completed successfully!');
      
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      process.exit(1);
    }
  }
  
  // Run the script
  if (require.main === module) {
    main();
  }
  
  module.exports = { main, getYesterdayCommits, addToNotion };