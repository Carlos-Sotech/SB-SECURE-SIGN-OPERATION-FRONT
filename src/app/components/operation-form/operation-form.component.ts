import { Component, inject, Inject, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, ElementRef, HostBinding, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';

import { OperationService } from '../../services/operation.service';
import { AgreementService } from '../../services/agreement.service';
import { PartyService } from '../../services/party.service';
import { Operation, OperationTypeEnum, OperationReadDto, OperationCreateDto, OperationStatusEnum } from '../../models/operation.model';
import { AgreementCreateDto, AgreementReadDto } from '../../models/agreement.model';
import { PartyCreateDto, PartyUpdateDto, PartyReadDto, PartyStatus } from '../../models/party.model';
import { AuthService } from '../../services/auth.service';
import { UserReadDto } from '../../models/user-read.dto';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { AgreementFormComponent } from '../agreement-form/agreement-form.component';
import { PartyFormComponent } from '../party-form/party-form.component';
import { SignatureService } from '../../services/signature.service';
import { FileUrlService } from '../../services/file-url.service';
import { LaunchOperationModalComponent } from '../launch-operation-modal/launch-operation-modal.component';
import { environment } from '../../../environments/environment';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { PdfSignatureVisualizerService } from '../../services/pdf-signature-visualizer.service';

export interface SignatureArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  partyId?: number;
  color: string;
}

@Component({
  selector: 'app-operation-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    NgxExtendedPdfViewerModule
  ],
  templateUrl: './operation-form.component.html',
  styleUrls: ['./operation-form.component.css'],
  host: {
    '[class.edit-mode]': 'isEditMode'
  }
})
export class OperationFormComponent implements OnInit, OnDestroy {
  // Inyección de dependencias con inject()
  private fb = inject(FormBuilder);
  private operationService = inject(OperationService);
  private agreementService = inject(AgreementService);
  private partyService = inject(PartyService);
  private signatureService = inject(SignatureService);
  private fileUrlService = inject(FileUrlService);
  private pdfSignatureService = inject(PdfSignatureVisualizerService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<OperationFormComponent>);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  authService = inject(AuthService);
  private router = inject(Router);

  operationForm: FormGroup;
  isSubmitting = false;
  operationTypes = Object.values(OperationTypeEnum);
  isEditMode = false;
  createdOperationId: number | null = null;
  selectedFile: File | null = null;
  originalFile: File | null = null; // Archivo original para enviar al backend
  pdfSrc: string | null = null;
  private pdfObjectUrl: string | null = null;
  showProcessingError = false; // Flag para mostrar anotación de error de procesamiento
  
  // Lists for agreements and parties
  agreements: AgreementReadDto[] = [];
  parties: PartyReadDto[] = [];
  isLoadingAgreements = false;
  isLoadingParties = false;
  isLoadingPdf = false;
  signatureAreas: SignatureArea[] = [];
  
  // Variables para el estado de lanzamiento
  isLaunchingOperation = false;
  operationId: number | null = null;
  currentPage: number = 1;

  // Signal para manejar actualizaciones de agreements
  private agreementUpdateSignal = signal<{type: 'created' | 'updated' | 'deleted', agreementId?: number} | null>(null);
  
  // Signal para manejar actualizaciones de parties
  private partyUpdateSignal = signal<{type: 'created' | 'updated' | 'deleted', partyId?: number} | null>(null);

  constructor() {
    this.operationForm = this.fb.group({
      minutesAlive: [null, [Validators.required, Validators.min(0)]],
      filePDF: [null, [Validators.required]],
      operationType: [OperationTypeEnum.LOCAL, Validators.required],
      readingAllPages: [false],
      isNecessaryConfirmReading: [false], 
      readingText: [null],
              descripcionOperacion: [null, Validators.required],

    });
  }

  currentUser: UserReadDto | null = null;
  
  // Variables para drag and drop
  isDraggingOver = false;

