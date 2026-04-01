const GITHUB_API_BASE = 'https://api.github.com';

const jsonResponse = (statusCode, body) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  if (req.method !== 'GET') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const workflowFile = process.env.INSTALLMENT_CRON_WORKFLOW_FILE || 'installment-cron.yml';

  if (!owner || !repo || !token) {
    return jsonResponse(500, {
      error: 'Missing required GitHub configuration',
      required: ['GITHUB_OWNER', 'GITHUB_REPO', 'GITHUB_TOKEN'],
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'installment-cron-status-fn',
  };

  const workflowRunsUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=1`;

  try {
    const runsRes = await fetch(workflowRunsUrl, { headers });

    if (!runsRes.ok) {
      const details = await runsRes.text();
      return jsonResponse(502, {
        error: 'Failed to fetch workflow runs',
        status: runsRes.status,
        details,
      });
    }

    const runsJson = await runsRes.json();
    const latestRun = runsJson.workflow_runs?.[0];

    if (!latestRun) {
      return jsonResponse(200, {
        found: false,
        workflow: workflowFile,
        message: 'No workflow runs found for installment cron.',
      });
    }

    const isSuccessful =
      latestRun.status === 'completed' && latestRun.conclusion === 'success';

    return jsonResponse(200, {
      found: true,
      workflow: workflowFile,
      run: {
        id: latestRun.id,
        status: latestRun.status,
        conclusion: latestRun.conclusion || null,
        html_url: latestRun.html_url,
        created_at: latestRun.created_at,
        updated_at: latestRun.updated_at,
        run_started_at: latestRun.run_started_at,
      },
      isSuccessful,
    });
  } catch (error) {
    return jsonResponse(500, {
      error: 'Failed to check installment cron status',
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
