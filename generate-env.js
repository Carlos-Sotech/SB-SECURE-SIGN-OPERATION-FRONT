const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Leer variables de entorno
const env = {
  API_URL: process.env.API_URL || '',
  WEBSOCKET_URL: process.env.WEBSOCKET_URL || '',
  WEBSOCKET_TIMEOUT: process.env.WEBSOCKET_TIMEOUT || '',
  FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || '',
  SOTECH_PROTOCOLO_SSS: process.env.SOTECH_PROTOCOLO_SSS || '',
  SOTECH_NOMBRE_SERVIDOR_SSS: process.env.SOTECH_NOMBRE_SERVIDOR_SSS || '',
  SOTECH_PUERTO_SSS: process.env.SOTECH_PUERTO_SSS || '',
  SOTECH_APLICACION_SSS: process.env.SOTECH_APLICACION_SSS || '',
  SOTECH_PROTOCOLO_SSLS: process.env.SOTECH_PROTOCOLO_SSLS || '',
  SOTECH_NOMBRE_SERVIDOR_SSLS: process.env.SOTECH_NOMBRE_SERVIDOR_SSLS || '',
  SOTECH_PUERTO_SSLS: process.env.SOTECH_PUERTO_SSLS || '',
  SOTECH_APLICACION_SSLS: process.env.SOTECH_APLICACION_SSLS || '',
  SOTECH_APLICACION_SSLS_REMOTA: process.env.SOTECH_APLICACION_SSLS_REMOTA || '',
  SOTECH_PROTOCOLO_OTP: process.env.SOTECH_PROTOCOLO_OTP || '',
  SOTECH_NOMBRE_SERVIDOR_OTP: process.env.SOTECH_NOMBRE_SERVIDOR_OTP || '',
  SOTECH_PUERTO_OTP: process.env.SOTECH_PUERTO_OTP || '',
  SOTECH_APLICACION_OTP: process.env.SOTECH_APLICACION_OTP || '',
  SOTECH_REMOTE_WEB_APP_URL: process.env.SOTECH_REMOTE_WEB_APP_URL || '',
  SOTECH_REMOTE_WEB_APP_PROTOCOL: process.env.SOTECH_REMOTE_WEB_APP_PROTOCOL || '',
  PRODUCTION: process.env.PRODUCTION || ''
};

// Generar el contenido del archivo env.js
const content = `// Auto-generated from .env file - DO NOT EDIT MANUALLY
window.env = ${JSON.stringify(env, null, 2)};
`;

// Crear directorio assets si no existe
const assetsDir = path.join(__dirname, 'src', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Escribir el archivo en src/assets/
const outputPath = path.join(assetsDir, 'env.js');
fs.writeFileSync(outputPath, content, 'utf8');

console.log('✓ Environment variables loaded from .env');
