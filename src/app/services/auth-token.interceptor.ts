import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable() // <-- SIN providedIn: 'root'
export class AuthTokenInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {} // AuthService sí puede tener providedIn: 'root'

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    console.log('[AuthTokenInterceptor] Interceptando petición (Standalone setup):', request.url); // LOG INICIAL
    const authToken = this.authService.getAuthToken();
    const apiBaseUrl = this.authService.getApiBaseUrl();

    if (authToken && request.url.startsWith(apiBaseUrl)) {
      const authReq = request.clone({
        headers: request.headers.set('Authorization', `Bearer ${authToken}`)
      });
      console.log('[AuthTokenInterceptor] Token añadido para:', request.url);
      return next.handle(authReq);
    }
    console.log('[AuthTokenInterceptor] Token NO añadido para:', request.url);
    return next.handle(request);
  }
}