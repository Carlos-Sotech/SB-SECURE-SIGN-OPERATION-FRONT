import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { CompanyService } from '../../services/company.service';
import { OperationService } from '../../services/operation.service';
import { UserReadDto } from '../../models/user-read.dto';
import { CompanyReadDto } from '../../models/company-read.dto';
import { Role } from '../../models/role.enum';

export interface UserEditDialogData {
  user: UserReadDto;
  canEditCompany: boolean;
  currentUser?: UserReadDto;
}

@Component({
  selector: 'app-user-edit-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions
  ],
  template: `
    <div class="user-edit-dialog">
      <h2 mat-dialog-title>Editar Usuario</h2>
      
      <mat-dialog-content>
        <form [formGroup]="userForm" class="user-form">
          <!-- Nombre de usuario -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Nombre de usuario</mat-label>
            <input matInput formControlName="username" placeholder="Ingrese el nombre de usuario">
            <mat-error *ngIf="userForm.get('username')?.hasError('required')">
              El nombre de usuario es requerido
            </mat-error>
            <mat-error *ngIf="userForm.get('username')?.hasError('minlength')">
              El nombre debe tener al menos 3 caracteres
            </mat-error>
          </mat-form-field>

          <!-- Email -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" placeholder="Ingrese el email">
            <mat-error *ngIf="userForm.get('email')?.hasError('required')">
              El email es requerido
            </mat-error>
            <mat-error *ngIf="userForm.get('email')?.hasError('email')">
              Ingrese un email válido
            </mat-error>
          </mat-form-field>

          <!-- Rol -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Rol</mat-label>
            <mat-select formControlName="role" [disabled]="isAdminUser">
              <mat-option *ngFor="let role of availableRoles" [value]="role">
                {{ role }}
              </mat-option>
            </mat-select>
            <mat-error *ngIf="userForm.get('role')?.hasError('required')">
              El rol es requerido
            </mat-error>
            <mat-hint *ngIf="isAdminUser">No se puede cambiar el rol de un administrador</mat-hint>
          </mat-form-field>

          <!-- Empresa (solo si se puede editar) -->
          <mat-form-field appearance="outline" class="full-width" *ngIf="canEditCompany">
            <mat-label>Empresa</mat-label>
            <mat-select formControlName="companyId" [disabled]="isAdminUser">
              <mat-option *ngFor="let company of companies" [value]="company.id">
                {{ company.name }}
              </mat-option>
            </mat-select>
            <mat-error *ngIf="userForm.get('companyId')?.hasError('required')">
              La empresa es requerida
            </mat-error>
            <mat-hint *ngIf="isAdminUser">No se puede cambiar la empresa de un administrador</mat-hint>
          </mat-form-field>

          <!-- Información de empresa (solo lectura si no se puede editar) -->
          <mat-form-field appearance="outline" class="full-width" *ngIf="!canEditCompany && data.user.companyName">
            <mat-label>Empresa actual</mat-label>
            <input matInput [value]="data.user.companyName" readonly>
            <mat-hint>{{ getCompanyHint() }}</mat-hint>
          </mat-form-field>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancelar</button>
        <button mat-button color="primary" (click)="onResetPassword()" 
                [disabled]="isLoading">
          Restablecer Contraseña
        </button>
        <button mat-raised-button color="primary" (click)="onSave()" 
                [disabled]="userForm.invalid || isLoading">
          Guardar
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .user-edit-dialog {
      padding: 0;
      min-width: 500px;
    }
    
    h2 {
      margin: 0 0 16px 0;
      color: #1976d2;
    }
    
    .user-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: 16px 0;
    }
    
    .full-width {
      width: 100%;
    }
    
    mat-dialog-actions {
      margin: 16px 0 0 0;
      gap: 8px;
    }
    
    .mat-mdc-form-field {
      margin-bottom: 8px;
    }
  `]
})
export class UserEditFormComponent implements OnInit {
  userForm!: FormGroup;
  companies: CompanyReadDto[] = [];
  isLoading = false;
  canEditCompany = false;
  isAdminUser = false;
  availableRoles: string[] = [];

  constructor(
    public dialogRef: MatDialogRef<UserEditFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserEditDialogData,
    private fb: FormBuilder,
    private authService: AuthService,
    private companyService: CompanyService,
    private operationService: OperationService,
    private snackBar: MatSnackBar
  ) {
    this.canEditCompany = data.canEditCompany;
  }

