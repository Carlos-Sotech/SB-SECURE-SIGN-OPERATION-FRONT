// src/app/components/set-password/set-password.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

// Angular Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox'; // Para la política de privacidad

// Tus Servicios y Modelos
import { AuthService } from '../../services/auth.service'; // Ajusta la ruta
import { LayoutService } from '../../services/layout.service'; // Ajusta la ruta o comenta/elimina si no se usa
import { SetPasswordDto } from '../../models/set-password.dto'; // Ajusta la ruta (este es el DTO de Angular)

// Validador personalizado para confirmar contraseña
// (Podrías moverlo a un archivo de utilidades si se usa en más sitios, como en ResetPasswordComponent)
export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword');
  const confirmPassword = control.get('confirmPassword');
  if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-set-password',
  standalone: true, // ¡IMPORTANTE si es un componente standalone!
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink, // Para el enlace de "Volver a Login" si el token es inválido

    // Módulos de Angular Material
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    MatCheckboxModule, // Necesario para mat-checkbox
  ],
  templateUrl: './set-password.component.html',
  styleUrls: ['../auth-pages.css'] // Usando el CSS común. Ajusta la ruta si es necesario.
})
export class SetPasswordComponent implements OnInit, OnDestroy {
  setPasswordForm!: FormGroup;
  token: string | null = null;
  emailFromQuery: string | null = null; // Para mostrar el email en la UI, si lo pasas en el enlace
  isLoading = false;
  errorMessage: string | null = null; // Para mostrar errores en la tarjeta
  hideNewPassword = true;
  hideConfirmPassword = true;

  private setPasswordSubscription: Subscription | undefined;
  private queryParamsSubscription: Subscription | undefined;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private layoutService: LayoutService // Comenta o elimina si no se usa
  ) { }

  ngOnInit(): void {
    this.layoutService.setShowNavbar(false); // Comenta/elimina si no aplica

    this.queryParamsSubscription = this.route.queryParamMap.subscribe(params => {
      this.token = params.get('token');
      this.emailFromQuery = params.get('email'); // Opcional, si tu enlace de email lo incluye

      if (!this.token) { // El email es opcional, pero el token es crucial
        this.errorMessage = "Enlace no válido o token no proporcionado. No se puede establecer la contraseña.";
        // Opcional: this.router.navigate(['/login']);
      }
    });

    this.setPasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      privacyPolicyAccepted: [false, Validators.requiredTrue] // Campo para la política de privacidad
    }, { validators: passwordMatchValidator });
  }

  ngOnDestroy(): void {
    this.layoutService.setShowNavbar(true); // Comenta/elimina si no aplica
    if (this.setPasswordSubscription) {
      this.setPasswordSubscription.unsubscribe();
    }
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
  }

  // Getter para fácil acceso a los form controls en el template
  get fc() {
    // Asegurar que el formulario esté inicializado
    return this.setPasswordForm ? this.setPasswordForm.controls : {};
  }

  toggleNewPasswordVisibility(event: MouseEvent): void {
    event.stopPropagation();
    this.hideNewPassword = !this.hideNewPassword;
  }
  toggleConfirmPasswordVisibility(event: MouseEvent): void {
    event.stopPropagation();
    this.hideConfirmPassword = !this.hideConfirmPassword;
  }

     // ...
   // src/app/components/set-password/set-password.component.ts
// ... (imports y otras partes de la clase)

  onSubmit(): void {
    this.errorMessage = null;

    if (!this.token) {
      this.errorMessage = "Token no encontrado o no válido. No se puede procesar la solicitud.";
      this.snackBar.open(this.errorMessage, 'Cerrar', { duration: 5000, panelClass: ['error-snackbar'] });
      return;
    }

    if (!this.setPasswordForm || this.setPasswordForm.invalid) {
      if (this.setPasswordForm) {
        this.setPasswordForm.markAllAsTouched();
      }
      return;
    }

    this.isLoading = true;
    // Crear un objeto que coincida con lo que espera el backend y el DTO del servicio
    const apiRequestData = { // Puedes darle un nombre diferente si quieres
      token: this.token,
      newPassword: this.fc['newPassword'].value,
      confirmPassword: this.fc['confirmPassword'].value,
      privacyPolicyAccepted: this.fc['privacyPolicyAccepted'].value
    };
    // TypeScript ahora inferirá el tipo de apiRequestData o puedes tiparlo explícitamente
    // si tienes una interfaz específica para el payload de la API que excluye confirmPassword.

    // Si tu AuthService.setPassword espera un tipo que SÍ incluye confirmPassword,
    // y la API NO lo quiere, entonces el AuthService debería encargarse de omitirlo.
    // Pero si AuthService.setPassword espera el DTO que la API espera, esta es la forma:

    this.setPasswordSubscription = this.authService.setPassword(apiRequestData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.snackBar.open(response.message || 'Contraseña establecida con éxito.', 'Cerrar', {
          duration: 7000,
          panelClass: ['success-snackbar']
        });
        const queryParamsForLogin: { email?: string } = {};
        if (this.emailFromQuery) {
          queryParamsForLogin.email = this.emailFromQuery;
        }
        this.router.navigate(['/login'], { queryParams: queryParamsForLogin });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || err.message || 'Ocurrió un error al restablecer la contraseña. El enlace podría haber expirado o ser incorrecto.';
        console.error('Error en set password:', err);
      }
    });
  }

// ... (resto de la clase)
   // ...
}