require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const prisma = require('./services/data');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/health', require('./routes/health'));
app.use('/api/students', require('./routes/students'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/upload', require('./routes/upload'));

app.get('/', (_req,res)=> res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const server = app.listen(PORT, ()=>{
  console.log(`Servidor http://localhost:${PORT}`);
  console.log(`Swagger   http://localhost:${PORT}/api/docs`);
});

process.on('SIGINT', async ()=>{ await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async ()=>{ await prisma.$disconnect(); process.exit(0); });