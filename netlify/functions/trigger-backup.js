// Netlify function: trigger-backup
// Triggers the GitHub Actions workflow 'db-backup.yml', waits for completion, and returns the artifact ZIP

const OWNER = process.env.GITHUB_OWNER; // e.g. 'your-org-or-user'
const REPO = process.env.GITHUB_REPO; // e.g. 'Loan-App'
const TOKEN = process.env.GITHUB_TOKEN; // Personal access token with repo/workflow access
const WORKFLOW_FILE = 'db-backup.yml';
const REF = process.env.GITHUB_REF || 'main';

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Check for missing env vars with specific messages
  const missing = [];
  if (!OWNER) missing.push('GITHUB_OWNER');
  if (!REPO) missing.push('GITHUB_REPO');
  if (!TOKEN) missing.push('GITHUB_TOKEN');

  if (missing.length > 0) {
    return {
      statusCode: 500,
      body: `Missing environment variables: ${missing.join(', ')}. Please set these in Netlify Dashboard > Site settings > Environment variables.`
    };
  }

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'backup-trigger-function'
  };

  try {
    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
    console.log(`Dispatching workflow to: ${apiUrl}`);

    // 1) Dispatch workflow and return immediately with a link to the workflow runs view
    const dispatchRes = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: REF })
    });

    if (![204].includes(dispatchRes.status)) {
      const txt = await dispatchRes.text();
      console.error('Dispatch failed:', dispatchRes.status, txt);

      // Provide helpful error message for common issues
      let helpMsg = '';
      if (dispatchRes.status === 404) {
        helpMsg = `\n\nPossible causes:\n1. GITHUB_OWNER (${OWNER}) or GITHUB_REPO (${REPO}) is incorrect\n2. Workflow file '${WORKFLOW_FILE}' doesn't exist\n3. GITHUB_TOKEN doesn't have 'repo' and 'workflow' permissions\n4. The repository is private and the token doesn't have access`;
      } else if (dispatchRes.status === 401 || dispatchRes.status === 403) {
        helpMsg = `\n\nGITHUB_TOKEN is invalid or doesn't have proper permissions. Ensure it has 'repo' and 'workflow' scopes.`;
      }

      return { statusCode: 502, body: `Failed to dispatch workflow: ${dispatchRes.status} ${txt}${helpMsg}` };
    }

    const workflowUrl = `https://github.com/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}`;
    const runsUrl = `https://github.com/${OWNER}/${REPO}/actions`;

    // Return a short response so the function doesn't time out waiting for long-running workflow
    return {
      statusCode: 202,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Workflow dispatched', workflowUrl, runsUrl })
    };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};