  ngOnInit(): void {
    // Debug logs para verificar los datos
    console.log('🔍 [USER EDIT] ngOnInit - data.currentUser:', this.data.currentUser);
    console.log('🔍 [USER EDIT] ngOnInit - data.user:', this.data.user);
    console.log('🔍 [USER EDIT] ngOnInit - currentUser role:', this.data.currentUser?.role);
    console.log('🔍 [USER EDIT] ngOnInit - user role:', this.data.user.role);
    
    // Bloquear selector si el usuario actual es administrador Y el usuario a editar también es administrador
    this.isAdminUser = this.data.currentUser?.role === Role.Administrador && this.data.user.role === Role.Administrador;
    
    // Establecer opciones de rol disponibles
    // Solo se pueden crear administradores, no cambiar usuarios existentes a administradores
    this.availableRoles = ['Usuario', 'Superusuario'];
    
    console.log('🔍 [USER EDIT] ngOnInit - isAdminUser calculated:', this.isAdminUser);
    console.log('🔍 [USER EDIT] ngOnInit - availableRoles:', this.availableRoles);
    
    this.initializeForm();
    this.loadCompanies();
  }

  private initializeForm(): void {
    // Los administradores no necesitan empresa, otros roles sí
    const companyIdValidators = (this.canEditCompany && !this.isAdminUser) ? Validators.required : null;
    
    this.userForm = this.fb.group({
      username: [this.data.user.username, [Validators.required, Validators.minLength(3)]],
      email: [this.data.user.email, [Validators.required, Validators.email]],
      role: [this.data.user.role, Validators.required],
      companyId: [this.data.user.companyId || '', companyIdValidators]
    });
    
    // Deshabilitar controles si es necesario
    if (this.isAdminUser) {
      this.userForm.get('role')?.disable();
      this.userForm.get('companyId')?.disable();
      console.log('🔒 [USER EDIT] Controles deshabilitados para administrador');
    }
    
    // Debug logs
    console.log('🔍 [USER EDIT] Form initialized');
    console.log('🔍 [USER EDIT] User role:', this.data.user.role);
    console.log('🔍 [USER EDIT] Current user role:', this.data.currentUser?.role);
    console.log('🔍 [USER EDIT] isAdminUser (should block):', this.isAdminUser);
    console.log('🔍 [USER EDIT] canEditCompany:', this.canEditCompany);
    console.log('🔍 [USER EDIT] user.companyId:', this.data.user.companyId);
    console.log('🔍 [USER EDIT] companyIdValidators:', companyIdValidators);
    console.log('🔍 [USER EDIT] Form valid:', this.userForm.valid);
    console.log('🔍 [USER EDIT] Role control disabled:', this.userForm.get('role')?.disabled);
    console.log('🔍 [USER EDIT] Company control disabled:', this.userForm.get('companyId')?.disabled);
    console.log('🔍 [USER EDIT] Form errors:', this.userForm.errors);
    console.log('🔍 [USER EDIT] companyId errors:', this.userForm.get('companyId')?.errors);
  }

