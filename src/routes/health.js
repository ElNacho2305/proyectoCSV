/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Estado del servicio
 *     responses:
 *       200:
 *         description: OK
 */
const router = require('express').Router();
router.get('/', (_req, res)=> res.json({ status: 'ok' }));
module.exports = router;