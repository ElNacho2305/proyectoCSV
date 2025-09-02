const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API - DSS Estrés Académico',
      version: '1.0.0',
      description: 'Documentación de endpoints para datos, analítica y recomendaciones.'
    },
    servers: [{ url: 'http://localhost:3000' }]
  },
  apis: ['src/routes/*.js']
};

module.exports = swaggerJSDoc(options);