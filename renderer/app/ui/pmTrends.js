import { escapeHtml } from '../utils/format.js';

const metrics = [
  ['totalNet', 'Sprzedaż netto', 'PLN'],
  ['totalProfit', 'Zysk z Subiekta', 'PLN'],
  ['weightedMarginPct', 'Marża ważona', '%'],
  ['pmNetResult', 'Wynik PM netto', 'PLN'],
];
const number = n => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;
const value = (m, key) => m && m[key] != null && Number.isFinite(Number(m[key])) ? Number(m[key]) : null;
const display = (v, unit) => v === null ? 'Brak danych' : `${number(v)} ${unit}`;

export function buildMonthlyTrend(periods, period, current, now = new Date()) {
  const end = /^\d{4}-\d{2}/.exec(period?.to || '')?.[0];
  if (!end) return [];
  const [year, month] = end.split('-').map(Number);
  const byMonth = new Map();
  // Only complete calendar ranges can be compared as months; latest saved copy wins.
  [...(periods || [])].sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt))).forEach(entry => {
    const p = entry.period;
    if (!p?.from || !p?.to) return;
    const [y, m] = p.from.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    if (p.from === `${monthKey(y, m - 1)}-01` && p.to === `${monthKey(y, m - 1)}-${last}`) byMonth.set(p.from.slice(0, 7), entry.metrics);
  });
  if (period.mode === 'month' && current) byMonth.set(period.from.slice(0, 7), current);
  const today = monthKey(now.getFullYear(), now.getMonth());
  return Array.from({ length: 12 }, (_, index) => {
    const d = new Date(year, month - 12 + index, 1);
    const key = monthKey(d.getFullYear(), d.getMonth());
    return { key, label: d.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' }), metrics: byMonth.get(key) || null, partial: key === today, future: key > today };
  });
}

export function metricChange(current, previous, points = false) {
  if (current === null || previous === null) return 'Brak porównania';
  const delta = current - previous;
  const signed = n => `${n > 0 ? '+' : ''}${number(n)}`;
  if (points) return `${signed(delta)} p.p.`;
  // A zero/negative base does not have a meaningful growth percentage.
  return `${signed(delta)} PLN${previous > 0 ? ` (${signed(delta / previous * 100)}%)` : ' · brak dodatniej bazy %'}`;
}

function chart(rows, key, title, unit) {
  const data = rows.map(r => value(r.metrics, key));
  const lo = Math.min(0, ...data.filter(v => v !== null));
  const hi = Math.max(0, ...data.filter(v => v !== null));
  const span = hi - lo || 1;
  const y = v => 28 + (hi - v) / span * 115;
  const zero = y(0);
  const axis = n => Number(n).toLocaleString('pl-PL', { notation: 'compact', maximumFractionDigits: 1 });
  return `<section class="pmTrendChart"><h4>${title} <small>${unit}</small></h4><svg viewBox="0 0 520 190" role="img" aria-label="${title}, ostatnie 12 miesięcy. Dokładne wartości w tabeli poniżej.">
    ${[hi, lo].map(v => `<text x="44" y="${y(v) + 4}" text-anchor="end" class="pmTrendAxis">${axis(v)}</text>`).join('')}
    <line x1="50" x2="510" y1="${zero}" y2="${zero}" class="pmTrendBaseline"/>
    ${rows.map((r, i) => { const v = data[i], x = 57 + i * 38; return `${v === null ? `<text x="${x + 12}" y="${zero - 7}" text-anchor="middle" class="pmTrendAxis">—</text>` : `<rect x="${x}" y="${Math.min(y(v), zero)}" width="24" height="${Math.max(1, Math.abs(y(v) - zero))}" class="${v < 0 ? 'pmTrendNegative' : 'pmTrendBar'}" opacity="${r.partial ? '.55' : '1'}"><title>${escapeHtml(r.label)}: ${display(v, unit)}${r.partial ? ' · miesiąc w toku' : ''}</title></rect>`}<text x="${x + 12}" y="165" text-anchor="middle" class="pmTrendAxis">${r.key.slice(5)}</text><text x="${x + 12}" y="181" text-anchor="middle" class="pmTrendAxis">${r.key.slice(2, 4)}</text>`; }).join('')}
  </svg></section>`;
}

