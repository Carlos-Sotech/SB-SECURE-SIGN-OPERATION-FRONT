#!/bin/sh

# Función para reemplazar variables de entorno en archivos JS
replace_env_vars() {
    local file="$1"
    
    # Reemplazar API_URL
    if [ -n "$API_URL" ]; then
        sed -i "s|{{API_URL}}|$API_URL|g" "$file"
        echo "✓ Replaced API_URL with: $API_URL"
    fi
    
    # Reemplazar WEBSOCKET_URL
    if [ -n "$WEBSOCKET_URL" ]; then
        sed -i "s|{{WEBSOCKET_URL}}|$WEBSOCKET_URL|g" "$file"
        echo "✓ Replaced WEBSOCKET_URL with: $WEBSOCKET_URL"
    fi
    
    # Reemplazar WEBSOCKET_TIMEOUT
    if [ -n "$WEBSOCKET_TIMEOUT" ]; then
        sed -i "s|{{WEBSOCKET_TIMEOUT}}|$WEBSOCKET_TIMEOUT|g" "$file"
        echo "✓ Replaced WEBSOCKET_TIMEOUT with: $WEBSOCKET_TIMEOUT"
    fi
    
    # Reemplazar variables SOTECH SSS
    if [ -n "$SOTECH_PROTOCOLO_SSS" ]; then
        sed -i "s|{{SOTECH_PROTOCOLO_SSS}}|$SOTECH_PROTOCOLO_SSS|g" "$file"
        echo "✓ Replaced SOTECH_PROTOCOLO_SSS with: $SOTECH_PROTOCOLO_SSS"
    fi
    
    if [ -n "$SOTECH_NOMBRE_SERVIDOR_SSS" ]; then
        sed -i "s|{{SOTECH_NOMBRE_SERVIDOR_SSS}}|$SOTECH_NOMBRE_SERVIDOR_SSS|g" "$file"
        echo "✓ Replaced SOTECH_NOMBRE_SERVIDOR_SSS with: $SOTECH_NOMBRE_SERVIDOR_SSS"
    fi
    
    if [ -n "$SOTECH_PUERTO_SSS" ]; then
        sed -i "s|{{SOTECH_PUERTO_SSS}}|$SOTECH_PUERTO_SSS|g" "$file"
        echo "✓ Replaced SOTECH_PUERTO_SSS with: $SOTECH_PUERTO_SSS"
    fi
    
    if [ -n "$SOTECH_APLICACION_SSS" ]; then
        sed -i "s|{{SOTECH_APLICACION_SSS}}|$SOTECH_APLICACION_SSS|g" "$file"
        echo "✓ Replaced SOTECH_APLICACION_SSS with: $SOTECH_APLICACION_SSS"
    fi
    
    # Reemplazar variables SOTECH SSLS
    if [ -n "$SOTECH_PROTOCOLO_SSLS" ]; then
        sed -i "s|{{SOTECH_PROTOCOLO_SSLS}}|$SOTECH_PROTOCOLO_SSLS|g" "$file"
        echo "✓ Replaced SOTECH_PROTOCOLO_SSLS with: $SOTECH_PROTOCOLO_SSLS"
    fi
    
    if [ -n "$SOTECH_NOMBRE_SERVIDOR_SSLS" ]; then
        sed -i "s|{{SOTECH_NOMBRE_SERVIDOR_SSLS}}|$SOTECH_NOMBRE_SERVIDOR_SSLS|g" "$file"
        echo "✓ Replaced SOTECH_NOMBRE_SERVIDOR_SSLS with: $SOTECH_NOMBRE_SERVIDOR_SSLS"
    fi
    
    if [ -n "$SOTECH_PUERTO_SSLS" ]; then
        sed -i "s|{{SOTECH_PUERTO_SSLS}}|$SOTECH_PUERTO_SSLS|g" "$file"
        echo "✓ Replaced SOTECH_PUERTO_SSLS with: $SOTECH_PUERTO_SSLS"
    fi
    
    if [ -n "$SOTECH_APLICACION_SSLS_REMOTA" ]; then
        sed -i "s|{{SOTECH_APLICACION_SSLS_REMOTA}}|$SOTECH_APLICACION_SSLS_REMOTA|g" "$file"
        echo "✓ Replaced SOTECH_APLICACION_SSLS_REMOTA with: $SOTECH_APLICACION_SSLS_REMOTA"
    fi
    
    # Reemplazar variables SOTECH OTP
    if [ -n "$SOTECH_PROTOCOLO_OTP" ]; then
        sed -i "s|{{SOTECH_PROTOCOLO_OTP}}|$SOTECH_PROTOCOLO_OTP|g" "$file"
        echo "✓ Replaced SOTECH_PROTOCOLO_OTP with: $SOTECH_PROTOCOLO_OTP"
    fi
    
    if [ -n "$SOTECH_NOMBRE_SERVIDOR_OTP" ]; then
        sed -i "s|{{SOTECH_NOMBRE_SERVIDOR_OTP}}|$SOTECH_NOMBRE_SERVIDOR_OTP|g" "$file"
        echo "✓ Replaced SOTECH_NOMBRE_SERVIDOR_OTP with: $SOTECH_NOMBRE_SERVIDOR_OTP"
    fi
    
    if [ -n "$SOTECH_PUERTO_OTP" ]; then
        sed -i "s|{{SOTECH_PUERTO_OTP}}|$SOTECH_PUERTO_OTP|g" "$file"
        echo "✓ Replaced SOTECH_PUERTO_OTP with: $SOTECH_PUERTO_OTP"
    fi
    
    if [ -n "$SOTECH_APLICACION_OTP" ]; then
        sed -i "s|{{SOTECH_APLICACION_OTP}}|$SOTECH_APLICACION_OTP|g" "$file"
        echo "✓ Replaced SOTECH_APLICACION_OTP with: $SOTECH_APLICACION_OTP"
    fi
    
    # Reemplazar FRONTEND_BASE_URL
    if [ -n "$FRONTEND_BASE_URL" ]; then
        sed -i "s|{{FRONTEND_BASE_URL}}|$FRONTEND_BASE_URL|g" "$file"
        echo "✓ Replaced FRONTEND_BASE_URL with: $FRONTEND_BASE_URL"
    fi
    
    # Reemplazar SOTECH_REMOTE_WEB_APP_URL
    if [ -n "$SOTECH_REMOTE_WEB_APP_URL" ]; then
        sed -i "s|{{SOTECH_REMOTE_WEB_APP_URL}}|$SOTECH_REMOTE_WEB_APP_URL|g" "$file"
        echo "✓ Replaced SOTECH_REMOTE_WEB_APP_URL with: $SOTECH_REMOTE_WEB_APP_URL"
    fi
    
    # Reemplazar SOTECH_REMOTE_WEB_APP_PROTOCOL
    if [ -n "$SOTECH_REMOTE_WEB_APP_PROTOCOL" ]; then
        sed -i "s|{{SOTECH_REMOTE_WEB_APP_PROTOCOL}}|$SOTECH_REMOTE_WEB_APP_PROTOCOL|g" "$file"
        echo "✓ Replaced SOTECH_REMOTE_WEB_APP_PROTOCOL with: $SOTECH_REMOTE_WEB_APP_PROTOCOL"
    fi
    
    # Reemplazar PRODUCTION
    if [ -n "$PRODUCTION" ]; then
        sed -i "s|{{PRODUCTION}}|$PRODUCTION|g" "$file"
        echo "✓ Replaced PRODUCTION with: $PRODUCTION"
    fi
}

