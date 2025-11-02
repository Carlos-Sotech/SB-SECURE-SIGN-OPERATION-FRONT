#!/usr/bin/env node

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4200;

// Verificar que existe el directorio dist
const distPath = path.join(process.cwd(), 'dist', 'rutas');
if (!fs.existsSync(distPath)) {
    console.error('❌ No se encontró el directorio dist/rutas');
    console.error('Ejecuta "npm run build:prod" primero');
    process.exit(1);
}

console.log('✅ Build de producción encontrado');
console.log(`📁 Sirviendo archivos desde: ${distPath}`);

// Configurar middleware para archivos estáticos
app.use(express.static(distPath, {
    maxAge: '1y',
    etag: true,
    lastModified: true
}));

// Configuración para Angular Router (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('🚀 Servidor de producción iniciado');
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log('');
    console.log('📋 Información para el proxy inverso:');
    console.log(`   - Puerto: ${PORT}`);
    console.log(`   - Ruta: /`);
    console.log(`   - Archivos estáticos: ${distPath}`);
    console.log('');
    console.log('⏹️  Para detener: Ctrl+C');
    console.log('');
    console.log('🔗 Tu aplicación está disponible en:');
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://127.0.0.1:${PORT}`);
});

// Manejar cierre graceful
process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo servidor...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Deteniendo servidor...');
    process.exit(0);
});






