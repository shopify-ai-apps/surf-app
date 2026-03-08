// Scrapes the Shore Watersports surf check page for the Witterings eyeball report.
// Called from the frontend as /api/surfcheck
// Cached for 30 minutes — the report only updates a few times a day.

function clean(str) {
  return str
    .replace(/<[^>]*>/g, '')
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

    // Isolate just the Surfcheck section to avoid matching keywords in scripts/other content
    const sectionMatch = html.match(/##\s*Surfcheck([\s\S]*?)(?=##\s*\w|<h[23]|$)/i)
      || html.match(/Surfcheck<\/h2>([\s\S]*?)(?=<h2|<footer|<div class="footer)/i)
      || html.match(/id="surfcheck"[^>]*>([\s\S]*?)(?=<h2|<footer)/i);

    // Fall back to full HTML if section not isolatable, but limit to 4000 chars after "Surfcheck"
    const idx = html.indexOf('Surfcheck');
    const section = sectionMatch ? sectionMatch[1] : (idx > -1 ? html.slice(idx, idx + 4000) : html);

    const report = {};

    const extract = (pattern) => {
      const m = section.match(pattern);
      return m ? clean(m[1]) : null;
    };

    // Match <strong>Label:</strong> then grab text up to next <strong> tag
    // Using a short lookahead so we don't bleed into script blocks
    report.updated    = extract(/Time of Update[^>]*>([\s\S]*?)(?=<strong>)/i);
    report.conditions = extract(/Todays conditions[^>]*>([\s\S]*?)(?=<strong>)/i);
    report.swell      = extract(/<strong>\s*Swell\s*[:\s]*<\/strong>([\s\S]*?)(?=<strong>)/i);
    report.wind       = extract(/<strong>\s*Wind\s*[:\s]*<\/strong>([\s\S]*?)(?=<strong>)/i);
    report.tides      = extract(/<strong>\s*Tides\s*[:\s]*<\/strong>([\s\S]*?)(?=<strong>|<\/p>|<h[23])/i);

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
