const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!OWNER || !REPO || !TOKEN) return { statusCode: 500, body: 'Missing env vars' };

  try {
    const body = JSON.parse(event.body || '{}');
    const runId = body.run_id;
    const artifactId = body.artifact_id;
    if (!runId || !artifactId) return { statusCode: 400, body: 'Missing run_id or artifact_id' };

    const headers = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'download-artifact-fn' };

    // get artifacts to find archive_download_url
    const artifactsRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}/artifacts`, { headers });
    if (!artifactsRes.ok) {
      const txt = await artifactsRes.text();
      return { statusCode: 502, body: `Failed to list artifacts: ${artifactsRes.status} ${txt}` };
    }
    const artifactsJson = await artifactsRes.json();
    const found = (artifactsJson.artifacts || []).find(a => a.id === artifactId);
    if (!found) return { statusCode: 404, body: 'Artifact not found' };

    const downloadUrl = found.archive_download_url;
    const artifactRes = await fetch(downloadUrl, { headers });
    if (!artifactRes.ok) {
      const txt = await artifactRes.text();
      return { statusCode: 502, body: `Failed to download artifact: ${artifactRes.status} ${txt}` };
    }

    const arrayBuffer = await artifactRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const bodyBase64 = buffer.toString('base64');

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${found.name}.zip"`
      },
      body: bodyBase64
    };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};