// src/app/components/forgot-password/forgot-password.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms'; // Importar ReactiveFormsModule
import { RouterLink } from '@angular/router'; // Importar RouterLink para el enlace a Login
import { CommonModule } from '@angular/common'; // Importar CommonModule para *ngIf, etc.
import { Subscription } from 'rxjs';

// Angular Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // Importar MatSnackBarModule

// Tus Servicios y Modelos
import { AuthService } from '../../services/auth.service'; // Ajusta la ruta
import { LayoutService } from '../../services/layout.service'; // Ajusta la ruta o comenta/elimina si no se usa
import { ForgotPasswordDto } from '../../models/password-reset.dto'; // Ajusta la ruta

@Component({
  selector: 'app-forgot-password',
  standalone: true, // ¡IMPORTANTE si es un componente standalone!
  imports: [
    CommonModule,         // Para *ngIf, etc.
    ReactiveFormsModule,  // Para [formGroup], formControlName
    RouterLink,           // Para el enlace routerLink="/login"

    // Módulos de Angular Material
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,    // Módulo para el servicio MatSnackBar
  ],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../auth-pages.css'] // Usando el CSS común. Cambia si usas uno específico.
  // Si prefieres un CSS específico para este componente:
  // styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
  forgotPasswordForm!: FormGroup;
  isLoading = false;
  // Si quisieras mostrar un mensaje de error directamente en la tarjeta, además del snackbar:
  // errorMessage: string | null = null;

  private forgotPasswordSubscription: Subscription | undefined;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private layoutService: LayoutService // Comenta o elimina si no usas LayoutService para el navbar
  ) { }

  ngOnInit(): void {
    // Comenta o elimina la siguiente línea si no usas LayoutService para el navbar
    this.layoutService.setShowNavbar(false);

    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnDestroy(): void {
    // Comenta o elimina la siguiente línea si no usas LayoutService para el navbar
    this.layoutService.setShowNavbar(true);

    if (this.forgotPasswordSubscription) {
      this.forgotPasswordSubscription.unsubscribe();
    }
  }

  // Getter para fácil acceso a los form controls en el template
  get fc() {
    return this.forgotPasswordForm.controls;
  }

  onSubmit(): void {
    // this.errorMessage = null; // Limpiar si muestras error en la tarjeta
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched(); // Muestra errores si el usuario no ha interactuado
      return;
    }

    this.isLoading = true;
    const emailData: ForgotPasswordDto = this.forgotPasswordForm.value;

    this.forgotPasswordSubscription = this.authService.forgotPassword(emailData).subscribe({
      next: (response) => {
        this.isLoading = false;
        // La API devuelve un mensaje genérico para no revelar si el email existe
        const successMessage = response.message || 'Si tu email está registrado, recibirás un enlace para restablecer tu contraseña.';
        this.snackBar.open(successMessage, 'Cerrar', {
          duration: 7000,
          panelClass: ['success-snackbar'] // O una clase genérica si prefieres
        });
        this.forgotPasswordForm.reset(); // Limpiar el formulario
      },
      error: (err) => {
        this.isLoading = false;
        // Incluso en caso de error de red, la API no debe revelar info.
        // El snackbar puede mostrar un mensaje genérico o el de la API si esta devuelve uno por error.
        const displayMessage = err.error?.message || err.message || 'Ocurrió un error al procesar tu solicitud. Inténtalo de nuevo más tarde.';
        // this.errorMessage = displayMessage; // Si lo muestras en la tarjeta
        this.snackBar.open(displayMessage, 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        console.error('Error en forgot password:', err);
      }
    });
  }
}