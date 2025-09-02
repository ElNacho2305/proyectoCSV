let segmentsChart = null; // referencia global Chart.js

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
    data: {
      labels: Object.keys(data),
      datasets: [{ label: 'Estudiantes', data: Object.values(data) }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

function badgeFor(segment){
  const seg = (segment || '').toLowerCase();
  if (seg === 'alto') return `<span class="badge badge--high">Alto</span>`;
  if (seg === 'moderado') return `<span class="badge badge--mid">Moderado</span>`;
  return `<span class="badge badge--low">Bajo</span>`;
}

async function loadStudents(){
  const rows = await fetchJSON('/api/students');
  const tb = document.querySelector('#studentsTable tbody');
  tb.innerHTML = '';
  for(const s of rows){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.id}</td>
      <td>${s.name}</td>
      <td>${s.year ?? ''}</td>
      <td>${s.riskScore}</td>
      <td>${badgeFor(s.riskSegment)}</td>
      <td><button class="btn" data-id="${s.id}">Recomendaciones</button></td>
    `;
    tb.appendChild(tr);
  }
  tb.removeEventListener('click', onRecClick);
  tb.addEventListener('click', onRecClick);
}

async function onRecClick(e){
  const btn = e.target.closest('button[data-id]');
  if(!btn) {
    e.currentTarget.addEventListener('click', onRecClick, { once: true });
    return;
  }
  const id = btn.getAttribute('data-id');
  const detail = await fetchJSON('/api/recommendations/'+id);
  openRecModal(detail);
}

function openRecModal(detail){
  const modal = document.getElementById('recModal');
  const summary = {
    id: detail?.student?.id,
    name: detail?.student?.name,
    riskScore: detail?.riskScore,
    riskSegment: detail?.riskSegment,
    factors: {
      studyIntensity: detail?.student?.studyIntensity,
      sleepProblems: detail?.student?.sleepProblems,
      headaches: detail?.student?.headaches,
      socialPressure: detail?.student?.socialPressure,
      anxiety: detail?.student?.anxiety
    }
  };
  document.getElementById('recSummary').textContent = JSON.stringify(summary, null, 2);
  const list = document.getElementById('recList');
  list.innerHTML = '';
  (detail?.recommendations ?? []).forEach(r => {
    const li = document.createElement('li');
    li.textContent = r;
    list.appendChild(li);
  });
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  const closeables = modal.querySelectorAll('[data-close]');
  const closeHandler = () => closeRecModal();
  closeables.forEach(el => el.addEventListener('click', closeHandler, { once:true }));
  const escHandler = (ev) => { if (ev.key === 'Escape') { closeRecModal(); } };
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
      await loadStudents();
      await loadSegments();
      await loadCorrelations();
    }catch(err){
      msg.textContent = err.message;
    }
  }, { once: true });
}

window.addEventListener('DOMContentLoaded', async ()=>{
  await Promise.all([loadSegments(), loadCorrelations(), loadStudents(), initUpload()]);
});