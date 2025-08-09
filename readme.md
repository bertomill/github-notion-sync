# GitHub to Notion Sync

Automatically sync your daily GitHub commit count to a Notion database.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables

Create a `.env` file for local testing:
```env
GITHUB_TOKEN=your_github_token
NOTION_TOKEN=your_notion_token
NOTION_DATABASE_ID=your_database_id
GITHUB_USERNAME=your_github_username
```

### 3. Notion Database Setup

Create a Notion database with these properties:
- **Repository** (Title)
- **Date** (Date)
- **Commits** (Number)

Share the database with your Notion integration.

### 4. GitHub Secrets (for Actions)

Add these secrets to your GitHub repository:
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `GITHUB_USERNAME`

Note: `GITHUB_TOKEN` is automatically provided by GitHub Actions.

## Usage

### Manual Run
```bash
node sync.js
```

### Automated (GitHub Actions)
The workflow runs automatically daily at 9 AM UTC.

You can also trigger it manually from the Actions tab.

## How It Works

1. Fetches all commits from yesterday across your repositories
2. Counts total commits
3. Creates a single entry in your Notion database
4. Runs completely hands-off once set up

## Customization

- Change the schedule in `.github/workflows/sync.yml`
- Modify timezone by adjusting the cron expression
- Customize the Notion entry format in `sync.js`