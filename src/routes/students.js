/**
 * @openapi
 * /api/students:
 *   get:
 *     summary: Lista estudiantes con score/segmento
 *     responses:
 *       200:
 *         description: OK
 *   post:
 *     summary: Crear estudiante
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               age: { type: integer, nullable: true }
 *               gender: { type: string, nullable: true }
 *               year: { type: integer, nullable: true }
 *               studyIntensity: { type: integer }
 *               sleepProblems: { type: integer }
 *               headaches: { type: integer }
 *               socialPressure: { type: integer }
 *               anxiety: { type: integer }
 *               gpa: { type: number, nullable: true }
 *     responses:
 *       201:
 *         description: Creado
 */
const router = require('express').Router();
const prisma = require('../services/data');
const crypto = require('crypto');

function computeRiskScore(s){
  const w = { studyIntensity: 0.22, sleepProblems: 0.22, headaches: 0.16, socialPressure: 0.18, anxiety: 0.22 };
  const score0to10 = (
    (s.studyIntensity||0)*w.studyIntensity +
    (s.sleepProblems||0)*w.sleepProblems +
    (s.headaches||0)*w.headaches +
    (s.socialPressure||0)*w.socialPressure +
    (s.anxiety||0)*w.anxiety
  );
  return Math.round(score0to10*10); // 0..100
}
function segmentRisk(score){
  if (score >= 70) return 'alto';
  if (score >= 40) return 'moderado';
  return 'bajo';
}
function makeFingerprint(r){
  const canonical = {
    name: (r.name||'').trim().toLowerCase(),
    age: r.age ?? null,
    gender: (r.gender||'').trim().toLowerCase(),
    year: r.year ?? null,
    studyIntensity: Number(r.studyIntensity||0),
    sleepProblems: Number(r.sleepProblems||0),
    headaches: Number(r.headaches||0),
    socialPressure: Number(r.socialPressure||0),
    anxiety: Number(r.anxiety||0),
    gpa: (r.gpa===null||r.gpa===undefined)?null:Number(r.gpa)
  };
  const json = JSON.stringify(canonical);
  return require('crypto').createHash('sha256').update(json).digest('hex');
}

router.get('/', async (_req, res) => {
  try{
    const rows = await prisma.student.findMany({ orderBy: { id: 'asc' } });
    const out = rows.map(s => ({
      ...s,
      riskScore: computeRiskScore(s),
      riskSegment: segmentRisk(computeRiskScore(s))
    }));
    res.json(out);
  }catch(e){
    if (e.code === 'P2021') return res.status(500).json({ error: 'Base de datos no inicializada. Ejecuta: npx prisma migrate dev --name init' });
    console.error(e); res.status(500).json({ error: 'Error al listar estudiantes' });
  }
});

router.post('/', async (req, res) => {
  try{
    const data = req.body;
    const fingerprint = makeFingerprint(data);
    const created = await prisma.student.upsert({
      where: { fingerprint },
      update: {}, // si ya existe, no cambia
      create: { ...data, fingerprint }
    });
    const riskScore = computeRiskScore(created);
    res.status(201).json({ ...created, riskScore, riskSegment: segmentRisk(riskScore) });
  }catch(e){
    console.error(e);
    res.status(400).json({ error: 'Datos inválidos' });
  }
});

module.exports = router;