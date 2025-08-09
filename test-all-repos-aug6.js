require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getAllCommitsAug6() {
  try {
    const aug6 = new Date('2025-08-06');
    const startOfDay = new Date(aug6.setHours(0, 0, 0, 0));
    const endOfDay = new Date(aug6.setHours(23, 59, 59, 999));

    console.log(`🔍 Fetching ALL commits for ${startOfDay.toDateString()} (including private repos)`);

    // Get ALL repos for authenticated user (public, private, and organization repos)
    const repos = await octokit.rest.repos.listForAuthenticatedUser({
      visibility: 'all',
      affiliation: 'owner,collaborator,organization_member',
      per_page: 100,
      sort: 'updated'
    });

    console.log(`📂 Found ${repos.data.length} total repositories to check`);

    let totalCommits = 0;
    const reposWithCommits = [];

    for (const repo of repos.data) {
      try {
        const commits = await octokit.rest.repos.listCommits({
          owner: repo.owner.login,  // This handles both your repos and org repos
          repo: repo.name,
          author: process.env.GITHUB_USERNAME,
          since: startOfDay.toISOString(),
          until: endOfDay.toISOString()
        });

        if (commits.data.length > 0) {
          reposWithCommits.push({
            name: `${repo.owner.login}/${repo.name}`,
            commits: commits.data.length,
            private: repo.private
          });
          totalCommits += commits.data.length;
          console.log(`✅ ${repo.owner.login}/${repo.name}: ${commits.data.length} commits (${repo.private ? 'private' : 'public'})`);
        }
      } catch (error) {
        console.log(`⏭️  Skipping ${repo.owner.login}/${repo.name}: ${error.message}`);
      }
    }

    // Show detailed summary
    console.log(`\n📊 Complete Summary for August 6th:`);
    if (reposWithCommits.length > 0) {
      reposWithCommits.forEach(repo => {
        console.log(`   ${repo.name}: ${repo.commits} commits (${repo.private ? 'private' : 'public'})`);
      });
    }
    console.log(`\n🎯 Total commits found: ${totalCommits}`);
    console.log(`🎯 GitHub shows: 12 contributions`);
    
    if (totalCommits === 12) {
      console.log(`✅ Perfect match! This method captures all your commits.`);
    } else if (totalCommits > 6) {
      console.log(`📈 Much better! We're getting closer to the full count.`);
    }

    return {
      date: startOfDay,
      totalCommits
    };
  } catch (error) {
    console.error('Error fetching commits:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Testing comprehensive commit counting...\n');
    await getAllCommitsAug6();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

main();