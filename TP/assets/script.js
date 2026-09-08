/* =========================================================
   Mi movilidad — lógica de la página (D3 solo para el capítulo
   de clima; los demás gráficos son los Tableau embebidos).
   Los datos vienen inline en assets/data.js (window.SITE_DATA)
   para que la página funcione tanto local (file://) como en
   GitHub Pages, sin depender de fetch().
   ========================================================= */

(function themeInit() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  const applyIcon = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    btn.textContent = isDark ? '☀️' : '🌙';
  };
  applyIcon();
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const isDarkNow = cur === 'dark' || (!cur && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const next = isDarkNow ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    applyIcon();
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: next }));
  });
})();

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const CAT_LABEL_SHORT = { 'Casa': 'Casa', 'Trabajo': 'Trabajo', 'Social / Otros': 'Social / Ocio', 'Sin datos': 'Sin datos' };

const tooltip = document.getElementById('tooltip');
function showTooltip(html, evt) {
  tooltip.innerHTML = html;
  tooltip.classList.add('show');
  moveTooltip(evt);
}
function moveTooltip(evt) {
  tooltip.style.left = evt.clientX + 'px';
  tooltip.style.top = evt.clientY + 'px';
}
function hideTooltip() { tooltip.classList.remove('show'); }

const fmt = d3.format(',.0f');
const fmt1 = d3.format(',.1f');

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function formatMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return `${MESES_ES[m - 1]} ${y}`;
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------------------------------------------------------
   Arranque: los datos ya están en memoria (window.SITE_DATA)
--------------------------------------------------------- */
if (!window.SITE_DATA) {
  console.error('No se encontró window.SITE_DATA — revisá que assets/data.js se cargue antes que script.js');
} else {
  init(window.SITE_DATA);
}

function init(data) {
  renderStats(data.stats);
  renderMapInsight(data.map_points);
  renderCiudadesInsight(data.cities);
  renderVehiculosInsight(data.vehicles);
  renderLugaresInsight(data.placetypes);
  renderTendenciaInsight(data.weekend_trend);
  renderClima(data.rain_cat, data.weather_summary);

  window.addEventListener('resize', debounce(() => renderClima(data.rain_cat, data.weather_summary), 200));
  window.addEventListener('theme-changed', () => renderClima(data.rain_cat, data.weather_summary));
}

/* ---------------------------------------------------------
   Ticket fields (stat row)
--------------------------------------------------------- */
function renderStats(s) {
  const tiles = [
    { lbl: 'Distancia', num: fmt(s.total_km) + ' km' },
    { lbl: 'Viajes', num: fmt(s.total_trips) },
    { lbl: 'Lugares', num: s.total_places },
    { lbl: 'Vigencia', num: s.date_min + ' – ' + s.date_max },
  ];
  const row = document.getElementById('statRow');
  row.innerHTML = tiles.map(t => `<div class="ticket-field"><label>${t.lbl}</label><b>${t.num}</b></div>`).join('');
}

/* ---------------------------------------------------------
   Parada 1 — texto de lectura del dashboard (mapa + rutina)
--------------------------------------------------------- */
function renderMapInsight(points) {
  const homePoints = points.filter(p => p.categoria === 'Casa');
  const homeHoras = d3.sum(homePoints, p => p.horas);
  const topFuera = points.find(p => p.categoria !== 'Casa');
  document.getElementById('mapInsight').innerHTML =
    `Entre mis distintas direcciones de "casa" (Google a veces las separa en varios puntos) sumo ` +
    `<strong>${fmt(homeHoras)} horas</strong>. Fuera de casa, el lugar donde más tiempo pasé es ` +
    `<strong>${topFuera.nombre}</strong> (${topFuera.barrio !== 'Desconocido' ? topFuera.barrio + ', ' : ''}${topFuera.ciudad}), ` +
    `con ${fmt(topFuera.horas)} horas en ${topFuera.visitas} visitas. En el mapa de calor, cada celda es una ` +
    `hora de la semana coloreada por cuánto tiempo pasé fuera de casa en ese bloque — los azules oscuros ` +
    `marcan mis horarios con más movimiento.`;
}

/* ---------------------------------------------------------
   Parada 2 — Ciudades
--------------------------------------------------------- */
function renderCiudadesInsight(cities) {
  const top = cities[0];
  const caba = cities.find(c => c.ciudad === 'Buenos Aires');
  const ratio = caba ? (top.dias / caba.dias) : null;
  document.getElementById('ciudadesInsight').innerHTML =
    `Pasé el equivalente a <strong>${fmt1(top.dias)} días corridos</strong> en ${top.ciudad}` +
    (ratio ? ` — ${fmt1(ratio)} veces más que el tiempo acumulado en la Ciudad de Buenos Aires.` : '.');
}

/* ---------------------------------------------------------
   Parada 3 — Vehículos
--------------------------------------------------------- */
function renderVehiculosInsight(vehicles) {
  const auto = vehicles.find(v => v.vehiculo === 'AUTO');
  const avion = vehicles.find(v => v.vehiculo === 'AVION');
  document.getElementById('vehiculosInsight').innerHTML =
    `El auto se lleva casi la mitad de todos mis kilómetros (${fmt(auto.km)} km en ${auto.viajes} viajes). ` +
    `Curiosidad: solo <strong>2 vuelos</strong> ya suman ${fmt(avion.km)} km — más que subte y tren juntos multiplicado por diez.`;
}