# Mostrar variables de entorno
echo "🔧 Environment variables:"
echo "API_URL: $API_URL"
echo "WEBSOCKET_URL: $WEBSOCKET_URL"
echo "WEBSOCKET_TIMEOUT: $WEBSOCKET_TIMEOUT"
echo "SOTECH_PROTOCOLO_SSS: $SOTECH_PROTOCOLO_SSS"
echo "SOTECH_NOMBRE_SERVIDOR_SSS: $SOTECH_NOMBRE_SERVIDOR_SSS"
echo "SOTECH_PUERTO_SSS: $SOTECH_PUERTO_SSS"
echo "SOTECH_APLICACION_SSS: $SOTECH_APLICACION_SSS"
echo "SOTECH_PROTOCOLO_SSLS: $SOTECH_PROTOCOLO_SSLS"
echo "SOTECH_NOMBRE_SERVIDOR_SSLS: $SOTECH_NOMBRE_SERVIDOR_SSLS"
echo "SOTECH_PUERTO_SSLS: $SOTECH_PUERTO_SSLS"
echo "SOTECH_APLICACION_SSLS_REMOTA: $SOTECH_APLICACION_SSLS_REMOTA"
echo "SOTECH_PROTOCOLO_OTP: $SOTECH_PROTOCOLO_OTP"
echo "SOTECH_NOMBRE_SERVIDOR_OTP: $SOTECH_NOMBRE_SERVIDOR_OTP"
echo "SOTECH_PUERTO_OTP: $SOTECH_PUERTO_OTP"
echo "SOTECH_APLICACION_OTP: $SOTECH_APLICACION_OTP"
echo "FRONTEND_BASE_URL: $FRONTEND_BASE_URL"

