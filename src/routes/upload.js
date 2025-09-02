/**
 * @openapi
 * /api/upload/csv:
 *   post:
 *     summary: Carga masiva desde CSV (acepta Stress_Dataset.csv y StressLevelDataset.csv)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Filas insertadas
 */
const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const prisma = require('../services/data');
const crypto = require('crypto');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const toNum = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const ynTo10 = (v) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().toLowerCase();
  if (['yes','sí','si'].includes(s)) return 10;
  if (['no','0'].includes(s)) return 0;
  if (['sometimes','a veces','maybe'].includes(s)) return 5;
  const n = toNum(v);
  if (n !== null) {
    if (n <= 1) return 2;
    if (n >= 5) return 10;
    return Math.round((n - 1) / (5 - 1) * 10);
  }
  return 0;
};
const scale0to5_to0to10 = (v) => {
  const n = toNum(v); if (n === null) return 0;
  if (n < 0) return 0; if (n > 5) return 10;
  return Math.round((n/5)*10);
};
const invert0to5_to0to10 = (v) => {
  const n = toNum(v); if (n === null) return 0;
  const clamped = Math.max(0, Math.min(5, n));
  const inv = 5 - clamped;
  return Math.round((inv/5)*10);
};
const clamp0to10 = (x) => Math.max(0, Math.min(10, Math.round(x)));

const looksLikeStressLevelDataset = (cols) => {
  const must = ['anxiety_level','sleep_quality','headache','peer_pressure','study_load'];
  return must.every(c => cols.includes(c));
};
const looksLikeStressDataset = (cols) => {
  const keys = [
    'Have you been getting headaches more often than usual?',
    'Do you face any sleep problems or difficulties falling asleep?',
    'Do you feel overwhelmed with your academic workload?',
    'Are you in competition with your peers, and does it affect you?',
    'Have you been dealing with anxiety or tension recently?'
  ];
  return keys.every(k => cols.includes(k));
};

function mapRowFromStressLevelDataset(r, idx, maxAnx=30){
  const name = r.name?.trim() || `Estudiante_${idx+1}`;
  const studyIntensity = scale0to5_to0to10(r.study_load);
  const sleepProblems  = invert0to5_to0to10(r.sleep_quality);
  const headaches      = scale0to5_to0to10(r.headache);
  const socialPressure = scale0to5_to0to10(r.peer_pressure);
  const anxRaw = Math.max(0, Math.min(maxAnx, toNum(r.anxiety_level) ?? 0));
  const anxiety = clamp0to10((anxRaw / maxAnx) * 10);
  return { name, age:null, gender:null, year:null, studyIntensity, sleepProblems, headaches, socialPressure, anxiety, gpa:null };
}
function mapRowFromStressDataset(r, idx){
  const name = r.name?.trim() || `Estudiante_${idx+1}`;
  const headachesQ = r['Have you been getting headaches more often than usual?'];
  const sleepQ     = r['Do you face any sleep problems or difficulties falling asleep?'];
  const workloadQ  = r['Do you feel overwhelmed with your academic workload?'];
  const competeQ   = r['Are you in competition with your peers, and does it affect you?'];
  const anxietyQ   = r['Have you been dealing with anxiety or tension recently?'];

  const studyIntensity = ynTo10(workloadQ);
  const sleepProblems  = ynTo10(sleepQ);
  const headaches      = ynTo10(headachesQ);
  let socialPressure = ynTo10(competeQ);
  const ppCol = Object.keys(r).find(k => k.toLowerCase().includes('peer') || k.toLowerCase().includes('pressure'));
  if (ppCol) socialPressure = Math.round((socialPressure + ynTo10(r[ppCol]))/2);
  const anxiety = ynTo10(anxietyQ);

  return { name, age: toNum(r.Age) ?? null, gender: r.Gender || null, year: null, studyIntensity, sleepProblems, headaches, socialPressure, anxiety, gpa: null };
}

function makeFingerprint(rec){
  const canonical = {
    name: (rec.name||'').trim().toLowerCase(),
    age: rec.age ?? null,
    gender: (rec.gender||'').trim().toLowerCase(),
    year: rec.year ?? null,
    studyIntensity: Number(rec.studyIntensity||0),
    sleepProblems: Number(rec.sleepProblems||0),
    headaches: Number(rec.headaches||0),
    socialPressure: Number(rec.socialPressure||0),
    anxiety: Number(rec.anxiety||0),
    gpa: (rec.gpa===null||rec.gpa===undefined)?null:Number(rec.gpa)
  };
  const json = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(json).digest('hex');
}

router.post('/csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
  try{
    const text = req.file.buffer.toString('utf-8');
    const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true });
    if (!rows.length) return res.status(400).json({ error: 'CSV vacío' });
    const cols = Object.keys(rows[0]);
    let mapper;
    if (looksLikeStressLevelDataset(cols)) mapper = (r,i)=>mapRowFromStressLevelDataset(r,i);
    else if (looksLikeStressDataset(cols)) mapper = (r,i)=>mapRowFromStressDataset(r,i);
    else return res.status(400).json({ error: 'Estructura no reconocida. Usa StressLevelDataset.csv o Stress_Dataset.csv' });

    const records = rows.map((r,i)=>mapper(r,i)).map(r => ({ ...r, fingerprint: makeFingerprint(r) }));

    let createdCount = 0;
    await prisma.$transaction(
      records.map(r => prisma.student.upsert({
        where: { fingerprint: r.fingerprint },
        update: {}, // si existe, no modifica
        create: r
      }))
    ).then(()=>{ createdCount = records.length; });

    res.json({ inserted: createdCount });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Error procesando el CSV' });
  }
});

module.exports = router;