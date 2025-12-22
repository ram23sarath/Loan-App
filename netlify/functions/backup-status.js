const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const WORKFLOW_FILE = 'db-backup.yml';

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!OWNER || !REPO || !TOKEN) return { statusCode: 500, body: 'Missing env vars' };

  const headers = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'backup-status-fn' };

  try {
    const runsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=5`, { headers });
    if (!runsRes.ok) {
      const txt = await runsRes.text();
      return { statusCode: 502, body: `Failed to list runs: ${runsRes.status} ${txt}` };
    }
    const runsJson = await runsRes.json();
    const runs = runsJson.workflow_runs || [];
    if (runs.length === 0) return { statusCode: 200, body: JSON.stringify({ found: false }) };

    const run = runs[0];
    const result = {
      found: true,
      id: run.id,
      status: run.status, // queued, in_progress, completed
      conclusion: run.conclusion || null,
      html_url: run.html_url,
      created_at: run.created_at
    };

    if (run.status === 'completed') {
      const artifactsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}/artifacts`, { headers });
      if (artifactsRes.ok) {
        const artifactsJson = await artifactsRes.json();
        result.artifacts = (artifactsJson.artifacts || []).map(a => ({ id: a.id, name: a.name }));
      }
    }

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};