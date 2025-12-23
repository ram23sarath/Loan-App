// Netlify function: cancel-backup
// Cancels a running GitHub Actions workflow run

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    if (!OWNER || !REPO || !TOKEN) {
        return { statusCode: 500, body: 'Missing GITHUB_OWNER, GITHUB_REPO or GITHUB_TOKEN env vars' };
    }

    const { runId } = JSON.parse(event.body || '{}');

    if (!runId) {
        return { statusCode: 400, body: 'Missing runId in request body' };
    }

    const headers = {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'backup-cancel-function'
    };

    try {
        // Cancel the workflow run
        const cancelRes = await fetch(
            `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}/cancel`,
            {
                method: 'POST',
                headers
            }
        );

        if (cancelRes.status === 202) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, message: 'Workflow cancelled' })
            };
        } else {
            const txt = await cancelRes.text();
            console.error('Cancel failed:', cancelRes.status, txt);
            return {
                statusCode: cancelRes.status,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: `Failed to cancel: ${txt}` })
            };
        }
    } catch (err) {
        return { statusCode: 500, body: String(err) };
    }
};
