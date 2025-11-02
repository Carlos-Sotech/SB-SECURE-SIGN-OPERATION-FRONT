// Declarar window.env para TypeScript
declare const window: any;

export const environment = {
  production: false,
  apiUrl: window?.env?.API_URL || 'http://localhost:5073/api',
  
  // WebSocket Configuration
  websocket: {
    url: window?.env?.WEBSOCKET_URL || 'ws://localhost:8000/',
    timeout: parseInt(window?.env?.WEBSOCKET_TIMEOUT || '3000')
  },
  
  // Sotech URI Configuration - Development settings
  sotech: {
    protocolo_sss: window?.env?.SOTECH_PROTOCOLO_SSS || 'http',
    nombre_servidor_sss: window?.env?.SOTECH_NOMBRE_SERVIDOR_SSS || 'localhost',
    puerto_sss: window?.env?.SOTECH_PUERTO_SSS || '',
    aplicacion_sss: window?.env?.SOTECH_APLICACION_SSS || '',
    protocolo_ssls: window?.env?.SOTECH_PROTOCOLO_SSLS || 'http',
    nombre_servidor_ssls: window?.env?.SOTECH_NOMBRE_SERVIDOR_SSLS || 'localhost',
    puerto_ssls: window?.env?.SOTECH_PUERTO_SSLS || '',
    aplicacion_ssls: window?.env?.SOTECH_APLICACION_SSLS || '',
    aplicacion_ssls_remota: window?.env?.SOTECH_APLICACION_SSLS_REMOTA || 'sslsapi',
    protocolo_otp: window?.env?.SOTECH_PROTOCOLO_OTP || 'http',
    nombre_servidor_otp: window?.env?.SOTECH_NOMBRE_SERVIDOR_OTP || 'localhost',
    puerto_otp: window?.env?.SOTECH_PUERTO_OTP || '',
    aplicacion_otp: window?.env?.SOTECH_APLICACION_OTP || '',
    remote_web_app_url: window?.env?.SOTECH_REMOTE_WEB_APP_URL || 'localhost',
    remote_web_app_protocol: window?.env?.SOTECH_REMOTE_WEB_APP_PROTOCOL || 'http'
  },
  
  // Frontend Configuration
  frontend: {
    baseUrl: window?.env?.FRONTEND_BASE_URL || 'http://localhost:4200'
  }
};