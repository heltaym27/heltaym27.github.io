const REPORTS_DIR = '/media/reports/';
const LIST_FILE = 'reports.txt';

async function fetchReportsList() {
  const res = await fetch(REPORTS_DIR + LIST_FILE);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0); // drop blank lines
}

// Turns plain text with blank-line-separated paragraphs into safe <p> tags
function textToParagraphs(text) {
  if (!text) return '';
  const escape = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

async function fetchReportData(name) {
  const jsonUrl = `${REPORTS_DIR}${name}.json`;
  const pdfUrl = `${REPORTS_DIR}${name}.pdf`;
  const txtUrl = `${REPORTS_DIR}${name}.txt`;

  // Check the required files exist (json + pdf). The .txt body is optional.
  const [jsonRes, pdfRes] = await Promise.all([
    fetch(jsonUrl).catch(() => null),
    fetch(pdfUrl, { method: 'HEAD' }).catch(() => null), // HEAD = don't download the whole pdf just to check
  ]);

  if (!jsonRes || !jsonRes.ok || !pdfRes || !pdfRes.ok) {
    console.warn(`Skipping "${name}" — missing pdf or json counterpart`);
    return null;
  }

  let data;
  try {
    data = await jsonRes.json();
  } catch (err) {
    console.error(`Failed to parse JSON for "${name}":`, err);
    return null;
  }

  // Try to load the plain-text article body (optional — falls back gracefully if missing)
  let bodyText = '';
  try {
    const txtRes = await fetch(txtUrl);
    if (txtRes.ok) {
      bodyText = await txtRes.text();
    }
  } catch (err) {
    // no .txt file for this report yet — that's fine, just no body content to show
  }

  // ---- THIS IS WHERE YOU READ VALUES FROM THE JSON ----
  return {
    name,
    title: data.title ?? name,
    date: data.date ?? '',
    summary: data.summary ?? '',
    authors: data.authors ?? '',
    tags: data.tags ?? '',
    body: bodyText,
    pdfUrl,
  };
  // ------------------------------------------------------
}

// Turns "29/07/2026" into a real Date object so we can sort newest-first
function parseDate(d) {
  const parts = (d || '').split('/');
  if (parts.length !== 3) return new Date(0);
  const [day, month, year] = parts;
  return new Date(`${year}-${month}-${day}`);
}

function tagPills(tags) {
  if (!tags) return '';
  return `<div class="report-tags">${tags.split(',').map(t => `<span class="tag-pill">${t.trim()}</span>`).join('')}</div>`;
}

// Publications page — clean summary card, links to the report's own page
function renderSummaryCard(container, report) {
  const card = document.createElement('a');
  card.className = 'report-summary-card';
  card.href = `/html/report.html?id=${encodeURIComponent(report.name)}`;
  card.innerHTML = `
    <div class="report-summary-thumb">${generateCoverArt(report)}</div>
    <div class="report-summary-body">
      <h3>${report.title}</h3>
      ${report.date ? `<p class="report-date">${report.date}</p>` : ''}
      ${report.authors ? `<p class="report-authors">By ${report.authors}</p>` : ''}
      ${tagPills(report.tags)}
      ${report.summary ? `<p class="report-summary">${report.summary}</p>` : ''}
    </div>
  `;
  container.appendChild(card);
}

// ---- Generated cover art ----
// Each report gets a unique abstract "cover" instead of a stock image, so your
// editor never has to source or upload a picture per report. The pattern is
// deterministic per report (same title always produces the same art) and
// color-coded by its first tag, so it's visually tied to the topic.
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAG_COLOR_MAP = {
  psychology: '#5F4B8B',
  neuroscience: '#C1440E',
  forensics: '#8A7AB0',
};
const FALLBACK_COLORS = ['#5F4B8B', '#C1440E', '#8A7AB0', '#453569'];

function colorForReport(report) {
  const firstTag = (report.tags || '').split(',')[0].trim().toLowerCase();  if (TAG_COLOR_MAP[firstTag]) return TAG_COLOR_MAP[firstTag];
  const seed = hashString(report.title || report.name);
  return FALLBACK_COLORS[seed % FALLBACK_COLORS.length];
}

function generateCoverArt(report) {
  const seed = hashString(report.title || report.name);
  const rand = mulberry32(seed);
  const color = colorForReport(report);
  const W = 320, H = 200;
  const paths = [];

  function branch(x, y, angle, length, depth) {
    if (depth <= 0 || length < 10) return;
    const x2 = x + length * Math.cos(angle);
    const y2 = y + length * Math.sin(angle);
    const cx = x + (length * 0.5) * Math.cos(angle + (rand() - 0.5) * 0.4);
    const cy = y + (length * 0.5) * Math.sin(angle + (rand() - 0.5) * 0.4);
    const w = Math.max(1.2, depth * 1.3);
    paths.push(`<path d="M ${x.toFixed(1)} ${y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="white" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="0.55"/>`);
    const branches = depth > 1 ? (rand() < 0.5 ? 2 : 3) : 1;
    for (let i = 0; i < branches; i++) {
      const da = (rand() * 0.7 + 0.3) * (rand() < 0.5 ? -1 : 1);
      branch(x2, y2, angle + da, length * (0.6 + rand() * 0.2), depth - 1);
    }
  }

  const centers = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < centers; i++) {
    const cx = 40 + rand() * (W - 80);
    const cy = 30 + rand() * (H - 60);
    const nBranches = 4 + Math.floor(rand() * 3);
    for (let b = 0; b < nBranches; b++) {
      const a = (2 * Math.PI / nBranches) * b + rand() * 0.5;
      branch(cx, cy, a, 22 + rand() * 20, 3);
    }
  }

  return `<svg class="cover-art" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <rect width="${W}" height="${H}" fill="${color}"/>
    ${paths.join('\n')}
  </svg>`;
}

