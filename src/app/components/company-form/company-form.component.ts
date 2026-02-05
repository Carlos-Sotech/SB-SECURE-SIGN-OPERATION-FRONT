// src/app/admin/company-form/company-form.component.ts

import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Material Imports
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon'; // Para el botón de cierre

// Tus Servicios y Modelos
import { Company } from '../../models/company.model'; // Asegúrate que este modelo esté actualizado
import { CompanyService } from '../../services/company.service';
// No necesitas MatCardActions ni MaterialModule aquí

@Component({
  selector: 'app-company-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule, // Añadido para el botón de cierre
  ],
  templateUrl: './company-form.component.html',
  styleUrls: ['./company-form.component.css']
})
export class CompanyFormComponent implements OnInit {
  companyForm!: FormGroup;
  isLoading = false;
  isEditMode = false;
  dialogTitle = 'Nueva Empresa';
  currentCompanyId: number | null = null;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CompanyFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Company | null,
    private companyService: CompanyService
  ) {
    console.log('CompanyFormComponent CONSTRUCTOR: Datos recibidos (this.data):', this.data);
    if (this.data && this.data.id) {
      this.isEditMode = true;
      this.dialogTitle = `Editar Empresa`;
      this.currentCompanyId = this.data.id;
    } else {
      this.isEditMode = false;
      this.dialogTitle = 'Nueva Empresa';
    }
  }

  ngOnInit(): void {
    // Inicializar el formulario con los datos recibidos (si existen) o con valores por defecto
     console.log('CompanyFormComponent ngOnInit: Datos disponibles (this.data):', this.data);
    this.companyForm = this.fb.group({
      name: [this.data?.name || '', [Validators.required, Validators.maxLength(150)]],
      taxId: [this.data?.taxId || null, [Validators.maxLength(20)]],
      addressLine1: [this.data?.addressLine1 || null, [Validators.maxLength(255)]],
      city: [this.data?.city || null, [Validators.maxLength(100)]],
      stateOrProvince: [this.data?.stateOrProvince || null, [Validators.maxLength(100)]],
      phoneNumber: [this.data?.phoneNumber || null, [Validators.maxLength(20)]],
      email: [this.data?.email || null, [Validators.email, Validators.maxLength(150)]],
      numberOfAgents: [this.data?.numberOfAgents ?? 0, [Validators.required, Validators.min(0)]],
      maxMonthlyOperations: [this.data?.maxMonthlyOperations ?? 0, [Validators.required, Validators.min(0)]]
    });
    console.log('CompanyFormComponent ngOnInit: Valores iniciales del formulario:', this.companyForm.value);
    if (this.isEditMode && this.data?.name) {
      this.dialogTitle = `Editar Empresa: ${this.data.name}`;
    }
  }

  get fc() {
    return this.companyForm.controls;
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSave(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    if (this.isEditMode && this.currentCompanyId !== null) {
      // --- LÓGICA DE ACTUALIZACIÓN CORREGIDA ---
      // Combinar los datos originales con los del formulario para no perder 'createdAt'
      const updatedCompanyData: Company = {
        ...this.data!, // Empezar con los datos originales (incluye id y createdAt)
        ...this.companyForm.value // Sobrescribir con los valores actualizados del formulario
      };

      this.companyService.updateCompany(this.currentCompanyId, updatedCompanyData).subscribe({
        next: () => {
          this.isLoading = false;
          this.dialogRef.close(true); // Éxito
        },
        error: (err) => {
          this.isLoading = false;
          const errorMessage = err.error?.message || 'Error al actualizar empresa.';
          console.error(errorMessage, err);
          // Opcional: mostrar error en un snackbar
        }
      });
    } else {
      // --- LÓGICA DE CREACIÓN ---
      // El payload solo necesita los campos del formulario, la API se encarga de 'id' y 'createdAt'
      const newCompanyPayload = this.companyForm.value;

      this.companyService.createCompany(newCompanyPayload).subscribe({
        next: () => {
          this.isLoading = false;
          this.dialogRef.close(true); // Éxito
        },
        error: (err) => {
          this.isLoading = false;
          const errorMessage = err.error?.message || 'Error al crear empresa.';
          console.error(errorMessage, err);
          // Opcional: mostrar error en un snackbar
        }
      });
    }
  }
}