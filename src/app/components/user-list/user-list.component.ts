// src/app/admin/user-list/user-list.component.ts

import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit, ElementRef, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
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
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';

// Servicios y Modelos
import { AuthService } from '../../services/auth.service';
import { OperationService } from '../../services/operation.service';
import { SignatureService } from '../../services/signature.service';
import { PartyService } from '../../services/party.service';
import { OperationSearchService } from '../../services/operation-search.service';
import { UserReadDto } from '../../models/user-read.dto';
import { Role } from '../../models/role.enum';
import { OperationReadDto, OperationStatusEnum, OperationTypeEnum } from '../../models/operation.model';
import { PaginatedResultDto, OperationSearchDto } from '../../models/operation-search.dto';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Componentes de Diálogo
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { UserEditFormComponent } from '../user-edit-form/user-edit-form.component';
import { OperationFormComponent } from '../operation-form/operation-form.component';
import { OperationViewComponent } from '../operation-view/operation-view.component';
import { OperationSearchComponent } from '../operation-search/operations-filters-component';
import { LaunchOperationModalComponent } from '../launch-operation-modal/launch-operation-modal.component';

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
    MatPaginatorModule
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
  public Role = Role;
  public OperationTypeEnum = OperationTypeEnum;
  public OperationStatusEnum = OperationStatusEnum;

  // Propiedades para operaciones de empresa (superusuario)
  companyOperations: OperationReadDto[] = [];
  
  // Propiedades para búsqueda de operaciones
  currentSearch: OperationSearchDto = { query: '', page: 1, pageSize: 20, showExpired: false };
  searchResults: OperationReadDto[] = [];
  isSearching = false;
  
  // Propiedades para filtrar operaciones
  pendingOperations: OperationReadDto[] = [];
  nonPendingOperations: OperationReadDto[] = [];
  
  isLoadingOperations = false;
  operationsError: string | null = null;
  operationsPagination: PaginatedResultDto<OperationReadDto> | null = null;

  // Variable para controlar qué pestaña está activa (0 = Usuarios, 1 = Operaciones)
  activeTabIndex = 0;

  displayedColumns: string[] = ['username', 'email', 'role', 'companyName', 'createdAt', 'actions'];
  operationsDisplayedColumns: string[] = ['id', 'operationType', 'descripcionOperacion', 'status', 'user', 'minutesAlive', 'createdAt', 'actions'];

  private subscriptions: Subscription = new Subscription();
 
  constructor(
    private authService: AuthService,
    private operationService: OperationService,
    private signatureService: SignatureService,
    private partyService: PartyService,
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
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.currentUser = user;
        // Si el usuario cambia (ej. de null a logueado), recargar y refiltrar usuarios.
        // También es útil si los datos del currentUser (como companyId) se cargan asíncronamente.
        this.loadUsers();
        
        // Si es superusuario o administrador, cargar las operaciones normales de su empresa
        if ((user?.role === Role.Superusuario || user?.role === Role.Administrador) && user.companyId) {
          this.loadCompanyOperations();
        }
      })
    );
    // La carga inicial se hace a través de la suscripción a currentUser
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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
      this.displayedUsers = [...this.allUsersFromApi]; // Mostrar todos si no hay usuario para filtrar (poco probable en admin)
      return;
    }

    if (this.currentUser.role === Role.Administrador) {
      console.log('[UserListComponent] Usuario es Administrador, mostrando todos los usuarios.');
      this.displayedUsers = [...this.allUsersFromApi]; // Copiar para evitar modificar el original
    } else if (this.currentUser.role === Role.Superusuario) {
      if (this.currentUser.companyId) {
        console.log(`[UserListComponent] Usuario es Superusuario (Empresa ID: ${this.currentUser.companyId}). Filtrando usuarios.`);
        this.displayedUsers = this.allUsersFromApi.filter(user =>
          user.companyId === this.currentUser?.companyId &&
          (user.role === Role.Usuario || user.role === Role.Superusuario)
        );
      } else {
        console.warn('[UserListComponent] Superusuario no tiene companyId. No se mostrarán usuarios.');
        this.snackBar.open('No tienes una empresa asignada para ver usuarios.', 'Cerrar', { duration: 7000, panelClass: ['error-snackbar']});
        this.displayedUsers = []; // No mostrar nada si el Superusuario no tiene empresa
      }
    } else {
      // Otros roles (ej. Usuario normal) no deberían ver esta lista, o ver una lista vacía.
      // El AuthGuard debería prevenir que lleguen aquí, pero como medida de seguridad:
      console.log(`[UserListComponent] Rol ${this.currentUser.role} no tiene permisos para ver esta lista.`);
      this.displayedUsers = [];
    }
    // Forzar la actualización de la tabla si la referencia del array no cambia (aunque con el spread operator debería)
    // this.displayedUsers = [...this.displayedUsers];
    console.log('[UserListComponent] Usuarios a mostrar después del filtro:', this.displayedUsers);
  }


  // --- Métodos para el Sidenav ---
  navigateToCompanies(): void {
    this.router.navigate(['/company-list']);
    if(this.drawer) this.drawer.close();
  }

  navigateToOperations(): void {
    if (this.currentUser?.role === Role.Superusuario || this.currentUser?.role === Role.Administrador) {
      // Para superusuario o administrador, cambiar a la pestaña de operaciones
      this.activeTabIndex = 1;
      this.loadCompanyOperations(); // Cargar operaciones normales
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
    if (index === 1 && (this.currentUser?.role === Role.Superusuario || this.currentUser?.role === Role.Administrador)) {
      // Si se cambia a la pestaña de operaciones, cargar las operaciones normales
      this.loadCompanyOperations();
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
      this.loadCompanyOperations();
    }
  }

  // --- Métodos de acciones de usuario (ejemplos para editar/eliminar) ---
  editUser(user: UserReadDto): void {
    // Verificar si el usuario tiene operaciones propias para determinar si se puede cambiar la empresa
    this.subscriptions.add(
      this.operationService.getUserOperationsCountForCompanyChange(user.id).subscribe({
        next: (operationsCount) => {
          const canEditCompany = operationsCount === 0;
          
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
    
    this.subscriptions.add(
      this.authService.deleteUser(user.id, this.currentUser?.id).subscribe({
        next: () => {
          this.snackBar.open(`Usuario "${user.username}" eliminado exitosamente.`, 'OK', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          // Recargar la lista de usuarios
          this.loadUsers();
        },
        error: (err) => {
          console.error('Error al eliminar usuario:', err);
          const backendError = err.error?.message || err.message || 'Error desconocido';
          const errorMessage = `Error al borrar usuario (${backendError})`;
          this.snackBar.open(errorMessage, 'OK', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      })
    );
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
    const filteredOperations = this.currentSearch.showExpired ? 
      operations : 
      operations.filter(op => op.status !== 'Caducada');
    const pendingFromCurrentPage = filteredOperations.filter(op => op.status === 'Pendiente');
    
    // Si no hay operaciones pendientes en la página actual, usar las pendientes específicas
    if (pendingFromCurrentPage.length === 0 && !this.isSearching && this.pendingOperations.length > 0) {
      return this.pendingOperations;
    }
    
    return pendingFromCurrentPage;
  }

  // Get non-pending operations from display operations
  getDisplayNonPendingOperations(): OperationReadDto[] {
    const operations = this.getDisplayOperations();
    const filteredOperations = this.currentSearch.showExpired ? 
      operations : 
      operations.filter(op => op.status !== 'Caducada');
    return filteredOperations.filter(op => op.status !== 'Pendiente');
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
    
    this.currentSearch = searchDto;
    this.isSearching = !!(searchDto.query && searchDto.query.trim().length > 0);
    
    // Reset to first page for new search
    this.currentSearch.page = 1;
    
    if (this.isSearching) {
      this.loadSearchResults();
    } else {
      this.loadCompanyOperations();
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
        this.loadCompanyOperations();
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
            this.loadCompanyOperations();
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
                  this.loadCompanyOperations();
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
          this.loadCompanyOperations();
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
            this.loadCompanyOperations();
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
        // Recargar operaciones si estamos en la pestaña de operaciones
        if (this.activeTabIndex === 1) {
          this.loadCompanyOperations();
        }
      }
    });
  }

}