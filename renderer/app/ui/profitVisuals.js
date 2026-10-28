import { escapeHtml, money } from '../utils/format.js';

export function renderProfitVisuals(items, margin) {
  const bars = document.getElementById('financeCostProfitChart');
  const gauge = document.getElementById('marginGaugeChart');
  if (!bars || !gauge) return;
  const ceiling = Math.max(1, ...items.map(item => Math.max(item.cost, item.revenue)));
  bars.innerHTML = items.length ? items.map(item => {
    const loss = item.profit < 0;
    const base = loss ? Math.max(0, item.revenue) : item.cost;
    const detail = `${item.label}: koszt ${money(item.cost, 'PLN')}, ${loss ? 'strata' : 'zysk'} ${money(Math.abs(item.profit), 'PLN')}`;
    return `<div class="erp-profit-row" title="${escapeHtml(detail)}">
      <div class="erp-profit-label">${escapeHtml(item.label)}</div>
      <div class="erp-profit-bar" role="img" aria-label="${escapeHtml(detail)}">
        <span class="erp-profit-cost" style="width:${base / ceiling * 100}%"></span>
        <span class="${loss ? 'erp-profit-negative' : 'erp-profit-positive'}" style="width:${Math.abs(item.profit) / ceiling * 100}%"></span>
      </div>
      <div class="erp-profit-value ${loss ? 'finance-loss' : 'finance-profit'}">${escapeHtml(money(item.profit, 'PLN'))}</div>
    </div>`;
  }).join('') : '<div class="hint">Dodaj pozycje, aby zobaczyć wykres.</div>';

  const available = items.some(item => item.revenue > 0);
  const value = Number.isFinite(margin) ? margin : 0;
  const min = Math.min(-20, Math.floor(value / 20) * 20);
  const max = Math.max(60, Math.ceil(value / 20) * 20);
  const position = available ? (value - min) / (max - min) : (0 - min) / (max - min);
  const point = fraction => {
    const angle = Math.PI + fraction * Math.PI;
    return [120 + 90 * Math.cos(angle), 116 + 90 * Math.sin(angle)];
  };
  const tip = point(position);
  const zero = point((0 - min) / (max - min));
  const formatted = available ? value.toLocaleString('pl-PL', { maximumFractionDigits: 2 }) + '%' : '—';
  gauge.innerHTML = `<svg viewBox="0 0 240 170" role="img" aria-label="Marża oferty: ${formatted}" class="erp-gauge ${value < 0 ? 'is-loss' : ''}">
    <path class="erp-gauge-track" d="M30 116 A90 90 0 0 1 210 116" />
    ${available ? `<path class="erp-gauge-value" d="M30 116 A90 90 0 0 1 ${tip[0]} ${tip[1]}" />
    <line class="erp-gauge-needle" x1="120" y1="116" x2="${tip[0]}" y2="${tip[1]}" /><circle cx="120" cy="116" r="4" class="erp-gauge-hub" />` : ''}
    <circle cx="${zero[0]}" cy="${zero[1]}" r="3" class="erp-gauge-zero" />
    <text x="26" y="137">${min}%</text><text x="214" y="137" text-anchor="end">${max}%</text>
    <text x="120" y="158" text-anchor="middle" class="erp-gauge-number">${formatted}</text>
  </svg>`;
}
