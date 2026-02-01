import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SharePointConfigurationReadDto } from '../../models/sharepoint-configuration.model';

@Component({
  selector: 'app-sharepoint-config-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './sharepoint-config-form.component.html',
  styleUrls: ['./sharepoint-config-form.component.css']
})
export class SharePointConfigFormComponent implements OnInit {
  configForm: FormGroup;
  isEditMode: boolean = false;
  hideClientSecret = true;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<SharePointConfigFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      config: SharePointConfigurationReadDto | null, 
      companyId: number 
    }
  ) {
    this.isEditMode = !!data.config;
    
    this.configForm = this.fb.group({
      tenantId: [
        data.config?.tenantId || '', 
        [Validators.required, Validators.maxLength(50)]
      ],
      clientId: [
        data.config?.clientId || '', 
        [Validators.required, Validators.maxLength(50)]
      ],
      clientSecret: [
        '', 
        this.isEditMode ? [Validators.maxLength(500)] : [Validators.required, Validators.maxLength(500)]
      ],
      siteId: [
        data.config?.siteId || '', 
        [Validators.required, Validators.maxLength(300)]
      ],
      folder: [
        data.config?.folder || '', 
        [Validators.required, Validators.maxLength(200)]
      ]
    });
  }

  ngOnInit(): void {
    if (this.isEditMode) {
      console.log('[SharePointConfigForm] Edit mode - existing configuration:', this.data.config);
    } else {
      console.log('[SharePointConfigForm] Create mode for company:', this.data.companyId);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.configForm.valid) {
      const formValue = this.configForm.value;
      
      // Si estamos en modo edición y no se proporcionó nuevo secret, no lo enviamos
      if (this.isEditMode && !formValue.clientSecret) {
        delete formValue.clientSecret;
      }
      
      this.dialogRef.close({
        success: true,
        data: formValue,
        isEdit: this.isEditMode
      });
    } else {
      // Marcar todos los campos como tocados para mostrar errores
      Object.keys(this.configForm.controls).forEach(key => {
        this.configForm.get(key)?.markAsTouched();
      });
    }
  }

  // Helper para mostrar errores
  getErrorMessage(fieldName: string): string {
    const control = this.configForm.get(fieldName);
    if (control?.hasError('required')) {
      return 'Este campo es obligatorio';
    }
    if (control?.hasError('maxlength')) {
      const maxLength = control.errors?.['maxlength'].requiredLength;
      return `Máximo ${maxLength} caracteres`;
    }
    return '';
  }
}
