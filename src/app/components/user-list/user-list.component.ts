// src/app/admin/user-list/user-list.component.ts

import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit, ElementRef, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { filter } from 'rxjs/operators'; // Importar filter

// Angular Material
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';

// Servicios y Modelos
import { AuthService } from '../../services/auth.service';
import { OperationService } from '../../services/operation.service';
import { SignatureService } from '../../services/signature.service';
import { PartyService } from '../../services/party.service';
import { OperationSearchService } from '../../services/operation-search.service';
import { CompanyService } from '../../services/company.service';
import { SharePointConfigurationService } from '../../services/sharepoint-configuration.service';
import { UserReadDto } from '../../models/user-read.dto';
import { Role } from '../../models/role.enum';
import { OperationReadDto, OperationStatusEnum, OperationTypeEnum } from '../../models/operation.model';
import { PaginatedResultDto, OperationSearchDto } from '../../models/operation-search.dto';
import { Company } from '../../models/company.model';
import { SharePointConfigurationReadDto, IntegrationType } from '../../models/sharepoint-configuration.model';
import { CompanyOperationsUsageDto } from '../../models/company-read.dto';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Componentes de Diálogo
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { UserEditFormComponent } from '../user-edit-form/user-edit-form.component';
import { OperationFormComponent } from '../operation-form/operation-form.component';
import { OperationViewComponent } from '../operation-view/operation-view.component';
import { OperationSearchComponent } from '../operation-search/operations-filters-component';
import { LaunchOperationModalComponent } from '../launch-operation-modal/launch-operation-modal.component';
import { CompanyFormComponent } from '../company-form/company-form.component';
import { SharePointConfigFormComponent } from '../sharepoint-config-form/sharepoint-config-form.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    OperationSearchComponent,
    OperationViewComponent,
    OperationFormComponent,
    ConfirmDialogComponent,
    UserEditFormComponent,
    CommonModule, RouterLink, HttpClientModule,
    MatSidenavModule, MatToolbarModule, MatIconModule, MatButtonModule,
    MatListModule, MatDividerModule, MatCardModule, MatProgressSpinnerModule,
    MatTableModule, MatTooltipModule, MatSnackBarModule, MatDialogModule, MatChipsModule, MatTabsModule,
    // Slide toggle for auto-refresh
    // Note: MatSlideToggleModule added below
      MatPaginatorModule, MatProgressBarModule,
      MatSlideToggleModule
  ],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('drawer') drawer!: MatSidenav;
  private operationSearchService = inject(OperationSearchService);

  currentUser: UserReadDto | null = null;
  allUsersFromApi: UserReadDto[] = []; // Para guardar la lista original de la API
  displayedUsers: UserReadDto[] = [];  // Para mostrar en la tabla (filtrada o no)
  isLoadingUsers = false;
  usersError: string | null = null;
  
  // Propiedades para paginación de usuarios
  totalUsers = 0;
  usersPageSize = 25;
  usersPageIndex = 0;
  
  public Role = Role;
  public OperationTypeEnum = OperationTypeEnum;
  public OperationStatusEnum = OperationStatusEnum;

  // Propiedades para operaciones de empresa (superusuario)
  companyOperations: OperationReadDto[] = [];
  
  // Propiedades para búsqueda de operaciones
  currentSearch: OperationSearchDto = { query: '', page: 1, pageSize: 20, showExpired: true };
  searchResults: OperationReadDto[] = [];
  isSearching = false;
  
  // Propiedades para filtrar operaciones
  pendingOperations: OperationReadDto[] = [];
  nonPendingOperations: OperationReadDto[] = [];
  
  isLoadingOperations = false;
  operationsError: string | null = null;
  operationsPagination: PaginatedResultDto<OperationReadDto> | null = null;

  // Auto-refresh for operations (10s)
  operationsAutoRefreshEnabled = true;
  private autoRefreshSub: Subscription | null = null;
  private readonly OPERATIONS_AUTO_REFRESH_MS = 10000;

  // Variable para controlar qué pestaña está activa (0 = Usuarios, 1 = Operaciones)
  activeTabIndex = 0;

  // Propiedades para empresas
  companies: Company[] = [];
  displayedCompanies: Company[] = [];
  totalCompanies = 0;
  companiesPageSize = 10;
  companiesPageIndex = 0;
  isLoadingCompanies = false;
  companiesError: string | null = null;

  // Propiedades para integraciones
  integrations: IntegrationType[] = [];
  isLoadingIntegrations = false;
  integrationsError: string | null = null;
  sharepointConfig: SharePointConfigurationReadDto | null = null;
  
  // Propiedades para consumo de operaciones
  operationsUsage: CompanyOperationsUsageDto | null = null;
  isLoadingOperationsUsage = false;

  displayedColumns: string[] = ['username', 'email', 'role', 'companyName', 'createdAt', 'actions'];
  operationsDisplayedColumns: string[] = ['id', 'operationType', 'descripcionOperacion', 'status', 'user', 'minutesAlive', 'createdAt', 'actions'];
  companyDisplayedColumns: string[] = ['id', 'name', 'numberOfAgents', 'operationsUsage', 'createdAt', 'actions'];
  integrationsDisplayedColumns: string[] = ['icon', 'name', 'description', 'status', 'actions'];

  private subscriptions: Subscription = new Subscription();
 
  constructor(
    private authService: AuthService,
    private operationService: OperationService,
    private signatureService: SignatureService,
    private partyService: PartyService,
    private companyService: CompanyService,
    private sharePointConfigService: SharePointConfigurationService,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private router: Router,
    private dialog: MatDialog,
    private paginatorIntl: MatPaginatorIntl
  ) {
    // Personalizar las etiquetas del paginador
    this.paginatorIntl.itemsPerPageLabel = 'Elementos por página:';
    this.paginatorIntl.nextPageLabel = 'Siguiente página';
    this.paginatorIntl.previousPageLabel = 'Página anterior';
    this.paginatorIntl.firstPageLabel = 'Primera página';
    this.paginatorIntl.lastPageLabel = 'Última página';
    this.paginatorIntl.getRangeLabel = (page: number, pageSize: number, length: number) => {
      if (length === 0 || pageSize === 0) {
        return `0 de ${length}`;
      }
      length = Math.max(length, 0);
      const startIndex = page * pageSize;
      const endIndex = startIndex < length ?
        Math.min(startIndex + pageSize, length) :
        startIndex + pageSize;
      return `${startIndex + 1} - ${endIndex} de ${length}`;
    };
  }

  ngAfterViewInit(): void {
    // No longer needed for pagination
  }

  ngOnInit(): void {
    // Check sessionStorage for tab flag
    const showOperacionesTab = sessionStorage.getItem('showOperacionesTab');
    if (showOperacionesTab === 'true') {
      this.activeTabIndex = 1; // Set to Operaciones tab
      sessionStorage.removeItem('showOperacionesTab');
    }
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.currentUser = user;
        
        // Si es usuario normal, mostrar la página de usuarios y cargar solo sus operaciones
        if (user && user.role === Role.Usuario) {
          console.log('[UserListComponent] Usuario normal detectado, mostrando user-list con sus operaciones');
          this.loadUserOperations();
          // Iniciar auto-refresh por defecto
          if (this.operationsAutoRefreshEnabled) {
            this.startOperationsAutoRefresh();
          }
        }
        
        // Si el usuario cambia (ej. de null a logueado), recargar y refiltrar usuarios.
        // También es útil si los datos del currentUser (como companyId) se cargan asíncronamente.
        this.loadUsers();
        
        // Si es superusuario o administrador, cargar las operaciones normales de su empresa
        if ((user?.role === Role.Superusuario || user?.role === Role.Administrador) && user.companyId) {
          this.loadCompanyOperations();
          // Iniciar auto-refresh por defecto
          if (this.operationsAutoRefreshEnabled) {
            this.startOperationsAutoRefresh();
          }
        }

        // Si es administrador, cargar empresas
        if (user?.role === Role.Administrador) {
          this.loadCompanies();
        }
      })
    );
    // La carga inicial se hace a través de la suscripción a currentUser
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.stopOperationsAutoRefresh();
  }

  loadUsers(): void {
    this.isLoadingUsers = true;
    this.usersError = null;
    this.allUsersFromApi = [];
    this.displayedUsers = [];

    console.log('[UserListComponent] loadUsers llamado. CurrentUser:', this.currentUser);

    // API devuelve todos los usuarios (porque JWT está desactivado en backend para este endpoint)
    this.subscriptions.add(
      this.http.get<UserReadDto[]>(`${environment.apiUrl}/users`).subscribe({
        next: (data) => {
          this.allUsersFromApi = data;
          this.applyUserFilter(); // Aplicar filtro después de obtener los datos
          this.isLoadingUsers = false;
        },
        error: (err) => {
          console.error('Error al cargar usuarios:', err);
          this.usersError = 'No se pudieron cargar los usuarios. Intenta de nuevo más tarde.';
          this.snackBar.open(this.usersError, 'Cerrar', { duration: 5000, panelClass: ['error-snackbar'] });
          this.isLoadingUsers = false;
        }
      })
    );
  }

  applyUserFilter(): void {
    if (!this.currentUser) {
      console.log('[UserListComponent] No hay currentUser para filtrar, mostrando todos (o ninguno si allUsersFromApi está vacío).');
      const allUsers = [...this.allUsersFromApi];
      this.totalUsers = allUsers.length;
      this.displayedUsers = this.paginateUsers(allUsers);
      return;
    }

    let filteredUsers: UserReadDto[] = [];

    if (this.currentUser.role === Role.Administrador) {
      console.log('[UserListComponent] Usuario es Administrador, mostrando todos los usuarios.');
      filteredUsers = [...this.allUsersFromApi];
    } else if (this.currentUser.role === Role.Superusuario) {
      if (this.currentUser.companyId) {
        console.log(`[UserListComponent] Usuario es Superusuario (Empresa ID: ${this.currentUser.companyId}). Filtrando usuarios.`);
        filteredUsers = this.allUsersFromApi.filter(user =>
          user.companyId === this.currentUser?.companyId &&
          (user.role === Role.Usuario || user.role === Role.Superusuario)
        );
      } else {
        console.warn('[UserListComponent] Superusuario no tiene companyId. No se mostrarán usuarios.');
        this.snackBar.open('No tienes una empresa asignada para ver usuarios.', 'Cerrar', { duration: 7000, panelClass: ['error-snackbar']});
        filteredUsers = [];
      }
    } else {
      console.log(`[UserListComponent] Rol ${this.currentUser.role} no tiene permisos para ver esta lista.`);
      filteredUsers = [];
    }
    
    this.totalUsers = filteredUsers.length;
    this.displayedUsers = this.paginateUsers(filteredUsers);
    console.log('[UserListComponent] Usuarios a mostrar después del filtro:', this.displayedUsers);
  }

  paginateUsers(users: UserReadDto[]): UserReadDto[] {
    const startIndex = this.usersPageIndex * this.usersPageSize;
    const endIndex = startIndex + this.usersPageSize;
    return users.slice(startIndex, endIndex);
  }

  onUsersPageChange(event: PageEvent): void {
    this.usersPageSize = event.pageSize;
    this.usersPageIndex = event.pageIndex;
    this.applyUserFilter();
  }

  // --- Métodos para gestión de empresas ---
  loadCompanies(): void {
    if (this.currentUser?.role !== Role.Administrador) {
      return;
    }

    this.isLoadingCompanies = true;
    this.companiesError = null;

    this.subscriptions.add(
      this.companyService.getCompanies().subscribe({
        next: (companies) => {
          console.log('Datos de empresas recibidos en user-list:', companies);
          // Asegurar que los campos de operaciones existen con valores por defecto
          this.companies = companies.map(company => ({
            ...company,
            maxMonthlyOperations: company.maxMonthlyOperations ?? 0,
            currentMonthOperationsCount: company.currentMonthOperationsCount ?? 0,
            hasUnlimitedOperations: company.maxMonthlyOperations === 0 || company.hasUnlimitedOperations,
            hasReachedMonthlyLimit: company.hasReachedMonthlyLimit ?? false
          }));
          console.log('Empresas procesadas en user-list:', this.companies);
          this.totalCompanies = companies.length;
          this.updateDisplayedCompanies();
          this.isLoadingCompanies = false;
        },
        error: (error) => {
          console.error('[UserListComponent] Error al cargar empresas:', error);
          this.companiesError = 'Error al cargar las empresas. Por favor, intente de nuevo.';
          this.isLoadingCompanies = false;
          this.snackBar.open('Error al cargar empresas', 'Cerrar', { duration: 3000 });
        }
      })
    );
  }

  updateDisplayedCompanies(): void {
    const startIndex = this.companiesPageIndex * this.companiesPageSize;
    const endIndex = startIndex + this.companiesPageSize;
    this.displayedCompanies = this.companies.slice(startIndex, endIndex);
  }

  onCompaniesPageChange(event: PageEvent): void {
    this.companiesPageSize = event.pageSize;
    this.companiesPageIndex = event.pageIndex;
    this.updateDisplayedCompanies();
  }

  openCreateCompanyDialog(): void {
    const dialogRef = this.dialog.open(CompanyFormComponent, {
      width: '600px',
      data: null // null indica que es creación, no edición
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadCompanies(); // Recargar la lista después de crear
      }
    });
  }

  openEditCompanyDialog(company: Company): void {
    const dialogRef = this.dialog.open(CompanyFormComponent, {
      width: '600px',
      data: company // Pasar la empresa directamente, no dentro de un objeto
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadCompanies();
      }
    });
  }

  deleteCompany(company: Company): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirmar eliminación',
        message: `¿Está seguro de que desea eliminar la empresa "${company.name}"?`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.subscriptions.add(
          this.companyService.deleteCompany(company.id).subscribe({
            next: () => {
              this.snackBar.open('Empresa eliminada exitosamente', 'Cerrar', { 
                duration: 3000,
                panelClass: ['success-snackbar']
              });
              this.loadCompanies();
            },
            error: (error) => {
              console.error('[UserListComponent] Error al eliminar empresa:', error);
              
              let errorMessage = 'Error al eliminar la empresa';
              const errorCode = error.message;
              
              // Manejar códigos de error específicos
              if(errorCode.includes('COMP_001')) {
                  errorMessage = 'La empresa no existe o ya fue eliminada';
              } else if(errorCode.includes('COMP_004')) {
                  if (errorCode && errorCode.includes('users')) {
                    errorMessage = 'No se puede eliminar la empresa porque tiene usuarios asociados. Elimine o reasigne los usuarios primero.';
                  } else if (errorCode && errorCode.includes('operation')) {
                    errorMessage = 'No se puede eliminar la empresa porque tiene operaciones registradas.';
                  } else {
                    errorMessage = errorCode || 'No se puede eliminar la empresa. Verifique que no tenga usuarios u operaciones asociadas.';
                  }
              }
              else{
                errorMessage = `Error al eliminar la empresa: ${errorCode}`;
              }
              
              this.snackBar.open(errorMessage, 'Cerrar', { 
                duration: 5000,
                panelClass: ['error-snackbar']
              });
            }
          })
        );
      }
    });
  }

  // --- Métodos para el Sidenav ---
  navigateToCompanies(): void {
    this.router.navigate(['/company-list']);
    if(this.drawer) this.drawer.close();
  }

  navigateToOperations(): void {
    if (this.currentUser?.role === Role.Superusuario || this.currentUser?.role === Role.Administrador || this.currentUser?.role === Role.Usuario) {
      // Para cualquier usuario con rol válido, cambiar a la pestaña de operaciones
      this.activeTabIndex = 1;
      this.reloadOperationsForCurrentRole(); // Cargar operaciones según rol
    } else {
      this.router.navigate(['/operation-list']);
    }
    
    if(this.drawer) this.drawer.close();
  }

  navigateToUsers(): void {
    if (this.currentUser?.role === Role.Superusuario || this.currentUser?.role === Role.Administrador) {
      // Para superusuario, cambiar a la pestaña de usuarios
      this.activeTabIndex = 0;
    }
    this.loadUsers(); // Recargar y refiltrar
    if(this.drawer) this.drawer.close();
  }

  onTabChange(index: number): void {
    this.activeTabIndex = index;
    if (index === 1) {
      // Si se cambia a la pestaña de operaciones, cargar según rol
      this.reloadOperationsForCurrentRole();
    } else if (index === 2 && this.currentUser?.role === Role.Superusuario) {
      // Si se cambia a la pestaña de integraciones, cargar las integraciones
      this.loadIntegrations();
    }
  }

  onPageChange(event: PageEvent): void {
    console.log('Page change event:', event);
    
    // Update current search parameters
    this.currentSearch.page = event.pageIndex + 1; // Material paginator is 0-based
    this.currentSearch.pageSize = event.pageSize;
    
    // Reload data based on current mode
    if (this.isSearching) {
      this.loadSearchResults();
    } else {
      this.reloadOperationsForCurrentRole();
    }
  }

  // --- Métodos de acciones de usuario (ejemplos para editar/eliminar) ---
  editUser(user: UserReadDto): void {
    // Verificar si el usuario tiene operaciones propias para determinar si se puede cambiar la empresa
    this.subscriptions.add(
      this.operationService.getUserOperationsCountForCompanyChange(user.id).subscribe({
        next: (operationsCount) => {
          // Un superusuario NO puede editar la empresa (solo admin puede)
          // Además, si el usuario tiene operaciones tampoco se puede cambiar
          const isSuperuser = this.currentUser?.role === Role.Superusuario;
          const canEditCompany = !isSuperuser && operationsCount === 0;
          
          // Abrir el formulario de edición
          const editDialog = this.dialog.open(UserEditFormComponent, {
            width: '600px',
            data: {
              user: user,
              canEditCompany: canEditCompany,
              currentUser: this.currentUser
            }
          });

          editDialog.afterClosed().subscribe(result => {
            if (result && result.success) {
              // Recargar la lista de usuarios
              this.loadUsers();
            }
          });
        },
        error: (err) => {
          console.error('Error al verificar operaciones del usuario:', err);
          this.snackBar.open('Error al verificar las operaciones del usuario.', 'OK', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
      })
    );
  }

  deleteUser(user: UserReadDto): void {
    // Verificar si el usuario tiene operaciones antes de permitir el borrado
    console.log(`[UserListComponent] Verificando operaciones para usuario: ${user.username} (ID: ${user.id})`);
    this.subscriptions.add(
      this.operationService.getUserOperationsCountForDeletion(user.id).subscribe({
        next: (count) => {
          console.log(`[UserListComponent] Usuario ${user.username} tiene ${count} operaciones propias`);
          if (count > 0) {
            this.snackBar.open(`No se puede eliminar el usuario "${user.username}" porque ya tiene operaciones registradas.`, 'OK', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          } else {
            // Mostrar popup de confirmación
            const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
              width: '400px',
              data: {
                title: 'Confirmar eliminación',
                message: `¿Está seguro de que desea eliminar al usuario "${user.username}"?`,
                confirmText: 'Aceptar',
                cancelText: 'Cancelar'
              }
            });

            confirmDialog.afterClosed().subscribe(result => {
              if (result) {
                this.performUserDeletion(user);
              }
            });
          }
        },
        error: (err) => {
          console.error('Error al verificar operaciones del usuario:', err);
          let errorMessage = 'Error al verificar las operaciones del usuario.';
          
          // Extraer el mensaje de error específico del backend
          if (err.error && err.error.message) {
            errorMessage = `Error al verificar las operaciones del usuario: ${err.error.message}`;
          } else if (err.error && typeof err.error === 'string') {
            errorMessage = `Error al verificar las operaciones del usuario: ${err.error}`;
          } else if (err.message) {
            errorMessage = `Error al verificar las operaciones del usuario: ${err.message}`;
          }
          
          this.snackBar.open(errorMessage, 'OK', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      })
    );
  }

  private performUserDeletion(user: UserReadDto): void {
    console.log('[UserListComponent] Eliminando usuario:', {
      userIdToDelete: user.id,
      currentUserId: this.currentUser?.id,
      currentUser: this.currentUser
    });
    
    this.authService.deleteUser(user.id, this.currentUser?.id).subscribe({
      next: () => {
        console.log('[UserListComponent] Usuario eliminado exitosamente, recargando lista...');
        this.snackBar.open(`Usuario "${user.username}" eliminado exitosamente.`, 'OK', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        // Recargar la lista de usuarios
        this.loadUsers();
      },
      error: (err) => {
        console.error('[UserListComponent] Error al eliminar usuario:', err);
        const backendError = err.error?.message || err.message || 'Error desconocido';
        const errorMessage = `Error al borrar usuario (${backendError})`;
        this.snackBar.open(errorMessage, 'OK', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  logout(): void {
    if(this.drawer) this.drawer.close();
    this.authService.logout();
  }

  // Métodos para operaciones de empresa 
  loadCompanyOperations(): void {
    if (!this.currentUser?.companyId) {
      this.operationsError = 'No tienes una empresa asignada para ver operaciones.';
      return;
    }

    this.isLoadingOperations = true;
    this.operationsError = null;
    
    // Reset search state
    this.searchResults = [];
    this.isSearching = false;

    this.subscriptions.add(
      this.operationService.getOperationsByCompany(
        this.currentUser.companyId, 
        this.currentSearch.page, 
        this.currentSearch.pageSize
      ).subscribe({
        next: (response) => {
          this.companyOperations = response.items;
          this.operationsPagination = response;
          this.isLoadingOperations = false;
          console.log('Company operations loaded:', this.companyOperations);
          
          // También cargar las operaciones pendientes específicas
          this.loadPendingOperationsByCompany();
        },
        error: (err) => {
          console.error('Error al cargar operaciones de la empresa:', err);
          this.operationsError = err.message || 'No se pudieron cargar las operaciones de la empresa.';
          this.isLoadingOperations = false;
        }
      })
    );
  }

  // Método para cargar operaciones del usuario actual (para usuarios normales)
  loadUserOperations(): void {
    if (!this.currentUser?.id) {
      this.operationsError = 'No se pudo identificar al usuario para cargar operaciones.';
      return;
    }

    this.isLoadingOperations = true;
    this.operationsError = null;
    
    // Reset search state
    this.searchResults = [];
    this.isSearching = false;

    this.subscriptions.add(
      this.operationService.getOperationsByUser(
        this.currentUser.id, 
        this.currentSearch.page, 
        this.currentSearch.pageSize
      ).subscribe({
        next: (response) => {
          this.companyOperations = response.items;
          this.operationsPagination = response;
          this.isLoadingOperations = false;
          console.log('User operations loaded:', this.companyOperations);
          
          // También cargar las operaciones pendientes específicas del usuario
          this.loadPendingOperationsByUser();
        },
        error: (err) => {
          console.error('Error al cargar operaciones del usuario:', err);
          this.operationsError = err.message || 'No se pudieron cargar las operaciones del usuario.';
          this.isLoadingOperations = false;
        }
      })
    );
  }

  // Método para cargar operaciones pendientes del usuario actual
  loadPendingOperationsByUser(): void {
    if (!this.currentUser?.id) {
      console.log('No hay usuario válido para cargar operaciones pendientes');
      return;
    }

    this.subscriptions.add(
      this.operationService.getPendingOperationsByUser(this.currentUser.id).subscribe({
        next: (pendingOperations) => {
          if (pendingOperations && pendingOperations.length > 0) {
            this.pendingOperations = pendingOperations;
            console.log('Pending operations by user loaded:', pendingOperations);
          } else {
            console.log('No hay operaciones pendientes para el usuario');
            this.pendingOperations = [];
          }
        },
        error: (err) => {
          console.error('Error al cargar operaciones pendientes del usuario:', err);
          this.pendingOperations = [];
        }
      })
    );
  }

  // Métodos auxiliares para operaciones
  getOperationTypeColor(operationType: string): string {
    switch (operationType) {
      case 'Local': return 'primary';
      case 'App': return 'accent';
      case 'Remote': return 'warn';
      default: return 'primary';
    }
  }

  getOperationTypeText(operationType: string): string {
    switch (operationType) {
      case 'Local': return 'Local';
      case 'App': return 'App';
      case 'Remote': return 'Remota';
      default: return operationType;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Pendiente': return 'warn';
      case 'Lanzada': return 'primary';
      case 'Completada': return 'accent';
      case 'CADUCADA': return 'warn';
      default: return 'primary';
    }
  }

  getUserName(operation: OperationReadDto): string {
    return operation.userName || 'Usuario no disponible';
  }

  // Get operations to display (either search results or all operations)
  getDisplayOperations(): OperationReadDto[] {
    return this.isSearching ? this.searchResults : this.companyOperations;
  }

  // Get pending operations from display operations
  getDisplayPendingOperations(): OperationReadDto[] {
    const operations = this.getDisplayOperations();
    const pendingFromCurrentPage = operations.filter(op => op.status === 'Pendiente');
    
    // Si no hay operaciones pendientes en la página actual, usar las pendientes específicas
    if (pendingFromCurrentPage.length === 0 && !this.isSearching && this.pendingOperations.length > 0) {
      return this.pendingOperations;
    }
    
    return pendingFromCurrentPage;
  }

  // Get non-pending operations from display operations
  getDisplayNonPendingOperations(): OperationReadDto[] {
    const operations = this.getDisplayOperations();
    return operations.filter(op => op.status !== 'Pendiente');
  }

  toggleOperationsAutoRefresh(enabled: boolean): void {
    this.operationsAutoRefreshEnabled = enabled;
    if (enabled) {
      // Ejecutar inmediatamente y luego cada intervalo
      this.reloadOperationsForCurrentRole();
      this.startOperationsAutoRefresh();
    } else {
      this.stopOperationsAutoRefresh();
    }
  }

  // Método auxiliar para recargar operaciones según el rol
  private reloadOperationsForCurrentRole(): void {
    if (this.currentUser?.role === Role.Usuario) {
      this.loadUserOperations();
    } else {
      this.loadCompanyOperations();
    }
  }

  private startOperationsAutoRefresh(): void {
    this.stopOperationsAutoRefresh();
    this.autoRefreshSub = interval(this.OPERATIONS_AUTO_REFRESH_MS).subscribe(() => {
      this.reloadOperationsForCurrentRole();
    });
  }

  private stopOperationsAutoRefresh(): void {
    if (this.autoRefreshSub) {
      this.autoRefreshSub.unsubscribe();
      this.autoRefreshSub = null;
    }
  }

  // Método para cargar operaciones pendientes específicas por empresa
  loadPendingOperationsByCompany(): void {
    if (!this.currentUser?.companyId) {
      console.log('No hay empresa válida para cargar operaciones pendientes');
      return;
    }

    this.subscriptions.add(
      this.operationService.getPendingOperationsByCompany(this.currentUser.companyId).subscribe({
        next: (pendingOperations) => {
          if (pendingOperations && pendingOperations.length > 0) {
            // Agregar las operaciones pendientes a la lista de operaciones pendientes
            this.pendingOperations = pendingOperations;
            console.log('Pending operations by company loaded:', pendingOperations);
          } else {
            console.log('No hay operaciones pendientes para la empresa');
            this.pendingOperations = [];
          }
        },
        error: (err) => {
          console.error('Error al cargar operación pendiente por empresa:', err);
          this.pendingOperations = [];
        }
      })
    );
  }

  onSearchChanged(searchDto: any): void {
    console.log('🔍 onSearchChanged called with:', searchDto);
    console.log('🔍 Current user role:', this.currentUser?.role);
    
    this.currentSearch = { ...searchDto, showExpired: true };
    this.isSearching = !!(searchDto.query && searchDto.query.trim().length > 0);
    
    // Reset to first page for new search
    this.currentSearch.page = 1;
    
    if (this.isSearching) {
      this.loadSearchResults();
    } else {
      // Clear search state and reload operations
      this.searchResults = [];
      this.isSearching = false;
      console.log('🔍 Clearing search, reloading operations');
      this.reloadOperationsForCurrentRole();
    }
  }

  loadSearchResults(): void {
    console.log('🔍 loadSearchResults called');
    
    // Para superusuarios, usar el mismo endpoint de búsqueda
    // El backend maneja automáticamente los permisos según el rol
    this.subscriptions.add(
      this.operationSearchService.searchOperations(this.currentSearch).subscribe({
        next: (data) => {
          console.log('Search response:', data);
          this.searchResults = data.items;
          this.companyOperations = data.items; // Usar searchResults para mostrar
          this.operationsPagination = data;
          this.isSearching = true;
        },
        error: (err) => {
          console.error('Error al buscar operaciones:', err);
          this.snackBar.open('Error al buscar operaciones', 'Cerrar', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      })
    );
  }

  viewOperation(operation: OperationReadDto): void {
    console.log('🔍 viewOperation called for operation:', operation);
    console.log('🔍 Current user role:', this.currentUser?.role);
    
    const dialogRef = this.dialog.open(OperationViewComponent, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      maxHeight: '800px',
      data: { operation: operation }
    });

    dialogRef.afterClosed().subscribe(result => {
      // No necesitamos hacer nada cuando se cierra la vista
    });
  }

  editOperation(operation: OperationReadDto): void {
    console.log('🔍 editOperation called for operation:', operation);
    console.log('🔍 Current user role:', this.currentUser?.role);
    
    const dialogRef = this.dialog.open(OperationFormComponent, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      maxHeight: '800px',
      data: { operation: operation, isEdit: true }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.snackBar.open('Operación actualizada exitosamente', 'Cerrar', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        // Cambiar a la pestaña de operaciones y recargar
        this.activeTabIndex = 1;
        this.reloadOperationsForCurrentRole();
      }
    });
  }

  deleteOperation(operation: OperationReadDto): void {
    console.log('🔍 deleteOperation called for operation:', operation);
    console.log('🔍 Current user role:', this.currentUser?.role);
    
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirmar eliminación',
        message: `¿Estás seguro de que quieres eliminar la operación #${operation.id}?`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.operationService.deleteOperation(operation.id).subscribe({
          next: () => {
            this.snackBar.open('Operación eliminada exitosamente', 'Cerrar', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            this.reloadOperationsForCurrentRole();
          },
          error: (err) => {
            console.error('Error al eliminar operación:', err);
            this.snackBar.open('Error al eliminar la operación', 'Cerrar', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        });
      }
    });
  }

  launchOperation(operation: OperationReadDto): void {
    console.log('🔍 launchOperation called for operation:', operation);
    console.log('🔍 Current user role:', this.currentUser?.role);
    
    // Verificar que la operación esté pendiente
    if (operation.status !== 'Pendiente') {
      this.snackBar.open('Solo se pueden lanzar operaciones pendientes', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    // Consultar firmantes antes de lanzar
    this.subscriptions.add(
      this.partyService.getPartiesByOperation(operation.id).subscribe({
        next: (parties) => {
          if (!parties || parties.length === 0) {
            this.snackBar.open('No puedes lanzar la operación porque no tiene firmantes asignados.', 'Cerrar', {
              duration: 4000,
              panelClass: ['error-snackbar']
            });
            return;
          }

          // Mostrar diálogo de confirmación
          const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
            width: '400px',
            data: {
              title: 'Confirmar lanzamiento',
              message: `¿Estás seguro de que quieres lanzar la operación #${operation.id}?`,
              confirmText: 'Lanzar',
              cancelText: 'Cancelar'
            }
          });

          confirmDialog.afterClosed().subscribe(result => {
            if (result) {
              // Mostrar indicador de carga
              this.snackBar.open('Lanzando operación...', 'Cerrar', {
                duration: 2000,
                panelClass: ['info-snackbar']
              });

              // Lanzar la operación
              this.signatureService.launchOperation(operation.id).subscribe({
                next: (response) => {
                  // Mostrar modal de éxito
                  this.dialog.open(LaunchOperationModalComponent, {
                    width: '600px',
                    data: {
                      message: response.message || 'Operación lanzada exitosamente',
                      operationId: operation.id,
                      externalId: this.extractExternalIdFromMessage(response.message || ''), // Extraer del mensaje
                      operationType: operation.operationType // Pasar el tipo de operación
                    }
                  });

                  // Recargar operaciones
                  this.reloadOperationsForCurrentRole();
                },
                error: (err) => {
                  console.error('Error al lanzar operación:', err);
                  this.snackBar.open('Error al lanzar la operación: ' + (err.error?.message || err.message || 'Error desconocido'), 'Cerrar', {
                    duration: 5000,
                    panelClass: ['error-snackbar']
                  });
                }
              });
            }
          });
        },
        error: (err) => {
          console.error('Error al consultar firmantes:', err);
          this.snackBar.open('No se pudo verificar los firmantes de la operación.', 'Cerrar', {
            duration: 4000,
            panelClass: ['error-snackbar']
          });
        }
      })
    );
  }

  relaunchOperation(operation: OperationReadDto): void {
    console.log('🔍 relaunchOperation called for operation:', operation);
    console.log('🔍 Current user role:', this.currentUser?.role);
    console.log('🔍 Operation type:', operation.operationType);
    console.log('🔍 Current workflow URL:', operation.workFlowUrl);
    console.log('🔍 Operation status:', operation.status);
    
    // Verificar que la operación NO esté pendiente ni completada
    if (operation.status === 'Pendiente') {
      this.snackBar.open('Esta operación está pendiente. Usa el botón "Lanzar Operación" en su lugar.', 'Cerrar', {
        duration: 4000,
        panelClass: ['error-snackbar']
      });
      return;
    }
    
    if (operation.status === 'Completada') {
      this.snackBar.open('No se pueden relanzar operaciones completadas.', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }
    
    // Para operaciones remotas, necesitamos relanzar para obtener un nuevo externalId
    if (operation.operationType === OperationTypeEnum.REMOTA) {
      console.log('🔍 Relaunching remote operation...');
      
      // Mostrar indicador de carga
      this.snackBar.open('Relanzando operación remota...', 'Cerrar', {
        duration: 2000,
        panelClass: ['info-snackbar']
      });

      // Relanzar la operación para obtener un nuevo externalId
      this.signatureService.launchOperation(operation.id).subscribe({
        next: (response) => {
          console.log('🔍 Relaunch response:', response);
          
          // Mostrar modal de éxito con el nuevo externalId
          this.dialog.open(LaunchOperationModalComponent, {
            width: '600px',
            data: {
              message: response.message || 'Operación relanzada exitosamente',
              operationId: operation.id,
              externalId: this.extractExternalIdFromMessage(response.message || ''), // Extraer del mensaje
              operationType: operation.operationType // Pasar el tipo de operación
            }
          });

          // Recargar operaciones para obtener la nueva workFlowUrl
          this.reloadOperationsForCurrentRole();
        },
        error: (err) => {
          console.error('🔍 Error al relanzar operación:', err);
          this.snackBar.open('Error al relanzar la operación: ' + (err.error?.message || err.message || 'Error desconocido'), 'Cerrar', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });
    } else {
      // Para operaciones locales
      if (operation.workFlowUrl) {
        // Si tiene workFlowUrl, abrirla directamente
        console.log('🔍 Opening existing workflow URL for local operation');
        window.open(operation.workFlowUrl, '_blank');
        
        this.snackBar.open('Operación relanzada exitosamente', 'Cerrar', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
      } else {
        // Si no tiene workFlowUrl, relanzar para obtener una nueva
        console.log('🔍 Relaunching local operation to get new workflow URL');
        
        this.snackBar.open('Relanzando operación local...', 'Cerrar', {
          duration: 2000,
          panelClass: ['info-snackbar']
        });

        this.signatureService.launchOperation(operation.id).subscribe({
          next: (response) => {
            console.log('🔍 Local relaunch response:', response);
            
            // Mostrar modal de éxito con el nuevo externalId
            this.dialog.open(LaunchOperationModalComponent, {
              width: '600px',
              data: {
                message: response.message || 'Operación relanzada exitosamente',
                operationId: operation.id,
                externalId: this.extractExternalIdFromMessage(response.message || ''),
                operationType: operation.operationType
              }
            });

            // Recargar operaciones para obtener la nueva workFlowUrl
            this.reloadOperationsForCurrentRole();
          },
          error: (err) => {
            console.error('🔍 Error al relanzar operación local:', err);
            this.snackBar.open('Error al relanzar la operación: ' + (err.error?.message || err.message || 'Error desconocido'), 'Cerrar', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        });
      }
    }
  }

  private extractExternalIdFromMessage(message: string): string {
    // Buscar un UUID en el mensaje (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = message.match(uuidRegex);
    if (match) {
      return match[0];
    }
    return '';
  }

  openCreateOperationDialog(): void {
    // Validar si la empresa puede crear operaciones
    if (!this.currentUser?.companyId) {
      this.snackBar.open('No se puede determinar la empresa del usuario', 'Cerrar', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.companyService.canCreateOperation(this.currentUser.companyId).subscribe({
      next: (response: any) => {
        if (!response.canCreate) {
          this.snackBar.open('⚠️ Se ha alcanzado el límite de operaciones mensuales para su empresa', 'Cerrar', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          return;
        }

        // Si puede crear, abrir el diálogo
        const dialogRef = this.dialog.open(OperationFormComponent, {
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
          data: { operation: null, isEdit: false }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result === 'created' || result === 'saved') {
            this.snackBar.open('Operación creada exitosamente', 'Cerrar', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            // Cambiar a la pestaña de operaciones y recargar
            this.activeTabIndex = 1;
            this.reloadOperationsForCurrentRole();
          }
        });
      },
      error: (error) => {
        console.error('Error al verificar límite de operaciones:', error);
        this.snackBar.open('Error al verificar límite de operaciones. Intente nuevamente.', 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  // ===================== MÉTODOS PARA INTEGRACIONES =====================

  loadIntegrations(): void {
    if (!this.currentUser?.companyId) {
      this.integrationsError = 'No hay empresa asociada para cargar integraciones';
      return;
    }

    this.isLoadingIntegrations = true;
    this.integrationsError = null;
    
    // Cargar consumo de operaciones
    this.loadOperationsUsage();

    // Cargar configuración de SharePoint
    this.sharePointConfigService.getSharePointConfiguration(this.currentUser.companyId).subscribe({
      next: (config) => {
        this.sharepointConfig = config;
        this.buildIntegrationsList();
        this.isLoadingIntegrations = false;
      },
      error: (err) => {
        // Si es 404, no hay configuración (es normal)
        if (err.message.includes('404') || err.message.includes('No hay configuración')) {
          this.sharepointConfig = null;
          this.buildIntegrationsList();
        } else {
          console.error('[UserListComponent] Error al cargar configuración de SharePoint:', err);
          this.integrationsError = 'Error al cargar las integraciones';
        }
        this.isLoadingIntegrations = false;
      }
    });
  }

  private buildIntegrationsList(): void {
    // Verificar si SharePoint está configurado
    const isSharePointConfigured = !!(
      this.sharepointConfig?.tenantId &&
      this.sharepointConfig?.clientId &&
      this.sharepointConfig?.siteId &&
      this.sharepointConfig?.folder
    );

    this.integrations = [
      {
        id: 'sharepoint',
        name: 'SharePoint',
        description: 'Almacenamiento automático de documentos firmados en SharePoint',
        icon: 'cloud_upload',
        isConfigured: isSharePointConfigured
      }
      // Aquí se pueden agregar más integraciones en el futuro
    ];
  }

  loadOperationsUsage(): void {
    if (!this.currentUser?.companyId) {
      return;
    }
    
    this.isLoadingOperationsUsage = true;
    
    this.companyService.getOperationsUsage(this.currentUser.companyId).subscribe({
      next: (usage) => {
        this.operationsUsage = usage;
        this.isLoadingOperationsUsage = false;
        console.log('[UserListComponent] Operations usage loaded:', usage);
      },
      error: (err) => {
        console.error('[UserListComponent] Error loading operations usage:', err);
        this.isLoadingOperationsUsage = false;
        // No mostrar error al usuario, solo en consola
      }
    });
  }

  openSharePointConfigDialog(integration: IntegrationType): void {
    if (!this.currentUser?.companyId) {
      this.snackBar.open('No hay empresa asociada', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    const dialogRef = this.dialog.open(SharePointConfigFormComponent, {
      width: '700px',
      disableClose: true,
      data: {
        config: integration.isConfigured ? this.sharepointConfig : null,
        companyId: this.currentUser.companyId
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        if (result.isEdit) {
          // Actualizar configuración existente
          this.updateSharePointConfiguration(result.data);
        } else {
          // Crear nueva configuración
          this.createSharePointConfiguration(result.data);
        }
      }
    });
  }

  private createSharePointConfiguration(configData: any): void {
    if (!this.currentUser?.companyId) return;

    this.sharePointConfigService.createSharePointConfiguration(this.currentUser.companyId, configData).subscribe({
      next: (config) => {
        this.snackBar.open('Configuración de SharePoint creada exitosamente', 'Cerrar', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        this.loadIntegrations();
      },
      error: (err) => {
        console.error('[UserListComponent] Error al crear configuración de SharePoint:', err);
        this.snackBar.open(`Error al crear configuración: ${err.message}`, 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  private updateSharePointConfiguration(configData: any): void {
    if (!this.currentUser?.companyId) return;

    this.sharePointConfigService.updateSharePointConfiguration(this.currentUser.companyId, configData).subscribe({
      next: () => {
        this.snackBar.open('Configuración de SharePoint actualizada exitosamente', 'Cerrar', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        this.loadIntegrations();
      },
      error: (err) => {
        console.error('[UserListComponent] Error al actualizar configuración de SharePoint:', err);
        this.snackBar.open(`Error al actualizar configuración: ${err.message}`, 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  deleteSharePointConfiguration(integration: IntegrationType): void {
    if (!this.currentUser?.companyId) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirmar eliminación',
        message: `¿Está seguro de que desea eliminar la configuración de ${integration.name}? Los documentos ya almacenados no se eliminarán.`
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.currentUser?.companyId) {
        this.sharePointConfigService.deleteSharePointConfiguration(this.currentUser.companyId).subscribe({
          next: () => {
            this.snackBar.open('Configuración de SharePoint eliminada exitosamente', 'Cerrar', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            this.loadIntegrations();
          },
          error: (err) => {
            console.error('[UserListComponent] Error al eliminar configuración de SharePoint:', err);
            this.snackBar.open(`Error al eliminar configuración: ${err.message}`, 'Cerrar', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        });
      }
    });
  }

}