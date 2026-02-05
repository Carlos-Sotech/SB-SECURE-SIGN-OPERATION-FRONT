import { Component, OnInit, OnDestroy, ViewChild, inject, AfterViewInit, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

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
import { MatBadgeModule } from '@angular/material/badge';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';

// Servicios y Modelos
import { AuthService } from '../../services/auth.service';
import { OperationService } from '../../services/operation.service';
import { SignatureService } from '../../services/signature.service';
import { PartyService } from '../../services/party.service';
import { CompanyService } from '../../services/company.service';
import { Operation, OperationTypeEnum, OperationReadDto, OperationStatusEnum } from '../../models/operation.model';
import { UserReadDto } from '../../models/user-read.dto';
import { Role } from '../../models/role.enum';
import { OperationSearchDto, PaginatedResultDto } from '../../models/operation-search.dto';
import { OperationSearchService } from '../../services/operation-search.service';

// Componentes de Diálogo
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { OperationFormComponent } from '../operation-form/operation-form.component';
import { OperationViewComponent } from '../operation-view/operation-view.component';
import { OperationSearchComponent } from '../operation-search/operations-filters-component';
import { LaunchOperationModalComponent } from '../launch-operation-modal/launch-operation-modal.component';

@Component({
  selector: 'app-operation-list',
  standalone: true,
  imports: [
    OperationSearchComponent,
    CommonModule,
    MatSidenavModule, MatToolbarModule, MatIconModule, MatButtonModule,
    MatListModule, MatDividerModule, MatCardModule, MatProgressSpinnerModule,
    MatTableModule, MatTooltipModule, MatSnackBarModule, MatDialogModule,
    MatChipsModule, MatBadgeModule,
    MatPaginatorModule
  ],
  templateUrl: './operation-list.component.html',
  styleUrls: ['./operation-list.component.css']
})
export class OperationListComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('drawer') drawer!: MatSidenav;
  private operationSearchService = inject(OperationSearchService);

  currentUser: UserReadDto | null = null;
  operations: OperationReadDto[] = [];
  pendingOperations: OperationReadDto[] = []; // Nueva propiedad para operaciones pendientes independientes
  isLoadingOperations = false;
  operationsError: string | null = null;
  public Role = Role;
  public OperationTypeEnum = OperationTypeEnum;
  currentSearch: OperationSearchDto = { query: '', page: 1, pageSize: 20, showExpired: false };
  searchResults: OperationReadDto[] = [];
  paginationInfo: PaginatedResultDto<OperationReadDto> | null = null;
  isSearching = false;
  isAutoRefreshEnabled = true;
  
  // Columnas para la tabla de operaciones
  displayedColumns: string[] = ['id', 'operationType', 'descripcionOperacion', 'status', 'user', 'minutesAlive', 'createdAt', 'actions'];
  
  // Propiedades cacheadas para evitar bucles infinitos
  private _cachedDisplayedColumns: string[] = ['id', 'operationType', 'descripcionOperacion', 'status', 'user', 'minutesAlive', 'createdAt', 'actions'];
  private _cachedHasPendingOperations: boolean = false;
  private _cachedNonPendingOperations: OperationReadDto[] = [];
  private _lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 100; // Cache válido por 100ms
  
  // Getter para obtener las columnas según el rol del usuario (con cache)
  get getDisplayedColumns(): string[] {
    return this._cachedDisplayedColumns;
  }
  
  // Getter para hasPendingOperations (con cache)
  get hasPendingOperations(): boolean {
    const now = Date.now();
    if (now - this._lastCacheUpdate > this.CACHE_TTL) {
      this._updatePendingOperationsCache();
    }
    return this._cachedHasPendingOperations;
  }
  
  // Método privado para actualizar el cache de operaciones pendientes
  private _updatePendingOperationsCache(): void {
    const pendingOps = this.getDisplayPendingOperations();
    this._cachedHasPendingOperations = pendingOps.length > 0;
    this._lastCacheUpdate = Date.now();
  }
  private subscriptions: Subscription = new Subscription();
  private autoRefreshSubscription: Subscription | null = null; // Suscripción específica para auto-refresh de operaciones normales
  private pendingAutoRefreshSubscription: Subscription | null = null; // Suscripción específica para auto-refresh de operaciones pendientes

  constructor(
    private authService: AuthService,
    private operationService: OperationService,
    private signatureService: SignatureService,
    private partyService: PartyService,
    private companyService: CompanyService,
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

  ngOnInit(): void {
    // Cargar configuración guardada del localStorage
    this.loadSavedConfiguration();
    
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => {
        this.currentUser = user

        if(this.currentUser?.role !== Role.Usuario && this.currentUser?.role !== Role.Superusuario && this.currentUser?.role !== Role.Administrador){
         this.snackBar.open('Acceso denegado, solo usuarios, superusuarios y administradores pueden gestionar operaciones', 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
         })
         this.router.navigate(['/login']);
        }
      
        // Cargar operaciones pendientes primero, luego operaciones normales si no hay pendientes
        this.loadPendingOperations();
        //userId = this.authService.currentUserId; // o de donde obtengas el userId
        //this.loadPendingOperationsByUser(this.currentUser??.id);
        console.log('🔍 Current user loaded:', this.currentUser);
        console.log('🔍 User role:', this.currentUser?.role);
        console.log('🔍 User companyId:', this.currentUser?.companyId);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.stopAutoRefresh();
  }

  // Método para cargar configuración guardada
  private loadSavedConfiguration(): void {
    try {
      const savedPageSize = localStorage.getItem('operationList_pageSize');
      const savedAutoRefresh = localStorage.getItem('operationList_autoRefresh');
      
      if (savedPageSize) {
        this.currentSearch.pageSize = parseInt(savedPageSize, 10);
      }
      
      if (savedAutoRefresh !== null) {
        this.isAutoRefreshEnabled = savedAutoRefresh === 'true';
      }
    } catch (error) {
      console.error('Error loading saved configuration:', error);
    }
  }

  // Método para guardar configuración
  private saveConfiguration(): void {
    try {
      localStorage.setItem('operationList_pageSize', this.currentSearch.pageSize.toString());
      localStorage.setItem('operationList_autoRefresh', this.isAutoRefreshEnabled.toString());
    } catch (error) {
      console.error('Error saving configuration:', error);
    }
  }

  // Método para detener el auto-refresh
  private stopAutoRefresh(): void {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
      this.autoRefreshSubscription = null;
    }
    if (this.pendingAutoRefreshSubscription) {
      this.pendingAutoRefreshSubscription.unsubscribe();
      this.pendingAutoRefreshSubscription = null;
    }
  }

  // Método para detener solo el auto-refresh de operaciones normales
  private stopNormalOperationsAutoRefresh(): void {
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
      this.autoRefreshSubscription = null;
    }
  }

  ngAfterViewInit(): void {
    // No longer needed for pagination
  }

  onPageChange(event: PageEvent): void {
    console.log('Page change event:', event);
    
    // Update current search parameters
    this.currentSearch.page = event.pageIndex + 1; // Material paginator is 0-based
    this.currentSearch.pageSize = event.pageSize;
    
    // Guardar configuración cuando cambia el tamaño de página
    this.saveConfiguration();
    
    // Reload data based on current mode
    if (this.isSearching) {
      this.loadSearchResults();
    } else {
      this.loadOperations();
    }
  }

  loadOperations(): void {
    this.isLoadingOperations = true;
    this.operationsError = null;
    this.operations = [];

    // Verificar que el usuario existe y tiene ID
    if (!this.currentUser?.id) {
      this.operationsError = 'Usuario no válido';
      this.isLoadingOperations = false;
      return;
    }


    // Detener auto-refresh anterior solo de operaciones normales
    this.stopNormalOperationsAutoRefresh();

    // Para superusuarios, cargar operaciones de su empresa
    if (this.currentUser.role === Role.Superusuario) {
      if (!this.currentUser.companyId) {
        this.operationsError = 'Superusuario sin empresa asignada';
        this.isLoadingOperations = false;
        return;
      }

      if (this.isAutoRefreshEnabled) {
        // Usar auto-refresh solo si está habilitado
        this.autoRefreshSubscription = this.operationService.getOperationsByCompany(
          this.currentUser.companyId,
          this.currentSearch.page, 
          this.currentSearch.pageSize
        ).subscribe({
          next: (data: any) => {
            console.log('🔍 [SUPERUSUARIO] Datos recibidos del backend:', data);
            console.log('🔍 [SUPERUSUARIO] Operaciones recibidas:', data.items);
            if (data.items && data.items.length > 0) {
              console.log('🔍 [SUPERUSUARIO] Primera operación:', data.items[0]);
              console.log('🔍 [SUPERUSUARIO] Descripción primera operación:', data.items[0].descripcionOperacion);
            }
            this.operations = data.items;
            this.paginationInfo = data;
            this.isLoadingOperations = false;
            this.checkOperationsStatus();
          },
          error: (err: any) => {
            console.error('Error al cargar operaciones de la empresa:', err);
            this.operationsError = err.message || 'No se pudieron cargar las operaciones. Intenta de nuevo más tarde.';
            this.isLoadingOperations = false;
          }
        });
      } else {
        // Cargar sin auto-refresh
        this.subscriptions.add(
          this.operationService.getOperationsByCompany(
            this.currentUser.companyId,
            this.currentSearch.page, 
            this.currentSearch.pageSize
          ).subscribe({
            next: (data: any) => {
              console.log('🔍 [SUPERUSUARIO] Datos recibidos del backend (sin auto-refresh):', data);
              console.log('🔍 [SUPERUSUARIO] Operaciones recibidas:', data.items);
              if (data.items && data.items.length > 0) {
                console.log('🔍 [SUPERUSUARIO] Primera operación:', data.items[0]);
                console.log('🔍 [SUPERUSUARIO] Descripción primera operación:', data.items[0].descripcionOperacion);
              }
              this.operations = data.items;
              this.paginationInfo = data;
              this.isLoadingOperations = false;
              this.checkOperationsStatus();
            },
            error: (err: any) => {
              console.error('Error al cargar operaciones de la empresa:', err);
              this.operationsError = err.message || 'No se pudieron cargar las operaciones. Intenta de nuevo más tarde.';
              this.isLoadingOperations = false;
            }
          })
        );
      }
    } else {
      // Para usuarios normales, cargar solo sus operaciones
      if (this.isAutoRefreshEnabled) {
        // Usar auto-refresh solo si está habilitado
        this.autoRefreshSubscription = this.operationService.getOperationsByUserWithAutoRefresh(
          this.currentUser.id, 
          this.currentSearch.page, 
          this.currentSearch.pageSize
        ).subscribe({
          next: (data) => {
            this.operations = data.items;
            this.paginationInfo = data;
            function removeDuplicateRows() {const tables = document.querySelectorAll('.data-table');
if (tables.length < 2) return;

const pendingTable = tables[0];
const otherTable = tables[1];

// 2. Obtener los IDs de la segunda tabla (Otras Operaciones)
const otherIds = new Set(
  Array.from(otherTable.querySelectorAll('tbody tr')).map(row => {
    return row.querySelector('td')?.innerText?.trim();
  }).filter(Boolean)
);

// 3. Recorrer las filas de la primera tabla (Pendientes) y eliminar las que estén duplicadas
const rows = pendingTable.querySelectorAll('tbody tr');

rows.forEach(row => {
  const id = row.querySelector('td')?.innerText?.trim();
  if (otherIds.has(id)) {
    row.remove();
  }
});

// 4. Si la tabla de pendientes ya no tiene filas, eliminarla (o ocultarla)
const remainingRows = pendingTable.querySelectorAll('tbody tr');
if (remainingRows.length === 0) {
  // Opción 1: eliminar la tabla completamente
  pendingTable.remove();

  // Opción 2: ocultar la tabla en lugar de eliminarla
  // pendingTable.style.display = 'none';

  console.log('Tabla de Operaciones Pendientes eliminada porque no tiene filas.');
} else {
  console.log('Filas duplicadas eliminadas de la tabla de Operaciones Pendientes.');
}

}
removeDuplicateRows();
            this.isLoadingOperations = false;
            this.checkOperationsStatus();
          },
          error: (err) => {
            console.error('Error al cargar operaciones del usuario:', err);
            this.operationsError = err.message || 'No se pudieron cargar las operaciones. Intenta de nuevo más tarde.';
            this.isLoadingOperations = false;
          }
        });
      } else {
        // Cargar sin auto-refresh
        this.subscriptions.add(
          this.operationService.getOperationsByUser(
            this.currentUser.id, 
            this.currentSearch.page, 
            this.currentSearch.pageSize
          ).subscribe({
            next: (data) => {
              this.operations = data.items;
              this.paginationInfo = data;
              this.isLoadingOperations = false;
              this.checkOperationsStatus();
            },
            error: (err) => {
              console.error('Error al cargar operaciones del usuario:', err);
              this.operationsError = err.message || 'No se pudieron cargar las operaciones. Intenta de nuevo más tarde.';
              this.isLoadingOperations = false;
            }
          })
        );
      }
    }
  }

  // Método para cargar operaciones sin auto-refresh (para búsquedas)
  loadOperationsWithoutAutoRefresh(): void {
    this.isLoadingOperations = true;
    this.operationsError = null;
    this.operations = [];
    this.pendingOperations=[];

    // Verificar que el usuario existe y tiene ID
    if (!this.currentUser?.id) {
      this.operationsError = 'Usuario no válido';
      this.isLoadingOperations = false;
      return;
    }

    // Detener auto-refresh anterior solo de operaciones normales
    this.stopNormalOperationsAutoRefresh();

    // Para superusuarios, cargar operaciones de su empresa
    if (this.currentUser.role === Role.Superusuario) {
      if (!this.currentUser.companyId) {
        this.operationsError = 'Superusuario sin empresa asignada';
        this.isLoadingOperations = false;
        return;
      }

      this.subscriptions.add(
        this.operationService.getOperationsByCompany(
          this.currentUser.companyId,
          this.currentSearch.page, 
          this.currentSearch.pageSize
        ).subscribe({
          next: (data) => {
            this.operations = data.items;
            this.paginationInfo = data;
            console.log('Company operations loaded without auto-refresh (Superuser):', this.operations);
            console.log('Pagination info:', this.paginationInfo);
            this.isLoadingOperations = false;
            this.checkOperationsStatus();
          },
          error: (err) => {
            console.error('Error al cargar operaciones de la empresa:', err);
            this.operationsError = err.message || 'No se pudieron cargar las operaciones. Intenta de nuevo más tarde.';
            this.isLoadingOperations = false;
          }
        })
      );
    } else {
      // Para usuarios normales, cargar solo sus operaciones
      this.subscriptions.add(
        this.operationService.getOperationsByUser(this.currentUser.id, this.currentSearch.page, this.currentSearch.pageSize).subscribe({
          next: (data) => {
            this.operations = data.items;
            this.paginationInfo = data;
            console.log('User operations loaded without auto-refresh:', this.operations);
            console.log('Pagination info:', this.paginationInfo);
            this.isLoadingOperations = false;
            this.checkOperationsStatus();
          },
          error: (err) => {
            console.error('Error al cargar operaciones del usuario:', err);
            this.operationsError = err.message || 'No se pudieron cargar las operaciones. Intenta de nuevo más tarde.';
            this.isLoadingOperations = false;
          }
        })
      );
    }
  }

  toggleAutoRefresh(): void {
    this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;
    
    // Guardar configuración
    this.saveConfiguration();
    
    // Detener todas las suscripciones de auto-refresh actuales
    this.stopAutoRefresh();
    
    if (this.isAutoRefreshEnabled) {
      // Reiniciar con auto-refresh - cargar operaciones pendientes primero
      this.loadPendingOperations();
    } else {
      // Cargar sin auto-refresh
      this.loadPendingOperations();
    }
    
    this.snackBar.open(
      `Actualización automática ${this.isAutoRefreshEnabled ? 'habilitada' : 'deshabilitada'}`, 
      'Cerrar', 
      { duration: 2000 }
    );
  }

  onSearchChanged(searchDto: OperationSearchDto): void {
    console.log('🔍 onSearchChanged called with:', searchDto);
    console.log('🔍 Current user role:', this.currentUser?.role);
    
    this.currentSearch = searchDto;
    this.isSearching = !!(searchDto.query && searchDto.query.trim().length > 0);
    
    // Reset to first page for new search
    this.currentSearch.page = 1;
    
    // Detener auto-refresh cuando se hace búsqueda
    this.stopAutoRefresh();
    
    if (this.isSearching) {
      this.loadSearchResults();
    } else {
      // Si no está buscando, usar auto-refresh si está habilitado
      if (this.isAutoRefreshEnabled) {
        this.loadOperations();
        
      } else {
        this.loadOperationsWithoutAutoRefresh();
      }
    }
  }

  loadSearchResults(): void {
    this.isLoadingOperations = true;
    this.operationsError = null;
    
    // Detener auto-refresh cuando se hace búsqueda
    this.stopAutoRefresh();
    
    console.log('Loading search results with query:', this.currentSearch);
    
    // Usar el mismo servicio de búsqueda para todos los usuarios
    // El backend ya maneja los permisos según el rol del usuario
    this.subscriptions.add(
      this.operationSearchService.searchOperations(this.currentSearch).subscribe({
        next: (data) => {
          console.log('Search response in component:', data);
          console.log('Items received:', data.items);
          console.log('Pagination info:', {
            totalCount: data.totalCount,
            page: data.page,
            pageSize: data.pageSize,
            totalPages: data.totalPages,
            hasNextPage: data.hasNextPage,
            hasPreviousPage: data.hasPreviousPage
          });
          
          this.searchResults = data.items;
          this.paginationInfo = data;
          this.isLoadingOperations = false;
          // Clear normal operations when searching
          this.operations = [];
          console.log('Search results set:', this.searchResults);
        },
        error: (err) => {
          console.error('Error al buscar operaciones:', err);
          this.operationsError = err.message || 'No se pudieron buscar las operaciones.';
          this.isLoadingOperations = false;
        }
      })
    );
  }

  getOperationTypeColor(operationType: OperationTypeEnum): string {
    switch (operationType) {
      case OperationTypeEnum.LOCAL: return 'primary';
      case OperationTypeEnum.REMOTA: return 'warn';
      default: return '';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Pendiente': return 'warn';
      case 'Lanzada': return 'accent';
      case 'Completada': return 'primary';
      case 'Caducada': return 'warn';
      default: return '';
    }
  }

  getOperationTypeText(operationType: OperationTypeEnum): string {
    switch (operationType) {
      case OperationTypeEnum.LOCAL: return 'Local';
      case OperationTypeEnum.REMOTA: return 'Remota';
      default: return operationType;
    }
  }

  getUserName(operation: OperationReadDto): string {
    return operation.userName || 'Usuario no disponible';
  }

  getPendingOperations(): OperationReadDto[] {
    const operations = this.currentSearch.showExpired ? 
      this.operations : 
      this.operations.filter(op => op.status !== OperationStatusEnum.CADUCADA);
    return operations.filter(op => op.status === OperationStatusEnum.PENDING);
  }

  getNonPendingOperations(): OperationReadDto[] {
    const operations = this.currentSearch.showExpired ? 
      this.operations : 
      this.operations.filter(op => op.status !== OperationStatusEnum.CADUCADA);
    return operations.filter(op => op.status !== OperationStatusEnum.PENDING);
  }

  // Get operations to display (either search results or all operations)
  getDisplayOperations(): OperationReadDto[] {
    return this.isSearching ? this.searchResults : this.operations;
  }
