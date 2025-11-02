import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, ValidatorFn } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';

import { PartyService } from '../../services/party.service';
import { PartyCreateDto, PartyReadDto } from '../../models/party.model';

// Validador personalizado para asegurar que el prefix comience con '+'
function prefixValidator(): ValidatorFn {
  return (control: AbstractControl): {[key: string]: any} | null => {
    const value = control.value;
    if (!value) {
      return null; // Dejar que el validador required maneje esto
    }
    
    if (typeof value === 'string' && !value.startsWith('+')) {
      return { 'prefixFormat': { value: control.value } };
    }
    
    return null;
  };
}

// Validador personalizado para asegurar que el teléfono solo contenga números
function phoneNumberValidator(): ValidatorFn {
  return (control: AbstractControl): {[key: string]: any} | null => {
    const value = control.value;
    if (!value) {
      return null; // Dejar que el validador required maneje esto
    }
    
    // Solo permitir dígitos (0-9)
    const phoneRegex = /^[0-9]+$/;
    if (!phoneRegex.test(value)) {
      return { 'phoneNumberFormat': { value: control.value } };
    }
    
    return null;
  };
}

@Component({
  selector: 'app-party-form',
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
    MatProgressSpinnerModule,
    MatCardModule,
    MatChipsModule
  ],
  templateUrl: './party-form.component.html',
  styleUrls: ['./party-form.component.css']
})
export class PartyFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private partyService = inject(PartyService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<PartyFormComponent>);
  private data = inject<{ 
    operationId: number, 
    partyToEdit?: PartyReadDto, 
    pdfSrc?: string, 
    operationFilePDF?: string, 
    parentDialogRef?: any,
    operationData?: any, // Agregar datos completos de la operación
    updateSignal?: WritableSignal<{type: 'created' | 'updated' | 'deleted', partyId?: number} | null>
  }>(MAT_DIALOG_DATA);
  private router = inject(Router);

  partyForm: FormGroup;
  isSubmitting = false;
  isEditMode = false;

  constructor(private dialog: MatDialog) {
    this.partyForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', [Validators.required, Validators.minLength(1)]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, phoneNumberValidator()]],
      prefix: ['+34', [Validators.required, prefixValidator()]],
      required: [false],
      voice: [false],
      photo: [false],
      fingerPrint: [false],
      partyTexts: this.fb.array([this.fb.group({ text: ['', Validators.required] })])
    });
  }

  ngOnInit(): void {
    if (this.data?.partyToEdit) {
      this.isEditMode = true;
      this.partyForm.patchValue({
        firstName: this.data.partyToEdit.firstName,
        lastName: this.data.partyToEdit.lastName,
        email: this.data.partyToEdit.email,
        phoneNumber: this.data.partyToEdit.phoneNumber,
        prefix: this.data.partyToEdit.prefix || '+34',
        required: this.data.partyToEdit.required,
        voice: this.data.partyToEdit.voice || false,
        photo: this.data.partyToEdit.photo || false,
        fingerPrint: this.data.partyToEdit.fingerPrint || false
      });

      // Clear existing party texts and add the ones from the party to edit
      const partyTextsArray = this.partyForm.get('partyTexts') as FormArray;
      partyTextsArray.clear();
      
      if (this.data.partyToEdit.partyTexts && this.data.partyToEdit.partyTexts.length > 0) {
        this.data.partyToEdit.partyTexts.forEach((pt, index) => {
          // El primer party text es obligatorio, los demás son opcionales
          const validators = index === 0 ? [Validators.required] : [];
          partyTextsArray.push(this.fb.group({ text: [pt.text, validators] }));
        });
      } else {
        // Si no hay party texts, crear uno obligatorio
        partyTextsArray.push(this.fb.group({ text: ['', Validators.required] }));
      }
    }
  }

  get partyTextsArray(): FormArray {
    return this.partyForm.get('partyTexts') as FormArray;
  }

  addPartyText(): void {
    // Los party texts adicionales no son obligatorios
    this.partyTextsArray.push(this.fb.group({ text: [''] }));
  }

  removePartyText(index: number): void {
    if (this.partyTextsArray.length > 1) {
      this.partyTextsArray.removeAt(index);
      
      // Si se eliminó el primer party text, hacer obligatorio el nuevo primer elemento
      if (index === 0 && this.partyTextsArray.length > 0) {
        const firstControl = this.partyTextsArray.at(0).get('text');
        if (firstControl) {
          firstControl.setValidators([Validators.required]);
          firstControl.updateValueAndValidity();
        }
      }
    }
  }

  onSubmit(): void {
    // Marcar todos los campos como touched para mostrar errores de validación
    this.markFormGroupTouched(this.partyForm);
    
    if (this.partyForm.valid) {
      this.isSubmitting = true;
      const formValue = this.partyForm.value;

      const partyData: PartyCreateDto = {
        idOperation: this.data.operationId,
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email,
        phoneNumber: formValue.phoneNumber,
        prefix: formValue.prefix,
        required: formValue.required,
        voice: formValue.voice,
        photo: formValue.photo,
        fingerPrint: formValue.fingerPrint,
        partyTexts: formValue.partyTexts.map((pt: any) => ({ text: pt.text }))
      };

      if (this.isEditMode && this.data?.partyToEdit) {
        // Update party - mantener las coordenadas existentes
        const updatePartyData = {
          ...partyData,
          x: this.data.partyToEdit.x,
          y: this.data.partyToEdit.y,
          width: this.data.partyToEdit.width,
          height: this.data.partyToEdit.height,
          page: this.data.partyToEdit.page
        };

        // Guardar información del modal para volver atrás (sin parentDialogRef para evitar estructura circular)
        sessionStorage.setItem('returnToModal', 'true');
        
        // Crear una estructura completa del modal data para volver al operation-form
        // Usar los datos de operación pasados desde el modal padre
        // Estos datos ya incluyen los valores actuales del formulario
        const operationData = this.data.operationData;
        
        if (!operationData) {
          console.error('No operation data available for edit');
          return;
        }
        
        // Los datos ya están completos y actualizados desde el formulario padre
        const completeOperationData = {
          id: operationData.id,
          minutesAlive: operationData.minutesAlive,
          status: operationData.status,
          userId: operationData.userId,
          userName: operationData.userName,
          operationType: operationData.operationType,
          filePDF: operationData.filePDF,
          readingAllPages: operationData.readingAllPages,
          isNecessaryConfirmReading: operationData.isNecessaryConfirmReading,
          readingText: operationData.readingText,
          createdAt: operationData.createdAt,
          updatedAt: operationData.updatedAt,
          descripcionOperacion: operationData.descripcionOperacion
        };
        
        const modalDataToSave = {
          type: 'operation-form',
          config: {
            data: { 
              operation: completeOperationData,
              isEdit: true  // ✅ Agregar el flag isEdit
            }
          }
        };
        
        console.log('🔍 === PARTY FORM EDIT SAVING MODAL DATA ===');
        console.log('🔍 Original operationData:', this.data.operationData);
        console.log('🔍 Complete operation data:', completeOperationData);
        console.log('🔍 Modal data to save:', modalDataToSave);
        console.log('🔍 isEdit value being saved:', modalDataToSave.config.data.isEdit);
        
        sessionStorage.setItem('modalData', JSON.stringify(modalDataToSave));
        
        this.partyService.updateParty(this.data.partyToEdit.id, updatePartyData).subscribe({
          next: () => {
            this.isSubmitting = false;
            this.snackBar.open('Firmante actualizado exitosamente.', 'OK', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            
            // Cerrar este modal primero
            this.dialogRef.close('saved');
            
            // El parent se encargará de reabrir el modal de operación
          },
          error: (err) => {
            this.isSubmitting = false;
            this.snackBar.open(err.message || 'Error al actualizar firmante.', 'Cerrar', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
            console.error('Error updating party:', err);
          }
        });
      } else {
        // Create new party
        console.log('Creating party with data:', partyData);
        this.partyService.createParty(partyData).subscribe({
          next: (createdParty) => {
            console.log('Party created successfully:', createdParty);
            this.isSubmitting = false;
            this.snackBar.open('Firmante creado exitosamente.', 'OK', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            
            // Cerrar este modal primero
            this.dialogRef.close('saved');
            
            // Navegar automáticamente a la signature page para el party recién creado
            setTimeout(() => {
              // Guardar información del modal para volver atrás
              sessionStorage.setItem('returnToModal', 'true');
              
              // Usar los datos de operación pasados desde el modal padre
              // Estos datos ya incluyen los valores actuales del formulario
              const operationData = this.data.operationData;
              
              if (!operationData) {
                console.error('No operation data available');
                return;
              }
              
              // Los datos ya están completos y actualizados desde el formulario padre
              const completeOperationData = {
                id: operationData.id,
                minutesAlive: operationData.minutesAlive,
                status: operationData.status,
                userId: operationData.userId,
                userName: operationData.userName,
                operationType: operationData.operationType,
                filePDF: operationData.filePDF,
                readingAllPages: operationData.readingAllPages,
                isNecessaryConfirmReading: operationData.isNecessaryConfirmReading,
                readingText: operationData.readingText,
                createdAt: operationData.createdAt,
                updatedAt: operationData.updatedAt,
                descripcionOperacion: operationData.descripcionOperacion
              };
              
              const modalDataToSave = {
                type: 'operation-form',
                config: {
                  data: { 
                    operation: completeOperationData,
                    isEdit: true
                  }
                }
              };
              
              sessionStorage.setItem('modalData', JSON.stringify(modalDataToSave));
              
              // Navegar a la página de firma
              console.log('Navigating to signature page with operationId:', this.data.operationId, 'and partyId:', createdParty.id);
              
              // Guardar el origen en sessionStorage
              const currentUrl = this.router.url;
              let origin = 'operation-list'; // Default origin
              
              if (currentUrl.includes('/user-list')) {
                origin = 'user-list';
              } else if (currentUrl.includes('/operation-list')) {
                origin = 'operation-list';
              }
              
              // Guardar el origen para que SignaturePageComponent sepa de dónde viene
              sessionStorage.setItem('signatureOrigin', origin);
              
                           // Navegar a la página de firma
             const url = `/signature/${this.data.operationId}?partyId=${createdParty.id}`;
             console.log('Navigation URL:', url);
             
             // Cerrar ambos modales antes de navegar para evitar superposición
             this.dialogRef.close();
             
             // Navegar a la página de firma
             this.router.navigateByUrl(url);
            
            }, 100);
          },
          error: (err) => {
            this.isSubmitting = false;
            this.snackBar.open(err.message || 'Error al crear firmante.', 'Cerrar', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
            console.error('Error creating party:', err);
          }
        });
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  // Método para marcar todos los campos del formulario como touched
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach((arrayControl: any) => {
          if (arrayControl instanceof FormGroup) {
            this.markFormGroupTouched(arrayControl);
          } else {
            arrayControl.markAsTouched();
          }
        });
      } else {
        control?.markAsTouched();
      }
    });
  }

  // Método para filtrar solo números en el campo de teléfono
  onPhoneNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    // Filtrar solo dígitos
    const filteredValue = value.replace(/[^0-9]/g, '');
    
    // Actualizar el valor del input si es diferente
    if (value !== filteredValue) {
      input.value = filteredValue;
      this.partyForm.get('phoneNumber')?.setValue(filteredValue);
    }
  }
} 