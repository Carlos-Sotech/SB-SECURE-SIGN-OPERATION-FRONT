declare namespace NodeJS {
  interface ProcessEnv {
    API_URL?: string;
    WEBSOCKET_URL?: string;
    WEBSOCKET_TIMEOUT?: string;
    FRONTEND_BASE_URL?: string;
    SOTECH_PROTOCOLO_SSS?: string;
    SOTECH_NOMBRE_SERVIDOR_SSS?: string;
    SOTECH_PUERTO_SSS?: string;
    SOTECH_APLICACION_SSS?: string;
    SOTECH_PROTOCOLO_SSLS?: string;
    SOTECH_NOMBRE_SERVIDOR_SSLS?: string;
    SOTECH_PUERTO_SSLS?: string;
    SOTECH_APLICACION_SSLS_REMOTA?: string;
    SOTECH_PROTOCOLO_OTP?: string;
    SOTECH_NOMBRE_SERVIDOR_OTP?: string;
    SOTECH_PUERTO_OTP?: string;
    SOTECH_APLICACION_OTP?: string;
  }
}