# Detectar si API_URL es externa (contiene http:// o https://)
USE_PROXY=true
BACKEND_SERVICE_NAME=""
BACKEND_PORT="8080"

if [ -n "$API_URL" ]; then
    # Verificar si API_URL es una URL externa (http:// o https://)
    if echo "$API_URL" | grep -qE "^https?://"; then
        echo "🌐 API_URL es una URL externa (http/https): $API_URL - NO se usará proxy nginx"
        USE_PROXY=false
        # Si es externa, extraer el puerto de la URL para referencia
        if echo "$API_URL" | grep -qE "https?://[^:]+:([0-9]+)"; then
            BACKEND_PORT=$(echo "$API_URL" | sed -nE 's|https?://[^:]+:([0-9]+).*|\1|p')
            echo "🔍 Puerto extraído de URL externa: $BACKEND_PORT (solo para referencia, no se usa en proxy)"
        fi
    # Verificar si API_URL empieza con una IP (con o sin puerto y /api)
    # Ejemplos: 192.168.1.58, 192.168.1.58:8080, 192.168.1.58:8080/api, 192.168.1.58/api
    elif echo "$API_URL" | grep -qE "^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}"; then
        echo "🌐 API_URL contiene una IP: $API_URL - NO se usará proxy nginx"
        USE_PROXY=false
        # Extraer puerto si existe
        if echo "$API_URL" | grep -qE "^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:([0-9]+)"; then
            BACKEND_PORT=$(echo "$API_URL" | sed -nE 's|^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:([0-9]+).*|\1|p')
            echo "🔍 Puerto extraído de IP: $BACKEND_PORT (solo para referencia, no se usa en proxy)"
        fi
    else
        # API_URL es relativa o tiene formato SERVICE_NAME/PATH o SERVICE_NAME:PORT/PATH
        # Ejemplos: /api, sotech-backend/api, sotech-backend:8080/api (puerto opcional, por defecto 8080)
        echo "🔗 API_URL es relativa: $API_URL - Se usará proxy nginx"
        USE_PROXY=true
        
        # Puerto por defecto interno del contenedor
        BACKEND_PORT="8080"
        
        # Extraer nombre del servicio y puerto del formato SERVICE_NAME:PORT/PATH o SERVICE_NAME/PATH
        if echo "$API_URL" | grep -qE "^[^/]+"; then
            # Verificar si tiene formato SERVICIO:PUERTO/RUTA o SERVICIO/RUTA
            if echo "$API_URL" | grep -qE "^[^:]+:[0-9]+"; then
                # Formato: SERVICE_NAME:PORT/PATH (puerto específico)
                BACKEND_SERVICE_NAME=$(echo "$API_URL" | sed -nE 's|^([^:]+):.*|\1|p')
                BACKEND_PORT=$(echo "$API_URL" | sed -nE 's|^[^:]+:([0-9]+).*|\1|p')
                echo "🔧 Extraído de API_URL: servicio=$BACKEND_SERVICE_NAME, puerto=$BACKEND_PORT"
            else
                # Formato: SERVICE_NAME/PATH (sin puerto, usar 8080 por defecto)
                BACKEND_SERVICE_NAME=$(echo "$API_URL" | sed -nE 's|^([^/]+).*|\1|p')
                echo "🔧 Extraído de API_URL: servicio=$BACKEND_SERVICE_NAME, puerto=$BACKEND_PORT (por defecto)"
            fi
        else
            # Formato relativo simple: /api o similar
            # Usar BACKEND_SERVICE_NAME de variable de entorno o default
            BACKEND_SERVICE_NAME="${BACKEND_SERVICE_NAME:-sotech-backend}"
            echo "🔧 Usando valores de variables de entorno: servicio=$BACKEND_SERVICE_NAME, puerto=$BACKEND_PORT (por defecto)"
        fi
    fi
