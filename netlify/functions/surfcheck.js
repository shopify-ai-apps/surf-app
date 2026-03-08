// Scrapes the Shore Watersports surf check page for the Witterings eyeball report.
// Called from the frontend as /api/surfcheck
// Cached for 30 minutes — the report only updates a few times a day.

exports.handler = async function() {
  const url = 'https://www.shore.co.uk/surf-check.html';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SurfApp/1.0)',
        'Accept': 'text/html'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Shore fetch failed: ${response.status}` })
      };
    }

    const html = await response.text();

    // Parse the Surfcheck section from the HTML
    // Target block: <h2>Surfcheck</h2> ... fields follow as <p> or <strong> text
    const report = {};

    // Time of Update
    const timeMatch = html.match(/Time of Update[:\s<\/strong>]+([^<\n]+)/i);
    if (timeMatch) report.updated = timeMatch[1].trim().replace(/&amp;/g, '&');

    // Todays conditions
    const condMatch = html.match(/Todays conditions[:\s<\/strong>]+([^<\n]+)/i);
    if (condMatch) report.conditions = condMatch[1].trim();

    // Swell
    const swellMatch = html.match(/<strong>Swell[:\s<\/strong>]*<\/strong>\s*([^<\n]+)/i)
      || html.match(/Swell[:\s<\/strong>]+([^<\n]+)/i);
    if (swellMatch) report.swell = swellMatch[1].trim();

    // Wind
    const windMatch = html.match(/<strong>Wind[:\s<\/strong>]*<\/strong>\s*([^<\n]+)/i)
      || html.match(/Wind[:\s<\/strong>]+([^<\n]+)/i);
    if (windMatch) report.wind = windMatch[1].trim();

    // Tides
    const tidesMatch = html.match(/<strong>Tides[:\s<\/strong>]*<\/strong>\s*([^<\n]+)/i)
      || html.match(/Tides[:\s<\/strong>]+([^<\n]+)/i);
    if (tidesMatch) report.tides = tidesMatch[1].trim();

    // Sanity check — if we got nothing useful, return an error
    if (!report.updated && !report.conditions) {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Could not parse surf report — page structure may have changed' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800' // 30 min cache
      },
      body: JSON.stringify(report)
    };

  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return {
      statusCode: isTimeout ? 504 : 500,
      body: JSON.stringify({ error: isTimeout ? 'Shore fetch timed out' : err.message })
    };
  }
};
