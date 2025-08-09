require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getAllContributionsAug6() {
  try {
    // Test exactly August 6th, 2025 in UTC
    const startOfDay = new Date('2025-08-06T00:00:00.000Z');
    const endOfDay = new Date('2025-08-06T23:59:59.999Z');

    console.log(`🗓️  Testing: August 6th, 2025`);
    console.log(`📅 UTC Range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}\n`);

    let totalContributions = 0;
    const contributionDetails = {
      commits: 0,
      issues: 0,
      pullRequests: 0,
      reviews: 0
    };

    // 1. CHECK COMMITS (what we already did)
    console.log('🔍 1. Checking commits...');
    const repos = await octokit.rest.repos.listForAuthenticatedUser({
      visibility: 'all',
      affiliation: 'owner,collaborator,organization_member',
      per_page: 100
    });

    for (const repo of repos.data) {
      try {
        const commits = await octokit.rest.repos.listCommits({
          owner: repo.owner.login,
          repo: repo.name,
          author: process.env.GITHUB_USERNAME,
          since: startOfDay.toISOString(),
          until: endOfDay.toISOString()
        });

        if (commits.data.length > 0) {
          contributionDetails.commits += commits.data.length;
          console.log(`   ✅ ${repo.owner.login}/${repo.name}: ${commits.data.length} commits`);
        }
      } catch (error) {
        // Skip errors silently
      }
    }

    // 2. CHECK ISSUES CREATED/COMMENTED
    console.log('\n🔍 2. Checking issues...');
    try {
      const issues = await octokit.rest.search.issuesAndPullRequests({
        q: `author:${process.env.GITHUB_USERNAME} type:issue created:2025-08-06`,
        sort: 'created',
        per_page: 100
      });

      contributionDetails.issues = issues.data.total_count;
      if (issues.data.total_count > 0) {
        console.log(`   ✅ Found ${issues.data.total_count} issues created on Aug 6th`);
        issues.data.items.forEach(issue => {
          console.log(`      - ${issue.repository_url.split('/').slice(-2).join('/')}: ${issue.title}`);
        });
      }
    } catch (error) {
      console.log(`   ⚠️  Could not check issues: ${error.message}`);
    }

    // 3. CHECK PULL REQUESTS
    console.log('\n🔍 3. Checking pull requests...');
    try {
      const prs = await octokit.rest.search.issuesAndPullRequests({
        q: `author:${process.env.GITHUB_USERNAME} type:pr created:2025-08-06`,
        sort: 'created',
        per_page: 100
      });

      contributionDetails.pullRequests = prs.data.total_count;
      if (prs.data.total_count > 0) {
        console.log(`   ✅ Found ${prs.data.total_count} pull requests created on Aug 6th`);
        prs.data.items.forEach(pr => {
          console.log(`      - ${pr.repository_url.split('/').slice(-2).join('/')}: ${pr.title}`);
        });
      }
    } catch (error) {
      console.log(`   ⚠️  Could not check pull requests: ${error.message}`);
    }

    // 4. CHECK FOR OTHER ACTIVITY (comments, reviews, etc.)
    console.log('\n🔍 4. Checking recent activity events...');
    try {
      const events = await octokit.rest.activity.listEventsForAuthenticatedUser({
        per_page: 100
      });

      const aug6Events = events.data.filter(event => {
        const eventDate = new Date(event.created_at);
        return eventDate >= startOfDay && eventDate <= endOfDay;
      });

      console.log(`   📊 Found ${aug6Events.length} GitHub events on Aug 6th:`);
      
      aug6Events.forEach(event => {
        const time = new Date(event.created_at).toLocaleTimeString();
        console.log(`      ${time} - ${event.type} in ${event.repo?.name || 'unknown repo'}`);
        
        // Count different types of contributions
        if (event.type === 'PushEvent') {
          // Already counted in commits
        } else if (event.type === 'IssuesEvent') {
          contributionDetails.issues++;
        } else if (event.type === 'PullRequestEvent') {
          contributionDetails.pullRequests++;
        } else if (event.type === 'PullRequestReviewEvent') {
          contributionDetails.reviews++;
        }
      });

    } catch (error) {
      console.log(`   ⚠️  Could not check activity events: ${error.message}`);
    }

    // CALCULATE TOTAL
    totalContributions = contributionDetails.commits + 
                        contributionDetails.issues + 
                        contributionDetails.pullRequests + 
                        contributionDetails.reviews;

    console.log(`\n🎯 COMPREHENSIVE RESULTS for August 6th, 2025:`);
    console.log(`   📝 Commits: ${contributionDetails.commits}`);
    console.log(`   🐛 Issues: ${contributionDetails.issues}`);
    console.log(`   🔀 Pull Requests: ${contributionDetails.pullRequests}`);
    console.log(`   👀 Reviews: ${contributionDetails.reviews}`);
    console.log(`   ➕ Total Found: ${totalContributions}`);
    console.log(`   🎯 GitHub Shows: 12`);
    console.log(`   📊 Difference: ${12 - totalContributions}`);

    if (totalContributions >= 12) {
      console.log(`\n🎉 Success! We found all (or more) contributions.`);
    } else {
      console.log(`\n💡 Note: GitHub's contribution graph may include:`);
      console.log(`   - Private repo activity not accessible via API`);
      console.log(`   - Organization repo activity with limited access`);
      console.log(`   - Different timezone calculations`);
      console.log(`   - Merge commits or other git activities`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getAllContributionsAug6();