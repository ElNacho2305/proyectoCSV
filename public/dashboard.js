
let studentsData = [];
let currentPage = 1;
const pageSize = 10;

function renderPager(total){
  const pager = document.getElementById('studentsPager');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  pager.innerHTML = '';

  const prev = document.createElement('button');
  prev.textContent = 'Anterior';
  prev.disabled = currentPage <= 1;
  prev.onclick = ()=>{ currentPage--; renderStudentsTable(); };
  pager.appendChild(prev);

  const info = document.createElement('span');
  info.className = 'info';
  info.textContent = `Página ${currentPage} de ${totalPages}`;
  pager.appendChild(info);

  const next = document.createElement('button');
  next.textContent = 'Siguiente';
  next.disabled = currentPage >= totalPages;
  next.onclick = ()=>{ currentPage++; renderStudentsTable(); };
  pager.appendChild(next);
}

function renderStudentsTable(){
  const tb = document.querySelector('#studentsTable tbody');
  tb.innerHTML = '';
  const start = (currentPage - 1) * pageSize;
  const page = studentsData.slice(start, start + pageSize);
  for (const s of page){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.id}</td><td>${s.name}</td><td>${s.year ?? ''}</td>
      <td>${s.riskScore}</td><td>${badgeFor(s.riskSegment)}</td>
      <td><button class="btn" data-id="${s.id}">Recomendaciones</button></td>`;
    tb.appendChild(tr);
  }
  tb.removeEventListener('click', onRecClick);
  tb.addEventListener('click', onRecClick);
  renderPager(studentsData.length);
}

let segmentsChart = null;

async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function loadSegments(){
  const data = await fetchJSON('/api/analytics/segments');
  const ctx = document.getElementById('segmentsChart');
  if (segmentsChart) { try { segmentsChart.destroy(); } catch(_) {} segmentsChart = null; }
  segmentsChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: Object.keys(data), datasets: [{ label: 'Estudiantes', data: Object.values(data) }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false, labels: { color: '#ffffff' } } },
      scales: {
        x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
        y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
      }
    }
  });
}

function badgeFor(segment){
  const seg = (segment||'').toLowerCase();
  if (seg==='alto') return '<span class="badge badge--high">Alto</span>';
  if (seg==='moderado') return '<span class="badge badge--mid">Moderado</span>';
  return '<span class="badge badge--low">Bajo</span>';
}

async function loadStudents(){
  studentsData = await fetchJSON('/api/students');
  currentPage = 1;
  renderStudentsTable();
}

async function onRecClick(e){
  const btn = e.target.closest('button[data-id]');
  if(!btn) return;
  const id = btn.getAttribute('data-id');
  const detail = await fetchJSON('/api/recommendations/'+id);
  openRecModal(detail);
}

function openRecModal(detail){
  const modal = document.getElementById('recModal');

  // Resumen en tabla (no JSON)
  const s = detail?.student || {};
  const resumenHTML = `
    <table class="kv kv--compact"><tbody>
      <tr><th>ID</th><td>${s.id ?? ''}</td></tr>
      <tr><th>Nombre</th><td>${s.name ?? ''}</td></tr>
      <tr><th>Puntaje de riesgo</th><td>${detail?.riskScore ?? ''}</td></tr>
      <tr><th>Segmento</th><td>${detail?.riskSegment ?? ''}</td></tr>
      <tr><th>Intensidad de estudio</th><td>${s.studyIntensity ?? ''}</td></tr>
      <tr><th>Problemas de sueño</th><td>${s.sleepProblems ?? ''}</td></tr>
      <tr><th>Dolores de cabeza</th><td>${s.headaches ?? ''}</td></tr>
      <tr><th>Presión social</th><td>${s.socialPressure ?? ''}</td></tr>
      <tr><th>Ansiedad</th><td>${s.anxiety ?? ''}</td></tr>
    </tbody></table>`;
  document.getElementById('recSummary').innerHTML = resumenHTML;

  // Recomendaciones
  const list = document.getElementById('recList');
  list.innerHTML = '';
  (detail?.recommendations ?? []).forEach(r => {
    const li = document.createElement('li');
    li.textContent = r;
    list.appendChild(li);
  });

  // Abrir modal
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  // Cierre: overlay + botón "Cerrar" + Esc
  const closeables = modal.querySelectorAll('[data-close]');
  const closeHandler = () => closeRecModal();
  closeables.forEach(el => el.addEventListener('click', closeHandler, { once:true }));
  const escHandler = (ev) => { if (ev.key === 'Escape') closeRecModal(); };
  document.addEventListener('keydown', escHandler, { once:true });
  modal._escHandler = escHandler;
}

function closeRecModal(){
  const modal = document.getElementById('recModal');
  if (!modal.classList.contains('is-open')) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

function renderCorr(matrix, fields){
  let html = '<div class="table-wrap"><table><thead><tr><th></th>' + fields.map(f=>`<th>${f}</th>`).join('') + '</tr></thead><tbody>';
  for(const a of fields){
    html += `<tr><th>${a}</th>`;
    for(const b of fields){
      const v = matrix[a][b];
      html += `<td style="text-align:right">${v.toFixed(3)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  document.getElementById('corrTable').innerHTML = html;
}
async function loadCorrelations(){
  const { fields, matrix } = await fetchJSON('/api/analytics/correlations');
  renderCorr(matrix, fields);
}

async function initUpload(){
  const form = document.getElementById('uploadForm');
  if (!form) return;
  const msg = document.getElementById('uploadMsg');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    msg.textContent = 'Subiendo...';
    try{
      const res = await fetch('/api/upload/csv', { method:'POST', body: fd });
      const out = await res.json();
      if(!res.ok) throw new Error(out.error || 'Error de carga');
      msg.textContent = `Insertadas: ${out.inserted}`;
      await loadStudents(); await loadSegments(); await loadCorrelations();
    }catch(err){ msg.textContent = err.message; }
  }, { once:true });
}

window.addEventListener('DOMContentLoaded', async ()=>{
  await Promise.all([loadSegments(), loadCorrelations(), loadStudents(), initUpload()]);
});