  ngOnInit(): void {
    this.authService.currentUser.subscribe((user) => {
      this.currentUser = user;
    });

    // Subscribe to isNecessaryConfirmReading changes to enable/disable related fields
    this.operationForm.get('isNecessaryConfirmReading')?.valueChanges.subscribe(confirmed => {
      this.onIsNecessaryConfirmReadingChange(confirmed);
    });
    
    // Subscribe to operationType changes specifically for remote operation validation
    this.operationForm.get('operationType')?.valueChanges.subscribe(operationType => {
      this.onOperationTypeChange(operationType);
    });

    console.log('🔍 === OPERATION FORM INITIALIZATION ===');
    console.log('🔍 Received data:', this.data);
    console.log('🔍 Operation exists:', !!this.data?.operation);
    console.log('🔍 isEdit flag:', this.data?.isEdit);
    console.log('🔍 isEdit type:', typeof this.data?.isEdit);
    console.log('🔍 Operation ID:', this.data?.operation?.id);
    this.operationId = this.data?.operation?.id ?? null;
    
    // Si solo tenemos el id de la operación, cargar los datos completos antes de inicializar el formulario
    if (this.data?.operation && Object.keys(this.data.operation).length === 1 && this.data.operation.id) {
      this.operationService.getOperationById(this.data.operation.id).subscribe(op => {
        this.data!.operation = op;
        this.isEditMode = true;
        this.initEditForm();
      });
      return;
    }

    // Si tenemos el objeto completo y isEdit, inicializar normalmente
    if (this.data?.operation && this.data?.isEdit) {
      this.isEditMode = true;
      this.initEditForm();
      return;
    }

    // Si no, modo creación
    this.onIsNecessaryConfirmReadingChange(true);
    
    // Debug: verificar el estado inicial del formulario en modo creación
    console.log('🔍 === CREATION MODE INITIALIZATION ===');
    console.log('🔍 Form initial state:', {
      valid: this.operationForm.valid,
      dirty: this.operationForm.dirty,
      touched: this.operationForm.touched,
      values: this.operationForm.value,
      errors: this.operationForm.errors
    });
    console.log('🔍 Individual field states:');
    Object.keys(this.operationForm.controls).forEach(key => {
      const control = this.operationForm.get(key);
      console.log(`🔍 ${key}:`, {
        value: control?.value,
        valid: control?.valid,
        errors: control?.errors,
        touched: control?.touched,
        dirty: control?.dirty
      });
    });
    console.log('🔍 ======================================');
    
    // Forzar la validación inicial del formulario
    this.operationForm.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  private initEditForm(): void {
    console.log('🔍 === initEditForm ===');
    console.log('🔍 Operation data for edit:', this.data?.operation);
    
    console.log('🔍 minutesAlive value from data:', this.data?.operation?.minutesAlive);

    this.operationForm.patchValue({
      minutesAlive: this.data?.operation?.minutesAlive ?? 0, // Siempre en horas
      filePDF: null,
      operationType: this.data?.operation?.operationType ?? OperationTypeEnum.LOCAL,
      readingAllPages: this.data?.operation?.readingAllPages ?? false,
      isNecessaryConfirmReading: this.data?.operation?.isNecessaryConfirmReading ?? false,
      readingText: this.data?.operation?.readingText || 'Es obligatoria la lectura del documento',
      descripcionOperacion: this.data?.operation?.descripcionOperacion || ''
    });
    
    // Debug: verificar que el campo se haya inicializado correctamente
    console.log('🔍 descripcionOperacion from data:', this.data?.operation?.descripcionOperacion);
    this.operationForm.get('filePDF')?.clearValidators();
    this.operationForm.get('filePDF')?.updateValueAndValidity();
    this.onIsNecessaryConfirmReadingChange(this.data?.operation?.isNecessaryConfirmReading ?? true);
    
    // Debug: verificar si hay filePDF para cargar
    console.log('🔍 [DEBUG] Verificando filePDF para cargar:');
    console.log('🔍 [DEBUG] this.data?.operation?.filePDF:', this.data?.operation?.filePDF);
    console.log('🔍 [DEBUG] this.data?.operation?.id:', this.data?.operation?.id);
    console.log('🔍 [DEBUG] isEditMode:', this.isEditMode);
    
    if (this.data?.operation?.filePDF) {
      console.log('🔍 [DEBUG] filePDF encontrado, llamando loadExistingPdf...');
      this.loadExistingPdf(this.data?.operation?.filePDF).catch(error => {
        console.error('Error loading existing PDF:', error);
      });
    } else {
      console.log('🔍 [DEBUG] No hay filePDF para cargar');
    }
    this.loadAgreements();
    this.loadParties();
    
    // Programar scroll automático después de que se carguen los datos
    setTimeout(() => {
      if (this.isEditMode) {
        console.log('🔍 initEditForm: Scheduling auto-scroll after data load');
        this.scrollToAgreementsAndParties();
      }
    }, 500); // Reducido de 2000ms a 500ms para mejor rendimiento
  }

  private async loadExistingPdf(pdfUrl: string): Promise<void> {
    console.log('🔄 [PDF LOADING] ===== INICIANDO loadExistingPdf =====');
    console.log('🔄 [PDF LOADING] Loading existing PDF from URL:', pdfUrl);
    console.log('🔄 [PDF LOADING] pdfUrl type:', typeof pdfUrl);
    console.log('🔄 [PDF LOADING] pdfUrl length:', pdfUrl?.length);
    
    if (!pdfUrl || pdfUrl.trim() === '') {
      console.warn('⚠️ [PDF LOADING] PDF URL is empty or invalid');
      this.isLoadingPdf = false;
      return;
    }
    
    console.log('🔄 [PDF LOADING] Setting isLoadingPdf to true');
    this.isLoadingPdf = true;

    try {
      // Verificar si ya tenemos el PDF en localStorage
      const operationId = this.data?.operation?.id;
      const localStorageKey = `pdf_operation_${operationId}`;
      let pdfFile: File | null = null;
      
      // Intentar cargar desde localStorage primero
      const storedPdfData = localStorage.getItem(localStorageKey);
      if (storedPdfData) {
        console.log('📁 [PDF LOADING] PDF encontrado en localStorage');
        try {
          const arrayBuffer = Uint8Array.from(JSON.parse(storedPdfData)).buffer;
          pdfFile = new File([arrayBuffer], 'existing.pdf', { type: 'application/pdf' });
          console.log('📁 [PDF LOADING] PDF cargado desde localStorage, tamaño:', pdfFile.size, 'bytes');
        } catch (parseError) {
          console.warn('⚠️ [PDF LOADING] Error parseando PDF de localStorage:', parseError);
          localStorage.removeItem(localStorageKey); // Limpiar datos corruptos
        }
      }
      
      // Si no está en localStorage, descargarlo del backend
      if (!pdfFile) {
        console.log('📁 [PDF LOADING] PDF no encontrado en localStorage, descargando del backend...');
        const pdfUrl_full = this.fileUrlService.getMediaFileUrl(pdfUrl, operationId);
        console.log('📁 [PDF LOADING] Using media file URL:', pdfUrl_full);
        
        const response = await fetch(pdfUrl_full);
        if (!response.ok) {
          throw new Error(`Error descargando PDF: ${response.status}`);
        }
        
        const blob = await response.blob();
        pdfFile = new File([blob], 'existing.pdf', { type: 'application/pdf' });
        
        console.log('📁 [PDF LOADING] PDF descargado del backend, tamaño:', blob.size, 'bytes');
        
        // Guardar en localStorage para uso futuro
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          localStorage.setItem(localStorageKey, JSON.stringify(Array.from(uint8Array)));
          console.log('💾 [PDF LOADING] PDF guardado en localStorage');
        } catch (storageError) {
          console.warn('⚠️ [PDF LOADING] Error guardando PDF en localStorage:', storageError);
        }
      }
      
      // IMPORTANTE: Guardar el archivo original para enviar al backend al guardar
      this.originalFile = pdfFile;
      
      // Procesar el PDF original para extraer firmas y mostrarlo procesado
      console.log('🔄 [PDF LOADING] Procesando PDF original para mostrar firmas visibles...');
      console.log('🔄 [PDF LOADING] Archivo a procesar:', pdfFile.name, 'tamaño:', pdfFile.size);
      
      try {
        await this.processPdfForDisplay(pdfFile);
        console.log('✅ [PDF LOADING] PDF original procesado y mostrado exitosamente');
        console.log('✅ [PDF LOADING] pdfSrc después del procesamiento:', this.pdfSrc);
      } catch (processError) {
        console.error('❌ [PDF LOADING] Error específico en processPdfForDisplay:', processError);
        throw processError; // Re-lanzar para que se maneje en el catch principal
      }
      
    } catch (error) {
      console.error('❌ [PDF LOADING] Error procesando PDF existente:', error);
      
      // Fallback: mostrar el PDF original sin procesar
      console.log('🔄 [PDF LOADING] Usando fallback - mostrando PDF original');
      this.pdfSrc = this.fileUrlService.getMediaFileUrl(pdfUrl, this.data?.operation?.id);
      this.isLoadingPdf = false;
      this.cdr.detectChanges();
    }
  }

  private loadAgreements(): void {
    if (!this.data?.operation?.id) return;
    
    this.isLoadingAgreements = true;
    this.agreementService.getAgreementsByOperation(this.data.operation.id).subscribe({
      next: (agreements) => {
        this.agreements = agreements;
        this.isLoadingAgreements = false;
      },
      error: (err) => {
        console.error('Error loading agreements:', err);
        this.isLoadingAgreements = false;
      }
    });
  }

  private loadParties(): void {
    if (!this.data?.operation?.id) return;
    
    this.isLoadingParties = true;
    this.partyService.getPartiesByOperation(this.data.operation.id).subscribe({
      next: (parties) => {
        this.parties = parties;
        this.isLoadingParties = false;
        
        // Recrear las signatureAreas basadas en las coordenadas de los parties
        this.recreateSignatureAreasFromParties();
        
        console.log('🔍 Parties loaded:', parties);
        console.log('🔍 Parties status debug:');
        parties.forEach(party => {
          console.log(`🔍 Party ${party.id} (${party.firstName} ${party.lastName}): status = "${party.status}"`);
        });
        console.log('🔍 Signature areas recreated:', this.signatureAreas);
      },
      error: (err) => {
        console.error('Error loading parties:', err);
        this.isLoadingParties = false;
      }
    });
  }

