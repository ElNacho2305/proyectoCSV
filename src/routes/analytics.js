/**
 * @openapi
 * /api/analytics/segments:
 *   get:
 *     summary: Totales por segmento de riesgo
 *     responses:
 *       200: { description: OK }
 * /api/analytics/correlations:
 *   get:
 *     summary: Matriz de correlaciones (Pearson) entre factores
 *     responses:
 *       200: { description: OK }
 */
const router = require('express').Router();
const prisma = require('../services/data');

function computeRiskScore(s){
  const w = { studyIntensity: 0.22, sleepProblems: 0.22, headaches: 0.16, socialPressure: 0.18, anxiety: 0.22 };
  const score0to10 = (
    (s.studyIntensity||0)*w.studyIntensity +
    (s.sleepProblems||0)*w.sleepProblems +
    (s.headaches||0)*w.headaches +
    (s.socialPressure||0)*w.socialPressure +
    (s.anxiety||0)*w.anxiety
  );
  return Math.round(score0to10*10);
}
function segmentRisk(score){
  if (score >= 70) return 'alto';
  if (score >= 40) return 'moderado';
  return 'bajo';
}

router.get('/segments', async (_req,res)=>{
  try{
    const rows = await prisma.student.findMany();
    const segments = { bajo:0, moderado:0, alto:0 };
    for(const s of rows){
      const sc = computeRiskScore(s);
      segments[segmentRisk(sc)]++;
    }
    res.json(segments);
  }catch(e){
    if (e.code === 'P2021') return res.status(500).json({ error: 'BD no inicializada. Ejecuta: npx prisma migrate dev --name init'});
    console.error(e); res.status(500).json({ error: 'Error en analytics/segments' });
  }
});

function pearson(xs, ys){
  const n = xs.length;
  const mx = xs.reduce((a,b)=>a+b,0)/n;
  const my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, dx=0, dy=0;
  for(let i=0;i<n;i++){
    const vx = xs[i]-mx, vy=ys[i]-my;
    num += vx*vy; dx += vx*vx; dy += vy*vy;
  }
  return (dx===0||dy===0) ? 0 : (num/Math.sqrt(dx*dy));
}

router.get('/correlations', async (_req,res)=>{
  try{
    const rows = await prisma.student.findMany();
    const fields = ['studyIntensity','sleepProblems','headaches','socialPressure','anxiety'];
    const matrix = {};
    for(const a of fields){
      matrix[a] = {};
      const ax = rows.map(r=>r[a]||0);
      for(const b of fields){
        const bx = rows.map(r=>r[b]||0);
        matrix[a][b] = rows.length ? pearson(ax, bx) : 0;
      }
    }
    res.json({ fields, matrix });
  }catch(e){
    console.error(e); res.status(500).json({ error: 'Error en analytics/correlations' });
  }
});

module.exports = router;