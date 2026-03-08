// Scrapes the Shore Watersports surf check page for the Witterings eyeball report.
// Called from the frontend as /api/surfcheck
// Cached for 30 minutes — the report only updates a few times a day.

function clean(str) {
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#[0-9]+;/g, '')
    .replace(/\s+/g, ' ')
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

    let html = await response.text();

    // Strip all <script>...</script> blocks first — GTM and other scripts
    // sit between the surf report <p> tags and pollute the captures
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Also strip <style> blocks
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '');

    // Find the Surfcheck section — everything between h2>Surfcheck and the next h2/h3
    const sectionMatch = html.match(/Surfcheck<\/h2>([\s\S]*?)(?=<h[23])/i);
    const section = sectionMatch ? sectionMatch[1] : html;

    const report = {};

    // Fields are structured as: <p><strong>Label:</strong> value</p>
    // Match label in <strong>, capture value up to </p>
    const extract = (label) => {
      const re = new RegExp('<strong>\\s*' + label + '[^<]*<\\/strong>([\\s\\S]*?)<\\/p>', 'i');
      const m = section.match(re);
      return m ? clean(m[1]) : null;
    };

    report.updated    = extract('Time of Update');
    report.conditions = extract('Todays conditions');
    report.swell      = extract('Swell');
    report.wind       = extract('Wind');
    report.tides      = extract('Tides');

    // Remove empty values
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