  // Nuevo método para recrear las áreas de firma desde los parties
  private recreateSignatureAreasFromParties(): void {
    console.log('🔍 ===== recreateSignatureAreasFromParties METHOD CALLED =====');
    console.log('🔍 Current parties:', this.parties);
    
    // Limpiar áreas existentes
    this.signatureAreas = [];
    
    // Recrear áreas para cada party que tenga coordenadas válidas
    this.parties.forEach(party => {
      console.log('🔍 Processing party:', party.id, 'with coordinates:', { x: party.x, y: party.y, width: party.width, height: party.height });
      
      // Crear área para todos los parties que tengan coordenadas (incluyendo las por defecto)
      if (party.x !== undefined && party.y !== undefined && party.width !== undefined && party.height !== undefined) {
        const area: SignatureArea = {
          id: `area_${party.id}_page_${party.page || 1}`,
          x: party.x,
          y: party.y,
          width: party.width,
          height: party.height,
          page: party.page || 1,
          partyId: party.id,
          color: this.getRandomColor()
        };
        
        this.signatureAreas.push(area);
        console.log('🔍 Created signature area for party:', party.id, area);
      } else {
        console.log('🔍 Party has no coordinates, skipping area creation:', party.id);
      }
    });
    
    console.log('🔍 Final signature areas:', this.signatureAreas);
  }

  // Métodos para manejar el canvas overlay (similar al signature-page)
  ngAfterViewInit(): void {
    // Si estamos en modo edición, hacer scroll automático a las secciones de Agreements y Parties
    if (this.isEditMode) {
      console.log('🔍 Modal opened in edit mode, scheduling auto-scroll to Agreements and Parties sections');
      setTimeout(() => {
        this.scrollToAgreementsAndParties();
      }, 1500); // Esperar un poco más para que el contenido se cargue completamente
    } else {
      console.log('🔍 Modal opened in create mode, no auto-scroll needed');
    }


  }

  scrollToAgreementsSection(): void {
    const agreementsSection = document.getElementById('agreementsSection');
    if (agreementsSection) {
      console.log('🔍 Scrolling to agreements section');
      agreementsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      console.log('🔍 Agreements section not found');
    }
  }

  scrollToAgreementsAndParties(): void {
    console.log('🔍 === STARTING AUTO-SCROLL TO AGREEMENTS AND PARTIES ===');
    console.log('🔍 Current isEditMode:', this.isEditMode);
    console.log('🔍 Modal data:', this.data);
    
    // Buscar el contenedor del modal para hacer scroll dentro de él
    const modalContainer = document.querySelector('.mat-dialog-container') as HTMLElement;
    if (!modalContainer) {
      console.log('🔍 Modal container not found, trying alternative selectors');
      // Intentar otros selectores comunes para modales de Angular Material
      const alternativeContainers = [
        document.querySelector('.cdk-overlay-pane'),
        document.querySelector('.mat-dialog-container'),
        document.querySelector('[role="dialog"]')
      ];
      
      const foundContainer = alternativeContainers.find(container => container !== null);
      if (!foundContainer) {
        console.log('🔍 No modal container found, aborting auto-scroll');
        return;
      }
    }

    // Buscar la sección de Agreements
    const agreementsSection = document.getElementById('agreementsSection');
    if (agreementsSection) {
      console.log('🔍 Found agreements section, scrolling to it');
      agreementsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } 
  }

  











  private getRandomColor(): string {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }



