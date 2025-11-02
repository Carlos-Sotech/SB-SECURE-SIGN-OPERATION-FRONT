# SB Secure Sign Operation Frontend

Aplicación web desarrollada en Angular 19 para la gestión completa de operaciones de firma digital segura, usuarios, empresas, acuerdos y partes firmantes.

## 📋 Tabla de Contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Componentes Principales](#componentes-principales)
- [Despliegue con Docker](#despliegue-con-docker)

## 🎯 Descripción

Este frontend proporciona una interfaz web completa para gestionar:

- **Autenticación y Usuarios**: Sistema de login, registro, recuperación de contraseña y gestión de usuarios con roles (Admin, SuperUsuario, Usuario)
- **Empresas**: Gestión de empresas y sus relaciones con usuarios
- **Operaciones**: Creación, edición, visualización y gestión de operaciones de firma digital (Local/Remota)
- **Visualización de PDFs**: Visor de PDFs integrado con áreas de firma interactivas
- **Firmas Digitales**: Definición de áreas de firma en documentos PDF y visualización de firmas aplicadas
- **Gestión de Partes Firmantes**: Administración de partes que deben firmar documentos
- **Diseño Responsive**: Interfaz adaptada para diferentes tamaños de pantalla (desktop, tablet, móvil)

## ✨ Características

- ✅ Angular 19 con arquitectura standalone components
- ✅ Angular Material Design para UI moderna y responsive
- ✅ Integración completa con API REST backend
- ✅ Autenticación JWT con gestión de tokens
- ✅ Visualizador de PDFs con `ngx-extended-pdf-viewer`
- ✅ Sistema de áreas de firma interactivas en PDFs
- ✅ Gestión de estado reactiva con RxJS
- ✅ Guards de autenticación y autorización por roles
- ✅ Interceptores HTTP para manejo de tokens y errores
- ✅ Soporte para Docker
- ✅ Configuración mediante variables de entorno
- ✅ Sistema de versionado automático

## 📦 Requisitos

- **Node.js** 18+ (recomendado 20+)
- **npm** 9+ o **yarn**
- **Angular CLI** 19+
- **Docker** (opcional, para despliegue con contenedores)

### Dependencias Principales

- Angular 19.2+
- Angular Material 19.2+
- RxJS 7.8+
- ngx-extended-pdf-viewer 25.6+
- pdf-lib 1.17+
- pdfjs-dist 5.3+

## 🚀 Instalación

### Opción 1: Instalación Local

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/Carlos-Sotech/SB-SECURE-SIGN-OPERATION-FRONT.git
   cd SB-SECURE-SIGN-OPERATION-FRONT
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```
   O con yarn:
   ```bash
   yarn install
   ```

3. **Configurar variables de entorno**
   - Copiar `src/assets/envtemplate.js` a `src/assets/env.js`
   - Configurar la URL del backend API

4. **Ejecutar la aplicación en desarrollo**
   ```bash
   npm start
   # O
   npm run start:dev
   ```

La aplicación estará disponible en `http://localhost:4200`.

5. **Construir para producción**
   ```bash
   npm run build:prod
   ```

Los archivos de producción se generarán en `dist/rutas/`.

### Opción 2: Instalación con Docker

1. **Construir la imagen**
   ```bash
   docker build -f Dockerfile.frontend -t rutas-frontend:latest .
   ```

2. **Ejecutar el contenedor**
   ```bash
   docker run -d \
     -p 4200:4200 \
     -e API_URL=http://localhost:8080 \
     --name rutas-frontend \
     rutas-frontend:latest
   ```

## ⚙️ Configuración

### Variables de Entorno

El frontend se configura mediante un archivo JavaScript que se carga dinámicamente. Crear `src/assets/env.js` basándose en `src/assets/envtemplate.js`:

```javascript
window['env'] = {
  API_URL: 'http://localhost:8080',
  ENVIRONMENT: 'development'
};
```

#### Configuración para Desarrollo

```javascript
window['env'] = {
  API_URL: 'http://localhost:8080',
  ENVIRONMENT: 'development'
};
```

#### Configuración para Producción

```javascript
window['env'] = {
  API_URL: 'https://api.tu-dominio.com',
  ENVIRONMENT: 'production'
};
```

### Archivo environment.ts

También puedes configurar mediante `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080'
};
```

### Configuración de Nginx (Producción)

Si usas Nginx para servir la aplicación en producción, asegúrate de configurar correctamente:

- SPA routing (redirect todas las rutas a `index.html`)
- Headers CORS si es necesario
- Compresión gzip
- Cache de archivos estáticos

## 📖 Uso

### Rutas Principales

#### Autenticación
- `/login` - Iniciar sesión
- `/register` - Registrar nuevo usuario
- `/forgot-password` - Solicitar recuperación de contraseña
- `/reset-password` - Restablecer contraseña con token
- `/set-password` - Establecer contraseña inicial

#### Gestión (requieren autenticación)
- `/user-list` - Listar y gestionar usuarios (requiere rol Admin)
- `/company-list` - Listar y gestionar empresas
- `/operation-list` - Listar y gestionar operaciones de firma
- `/signature/:operationId` - Visualizar PDF y definir/firmar áreas de firma

### Funcionalidades Principales

#### Gestión de Operaciones
1. **Crear Operación**: Desde la lista de operaciones, clic en "Nueva Operación"
2. **Seleccionar PDF**: Subir documento PDF
3. **Definir Áreas de Firma**: Seleccionar partes firmantes y arrastrar áreas en el PDF
4. **Lanzar Operación**: Activar la operación para que las partes puedan firmar
5. **Visualizar Estado**: Ver operaciones pendientes y completadas

#### Definición de Áreas de Firma
1. Acceder a la página de firma desde una operación
2. Seleccionar una parte firmante
3. Arrastrar sobre el PDF para definir el área de firma
4. Guardar el área definida
5. Repetir para cada parte firmante

#### Visualización de PDFs
- Zoom in/out con rueda del ratón o controles
- Navegación entre páginas con botones o scroll
- Áreas de firma visualizadas con colores por parte
- Canvas overlay para interacción táctil y mouse

## 📁 Estructura del Proyecto

```
rutas-frontend/
├── src/
│   ├── app/
│   │   ├── components/          # Componentes principales
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── user-list/
│   │   │   ├── company-list/
│   │   │   ├── operation-list/
│   │   │   ├── operation-form/
│   │   │   ├── operation-view/
│   │   │   ├── signature-page/
│   │   │   └── pdf-signature-areas/
│   │   ├── guards/              # Guards de ruta
│   │   │   └── auth.guard.ts
│   │   ├── interceptors/        # Interceptores HTTP
│   │   │   ├── auth-token.interceptor.ts
│   │   │   └── auth-error.interceptor.ts
│   │   ├── models/              # Modelos de datos
│   │   │   ├── user.model.ts
│   │   │   ├── company.model.ts
│   │   │   ├── operation.model.ts
│   │   │   ├── party.model.ts
│   │   │   └── role.enum.ts
│   │   ├── services/            # Servicios
│   │   │   ├── auth.service.ts
│   │   │   ├── user.service.ts
│   │   │   ├── operation.service.ts
│   │   │   ├── signature.service.ts
│   │   │   └── pdf-signature-visualizer.service.ts
│   │   ├── app.routes.ts        # Configuración de rutas
│   │   ├── app.config.ts        # Configuración de la app
│   │   └── app.component.ts     # Componente raíz
│   ├── assets/                 # Archivos estáticos
│   │   ├── env.js              # Variables de entorno (generado)
│   │   ├── envtemplate.js      # Plantilla de variables
│   │   └── version.json        # Información de versión
│   ├── environments/           # Configuraciones por entorno
│   │   ├── environment.ts
│   │   └── environment.development.ts
│   ├── index.html              # HTML principal
│   └── main.ts                 # Punto de entrada
├── angular.json                # Configuración Angular
├── package.json                # Dependencias npm
├── tsconfig.json              # Configuración TypeScript
├── Dockerfile.frontend        # Dockerfile para producción
├── nginx.conf                 # Configuración Nginx
└── update-version.js          # Script de versionado
```

## 🧩 Componentes Principales

### LoginComponent
Maneja la autenticación de usuarios con validación de formularios y gestión de errores.

### UserListComponent
Lista de usuarios con filtrado, ordenamiento y gestión CRUD (requiere rol Admin).

### CompanyListComponent
Gestión de empresas vinculadas a usuarios y operaciones.

### OperationListComponent
Lista de operaciones con filtros por estado, usuario y tipo. Permite crear, editar y visualizar operaciones.

### OperationFormComponent
Formulario para crear/editar operaciones con:
- Selección de tipo de operación (Local/Remota)
- Subida de archivo PDF
- Gestión de acuerdos y partes firmantes
- Visualización previa del PDF

### OperationViewComponent
Visualización de operaciones completadas con:
- Visualización del PDF firmado
- Áreas de firma resaltadas
- Información de las partes firmantes

### SignaturePageComponent
Componente principal para definición y aplicación de firmas:
- Visualización del PDF con navegación entre páginas
- Canvas overlay para definir áreas de firma
- Selección de partes firmantes
- Guardado de áreas de firma por página
- Soporte multi-página con coordenadas relativas

### PdfSignatureAreasComponent
Componente reutilizable para visualizar áreas de firma en PDFs.

## 🐳 Despliegue con Docker

### Docker Compose

Ejemplo de configuración en `docker-compose.yml`:

```yaml
services:
  rutas-frontend:
    image: rutas-frontend-local:v2025.11.02.2065
    container_name: rutas-frontend
    depends_on:
      - sotech-backend
    environment:
      - API_URL=http://sotech-backend:8080
    ports:
      - "4200:4200"
    networks:
      - postgres_network
    restart: unless-stopped
```

### Construir Imagen Docker

```bash
docker build -f Dockerfile.frontend -t rutas-frontend:latest .
```

### Variables de Entorno Importantes para Docker

Asegúrate de configurar estas variables:

- `API_URL` - URL del backend API
- `ENVIRONMENT` - Entorno (development/production)

### Scripts de Build

El proyecto incluye scripts para facilitar el despliegue:

- `update-version.js` - Actualiza la versión automáticamente antes de build
- `build:prod` - Build de producción con versionado automático

## 🎨 Características de UI/UX

### Material Design
- Componentes de Angular Material para una UI moderna
- Tema personalizado con colores corporativos
- Responsive design para móviles, tablets y desktop

### Interactividad con PDFs
- Zoom y pan en documentos PDF
- Navegación por páginas
- Áreas de firma interactivas con canvas overlay
- Soporte táctil para dispositivos móviles
- Indicadores visuales de áreas de firma por parte

### Gestión de Estado
- Servicios reactivos con RxJS
- Gestión centralizada de autenticación
- Cache de datos cuando es apropiado
- Actualización en tiempo real de listas

## 🔒 Seguridad

- Tokens JWT almacenados de forma segura
- Interceptores HTTP para añadir tokens automáticamente
- Guards de ruta para proteger páginas
- Validación de roles para acceso a funcionalidades
- Manejo seguro de errores de autenticación
- Redirección automática al login cuando el token expira

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm start                    # Servidor de desarrollo
npm run start:dev          # Desarrollo con configuración específica
npm run start:prod         # Desarrollo con configuración de producción

# Build
npm run build              # Build desarrollo
npm run build:dev         # Build desarrollo
npm run build:prod         # Build producción con versionado

# Versión
npm run update-version:frontend    # Actualizar versión frontend
npm run update-version:backend    # Actualizar versión backend
npm run update-version:both       # Actualizar ambas versiones

# Servir producción localmente
npm run serve:prod        # Servir dist/ con Node.js
npm run serve:prod:win    # Versión Windows
```

## 🧪 Testing

Para ejecutar los tests:

```bash
npm test
```

## 📝 Logging y Debugging

- Console logs con prefijos identificables (`🔍` para debugging)
- Interceptor de errores HTTP que muestra mensajes al usuario
- Manejo de errores en componentes con mensajes informativos
- Tracing de rutas habilitado en desarrollo

## 🔄 Versionado

El sistema incluye versionado automático:
- Versión en `package.json`
- Versión en `src/assets/version.json`
- Versión en el título de la página
- Script `update-version.js` actualiza todo automáticamente

Formato de versión: `vYYYY.MM.DD.HHMM`

## 📞 Soporte

Para más información o soporte, contacta con el equipo de desarrollo.

## 📄 Licencia

Este proyecto es privado y pertenece a Sotech Biometrics.

---

**Versión**: v2025.11.02.2218  
**Angular**: 19.2+  
**Node.js**: 18+  
**TypeScript**: 5.7+