const fs = require('fs');
const path = require('path');

// Función para obtener la fecha y hora actual en formato de versión
function getVersionString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return `v${year}.${month}.${day}.${hour}${minute}`;
}

// Función para obtener un timestamp único para forzar recarga de caché
function getCacheBuster() {
  return Date.now();
}

// Función para actualizar la versión en el archivo de login
function updateLoginVersion() {
  const loginHtmlPath = path.join(__dirname, 'src', 'app', 'components', 'login', 'login.component.html');
  const indexHtmlPath = path.join(__dirname, 'src', 'index.html');
  const versionJsonPath = path.join(__dirname, 'src', 'assets', 'version.json');
  
  const version = getVersionString();
  const cacheBuster = getCacheBuster();
  
  // Actualizar version.json
  if (fs.existsSync(versionJsonPath)) {
    const versionJson = {
      version: version,
      buildDate: new Date().toISOString(),
      environment: "production"
    };
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2));
    console.log(`✅ version.json actualizado a: ${version}`);
  } else {
    console.log('⚠️  No se encontró el archivo version.json, creándolo...');
    const versionJsonDir = path.dirname(versionJsonPath);
    if (!fs.existsSync(versionJsonDir)) {
      fs.mkdirSync(versionJsonDir, { recursive: true });
    }
    const versionJson = {
      version: version,
      buildDate: new Date().toISOString(),
      environment: "production"
    };
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2));
    console.log(`✅ version.json creado con versión: ${version}`);
  }
  
  // Actualizar login.component.html
  if (fs.existsSync(loginHtmlPath)) {
    let content = fs.readFileSync(loginHtmlPath, 'utf8');
    
    // Actualizar versión del frontend
    content = content.replace(
      /Frontend: v[\d.]+/g,
      `Frontend: ${version}`
    );
    
    fs.writeFileSync(loginHtmlPath, content);
    console.log(`✅ Versión del frontend actualizada a: ${version}`);
  } else {
    console.log('❌ No se encontró el archivo login.component.html');
  }
  
  // Actualizar index.html con título (sin cache buster)
  if (fs.existsSync(indexHtmlPath)) {
    let content = fs.readFileSync(indexHtmlPath, 'utf8');
    
    // Actualizar título de la página
    content = content.replace(
      /<title>Sotech Inmo v[\d.]+<\/title>/g,
      `<title>Sotech Inmo ${version}</title>`
    );
    
    fs.writeFileSync(indexHtmlPath, content);
    console.log(`✅ Título de la página actualizado a: ${version}`);
  } else {
    console.log('❌ No se encontró el archivo index.html');
  }
}

// Función para actualizar la versión en el backend
function updateBackendVersion() {
  const programCsPath = path.join(__dirname, '..', '..', 'inmo-sotech', 'UserManagementApi', 'Program.cs');
  
  if (fs.existsSync(programCsPath)) {
    let content = fs.readFileSync(programCsPath, 'utf8');
    const version = getVersionString();
    
    // Actualizar versión en Program.cs
    content = content.replace(
      /builder\.Services\.AddSingleton\(new \{ Version = "[^"]+" \}\);/g,
      `builder.Services.AddSingleton(new { Version = "${version}" });`
    );
    
    fs.writeFileSync(programCsPath, content);
    console.log(`✅ Versión del backend actualizada a: ${version}`);
  } else {
    console.log('❌ No se encontró el archivo Program.cs en:', programCsPath);
  }
}

// Función para actualizar la versión en el login del backend
function updateLoginBackendVersion() {
  const loginHtmlPath = path.join(__dirname, 'src', 'app', 'components', 'login', 'login.component.html');
  
  if (fs.existsSync(loginHtmlPath)) {
    let content = fs.readFileSync(loginHtmlPath, 'utf8');
    const version = getVersionString();
    
    // Actualizar versión del backend
    content = content.replace(
      /Backend: v[\d.]+/g,
      `Backend: ${version}`
    );
    
    fs.writeFileSync(loginHtmlPath, content);
    console.log(`✅ Versión del backend en login actualizada a: ${version}`);
  } else {
    console.log('❌ No se encontró el archivo login.component.html');
  }
}

// Ejecutar según el argumento
const action = process.argv[2];

switch (action) {
  case 'frontend':
    updateLoginVersion();
    break;
  case 'backend':
    updateBackendVersion();
    updateLoginBackendVersion();
    break;
  case 'both':
    updateLoginVersion();
    updateBackendVersion();
    updateLoginBackendVersion();
    break;
  default:
    console.log('Uso: node update-version.js [frontend|backend|both]');
    console.log('  frontend: Actualiza solo la versión del frontend');
    console.log('  backend: Actualiza solo la versión del backend');
    console.log('  both: Actualiza ambas versiones');
}
