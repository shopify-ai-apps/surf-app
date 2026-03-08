// Scrapes the Shore Watersports surf check page for the Witterings eyeball report.
// Called from the frontend as /api/surfcheck
// Cached for 30 minutes — the report only updates a few times a day.

// Strip any HTML tags and decode basic entities from a captured string
function clean(str) {
  return str
    .replace(/<[^>]*>/g, '')   // remove any tags e.g. </span> fragments
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#[0-9]+;/g, '')
    .trim();
}

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
    const report = {};

    // Each field is wrapped like:
    //   <strong>Time of Update:</strong> </span>Sunday, 8th February...
    // We match the label, then grab everything up to the next <strong> or end of paragraph,
    // then strip any stray tags with clean().

    const extract = (pattern) => {
      const m = html.match(pattern);
      return m ? clean(m[1]) : null;
    };

    report.updated    = extract(/Time of Update[^>]*>([^]*?)(?=<strong>|<\/p>|<br)/i);
    report.conditions = extract(/Todays conditions[^>]*>([^]*?)(?=<strong>|<\/p>|<br)/i);
    report.swell      = extract(/>\s*Swell[^>]*>([^]*?)(?=<strong>|<\/p>|<br)/i);
    report.wind       = extract(/>\s*Wind[^>]*>([^]*?)(?=<strong>|<\/p>|<br)/i);
    report.tides      = extract(/>\s*Tides[^>]*>([^]*?)(?=<strong>|<\/p>|<br)/i);

    // Remove empty strings
    Object.keys(report).forEach(k => { if (!report[k]) delete report[k]; });

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
        'Cache-Control': 'public, max-age=1800'
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
