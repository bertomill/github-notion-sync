require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getDetailedCommitsAug6() {
  try {
    // Make sure we're testing August 6th, 2025
    const aug6 = new Date('2025-08-06');
    const startOfDay = new Date(aug6.setHours(0, 0, 0, 0));
    const endOfDay = new Date(aug6.setHours(23, 59, 59, 999));

    console.log(`🗓️  Testing specifically: ${startOfDay.toDateString()}`);
    console.log(`📅 Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}\n`);

    // Get ALL repos with pagination to ensure we don't miss any
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
      
      if (hasMore) {
        console.log(`📄 Loaded page ${page-1}, found ${repos.data.length} repos...`);
      }
    }

    console.log(`📂 Total repositories to check: ${allRepos.length}`);
    console.log(`🔍 Checking for commits by ${process.env.GITHUB_USERNAME} on August 6th...\n`);

    let totalCommits = 0;
    const reposWithCommits = [];
    let checkedRepos = 0;

    for (const repo of allRepos) {
      checkedRepos++;
      
      // Show progress every 20 repos
      if (checkedRepos % 20 === 0) {
        console.log(`📊 Progress: ${checkedRepos}/${allRepos.length} repos checked...`);
      }

      try {
        const commits = await octokit.rest.repos.listCommits({
          owner: repo.owner.login,
          repo: repo.name,
          author: process.env.GITHUB_USERNAME,
          since: startOfDay.toISOString(),
          until: endOfDay.toISOString(),
          per_page: 100  // In case there are many commits in one repo
        });

        if (commits.data.length > 0) {
          reposWithCommits.push({
            name: `${repo.owner.login}/${repo.name}`,
            commits: commits.data.length,
            private: repo.private,
            owner: repo.owner.login
          });
          totalCommits += commits.data.length;
          
          console.log(`✅ ${repo.owner.login}/${repo.name}: ${commits.data.length} commits (${repo.private ? 'private' : 'public'})`);
          
          // Show actual commit messages for debugging
          commits.data.forEach((commit, index) => {
            const time = new Date(commit.commit.committer.date).toLocaleTimeString();
            console.log(`   ${index + 1}. ${time} - ${commit.commit.message.split('\n')[0].slice(0, 50)}...`);
          });
        }
      } catch (error) {
        if (!error.message.includes('empty')) {
          console.log(`⚠️  Error checking ${repo.owner.login}/${repo.name}: ${error.message}`);
        }
      }
    }

    console.log(`\n🎯 FINAL RESULTS for August 6th, 2025:`);
    console.log(`📊 Repositories checked: ${checkedRepos}`);
    console.log(`📈 Repositories with commits: ${reposWithCommits.length}`);
    
    if (reposWithCommits.length > 0) {
      console.log(`\n📝 Detailed breakdown:`);
      reposWithCommits.forEach(repo => {
        console.log(`   ${repo.name}: ${repo.commits} commits (${repo.private ? 'private' : 'public'})`);
      });
    }
    
    console.log(`\n🏆 Total commits found: ${totalCommits}`);
    console.log(`🏆 GitHub contribution graph shows: 12`);
    console.log(`🏆 Difference: ${12 - totalCommits}`);

    if (totalCommits === 12) {
      console.log(`\n🎉 Perfect! We found all your commits.`);
    } else {
      console.log(`\n🤔 Still missing ${12 - totalCommits} commits. This could be:`);
      console.log(`   - Issues or PR comments (not just commits)`);
      console.log(`   - Commits to repos you don't have access to`);
      console.log(`   - Different timezone interpretation`);
      console.log(`   - GitHub counts some other activities as contributions`);
    }

    return { totalCommits, reposWithCommits };
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

getDetailedCommitsAug6();