/**
 * @openapi
 * /api/recommendations/{id}:
 *   get:
 *     summary: Recomendaciones por estudiante
 *     parameters: [ { in: path, name: id, schema: { type: integer }, required: true } ]
 *     responses: { 200: { description: OK }, 404: { description: No encontrado } }
 */
const router = require('express').Router();
const prisma = require('../services/data');
const w = { studyIntensity: .22, sleepProblems: .22, headaches: .16, socialPressure: .18, anxiety: .22 };
const compute = s => Math.round(((s.studyIntensity||0)*w.studyIntensity + (s.sleepProblems||0)*w.sleepProblems + (s.headaches||0)*w.headaches + (s.socialPressure||0)*w.socialPressure + (s.anxiety||0)*w.anxiety)*10);
const seg = v => v>=70?'alto':v>=40?'moderado':'bajo';

router.get('/:id', async (req,res)=>{
  const id = Number(req.params.id);
  const s = await prisma.student.findUnique({ where:{ id } });
  if (!s) return res.status(404).json({ error:'No encontrado' });
  const riskScore = compute(s), riskSegment = seg(riskScore);
  const recs = [];
  if (s.anxiety >= 7) recs.push('Técnicas de respiración/mindfulness (10 min diarios).');
  if (s.sleepProblems >= 6) recs.push('Rutina de higiene del sueño (horarios regulares, evitar pantallas).');
  if (s.studyIntensity >= 7) recs.push('Planificación semanal con descansos y técnica Pomodoro.');
  if (s.socialPressure >= 6) recs.push('Taller de límites personales y asertividad.');
  if (s.headaches >= 6) recs.push('Pausas activas y revisión de ergonomía del estudio.');
  if (recs.length===0) recs.push('Mantener hábitos actuales y seguimiento mensual.');
  res.json({ student:s, riskScore, riskSegment, recommendations:recs });
});
module.exports = router;