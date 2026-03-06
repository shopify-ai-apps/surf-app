exports.handler = async function(event) {
  const sensor = event.queryStringParameters?.sensor;
  if (!sensor) {
    return { statusCode: 400, body: JSON.stringify({ error: 'sensor parameter required' }) };
  }

  const apiKey = process.env.CCO_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const url = `https://coastalmonitoring.org/observations/waves/latest.geojson?key=${apiKey}&sensor=${encodeURIComponent(sensor)}&duration=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'Referer': `https://${process.env.NETLIFY_SITE_URL || process.env.URL || 'bracklesham-surf.netlify.app'}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: `CCO API error: ${response.status}` }) };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800' // cache 30 mins — buoys update every 30 mins
      },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
