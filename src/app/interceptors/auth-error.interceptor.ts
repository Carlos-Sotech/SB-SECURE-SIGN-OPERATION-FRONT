import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  // Evitar múltiples logouts en cascada
  private isLoggingOut = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Si recibimos un error 401 (Unauthorized) o 403 (Forbidden), la sesión ha caducado o no tiene permisos
        if (error.status === 401 || error.status === 403) {
          // Evitar múltiples logouts en cascada cuando hay varias peticiones fallando
          if (this.isLoggingOut) {
            console.log(`🚫 [AuthErrorInterceptor] Error ${error.status} detectado, pero ya se está procesando logout`);
            return throwError(() => error);
          }

          // Solo hacer logout si la petición tenía un token (evitar logout en peticiones públicas)
          const hadAuthHeader = request.headers.has('Authorization');
          
          // Verificar si ya estamos en la página de login (evitar bucle)
          const isOnLoginPage = this.router.url.startsWith('/login');
          
          if (hadAuthHeader && !isOnLoginPage) {
            console.log(`🚫 [AuthErrorInterceptor] Error ${error.status} detectado en petición autenticada, limpiando sesión`);
            
            this.isLoggingOut = true;
            
            // Mostrar mensaje al usuario
            const mensaje = error.status === 401 
              ? 'Tu sesión ha caducado. Por favor, inicia sesión de nuevo.'
              : 'Tu sesión ha caducado o no tienes permisos. Por favor, inicia sesión de nuevo.';
            
            this.snackBar.open(mensaje, 'Cerrar', {
              duration: 5000,
              horizontalPosition: 'center',
              verticalPosition: 'top',
              panelClass: ['session-expired-snackbar']
            });
            
            // Limpiar la sesión del usuario
            this.authService.logout();
            
            // Redirigir al login con la URL actual como returnUrl
            this.router.navigate(['/login'], { 
              queryParams: { returnUrl: this.router.url } 
            });

            // Resetear flag después de un breve delay
            setTimeout(() => {
              this.isLoggingOut = false;
            }, 1000);
          } else {
            console.log(`🚫 [AuthErrorInterceptor] Error ${error.status} detectado, pero no se limpia sesión:`, {
              hadAuthHeader,
              isOnLoginPage,
              url: request.url
            });
          }
        }
        
        return throwError(() => error);
      })
    );
  }
}
