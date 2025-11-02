// src/app/components/register/register.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest, map, startWith, tap } from 'rxjs'; // Importar combineLatest, map, startWith, tap

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';

// Tus Servicios y Modelos
import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../../services/layout.service';
import { Company } from '../../models/company.model';
import { CompanyService } from '../../services/company.service';
import { UserCreateDto } from '../../models/user-create.dto';
import { Role } from '../../models/role.enum';
import { UserReadDto } from '../../models/user-read.dto';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatSelectModule, MatCheckboxModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatIconModule,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['../auth-pages.css'] // Ajusta esta ruta si es necesario
})
export class RegisterComponent implements OnInit, OnDestroy {
  registerForm!: FormGroup;
  isLoading = false;
  companies: Company[] = [];
  isLoadingCompanies = false;

  availableRoles: { value: Role, viewValue: string }[] = [];
  loggedInUser: UserReadDto | null = null;
  isPrivilegedRegistering = false;
  canOnlyCreateUserRole = false;

  public Role = Role;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private companyService: CompanyService,
    private layoutService: LayoutService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.layoutService.setShowNavbar(false);

    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(5)]],
      email: ['', [Validators.required, Validators.email]],
      role: [null, Validators.required],
      companyId: [null],
    });

    // Combinar observables de currentUser y queryParams para asegurar que ambos (o sus valores iniciales)
    // estén disponibles antes de configurar el contexto.
    const currentUser$ = this.authService.currentUser.pipe(startWith(null)); // Emitir null inicialmente
    const queryParams$ = this.route.queryParamMap.pipe(startWith(null)); // Emitir null inicialmente

    this.subscriptions.add(
      combineLatest([currentUser$, queryParams$]).subscribe(
        ([user, params]) => {
          this.loggedInUser = user; // Puede ser null si no hay usuario logueado

          if (params) { // params no será null debido a startWith(null), pero su contenido sí
            const isAdminAction = params.get('adminAction') === 'true';
            const isSuperUserAction = params.get('superUserAction') === 'true';
            this.isPrivilegedRegistering = isAdminAction || isSuperUserAction;
          } else {
            // Caso inicial donde params es null de startWith(null), asumir no privilegiado
            this.isPrivilegedRegistering = false;
          }
          
          // Siempre llamar a setupRegistrationContext, ya que ahora tenemos ambos valores (o sus nulos iniciales)
          // setupRegistrationContext manejará internamente si loggedInUser es null.
          if (this.registerForm) {
             this.setupRegistrationContext();
          }
        }
      )
    );

    this.loadCompanies();
    this.subscriptions.add(
      this.registerForm.get('role')!.valueChanges.subscribe(() => {
        this.onRoleChange();
      })
    );
  }

  setupRegistrationContext(): void {
    if (!this.registerForm) {
      console.log('[SetupContext] Form not ready, returning.');
      return;
    }

    // Si es una acción privilegiada y loggedInUser aún no está disponible (es null),
    // no podemos configurar correctamente. Podríamos mostrar un estado de "cargando" o simplemente esperar.
    // Con combineLatest y startWith(null), this.loggedInUser ya tendrá un valor (o null).
    if (this.isPrivilegedRegistering && !this.loggedInUser) {
      console.log('[SetupContext] Privileged action, but loggedInUser is null. UI might be waiting or show defaults for public.');
      // Aquí, si es privilegiado y no hay usuario, es un estado inválido para proceder con lógica privilegiada.
      // Podríamos deshabilitar el form o mostrar un mensaje, pero el flujo de login debería prevenir esto.
      // Por ahora, si no hay loggedInUser, se comportará como registro público.
    }
    
    console.log('[SetupContext] Running with loggedInUser:', this.loggedInUser, 'isPrivileged:', this.isPrivilegedRegistering);


    let defaultRoleToSet: Role = Role.Usuario;
    let defaultCompanyId: number | null = null;
    let disableFormCompletely = false;

    if (this.isPrivilegedRegistering && this.loggedInUser) { // Solo si es privilegiado Y tenemos usuario
      if (this.loggedInUser.role === Role.Administrador) {
        this.availableRoles = Object.values(Role).map(r => ({ value: r, viewValue: r.toString() }));
        defaultRoleToSet = Role.Usuario;
        this.canOnlyCreateUserRole = false;
      } else if (this.loggedInUser.role === Role.Superusuario) {
        this.availableRoles = [{ value: Role.Usuario, viewValue: Role.Usuario.toString() }];
        defaultRoleToSet = Role.Usuario;
        this.canOnlyCreateUserRole = true;
        defaultCompanyId = this.loggedInUser.companyId || null;
        if (!defaultCompanyId) {
            console.error("Superusuario NO TIENE EMPRESA ASIGNADA. No puede crear usuarios.");
            this.snackBar.open("Error: No tienes una empresa asignada. Contacta al administrador.", "Cerrar", { duration: 0, panelClass: ['error-snackbar']});
            disableFormCompletely = true;
        }
      } else {
        // Es privilegiado por queryParam, pero el rol del usuario logueado no es Admin/Super.
        // Esto indica un posible acceso incorrecto o un estado inconsistente.
        // Tratar como registro público por seguridad.
        console.warn('[SetupContext] Privileged action indicated, but loggedInUser role is not Admin/Super. Defaulting to public registration.');
        this.isPrivilegedRegistering = false; // Corregir estado
        this.setupAvailableRolesForPublicRegistration(); // Configurar para público
        defaultRoleToSet = Role.Usuario;
      }
    } else {
      // Auto-registro público (isPrivilegedRegistering es false O loggedInUser es null)
      this.isPrivilegedRegistering = false; // Asegurar
      this.setupAvailableRolesForPublicRegistration();
      defaultRoleToSet = Role.Usuario;
    }

    if (disableFormCompletely) {
        if(!this.registerForm.disabled) this.registerForm.disable();
    } else {
        if(this.registerForm.disabled) this.registerForm.enable();
    }


    const currentRoleValue = this.registerForm.get('role')?.value;
    const currentCompanyIdValue = this.registerForm.get('companyId')?.value;
    let patchData: any = {};

    // Establecer el rol si es diferente del actual o si es la primera vez (null)
    if (currentRoleValue !== defaultRoleToSet || currentRoleValue === null) {
      patchData.role = defaultRoleToSet;
    }

    // Si es Superusuario, companyId se toma de él.
    // Si es Admin, companyId se deja para que el admin lo seleccione si el rol del nuevo usuario lo requiere.
    if (this.loggedInUser?.role === Role.Superusuario && defaultCompanyId !== null) {
      if (currentCompanyIdValue !== defaultCompanyId) {
        patchData.companyId = defaultCompanyId;
      }
    } else if (this.loggedInUser?.role !== Role.Superusuario && this.registerForm.get('companyId')?.enabled) {
      // Si no es Superusuario (ej. Admin o público), y el campo de empresa está habilitado (no fijado),
      // no pre-llenamos companyId aquí, se manejará por la selección del usuario.
      // Pero si el rol del nuevo usuario no requiere empresa (ej. Admin), se setea a null.
      const roleBeingSet = patchData.role || currentRoleValue;
      if (roleBeingSet === Role.Administrador && currentCompanyIdValue !== null) {
        patchData.companyId = null;
      }
    }


    if (Object.keys(patchData).length > 0) {
        this.registerForm.patchValue(patchData, { emitEvent: true }); // Permitir que valueChanges de rol se dispare
    } else {
        // Si no hubo patch (porque los valores ya eran los correctos),
        // pero necesitamos asegurar que los validadores de companyId se apliquen:
        this.onRoleChange();
    }
  }

  setupAvailableRolesForPublicRegistration(): void {
    this.availableRoles = [{ value: Role.Usuario, viewValue: Role.Usuario.toString() }];
    this.canOnlyCreateUserRole = true; // El público (o si falla la lógica privilegiada) solo crea Usuarios
  }

  ngOnDestroy(): void {
    this.layoutService.setShowNavbar(true);
    this.subscriptions.unsubscribe();
  }

  loadCompanies(): void {
    this.isLoadingCompanies = true;
    this.subscriptions.add(
      this.companyService.getCompanies().subscribe({
        next: (data) => {
          this.companies = data;
          this.isLoadingCompanies = false;
          // Si el form ya está configurado (ej. por superusuario con companyId fijado)
          // y las empresas se cargan después, es bueno re-evaluar para la UI.
          // Sin embargo, el valor del form ya debería estar correcto.
          // Esto es más para la visualización del nombre de la empresa si fuera necesario.
          if (this.registerForm.get('companyId')?.value && this.loggedInUser?.role === Role.Superusuario) {
            // No necesita acción aquí si el valor ya está fijado.
          }
        },
        error: (err) => {
          this.isLoadingCompanies = false;
          this.snackBar.open('Error al cargar empresas.', 'Cerrar', { duration: 3000 });
          console.error(err);
        }
      })
    );
  }

  onRoleChange(): void {
    if (!this.registerForm) return;
    const roleControlValue = this.registerForm.get('role')?.value;
    const companyControl = this.registerForm.get('companyId');

    if (!companyControl) return;

    // Si el que registra es Superusuario, la empresa ya está fijada, el campo se oculta en HTML.
    // El validador de 'required' aún aplica basado en el rol del *nuevo* usuario.
    if (roleControlValue === Role.Usuario || roleControlValue === Role.Superusuario) {
      companyControl.setValidators([Validators.required]);
      // Si el Superusuario está registrando, su companyId ya fue seteado en setupRegistrationContext
      // y el campo de selección de empresa estará oculto/deshabilitado.
      // Si es Admin registrando un Usuario/Superusuario, el Admin debe seleccionar una empresa.
    } else { // Rol del nuevo usuario es Administrador
      companyControl.clearValidators();
      // Si un Admin está creando otro Admin, la empresa no es requerida y se puede poner a null
      if (!(this.isPrivilegedRegistering && this.loggedInUser?.role === Role.Superusuario)) {
         companyControl.patchValue(null, { emitEvent: false });
      }
    }
    companyControl.updateValueAndValidity();
  }

  isCompanyRequired(): boolean {
    if (!this.registerForm) return false;
    const roleControlValue = this.registerForm.get('role')?.value;
    return roleControlValue === Role.Usuario || roleControlValue === Role.Superusuario;
  }

  getSuperUserCompanyName(): string | undefined {
    if (this.loggedInUser?.role === Role.Superusuario && this.loggedInUser.companyId) {
        const company = this.companies.find(c => c.id === this.loggedInUser?.companyId);
        return company?.name || this.loggedInUser.companyName || `ID: ${this.loggedInUser.companyId}`;
    }
    return undefined;
  }

  getCompanyById(companyId: number | null | undefined): Company | undefined {
    if (!companyId) return undefined;
    return this.companies.find(c => c.id === companyId);
  }

  get fc() {
    return this.registerForm ? this.registerForm.controls : {};
  }

  onSubmit(): void {
    if (!this.registerForm || this.registerForm.invalid) {
      if (this.registerForm) this.registerForm.markAllAsTouched();
      return;
    }
    if (this.isPrivilegedRegistering && this.loggedInUser?.role === Role.Superusuario && !this.loggedInUser.companyId) {
        this.snackBar.open("Error: No puedes crear usuarios sin tener una empresa asignada.", "Cerrar", { duration: 0, panelClass: ['error-snackbar']});
        return;
    }

    // Validar límite de agentes de la empresa
    const companyId = this.registerForm.get('companyId')?.value;
    if (companyId && this.isCompanyRequired()) {
      const selectedCompany = this.companies.find(c => c.id === companyId);
      if (selectedCompany) {
        // Verificar si la empresa ya tiene el máximo de usuarios permitidos
        this.subscriptions.add(
          this.authService.getUsersByCompany(companyId).subscribe({
            next: (users) => {
              if (users.length >= selectedCompany.numberOfAgents) {
                this.snackBar.open(
                  `No se puede crear más usuarios. La empresa "${selectedCompany.name}" ya tiene el máximo de ${selectedCompany.numberOfAgents} usuarios permitidos.`, 
                  'Cerrar', 
                  { duration: 7000, panelClass: ['error-snackbar'] }
                );
                return;
              }
              // Si no se ha alcanzado el límite, proceder con el registro
              this.proceedWithRegistration();
            },
            error: (err) => {
              console.error('Error al verificar usuarios de la empresa:', err);
              this.snackBar.open('Error al verificar el límite de usuarios de la empresa.', 'Cerrar', { duration: 5000, panelClass: ['error-snackbar'] });
            }
          })
        );
        return; // Salir aquí, el registro se completará en el callback
      }
    }

    // Si no hay empresa o no es requerida, proceder directamente
    this.proceedWithRegistration();
  }

  private proceedWithRegistration(): void {

    this.isLoading = true;
    const userDataFromForm: {username: string, email: string, role: Role, companyId?: number | null} = this.registerForm.value;
    let finalUserData: UserCreateDto;


    if (this.isPrivilegedRegistering && this.loggedInUser?.role === Role.Superusuario) {
      finalUserData = {
          username: userDataFromForm.username,
          email: userDataFromForm.email,
          role: Role.Usuario, // Forzar rol
          companyId: this.loggedInUser.companyId // Forzar empresa
      };
    } else {
      finalUserData = {
          username: userDataFromForm.username,
          email: userDataFromForm.email,
          role: userDataFromForm.role,
          companyId: (this.isCompanyRequired() && userDataFromForm.companyId) ? userDataFromForm.companyId : null,
          
        };
    }

    this.subscriptions.add(
      this.authService.registerUser(finalUserData).subscribe({
        next: (response) => {
          this.isLoading = false;
          let successMsg = `¡Usuario ${response.username} registrado! Se ha enviado un email a ${response.email} para establecer la contraseña.`;
          if (this.isPrivilegedRegistering && this.loggedInUser) {
            successMsg = `Usuario ${response.username} registrado por ${this.loggedInUser.role}. El usuario recibirá un email para establecer su contraseña.`;
          }
          this.snackBar.open(successMsg, 'Cerrar', { duration: 7000, panelClass: ['success-snackbar'] });

          let roleForReset = Role.Usuario;
          let companyForReset: number | null = null;

          if (this.isPrivilegedRegistering && this.loggedInUser) {
            if (this.loggedInUser.role === Role.Administrador) {
              roleForReset = Role.Usuario; // Admin puede seguir creando, default a Usuario
            } else if (this.loggedInUser.role === Role.Superusuario) {
              roleForReset = Role.Usuario; // Superusuario sigue fijado a Usuario
              companyForReset = this.loggedInUser.companyId || null; // Y a su empresa
            }
          }

          this.registerForm.reset({
            role: roleForReset,
            companyId: companyForReset,
            username: '',
            email: ''
          });
          this.onRoleChange(); // Re-evaluar validadores después del reset

         if(this.isPrivilegedRegistering && this.loggedInUser?.role === Role.Superusuario || this.loggedInUser?.role === Role.Administrador) {
          this.router.navigate(['/user-list']);
         }
        },
        error: (err) => {
          this.isLoading = false;
          const displayMessage = err.error?.message || err.message || 'Ocurrió un error durante el registro.';
          this.snackBar.open(displayMessage, 'Cerrar', { duration: 5000, panelClass: ['error-snackbar'] });
          console.error('Error en el registro:', err);
        }
      })
    );
  }

  onCancel(): void {
    // Navegar de vuelta a la lista de usuarios
    this.router.navigate(['/user-list']);
  }
}