else
    echo "🔗 API_URL no definida - Se usará proxy nginx con valores por defecto"
    USE_PROXY=true
    BACKEND_SERVICE_NAME="${BACKEND_SERVICE_NAME:-sotech-backend}"
    # Si API_URL no está definida, usar BACKEND_PORT de variable de entorno o default 8080
    BACKEND_PORT="${BACKEND_PORT:-8080}"
fi

# Configurar proxy solo si es necesario
if [ "$USE_PROXY" = "true" ]; then
    echo "🔧 Configurando proxy nginx con: servicio=$BACKEND_SERVICE_NAME, puerto=$BACKEND_PORT"
    
    # Reemplazar BACKEND_SERVICE_NAME_PLACEHOLDER en nginx.conf
    sed -i "s|BACKEND_SERVICE_NAME_PLACEHOLDER|$BACKEND_SERVICE_NAME|g" /etc/nginx/conf.d/default.conf
    echo "✅ Backend service name configured: $BACKEND_SERVICE_NAME"
    
    # Reemplazar BACKEND_PORT_PLACEHOLDER con el puerto configurado
    sed -i "s|BACKEND_PORT_PLACEHOLDER|$BACKEND_PORT|g" /etc/nginx/conf.d/default.conf
    echo "✅ Backend port configured in nginx: $BACKEND_PORT"
    
    echo "🔍 Verifying replacement in nginx.conf..."
    grep -n "proxy_pass.*http://" /etc/nginx/conf.d/default.conf || echo "⚠️  Warning: Could not verify proxy_pass configuration"
else
    # Si no usamos proxy, eliminar las secciones de proxy completamente de nginx.conf
    # En lugar de comentar (que puede romper la sintaxis), las eliminamos
    echo "🚫 Deshabilitando proxy nginx (API_URL es externa)"
    
    # Crear un archivo temporal sin las secciones de proxy
    awk '
        /^    location \/api \{/ { in_api = 1; next }
        /^    location ~ \^\/media \{/ { in_media = 1; next }
        in_api && /^    \}/ { in_api = 0; next }
        in_media && /^    \}/ { in_media = 0; next }
        !in_api && !in_media { print }
    ' /etc/nginx/conf.d/default.conf > /tmp/nginx_temp.conf
    
    # Reemplazar el archivo original
    mv /tmp/nginx_temp.conf /etc/nginx/conf.d/default.conf
    echo "✅ Proxy nginx deshabilitado (secciones /api y /media eliminadas)"
fi

# Generar archivo env.js desde la plantilla
echo "🔧 Generating env.js from template..."
cp /usr/share/nginx/html/assets/envtemplate.js /usr/share/nginx/html/env.js

# Reemplazar variables en env.js
if [ -f "/usr/share/nginx/html/env.js" ]; then
    echo "🔧 Replacing environment variables in env.js..."
    replace_env_vars "/usr/share/nginx/html/env.js"
fi

# Reemplazar variables en main.*.js (archivos con hash de Angular)
for main_file in /usr/share/nginx/html/main*.js; do
    if [ -f "$main_file" ]; then
        echo "🔧 Replacing environment variables in $(basename $main_file)..."
        replace_env_vars "$main_file"
    fi
done

# Reemplazar variables en main.*.js.map si existen
for main_map_file in /usr/share/nginx/html/main*.js.map; do
    if [ -f "$main_map_file" ]; then
        echo "🔧 Replacing environment variables in $(basename $main_map_file)..."
        replace_env_vars "$main_map_file"
    fi
done

echo "✅ Environment variables replacement completed"

# Iniciar nginx
exec nginx -g "daemon off;"
