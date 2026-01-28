import { Component, inject, Inject, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
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

import { OperationService } from '../../services/operation.service';
import { AgreementService } from '../../services/agreement.service';
import { PartyService } from '../../services/party.service';
import { PdfSignatureVisualizerService } from '../../services/pdf-signature-visualizer.service';
import { Operation, OperationTypeEnum, OperationReadDto, OperationStatusEnum } from '../../models/operation.model';
import { AgreementReadDto } from '../../models/agreement.model';
import { PartyReadDto, PartyStatus } from '../../models/party.model';
import { AuthService } from '../../services/auth.service';
import { UserReadDto } from '../../models/user-read.dto';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { environment } from '../../../environments/environment';
import { SignatureService } from '../../services/signature.service';
import { FileUrlService } from '../../services/file-url.service';

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
  selector: 'app-operation-view',
  standalone: true,
  imports: [
    CommonModule,
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
  templateUrl: './operation-view.component.html',
  styleUrls: ['./operation-view.component.css']
})
export class OperationViewComponent implements OnInit, OnDestroy {
  totalPages: number = 1;
  // Inyección de dependencias con inject()
  private operationService = inject(OperationService);
  private agreementService = inject(AgreementService);
  private partyService = inject(PartyService);
  private pdfSignatureService = inject(PdfSignatureVisualizerService);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<OperationViewComponent>);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  authService = inject(AuthService);
  private router = inject(Router);
  private signatureService = inject(SignatureService);
  private fileUrlService = inject(FileUrlService);
  isOverPdf = false;