/* ---------------------------------------------------------
   Parada 4 — Lugares más visitados
--------------------------------------------------------- */
function renderLugaresInsight(placetypes) {
  const casa = placetypes.find(p => p.categoria === 'Casa');
  const trabajo = placetypes.find(p => p.categoria === 'Trabajo');
  document.getElementById('lugaresInsight').innerHTML =
    `El trabajo es, en realidad, mi categoría con <strong>más paradas registradas</strong> ` +
    `pero son mucho más cortas: ` +
    `en promedio ${fmt1(trabajo.horas / trabajo.visitas)} h por parada de trabajo, contra ` +
    `${fmt1(casa.horas / casa.visitas)} h por estadía en casa.`;
}

/* ---------------------------------------------------------
   Parada 5 — Tendencia de fin de semana
--------------------------------------------------------- */
function renderTendenciaInsight(trend) {
  // El gráfico de Tableau (Hoja5) solo muestra enero-agosto de 2026 —
  // filtramos acá lo mismo, para no citar un mes que no está en el gráfico.
  const trend2026 = trend.filter(d => d.mes.startsWith('2026'));
  const fullMonths = trend2026.slice(0, -1); // agosto 2026 es un mes parcial (llega hasta el día 18)
  const peak = fullMonths.reduce((a, b) => b.horas > a.horas ? b : a);
  const low = fullMonths.reduce((a, b) => b.horas < a.horas ? b : a);
  document.getElementById('tendenciaInsight').innerHTML =
    `Mi pico de salidas de fin de semana en 2026 fue <strong>${formatMes(peak.mes)}</strong> (${fmt(peak.horas)} h fuera de casa); ` +
    `el mes más casero fue ${formatMes(low.mes)}, con solo ${fmt(low.horas)} h (comparando meses completos).`;
}

/* ---------------------------------------------------------
   Parada 6 — Clima (ordinal, 4 categorías, dos mini-charts)
--------------------------------------------------------- */
function ordinalBars(svgSel, items, valueKey, fmtFn) {
  const svg = d3.select(svgSel);
  svg.selectAll('*').remove();
  const width = svg.node().parentElement.clientWidth;
  const height = 220;
  const margin = { top: 10, right: 10, bottom: 46, left: 14 };
  svg.attr('viewBox', `0 0 ${width} ${height}`).attr('height', height);

  const ramp = ['--seq-200', '--seq-350', '--seq-500', '--seq-650'].map(cssVar);
  const x = d3.scaleBand().domain(items.map(d => d.rain_cat)).range([margin.left, width - margin.right]).padding(0.32);
  const y = d3.scaleLinear().domain([0, d3.max(items, d => d[valueKey]) * 1.3]).range([height - margin.bottom, margin.top]);

  const g = svg.append('g');
  const rows = g.selectAll('g').data(items).join('g');
  rows.append('rect')
    .attr('x', d => x(d.rain_cat)).attr('width', x.bandwidth())
    .attr('y', height - margin.bottom).attr('height', 0)
    .attr('rx', 2)
    .attr('fill', (d, i) => ramp[i])
    .transition().duration(600)
    .attr('y', d => y(d[valueKey]))
    .attr('height', d => height - margin.bottom - y(d[valueKey]));

  rows.append('text')
    .attr('x', d => x(d.rain_cat) + x.bandwidth() / 2)
    .attr('y', d => y(d[valueKey]) - 8)
    .attr('text-anchor', 'middle').attr('class', 'bar-label')
    .text(d => fmtFn(d[valueKey]));

  rows.append('text')
    .attr('x', d => x(d.rain_cat) + x.bandwidth() / 2)
    .attr('y', height - margin.bottom + 18)
    .attr('text-anchor', 'middle').attr('class', 'bar-sub')
    .text(d => d.rain_cat);
  rows.append('text')
    .attr('x', d => x(d.rain_cat) + x.bandwidth() / 2)
    .attr('y', height - margin.bottom + 32)
    .attr('text-anchor', 'middle').attr('class', 'bar-sub')
    .style('opacity', 0.7)
    .text(d => `n=${d.n}`);

  rows.on('mousemove', (evt, d) => showTooltip(`<b>${d.rain_cat}</b><br>${d.n} fines de semana en esta categoría`, evt))
    .on('mouseleave', hideTooltip);
}

function renderClima(rainCat, summary) {
  ordinalBars('#chartLluviaKm', rainCat, 'km', d => fmt1(d) + ' km');
  ordinalBars('#chartLluviaSocial', rainCat, 'social_h', d => fmt1(d) + ' h');

  const seco = rainCat.find(r => r.rain_cat === 'Seco');
  const fuerte = rainCat.find(r => r.rain_cat === 'Lluvia fuerte');
  const kmDrop = Math.round((1 - fuerte.km / seco.km) * 100);
  const socialDrop = Math.round((1 - fuerte.social_h / seco.social_h) * 100);

  document.getElementById('climaHeadline').innerHTML =
    `<div class="big">-${kmDrop}%</div>
     <div class="cap">de kilómetros recorridos en fines de semana con <b>lluvia fuerte</b> (≥15&nbsp;mm)
     frente a fines de semana secos (${fmt1(seco.km)} km → ${fmt1(fuerte.km)} km).</div>`;

  document.getElementById('climaInsight').innerHTML =
    `No dejo de salir de casa cuando llueve (solo ${summary.pct_home_rainy}% de los fines lluviosos me quedo todo el día adentro, ` +
    `muy similar al ${summary.pct_home_dry}% de los secos) — pero cuando la lluvia es fuerte, mis salidas sociales caen un ` +
    `<strong>${socialDrop}%</strong> y me muevo mucho menos: cambio el plan afuera por quedarme más cerca.`;
}
