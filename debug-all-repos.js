require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function findAllRepos() {
  try {
    console.log('🔍 Debugging repository access...\n');

    // Method 1: Public repos only (what we're currently using)
    console.log('📂 Method 1: Public repos for user');
    const publicRepos = await octokit.rest.repos.listForUser({
      username: process.env.GITHUB_USERNAME,
      type: 'all',
      per_page: 100
    });
    console.log(`Found ${publicRepos.data.length} public repositories`);
    publicRepos.data.forEach(repo => {
      console.log(`  - ${repo.name} (${repo.private ? 'private' : 'public'})`);
    });

    console.log('\n📁 Method 2: All repos for authenticated user (includes private)');
    const allRepos = await octokit.rest.repos.listForAuthenticatedUser({
      visibility: 'all',
      affiliation: 'owner,collaborator,organization_member',
      per_page: 100
    });
    console.log(`Found ${allRepos.data.length} total repositories (including private & org repos)`);
    
    // Group by type
    const ownedRepos = allRepos.data.filter(repo => repo.owner.login === process.env.GITHUB_USERNAME);
    const orgRepos = allRepos.data.filter(repo => repo.owner.login !== process.env.GITHUB_USERNAME);
    
    console.log(`\n📊 Breakdown:`);
    console.log(`  Owned by you: ${ownedRepos.length}`);
    console.log(`  Organization/Other: ${orgRepos.length}`);
    
    console.log(`\n🏠 Your repositories:`);
    ownedRepos.forEach(repo => {
      console.log(`  - ${repo.name} (${repo.private ? 'private' : 'public'})`);
    });
    
    if (orgRepos.length > 0) {
      console.log(`\n🏢 Organization/Collaboration repositories:`);
      orgRepos.forEach(repo => {
        console.log(`  - ${repo.owner.login}/${repo.name} (${repo.private ? 'private' : 'public'})`);
      });
    }

    // Test commits for Aug 6th using both methods
    console.log('\n📅 Testing commits for August 6th, 2025...');
    const aug6 = new Date('2025-08-06');
    const startOfDay = new Date(aug6.setHours(0, 0, 0, 0));
    const endOfDay = new Date(aug6.setHours(23, 59, 59, 999));

    let publicCommits = 0;
    let allCommits = 0;

    // Count from public repos only
    for (const repo of publicRepos.data) {
      try {
        const commits = await octokit.rest.repos.listCommits({
          owner: repo.owner.login,
          repo: repo.name,
          author: process.env.GITHUB_USERNAME,
          since: startOfDay.toISOString(),
          until: endOfDay.toISOString()
        });
        if (commits.data.length > 0) {
          console.log(`  📝 Public repo ${repo.name}: ${commits.data.length} commits`);
          publicCommits += commits.data.length;
        }
      } catch (error) {
        // Skip errors
      }
    }

    // Count from all repos (including private)
    for (const repo of allRepos.data) {
      try {
        const commits = await octokit.rest.repos.listCommits({
          owner: repo.owner.login,
          repo: repo.name,
          author: process.env.GITHUB_USERNAME,
          since: startOfDay.toISOString(),
          until: endOfDay.toISOString()
        });
        if (commits.data.length > 0) {
          console.log(`  📝 All repos ${repo.owner.login}/${repo.name}: ${commits.data.length} commits`);
          allCommits += commits.data.length;
        }
      } catch (error) {
        // Skip errors
      }
    }

    console.log(`\n🎯 Results for August 6th:`);
    console.log(`  Public repos only: ${publicCommits} commits`);
    console.log(`  All repos (including private): ${allCommits} commits`);
    console.log(`  GitHub shows: 12 contributions`);
    
    if (allCommits === 12) {
      console.log(`\n✅ Found the issue! We need to include private/org repositories.`);
    } else if (allCommits > publicCommits) {
      console.log(`\n🔍 Getting closer! Private repos have more commits.`);
    } else {
      console.log(`\n🤔 Still missing some. Might be issues, PRs, or other contributions.`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findAllRepos();