  openCreateAgreementDialog(): void {
    if (!this.data?.operation?.id) {
      this.snackBar.open('No se puede crear un acuerdo sin una operación.', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    const dialogRef = this.dialog.open(AgreementFormComponent, {
      width: '600px',
      height: '60vh',
      maxHeight: '500px',
      data: { 
        operationId: this.data.operation.id,
        parentDialogRef: this.dialogRef
      }
    });

    // Escuchar cuando se cierre el dialog de crear para actualizar los datos
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'saved') {
        // Actualizar la lista de agreements en lugar de reabrir el modal
        this.loadAgreements();
      }
    });
  }

  openEditAgreementDialog(agreement: AgreementReadDto): void {
    const dialogRef = this.dialog.open(AgreementFormComponent, {
      width: '600px',
      height: '60vh',
      maxHeight: '500px',
      disableClose: true,
      hasBackdrop: false,
      data: { 
        operationId: this.data!.operation!.id, 
        agreementToEdit: agreement,
        parentDialogRef: this.dialogRef
      }
    });

    // Escuchar cuando se cierre el dialog de editar para actualizar los datos
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'saved') {
        // Solo reabrir si se guardó exitosamente
        this.reopenOperationModal();
      }
    });
  }

  deleteAgreement(agreement: AgreementReadDto): void {
    this.agreementService.deleteAgreement(agreement.id).subscribe({
      next: () => {
        this.snackBar.open('Acuerdo eliminado exitosamente.', 'OK', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        // Cerrar y reabrir el modal de operación para mantener el estado
        this.reopenOperationModal();
      },
      error: (err) => {
        this.snackBar.open('Error al eliminar el acuerdo.', 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        console.error('Error deleting agreement:', err);
      }
    });
  }

  openCreatePartyDialog(): void {
    if (!this.data?.operation?.id) {
      this.snackBar.open('No se puede crear un firmante sin una operación.', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    // Validar que las operaciones remotas solo puedan tener un firmante
    // Esta es la única validación que se mantiene para operaciones remotas
    if (this.data.operation.operationType === OperationTypeEnum.REMOTA && this.parties.length >= 1) {
      this.snackBar.open('Las operaciones remotas solo pueden tener un firmante.', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    // Obtener los valores actuales del formulario para pasarlos al modal de firmante
    const currentFormValues = this.operationForm.value;
    const currentOperationData = {
      ...this.data.operation,
      minutesAlive: currentFormValues.minutesAlive,
      operationType: currentFormValues.operationType,
      readingAllPages: currentFormValues.readingAllPages,
      isNecessaryConfirmReading: currentFormValues.isNecessaryConfirmReading,
      readingText: currentFormValues.readingText || this.data.operation.readingText,
      descripcionOperacion: currentFormValues.descripcionOperacion || this.data.operation.descripcionOperacion
    };

    const dialogRef = this.dialog.open(PartyFormComponent, {
      width: '1300px',
      height: '90vh',
      maxHeight: '800px',
      data: { 
        operationId: this.data.operation.id,
        operationData: currentOperationData, // Usar los valores actuales del formulario
        parentDialogRef: this.dialogRef
      }
    });

    // Escuchar cuando se cierre el dialog de crear
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'saved') {
        // Si se guardó el firmante, refrescar la lista de parties
        this.loadParties();
        
        // Cerrar el modal de operación para evitar superposición con la página de firma
        // El estado del formulario ya se preservó en sessionStorage
        console.log('🔍 Party saved, closing operation modal to avoid overlay with signature page');
        this.dialogRef.close();
      }
    });
  }

  openEditPartyDialog(party: PartyReadDto): void {
    // Obtener los valores actuales del formulario para pasarlos al modal de firmante
    const currentFormValues = this.operationForm.value;
    const currentOperationData = {
      ...this.data!.operation!,
      minutesAlive: currentFormValues.minutesAlive,
      operationType: currentFormValues.operationType,
      readingAllPages: currentFormValues.readingAllPages,
      isNecessaryConfirmReading: currentFormValues.isNecessaryConfirmReading,
      readingText: currentFormValues.readingText || this.data!.operation!.readingText,
      descripcionOperacion: currentFormValues.descripcionOperacion || this.data!.operation!.descripcionOperacion
    };

    const dialogRef = this.dialog.open(PartyFormComponent, {
      width: '1300px',
      height: '90vh',
      maxHeight: '800px',
      disableClose: true,
      hasBackdrop: false,
      data: { 
        operationId: this.data!.operation!.id, 
        partyToEdit: party,
        operationData: currentOperationData, // Usar los valores actuales del formulario
        parentDialogRef: this.dialogRef
      }
    });

    // Escuchar cuando se cierre el dialog de editar para reabrir el modal de operación
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'saved') {
        // Solo reabrir si se guardó exitosamente
        this.reopenOperationModal();
        
      }
    });
  }

  deleteParty(party: PartyReadDto): void {
    // Nota: La validación de firmantes para operaciones remotas se maneja solo en la UI
    // permitiendo que el usuario decida cuántos firmantes mantener

    this.partyService.deleteParty(party.id).subscribe({
      next: () => {
        this.snackBar.open('Firmante eliminado exitosamente.', 'OK', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        // Cerrar y reabrir el modal de operación para mantener el estado
        this.reopenOperationModal();
      },
      error: (err) => {
        this.snackBar.open('Error al eliminar el firmante.', 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        console.error('Error deleting party:', err);
      }
    });
  }

  onFileSelected(event: Event): void {
    console.log('🔍 onFileSelected called');
    const file = (event.target as HTMLInputElement).files?.[0];
    console.log('🔍 Selected file:', file);
    
    if (file && file.type === 'application/pdf') {
      console.log('🔍 File is PDF, size:', file.size);
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        console.log('🔍 File too large');
        this.snackBar.open('El archivo es demasiado grande. Máximo 10MB.', 'Cerrar', { duration: 3000 });
        this.clearPdfFile();
        return;
      }
      
      // Guardar el archivo original para enviar al backend
      this.originalFile = file;
      this.selectedFile = file;
      this.operationForm.get('filePDF')?.setValue(this.originalFile); // El formulario siempre usa el original
      this.operationForm.get('filePDF')?.markAsTouched();
      
      // Establecer loading state
      this.isLoadingPdf = true;
      console.log('🔍 isLoadingPdf set to true');
      
      // Procesar el PDF para mostrar firmas visibles
      this.processPdfForDisplay(file);
    } else {
      console.log('🔍 File is not PDF, type:', file?.type);
      this.clearPdfFile();
      if (file) {
        this.snackBar.open('Por favor, selecciona un archivo PDF válido.', 'Cerrar', { duration: 3000 });
      }
    }
  }

  // Métodos para drag and drop
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      if (file.type === 'application/pdf') {
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          this.snackBar.open('El archivo es demasiado grande. Máximo 10MB.', 'Cerrar', { duration: 3000 });
          return;
        }

        // Simular el evento de selección de archivo
        this.originalFile = file;
        this.selectedFile = file;
        this.operationForm.get('filePDF')?.setValue(this.originalFile);
        this.operationForm.get('filePDF')?.markAsTouched();
        
        this.isLoadingPdf = true;
        this.processPdfForDisplay(file);
      } else {
        this.snackBar.open('Por favor, arrastra un archivo PDF válido.', 'Cerrar', { duration: 3000 });
      }
    }
  }

  private async processPdfForDisplay(file: File): Promise<void> {
    try {
      console.log('🔍 [PDF-PROCESSING] Intentando procesar PDF para mostrar firmas visibles...');
      console.log('🔍 [PDF-PROCESSING] Archivo recibido:', file.name, 'tamaño:', file.size, 'tipo:', file.type);
      
      // Procesar el PDF con firmas visibles
      console.log('🔍 [PDF-PROCESSING] Llamando a pdfSignatureService.generatePdfWithVisibleSignaturesFromFileFrontend...');
      const processedPdf = await this.pdfSignatureService.generatePdfWithVisibleSignaturesFromFileFrontend(file);
      
      console.log('🔍 [PDF-PROCESSING] PDF procesado exitosamente, tipo:', processedPdf.type, 'tamaño:', processedPdf.size);
      
      // Mostrar el PDF procesado en el visor
      if (this.pdfObjectUrl) {
        URL.revokeObjectURL(this.pdfObjectUrl);
      }
      this.pdfObjectUrl = URL.createObjectURL(processedPdf);
      this.pdfSrc = this.pdfObjectUrl;
      
      console.log('🔍 [PDF-PROCESSING] PDF procesado mostrado en visor');
      console.log('🔍 [PDF-PROCESSING] pdfSrc establecido a:', this.pdfSrc);
      
      // Desactivar flag de error si el procesamiento fue exitoso
      this.showProcessingError = false;
      
    } catch (error) {
      console.warn('⚠️ [PDF-PROCESSING] Error procesando PDF, mostrando original:', error);
      
      // Activar flag para mostrar anotación de error
      this.showProcessingError = true;
      
      // Mostrar mensaje informativo al usuario
      this.snackBar.open('Error procesando firmas. Mostrando PDF original.', 'Cerrar', { 
        duration: 3000,
        panelClass: ['warning-snackbar']
      });
      
      // Si falla el procesamiento, mostrar el PDF original
      if (this.pdfObjectUrl) {
        URL.revokeObjectURL(this.pdfObjectUrl);
      }
      this.pdfObjectUrl = URL.createObjectURL(file);
      this.pdfSrc = this.pdfObjectUrl;
      
      console.log('🔍 [PDF-PROCESSING] PDF original mostrado como fallback');
      
    } finally {
      // IMPORTANTE: Cambiar isLoadingPdf a false ANTES de detectChanges
      this.isLoadingPdf = false;
      console.log('🔍 [PDF-PROCESSING] isLoadingPdf set to false');
      
      // Forzar detección de cambios
      this.cdr.detectChanges();
      
      // Verificar estado después de detectChanges
      setTimeout(() => {
        console.log('🔍 [PDF-PROCESSING] State after detectChanges - isLoadingPdf:', this.isLoadingPdf, 'pdfSrc:', this.pdfSrc);
      }, 100);
    }
  }

  private async validatePdf(file: File): Promise<boolean> {
    try {
      console.log('🔍 [PDF-VALIDATION] Validando PDF...');
      
      // Leer el archivo como ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Verificar que el archivo comience con el header PDF
      const uint8Array = new Uint8Array(arrayBuffer);
      const header = String.fromCharCode(...uint8Array.slice(0, 8));
      
      if (!header.startsWith('%PDF-')) {
        console.error('❌ [PDF-VALIDATION] Archivo no es un PDF válido. Header:', header);
        return false;
      }
      
      // Verificar que el archivo termine con %%EOF
      const footer = String.fromCharCode(...uint8Array.slice(-8));
      if (!footer.includes('%%EOF')) {
        console.warn('⚠️ [PDF-VALIDATION] PDF puede estar corrupto. Footer:', footer);
        // No es crítico, algunos PDFs válidos no terminan con %%EOF
      }
      
      console.log('✅ [PDF-VALIDATION] PDF válido');
      return true;
      
    } catch (error) {
      console.error('❌ [PDF-VALIDATION] Error validando PDF:', error);
      return false;
    }
  }

  clearPdfFile(): void {
    this.selectedFile = null;
    this.originalFile = null;
    this.showProcessingError = false; // Limpiar flag de error
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }
    this.pdfSrc = null;
    this.operationForm.get('filePDF')?.setValue(null);
    this.operationForm.get('filePDF')?.markAsTouched();
    const fileInput = document.getElementById('filePDF') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  onSubmit(): void {
    console.log('🔍 OperationFormComponent onSubmit called');
    console.log('🔍 Current parties before submit:', this.parties);
    console.log('🔍 Current signatureAreas before submit:', this.signatureAreas);
    
    // Debug: mostrar el estado completo del formulario
    console.log('🔍 === FORM STATE DEBUG ===');
    console.log('🔍 Form valid:', this.operationForm.valid);
    console.log('🔍 Form dirty:', this.operationForm.dirty);
    console.log('🔍 Form touched:', this.operationForm.touched);
    console.log('🔍 Form values:', this.operationForm.value);
    console.log('🔍 Form errors:', this.operationForm.errors);
    console.log('🔍 ========================');
    
    if (this.isFormValid()) {
      this.isSubmitting = true;
      const formValue = this.operationForm.value;
      
      // Debug: mostrar todos los valores del formulario
              console.log('🔍 descripcionOperacion from form:', formValue.descripcionOperacion);
      
              // Debug: verificar el estado del campo en el formulario
        const descripcionControl = this.operationForm.get('descripcionOperacion');
        console.log('🔍 descripcionOperacion control value:', descripcionControl?.value);
      
      // Obtener el archivo PDF del formulario
      const filePDF = this.operationForm.get('filePDF')?.value;
      console.log('🔍 PDF file from form:', filePDF);
      console.log('🔍 selectedFile:', this.selectedFile);

      if (!this.currentUser?.id) {
        this.snackBar.open('No se puede crear la operación sin un usuario autenticado.', 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        return;
      }
      
      // Nota: La validación de firmantes para operaciones remotas se maneja solo en la UI
      // permitiendo que el usuario decida cuántos firmantes agregar
      
      // Create the operation data according to the DTO
      const operationData: OperationCreateDto = {
        minutesAlive: formValue.minutesAlive, // Siempre en horas - NO multiplicar por 60
        status: OperationStatusEnum.PENDING, // Default status, managed by backend
        userId: this.currentUser?.id, // This should come from the current user context
        operationType: formValue.operationType,
        readingAllPages: formValue.readingAllPages,
        readingConfirmed: false, // ya no se usa para "necesaria confirmación", pero requerido por backend
        readingText: formValue.readingText || undefined,
        certificateId: undefined, // Managed by backend
        isNecessaryConfirmReading: formValue.isNecessaryConfirmReading,
        descripcionOperacion: formValue.descripcionOperacion || ''
      };

      // Debug logs para verificar los valores de lectura
      console.log('🔍 Form values being sent:');
      console.log('🔍 isNecessaryConfirmReading:', formValue.isNecessaryConfirmReading);
      console.log('🔍 readingAllPages:', formValue.readingAllPages);
      console.log('🔍 readingText:', formValue.readingText);
      console.log('🔍 descripcionOperacion:', formValue.descripcionOperacion);
      console.log('🔍 Operation data:', operationData);

      if (this.isEditMode && this.data?.operation) {
        // Update operation
        this.operationService.updateOperation(this.data.operation.id, operationData, filePDF).subscribe({
          next: async (response) => {
            this.createdOperationId = response.id;
              
              this.isSubmitting = false;
            this.snackBar.open('Operación actualizada exitosamente.', 'OK', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
              this.dialogRef.close('saved');
          },
          error: (err) => {
            this.isSubmitting = false;
            this.snackBar.open(err.message || 'Error al actualizar operación.', 'Cerrar', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
            console.error('Error updating operation:', err);
          }
        });
      } else {
        // Create new operation with file
        this.operationService.createOperation(operationData, filePDF).subscribe({
          next: async (response) => {
            this.createdOperationId = response.id;
            this.isSubmitting = false;
            
            this.snackBar.open('Operación creada exitosamente.', 'OK', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            
            // Cerrar el diálogo actual y abrir el formulario de edición
            this.dialogRef.close('created');
            
            // Abrir automáticamente el formulario de edición
            setTimeout(() => {
              this.openEditOperationDialog(response);
            }, 100);
          },
          error: (err) => {
            this.isSubmitting = false;
            this.snackBar.open(err.message || 'Error al crear operación.', 'Cerrar', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
            console.error('Error creating operation:', err);
          }
        });
      }
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getOperationTypeText(operationType: OperationTypeEnum): string {
    switch (operationType) {
      case OperationTypeEnum.LOCAL: return 'Local';
      case OperationTypeEnum.REMOTA: return 'Remota';
      default: return operationType;
    }
  }

  getPartyStatusText(status: string): string {
    switch (status) {
      case 'Pending': return 'Pendiente';
      case 'Signed': return 'Firmado';
      case 'Omitted': return 'Omitido';
      default: return 'Desconocido';
    }
  }

  getPartyStatusColor(status: string): string {
    switch (status) {
      case 'Pending': return 'warn';
      case 'Signed': return 'primary';
      case 'Omitted': return 'accent';
      default: return 'warn';
    }
  }

  // Método para calcular la fecha de caducidad
  getExpirationDate(): string {
    const minutesAlive = this.operationForm.get('minutesAlive')?.value ;
    if (!minutesAlive || minutesAlive <= 0) {
      return 'Sin caducidad';
    }
    
    const now = new Date();
    const expirationDate = new Date(now.getTime() + (minutesAlive * 60 * 60 * 1000)); // minutesAlive ya está en horas, convertir a milisegundos
    
    return expirationDate.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

    // Método para verificar si el formulario es válido
  isFormValid(): boolean {
    const minutesAlive = this.operationForm.get('minutesAlive')?.value;
    const operationTypeValue = this.operationForm.get('operationType')?.value;
    const filePDF = this.operationForm.get('filePDF')?.value;
    const descripcionOperacion = this.operationForm.get('descripcionOperacion')?.value;
    
    const minutesAliveValid = minutesAlive !== null && minutesAlive !== undefined && minutesAlive >= 0;
    const operationTypeValid = operationTypeValue !== null && operationTypeValue !== undefined;
    
    // En modo edición, el PDF es opcional a menos que se haya seleccionado uno nuevo
    let filePDFValid = true;
    if (this.isEditMode) {
      const selectedFile = this.operationForm.get('filePDF')?.value;
      if (selectedFile) {
        filePDFValid = selectedFile !== null && selectedFile !== undefined;
      }
    } else {
      filePDFValid = filePDF !== null && filePDF !== undefined;
    }
    
    const descripcionOperacionValid = descripcionOperacion !== null && descripcionOperacion !== undefined && descripcionOperacion.trim() !== '';
    
    return minutesAliveValid && operationTypeValid && filePDFValid && descripcionOperacionValid;
  }

  // Método de debug para el template
  debugFormState(): void {
    console.log('🔍 === DEBUG FORM STATE FROM TEMPLATE ===');
    console.log('🔍 isFormValid():', this.isFormValid());
    console.log('🔍 isSubmitting:', this.isSubmitting);
    console.log('🔍 Form valid:', this.operationForm.valid);
    console.log('🔍 Form values:', this.operationForm.value);
    console.log('🔍 Form errors:', this.operationForm.errors);
    
    // Verificación manual de cada campo
    const minutesAlive = this.operationForm.get('minutesAlive')?.value;
    const operationType = this.operationForm.get('operationType')?.value;
    const filePDF = this.operationForm.get('filePDF')?.value;
    const descripcionOperacion = this.operationForm.get('descripcionOperacion')?.value;
    
    console.log('🔍 Manual validation check:');
    console.log('🔍 minutesAlive:', minutesAlive, 'valid:', minutesAlive !== null && minutesAlive !== undefined && minutesAlive >= 0);
    console.log('🔍 operationType:', operationType, 'valid:', operationType !== null && operationType !== undefined);
    console.log('🔍 filePDF:', filePDF, 'valid:', filePDF !== null && filePDF !== undefined);
    console.log('🔍 descripcionOperacion:', descripcionOperacion, 'valid:', descripcionOperacion !== null && descripcionOperacion !== undefined && descripcionOperacion.trim() !== '');
    
    // Verificar si es operación remota
    if (operationType === OperationTypeEnum.REMOTA) {
      console.log('🔍 Remote operation parties check:', this.parties.length, 'valid:', this.parties.length <= 1);
      console.log('🔍 Note: Remote operations are limited to 1 party in UI, but form validation allows any number');
    }
    
    // Verificar el estado del botón
    const buttonDisabled = !this.isFormValid() || this.isSubmitting;
    console.log('🔍 Button disabled:', buttonDisabled);
    console.log('🔍 ==========================================');
  }

  ngOnDestroy(): void {
    this.selectedFile = null;
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }
    
    // Limpiar localStorage del PDF si estamos en modo edición
    if (this.isEditMode && this.data?.operation?.id) {
      const localStorageKey = `pdf_operation_${this.data.operation.id}`;
      localStorage.removeItem(localStorageKey);
      console.log('🧹 [CLEANUP] PDF eliminado de localStorage:', localStorageKey);
    }
  }

  // Make data accessible from template
  get data() {
    return this._data;
  }
  private _data = inject<{ 
    operation?: OperationReadDto, 
    isEdit?: boolean
  }>(MAT_DIALOG_DATA, { optional: true });

  // Getter para verificar si se pueden agregar más firmantes
  get canAddMoreParties(): boolean {
    const operationType = this.operationForm.get('operationType')?.value;
    if (operationType === 'Remota') {
      return this.parties.length < 1;
    }
    return true; // Para operaciones locales, no hay límite
  }

  private onOperationTypeChange(newOperationType: OperationTypeEnum): void {
    console.log('🔍 onOperationTypeChange called with:', newOperationType);
    console.log('🔍 Current parties count:', this.parties.length);
    console.log('🔍 isEditMode:', this.isEditMode);
    
    if (newOperationType === OperationTypeEnum.REMOTA) {
      // Cambio a Remota: Solo permitir 1 firmante
      if (this.isEditMode && this.parties.length > 1) {
        console.log('🔍 Changing to REMOTA: More than 1 party exists, showing warning');
        
        // Mostrar mensaje pidiendo que borre primero los firmantes
        this.snackBar.open(
          `Para cambiar a operación remota, primero debe borrar los firmantes porque las operaciones remotas solo permiten uno.`, 
          'Cerrar', 
          { duration: 6000, panelClass: ['error-snackbar'] }
        );
        
        // Revertir el cambio en el formulario
        this.operationForm.get('operationType')?.setValue(OperationTypeEnum.LOCAL);
      } else {
        console.log('🔍 Changing to REMOTA: Valid (0 or 1 parties)');
        // Mostrar mensaje informativo
        this.snackBar.open(
          `Operación remota: Máximo un firmante permitido.`, 
          'Cerrar', 
          { duration: 3000, panelClass: ['info-snackbar'] }
        );
      }
    } else if (newOperationType === OperationTypeEnum.LOCAL) {
      // Cambio a Local: Permitir tantos firmantes como sean necesarios
      console.log('🔍 Changing to LOCAL: Allowing multiple parties');
      this.snackBar.open(
        `Operación local: Puedes agregar tantos firmantes como necesites.`, 
        'Cerrar', 
        { duration: 3000, panelClass: ['success-snackbar'] }
      );
    }
  }

  private onIsNecessaryConfirmReadingChange(confirmed: boolean): void {
    const readingAllPagesControl = this.operationForm.get('readingAllPages');
    const readingTextControl = this.operationForm.get('readingText');
    
    if (!confirmed) {
      // Usar emitEvent: false para evitar disparar valueChanges y crear un bucle
      readingAllPagesControl?.setValue(false, { emitEvent: false });
      readingTextControl?.setValue('', { emitEvent: false });
    } else {
      // Solo establecer valor por defecto si está null o vacío
      if (readingTextControl?.value === null || readingTextControl?.value === '') {
        readingTextControl.setValue('Es obligatoria la lectura del documento', { emitEvent: false });
      }
      // No hacer nada con readingAllPagesControl si confirmed es true - mantener el valor del usuario
    }
  }

  getAreasForParty(partyId: number): SignatureArea[] {
    return this.signatureAreas.filter(a => a.partyId === partyId);
  }

  getAllAreas(): SignatureArea[] {
    return this.signatureAreas;
  }

  removeAreaFromParty(areaId: string, event?: Event) {
    if (event && event.cancelable) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.signatureAreas = this.signatureAreas.filter(a => a.id !== areaId);
  }

  deleteArea(areaId: string) {
    this.signatureAreas = this.signatureAreas.filter(a => a.id !== areaId);
  }

  // Métodos para manejar eventos del PDF viewer
  onPdfLoadingStarted(event: any): void {
    // NO establecer isLoadingPdf = true aquí porque el PDF viewer puede disparar
    // este evento múltiples veces durante el renderizado interno, lo que ocultaría
    // el contenedor ya visible. isLoadingPdf solo debe usarse para la carga inicial del archivo.
    // El estado isLoadingPdf ya se maneja en onFileSelected y loadExistingPdf
    
    // Asegurar que el contenedor tenga position: relative ANTES de que el PDF viewer se inicialice
    const ensureContainerPosition = () => {
      // Buscar el contenedor principal
      const containerElement = document.querySelector('.pdf-viewer-container') as HTMLElement;
      if (containerElement) {
        containerElement.style.setProperty('position', 'relative', 'important');
        console.log('🔍 [PDF LOADING] Container position set to relative (CRITICAL)');
      }
      
      // También buscar y configurar contenedores internos que el PDF viewer crea
      const outerContainer = document.querySelector('.pdf-viewer #outerContainer') as HTMLElement;
      if (outerContainer) {
        const style = window.getComputedStyle(outerContainer);
        if (style.position === 'static' || !style.position) {
          outerContainer.style.setProperty('position', 'relative', 'important');
          console.log('🔍 [PDF LOADING] OuterContainer position set to relative');
        }
      }
      
      const mainContainer = document.querySelector('.pdf-viewer #mainContainer') as HTMLElement;
      if (mainContainer) {
        const style = window.getComputedStyle(mainContainer);
        if (style.position === 'static' || !style.position) {
          mainContainer.style.setProperty('position', 'relative', 'important');
          console.log('🔍 [PDF LOADING] MainContainer position set to relative');
        }
      }
      
      // Buscar el elemento que ngx-extended-pdf-viewer crea directamente
      const pdfViewerHost = document.querySelector('ngx-extended-pdf-viewer') as HTMLElement;
      if (pdfViewerHost) {
        pdfViewerHost.style.setProperty('position', 'relative', 'important');
        console.log('🔍 [PDF LOADING] PDF viewer host position set to relative');
      }
    };
    
    // Ejecutar inmediatamente
    requestAnimationFrame(ensureContainerPosition);
    
    // También intentar después de pequeños delays para asegurar que el DOM esté listo
    setTimeout(ensureContainerPosition, 5);
    setTimeout(ensureContainerPosition, 10);
    setTimeout(ensureContainerPosition, 50);
  }

  onPdfLoaded(event: any): void {
    console.log('🔍 [PDF LOADING] PDF loaded successfully:', event);
    console.log('🔍 [PDF LOADING] Setting isLoadingPdf to false');
    this.isLoadingPdf = false;
    
    // Forzar detección de cambios después de que el PDF se haya cargado
    this.cdr.detectChanges();
  }



  onPdfError(error: any): void {
    console.error('🔍 [PDF LOADING] PDF loading error:', error);
    console.log('🔍 [PDF LOADING] Setting isLoadingPdf to false due to error');
    this.isLoadingPdf = false;
    
    // Forzar detección de cambios después del error
    this.cdr.detectChanges();
    
    this.snackBar.open('Error al cargar el PDF', 'Cerrar', { duration: 3000 });
  }

  onPageChange(event: any): void {
    this.currentPage = event.pageNumber || 1;
  }

  // Método para verificar si la operación puede ser lanzada
  canLaunchOperation(): boolean {
    if (!this.data?.operation) return false;
    
    // Verificar que la operación esté pendiente
    if (this.data.operation.status !== 'Pendiente') return false;
    
    // Verificar que tenga parties
    if (!this.parties || this.parties.length === 0) return false;
    
    // Nota: La validación específica de firmantes para operaciones remotas
    // se maneja solo en la UI, permitiendo que el usuario decida
    // cuántos firmantes agregar antes de lanzar
    
    return true;
  }

  // Método de debug para verificar coordenadas
  



  // Método para iniciar la definición de área para un firmante específico
  startDefiningAreaForParty(partyId: number): void {
    console.log('🔍 startDefiningAreaForParty called with partyId:', partyId);
    console.log('🔍 Operation data:', this.data?.operation);
    console.log('🔍 Operation ID:', this.data?.operation?.id);
    
    if (!this.data?.operation?.id) {
      console.error('🔍 No operation ID available');
      this.snackBar.open('Error: No se pudo obtener el ID de la operación', 'Cerrar', { duration: 3000 });
      return;
    }
    
    try {
      console.log('🔍 startDefiningAreaForParty called for partyId:', partyId);
      
      // Guardar el origen en sessionStorage
      const currentUrl = this.router.url;
      let origin = 'operation-list'; // Default origin
      
      // Obtener los valores actuales del formulario para asegurar que se guarden los cambios
      const currentFormValues = this.operationForm.value;
      console.log('🔍 Current form values:', currentFormValues);
      
      // Crear una copia limpia del objeto operation sin referencias circulares
      // Usar los valores actuales del formulario en lugar de los datos originales
      const cleanOperation = {
        id: this.data.operation.id,
        minutesAlive: currentFormValues.minutesAlive, // Ya está en horas del formulario
        status: this.data.operation.status,
        userId: this.data.operation.userId,
        userName: this.data.operation.userName,
        operationType: currentFormValues.operationType,
        filePDF: this.data.operation.filePDF,
        readingAllPages: currentFormValues.readingAllPages,
        isNecessaryConfirmReading: currentFormValues.isNecessaryConfirmReading,
        readingText: currentFormValues.readingText || this.data.operation.readingText,
        createdAt: this.data.operation.createdAt,
        updatedAt: this.data.operation.updatedAt,
        descripcionOperacion: currentFormValues.descripcionOperacion || this.data.operation.descripcionOperacion
      };
      
      const modalDataToSave = {
        type: 'operation-form',
        config: {
                  data: { 
          operation: cleanOperation,
          isEdit: true
        }
        }
      };

      if (currentUrl.includes('/user-list')) {
        origin = 'user-list';
      } else if (currentUrl.includes('/operation-list')) {
        origin = 'operation-list';
      }
      
      const modalDataString = JSON.stringify(modalDataToSave);
      console.log('🔍 JSON string being saved:', modalDataString);
      sessionStorage.setItem('modalData', modalDataString);
      
      // Guardar el origen para que SignaturePageComponent sepa de dónde viene
      sessionStorage.setItem('signatureOrigin', origin);
      
      if (modalDataString) {
        const parsedData = JSON.parse(modalDataString);
        console.log('🔍 Parsed data from sessionStorage:', parsedData);
        console.log('🔍 isEdit value after parse:', parsedData.config.data.isEdit);
        console.log('🔍 isEdit type after parse:', typeof parsedData.config.data.isEdit);
      }
      
      // Marcar que al volver se debe reabrir el modal
      sessionStorage.setItem('returnToModal', 'true');

      // Cerrar cualquier modal abierto de forma contundente antes de navegar
      try { this.dialogRef.close(); } catch {}
      this.dialog.closeAll();

      // Navegar a la página de firma una vez cerrados los diálogos
      setTimeout(() => {
        console.log('🔍 Navigating to signature page after closing dialogs...');
        console.log('🔍 Current data.operation:', this.data?.operation);
        console.log('🔍 Operation ID being used for navigation:', this.data!.operation!.id);
        console.log('🔍 Party ID:', partyId);
        this.router.navigate(['/signature', this.data!.operation!.id], { 
          queryParams: { partyId: partyId.toString() } 
        }).catch((error) => {
          console.error('🔍 Navigation error:', error);
          this.snackBar.open('Error al navegar a la página de firma', 'Cerrar', { duration: 3000 });
        });
      }, 100);
      
    } catch (error) {
      console.error('🔍 Error in startDefiningAreaForParty:', error);
      this.snackBar.open('Error al abrir la página de firma', 'Cerrar', { duration: 3000 });
    }
  }

  // Método para lanzar la operación
  launchOperation(): void {
    if (!this.data?.operation) {
      this.snackBar.open('No hay operación disponible para lanzar', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    // Verificar que la operación esté pendiente
    if (this.data.operation.status !== 'Pendiente') {
      this.snackBar.open('Solo se pueden lanzar operaciones pendientes', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    // Consultar firmantes antes de lanzar
    this.partyService.getPartiesByOperation(this.data.operation.id).subscribe({
      next: (parties) => {
        if (!parties || parties.length === 0) {
          this.snackBar.open('No puedes lanzar la operación porque no tiene firmantes asignados.', 'Cerrar', {
            duration: 4000,
            panelClass: ['error-snackbar']
          });
          return;
        }


            this.isLaunchingOperation = true;

            // Lanzar la operación
            this.signatureService.launchOperation(this.data!.operation!.id).subscribe({
              next: (response) => {
                this.isLaunchingOperation = false;
                
                // Mostrar modal de éxito
                this.dialog.open(LaunchOperationModalComponent, {
                  width: '600px',
                  data: {
                    message: response.message || 'Operación lanzada exitosamente',
                    operationId: this.data!.operation!.id,
                    externalId: this.extractExternalIdFromMessage(response.message || ''), // Extraer del mensaje
                    operationType: this.data!.operation!.operationType // Pasar el tipo de operación
                  }
                });

                // Cerrar el formulario después de lanzar la operación
                this.dialogRef.close('launched');
              },
              error: (err) => {
                this.isLaunchingOperation = false;
                console.error('Error al lanzar operación:', err);
                this.snackBar.open('Error al lanzar la operación: ' + (err.error?.message || err.message || 'Error desconocido'), 'Cerrar', {
                  duration: 5000,
                  panelClass: ['error-snackbar']
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

  private extractExternalIdFromMessage(message: string): string {
    // Buscar un UUID en el mensaje (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = message.match(uuidRegex);
    if (match) {
      return match[0];
    }
    return '';
  }

  // Método de debug para verificar el estado actual del formulario
  

  // Método para forzar la actualización de los campos de lectura
  forceUpdateReadingFields(): void {
    console.log('🔍 === FORCE UPDATE READING FIELDS ===');
    
    if (this.data?.operation) {
      console.log('🔍 Forcing update with backend data...');
      
      // Forzar el valor a true para operaciones existentes
      const isNecessaryConfirmReading = true;
      
      this.operationForm.patchValue({
        isNecessaryConfirmReading: isNecessaryConfirmReading,
        readingAllPages: this.data.operation.readingAllPages,
        readingText: this.data.operation.readingText || ''
      });
      
      console.log('🔍 After force update:');
      console.log('🔍 - isNecessaryConfirmReading:', this.operationForm.get('isNecessaryConfirmReading')?.value);
      console.log('🔍 - readingAllPages:', this.operationForm.get('readingAllPages')?.value);
      console.log('🔍 - readingText:', this.operationForm.get('readingText')?.value);
      
      this.snackBar.open('Campos de lectura actualizados forzadamente', 'OK', { duration: 2000 });
    } else {
      console.log('🔍 No operation data available for force update');
      this.snackBar.open('No hay datos de operación disponibles', 'Cerrar', { duration: 2000 });
    }
  }

  // Método para abrir el formulario de edición de una operación
  private openEditOperationDialog(operation: OperationReadDto): void {
    console.log('🔍 Operation descripcionOperacion:', operation.descripcionOperacion);
    
    const dialogRef = this.dialog.open(OperationFormComponent, {
      width: '100vw',
      height: '100vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      data: { operation: operation, isEdit: true }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'saved' || result === 'launched') {
        // La operación fue actualizada o lanzada exitosamente
        console.log('Operación editada exitosamente');
      }
    });
  }

  @HostBinding('class.edit-mode') get isEditModeHost() {
    return this.isEditMode;
  }

  @HostBinding('class.edit-mode') get editModeClass() {
    return this.isEditMode;
  }

  // Método para cerrar y reabrir el modal de operación
  public reopenOperationModal(): void {
    console.log('🔍 === reopenOperationModal() called ===');
    if (!this.data?.operation) {
      console.error('No operation data available for reopening modal');
      return;
    }

    // Guardar los datos actuales de la operación
    const operationData = this.data.operation;
    const isEdit = this.isEditMode;
    console.log('🔍 Operation data:', operationData);
    console.log('🔍 isEdit mode:', isEdit);

    // Cerrar el modal actual
    console.log('🔍 Closing current modal...');
    this.dialogRef.close();

    // Hacer fetch de la operación actualizada antes de reabrir
    console.log('🔍 Fetching updated operation data...');
    this.operationService.getOperationById(operationData.id).subscribe({
      next: (updatedOperation) => {
        console.log('🔍 Operation data fetched successfully:', updatedOperation);
        
        // Reabrir el modal con los datos actualizados
        setTimeout(() => {
          console.log('🔍 Reopening modal with updated data...');
          const newDialogRef = this.dialog.open(OperationFormComponent, {
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            data: { 
              operation: updatedOperation, 
              isEdit: isEdit 
            }
          });

          // Manejar el cierre del nuevo modal
          newDialogRef.afterClosed().subscribe(result => {
            if (result === 'saved' || result === 'launched') {
              console.log('🔍 Operation modal reopened successfully with updated data');
            }
          });
        }, 100);
      },
      error: (err) => {
        console.error('🔍 Error fetching updated operation data:', err);
        
        // Si falla el fetch, reabrir con los datos originales
        setTimeout(() => {
          console.log('🔍 Reopening modal with original data (fallback)...');
          const newDialogRef = this.dialog.open(OperationFormComponent, {
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            data: { 
              operation: operationData, 
              isEdit: isEdit 
            }
          });

          // Manejar el cierre del nuevo modal
          newDialogRef.afterClosed().subscribe(result => {
            if (result === 'saved' || result === 'launched') {
              console.log('🔍 Operation modal reopened with original data');
            }
          });
        }, 100);
      }
    });
  }
}
