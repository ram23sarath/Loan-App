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
    // 1) Dispatch workflow
    const dispatchRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: REF })
    });
    if (![204].includes(dispatchRes.status)) {
      const txt = await dispatchRes.text();
      return { statusCode: 502, body: `Failed to dispatch workflow: ${dispatchRes.status} ${txt}` };
    }

    // 2) Poll for the latest run for this workflow
    let runId = null;
    const maxPoll = 60; // poll up to ~10 minutes (60 * 10s)
    for (let i = 0; i < maxPoll; i++) {
      const runsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=5`, { headers });
      if (!runsRes.ok) {
        const txt = await runsRes.text();
        return { statusCode: 502, body: `Failed to list runs: ${runsRes.status} ${txt}` };
      }
      const runsJson = await runsRes.json();
      const runs = runsJson.workflow_runs || [];
      if (runs.length > 0) {
        // pick the most recent run
        const run = runs[0];
        runId = run.id;
        // If it's still queued/running, wait until completed
        if (run.status === 'completed') {
          if (run.conclusion !== 'success') {
            return { statusCode: 502, body: `Workflow completed with conclusion: ${run.conclusion}` };
          }
          break; // completed successfully
        }
      }
      await sleep(10000); // 10s
    }

    if (!runId) {
      return { statusCode: 504, body: 'Timed out waiting for workflow run to appear' };
    }

    // 3) Poll until run is completed (in case run was found but not completed)
    for (let i = 0; i < maxPoll; i++) {
      const runRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}`, { headers });
      if (!runRes.ok) {
        const txt = await runRes.text();
        return { statusCode: 502, body: `Failed to get run: ${runRes.status} ${txt}` };
      }
      const runJson = await runRes.json();
      if (runJson.status === 'completed') {
        if (runJson.conclusion !== 'success') {
          return { statusCode: 502, body: `Workflow finished with conclusion: ${runJson.conclusion}` };
        }
        break;
      }
      await sleep(10000);
    }

    // 4) Get artifacts
    const artifactsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}/artifacts`, { headers });
    if (!artifactsRes.ok) {
      const txt = await artifactsRes.text();
      return { statusCode: 502, body: `Failed to list artifacts: ${artifactsRes.status} ${txt}` };
    }
    const artifactsJson = await artifactsRes.json();
    const artifacts = artifactsJson.artifacts || [];
    if (artifacts.length === 0) {
      return { statusCode: 502, body: 'No artifacts produced by workflow' };
    }

    // choose first artifact
    const artifact = artifacts[0];
    const downloadUrl = artifact.archive_download_url; // requires auth
    const artifactName = artifact.name || 'artifact';

    // 5) Download artifact archive and stream back as zip
    const artifactRes = await fetch(downloadUrl, { headers });
    if (!artifactRes.ok) {
      const txt = await artifactRes.text();
      return { statusCode: 502, body: `Failed to download artifact: ${artifactRes.status} ${txt}` };
    }

    const arrayBuffer = await artifactRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const body = buffer.toString('base64');

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${artifactName}.zip"`
      },
      body
    };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};
