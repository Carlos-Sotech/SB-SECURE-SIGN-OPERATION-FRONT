import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable() // <-- SIN providedIn: 'root'
export class AuthTokenInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {} // AuthService sí puede tener providedIn: 'root'

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const authToken = this.authService.getAuthToken();
    const apiBaseUrl = this.authService.getApiBaseUrl();

    // Debug detallado para investigar 401s tras flujos de firma
    const tokenPreview = authToken ? `${authToken.substring(0, 20)}...` : 'null';
    const startsWithBase = request.url.startsWith(apiBaseUrl);
    const hasAuthHeader = request.headers.has('Authorization');

    console.log('[AuthTokenInterceptor] Interceptando petición:', {
      url: request.url,
      method: request.method,
      apiBaseUrl,
      startsWithBase,
      authToken: tokenPreview,
      requestHadAuthorizationHeader: hasAuthHeader
    });

    if (authToken && startsWithBase && !hasAuthHeader) {
      const authReq = request.clone({
        headers: request.headers.set('Authorization', `Bearer ${authToken}`)
      });
      console.log('[AuthTokenInterceptor] Token añadido a la petición:', { url: request.url, authToken: tokenPreview });
      return next.handle(authReq);
    }

    if (!authToken) {
      console.log('[AuthTokenInterceptor] No hay token disponible en localStorage');
    } else if (!startsWithBase) {
      console.log('[AuthTokenInterceptor] La URL no coincide con apiBaseUrl, no se añade token');
    } else if (hasAuthHeader) {
      console.log('[AuthTokenInterceptor] La petición ya incluye cabecera Authorization, no la sobrescribo');
    }

    return next.handle(request);
  }
}