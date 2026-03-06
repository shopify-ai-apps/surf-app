exports.handler = async function(event) {
  const sensor = event.queryStringParameters?.sensor;
  if (!sensor) {
    return { statusCode: 400, body: JSON.stringify({ error: 'sensor parameter required' }) };
  }

  const apiKey = process.env.CCO_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  // Try both key in URL and as X-API-Key header, with explicit Referer
  const registeredDomain = process.env.CCO_DOMAIN || 'surf-app.netlify.app';
  const referer = `https://${registeredDomain}`;
  const url = `https://coastalmonitoring.org/observations/waves/latest.geojson?key=${apiKey}&sensor=${encodeURIComponent(sensor)}&duration=1`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Referer': referer,
        'X-API-Key': apiKey,
        'Accept': 'application/json',
        'Origin': referer
      }
    });
    clearTimeout(timeout);

    // Log what we got for debugging
    const responseText = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: `CCO API error: ${response.status}`,
          detail: responseText,
          refererSent: referer,
          urlCalled: url.replace(apiKey, '[KEY]')
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800'
      },
      body: responseText
    };

  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return {
      statusCode: isTimeout ? 504 : 500,
      body: JSON.stringify({ error: isTimeout ? 'CCO API timed out after 10s' : err.message })
    };
  }
};
