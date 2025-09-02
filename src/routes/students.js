/**
 * @openapi
 * /api/students:
 *   get: { summary: Lista estudiantes con score/segmento, responses: { 200: { description: OK } } }
 *   post:
 *     summary: Crear/Upsert estudiante (deduplicación por fingerprint)
 *     requestBody: { required: true }
 *     responses: { 201: { description: Creado } }
 */
const router = require('express').Router();
const prisma = require('../services/data');
const crypto = require('crypto');

function computeRiskScore(s){
  const w = { studyIntensity: .22, sleepProblems: .22, headaches: .16, socialPressure: .18, anxiety: .22 };
  return Math.round(((s.studyIntensity||0)*w.studyIntensity + (s.sleepProblems||0)*w.sleepProblems + (s.headaches||0)*w.headaches + (s.socialPressure||0)*w.socialPressure + (s.anxiety||0)*w.anxiety)*10);
}
function segmentRisk(score){ return score>=70?'alto':score>=40?'moderado':'bajo'; }
function fingerprintOf(r){
  const c = {
    name:(r.name||'').trim().toLowerCase(), age:r.age??null, gender:(r.gender||'').trim().toLowerCase(), year:r.year??null,
    studyIntensity:+(r.studyIntensity||0), sleepProblems:+(r.sleepProblems||0), headaches:+(r.headaches||0),
    socialPressure:+(r.socialPressure||0), anxiety:+(r.anxiety||0), gpa:(r.gpa==null?null:+r.gpa)
  };
  return crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex');
}

router.get('/', async (_req,res)=>{
  try{
    const rows = await prisma.student.findMany({ orderBy:{id:'asc'} });
    res.json(rows.map(s=>({ ...s, riskScore: computeRiskScore(s), riskSegment: segmentRisk(computeRiskScore(s)) })));
  }catch(e){
    if (e.code === 'P2021') return res.status(500).json({ error:'BD no inicializada. Ejecuta: npx prisma migrate dev --name init' });
    res.status(500).json({ error:'Error al listar estudiantes' });
  }
});

router.post('/', async (req,res)=>{
  const data = req.body;
  const fingerprint = fingerprintOf(data);
  const created = await prisma.student.upsert({ where:{ fingerprint }, update:{}, create:{ ...data, fingerprint } });
  const riskScore = computeRiskScore(created);
  res.status(201).json({ ...created, riskScore, riskSegment: segmentRisk(riskScore) });
});

module.exports = router;