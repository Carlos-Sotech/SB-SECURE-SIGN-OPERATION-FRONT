# Script para reconstruir el backend con los nuevos cambios
Write-Host "=== RECONSTRUYENDO BACKEND ==="

# Cambiar al directorio del backend
Set-Location "C:\Users\pablo\inmo-sotech\UserManagementApi"
Write-Host "Directorio actual: $(Get-Location)"

# Construir la nueva imagen
Write-Host "Construyendo imagen Docker..."
docker build -t sotech-backend-local:v2025.09.25.0015 . --no-cache

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Imagen construida exitosamente"
} else {
    Write-Host "❌ Error al construir la imagen"
    exit 1
}

# Cambiar al directorio del docker-compose
Set-Location "C:\Users\pablo\Downloads\sotech-simple"
Write-Host "Directorio actual: $(Get-Location)"

# Parar el contenedor actual
Write-Host "Parando contenedor actual..."
docker-compose -f docker-compose-sin-datos.yml stop sotech-backend

# Eliminar el contenedor actual
Write-Host "Eliminando contenedor actual..."
docker-compose -f docker-compose-sin-datos.yml rm -f sotech-backend

# Levantar el nuevo contenedor
Write-Host "Levantando nuevo contenedor..."
docker-compose -f docker-compose-sin-datos.yml up -d sotech-backend

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Contenedor levantado exitosamente"
} else {
    Write-Host "❌ Error al levantar el contenedor"
    exit 1
}

# Esperar un momento para que se inicie
Write-Host "Esperando que el contenedor se inicie..."
Start-Sleep -Seconds 10

# Mostrar logs del inicio
Write-Host "=== LOGS DEL BACKEND ==="
docker logs sotech-backend --tail 50

Write-Host "=== PROCESO COMPLETADO ==="
