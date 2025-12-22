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

  if (!OWNER || !REPO || !TOKEN) {
    return { statusCode: 500, body: 'Missing GITHUB_OWNER, GITHUB_REPO or GITHUB_TOKEN env vars' };
  }

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'backup-trigger-function'
  };

  try {
    // 1) Dispatch workflow and return immediately with a link to the workflow runs view
    const dispatchRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: REF })
    });
    if (![204].includes(dispatchRes.status)) {
      const txt = await dispatchRes.text();
      console.error('Dispatch failed:', dispatchRes.status, txt);
      return { statusCode: 502, body: `Failed to dispatch workflow: ${dispatchRes.status} ${txt}` };
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
