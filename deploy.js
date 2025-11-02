#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colores para output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'green') {
    console.log(`${colors[color]}[INFO]${colors.reset} ${message}`);
}

function logWarning(message) {
    console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

function logError(message) {
    console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

function logHeader(message) {
    console.log(`${colors.blue}================================${colors.reset}`);
    console.log(`${colors.blue}${message}${colors.reset}`);
    console.log(`${colors.blue}================================${colors.reset}`);
}

function execCommand(command, options = {}) {
    try {
        return execSync(command, { 
            stdio: 'inherit', 
            encoding: 'utf8',
            ...options 
        });
    } catch (error) {
        logError(`Error ejecutando: ${command}`);
        throw error;
    }
}

function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function deploy() {
    const args = process.argv.slice(2);
    const serverType = args[0] || 'nginx';

    logHeader('Despliegue de Angular App con NPX');

    // Verificar que existe el directorio dist
    const distPath = path.join(process.cwd(), 'dist', 'rutas');
    if (!fs.existsSync(distPath)) {
        logError('No se encontró el directorio dist/rutas');
        logError('Ejecuta "npm run build:prod" primero');
        process.exit(1);
    }

    log('✅ Build de producción encontrado');

    // Obtener información del servidor
    const server = await prompt('IP del servidor Ubuntu: ');
    const user = await prompt('Usuario del servidor: ');
    const destPath = await prompt('Ruta destino (default: /var/www/html): ') || '/var/www/html';

    logHeader('Iniciando Despliegue');

    // Verificar conectividad
    log('Verificando conexión con el servidor...');
    try {
        execCommand(`ping -c 1 ${server}`);
        log('✅ Conexión exitosa');
    } catch (error) {
        logError('❌ No se puede conectar al servidor');
        process.exit(1);
    }

    // Crear backup
    log('Creando backup del directorio actual...');
    const backupDir = `/backup/app-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`;
    try {
        execCommand(`ssh ${user}@${server} "sudo mkdir -p ${backupDir} && sudo cp -r ${destPath}/* ${backupDir}/ 2>/dev/null || true"`);
        log(`✅ Backup creado en: ${backupDir}`);
    } catch (error) {
        logWarning('⚠️ No se pudo crear backup (puede ser la primera vez)');
    }

    // Transferir archivos
    log('Transferiendo archivos al servidor...');
    try {
        execCommand(`rsync -avz --delete dist/rutas/ ${user}@${server}:${destPath}/`);
        log('✅ Archivos transferidos exitosamente');
    } catch (error) {
        logError('❌ Error transfiriendo archivos');
        process.exit(1);
    }

    // Configurar permisos
    log('Configurando permisos...');
    try {
        execCommand(`ssh ${user}@${server} "sudo chown -R www-data:www-data ${destPath} && sudo chmod -R 755 ${destPath}"`);
        log('✅ Permisos configurados');
    } catch (error) {
        logError('❌ Error configurando permisos');
    }

    // Configurar servidor web
    log(`Configurando ${serverType}...`);
    try {
        if (serverType === 'nginx') {
            await configureNginx(user, server, destPath);
        } else if (serverType === 'apache') {
            await configureApache(user, server, destPath);
        }
    } catch (error) {
        logError(`❌ Error configurando ${serverType}`);
    }

    // Verificar el despliegue
    log('Verificando el despliegue...');
    try {
        const response = execCommand(`ssh ${user}@${server} "curl -s -o /dev/null -w '%{http_code}' http://localhost"`, { stdio: 'pipe' });
        if (response.trim() === '200') {
            log('✅ Despliegue exitoso! La aplicación está funcionando.');
        } else {
            logWarning('⚠️ El servidor web responde, pero verifica manualmente la aplicación');
        }
    } catch (error) {
        logWarning('⚠️ No se pudo verificar el estado del servidor web');
    }

    logHeader('Despliegue Completado');

    console.log(`${colors.green}Resumen del despliegue:${colors.reset}`);
    console.log(`  Servidor: ${server}`);
    console.log(`  Usuario: ${user}`);
    console.log(`  Ruta destino: ${destPath}`);
    console.log(`  Backup: ${backupDir}`);
    console.log(`  Servidor web: ${serverType}`);
    console.log('');
    console.log(`${colors.blue}Para verificar la aplicación:${colors.reset}`);
    console.log(`  http://${server}`);
    console.log('');
    console.log(`${colors.blue}Comandos útiles:${colors.reset}`);
    if (serverType === 'nginx') {
        console.log(`  Ver logs: ssh ${user}@${server} 'sudo tail -f /var/log/nginx/access.log'`);
        console.log(`  Verificar estado: ssh ${user}@${server} 'sudo systemctl status nginx'`);
    } else {
        console.log(`  Ver logs: ssh ${user}@${server} 'sudo tail -f /var/log/apache2/access.log'`);
        console.log(`  Verificar estado: ssh ${user}@${server} 'sudo systemctl status apache2'`);
    }
    console.log(`  Restaurar backup: ssh ${user}@${server} 'sudo cp -r ${backupDir}/* ${destPath}/'`);
}

async function configureNginx(user, server, destPath) {
    log('Instalando y configurando Nginx...');
    
    // Instalar Nginx
    execCommand(`ssh ${user}@${server} "sudo apt update && sudo apt install nginx -y"`);
    
    // Crear configuración
    const nginxConfig = `server {
    listen 80;
    server_name _;
    root ${destPath};
    index index.html;

    # Configuración para Angular Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Configuración para archivos estáticos
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Configuración de seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Configuración de compresión
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;
}`;

    // Crear archivo de configuración temporal
    const tempConfig = path.join(process.cwd(), 'nginx-config.tmp');
    fs.writeFileSync(tempConfig, nginxConfig);
    
    // Transferir y configurar
    execCommand(`scp ${tempConfig} ${user}@${server}:/tmp/nginx-config.tmp`);
    execCommand(`ssh ${user}@${server} "sudo mv /tmp/nginx-config.tmp /etc/nginx/sites-available/rutas-app"`);
    execCommand(`ssh ${user}@${server} "sudo ln -sf /etc/nginx/sites-available/rutas-app /etc/nginx/sites-enabled/"`);
    execCommand(`ssh ${user}@${server} "sudo rm -f /etc/nginx/sites-enabled/default"`);
    execCommand(`ssh ${user}@${server} "sudo nginx -t"`);
    execCommand(`ssh ${user}@${server} "sudo systemctl enable nginx && sudo systemctl reload nginx"`);
    
    // Limpiar archivo temporal
    fs.unlinkSync(tempConfig);
    
    log('✅ Nginx configurado exitosamente');
}

async function configureApache(user, server, destPath) {
    log('Instalando y configurando Apache...');
    
    // Instalar Apache
    execCommand(`ssh ${user}@${server} "sudo apt update && sudo apt install apache2 -y"`);
    
    // Habilitar módulos
    execCommand(`ssh ${user}@${server} "sudo a2enmod rewrite headers expires deflate"`);
    
    // Crear configuración
    const apacheConfig = `<VirtualHost *:80>
    ServerName _
    DocumentRoot ${destPath}
    
    # Configuración para Angular Router (SPA)
    <Directory ${destPath}>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        
        # Rewrite rules para Angular Router
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # Configuración de caché para archivos estáticos
    <FilesMatch "\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
        Header set Cache-Control "public, immutable"
    </FilesMatch>
    
    # Configuración de compresión
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/plain
        AddOutputFilterByType DEFLATE text/html
        AddOutputFilterByType DEFLATE text/xml
        AddOutputFilterByType DEFLATE text/css
        AddOutputFilterByType DEFLATE application/xml
        AddOutputFilterByType DEFLATE application/xhtml+xml
        AddOutputFilterByType DEFLATE application/rss+xml
        AddOutputFilterByType DEFLATE application/javascript
        AddOutputFilterByType DEFLATE application/x-javascript
    </IfModule>
    
    # Headers de seguridad
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "no-referrer-when-downgrade"
</VirtualHost>`;

    // Crear archivo de configuración temporal
    const tempConfig = path.join(process.cwd(), 'apache-config.tmp');
    fs.writeFileSync(tempConfig, apacheConfig);
    
    // Transferir y configurar
    execCommand(`scp ${tempConfig} ${user}@${server}:/tmp/apache-config.tmp`);
    execCommand(`ssh ${user}@${server} "sudo mv /tmp/apache-config.tmp /etc/apache2/sites-available/rutas-app.conf"`);
    execCommand(`ssh ${user}@${server} "sudo a2ensite rutas-app.conf"`);
    execCommand(`ssh ${user}@${server} "sudo a2dissite 000-default.conf"`);
    execCommand(`ssh ${user}@${server} "sudo apache2ctl configtest"`);
    execCommand(`ssh ${user}@${server} "sudo systemctl enable apache2 && sudo systemctl reload apache2"`);
    
    // Limpiar archivo temporal
    fs.unlinkSync(tempConfig);
    
    log('✅ Apache configurado exitosamente');
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    logError('Error inesperado: ' + error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logError('Promesa rechazada: ' + reason);
    process.exit(1);
});

// Ejecutar el despliegue
deploy().catch((error) => {
    logError('Error durante el despliegue: ' + error.message);
    process.exit(1);
});






