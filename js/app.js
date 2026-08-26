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

  // Check the required files exist
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

  
  let bodyText = '';
  try {
    const txtRes = await fetch(txtUrl);
    if (txtRes.ok) {
      bodyText = await txtRes.text();
    }
  } catch (err) {
    // no .txt file for this report yet — that's fine, just no body content to show
  }


  return {
    name,
    title: data.title ?? name,
    date: data.date ?? '',
    summary: data.summary
