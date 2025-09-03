/**
 * @openapi
 * /api/analytics/segments: { get: { summary: Totales por segmento, responses: { 200: { description: OK } } } }
 * /api/analytics/correlations: { get: { summary: Matriz de correlaciones, responses: { 200: { description: OK } } } }
 */
const router = require('express').Router();
const prisma = require('../services/data');
const w = { studyIntensity: .22, sleepProblems: .22, headaches: .16, socialPressure: .18, anxiety: .22 };
const compute = s => Math.round(((s.studyIntensity||0)*w.studyIntensity + (s.sleepProblems||0)*w.sleepProblems + (s.headaches||0)*w.headaches + (s.socialPressure||0)*w.socialPressure + (s.anxiety||0)*w.anxiety)*10);
const seg = v => v>=70?'alto':v>=40?'moderado':'bajo';

router.get('/segments', async (_req,res)=>{
  try{
    const rows = await prisma.student.findMany();
    const totals = { bajo:0, moderado:0, alto:0 };
    for (const s of rows) totals[seg(compute(s))]++;
    res.json(totals);
  }catch(e){ res.status(500).json({ error:'Error en analytics/segments' }); }
});

function pearson(xs, ys){
  const n=xs.length, mx=xs.reduce((a,b)=>a+b,0)/n, my=ys.reduce((a,b)=>a+b,0)/n;
  let num=0,dx=0,dy=0; for(let i=0;i<n;i++){ const vx=xs[i]-mx, vy=ys[i]-my; num+=vx*vy; dx+=vx*vx; dy+=vy*vy; }
  return (dx===0||dy===0)?0:(num/Math.sqrt(dx*dy));
}
router.get('/correlations', async (_req,res)=>{
  try{
    const rows = await prisma.student.findMany();
    const fields = ['studyIntensity','sleepProblems','headaches','socialPressure','anxiety'];
    const matrix = {}; for(const a of fields){ matrix[a]={}; const ax=rows.map(r=>r[a]||0); for(const b of fields){ const bx=rows.map(r=>r[b]||0); matrix[a][b]=rows.length?pearson(ax,bx):0; } }
    res.json({ fields, matrix });
  }catch(e){ res.status(500).json({ error:'Error en analytics/correlations' }); }
});
module.exports = router;