const swaggerJSDoc = require('swagger-jsdoc');
module.exports = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'API - DSS Estrés Académico', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }]
  },
  apis: ['src/routes/*.js']
});