@HostListener('window:wheel', ['$event'])
onWindowScroll(event: WheelEvent) {
  if (!this.isOverPdf) {
    window.scrollBy(0, event.deltaY);
    if (event.cancelable) {
      event.preventDefault();
    }
  }
}

  operationTypeEnum = OperationTypeEnum;
  operationStatusEnum = OperationStatusEnum;

  operationTypes = Object.values(OperationTypeEnum);
  operation: OperationReadDto | null = null;
  pdfSrc: string | null = null;
  private pdfObjectUrl: string | null = null;
  
  // Variables para el procesamiento de PDF
  originalFile: File | null = null;
  showProcessingError = false;
  
  // Lists for agreements and parties
  agreements: AgreementReadDto[] = [];
  parties: PartyReadDto[] = [];
  isLoadingAgreements = false;
  isLoadingParties = false;
  isLoadingPdf = false;
  signatureAreas: SignatureArea[] = [];
  isPdfCopy = false; // Nueva propiedad para rastrear si se está mostrando la copia
  
  // Auditoría
  hasAuditFile = false;
  isLoadingAudit = false;
  
  // Variables para el canvas overlay (solo visualización)
  @ViewChild('signatureCanvas', { static: false }) signatureCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfContainer', { static: false }) pdfContainerRef!: ElementRef<HTMLDivElement>;
  
  private canvasCtx: CanvasRenderingContext2D | null = null;
  
  // Variables para los listeners
  private viewerContainerScrollListener: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  
  // Variables para prevenir bucles infinitos
  private isResizing = false;
  private resizeTimeout: any = null;
  private isRendering = false;
  
  // Variables para las posiciones de las páginas
  private pagePositions: { top: number, height: number }[] = [];

  currentPage: number = 1;

  goToFirstPage(): void {
    if (this.currentPage > 1) {
      this.currentPage = 1;
    }
  }
  
  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToLastPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

  onPagesLoaded(event: any): void {
    this.totalPages = event?.pagesCount || 1;
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

  currentUser: UserReadDto | null = null;

  ngOnInit(): void {
    this.authService.currentUser.subscribe((user) => {
      this.currentUser = user;
    });

    if (this.data?.operation) {
      console.log('🔄 [INIT] Loading operation for view:', this.data.operation);
      console.log('📋 [INIT] Operation ID:', this.data.operation.id);
      console.log('📋 [INIT] Operation status:', this.data.operation.status);
      console.log('📋 [INIT] Operation filePDF:', this.data.operation.filePDF);
      this.operation = this.data.operation;
      
      // Load existing PDF if available
      console.log('🔄 [INIT] Checking for existing PDF:', this.operation.filePDF);
      if (this.operation.filePDF) {
        console.log('✅ [INIT] PDF file found, starting load process...');
        this.loadExistingPdf(this.operation.filePDF);
      } else {
        console.log('⚠️ [INIT] No PDF file found for this operation');
      }

             // Load existing agreements and parties
       console.log('🔄 [INIT] Loading agreements and parties...');
       this.loadAgreements();
       this.loadParties();
       
               // Verificar si existe archivo de auditoría (para operaciones completadas o rechazadas)
        if (this.operation.status === OperationStatusEnum.COMPLETADA || this.operation.status === OperationStatusEnum.RECHAZADA) {
          console.log('🔄 [INIT] Operation is completed or rejected, checking for audit file...');
          console.log('🔄 [INIT] Operation status value:', this.operation.status);
          console.log('🔄 [INIT] OperationStatusEnum.COMPLETADA value:', OperationStatusEnum.COMPLETADA);
          console.log('🔄 [INIT] OperationStatusEnum.RECHAZADA value:', OperationStatusEnum.RECHAZADA);
          console.log('🔄 [INIT] Status comparison result:', this.operation.status === OperationStatusEnum.COMPLETADA || this.operation.status === OperationStatusEnum.RECHAZADA);
          this.checkAuditFileExists();
        } else {
          console.log('🔄 [INIT] Operation is NOT completed or rejected, status:', this.operation.status);
          console.log('🔄 [INIT] Skipping audit file check');
        }
    } else {
      console.error('❌ [INIT] No operation data provided');
    }
  }

  private loadExistingPdf(pdfUrl: string): void {
    console.log('🔄 [PDF LOADING] loadExistingPdf called with URL:', pdfUrl);
    if (!pdfUrl || pdfUrl.trim() === '') {
      console.warn('⚠️ [PDF LOADING] PDF URL is empty or invalid');
      return;
    }
    this.isLoadingPdf = true;
    this.showProcessingError = false;

    // Si la operación está completada, obtener el PDF firmado
    if (this.operation?.status === OperationStatusEnum.COMPLETADA) {
      console.log('✅ [PDF LOADING] Operation is completed, loading signed PDF from SSS');
      this.loadSignedPdf();
      return;
    }

    // Solo para operaciones no completadas, cargar y procesar el PDF original
    console.log('📄 [PDF LOADING] Operation is not completed, loading and processing original PDF');
    this.loadAndProcessOriginalPdf(pdfUrl);
  }

  private async loadAndProcessOriginalPdf(pdfUrl: string): Promise<void> {
    try {
      // Obtener el PDF como blob desde el servicio
      const pdfBlob = await this.operationService.getOperationPdf(this.operation!.id!).toPromise();
      
      // Convertir el blob a File para procesamiento
      const fileName = this.operation?.filePDF || 'document.pdf';
      this.originalFile = new File([pdfBlob!], fileName, { type: 'application/pdf' });
      
      // Procesar el PDF para mostrar firmas visibles
      await this.processPdfForDisplay();
      
    } catch (error) {
      console.error('❌ [PDF LOADING] Error loading original PDF:', error);
      
      // En caso de error, cargar el PDF original sin procesar
      this.pdfSrc = this.fileUrlService.getMediaFileUrl(pdfUrl, this.operation?.id);
      this.isLoadingPdf = false;
      this.isPdfCopy = true;
      
      this.snackBar.open(
        'Error cargando PDF. Se muestra el documento original.',
        'Cerrar',
        { duration: 4000 }
      );
    }
  }

  private async processPdfForDisplay(): Promise<void> {
    if (!this.originalFile) {
      console.warn('No hay archivo original para procesar');
      this.isLoadingPdf = false;
      return;
    }

    try {
      console.log('🔄 [OPERATION-VIEW] Procesando PDF para mostrar firmas visibles...');
      
      // Procesar el PDF para extraer y mostrar firmas
      const processedBlob = await this.pdfSignatureService.generatePdfWithVisibleSignaturesFromFileFrontend(this.originalFile);
      
      // Crear URL del PDF procesado
      this.pdfSrc = URL.createObjectURL(processedBlob);
      this.isLoadingPdf = false;
      this.isPdfCopy = true;
      console.log('✅ [OPERATION-VIEW] PDF procesado exitosamente con firmas visibles');
      
    } catch (error) {
      console.error('❌ [OPERATION-VIEW] Error procesando PDF:', error);
      
      // En caso de error, mostrar el PDF original con anotación de error
      this.pdfSrc = URL.createObjectURL(this.originalFile);
      this.showProcessingError = true;
      this.isLoadingPdf = false;
      this.isPdfCopy = true;
      
      // Dibujar anotación de error en el canvas
      setTimeout(() => {
        this.drawProcessingErrorAnnotation();
      }, 1000);
      
      this.snackBar.open(
        'Error procesando firmas del PDF. Se muestra el documento original.',
        'Cerrar',
        { duration: 4000 }
      );
    } finally {
      // Forzar detección de cambios para actualizar la vista
      this.cdr.detectChanges();
    }
  }

  private loadSignedPdf(): void {
    if (!this.operation?.id) {
      console.error('❌ [PDF LOADING] No operation ID available for loading signed PDF');
      this.isLoadingPdf = false;
      return;
    }

    console.log('🔄 [PDF LOADING] loadSignedPdf called for operation:', this.operation.id);
    console.log('📋 [PDF LOADING] Operation status:', this.operation.status);
    console.log('📋 [PDF LOADING] Original PDF filename:', this.operation.filePDF);
    console.log('🔄 [PDF LOADING] About to call signatureService.getSignedPdfCopy...');
    
    // Siempre intentar cargar el PDF firmado
    console.log('🔄 [PDF LOADING] Step 1: Attempting to load signed PDF copy from SSS...');
    this.signatureService.getSignedPdfCopy(this.operation.id).subscribe({
      next: (blob) => {
        console.log('✅ [PDF LOADING] SUCCESS: Signed PDF copy loaded from SSS');
        console.log('📊 [PDF LOADING] Blob size:', blob.size, 'bytes');
        console.log('📄 [PDF LOADING] Expected filename pattern: operation_${this.operation.id}_*_copy.pdf');
        console.log('🔄 [PDF LOADING] Creating blob URL...');
        
        // Crear URL del blob para mostrar información
        const url = URL.createObjectURL(blob);
        console.log('📄 [PDF LOADING] Blob URL created:', url);
        console.log('🔄 [PDF LOADING] Setting pdfSrc to blob URL...');
        
        this.pdfSrc = url;
        this.isLoadingPdf = false;
        this.isPdfCopy = true; // Marcar que se está mostrando la copia
        console.log('📄 [PDF LOADING] PDF Source set to signed copy (isPdfCopy = true)');
        
        // Forzar detección de cambios para actualizar la vista
        this.cdr.detectChanges();
        console.log('✅ [PDF LOADING] SUCCESS: PDF copy loading completed successfully');
      },
      error: (err) => {
        console.log('⚠️ [PDF LOADING] Step 1 FAILED: PDF copy not found, error:', err);
        console.log('📋 [PDF LOADING] Error details:', JSON.stringify(err, null, 2));
        console.log('🔄 [PDF LOADING] Step 2: Attempting to load original signed PDF from SSS...');
        // Si no existe la copia, intentar con el PDF firmado original
        if (this.operation?.id) {
          console.log('🔄 [PDF LOADING] About to call signatureService.getSignedPdf...');
          this.signatureService.getSignedPdf(this.operation.id).subscribe({
            next: (blob) => {
              console.log('✅ [PDF LOADING] SUCCESS: Original signed PDF loaded from SSS');
              console.log('📊 [PDF LOADING] Blob size:', blob.size, 'bytes');
              console.log('📄 [PDF LOADING] Expected filename pattern: operation_${this.operation.id}_*_signed.pdf');
              console.log('🔄 [PDF LOADING] Creating blob URL for original signed...');
              
              // Crear URL del blob para mostrar información
              const url = URL.createObjectURL(blob);
              console.log('📄 [PDF LOADING] Blob URL created:', url);
              console.log('🔄 [PDF LOADING] Setting pdfSrc to original signed blob URL...');
              
              this.pdfSrc = url;
              this.isLoadingPdf = false;
              this.isPdfCopy = false; // Marcar que se está mostrando el original firmado
              console.log('📄 [PDF LOADING] PDF Source set to original signed (isPdfCopy = false)');
              
              // Forzar detección de cambios para actualizar la vista
              this.cdr.detectChanges();
              console.log('✅ [PDF LOADING] SUCCESS: Original signed PDF loading completed successfully');
            },
            error: (err2) => {
              console.error('❌ [PDF LOADING] Step 2 FAILED: Error loading signed PDF:', err2);
              console.log('📋 [PDF LOADING] Error details:', JSON.stringify(err2, null, 2));
              console.log('📋 [PDF LOADING] Final status: No signed PDF available');
              this.snackBar.open('Error al cargar el PDF firmado: ' + (err2.error?.message || err2.message || 'Error desconocido'), 'Cerrar', {
                duration: 5000,
                panelClass: ['error-snackbar']
              });
              this.isLoadingPdf = false;
              this.isPdfCopy = false;
            }
          });
        } else {
          console.error('❌ [PDF LOADING] Operation ID is null in error callback');
          this.isLoadingPdf = false;
          this.isPdfCopy = false;
        }
      }
    });
    console.log('🔄 [PDF LOADING] loadSignedPdf method completed - subscription set up');
  }

  private loadOriginalPdf(): void {
    if (!this.operation?.filePDF) {
      console.warn('⚠️ [PDF LOADING] No original PDF available');
      return;
    }

    console.log('🔄 [PDF LOADING] loadOriginalPdf called for non-completed operation');
    console.log('📋 [PDF LOADING] Original PDF file:', this.operation.filePDF);
    const pdfUrl = this.operation.filePDF;
    
    this.pdfSrc = this.fileUrlService.getMediaFileUrl(pdfUrl, this.operation?.id);
    console.log('📁 [PDF LOADING] Using media file URL for original:', this.pdfSrc);
    console.log('📁 [PDF LOADING] Operation ID:', this.operation?.id);
    this.isPdfCopy = false; // Resetear cuando se carga el PDF original
    console.log('📄 [PDF LOADING] Original PDF loaded successfully (not signed, isPdfCopy = false)');
    
    // Forzar detección de cambios para actualizar la vista
    this.cdr.detectChanges();
  }

  private loadAgreements(): void {
    if (!this.operation?.id) return;
    
    this.isLoadingAgreements = true;
    this.agreementService.getAgreementsByOperation(this.operation.id).subscribe({
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
    if (!this.operation?.id) return;
    
    this.isLoadingParties = true;
    this.partyService.getPartiesByOperation(this.operation.id).subscribe({
      next: (parties) => {
        this.parties = parties;
        this.isLoadingParties = false;
        this.recreateSignatureAreasFromParties();
        
        console.log('🔍 Parties loaded:', parties);
        console.log('🔍 Parties status debug:');
        parties.forEach(party => {
          console.log(`🔍 Party ${party.id} (${party.firstName} ${party.lastName}): status = "${party.status}"`);
        });
        console.log('🔍 Signature areas recreated:', this.signatureAreas);
        
        // Configurar el canvas después de cargar los parties (solo si debe mostrarse)
        if (this.shouldShowCanvas()) {
          setTimeout(() => {
            this.resizeCanvasToPdfPage();
          }, 500);
        }
      },
      error: (err) => {
        console.error('Error loading parties:', err);
        this.isLoadingParties = false;
      }
    });
  }

  public checkAuditFileExists(): void {
    if (!this.operation?.id) return;
    
    // Solo verificar auditoría para operaciones completadas o rechazadas
    if (this.operation.status !== OperationStatusEnum.COMPLETADA && this.operation.status !== OperationStatusEnum.RECHAZADA) {
      this.hasAuditFile = false;
      this.isLoadingAudit = false;
      return;
    }
    
    this.isLoadingAudit = true;
    
    // Hacer una petición GET para verificar si existe el archivo
    this.signatureService.checkAuditFileExists(this.operation.id).subscribe({
      next: (exists) => {
        this.hasAuditFile = exists;
        this.isLoadingAudit = false;
      },
      error: (err) => {
        this.hasAuditFile = false;
        this.isLoadingAudit = false;
      }
    });
  }

  // Método para recrear las áreas de firma desde los parties
  private recreateSignatureAreasFromParties(): void {
    console.log('🔍 ===== recreateSignatureAreasFromParties METHOD CALLED =====');
    console.log('🔍 Current parties:', this.parties);
    
    // Limpiar áreas existentes
    this.signatureAreas = [];
    
    // Recrear áreas para cada party que tenga coordenadas válidas
    this.parties.forEach(party => {
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
    // Solo configurar el canvas si debe mostrarse
    if (this.shouldShowCanvas()) {
      // Agregar listener para el scroll del viewerContainer
      setTimeout(() => {
        this.setupViewerContainerScrollListener();
      }, 1000);
    }
  }

  private setupViewerContainerScrollListener(): void {
    // Solo configurar el listener si el canvas debe mostrarse
    if (!this.shouldShowCanvas()) return;
    
    // Buscar el viewerContainer del PDF viewer
    const viewerContainer = document.querySelector('#viewerContainer') as HTMLElement;
    if (!viewerContainer) {
      console.log('viewerContainer no encontrado, reintentando en 500ms');
      setTimeout(() => {
        this.setupViewerContainerScrollListener();
      }, 500);
      return;
    }
    
    console.log('viewerContainer encontrado, agregando listener de scroll');
    
    // Crear el listener de scroll con debounce
    this.viewerContainerScrollListener = () => {
      // Debounce para evitar renders excesivos durante el scroll
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      
      this.resizeTimeout = setTimeout(() => {
        this.resizeCanvasToPdfPage();
        this.resizeTimeout = null;
      }, 100); // Aumentado de 10ms a 100ms para reducir frecuencia
    };
    
    // Agregar listener para el scroll del viewerContainer
    viewerContainer.addEventListener('scroll', this.viewerContainerScrollListener);
    
    // También agregar listener para cambios de tamaño con debounce
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }
      
      this.resizeTimeout = setTimeout(() => {
        this.resizeCanvasToPdfPage();
        this.resizeTimeout = null;
      }, 200); // Debounce para ResizeObserver
    });
    
    this.resizeObserver.observe(viewerContainer);
  }

  private resizeCanvasToPdfPage(): void {
    if (!this.signatureCanvasRef || !this.pdfContainerRef || !this.shouldShowCanvas()) return;
    
    // Prevenir múltiples resizes simultáneos
    if (this.isResizing) {
      return;
    }
    
    this.isResizing = true;
    
    try {
      const canvas = this.signatureCanvasRef.nativeElement;
      const container = this.pdfContainerRef.nativeElement;
      
      // Obtener las dimensiones del contenedor del PDF
      const containerRect = container.getBoundingClientRect();
    
    // Configurar el canvas para que ocupe todo el contenedor
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;
    canvas.style.width = containerRect.width + 'px';
    canvas.style.height = containerRect.height + 'px';
    canvas.style.position = 'absolute';
    canvas.style.left = '0px';
    canvas.style.top = '0px';
    canvas.style.zIndex = '1000';
    canvas.style.pointerEvents = 'none'; // Solo visualización en operation-view
    
    console.log('Canvas configured for PDF container:', containerRect.width, 'x', containerRect.height);
    console.log('Canvas z-index:', canvas.style.zIndex);
    console.log('Canvas pointer events:', canvas.style.pointerEvents);
    
    // Obtener el contexto del canvas
    this.canvasCtx = canvas.getContext('2d');
    if (!this.canvasCtx) {
      console.error('No se pudo obtener el contexto del canvas');
      this.isResizing = false;
      return;
    }
    
    // Actualizar las posiciones de las páginas y redibujar
    this.updatePagePositions();
    } finally {
      this.isResizing = false;
    }
  }

  private updatePagePositions(): void {
    if (!this.signatureCanvasRef || !this.pdfContainerRef) return;
    
    // Buscar todas las páginas PDF visibles
    const pdfPages = document.querySelectorAll('.pdf-viewer .page') as NodeListOf<HTMLElement>;
    if (!pdfPages || pdfPages.length === 0) {
      console.log('No PDF pages found for position update');
      return;
    }
    
    const container = this.pdfContainerRef.nativeElement;
    const containerRect = container.getBoundingClientRect();
    
    console.log('Updating page positions:');
    console.log('Container rect:', containerRect);
    console.log('Container scroll top:', container.scrollTop);
    console.log('Number of pages found:', pdfPages.length);
    
    const pagePositions: { top: number, height: number }[] = [];
    
    pdfPages.forEach((page, index) => {
      // Calcular la posición relativa al contenedor del PDF
      const pageRect = page.getBoundingClientRect();
      const pageTop = pageRect.top - containerRect.top + container.scrollTop;
      const pageHeight = pageRect.height;
      
      console.log(`Page ${index + 1}:`);
      console.log(`  Page rect:`, pageRect);
      console.log(`  Calculated top: ${pageTop}, height: ${pageHeight}`);
      
      pagePositions.push({
        top: pageTop,
        height: pageHeight
      });
    });
    
    // Actualizar las posiciones de las páginas
    this.pagePositions = pagePositions;
    
    console.log('Final page positions:', this.pagePositions);
    
    // NO llamar renderCanvas aquí para evitar bucles infinitos
  }

  private drawAreaOnCanvas(area: SignatureArea, x: number, y: number, width: number, height: number): void {
    console.log('drawAreaOnCanvas called for area:', area.id, 'at coordinates:', x, y, width, height);
    if (!this.canvasCtx) {
      console.log('No canvas context available');
      return;
    }
    
    // Dibujar el borde del área
    this.canvasCtx.strokeStyle = area.color;
    this.canvasCtx.lineWidth = 2;
    this.canvasCtx.setLineDash([]); // Áreas definidas sin línea punteada
    this.canvasCtx.strokeRect(x, y, width, height);
    this.canvasCtx.setLineDash([]);
    
    // Relleno semi-transparente
    this.canvasCtx.fillStyle = `${area.color}20`; // 20 = 12% opacidad
    this.canvasCtx.fillRect(x, y, width, height);
    
    // Dibujar información del firmante
    if (area.partyId) {
      const party = this.parties.find(p => p.id === area.partyId);
      const partyName = party ? `${party.firstName} ${party.lastName}` : 'Firmante desconocido';
      this.canvasCtx.fillStyle = '#000';
      this.canvasCtx.font = '10px Arial';
      this.canvasCtx.fillText(partyName, x + 5, y + 15);
      
      const status = 'Definida';
      this.canvasCtx.fillStyle = '#4CAF50';
      this.canvasCtx.font = '8px Arial';
      this.canvasCtx.fillText(status, x + 5, y + 25);
    }
    
    console.log('Area drawn successfully');
  }

  private getRandomColor(): string {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    return colors[Math.floor(Math.random() * colors.length)];
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

  ngOnDestroy(): void {
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }
    
    // Limpiar timeout de resize si existe
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
    
    // Limpiar listeners del viewerContainer
    if (this.viewerContainerScrollListener) {
      const viewerContainer = document.querySelector('#viewerContainer') as HTMLElement;
      if (viewerContainer) {
        viewerContainer.removeEventListener('scroll', this.viewerContainerScrollListener);
      }
      this.viewerContainerScrollListener = null;
    }
    
    // Limpiar ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  // Make data accessible from template
  get data() {
    return this._data;
  }
  private _data = inject<{ operation: OperationReadDto }>(MAT_DIALOG_DATA, { optional: true });

  getAreasForParty(partyId: number): SignatureArea[] {
    const areas = this.signatureAreas.filter(a => a.partyId === partyId);
    console.log('🔍 getAreasForParty called for partyId:', partyId, 'returning:', areas);
    return areas;
  }

  getAllAreas(): SignatureArea[] {
    return this.signatureAreas;
  }

  shouldShowCanvas(): boolean {
    // Solo mostrar el canvas si la operación está pendiente o lanzada
    return this.operation?.status === OperationStatusEnum.PENDING || 
           this.operation?.status === OperationStatusEnum.LANZADA;
  }

  // Métodos para manejar eventos del PDF viewer
  onPdfLoaded(event: any): void {
    console.log('✅ [PDF VIEWER] PDF loaded successfully in viewer');
    console.log('📊 [PDF VIEWER] Event details:', event);
    console.log('📄 [PDF VIEWER] Current PDF source:', this.pdfSrc);
    console.log('📄 [PDF VIEWER] Is PDF copy:', this.isPdfCopy);
    console.log('📄 [PDF VIEWER] PDF source type:', typeof this.pdfSrc);
    console.log('📄 [PDF VIEWER] PDF source starts with blob:', this.pdfSrc?.startsWith('blob:'));
    this.isLoadingPdf = false;
  }

  onPdfError(error: any): void {
    console.error('❌ [PDF VIEWER] PDF loading error in viewer:', error);
    console.log('📄 [PDF VIEWER] Failed PDF source:', this.pdfSrc);
    console.log('📄 [PDF VIEWER] Is PDF copy:', this.isPdfCopy);
    this.isLoadingPdf = false;
    this.snackBar.open('Error al cargar el PDF', 'Cerrar', { duration: 3000 });
  }
  pdfHeight = 0;

  /*onPageChange(event: any): void {
    this.currentPage = event.pageNumber || 1;
    console.log('📄 [PDF VIEWER] Page changed to:', this.currentPage);
  }*/

  downloadSignedPdf(): void {
    if (!this.operation?.id) {
      console.error('❌ [PDF DOWNLOAD] No operation ID available for download');
      this.snackBar.open('No se puede descargar el PDF firmado', 'Cerrar', { duration: 3000 });
      return;
    }

    console.log('🔄 [PDF DOWNLOAD] downloadSignedPdf called for operation:', this.operation.id);
    console.log('📋 [PDF DOWNLOAD] Operation status:', this.operation.status);
    console.log('📋 [PDF DOWNLOAD] Original PDF filename:', this.operation.filePDF);

    // Primero intentar descargar la copia del PDF firmado
    // PAblo  Caambio Primero el firmado original (No termina en  _copy)
    console.log('🔄 [PDF DOWNLOAD] Step 1: Attempting to download signed Original PDF copy ...');
    this.signatureService.getSignedPdf(this.operation.id).subscribe({
      next: (blob) => {
        console.log('✅ [PDF DOWNLOAD] SUCCESS: Signed PDF copy downloaded from SSS');
        console.log('📊 [PDF DOWNLOAD] Blob size:', blob.size, 'bytes');
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const downloadFilename = `documento_firmado_copia_${this.operation?.id}_${new Date().toISOString().split('T')[0]}.pdf`;
        link.download = downloadFilename;
        
        console.log('📄 [PDF DOWNLOAD] Download filename:', downloadFilename);
        console.log('📄 [PDF DOWNLOAD] Expected pattern: operation_${this.operation.id}_*_copy.pdf');
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log('📄 [PDF DOWNLOAD] File downloaded successfully');
        this.snackBar.open('PDF firmado (copia) descargado exitosamente', 'Cerrar', { duration: 3000 });
      },
      error: (err) => {
        console.log('⚠️ [PDF DOWNLOAD] Step 1 FAILED: PDF copy not found for download, error:', err);
        console.log('🔄 [PDF DOWNLOAD] Step 2: Attempting to download original signed PDF...');
        // Si no existe la copia, intentar con el PDF firmado original
        if (this.operation?.id) {
          this.signatureService.getSignedPdf(this.operation.id).subscribe({
            next: (blob) => {
              console.log('✅ [PDF DOWNLOAD] SUCCESS: Original signed PDF downloaded from SSS');
              console.log('📊 [PDF DOWNLOAD] Blob size:', blob.size, 'bytes');
              
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              const downloadFilename = `documento_firmado_${this.operation?.id}_${new Date().toISOString().split('T')[0]}.pdf`;
              link.download = downloadFilename;
              
              console.log('📄 [PDF DOWNLOAD] Download filename:', downloadFilename);
              console.log('📄 [PDF DOWNLOAD] Expected pattern: operation_${this.operation.id}_*_signed.pdf');
              
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              
              console.log('📄 [PDF DOWNLOAD] File downloaded successfully');
              this.snackBar.open('PDF firmado descargado exitosamente', 'Cerrar', { duration: 3000 });
            },
            error: (err2) => {
              console.error('❌ [PDF DOWNLOAD] Step 2 FAILED: Error downloading signed PDF:', err2);
              console.log('📋 [PDF DOWNLOAD] Final status: No signed PDF available for download');
              this.snackBar.open('Error al descargar el PDF firmado: ' + (err2.error?.message || err2.message || 'Error desconocido'), 'Cerrar', {
                duration: 5000,
                panelClass: ['error-snackbar']
              });
            }
          });
        } else {
          console.error('❌ [PDF DOWNLOAD] Operation ID is null in error callback');
          this.snackBar.open('Error: No se pudo obtener el ID de la operación', 'Cerrar', { duration: 3000 });
        }
      }
    });
  }
  
  downloadAuditPdf(): void {
    if (!this.operation?.id) {
      console.error('❌ [AUDIT DOWNLOAD] No operation ID available for download');
      this.snackBar.open('No se puede descargar el archivo de auditoría', 'Cerrar', { duration: 3000 });
      return;
    }

    console.log('🔄 [AUDIT DOWNLOAD] downloadAuditPdf called for operation:', this.operation.id);
    console.log('📋 [AUDIT DOWNLOAD] Operation status:', this.operation.status);

    // Descargar el archivo de auditoría
    console.log('🔄 [AUDIT DOWNLOAD] Attempting to download Audit PDF...');
    this.signatureService.getAuditPDF(this.operation.id).subscribe({
      next: (blob) => {
        console.log('✅ [AUDIT DOWNLOAD] SUCCESS: Audit PDF downloaded successfully');
        console.log('📊 [AUDIT DOWNLOAD] Blob size:', blob.size, 'bytes');
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const downloadFilename = `audit_document_${this.operation?.id}_${new Date().toISOString().split('T')[0]}.pdf`;
        link.download = downloadFilename;
        
        console.log('📄 [AUDIT DOWNLOAD] Download filename:', downloadFilename);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log('📄 [AUDIT DOWNLOAD] File downloaded successfully');
        this.snackBar.open('Archivo de auditoría descargado exitosamente', 'Cerrar', { duration: 3000 });
      },
      error: (err) => {
        console.error('❌ [AUDIT DOWNLOAD] FAILED: Error downloading audit PDF:', err);
        console.log('📋 [AUDIT DOWNLOAD] Final status: No audit PDF available for download');
        this.snackBar.open('Error al descargar el archivo de auditoría: ' + (err.error?.message || err.message || 'Error desconocido'), 'Cerrar', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        
        // Si hay error al descargar, verificar si el archivo aún existe
        this.checkAuditFileExists();
      }
    });
  }

  // Método público para refrescar la verificación de auditoría
  refreshAuditCheck(): void {
    if (this.operation?.status === OperationStatusEnum.COMPLETADA || this.operation?.status === OperationStatusEnum.RECHAZADA) {
      this.checkAuditFileExists();
    }
  }

  private drawProcessingErrorAnnotation(): void {
    if (!this.showProcessingError) return;
    
    const canvas = this.signatureCanvasRef?.nativeElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Configurar el estilo de la anotación
    const x = 20;
    const y = 20;
    const width = 200;
    const height = 60;
    
    // Fondo rojo con transparencia
    ctx.fillStyle = 'rgba(244, 67, 54, 0.95)';
    ctx.fillRect(x, y, width, height);
    
    // Borde rojo
    ctx.strokeStyle = '#F44336';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // Texto de error
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Error procesando firmas', x + 10, y + 20);
    
    ctx.font = '12px Arial';
    ctx.fillText('Mostrando PDF original', x + 10, y + 40);
    
    console.log('✅ [OPERATION-VIEW] Anotación de error dibujada en el canvas');
  }

} 