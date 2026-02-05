// Declarar window.env para TypeScript
declare const window: any;

// Función para normalizar API_URL
function normalizeApiUrl(apiUrl: string | undefined): string {
  if (!apiUrl) return '/api';
  
  // Si ya es una URL completa (http:// o https://), usarla directamente
  if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
    return apiUrl;
  }
  
  // Si empieza con una IP (con o sin puerto y /api), agregar http://
  // Ejemplos: 192.168.1.58, 192.168.1.58:8080, 192.168.1.58:8080/api, 192.168.1.58/api
  const ipPattern = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(:[0-9]+)?(\/.*)?$/;
  if (ipPattern.test(apiUrl)) {
    return `http://${apiUrl}`;
  }
  
  // Si tiene formato SERVICIO/RUTA o SERVICIO:PUERTO/RUTA (sin http://), extraer solo la ruta
  // Ejemplos: sotech-backend/api -> /api, sotech-backend:8080/api -> /api
  // El proxy nginx manejará el servicio y puerto (por defecto 8080)
  const servicePattern = /^[^/]+(\/.*)?$/;
  if (servicePattern.test(apiUrl) && !apiUrl.startsWith('/')) {
    // Extraer la parte de la ruta (después del servicio y puerto opcional)
    const match = apiUrl.match(/^[^:]+(?::[0-9]+)?(\/.*)?$/);
    if (match && match[1]) {
      return match[1]; // Devuelve /api o la ruta que haya
    }
    return '/api'; // Si no hay ruta, devolver /api por defecto
  }
  
  // Si es una ruta relativa simple, usarla tal cual
  return apiUrl;
}

export const environment = {
  production: (window?.env?.PRODUCTION === 'true') || true,
  apiUrl: normalizeApiUrl(window?.env?.API_URL),
  
  // WebSocket Configuration
  websocket: {
    url: window?.env?.WEBSOCKET_URL || 'wss://127.0.0.1:8000/',
    timeout: parseInt(window?.env?.WEBSOCKET_TIMEOUT || '3000')
  },
  
  // Sotech URI Configuration - Production settings matching backend
  sotech: {
  protocolo_sss: window?.env?.SOTECH_PROTOCOLO_SSS || 'http',
  nombre_servidor_sss: window?.env?.SOTECH_NOMBRE_SERVIDOR_SSS || 'localhost',
  puerto_sss: window?.env?.SOTECH_PUERTO_SSS || '',
  aplicacion_sss: window?.env?.SOTECH_APLICACION_SSS || '',
  protocolo_ssls: window?.env?.SOTECH_PROTOCOLO_SSLS || 'http',
  nombre_servidor_ssls: window?.env?.SOTECH_NOMBRE_SERVIDOR_SSLS || 'localhost',
  puerto_ssls: window?.env?.SOTECH_PUERTO_SSLS || '',
  aplicacion_ssls_remota: window?.env?.SOTECH_APLICACION_SSLS_REMOTA || 'sslsapi',
  protocolo_otp: window?.env?.SOTECH_PROTOCOLO_OTP || 'http',
  nombre_servidor_otp: window?.env?.SOTECH_NOMBRE_SERVIDOR_OTP || 'localhost',
  puerto_otp: window?.env?.SOTECH_PUERTO_OTP || '',
  aplicacion_otp: window?.env?.SOTECH_APLICACION_OTP || ''
},
  
  // Frontend Configuration
  frontend: {
    baseUrl: window?.env?.FRONTEND_BASE_URL || 'https://app-iadesarrollos.com'
  }
};