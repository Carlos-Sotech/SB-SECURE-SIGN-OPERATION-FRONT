// src/app/components/reset-password/reset-password.component.ts

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
import { MatIconModule } from '@angular/material/icon'; // Para el toggle de visibilidad de contraseña

// Tus Servicios y Modelos
import { AuthService } from '../../services/auth.service'; // Ajusta la ruta
import { LayoutService } from '../../services/layout.service'; // Ajusta la ruta o comenta/elimina si no se usa
import { ResetPasswordDto } from '../../models/password-reset.dto'; // Ajusta la ruta

// Validador personalizado para confirmar contraseña
// (Podrías moverlo a un archivo de utilidades si se usa en más sitios)
export function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword');
  const confirmPassword = control.get('confirmPassword');
  if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-reset-password',
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
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../auth-pages.css'] // Usando el CSS común. Ajusta la ruta si es necesario.
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  resetPasswordForm!: FormGroup;
  token: string | null = null;
  emailFromQuery: string | null = null; // Para mostrar el email en la UI
  isLoading = false;
  errorMessage: string | null = null; // Para mostrar errores en la tarjeta
  hideNewPassword = true;
  hideConfirmPassword = true;

  private resetPasswordSubscription: Subscription | undefined;
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
     this.emailFromQuery = params.get('email');

     if (!this.token || !this.emailFromQuery) {
       this.errorMessage = "Enlace no válido o incompleto. Por favor, solicita un nuevo enlace para restablecer tu contraseña.";
       // No es necesario un snackbar aquí, el mensaje en la tarjeta es suficiente.
     }
   });


    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: passwordMatchValidator });
  }

  ngOnDestroy(): void {
    this.layoutService.setShowNavbar(true); // Comenta/elimina si no aplica
    if (this.resetPasswordSubscription) {
      this.resetPasswordSubscription.unsubscribe();
    }
    if (this.queryParamsSubscription) {
     this.queryParamsSubscription.unsubscribe();
    }
  }

  // Getter para fácil acceso a los form controls en el template
  get fc() {
    return this.resetPasswordForm.controls;
  }

  toggleNewPasswordVisibility(event: MouseEvent): void {
     event.stopPropagation();
     this.hideNewPassword = !this.hideNewPassword;
  }
  toggleConfirmPasswordVisibility(event: MouseEvent): void {
     event.stopPropagation();
     this.hideConfirmPassword = !this.hideConfirmPassword;
  }

  onSubmit(): void {
    this.errorMessage = null; // Limpiar errores previos

    if (!this.token || !this.emailFromQuery) { // Doble chequeo por si acaso, aunque ngOnInit ya lo maneja
      this.errorMessage = "Token o email no válido. No se puede procesar la solicitud.";
      return;
    }

    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const resetData: ResetPasswordDto = {
      token: this.token,
      newPassword: this.fc['newPassword'].value,
      // La API espera confirmPassword, aunque el validador local ya lo chequea.
      confirmPassword: this.fc['confirmPassword'].value
    };

    this.resetPasswordSubscription = this.authService.resetPassword(resetData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.snackBar.open(response.message || 'Contraseña restablecida con éxito.', 'Cerrar', {
          duration: 7000,
          panelClass: ['success-snackbar']
        });
        // Redirigir al login con el email en queryParams para pre-rellenar
        this.router.navigate(['/login'], { queryParams: { email: this.emailFromQuery } });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || err.message || 'Ocurrió un error al restablecer la contraseña. El enlace podría haber expirado o ser incorrecto.';
        // Opcional: snackBar para errores, aunque el mensaje en la tarjeta podría ser suficiente.
        // this.snackBar.open(this.errorMessage, 'Cerrar', {
        //   duration: 5000,
        //   panelClass: ['error-snackbar']
        // });
        console.error('Error en reset password:', err);
      }
    });
  }
}