export function renderMonthlyTrend(rows, mode = 'month', mail = false) {
  if (!rows.length) return '<p>Wybierz poprawny okres raportu.</p>';
  const current = rows.at(-1), previous = rows.at(-2);
  const cards = metrics.map(([key, label, unit]) => `<div class="pmTrendKpi"><span>${label}</span><strong>${display(value(current.metrics, key), unit)}</strong><small>${metricChange(value(current.metrics, key), value(previous.metrics, key), unit === '%')}</small></div>`).join('');
  const table = `<table class="pmTrendTable"><thead><tr><th>Miesiąc</th>${metrics.map(([,label,unit])=>`<th>${label} (${unit})</th>`).join('')}<th>Sprzedaż m/m</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${escapeHtml(r.label)}${r.partial ? ' · w toku' : ''}${r.future ? ' · przyszły' : ''}</td>${metrics.map(([key, ,unit]) => `<td>${display(value(r.metrics, key), unit)}</td>`).join('')}<td>${metricChange(value(r.metrics, 'totalNet'), value(rows[i - 1]?.metrics, 'totalNet'))}</td></tr>`).join('')}</tbody></table>`;
  const note = 'Źródło: zapisane okresy Subiekta i CSV przypisany do wybranego miesiąca. Brak danych nie oznacza zera. Miesiąc w toku porównujemy do całego poprzedniego miesiąca; nie jest to porównanie MTD.';
  if (mail) return `<h3>Subiekt — historia miesięczna</h3><p>${note}</p>${table}`;
  return `<h3>Subiekt — trend 12 miesięcy</h3><p class="mini">${note}${mode !== 'month' ? ' Zakres niestandardowy nie jest dodawany do trendu miesięcznego.' : ''}</p><div class="pmTrendHeading">${escapeHtml(current.label)} / ${escapeHtml(previous.label)}${current.partial ? ' · bieżący miesiąc niepełny' : ''}</div><div class="pmTrendKpis">${cards}</div><div class="pmTrendCharts">${chart(rows, 'totalNet', 'Sprzedaż netto', 'PLN')}${chart(rows, 'totalProfit', 'Zysk z Subiekta', 'PLN')}${chart(rows, 'weightedMarginPct', 'Marża ważona', '%')}${chart(rows, 'pmNetResult', 'Wynik PM netto', 'PLN')}</div><details><summary>Wartości miesięczne i zmiany m/m</summary><div class="pmTrendTableWrap">${table}</div></details>`;
}

export function prepareReportMail(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.body.firstElementChild;
  if (root) { root.style.backgroundColor = '#ffffff'; root.style.color = '#1e293b'; }
  doc.querySelectorAll('table').forEach(table => { table.style.width = '100%'; table.style.borderCollapse = 'collapse'; table.style.backgroundColor = '#ffffff'; table.style.color = '#1e293b'; });
  doc.querySelectorAll('td, th').forEach(cell => {
    const header = cell.tagName === 'TH';
    cell.style.backgroundColor = header ? '#e8edf4' : '#ffffff';
    cell.style.color = '#1e293b';
    cell.style.padding = '10px 12px';
    cell.style.borderBottom = '1px solid #dbe3f0';
    cell.setAttribute('bgcolor', header ? '#e8edf4' : '#ffffff');
  });
  const mailHtml = doc.body.innerHTML;
  doc.querySelectorAll('td, th').forEach(cell => cell.append('\t'));
  doc.querySelectorAll('tr, p, h1, h2, h3, li').forEach(block => block.append('\n'));
  return { mailHtml, mailText: (doc.body.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() };
}

// One self-contained raster per chart: shared by PDF and clipboard HTML.
export function createMonthlyChartImages(rows) {
  if (!rows.length) return [];
  return metrics.map(([key, title, unit]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1e293b'; ctx.font = '600 26px Arial';
    ctx.fillText(`${title} (${unit})`, 24, 36);
    const values = rows.map(r => value(r.metrics, key));
    const min = Math.min(0, ...values.filter(v => v !== null));
    const max = Math.max(0, ...values.filter(v => v !== null));
    const span = max - min || 1;
    const y = n => 92 + (max - n) / span * 210;
    const baseline = y(0);
    ctx.font = '20px Arial'; ctx.fillStyle = '#475569';
    ctx.textAlign = 'right';
    [...new Set([min, max, 0])].forEach(n => {
      ctx.fillText(Number(n).toLocaleString('pl-PL', { notation: 'compact', maximumFractionDigits: 1 }), 94, y(n) + 6);
    });
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(110, baseline); ctx.lineTo(1380, baseline); ctx.stroke();
    rows.forEach((row, index) => {
      const v = values[index], x = 126 + index * 104;
      ctx.textAlign = 'center';
      if (v !== null) {
        ctx.fillStyle = v < 0 ? '#bc4141' : row.partial ? '#94b2d9' : '#386cb4';
        ctx.fillRect(x + 17, Math.min(y(v), baseline), 60, Math.max(2, Math.abs(y(v) - baseline)));
        ctx.fillStyle = '#1e293b'; ctx.font = '18px Arial';
        ctx.fillText(Number(v).toLocaleString('pl-PL', { notation: 'compact', maximumFractionDigits: 1 }), x + 47, v < 0 ? y(v) + 23 : y(v) - 12);
      } else { ctx.fillStyle = '#64748b'; ctx.fillText('—', x + 47, baseline - 12); }
      ctx.fillStyle = '#475569'; ctx.font = '19px Arial';
      ctx.fillText(`${row.key.slice(5)}.${row.key.slice(2, 4)}${row.partial ? '*' : ''}`, x + 47, 354);
    });
    ctx.textAlign = 'left'; ctx.font = '18px Arial'; ctx.fillStyle = '#64748b';
    ctx.fillText('— brak danych     * miesiąc w toku, porównywany z pełnym poprzednim miesiącem', 24, 399);
    return { title, dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  });
}

export function renderMonthlyChartsMail(rows) {
  return createMonthlyChartImages(rows).map(img => `<div style="margin:16px 0;background:#ffffff;"><img src="${img.dataUrl}" alt="${escapeHtml(img.title)} - trend 12 miesięcy; wartości w tabeli historii" width="700" height="210" style="display:block;width:100%;max-width:700px;height:auto;border:0;background:#ffffff;" /></div>`).join('');
}