function renderPreviewCard(container, report) {
  const card = document.createElement('a');
  card.className = 'preview-card';
  card.href = `/html/report.html?id=${encodeURIComponent(report.name)}`;
  card.innerHTML = `
    <div class="preview-thumb">${generateCoverArt(report)}</div>
    <h4>${report.title}</h4>
    ${report.tags ? `<p class="preview-tags">${report.tags}</p>` : ''}
    ${report.summary ? `<p class="preview-summary">${report.summary}</p>` : ''}
  `;
  container.appendChild(card);
}

async function loadReportsList() {
  const fullContainer = document.getElementById('reports');
  const previewContainer = document.getElementById('latest-reports');
  if (!fullContainer && !previewContainer) return; // neither section exists on this page

  let names;
  try {
    names = await fetchReportsList();
  } catch (err) {
    console.error(`Could not load ${LIST_FILE}:`, err);
    return;
  }

  if (names.length === 0) {
    console.log('reports.txt is empty.');
    return;
  }

  const results = await Promise.all(names.map(fetchReportData));
  const reports = results.filter(Boolean); // drop the skipped/broken ones

  // newest first
  reports.sort((a, b) => parseDate(b.date) - parseDate(a.date));

  if (fullContainer) {
    reports.forEach(r => renderSummaryCard(fullContainer, r));
  }
  if (previewContainer) {
    reports.slice(0, 3).forEach(r => renderPreviewCard(previewContainer, r));
  }
}

// Individual report page — reads ?id=repo1 from the URL and renders the full article
async function loadReportDetail() {
  const container = document.getElementById('report-detail');
  if (!container) return; // this isn't the report detail page

  const params = new URLSearchParams(window.location.search);
  const name = params.get('id');

  if (!name) {
    container.innerHTML = '<p>No report specified.</p>';
    return;
  }

  const report = await fetchReportData(name);

  if (!report) {
    container.innerHTML = '<p>Sorry, that report could not be found.</p>';
    return;
  }

  document.title = `${report.title} - Cognate`;

  const bodyHtml = report.body
    ? textToParagraphs(report.body)
    : (report.summary ? `<p>${report.summary}</p>` : '<p><em>Full text coming soon.</em></p>');

  container.innerHTML = `
    <a class="back-link" href="/html/reports.html">&larr; Back to Publications</a>
    <h1>${report.title}</h1>
    <div class="report-meta">
      ${report.date ? `<p class="report-date">${report.date}</p>` : ''}
      ${report.authors ? `<p class="report-authors">By ${report.authors}</p>` : ''}
      ${tagPills(report.tags)}
    </div>
    <div class="report-body">
      ${bodyHtml}
    </div>
  `;
}

// Run as soon as possible
function init() {
  loadReportsList();
  loadReportDetail();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
