import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Si recibimos un error 401 (Unauthorized), el token ha expirado o es inválido
        if (error.status === 401) {
          console.log('🚫 [AuthErrorInterceptor] Error 401 detectado, limpiando sesión y redirigiendo a login');
          
          // Limpiar la sesión del usuario
          this.authService.logout();
          
          // Redirigir al login con la URL actual como returnUrl
          this.router.navigate(['/login'], { 
            queryParams: { returnUrl: this.router.url } 
          });
        }
        
        return throwError(() => error);
      })
    );
  }
}
