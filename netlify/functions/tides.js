exports.handler = async function(event) {
  const stationId = event.queryStringParameters?.station;
  if (!stationId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'station parameter required' }) };
  }

  const apiKey = process.env.ADMIRALTY_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ADMIRALTY_API_KEY not configured' }) };
  }

  const url = `https://admiraltyapi.azure-api.net/uktidalapi/api/V1/Stations/${encodeURIComponent(stationId)}/TidalEvents?duration=2`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    });
    clearTimeout(timeout);

    const responseText = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: `ADMIRALTY API error: ${response.status}`,
          detail: responseText
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: responseText
    };

  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return {
      statusCode: isTimeout ? 504 : 500,
      body: JSON.stringify({ error: isTimeout ? 'ADMIRALTY API timed out' : err.message })
    };
  }
};
