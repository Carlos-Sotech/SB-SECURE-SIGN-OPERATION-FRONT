// src/app/services/auth.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

import { environment } from '../../environments/environment'; // Ajusta la ruta si es necesario
import { UserCreateDto } from '../models/user-create.dto';   // Ajusta la ruta
import { SetPasswordDto as AngularSetPasswordDto } from '../models/set-password.dto'; // DTO de Angular para set-password
import { UserReadDto } from '../models/user-read.dto';     // Ajusta la ruta
import { LoginDto, LoginResponseDto } from '../models/login.dto'; // Ajusta la ruta
import { ForgotPasswordDto, ResetPasswordDto as AngularResetPasswordDto } from '../models/password-reset.dto'; // DTOs de Angular para reseteo

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/users`; // Endpoint principal de usuarios (ej: /api/users)
  private authApiUrl = `${environment.apiUrl}/auth`; // Endpoint para autenticación (ej: /api/auth)

  private currentUserSubject: BehaviorSubject<UserReadDto | null>;
  public currentUser: Observable<UserReadDto | null>;

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated = this.isAuthenticatedSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    // Debug: Verificar qué configuración se está cargando
    console.log('[AuthService] Environment config:', {
      production: environment.production,
      apiUrl: environment.apiUrl,
      authApiUrl: this.authApiUrl
    });
    
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<UserReadDto | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();

    // Si hay un token al iniciar, considerar al usuario autenticado
    if (this.hasToken() && storedUser) {
        this.isAuthenticatedSubject.next(true);
    } else {
        // Si no hay token o no hay usuario guardado, limpiar por si acaso
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        this.isAuthenticatedSubject.next(false);
    }
  }

  public get currentUserValue(): UserReadDto | null {
    return this.currentUserSubject.value;
  }

  registerUser(userData: UserCreateDto): Observable<UserReadDto> {
    return this.http.post<UserReadDto>(`${this.apiUrl}`, userData) // POST a /api/users
      .pipe(catchError(this.handleError));
  }

  // El DTO aquí es el que se envía desde el componente de Angular
  setPassword(passwordData: AngularSetPasswordDto): Observable<any> {
    // El endpoint de la API es /api/users/set-password
    // El DTO que espera la API podría ser ligeramente diferente (ej: sin confirmPassword)
    // Aquí asumimos que el DTO de Angular es compatible o se mapea antes si es necesario.
    // Por ahora, asumimos que la API espera un DTO con token y newPassword (y privacyPolicyAccepted).
    // Si tu API Dto (UserManagementApi.Dtos.SetPasswordDto) es diferente, ajusta el payload.
    const apiPayload = {
        token: passwordData.token,
        newPassword: passwordData.newPassword,
        privacyPolicyAccepted: passwordData.privacyPolicyAccepted // Esto debería funcionar ahora
    };
    return this.http.post<any>(`${this.apiUrl}/set-password`, apiPayload)
      .pipe(catchError(this.handleError));
  }

  login(loginData: LoginDto): Observable<LoginResponseDto> {
    const loginUrl = `${this.authApiUrl}/login`;
    console.log('🔍 [AUTH SERVICE] Intentando login a:', loginUrl);
    console.log('🔍 [AUTH SERVICE] Datos de login:', { usernameOrEmail: loginData.usernameOrEmail, password: '***' });
    return this.http.post<LoginResponseDto>(loginUrl, loginData)
      .pipe(
        tap(response => {
          console.log('🔍 [AUTH SERVICE] Respuesta del login recibida:', response);
          if (response && response.token && response.user) {
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            this.currentUserSubject.next(response.user);
            this.isAuthenticatedSubject.next(true);
            console.log('🔍 [AUTH SERVICE] Usuario logueado y guardado:', response.user);
            console.log('🔍 [AUTH SERVICE] Estado de autenticación actualizado a: true');
            console.log('🔍 [AUTH SERVICE] Token guardado:', response.token.substring(0, 20) + '...');
          } else {
            console.error('🔍 [AUTH SERVICE] Respuesta inválida, limpiando sesión');
            // Si la respuesta no es la esperada, limpiar
            this.clearUserSession();
          }
        }),
        catchError(error => {
          console.error('🔍 [AUTH SERVICE] Error en login:', error);
          console.error('🔍 [AUTH SERVICE] Error status:', error.status);
          console.error('🔍 [AUTH SERVICE] Error message:', error.message);
          console.error('🔍 [AUTH SERVICE] Error url:', error.url);
          this.clearUserSession(); // Limpiar en caso de error de login
          return this.handleError(error);
        })
      );
  }

  logout(): void {
    this.clearUserSession();
    this.router.navigate(['/login']); // Redirigir a login después de logout
  }

  private clearUserSession(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  public hasToken(): boolean {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    return !!(token && user);
  }

  // Para el AuthTokenInterceptor
  public getAuthToken(): string | null {
    const token = localStorage.getItem ('authToken');
    console.log('[AuthService] getAuthToken() llamado, token recuperado:', token); 
    return localStorage.getItem('authToken');

  }

  // Para el AuthTokenInterceptor, para decidir si añadir el token
  public getApiBaseUrl(): string {
    // Esto asume que environment.apiUrl es la base para tus endpoints de API
    // Si environment.apiUrl ya es la URL base (sin /users o /auth), entonces es más simple.
    // La idea es que request.url.startsWith(this.getApiBaseUrl()) funcione.
    return environment.apiUrl;
  }


  forgotPassword(emailData: ForgotPasswordDto): Observable<any> {
    return this.http.post<any>(`${this.authApiUrl}/forgot-password`, emailData)
      .pipe(catchError(this.handleError));
  }

  // El DTO aquí es el que se envía desde el componente de Angular
  resetPassword(resetData: AngularResetPasswordDto): Observable<any> {
    // El DTO que espera la API (ResetPasswordApiDto) podría ser ligeramente diferente.
    // Aquí asumimos compatibilidad o que el DTO de Angular se mapea si es necesario.
    // Por ahora, la API espera token, newPassword y confirmPassword.
    const apiPayload = {
        token: resetData.token,
        newPassword: resetData.newPassword,
        confirmPassword: resetData.confirmPassword // La API usa esto con [Compare]
    };
    return this.http.post<any>(`${this.authApiUrl}/reset-password`, apiPayload)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocurrió un error desconocido.';
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente o de red
      errorMessage = `Error del cliente: ${error.error.message}`;
    } else {
      // El backend devolvió un código de error
      console.error(
        `Backend devolvió código ${error.status}, ` +
        `cuerpo del error: ${JSON.stringify(error.error)}`);

      if (error.status === 0) {
          console.error('🔍 [AUTH SERVICE] Error de conexión (status 0):', {
            url: error.url,
            message: error.message,
            error: error.error
          });
          errorMessage = `No se pudo conectar con el servidor (${error.url || 'URL desconocida'}). Verifica tu conexión o si la API está corriendo.`;
      } else if (error.status === 401) { // Unauthorized
          errorMessage = error.error?.message || 'Credenciales incorrectas o no autorizado.';
      } else if (error.status === 403) { // Forbidden
          errorMessage = error.error?.message || 'No tienes permiso para realizar esta acción.';
      } else if (error.status === 404) { // Not Found
          errorMessage = error.error?.message || 'El recurso solicitado no fue encontrado.';
      } else if (error.status === 409) { // Conflict
          errorMessage = error.error?.message || 'Conflicto de datos. Por ejemplo, el email o username ya existe.';
      } else if (error.error && typeof error.error === 'string') {
          errorMessage = error.error; // Si el backend devuelve un string simple de error
      } else if (error.error && error.error.message) {
          errorMessage = error.error.message; // Mensaje de error estructurado de la API
      } else if (error.error && error.error.title && error.error.errors){ // Error de validación de ASP.NET ModelState
          const validationErrors = Object.values(error.error.errors).flat();
          errorMessage = `Error de validación: ${validationErrors.join(' ')}`;
      } else if (error.message) {
          errorMessage = `Error ${error.status}: ${error.message}`;
      }
       else {
          errorMessage = `Error del servidor ${error.status}. Por favor, inténtalo más tarde.`;
      }
    }
    return throwError(() => new Error(errorMessage));
  }

  // Método para eliminar un usuario
  deleteUser(userId: number, requestingUserId?: number): Observable<any> {
    let url = `${this.apiUrl}/${userId}`;
    if (requestingUserId) {
      url += `?requestingUserId=${requestingUserId}`;
    }
    return this.http.delete(url).pipe(
      catchError(this.handleError)
    );
  }

  // Método para obtener todos los usuarios
  getUsers(): Observable<UserReadDto[]> {
    return this.http.get<UserReadDto[]>(this.apiUrl).pipe(
      catchError(this.handleError)
    );
  }

  // Método para obtener usuarios por empresa
  getUsersByCompany(companyId: number): Observable<UserReadDto[]> {
    return this.http.get<UserReadDto[]>(`${this.apiUrl}/by-company/${companyId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Método para actualizar un usuario
  updateUser(userId: number, userData: any): Observable<UserReadDto> {
    return this.http.put<UserReadDto>(`${this.apiUrl}/${userId}`, userData).pipe(
      catchError(this.handleError)
    );
  }

  // Método para restablecer contraseña
  resetUserPassword(userId: number): Observable<any> {
    console.log('🔄 [AUTH SERVICE] Llamando a resetUserPassword para userId:', userId);
    console.log('🔄 [AUTH SERVICE] URL completa:', `${this.apiUrl}/${userId}/reset-password`);
    
    return this.http.post(`${this.apiUrl}/${userId}/reset-password`, {}).pipe(
      tap(response => {
        console.log('✅ [AUTH SERVICE] Respuesta exitosa de resetUserPassword:', response);
      }),
      catchError(error => {
        console.error('❌ [AUTH SERVICE] Error en resetUserPassword:', error);
        return this.handleError(error);
      })
    );
  }
}