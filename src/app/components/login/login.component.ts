// src/app/components/login/login.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms'; // Importar ReactiveFormsModule
import { Router, ActivatedRoute, RouterLink } from '@angular/router'; // Importar RouterLink
import { Subscription } from 'rxjs';
import { filter, take, delay } from 'rxjs/operators';
import { CommonModule } from '@angular/common'; // Importar CommonModule para *ngIf, etc.

// Importaciones de Angular Material (individuales o tu MaterialModule si es standalone-compatible)
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // Importar MatSnackBarModule también

import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../../services/layout.service';
import { VersionService } from '../../services/version.service';
import { LoginDto } from '../../models/login.dto';
import { Role } from '../../models/role.enum';

@Component({
  selector: 'app-login',
  standalone: true, // ¡IMPORTANTE SI ES STANDALONE!
  imports: [
    CommonModule,         // Para *ngIf, *ngFor, async pipe, etc.
    ReactiveFormsModule,  // Para [formGroup], formControlName
    RouterLink,           // Para routerLink en el template

    // Módulos de Angular Material (o tu MaterialModule si lo has hecho compatible)
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,    // El módulo para el servicio MatSnackBar
    // Si usaras otros, como MatCheckboxModule, etc., añádelos aquí
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  hidePassword = true;
  
  // Versiones dinámicas
  frontendVersion: string = 'Loading...';
  backendVersion: string = 'Loading...';

  private queryParamsSubscription: Subscription | undefined;
  private loginSubscription: Subscription | undefined;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private layoutService: LayoutService, // Asumiendo que LayoutService es providedIn: 'root' o provisto globalmente
    private versionService: VersionService
  ) {
    console.log('[LoginComponent] Constructor executed');
  }

  ngOnInit(): void {
    console.log('[LoginComponent] ngOnInit executed');
    
    // Solo limpiar datos específicos, no todo el localStorage
    // para evitar interferir con el estado de autenticación
    this.clearSpecificData();
    
    this.layoutService.setShowNavbar(false);
    
    this.layoutService.setShowNavbar(false); // Ocultar navbar (Enfoque 1)

    this.loginForm = this.fb.group({
      usernameOrEmail: ['', Validators.required],
      password: ['', Validators.required]
    });

    // Cargar versiones dinámicamente
    this.loadVersions();

    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      console.log('[LoginComponent] QueryParams changed:', params);
      const emailFromReset = params['email'];
      const errorFromGuard = params['error'];
      const returnUrlProcessed = params['returnUrlProcessed'];

      if (emailFromReset && !returnUrlProcessed) {
        this.loginForm.patchValue({ usernameOrEmail: emailFromReset });
        this.snackBar.open('Contraseña restablecida. Por favor, inicia sesión.', 'Cerrar', { duration: 7000, panelClass: ['success-snackbar'] });
        this.clearSpecificQueryParam('email');
      }

      if (errorFromGuard && !returnUrlProcessed) {
        let message = 'Ocurrió un error desconocido.';
        if (errorFromGuard === 'unauthorized_role') {
          message = 'No tienes permiso para acceder a la sección solicitada.';
        } else if (errorFromGuard === 'auth_error') {
          message = 'Ocurrió un error de autenticación. Intenta de nuevo.';
        }
        this.errorMessage = message;
        this.clearSpecificQueryParam('error');
      }
    });
  }

  ngOnDestroy(): void {
    console.log('[LoginComponent] ngOnDestroy executed');
    this.layoutService.setShowNavbar(true); // Mostrar navbar al salir (Enfoque 1)
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
    if (this.loginSubscription) {
        this.loginSubscription.unsubscribe();
    }
  }

  get fc() {
    return this.loginForm.controls;
  }

  togglePasswordVisibility(event: MouseEvent): void {
    event.stopPropagation();
    this.hidePassword = !this.hidePassword;
  }

   onSubmit(): void {
    this.errorMessage = null;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const loginData: LoginDto = this.loginForm.value; // <<< --- loginData se define aquí y es local a onSubmit

    this.loginSubscription = this.authService.login(loginData).subscribe({ // Se usa correctamente aquí
      next: (response) => {
        this.isLoading = false;
        console.log('🔍 [LOGIN] Login exitoso, response:', response);
        
        const user = response.user;
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || null;

        if (!user) {
          console.error('🔍 [LOGIN] Error: usuario no recibido en la respuesta');
          this.router.navigate(['/login']);
          this.snackBar.open('Error inesperado durante el login.', 'Cerrar', { duration: 5000, panelClass: ['error-snackbar'] });
          return;
        }

        console.log('🔍 [LOGIN] Usuario recibido:', user);
        console.log('🔍 [LOGIN] Rol del usuario:', user.role);
        console.log('🔍 [LOGIN] ReturnUrl:', returnUrl);

        // Mostrar mensaje de éxito
        this.snackBar.open(response.message || 'Login exitoso!', 'Cerrar', { duration: 3000, panelClass: ['success-snackbar'] });

        console.log('🔍 [LOGIN] Login exitoso, navegando...');
        
        // Validar returnUrl para evitar bucles de redirección
        const isValidReturnUrl = returnUrl && 
                                 !returnUrl.includes('/login') && 
                                 !returnUrl.includes('/register') &&
                                 !returnUrl.includes('/set-password') &&
                                 !returnUrl.includes('/forgot-password') &&
                                 !returnUrl.includes('/reset-password');
        
        // Navegar usando el router de Angular
        if (isValidReturnUrl) {
          console.log('🔍 [LOGIN] Navegando a returnUrl válido:', returnUrl);
          this.router.navigateByUrl(returnUrl);
        } else {
          if (returnUrl) {
            console.log('🔍 [LOGIN] ReturnUrl inválido o circular, navegando por rol');
          }
          this.navigateByRole(user);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.message || 'Error al iniciar sesión.';
        this.snackBar.open(this.errorMessage ?? '', 'Cerrar', { duration: 7000, panelClass: ['error-snackbar'] });
        console.error('Error en el login:', err);
      

}
    });
  }
  private navigateAfterLogin(user: any, returnUrl: string | null): void {
    const currentUser = this.authService.currentUserValue;
    console.log('🔍 [LOGIN] Reintentando navegación, usuario actual:', currentUser);
    
    if (currentUser && currentUser.id === user.id) {
      if (returnUrl) {
        console.log('🔍 [LOGIN] Navegando a returnUrl:', returnUrl);
        this.router.navigateByUrl(returnUrl);
      } else {
        this.navigateByRole(user);
      }
    } else {
      console.error('🔍 [LOGIN] Error: No se pudo confirmar el estado de autenticación');
      this.snackBar.open('Error de autenticación. Por favor, intenta de nuevo.', 'Cerrar', { duration: 5000, panelClass: ['error-snackbar'] });
    }
  }

  private navigateByRoleDirect(user: any): void {
    console.log('🔍 [LOGIN] Navegación directa según rol:', user.role);
    
    // Usar window.location.href para navegación forzada
    switch (user.role) {
      case Role.Administrador:
        console.log('🔍 [LOGIN] Navegación directa a /user-list para Administrador');
        window.location.href = '/user-list';
        break;
      case Role.Superusuario:
        console.log('🔍 [LOGIN] Navegación directa a /user-list para Superusuario');
        window.location.href = '/user-list';
        break;
      case Role.Usuario:
        console.log('🔍 [LOGIN] Navegación directa a /operation-list para Usuario');
        window.location.href = '/operation-list';
        break;
      default:
        console.error('🔍 [LOGIN] Rol no reconocido:', user.role);
        this.snackBar.open('Rol de usuario no reconocido.', 'Cerrar', { duration: 5000, panelClass: ['error-snackbar'] });
        window.location.href = '/login';
        break;
    }
  }

  private navigateByRole(user: any): void {
    console.log('🔍 [LOGIN] Navegando según rol:', user.role);
    
    // Mostrar navbar antes de navegar
    this.layoutService.setShowNavbar(true);
    
    switch (user.role) {
      case Role.Administrador:
        console.log('🔍 [LOGIN] Navegando a /user-list para Administrador');
        this.router.navigate(['/user-list']);
        break;
      case Role.Superusuario:
        console.log('🔍 [LOGIN] Navegando a /user-list para Superusuario');
        this.router.navigate(['/user-list']);
        break;
      case Role.Usuario:
        console.log('🔍 [LOGIN] Navegando a /operation-list para Usuario');
        this.router.navigate(['/operation-list']);
        break;
      default:
        console.error('🔍 [LOGIN] Rol no reconocido:', user.role);
        this.snackBar.open('Rol de usuario no reconocido.', 'Cerrar', { duration: 5000, panelClass: ['error-snackbar'] });
        this.router.navigate(['/login']);
        break;
    }
  }

  private clearSpecificData(): void {
    // Limpiar solo datos específicos que puedan causar problemas
    // pero mantener datos de autenticación válidos
    sessionStorage.clear();
    
    // Limpiar cookies específicos
    this.clearAllCookies();
    
    // Limpiar datos específicos del localStorage que no sean de autenticación
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.includes('auth') && !key.includes('user') && !key.includes('token')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('🧹 [LOGIN] Datos específicos limpiados, manteniendo datos de autenticación');
  }

  private clearAllCookies(): void {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
  } 

  private clearSpecificQueryParam(paramName: string): void {
    const currentParams = { ...this.route.snapshot.queryParams };
    console.log(`[LoginComponent] Clearing queryParam '${paramName}'. Current params:`, currentParams);
    if (currentParams[paramName]) {
      delete currentParams[paramName];
      currentParams['returnUrlProcessed'] = 'true';

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: currentParams,
        replaceUrl: true
      }).then(navigated => {
          console.log(`[LoginComponent] Query param '${paramName}' cleared via navigate (promise resolved):`, navigated);
      }).catch(err => console.error(`[LoginComponent] Error clearing queryParam '${paramName}' (promise rejected)`, err));
    }
  }

  private loadVersions(): void {
    // Cargar versión del frontend
    this.frontendVersion = this.versionService.getFrontendVersion();
    
    // Cargar versión del frontend desde el archivo
    this.versionService.loadFrontendVersion().subscribe({
      next: (version) => {
        this.frontendVersion = version;
      },
      error: (error) => {
        console.error('Error loading frontend version:', error);
        this.frontendVersion = this.versionService.getFrontendVersion();
      }
    });
    
    // Cargar versión del backend
    this.versionService.getBackendVersion().subscribe({
      next: (version) => {
        this.backendVersion = version;
      },
      error: (error) => {
        console.error('Error loading backend version:', error);
        this.backendVersion = 'Unknown';
      }
    });
  }
}
