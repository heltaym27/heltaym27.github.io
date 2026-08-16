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

async function fetchReportData(name) {
  const jsonUrl = `${REPORTS_DIR}${name}.json`;
  const pdfUrl = `${REPORTS_DIR}${name}.pdf`;

  // Check both files exist
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

  // ---- THIS IS WHERE YOU READ VALUES FROM THE JSON ----
  return {
    name,
    title: data.title ?? name,
    date: data.date ?? '',
    summary: data.summary ?? '',
    authors: data.authors ?? '',
    tags: data.tags ?? '',
    pdfUrl,
  };
  // ------------------------------------------------------
}

// Turns "29/07/2026" into a real Date object newest-first
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

// Publications page
function renderSummaryCard(container, report) {
  const card = document.createElement('a');
  card.className = 'report-summary-card';
  card.href = `/html/report.html?id=${encodeURIComponent(report.name)}`;
  card.innerHTML = `
    <h3>${report.title}</h3>
    ${report.date ? `<p class="report-date">${report.date}</p>` : ''}
    ${report.authors ? `<p class="report-authors">By ${report.authors}</p>` : ''}
    ${tagPills(report.tags)}
    ${report.summary ? `<p class="report-summary">${report.summary}</p>` : ''}
  `;
  container.appendChild(card);
}

// Homepage "Latest Publications" preview card
function renderPreviewCard(container, report) {
  const card = document.createElement('a');
  card.className = 'preview-card';
  card.href = `/html/report.html?id=${encodeURIComponent(report.name)}`;
  card.innerHTML = `
    <div class="preview-thumb"><span class="plus">+</span></div>
    <h4>${report.title}</h4>
    ${report.tags ? `<p class="preview-tags">${report.tags}</p>` : ''}
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

// Individual report page — reads ?id=repo1 from the URL and renders the full detail view
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

  container.innerHTML = `
    <a class="back-link" href="/html/reports.html">&larr; Back to Publications</a>
    <h1>${report.title}</h1>
    <div class="report-meta">
      ${report.date ? `<p class="report-date">${report.date}</p>` : ''}
      ${report.authors ? `<p class="report-authors">By ${report.authors}</p>` : ''}
      ${tagPills(report.tags)}
    </div>
    ${report.summary ? `<p class="report-summary">${report.summary}</p>` : ''}
    <embed type="text/pdf" src="${report.pdfUrl}"/>
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
