// src/app/admin/company-list/company-list.component.ts

import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common'; // CommonModule y DatePipe si es standalone
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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Servicios y Modelos
import { AuthService } from '../../services/auth.service';
import { CompanyService } from '../../services/company.service';
import { Company } from '../../models/company.model';
import { UserReadDto } from '../../models/user-read.dto';
import { Role } from '../../models/role.enum';

// Componentes de Diálogo
import { CompanyFormComponent } from '../company-form/company-form.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-company-list',
  standalone: true, // Asumiendo standalone
  imports: [
    CommonModule, RouterLink,
    // Si no tienes un módulo Admin, necesitas importar los módulos aquí.
    MatSidenavModule, MatToolbarModule, MatIconModule, MatButtonModule,
    MatListModule, MatDividerModule, MatCardModule, MatProgressSpinnerModule,
    MatTableModule, MatTooltipModule, MatDialogModule, MatSnackBarModule,
    // ConfirmDialogComponent, // Si es standalone, impórtalo también
  ],
  templateUrl: './company-list.component.html',
  styleUrls: ['./company-list.component.css']
})
export class CompanyListComponent implements OnInit, OnDestroy {
  @ViewChild('drawer') drawer!: MatSidenav;

  companies: Company[] = [];
  isLoadingCompanies = false; // Renombrado para claridad
  companiesError: string | null = null; // Renombrado para claridad
  currentUser: UserReadDto | null = null;
  public Role = Role;

  // --- MODIFICACIÓN AQUÍ ---
  // Añadir 'numberOfAgents' y 'operationsUsage' al array de columnas a mostrar.
  displayedColumns: string[] = ['id', 'name', 'numberOfAgents', 'operationsUsage', 'createdAt', 'actions'];
  // --- FIN DE LA MODIFICACIÓN ---

  private subscriptions = new Subscription();

  constructor(
    private companyService: CompanyService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    public dialog: MatDialog,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser.subscribe(user => this.currentUser = user)
    );
    this.loadCompanies();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadCompanies(): void {
    this.isLoadingCompanies = true;
    this.companiesError = null;
    this.subscriptions.add(
      this.companyService.getCompanies().subscribe({
        next: data => {
          console.log('Datos de empresas recibidos:', data);
          // Asegurar que los campos de operaciones existen con valores por defecto
          this.companies = data.map(company => ({
            ...company,
            maxMonthlyOperations: company.maxMonthlyOperations ?? 0,
            currentMonthOperationsCount: company.currentMonthOperationsCount ?? 0,
            hasUnlimitedOperations: company.maxMonthlyOperations === 0 || company.hasUnlimitedOperations,
            hasReachedMonthlyLimit: company.hasReachedMonthlyLimit ?? false
          }));
          console.log('Empresas procesadas:', this.companies);
          this.isLoadingCompanies = false;
        },
        error: err => {
          this.isLoadingCompanies = false;
          this.companiesError = 'Error al cargar las empresas. Inténtelo de nuevo.';
          this.snackBar.open(this.companiesError, 'Cerrar', { duration: 5000, panelClass: ['error-snackbar'] });
          console.error(err);
        }
      })
    );
  }

  openCreateCompanyDialog(): void {
    const dialogRef = this.dialog.open(CompanyFormComponent, {
      width: '600px',
      maxHeight: '90vh',
      disableClose: true,
      data: null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.loadCompanies();
        this.snackBar.open('Empresa creada con éxito.', 'Cerrar', { duration: 3000, panelClass: ['success-snackbar'] });
      }
    });
  }

  openEditCompanyDialog(company: Company): void {
    const dialogRef = this.dialog.open(CompanyFormComponent, {
      width: '600px',
      maxHeight: '90vh',
      disableClose: true,
      data: company
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        this.loadCompanies();
        this.snackBar.open('Empresa actualizada con éxito.', 'Cerrar', { duration: 3000, panelClass: ['success-snackbar'] });
      }
    });
  }

  deleteCompany(company: Company): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { title: 'Confirmar Eliminación', message: `¿Estás seguro de que quieres eliminar la empresa "${company.name}"? Esta acción no se puede deshacer.` }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.subscriptions.add(
          this.companyService.deleteCompany(company.id).subscribe({
            next: () => {
              this.snackBar.open(`Empresa "${company.name}" eliminada.`, 'Cerrar', { duration: 3000, panelClass: ['success-snackbar'] });
              this.loadCompanies();
            },
            error: err => {
              const backendError = err.error?.message || err.message || 'Error desconocido';
              
              // Verificar si el error es por usuarios asociados
              const isUserRelatedError = backendError.toLowerCase().includes('usuario') || 
                                       backendError.toLowerCase().includes('user') ||
                                       backendError.toLowerCase().includes('asociado') ||
                                       backendError.toLowerCase().includes('asignado');
              
              let errorMessage: string;
              let panelClass: string[];
              
              if (isUserRelatedError) {
                errorMessage = `Advertencia: ${backendError}`;
                panelClass = ['warning-snackbar'];
              } else {
                errorMessage = `Error al borrar empresa: ${backendError}`;
                panelClass = ['error-snackbar'];
              }
              
              this.snackBar.open(errorMessage, 'Cerrar', { duration: 5000, panelClass: panelClass });
              console.error(err);
            }
          })
        );
      }
    });
  }

  // Métodos de navegación
  navigateToCompanies(): void {
    this.drawer.close();
    // Ya estamos aquí, pero podría recargar
    this.loadCompanies();
  }

  navigateToOperations(): void {
    this.drawer.close();
    this.snackBar.open('Navegación a "Operaciones" pendiente.', 'OK', { duration: 2000 });
    // this.router.navigate(['/admin/operations']);
  }

  navigateToUsers(): void {
    this.drawer.close();
    this.router.navigate(['/home']);
  }

  logout(): void {
    this.drawer.close();
    this.authService.logout();
  }
}