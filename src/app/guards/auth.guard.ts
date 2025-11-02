import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { map, first } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    return this.authService.isAuthenticated.pipe(
      first(), // Tomar el primer valor que cumpla la condición
      map(isAuthenticated => {
        if (isAuthenticated) {
          console.log('🔒 [AuthGuard] Usuario autenticado, permitiendo acceso a:', state.url);
          return true;
        } else {
          console.log('🚫 [AuthGuard] Usuario no autenticado, redirigiendo a login desde:', state.url);
          // Redirigir a la página de login y pasar la URL a la que intentaba acceder como query param
          return this.router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url, error: 'auth_error' } });
        }
      })
    );
  }
}