/**
 * @openapi
 * /api/upload/csv:
 *   post:
 *     summary: Carga CSV (deduplicación por fingerprint). Soporta StressLevelDataset y Stress_Dataset.
 *     requestBody: { required: true, content: { multipart/form-data: { schema: { type: object, properties: { file: { type: string, format: binary } } } } } }
 *     responses: { 200: { description: Filas insertadas } }
 */
const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const prisma = require('../services/data');
const crypto = require('crypto');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10*1024*1024 } });
const toNum = v => v==null?null:Number(String(v).trim().replace(',','.'));
const ynTo10 = v => { if(v==null) return 0; const s=String(v).trim().toLowerCase(); if(['yes','sí','si'].includes(s)) return 10; if(['no','0'].includes(s)) return 0; if(['sometimes','a veces','maybe'].includes(s)) return 5; const n=toNum(v); if(n!=null){ if(n<=1) return 2; if(n>=5) return 10; return Math.round((n-1)/4*10);} return 0; };
const s05to10 = v => { const n=toNum(v); if(n==null) return 0; return Math.max(0,Math.min(10,Math.round((n/5)*10))); };
const inv05to10 = v => { const n=toNum(v); if(n==null) return 0; const inv=Math.max(0,Math.min(5,5-n)); return Math.round((inv/5)*10); };
const colsSLD = ['anxiety_level','sleep_quality','headache','peer_pressure','study_load'];
const looksSLD = cols => colsSLD.every(c=>cols.includes(c));
const looksSD  = cols => [
  'Have you been getting headaches more often than usual?',
  'Do you face any sleep problems or difficulties falling asleep?',
  'Do you feel overwhelmed with your academic workload?',
  'Are you in competition with your peers, and does it affect you?',
  'Have you been dealing with anxiety or tension recently?'
].every(k=>cols.includes(k));
const fp = rec => crypto.createHash('sha256').update(JSON.stringify({
  name:(rec.name||'').trim().toLowerCase(),
  age:rec.age??null, gender:(rec.gender||'').trim().toLowerCase(), year:rec.year??null,
  studyIntensity:+(rec.studyIntensity||0), sleepProblems:+(rec.sleepProblems||0), headaches:+(rec.headaches||0),
  socialPressure:+(rec.socialPressure||0), anxiety:+(rec.anxiety||0), gpa:(rec.gpa==null?null:+rec.gpa)
})).digest('hex');

router.post('/csv', upload.single('file'), async (req,res)=>{
  if(!req.file) return res.status(400).json({ error:'Archivo requerido' });
  const text = req.file.buffer.toString('utf-8');
  const rows = parse(text, { columns:true, skip_empty_lines:true, trim:true });
  if(!rows.length) return res.status(400).json({ error:'CSV vacío' });
  const cols = Object.keys(rows[0]);
  let mapped;
  if (looksSLD(cols)){
    mapped = rows.map((r,i)=>{
      const name = r.name?.trim() || `Estudiante_${i+1}`;
      const studyIntensity = s05to10(r.study_load);
      const sleepProblems  = inv05to10(r.sleep_quality);
      const headaches      = s05to10(r.headache);
      const socialPressure = s05to10(r.peer_pressure);
      const maxAnx = 30, anxRaw = Math.max(0, Math.min(maxAnx, toNum(r.anxiety_level) ?? 0));
      const anxiety = Math.round((anxRaw / maxAnx) * 10);
      return { name, age:null, gender:null, year:null, studyIntensity, sleepProblems, headaches, socialPressure, anxiety, gpa:null };
    });
  }else if (looksSD(cols)){
    mapped = rows.map((r,i)=>{
      const name = r.name?.trim() || `Estudiante_${i+1}`;
      const headachesQ = r['Have you been getting headaches more often than usual?'];
      const sleepQ     = r['Do you face any sleep problems or difficulties falling asleep?'];
      const workloadQ  = r['Do you feel overwhelmed with your academic workload?'];
      const competeQ   = r['Are you in competition with your peers, and does it affect you?'];
      const anxietyQ   = r['Have you been dealing with anxiety or tension recently?'];
      const studyIntensity = ynTo10(workloadQ);
      const sleepProblems  = ynTo10(sleepQ);
      const headaches      = ynTo10(headachesQ);
      let socialPressure   = ynTo10(competeQ);
      const ppCol = Object.keys(r).find(k => k.toLowerCase().includes('peer') || k.toLowerCase().includes('pressure'));
      if (ppCol) socialPressure = Math.round((socialPressure + ynTo10(r[ppCol]))/2);
      const anxiety = ynTo10(anxietyQ);
      return { name, age:toNum(r.Age)??null, gender:r.Gender||null, year:null, studyIntensity, sleepProblems, headaches, socialPressure, anxiety, gpa:null };
    });
  }else{
    return res.status(400).json({ error:'Estructura no reconocida. Usa StressLevelDataset.csv o Stress_Dataset.csv' });
  }

  const withFP = mapped.map(r => ({ ...r, fingerprint: fp(r) }));
  await prisma.$transaction(withFP.map(r => prisma.student.upsert({ where:{ fingerprint:r.fingerprint }, update:{}, create:r })));
  res.json({ inserted: withFP.length });
});
module.exports = router;