loadPendingOperationsByUser(userId: number) {
  this.operationService.getPendingOperationsByUser(userId).subscribe({
    next: (operations) => {
      this.pendingOperations = operations;
      //this.isLoadingPending = false;
    },
    error: (err) => {
      
    }
  });
}
  // Get pending operations from display operations
  getDisplayPendingOperations(): OperationReadDto[] {
    
    if (this.isSearching) {
      // Si está buscando, filtrar de los resultados de búsqueda
      const operations = this.searchResults;
      const filteredOperations = this.currentSearch.showExpired ? 
        operations : 
        operations.filter(op => op.status !== OperationStatusEnum.CADUCADA);
      const pendingOps = filteredOperations.filter(op => op.status === OperationStatusEnum.PENDING);
      return pendingOps;
    } else {
      // Si no está buscando, usar las operaciones pendientes independientes
      // Si no hay operaciones pendientes independientes, filtrar de la lista principal
      
      if (this.pendingOperations.length > 0) {
        return this.pendingOperations;
      } else {
        // Filtrar operaciones pendientes de la lista principal
        const operations = this.operations;
        const filteredOperations = this.currentSearch.showExpired ? 
          operations : 
          operations.filter(op => op.status !== OperationStatusEnum.CADUCADA);
        const pendingOps = filteredOperations.filter(op => op.status === OperationStatusEnum.PENDING);
        return pendingOps;
      }
    }
  }

  // Get non-pending operations from display operations (con cache)
  getDisplayNonPendingOperations(): OperationReadDto[] {
    const now = Date.now();
    if (now - this._lastCacheUpdate > this.CACHE_TTL) {
      const operations = this.getDisplayOperations();
      const filteredOperations = this.currentSearch.showExpired ? 
        operations : 
        operations.filter(op => op.status !== OperationStatusEnum.CADUCADA);
      
      // Obtener las operaciones pendientes que se están mostrando en la sección separada
      const pendingOps = this.getDisplayPendingOperations();
      const pendingIds = pendingOps.map(op => op.id);
      
      // Filtrar operaciones no pendientes, excluyendo las que ya están en la sección pendiente
      this._cachedNonPendingOperations = filteredOperations.filter(op => 
        op.status !== OperationStatusEnum.PENDING || !pendingIds.includes(op.id)
      );
      this._updatePendingOperationsCache();
    }
    return this._cachedNonPendingOperations;
  }

  // Método para cargar operaciones pendientes específicas
  // Este método también carga las operaciones normales después de cargar las pendientes
  loadPendingOperations(): void {
    
    if (!this.currentUser?.id) {
      console.log('No hay usuario válido para cargar operaciones pendientes');
      return;
    }

    
    // Detener auto-refresh anterior de operaciones pendientes
    if (this.pendingAutoRefreshSubscription) {
      this.pendingAutoRefreshSubscription.unsubscribe();
      this.pendingAutoRefreshSubscription = null;
    }
    
    // Cargar operaciones pendientes de forma independiente
    if (this.isAutoRefreshEnabled) {
      // Usar auto-refresh si está habilitado
      // Para superusuarios, cargar operaciones pendientes de toda la empresa
      const pendingOperationsObservable = this.currentUser.role === Role.Superusuario && this.currentUser.companyId
        ? this.operationService.getPendingOperationsByCompany(this.currentUser.companyId)
        : this.operationService.getPendingOperationsByUserWithAutoRefresh(this.currentUser.id);
      
      this.pendingAutoRefreshSubscription = pendingOperationsObservable.subscribe({
        next: (pendingOperations) => {
          console.log('🔍 [PENDING] Operaciones pendientes recibidas:', pendingOperations);
          console.log('🔍 [PENDING] Cantidad de operaciones pendientes:', pendingOperations?.length || 0);
          if (pendingOperations && pendingOperations.length > 0) {
            // Si hay operaciones pendientes, agregarlas a la lista independiente
            this.pendingOperations = pendingOperations;
            console.log('🔍 [PENDING] Operaciones pendientes asignadas:', this.pendingOperations);
            // Invalidar cache cuando se cargan nuevas operaciones pendientes
            this._lastCacheUpdate = 0;
          } else {
            console.log('🔍 [PENDING] No hay operaciones pendientes');
            this.pendingOperations = [];
          }
          
          // Después de cargar las pendientes, cargar las operaciones normales
          this.loadOperations();
        },
        error: (err) => {
          console.error('🔍 Error al cargar operaciones pendientes:', err);
          this.pendingOperations = [];
          // Si hay error, cargar operaciones normales
          this.loadOperations();
        }
      });
    } else {
      // Cargar sin auto-refresh
      // Para superusuarios, cargar operaciones pendientes de toda la empresa
      const pendingOperationsObservableNoRefresh = this.currentUser.role === Role.Superusuario && this.currentUser.companyId
        ? this.operationService.getPendingOperationsByCompany(this.currentUser.companyId)
        : this.operationService.getPendingOperationsByUser(this.currentUser.id);
      
      this.subscriptions.add(
        pendingOperationsObservableNoRefresh.subscribe({
          next: (pendingOperations) => {
            console.log('🔍 [PENDING] Operaciones pendientes recibidas (sin auto-refresh):', pendingOperations);
            console.log('🔍 [PENDING] Cantidad de operaciones pendientes:', pendingOperations?.length || 0);
            if (pendingOperations && pendingOperations.length > 0) {
              // Si hay operaciones pendientes, agregarlas a la lista independiente
              this.pendingOperations = pendingOperations;
              console.log('🔍 [PENDING] Operaciones pendientes asignadas:', this.pendingOperations);
            } else {
              console.log('🔍 [PENDING] No hay operaciones pendientes');
              this.pendingOperations = [];
            }
            
            // Después de cargar las pendientes, cargar las operaciones normales
            this.loadOperations();
          },
          error: (err) => {
            console.error('🔍 Error al cargar operaciones pendientes:', err);
            this.pendingOperations = [];
            // Si hay error, cargar operaciones normales
            this.loadOperations();
          }
        })
      );
    }
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
          width: '95vw',
          maxWidth: '1400px',
          height: '90vh',
          maxHeight: '800px',
          data: { operation: null, isEdit: false }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.snackBar.open('Operación creada exitosamente', 'Cerrar', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            
            // Recargar tanto las operaciones normales como las pendientes
            console.log('🔍 Operation created successfully, reloading both normal and pending operations');
            
            // Si está en modo búsqueda, recargar resultados de búsqueda
            if (this.isSearching) {
              this.loadSearchResults();
            } else {
              // Recargar operaciones pendientes primero, luego operaciones normales
              this.loadPendingOperations();
            }
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

  openEditOperationDialog(operation: OperationReadDto): void {
    console.log('🔍 openEditOperationDialog called for operation:', operation);
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
        
        // Recargar tanto las operaciones normales como las pendientes
        console.log('🔍 Operation updated successfully, reloading both normal and pending operations');
        
        // Si está en modo búsqueda, recargar resultados de búsqueda
        if (this.isSearching) {
          this.loadSearchResults();
        } else {
          // Recargar operaciones pendientes primero, luego operaciones normales
          this.loadPendingOperations();
        }
      }
    });
  }

  deleteOperation(operation: OperationReadDto): void {
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
            
            // Recargar tanto las operaciones normales como las pendientes
            console.log('🔍 Operation deleted successfully, reloading both normal and pending operations');
            
            // Si está en modo búsqueda, recargar resultados de búsqueda
            if (this.isSearching) {
              this.loadSearchResults();
            } else {
              // Recargar operaciones pendientes primero, luego operaciones normales
              this.loadPendingOperations();
            }
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
    // Verificar que la operación esté pendiente
    if (operation.status !== OperationStatusEnum.PENDING) {
      this.snackBar.open('Solo se pueden lanzar operaciones pendientes', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    // Consultar firmantes antes de lanzar
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

                // Recargar tanto las operaciones normales como las pendientes
                console.log('🔍 Operation launched successfully, reloading both normal and pending operations');
                
                // Si está en modo búsqueda, recargar resultados de búsqueda
                if (this.isSearching) {
                  this.loadSearchResults();
                } else {
                  // Recargar operaciones pendientes primero, luego operaciones normales
                  this.loadPendingOperations();
                }
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
    });
  }

  openViewOperationDialog(operation: OperationReadDto): void {
    console.log('🔍 openViewOperationDialog called for operation:', operation);
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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
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

  relaunchOperation(operation: OperationReadDto): void {
    console.log('🔍 relaunchOperation called for operation:', operation);
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
          console.log('🔍 Remote operation relaunched successfully, reloading both normal and pending operations');
          
          // Si está en modo búsqueda, recargar resultados de búsqueda
          if (this.isSearching) {
            this.loadSearchResults();
          } else {
            // Recargar operaciones pendientes primero, luego operaciones normales
            this.loadPendingOperations();
          }
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
            console.log('🔍 Local operation relaunched successfully, reloading both normal and pending operations');
            
            // Si está en modo búsqueda, recargar resultados de búsqueda
            if (this.isSearching) {
              this.loadSearchResults();
            } else {
              // Recargar operaciones pendientes primero, luego operaciones normales
              this.loadPendingOperations();
            }
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

  // Método temporal para verificar operaciones recibidas
  checkOperationsStatus(): void {
    console.log('🔍 === CHECKING OPERATIONS STATUS ===');
    console.log('🔍 All operations:', this.operations);
    console.log('🔍 Pending operations:', this.pendingOperations);
    console.log('🔍 Search results:', this.searchResults);
    
    if (this.operations.length > 0) {
      console.log('🔍 Operations status breakdown:');
      const statusCount = this.operations.reduce((acc, op) => {
        acc[op.status] = (acc[op.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('🔍 Status count:', statusCount);
      
      const pendingOps = this.operations.filter(op => op.status === 'Pendiente');
      console.log('🔍 Pending operations from main list:', pendingOps);
    }
    
    console.log('🔍 getDisplayPendingOperations result:', this.getDisplayPendingOperations());
    console.log('🔍 getDisplayNonPendingOperations result:', this.getDisplayNonPendingOperations());
    console.log('🔍 === END CHECKING ===');
  }


} 