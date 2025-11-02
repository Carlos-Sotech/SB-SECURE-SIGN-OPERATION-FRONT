import { Component, inject, OnInit, Optional, Inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AgreementService } from '../../services/agreement.service';
import { AgreementCreateDto, AgreementReadDto } from '../../models/agreement.model';

@Component({
  selector: 'app-agreement-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './agreement-form.component.html',
  styleUrls: ['./agreement-form.component.css']
})
export class AgreementFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private agreementService = inject(AgreementService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<AgreementFormComponent>);
  private data = inject<{ 
    operationId: number, 
    agreementToEdit?: AgreementReadDto,
    parentDialogRef?: any,
    updateSignal?: WritableSignal<{type: 'created' | 'updated' | 'deleted', agreementId?: number} | null>
  }>(MAT_DIALOG_DATA);

  agreementForm: FormGroup;
  isSubmitting = false;
  isEditMode = false;

  constructor() {
    this.agreementForm = this.fb.group({
      text: ['', Validators.required],
      accepted: [false]
    });
  }

  ngOnInit(): void {
    if (this.data?.agreementToEdit) {
      this.isEditMode = true;
      this.agreementForm.patchValue({
        text: this.data.agreementToEdit.text,
        accepted: this.data.agreementToEdit.accepted
      });
    }
  }

  onSubmit(): void {
    console.log('🔍 AgreementFormComponent onSubmit called');
    if (this.agreementForm.valid) {
      this.isSubmitting = true;
      const formValue = this.agreementForm.value;

      const agreementData: AgreementCreateDto = {
        idOperation: this.data.operationId,
        text: formValue.text,
        accepted: formValue.accepted
      };

      if (this.isEditMode && this.data?.agreementToEdit) {
        console.log('🔍 Updating agreement:', this.data.agreementToEdit.id);
        // Update agreement
        this.agreementService.updateAgreement(this.data.agreementToEdit.id, agreementData).subscribe({
          next: () => {
            console.log('🔍 Agreement updated successfully');
            this.isSubmitting = false;
            this.snackBar.open('Acuerdo actualizado exitosamente.', 'OK', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            this.dialogRef.close('saved');
          },
          error: (err) => {
            console.log('🔍 Error updating agreement:', err);
            this.isSubmitting = false;
            this.snackBar.open(err.message || 'Error al actualizar acuerdo.', 'Cerrar', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
            console.error('Error updating agreement:', err);
          }
        });
      } else {
        console.log('🔍 Creating new agreement');
        // Create new agreement
        this.agreementService.createAgreement(agreementData).subscribe({
          next: (response) => {
            console.log('🔍 Agreement created successfully');
            this.isSubmitting = false;
            this.snackBar.open('Acuerdo creado exitosamente.', 'OK', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            this.dialogRef.close('saved')
          },
          error: (err) => {
            console.log('🔍 Error creating agreement:', err);
            this.isSubmitting = false;
            this.snackBar.open(err.message || 'Error al crear acuerdo.', 'Cerrar', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
            console.error('Error creating agreement:', err);
          }
        });
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
} 