  private loadCompanies(): void {
    this.companyService.getCompanies().subscribe({
      next: (companies) => {
        this.companies = companies;
      },
      error: (err) => {
        console.error('Error al cargar empresas:', err);
        this.snackBar.open('Error al cargar las empresas', 'OK', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  onSave(): void {
    if (this.userForm.valid) {
      this.isLoading = true;
      const formData = this.userForm.getRawValue(); // Usar getRawValue() para incluir controles deshabilitados
      
      // Verificar si se está cambiando de empresa
      const isChangingCompany = formData.companyId && formData.companyId !== this.data.user.companyId;
      
      if (isChangingCompany) {
        // Validar que el usuario no tenga operaciones propias antes de cambiar de empresa
        this.operationService.getUserOperationsCountForCompanyChange(this.data.user.id).subscribe({
          next: (operationsCount) => {
            if (operationsCount > 0) {
              this.isLoading = false;
              this.snackBar.open(`No se puede cambiar de empresa porque el usuario tiene ${operationsCount} operaciones registradas.`, 'OK', {
                duration: 5000,
                panelClass: ['error-snackbar']
              });
              return;
            }
            
            // Si no tiene operaciones, validar límite de agentes de la empresa de destino
            const roleToSend = this.isAdminUser ? this.data.user.role : formData.role;
            this.validateCompanyAgentLimit(formData.companyId, formData.username, formData.email, roleToSend);
          },
          error: (err) => {
            this.isLoading = false;
            this.snackBar.open(`Error al validar las operaciones del usuario: ${err.message}`, 'OK', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        });
      } else {
        // Si no se está cambiando de empresa, preparar datos sin companyId
        const updateData: any = {
          username: formData.username,
          email: formData.email
          // No incluir companyId si no se está cambiando
        };
        
        // Solo incluir el rol si no se cumple la condición de bloqueo
        if (!this.isAdminUser) {
          updateData.role = formData.role;
        }
        
        this.performUserUpdate(updateData, formData.username);
      }
    }
  }

  private performUserUpdate(updateData: any, username: string): void {
    this.authService.updateUser(this.data.user.id, updateData).subscribe({
      next: (updatedUser) => {
        this.isLoading = false;
        this.snackBar.open(`Usuario "${username}" actualizado exitosamente`, 'OK', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        this.dialogRef.close({ success: true, user: updatedUser });
      },
      error: (err) => {
        this.isLoading = false;
        this.snackBar.open(`Error al actualizar el usuario: ${err.message}`, 'OK', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  onResetPassword(): void {
    console.log('🔄 [RESET PASSWORD] Iniciando restablecimiento de contraseña para usuario ID:', this.data.user.id);
    console.log('🔄 [RESET PASSWORD] Email del usuario:', this.data.user.email);
    this.isLoading = true;
    
    this.authService.resetUserPassword(this.data.user.id).subscribe({
      next: (response) => {
        console.log('✅ [RESET PASSWORD] Respuesta exitosa del backend:', response);
        this.isLoading = false;
        this.snackBar.open(`Se ha enviado un email de restablecimiento de contraseña a "${this.data.user.email}"`, 'OK', {
          duration: 5000,
          panelClass: ['success-snackbar']
        });
      },
      error: (err) => {
        console.error('❌ [RESET PASSWORD] Error en la llamada:', err);
        this.isLoading = false;
        this.snackBar.open(`Error al restablecer la contraseña: ${err.message}`, 'OK', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }

  getCompanyHint(): string {
    // Verificar si el que edita es un superusuario
    if (this.data.currentUser?.role === Role.Superusuario) {
      return 'Solo un administrador puede cambiar la empresa de un usuario';
    }
    return 'No se puede cambiar porque el usuario tiene operaciones registradas';
  }

  private validateCompanyAgentLimit(companyId: number, username: string, email: string, role: string): void {
    // Obtener información de la empresa de destino
    this.companyService.getCompany(companyId).subscribe({
      next: (company) => {
        // Obtener usuarios actuales de la empresa de destino
        this.authService.getUsersByCompany(companyId).subscribe({
          next: (users) => {
            // Contar usuarios actuales (excluyendo el usuario que se está moviendo)
            const currentUsersCount = users.filter(user => user.id !== this.data.user.id).length;
            
            // Verificar si agregar este usuario superaría el límite
            if (currentUsersCount >= company.numberOfAgents) {
              this.isLoading = false;
              this.snackBar.open(
                `No se puede cambiar de empresa. La empresa "${company.name}" ya tiene el máximo de ${company.numberOfAgents} agentes permitidos.`, 
                'OK', 
                {
                  duration: 5000,
                  panelClass: ['error-snackbar']
                }
              );
              return;
            }
            
            // Si no supera el límite, proceder con la actualización
            const updateData: any = {
              username: username,
              email: email
            };
            
            // Solo incluir companyId y rol si no se cumple la condición de bloqueo
            if (!this.isAdminUser) {
              updateData.companyId = companyId;
              updateData.role = role;
            }
            
            this.performUserUpdate(updateData, username);
          },
          error: (err) => {
            this.isLoading = false;
            this.snackBar.open(`Error al verificar usuarios de la empresa: ${err.message}`, 'OK', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        });
      },
      error: (err) => {
        this.isLoading = false;
        this.snackBar.open(`Error al obtener información de la empresa: ${err.message}`, 'OK', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }
}
