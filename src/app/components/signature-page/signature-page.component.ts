import { Component, inject, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PartyFormComponent } from '../party-form/party-form.component';
import { OperationFormComponent } from '../operation-form/operation-form.component';

import { PartyService } from '../../services/party.service';
import { OperationService } from '../../services/operation.service';
import { PdfSignatureVisualizerService } from '../../services/pdf-signature-visualizer.service';
import { PartyReadDto } from '../../models/party.model';
import { OperationReadDto } from '../../models/operation.model';

export interface SignatureArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  partyId?: number;
  color: string;
  isDefined?: boolean;
  isSigned?: boolean;
  signatureData?: string;
}

@Component({
  selector: 'app-signature-page',
  standalone: true,
  imports: [
    CommonModule,
    NgxExtendedPdfViewerModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatToolbarModule
  ],
  templateUrl: './signature-page.component.html',
  styleUrls: ['./signature-page.component.css']
})
export class SignaturePageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('signatureCanvas', { static: false }) signatureCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pdfContainer', { static: false }) pdfContainerRef!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private partyService = inject(PartyService);
  private operationService = inject(OperationService);
  private pdfSignatureService = inject(PdfSignatureVisualizerService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  private dialogRef = inject(MatDialogRef<SignaturePageComponent>, { optional: true });
  private data = inject<{ parentDialogRef?: any, returnToModal?: boolean }>(MAT_DIALOG_DATA, { optional: true });


  operationId: number = 0;
  operation: OperationReadDto | null = null;
  parties: PartyReadDto[] = [];
  signatureAreas: SignatureArea[] = [];
  pdfSrc: string = '';
  
  // Variables para el procesamiento de PDF
  originalFile: File | null = null;
  showProcessingError = false;
  
  isLoading = true;
  isLoadingPdf = false;
  currentPage = 1;
  totalPages = 1;
  lastVisitedPage = 1;
  pdfproportions = 1.414; // Proporción A4 (alto/ancho)
  
  // Variables para el área de firma actual
  currentSignatureArea: SignatureArea | null = null;
  isSigningMode = true; // Siempre en modo firma
  selectedArea: SignatureArea | null = null;
  selectedParty: PartyReadDto | null = null;
  
  // Variables para definir áreas de firma arrastrando
  isDragging = false;
  isDefiningArea = true; // Siempre en modo definición
  currentDefiningPartyId: number | null = null;
  selectionArea = { x: 0, y: 0, width: 0, height: 0 };
  dragStart = { x: 0, y: 0 };
  
  // Variable para controlar la visibilidad del indicador de definición
  showDrawingIndicator = false;
  
  // Variables para el scroll del PDF
  pdfScrollTop = 0;
  pdfScrollLeft = 0;

  // Variables para el canvas overlay
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private canvasStartX = 0;
  private canvasStartY = 0;
  private currentRect: any = null;
  private isMouseDown = false;
  
  // Variables para los listeners
  private viewerContainerScrollListener: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  
  // Variables para las posiciones de las páginas
  private pagePositions: { top: number, height: number }[] = [];
  
  // Variable para el partyId pendiente de activación
  private pendingPartyId: number | null = null;

  private currentDefiningPageRect: DOMRect | null = null;
  
  // Variable para prevenir múltiples renders simultáneos
  private isRendering = false;
  private renderTimeout: any = null;
  
  // Variables para limitar reintentos de resizeCanvasToPdfPage
  private resizeCanvasRetryCount = 0;
  private readonly maxResizeRetries = 20; // Máximo 20 reintentos (2 segundos)

  ngOnInit(): void {
    console.log('🔍 SignaturePageComponent ngOnInit called');
    console.log('🔍 Initial state - currentPage:', this.currentPage, 'totalPages:', this.totalPages);
    
    this.route.params.subscribe(params => {
      console.log('🔍 Route params:', params);
      this.operationId = +params['operationId'];
      console.log('🔍 Operation ID from route:', this.operationId);
      if (this.operationId) {
        this.loadOperation();
        this.loadParties();
      }
    });

    // Verificar si hay un partyId en los query params para activar automáticamente el modo de definición
    this.route.queryParams.subscribe(queryParams => {
      console.log('🔍 Query params:', queryParams);
      const partyId = queryParams['partyId'];
      if (partyId) {
        console.log('🔍 PartyId detected in query params:', partyId);
        // Guardar el partyId para activarlo después de que se carguen los parties
        this.pendingPartyId = +partyId;
      }
    });
  }

  ngAfterViewInit(): void {
    this.setupCanvasOverlay();

   // Agregar listener para el scroll del viewerContainer
    setTimeout(() => {
      this.setupViewerContainerScrollListener();
    }, 1000);

    // Siempre habilitar eventos del canvas ya que siempre estamos en modo definición
    setTimeout(() => {
      if (this.signatureCanvasRef) {
        this.signatureCanvasRef.nativeElement.style.pointerEvents = 'auto';
        console.log('🔍 Canvas pointer events enabled (always on)');
      }
    }, 1500);

    // Renderizar el canvas después de la inicialización
    setTimeout(() => {
      this.renderCanvas();
    }, 2000);

    // Deshabilitar navegación automática
    setTimeout(() => {
      this.disableAutomaticNavigation();
    }, 1000);
  }

  ngOnDestroy(): void {
    // Limpiar la URL del blob si existe
    if (this.pdfSrc && this.pdfSrc.startsWith('blob:')) {
      URL.revokeObjectURL(this.pdfSrc);
    }
    
    // Limpiar timeout de render si existe
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = null;
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

  private loadOperation(): void {
    this.isLoading = true;
    this.operationService.getOperationById(this.operationId).subscribe({
      next: (operation) => {
        this.operation = operation;
        console.log('Operation loaded:', operation);
        console.log('PDF filename from operation:', operation.filePDF);
        
        // Cargar el PDF después de tener la información de la operación
        this.loadPdf();
        
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading operation:', err);
        this.snackBar.open('Error al cargar la operación', 'Cerrar', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  private loadParties(): void {
    this.partyService.getPartiesByOperation(this.operationId).subscribe({
      next: (parties) => {
        this.parties = parties;
        this.createSignatureAreasFromParties();
        
        // Si hay un partyId pendiente, activar el modo de definición
        if (this.pendingPartyId) {
          console.log('🔍 Parties loaded, activating pending partyId:', this.pendingPartyId);
          setTimeout(() => {
            this.startDefiningAreaForParty(this.pendingPartyId!);
            this.pendingPartyId = null; // Limpiar el partyId pendiente
          }, 500); // Pequeño delay para asegurar que todo esté listo
        }
        
        // Renderizar el canvas después de cargar los parties
        setTimeout(() => {
          this.renderCanvas();
        }, 1000);
      },
      error: (err) => {
        console.error('Error loading parties:', err);
        this.snackBar.open('Error al cargar los firmantes', 'Cerrar', { duration: 3000 });
      }
    });
  }

  private loadPdf(): void {
    this.isLoadingPdf = true;
    this.showProcessingError = false;
    
    // Usar el servicio para obtener el PDF
    this.operationService.getOperationPdf(this.operationId).subscribe({
      next: (blob) => {
        // Convertir el blob a File para procesamiento
        const fileName = this.operation?.filePDF || 'document.pdf';
        this.originalFile = new File([blob], fileName, { type: 'application/pdf' });
        
        // Procesar el PDF para mostrar firmas visibles
        this.processPdfForDisplay();
      },
      error: (error) => {
        console.error('Error loading PDF via service:', error);
        this.snackBar.open(
          `Error al cargar el PDF: ${error.message}. Verifique que el archivo existe.`, 
          'Cerrar', 
          { duration: 5000 }
        );
        this.isLoadingPdf = false;
      }
    });
  }

  private async processPdfForDisplay(): Promise<void> {
    if (!this.originalFile) {
      console.warn('No hay archivo original para procesar');
      this.isLoadingPdf = false;
      return;
    }

    try {
      console.log('🔄 [SIGNATURE-PAGE] Procesando PDF para mostrar firmas visibles...');
      
      // Procesar el PDF para extraer y mostrar firmas
      const processedBlob = await this.pdfSignatureService.generatePdfWithVisibleSignaturesFromFileFrontend(this.originalFile);
      
      // Crear URL del PDF procesado
      this.pdfSrc = URL.createObjectURL(processedBlob);
      console.log('✅ [SIGNATURE-PAGE] PDF procesado exitosamente con firmas visibles');
      
    } catch (error) {
      console.error('❌ [SIGNATURE-PAGE] Error procesando PDF:', error);
      
      // En caso de error, mostrar el PDF original con anotación de error
      this.pdfSrc = URL.createObjectURL(this.originalFile);
      this.showProcessingError = true;
      
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
      this.isLoadingPdf = false;
    }
  }

  private createSignatureAreasFromParties(): void {
    console.log('🔍 ===== createSignatureAreasFromParties METHOD CALLED =====');
    console.log('🔍 Current parties:', this.parties);
    
    // Limpiar áreas existentes
    this.signatureAreas = [];
    
    // Crear áreas solo para parties que tengan coordenadas válidas
    this.parties.forEach(party => {
      if (party.x !== undefined && party.y !== undefined && party.width !== undefined && party.height !== undefined) {
        // Preferir coordenadas originales guardadas localmente para la UI
        const original = this.loadOriginalAreaFromLocalStorage(party.id!, party.page || 1);
        const area: SignatureArea = {
          id: `area_${party.id}_page_${party.page || 1}`,
          x: original?.x ?? party.x,
          y: original?.y ?? party.y,
          width: original?.width ?? party.width,
          height: original?.height ?? party.height,
          page: party.page || 1,
          partyId: party.id,
          color: this.getRandomColor(),
          isDefined: true,
          isSigned: false,
          signatureData: undefined
        };
        
        this.signatureAreas.push(area);
        console.log('🔍 Created signature area for party:', party.id, area);
      } else {
        console.log('🔍 Party has no coordinates, skipping area creation:', party.id);
      }
    });
    
    console.log('🔍 Final signature areas:', this.signatureAreas);
    
    // Renderizar el canvas después de crear las áreas
    setTimeout(() => {
      this.renderCanvas();
    }, 500);
  }

  private getRandomColor(): string {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Clave para localStorage para guardar coords originales (PDF) por operación/party/página
  private getOriginalAreaStorageKey(partyId: number, page: number): string {
    return `sig_coords_op_${this.operationId}_party_${partyId}_page_${page}`;
  }

  private saveOriginalAreaToLocalStorage(area: SignatureArea): void {
    if (!area.partyId) return;
    const key = this.getOriginalAreaStorageKey(area.partyId, area.page);
    const payload = {
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      page: area.page,
      ts: Date.now()
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      console.log('🔍 Saved original area to localStorage:', key, payload);
    } catch (e) {
      console.log('🔍 Could not save to localStorage:', e);
    }
  }

  private loadOriginalAreaFromLocalStorage(partyId: number, page: number): { x: number; y: number; width: number; height: number } | null {
    const key = this.getOriginalAreaStorageKey(partyId, page);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (
        typeof data?.x === 'number' && typeof data?.y === 'number' &&
        typeof data?.width === 'number' && typeof data?.height === 'number'
      ) {
        return { x: data.x, y: data.y, width: data.width, height: data.height };
      }
    } catch (e) {
      console.log('🔍 Could not load from localStorage for key', key, e);
    }
    return null;
  }

  onPdfLoaded(event: any): void {
    console.log('🔍 ===== onPdfLoaded METHOD CALLED =====');
    this.isLoadingPdf = false;
    
    // El número de páginas se obtendrá principalmente del evento pagesLoaded
    // Aquí solo manejamos la carga inicial del PDF
    console.log('🔍 PDF loaded event:', event);
    console.log('🔍 Event object:', event);
    console.log('🔍 event.pagesCount:', event?.pagesCount);
    console.log('🔍 event.numPages:', event?.numPages);
    console.log('🔍 Current page:', this.currentPage);
    console.log('🔍 Current totalPages:', this.totalPages);
    
    // Solo actualizar totalPages si no se ha establecido aún
    if (this.totalPages <= 1) {
      if (event && event.pagesCount) {
        this.totalPages = event.pagesCount;
        console.log('🔍 Using event.pagesCount in onPdfLoaded:', this.totalPages);
      } else if (event && event.numPages) {
        this.totalPages = event.numPages;
        console.log('🔍 Using event.numPages in onPdfLoaded:', this.totalPages);
      }
    }
    
    // Asegurar que totalPages sea al menos 1
    if (this.totalPages < 1) {
      this.totalPages = 1;
    }
    
    console.log('🔍 PDF loaded with', this.totalPages, 'pages');
    console.log('🔍 Navigation state after load:', this.getNavigationState());
    console.log('🔍 Button states after load:', this.getButtonStates());
    
    // Asegurar que el visor use scroll normal y dimensiones consistentes (única barra de scroll)
    setTimeout(() => {
      this.configureViewerForScroll();
    }, 500);
    
    // Actualizar las posiciones de las páginas después de que el PDF se haya cargado
    setTimeout(() => {
      this.updatePagePositions();
      this.setupCanvasOverlay();
      this.resizeCanvasToPdfPage();
      this.renderCanvas();
    }, 1000);
    
    // También actualizar después de un tiempo adicional para asegurar que el PDF se haya renderizado completamente
    setTimeout(() => {
      this.updatePagePositions();
      this.resizeCanvasToPdfPage();
      this.renderCanvas();
      // Verificar el número de páginas después de que el PDF se haya renderizado
      this.getTotalPagesFromDOM();
    }, 2000);
    
    // Una tercera actualización para asegurar que todo esté correcto
    setTimeout(() => {
      this.updatePagePositions();
      this.resizeCanvasToPdfPage();
      this.renderCanvas();
    }, 3000);
    
    // Una cuarta actualización para asegurar que las áreas se muestren
    setTimeout(() => {
      this.updatePagePositions();
      this.resizeCanvasToPdfPage();
      this.renderCanvas();
    }, 4000);
    
    // Deshabilitar navegación automática después de que el PDF se cargue
    setTimeout(() => {
      this.disableAutomaticNavigation();
    }, 1000);
    
    // Método de respaldo para detectar el número de páginas si el evento pagesLoaded no funciona
    setTimeout(() => {
      this.backupDetectTotalPages();
    }, 3000);
  }

  // Método de respaldo para detectar el número total de páginas
  private backupDetectTotalPages(): void {
    console.log('🔍 ===== BACKUP DETECT TOTAL PAGES =====');
    
    // Si ya tenemos un número válido de páginas, no hacer nada
    if (this.totalPages > 1) {
      console.log('🔍 Total pages already detected:', this.totalPages);
      return;
    }
    
    // Intentar obtener desde el DOM
    const pages = document.querySelectorAll('#viewerContainer .page, .pdf-viewer .page, .page');
    if (pages.length > 0) {
      this.totalPages = pages.length;
      console.log('🔍 Backup: Total pages from DOM:', this.totalPages);
      this.forceNavigationUpdate();
      return;
    }
    
    // Intentar obtener desde el PDF viewer
    try {
      const pdfViewerElement = document.querySelector('ngx-extended-pdf-viewer') as any;
      if (pdfViewerElement && pdfViewerElement._pdfViewer) {
        const pdfViewer = pdfViewerElement._pdfViewer;
        if (pdfViewer.pagesCount && pdfViewer.pagesCount > 1) {
          this.totalPages = pdfViewer.pagesCount;
          console.log('🔍 Backup: Total pages from PDF viewer:', this.totalPages);
          this.forceNavigationUpdate();
          return;
        }
      }
    } catch (error) {
      console.log('🔍 Backup: Error accessing PDF viewer:', error);
    }
    
    // Intentar obtener desde el window object
    try {
      if ((window as any).PDFViewerApplication && (window as any).PDFViewerApplication.pagesCount) {
        const pagesCount = (window as any).PDFViewerApplication.pagesCount;
        if (pagesCount > 1) {
          this.totalPages = pagesCount;
          console.log('🔍 Backup: Total pages from window.PDFViewerApplication:', this.totalPages);
          this.forceNavigationUpdate();
          return;
        }
      }
    } catch (error) {
      console.log('🔍 Backup: Error accessing window.PDFViewerApplication:', error);
    }
    
    console.log('🔍 Backup: No pages detected, keeping current totalPages:', this.totalPages);
  }

  onPdfError(error: any): void {
    this.isLoadingPdf = false;
    console.error('PDF loading error:', error);
    this.snackBar.open('Error al cargar el PDF', 'Cerrar', { duration: 3000 });
  }

  onPageChange(event: any): void {
    // Este método ya no se usa para navegación automática
    // Solo se mantiene por compatibilidad si es necesario
    console.log('Page change event received (ignored):', event);
  }

  onPdfPageChange(event: any): void {
    console.log('PDF pageChange event:', event);
    let newPage: number | null = null;

    if (event && typeof event === 'number') {
      newPage = event;
    } else if (event && event.pageNumber) {
      newPage = event.pageNumber;
    }

    // Detectar si se navega a la primera o última página
    if (newPage !== null) {
      if (newPage === 1) {
        // Evento o lógica para la primera página
        console.log('🚩 Se ha navegado a la PRIMERA página');
        // Aquí puedes emitir un evento, llamar a un callback, etc.
        // Ejemplo: this.onFirstPageReached.emit();
      } else if (this.totalPages && newPage === this.totalPages) {
        // Evento o lógica para la última página
        console.log('🏁 Se ha navegado a la ÚLTIMA página');
        // Aquí puedes emitir un evento, llamar a un callback, etc.
        // Ejemplo: this.onLastPageReached.emit();
      }
    }

    // Solo actualizar si la página realmente cambió
    if (newPage !== null && newPage !== this.currentPage) {
      this.lastVisitedPage = newPage;
      this.currentPage = newPage;
      this.renderCanvas();
      console.log('✅ Last visited page updated to:', this.lastVisitedPage);
    }
  }

  onPdfPageRendered(event: any): void {
    console.log('PDF pageRendered event:', event);
    const viewport = event.source.viewport;
    const width = viewport.width;
    const height = viewport.height;
    this.pdfproportions = height / width;
    console.log('Dimensiones de la página PDF:', width, height);
  }

  getAreasForCurrentPage(): SignatureArea[] {
    // Retornar solo las áreas de la página actual
    return this.signatureAreas.filter(area => area.page === this.currentPage);
  }

  getAllAreas(): SignatureArea[] {
    // Retornar todas las áreas de todas las páginas
    return this.signatureAreas;
  }

  getPartyName(partyId: number): string {
    const party = this.parties.find(p => p.id === partyId);
    return party ? `${party.firstName} ${party.lastName}` : 'Firmante desconocido';
  }

  goBack(): void {
    console.log('🔍 goBack called');
    
    // Usar la misma lógica que goBack() para manejar la navegación y apertura del modal
    console.log('🔍 acceptSignatureAreas - checking for modal data');
    
    const returnToModal = sessionStorage.getItem('returnToModal');
    const modalData = sessionStorage.getItem('modalData');
    
    console.log('🔍 returnToModal:', returnToModal);
    console.log('🔍 modalData exists:', !!modalData);

    if (returnToModal === 'true' && modalData) {
      try {
        console.log('🔍 === RECOVERING MODAL DATA ===');
        console.log('🔍 Raw modal data from sessionStorage:', modalData);
        console.log('🔍 Parsing modal data...');
        const modalInfo = JSON.parse(modalData);
        console.log('🔍 Modal info parsed:', modalInfo);
        console.log('🔍 Modal info type:', typeof modalInfo);
        console.log('🔍 Modal info.config:', modalInfo.config);
        console.log('🔍 Modal info.config.data:', modalInfo.config?.data);
        console.log('🔍 isEdit value recovered:', modalInfo.config?.data?.isEdit);
        console.log('🔍 isEdit type recovered:', typeof modalInfo.config?.data?.isEdit);
        
        sessionStorage.removeItem('returnToModal');
        sessionStorage.removeItem('modalData');

        console.log('🔍 Navigating to operation-list...');

        let origin = sessionStorage.getItem('signatureOrigin');

        if (origin === 'user-list' || origin === 'operation-list') {
          this.router.navigate([origin]).then(() => {
          console.log('🔍 Navigation successful, opening modal in 500ms...');
          setTimeout(() => {
            this.openPreviousModal(modalInfo);
          }, 500); // Aumentar el delay para asegurar que la navegación esté completa
        }).catch((error) => {
            console.error('🔍 Navigation error:', error);
            this.snackBar.open('Error al navegar de vuelta', 'Cerrar', { duration: 3000 });
          });
        } else {
          this.router.navigate(['/operation-list']).then(() => {
            console.log('🔍 Navigation successful, opening modal in 500ms...');
            setTimeout(() => {
              this.openPreviousModal(modalInfo);
            }, 500); // Aumentar el delay para asegurar que la navegación esté completa
          }).catch((error) => {
            console.error('🔍 Navigation error:', error);
            this.snackBar.open('Error al navegar de vuelta', 'Cerrar', { duration: 3000 });
          });
        }

      } catch (error) {
        console.error('🔍 Error parsing modal data:', error);
        console.error('🔍 Modal data was:', modalData);
        this.snackBar.open('Error al procesar datos del modal', 'Cerrar', { duration: 3000 });
        // Navegar de vuelta sin abrir modal
        this.router.navigate(['/operation-list']);
      }
    } else {
      console.log('🔍 No modal data found, navigating directly to operation-list');
      this.router.navigate(['/operation-list']);
    }
  }

  openPreviousModal(modalInfo: any): void {
    console.log('🔍 openPreviousModal called with:', modalInfo);
    console.log('🔍 Modal type:', modalInfo.type);
    console.log('🔍 Modal config:', modalInfo.config);
    console.log('🔍 Modal data:', modalInfo.config?.data);
    
    if (modalInfo.type === 'party-form') {
      console.log('🔍 Opening party-form modal...');
      this.dialog.open(PartyFormComponent, {
        data: modalInfo.config.data,
        width: '1300px',
        height: '90vh',
        maxHeight: '800px'
      });
    } else if (modalInfo.type === 'operation-form') {
      console.log('🔍 Opening operation-form modal...');
      console.log('🔍 Modal data:', modalInfo.config.data);
      console.log('🔍 isEdit flag:', modalInfo.config.data?.isEdit);
      console.log('🔍 operation object:', modalInfo.config.data?.operation);
      console.log('🔍 operation ID:', modalInfo.config.data?.operation?.id);
      console.log('🔍 operation exists:', !!modalInfo.config.data?.operation);
      console.log('🔍 isEdit exists:', modalInfo.config.data?.isEdit !== undefined);
      console.log('🔍 isEdit value:', modalInfo.config.data?.isEdit);
      
      // Verificar que ambos datos estén presentes
      if (!modalInfo.config.data?.operation) {
        console.error('🔍 ERROR: Operation object is missing!');
        this.snackBar.open('Error: Datos de operación faltantes', 'Cerrar', { duration: 3000 });
        return;
      }
      
      if (modalInfo.config.data?.isEdit !== true) {
        console.error('🔍 ERROR: isEdit flag is not true!');
        console.error('🔍 isEdit value:', modalInfo.config.data?.isEdit);
        console.error('🔍 isEdit type:', typeof modalInfo.config.data?.isEdit);
        this.snackBar.open('Error: Flag de edición incorrecto', 'Cerrar', { duration: 3000 });
        return;
      }
      
      console.log('🔍 All data verified, opening OperationFormComponent...');
      
      this.dialog.open(OperationFormComponent, {
        data: modalInfo.config.data,
        width: '90vw',
        maxWidth: '1250px',
        maxHeight: '90vh'
      });
    } else {
      console.error('🔍 Unknown modal type:', modalInfo.type);
      this.snackBar.open('Tipo de modal desconocido', 'Cerrar', { duration: 3000 });
    }
  }

  // Métodos para manejar el scroll y zoom del PDF
  onPdfScroll(event: any): void {
    this.pdfScrollTop = event.target.scrollTop;
    this.pdfScrollLeft = event.target.scrollLeft;
    
    // Debounce para evitar renders excesivos durante el scroll
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }
    
    this.renderTimeout = setTimeout(() => {
      this.resizeCanvasToPdfPage();
      this.renderCanvas();
      this.renderTimeout = null;
    }, 100); // Aumentado de 10ms a 100ms para reducir la frecuencia
  }

  private forceCanvasRedraw(): void {
    console.log('Force canvas redraw called');
    if (this.signatureCanvasRef && this.pdfContainerRef) {
      this.renderCanvas();
    } else {
      console.log('Canvas or container not available for redraw');
    }
  }

  zoomIn(): void {
    // Zoom deshabilitado - mantener escala 1
    setTimeout(() => {
      this.renderCanvas();
    }, 100);
    
    // También actualizar después de un tiempo adicional
    setTimeout(() => {
      this.renderCanvas();
    }, 300);
  }

  zoomOut(): void {
    // Zoom deshabilitado - mantener escala 1
    setTimeout(() => {
      this.renderCanvas();
    }, 100);
    
    // También actualizar después de un tiempo adicional
    setTimeout(() => {
      this.renderCanvas();
    }, 300);
  }

  resetZoom(): void {
    // Zoom deshabilitado - mantener escala 1
    setTimeout(() => {
      this.renderCanvas();
    }, 100);
    
    // También actualizar después de un tiempo adicional
    setTimeout(() => {
      this.renderCanvas();
    }, 300);
  }

  // Métodos para definir áreas de firma arrastrando
  startDefiningAreaForParty(partyId: number): void {
    console.log('🔍 startDefiningAreaForParty called with partyId:', partyId);
    console.log('🔍 Current parties:', this.parties);
    
    // Verificar que el party existe
    const party = this.parties.find(p => p.id === partyId);
    if (!party) {
      console.error('🔍 Party not found:', partyId);
      this.snackBar.open(`Error: No se encontró el firmante con ID ${partyId}`, 'Cerrar', { duration: 3000 });
      return;
    }
    
    console.log('🔍 Party found:', party);
    
    this.isDefiningArea = true;
    this.currentDefiningPartyId = partyId;
    this.selectedParty = party;
    
    // Limpiar cualquier área seleccionada anteriormente
    this.selectedArea = null;
    this.isDragging = false;
    this.isMouseDown = false;
    
    const partyName = this.getPartyName(partyId);
    console.log('🔍 Starting area definition for:', partyName);
    
    // Mostrar el indicador de definición por solo 2-3 segundos
    this.showDrawingIndicator = true;
    setTimeout(() => {
      this.showDrawingIndicator = false;
    }, 2500); // 2.5 segundos
    
    // Verificar si ya existe un área para este party
    const existingArea = this.getAreaForPartyInCurrentPage(partyId);
    if (existingArea) {
      console.log('🔍 Existing area found for party:', existingArea);
      this.snackBar.open(`Refirmando área para ${partyName}. Haz click y arrastra para actualizar el área de firma.`, 'OK', { 
        duration: 3000,
        panelClass: ['info-snackbar']
      });
    } else {
      console.log('🔍 No existing area found, creating new one');
      this.snackBar.open(`Definiendo área para ${partyName}. Haz click y arrastra en el PDF para crear el área de firma.`, 'OK', { 
        duration: 3000,
        panelClass: ['info-snackbar']
      });
    }
    
    // Actualizar el canvas para habilitar eventos
    setTimeout(() => {
      if (this.signatureCanvasRef) {
        this.signatureCanvasRef.nativeElement.style.pointerEvents = 'auto';
        console.log('🔍 Canvas pointer events enabled');
      }
    }, 100);
    
    // También actualizar después de un tiempo adicional
    setTimeout(() => {
      this.renderCanvas();
    }, 300);
    
    // Una tercera actualización para asegurar que todo esté correcto
    setTimeout(() => {
      this.renderCanvas();
    }, 500);
    
    console.log('🔍 Iniciando definición de área para:', partyName);
  }

  startDraggingArea(event: MouseEvent, area: SignatureArea): void {
    if (!this.isDefiningArea) return;
    
    event.preventDefault();
    this.isDragging = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.selectionArea = { x: area.x, y: area.y, width: area.width, height: area.height };
    
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  startDraggingAreaTouch(event: TouchEvent, area: SignatureArea): void {
    if (!this.isDefiningArea) return;
    
    if (event.cancelable) {
      event.preventDefault();
    }
    this.isDragging = true;
    const touch = event.touches[0];
    this.dragStart = { x: touch.clientX, y: touch.clientY };
    this.selectionArea = { x: area.x, y: area.y, width: area.width, height: area.height };
    
    document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    
    const deltaX = event.clientX - this.dragStart.x;
    const deltaY = event.clientY - this.dragStart.y;
    
    this.selectionArea.width = Math.max(50, this.selectionArea.width + deltaX);
    this.selectionArea.height = Math.max(30, this.selectionArea.height + deltaY);
    
    this.dragStart = { x: event.clientX, y: event.clientY };
  }

  private onMouseUp(): void {
    if (this.isDragging) {
      this.finishDefiningArea(this.lastVisitedPage, this.signatureAreas);
    }
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.isDragging) return;
    
    if (event.cancelable) {
      event.preventDefault();
    }
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - this.dragStart.x;
    const deltaY = touch.clientY - this.dragStart.y;
    
    this.selectionArea.width = Math.max(50, this.selectionArea.width + deltaX);
    this.selectionArea.height = Math.max(30, this.selectionArea.height + deltaY);
    
    this.dragStart = { x: touch.clientX, y: touch.clientY };
  }

  private onTouchEnd(): void {
    if (this.isDragging) {
      this.finishDefiningArea(this.lastVisitedPage, this.signatureAreas);
    }
    this.isDragging = false;
    document.removeEventListener('touchmove', this.onTouchMove.bind(this));
    document.removeEventListener('touchend', this.onTouchEnd.bind(this));
  }

  private async finishDefiningArea(drawingPage: number, signatureAreas: SignatureArea[]): Promise<void> {
    // Snapshot to avoid race conditions with mouseup clearing state
    const definingPartyId = this.currentDefiningPartyId;
    const rectSnapshot = this.currentRect ? { ...this.currentRect } : null;
    // Usar el número de página donde se hizo clic, no la página actual visible
    const selectedPageNumber = drawingPage;// rectSnapshot?.pageNumber || this.currentDefiningPageNumber || this.currentPage;

    if (!definingPartyId || !rectSnapshot) {
      if (!this.currentDefiningPartyId) {
        this.snackBar.open('Debes seleccionar un firmante antes de definir un área', 'OK', { 
          duration: 3000,
          panelClass: ['warning-snackbar']
        });
      }
      return;
    }
    
    // Verificar que el área tenga un tamaño mínimo
    const minWidth = 200;
    const minHeight = 100;
    
    // Usar coordenadas relativas a la página específica si están disponibles
    let pageX = rectSnapshot.pageX;
    let pageY = rectSnapshot.pageY;
    let pageWidth = rectSnapshot.pageWidth || Math.abs(rectSnapshot.width);
    let pageHeight = rectSnapshot.pageHeight || Math.abs(rectSnapshot.height);
    
    // Si no tenemos coordenadas relativas a la página, usar las del canvas (fallback)
    if (pageX === undefined || pageY === undefined) {
      console.warn('🔍 No page-relative coordinates found, using canvas coordinates');
      // Aproximar las coordenadas relativas a la página desde las coordenadas del canvas
      if (this.currentDefiningPageRect) {
        const canvasRect = this.signatureCanvasRef?.nativeElement?.getBoundingClientRect();
        if (canvasRect) {
          pageX = rectSnapshot.x - (this.currentDefiningPageRect.left - canvasRect.left);
          pageY = rectSnapshot.y - (this.currentDefiningPageRect.top - canvasRect.top);
          pageWidth = Math.abs(rectSnapshot.width);
          pageHeight = Math.abs(rectSnapshot.height);
        }
      }
    }
    
    // Ajustar width si es menor al mínimo
    let widthAdjusted = false;
    let heightAdjusted = false;
    
    if (Math.abs(pageWidth) < minWidth) {
      pageWidth = minWidth;
      widthAdjusted = true;
    }

    // Ajustar height si es menor al mínimo
    if (Math.abs(pageHeight) < minHeight) {
      pageHeight = minHeight;
      heightAdjusted = true;
    }
    
    // Mostrar mensaje si se ajustaron dimensiones
    if (widthAdjusted || heightAdjusted) {
      let message = 'Área ajustada al tamaño mínimo: ';
      if (widthAdjusted && heightAdjusted) {
        message += `ancho (${minWidth}px) y alto (${minHeight}px)`;
      } else if (widthAdjusted) {
        message += `ancho (${minWidth}px)`;
      } else {
        message += `alto (${minHeight}px)`;
      }
      this.snackBar.open(message, 'OK', { duration: 2000 });
    }
    
    console.log('=== FINISH DEFINING AREA - PDF COORDINATES ===');
    console.log('Current rect snapshot:', rectSnapshot);
    console.log('🔍 Selected page number:', selectedPageNumber);
    console.log('🔍 Page-relative coordinates:', { pageX, pageY, pageWidth, pageHeight });
    
    // Obtener las dimensiones de la página específica donde se seleccionó
    const { pageRect, realPdfWidth, realPdfHeight } = await this.getRealPdfDimensions(selectedPageNumber);
    
    console.log('Page display size:', pageRect.width, 'x', pageRect.height);
    console.log('PDF real dimensions (points):', realPdfWidth, 'x', realPdfHeight);
    
    // Calcular las escalas de conversión usando las dimensiones reales del PDF
    const canvas = this.signatureCanvasRef.nativeElement;
    const scaleX = realPdfWidth / canvas.width;
    const scaleY = realPdfHeight / canvas.height;
    
    console.log('Scale factors:', scaleX, 'x', scaleY);
    console.log('Page-relative coordinates (pixels):', { x: pageX, y: pageY, width: pageWidth, height: pageHeight });
    
    // Offsets introducidos por el recorte del canvas respecto a la página
    const canvasLeftCropPx = 6; // recorte izquierdo total aplicado (visual)
    const canvasTopCropPx = 6;  // recorte superior visual aplicado

    // Convertir coordenadas de píxeles a puntos del PDF usando coordenadas relativas a la página
    const adjustedX = pageX + canvasLeftCropPx;
    const adjustedY = pageY + canvasTopCropPx;
    
    // Convertir coordenadas SIN Math.round para mayor precisión
    let pdfX = this.currentRect.pageX * scaleX;
    let pdfY = this.currentRect.pageY * scaleY;
    let areaWidth = Math.abs(pageWidth) * scaleX;
    let areaHeight = Math.abs(pageHeight) * scaleY;
    
    console.log('Adjusted Y (pixels):', adjustedY);
    console.log('PDF coordinates (before Y conversion):', { x: pdfX, y: pdfY, width: areaWidth, height: areaHeight });
    
    // Convertir Y del sistema HTML (origen arriba) al sistema PDF (origen abajo)
    pdfY = realPdfHeight - pdfY - areaHeight;
    
    console.log('PDF coordinates (after Y conversion):', { x: pdfX, y: pdfY, width: areaWidth, height: areaHeight });
    
    // Validar que las coordenadas no excedan los límites del PDF
    if (pdfX < 0) pdfX = 0;
    if (pdfY < 0) pdfY = 0;
    if (pdfX + areaWidth > realPdfWidth) areaWidth = realPdfWidth - pdfX;
    if (pdfY + areaHeight > realPdfHeight) areaHeight = realPdfHeight - pdfY;
    
    // Asegurar dimensiones mínimas en puntos del PDF
    const minWidthPoints = minWidth * scaleX;
    const minHeightPoints = minHeight * scaleY;
    
    if (areaWidth < minWidthPoints) areaWidth = minWidthPoints;
    if (areaHeight < minHeightPoints) areaHeight = minHeightPoints;
    
    // Solo redondear al final para evitar errores de precisión
    const finalPdfX = Math.round(pdfX);
    const finalPdfY = Math.round(pdfY);
    const finalAreaWidth = Math.round(areaWidth);
    const finalAreaHeight = Math.round(areaHeight);
    
    console.log('Final PDF coordinates (before rounding):', { x: pdfX, y: pdfY, width: areaWidth, height: areaHeight });
    console.log('Final PDF coordinates (after rounding):', { x: finalPdfX, y: finalPdfY, width: finalAreaWidth, height: finalAreaHeight });
    console.log('PDF dimensions:', realPdfWidth, 'x', realPdfHeight);
    console.log('=== END FINISH DEFINING AREA ===');
    
    // Crear o actualizar el área de firma
    const existingAreaIndex = signatureAreas.findIndex(area => area.partyId === definingPartyId);
    
    const newArea: SignatureArea = {
      id: `area_${definingPartyId}`,//_page_${selectedPageNumber}`,
      x: finalPdfX,
      y: finalPdfY,
      width: finalAreaWidth,
      height: finalAreaHeight,
      page: selectedPageNumber, // Usar la página donde se hizo clic
      partyId: definingPartyId,
      color: existingAreaIndex >= 0 ? this.signatureAreas[existingAreaIndex].color : this.getRandomColor(), // Mantener el color si existe
      isDefined: true,
      isSigned: existingAreaIndex >= 0 ? this.signatureAreas[existingAreaIndex].isSigned : false, // Mantener el estado de firma
      signatureData: existingAreaIndex >= 0 ? this.signatureAreas[existingAreaIndex].signatureData : undefined // Mantener los datos de firma
    };
    
    if (existingAreaIndex >= 0) {
      signatureAreas[existingAreaIndex] = newArea;
      this.snackBar.open('Área de firma actualizada correctamente', 'OK', { duration: 2000 });
    } else {
      signatureAreas.push(newArea);
      this.snackBar.open('Área de firma definida correctamente', 'OK', { duration: 2000 });
    }
    // Persistir coordenadas originales para que la UI siempre muestre lo que dibujó el usuario
    this.saveOriginalAreaToLocalStorage(newArea);
    
    // Guardar en el backend
    this.saveAreaToBackend(newArea);
    
    this.isDragging = false;
    this.currentRect = null;
    
    // Mantener los eventos del canvas habilitados ya que siempre estamos en modo definición
    if (this.signatureCanvasRef) {
      this.signatureCanvasRef.nativeElement.style.pointerEvents = 'auto';
      console.log('Canvas pointer events kept enabled');
    }
    
    // Forzar redibujado del canvas inmediatamente
    console.log('🔍 Forcing canvas redraw after area creation');
    this.renderCanvas();
    
    // También redibujar después de un pequeño delay para asegurar que todo esté listo
    setTimeout(() => {
      console.log('🔍 Delayed canvas redraw');
      this.renderCanvas();
    }, 200);
  }

  deleteArea(area: SignatureArea): void {
    const index = this.signatureAreas.findIndex(a => a.id === area.id);
    if (index >= 0) {
      this.signatureAreas.splice(index, 1);
      this.snackBar.open('Área de firma eliminada', 'OK', { duration: 2000 });
    }
  }

  getAreaForPartyInCurrentPage(partyId: number): SignatureArea | undefined {
    // Buscar el área del party en cualquier página, no solo en la página actual
    return this.signatureAreas.find(area => 
      area.partyId === partyId && 
      area.isDefined
    );
  }

  hasAreaDefined(partyId: number): boolean {
    return this.signatureAreas.some(area => area.partyId === partyId && area.isDefined);
  }

  private saveAreaToBackend(area: SignatureArea): void {
    if (!area.partyId) return;
    
    // Buscar el party actual para obtener todos sus datos
    const currentParty = this.parties.find(p => p.id === area.partyId);
    if (!currentParty) return;
    
    console.log('Saving area to backend - Original coordinates:', { x: area.x, y: area.y, width: area.width, height: area.height });
    
    // Crear el objeto en el formato que espera el backend
    // Usar las coordenadas originales del área que ya están en formato PDF
    const partyData = {
      firstName: currentParty.firstName,
      lastName: currentParty.lastName,
      email: currentParty.email,
      phoneNumber: currentParty.phoneNumber,
      prefix: currentParty.prefix,
      required: currentParty.required,
      voice: currentParty.voice,
      photo: currentParty.photo,
      partyTexts: currentParty.partyTexts.map(pt => ({ text: pt.text })),
      x: area.x, // Coordenadas ya están en formato PDF
      y: area.y, // Coordenadas ya están en formato PDF
      width: area.width, // Coordenadas ya están en formato PDF
      height: area.height, // Coordenadas ya están en formato PDF
      page: area.page,
      fingerPrint: currentParty.fingerPrint,
      lastVisitedPage: this.lastVisitedPage
    };
    
    console.log('Saving party data to backend:', partyData);
    
    this.partyService.updateParty(area.partyId, partyData).subscribe({
      next: () => {
        console.log('Área de firma guardada en el backend');
      },
      error: (err) => {
        console.error('Error al guardar área de firma:', err);
        this.snackBar.open('Error al guardar el área de firma', 'Cerrar', { duration: 3000 });
      }
    });
  }
  // Métodos para selección de áreas
  selectArea(area: SignatureArea): void {
    this.selectedArea = area;
    this.selectedParty = this.parties.find(p => p.id === area.partyId) || null;
  }

  editArea(area: SignatureArea): void {
    this.selectArea(area);
    this.startDefiningAreaForParty(area.partyId!);
  }

  editAreaForParty(partyId: number): void {
    // Buscar el área del party en cualquier página
    const area = this.getAreaForPartyInCurrentPage(partyId);
    if (area) {
      this.editArea(area);
    } else {
      // Si no hay área definida, crear una nueva
      this.startDefiningAreaForParty(partyId);
    }
  }

  private setupCanvasOverlay(): void {
    console.log('setupCanvasOverlay called');
    if (!this.signatureCanvasRef) {
      console.log('signatureCanvasRef not available');
      return;
    }
    
    const canvas = this.signatureCanvasRef.nativeElement;
    console.log('Canvas element found:', canvas);
    
    this.canvasCtx = canvas.getContext('2d');
    
    if (!this.canvasCtx) {
      console.log('Could not get canvas context');
      return;
    }
    
    console.log('Canvas context obtained successfully');
    
    // Siempre configurar el canvas para que coincida exactamente con el contenedor del PDF
    this.resizeCanvasToPdfPage();
    
    console.log('Canvas overlay setup complete');
  }

  private resizeCanvasToPdfPage(): void {
    if (!this.signatureCanvasRef || !this.pdfContainerRef) return;
    
    const canvas = this.signatureCanvasRef.nativeElement;
    const container = this.pdfContainerRef.nativeElement;
    
    // Esperar al siguiente frame para que el DOM se actualice
    requestAnimationFrame(() => {
      // Obtener las dimensiones del contenedor del PDF después de asegurar visibilidad
      const containerRect = container.getBoundingClientRect();
      
      console.log('🔍 Container dimensions:', containerRect.width, 'x', containerRect.height);
      
      // Si el contenedor tiene dimensiones 0x0, reintentar (con límite)
      if (containerRect.width === 0 || containerRect.height === 0) {
        this.resizeCanvasRetryCount++;
        if (this.resizeCanvasRetryCount >= this.maxResizeRetries) {
          console.warn('🔍 Max retries reached for resizeCanvasToPdfPage, stopping');
          this.resizeCanvasRetryCount = 0; // Reset para futuros intentos
          return;
        }
        console.warn(`🔍 Container dimensions are 0x0, retrying (${this.resizeCanvasRetryCount}/${this.maxResizeRetries})...`);
        setTimeout(() => {
          this.resizeCanvasToPdfPage();
        }, 100);
        return; // Salir temprano si no hay dimensiones válidas
      }
      
      // Resetear contador si tenemos dimensiones válidas
      this.resizeCanvasRetryCount = 0;
      
      // Buscar todas las páginas PDF visibles
      const pdfPages = document.querySelectorAll('.pdf-viewer .page') as NodeListOf<HTMLElement>;
      if (pdfPages.length === 0) {
        console.log('🔍 No PDF pages found for canvas resize');
        // Reintentar después de un delay si no hay páginas
        setTimeout(() => {
          this.resizeCanvasToPdfPage();
        }, 200);
        return;
      }
      
      // Calcular el área total que cubren todas las páginas visibles
      let minTop = Infinity;
      let maxBottom = -Infinity;
      let maxWidth = 0;
      
      const pageRect = pdfPages[0].getBoundingClientRect();
      minTop = Math.min(minTop, pageRect.top);
      maxBottom = Math.max(maxBottom, pageRect.bottom);
      maxWidth = Math.max(maxWidth, pageRect.width);
      
      // Crear un rectángulo que cubre todas las páginas visibles
      const combinedRect = {
        top: minTop,
        left: pdfPages[0].getBoundingClientRect().left, // Usar el left de la primera página
        width: maxWidth,
        height: maxBottom - minTop
      };
      
      // Determinar la página principal para actualizar currentPage
      const currentPageElement = pdfPages[0];
      
      // Verificar que el área combinada tenga dimensiones válidas
      if (combinedRect.width === 0 || combinedRect.height === 0) {
        console.warn('🔍 Combined rect has 0x0 dimensions, retrying...');
        setTimeout(() => {
          this.resizeCanvasToPdfPage();
        }, 200);
        return;
      }
      
      // Obtener el ancho del scrollbar si existe (típicamente 15-20px)
      const viewerContainer = container.querySelector('#viewerContainer') as HTMLElement;
      
      // Usar dimensiones mínimas si son muy pequeñas, dejando espacio para el scrollbar
      const canvasWidth = Math.max(combinedRect.width -30, 280);
      const canvasHeight = canvasWidth * this.pdfproportions;
      
      // Configurar el canvas para cubrir TODAS las páginas visibles
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = canvasWidth + 'px';
      canvas.style.height = canvasHeight + 'px';
      canvas.style.position = 'absolute';
      
      // Posicionar el canvas para cubrir todas las páginas visibles
      canvas.style.left = (combinedRect.left - containerRect.left + 5) + 'px';
      canvas.style.top = (combinedRect.top - containerRect.top + 5) + 'px';
      
      // Reducir z-index para que no esté por encima del scrollbar
      canvas.style.zIndex = '10';
      canvas.style.pointerEvents = 'auto';
      canvas.style.borderRadius = '8px';
      canvas.style.boxSizing = 'border-box';
      
      // Agregar la clase drawing-mode para habilitar los eventos del mouse
      canvas.classList.add('drawing-mode');
      
      // Asegurar que el canvas tenga los eventos habilitados pero sin interferir con el scrollbar
      canvas.style.pointerEvents = 'auto';
      
      // Obtener el contexto del canvas
      this.canvasCtx = canvas.getContext('2d');
      if (this.canvasCtx) {
        this.canvasCtx.lineCap = 'round';
        this.canvasCtx.lineJoin = 'round';
        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.strokeStyle = '#000';
      }
      
      // Ajustar también el overlay para que coincida exactamente con el canvas (usar combinedRect)
      //this.resizeCanvasOverlay(combinedRect as DOMRect, containerRect);
      
      console.log('🔍 Canvas resized for page:', this.currentPage);
      console.log('🔍 Canvas dimensions:', canvas.width, 'x', canvas.height);
      console.log('🔍 Canvas position:', canvas.style.left, canvas.style.top);
      console.log('🔍 Canvas pointer events:', canvas.style.pointerEvents);
      
      // Forzar redibujado del canvas
      this.forceCanvasRedraw();
    });
  }

  // Intenta obtener las dimensiones reales del PDF (en puntos) de forma robusta
  private async getRealPdfDimensions(pageNumber: number): Promise<{ pageRect: DOMRect; realPdfWidth: number; realPdfHeight: number; }>{
    const pages = document.querySelectorAll('.pdf-viewer .page') as NodeListOf<HTMLElement>;
    const pageIndex = Math.max(0, Math.min(pageNumber - 1, pages.length - 1));
    const currentPage = pages[pageIndex] || pages[0];
    if (!currentPage) {
      // Fallback sin páginas: asumir A4
      return { pageRect: new DOMRect(0,0,595,842), realPdfWidth: 595, realPdfHeight: 842 };
    }

    const pageRect = currentPage.getBoundingClientRect();
    let realPdfWidth = 595;
    let realPdfHeight = 842;

    // 1) Intentar leer escala desde .pdfViewport transform
    const pdfViewport = currentPage.querySelector('.pdfViewport') as HTMLElement;
    if (pdfViewport) {
      const viewportStyle = window.getComputedStyle(pdfViewport);
      const transform = viewportStyle.transform;
      if (transform && transform !== 'none') {
        const matrix = transform.match(/matrix\(([^)]+)\)/);
        if (matrix) {
          const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
          if (values.length >= 4) {
            const scaleX = values[0];
            const scaleY = values[3];
            if (scaleX && scaleY) {
              realPdfWidth = pageRect.width / scaleX;
              realPdfHeight = pageRect.height / scaleY;
            }
          }
        }
      }
    }

    // 2) Si sigue siendo A4 default, intentar API interna de PDF.js
    try {
      const pdfViewerElement = document.querySelector('ngx-extended-pdf-viewer') as any;
      const pdfViewer = pdfViewerElement?._pdfViewer;
      const pdfDocument = pdfViewer?.pdfDocument;
      if (pdfDocument && pdfDocument.getPage) {
        const page = await pdfDocument.getPage(pageNumber);
        if (page && page.view && page.view.length >= 4) {
          // page.view: [xMin, yMin, xMax, yMax]
          const xMin = page.view[0];
          const yMin = page.view[1];
          const xMax = page.view[2];
          const yMax = page.view[3];
          const widthPts = Math.abs(xMax - xMin);
          const heightPts = Math.abs(yMax - yMin);
          if (widthPts > 0 && heightPts > 0) {
            realPdfWidth = widthPts;
            realPdfHeight = heightPts;
          }
        }
      }
    } catch { /* ignore */ }

    return { pageRect, realPdfWidth, realPdfHeight };
  }

  private updatePagePositions(): void {
    if (!this.signatureCanvasRef || !this.pdfContainerRef) return;
    
    // Buscar todas las páginas PDF visibles
    const pdfPages = document.querySelectorAll('.pdf-viewer .page') as NodeListOf<HTMLElement>;
    if (!pdfPages || pdfPages.length === 0) {
      console.log('🔍 No PDF pages found for position update');
      return;
    }
    
    const container = this.pdfContainerRef.nativeElement;
    const containerRect = container.getBoundingClientRect();
    
    console.log('🔍 Updating page positions:');
    console.log('🔍 Container rect:', containerRect);
    console.log('🔍 Container scroll top:', container.scrollTop);
    console.log('🔍 Number of pages found:', pdfPages.length);
    
    const pagePositions: { top: number, height: number }[] = [];
    
    // Calcular la posición relativa al contenedor del PDF
    const pageRect = pdfPages[0].getBoundingClientRect();
    const pageTop = pageRect.top - containerRect.top + container.scrollTop;
    const pageHeight = pageRect.height;
    
    console.log(`🔍   Page rect:`, pageRect);
    console.log(`🔍   Calculated top: ${pageTop}, height: ${pageHeight}`);
    
    pagePositions.push({
      top: pageTop,
      height: pageHeight
    });
    
    // Actualizar las posiciones de las páginas
    this.pagePositions = pagePositions;
    
    console.log('🔍 Final page positions:', this.pagePositions);
    
    // NO llamar renderCanvas aquí para evitar bucles infinitos
  }

  private setupViewerContainerScrollListener(): void {
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
    
    // Crear el listener de scroll
    this.viewerContainerScrollListener = () => {
      // Actualizar las posiciones de las páginas y el canvas
      setTimeout(() => {
        this.updatePagePositions();
        this.resizeCanvasToPdfPage();
        this.renderCanvas();
      }, 10);
    };
    
    // Agregar listener para el scroll del viewerContainer
    viewerContainer.addEventListener('scroll', this.viewerContainerScrollListener);
    
    // También agregar listener para cambios de tamaño
    this.resizeObserver = new ResizeObserver(() => {
      setTimeout(() => {
        this.resizeCanvasToPdfPage();
        this.renderCanvas();
      }, 100);
    });
    
    this.resizeObserver.observe(viewerContainer);
  }

  // Métodos de debug para la interfaz
  getCanvasWidth(): number {
    return this.signatureCanvasRef?.nativeElement?.width || 0;
  }

  getCanvasHeight(): number {
    return this.signatureCanvasRef?.nativeElement?.height || 0;
    }
    
  getDefinedAreasCount(): number {
    return this.signatureAreas.filter(a => a.isDefined).length;
  }

  getDefinedAreas(): SignatureArea[] {
    return this.signatureAreas.filter(a => a.isDefined);
  }

  // Métodos de debug adicionales
  testCoordinateConversion(): void {
    console.log('=== TESTING COORDINATE CONVERSION ===');
    
    const pdfPages = document.querySelectorAll('.pdf-viewer .page') as NodeListOf<HTMLElement>;
    if (pdfPages.length === 0) {
      console.log('No PDF pages found');
      return;
    }
    
    console.log(`Found ${pdfPages.length} PDF pages`);
    
    pdfPages.forEach((page, index) => {
      const pageRect = page.getBoundingClientRect();
      const pdfViewport = page.querySelector('.pdfViewport') as HTMLElement;
      
      let realPdfWidth = 595; // Default A4 width
      let realPdfHeight = 842; // Default A4 height
      let scaleX = 1;
      let scaleY = 1;
      
      if (pdfViewport) {
        const viewportStyle = window.getComputedStyle(pdfViewport);
        const transform = viewportStyle.transform;
        if (transform && transform !== 'none') {
          const matrix = transform.match(/matrix\(([^)]+)\)/);
          if (matrix) {
            const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
            if (values.length >= 4) {
              scaleX = values[0];
              scaleY = values[3];
              realPdfWidth = pageRect.width / scaleX;
              realPdfHeight = pageRect.height / scaleY;
            }
          }
        }
      }
      
      console.log(`Page ${index + 1}:`);
      console.log(`  Display size: ${pageRect.width} x ${pageRect.height}`);
      console.log(`  Scale factors: ${scaleX} x ${scaleY}`);
      console.log(`  PDF real dimensions: ${realPdfWidth} x ${realPdfHeight}`);
      
      // Test conversion de coordenadas de ejemplo
      const testX = 100;
      const testY = 100;
      const testWidth = 200;
      const testHeight = 100;
      
      // Convertir de pantalla a PDF
      const convertedX = testX * (realPdfWidth / pageRect.width);
      const convertedY = testY * (realPdfHeight / pageRect.height);
      const convertedWidth = testWidth * (realPdfWidth / pageRect.width);
      const convertedHeight = testHeight * (realPdfHeight / pageRect.height);
      
      // Convertir Y del sistema HTML al sistema PDF
      const pdfY = realPdfHeight - convertedY - convertedHeight;
      
      console.log(`  Test conversion (screen to PDF):`);
      console.log(`    Screen: ${testX},${testY} ${testWidth}x${testHeight}`);
      console.log(`    PDF: ${convertedX},${pdfY} ${convertedWidth}x${convertedHeight}`);
      
      // Test conversion de vuelta de PDF a pantalla
      const backToScreenX = convertedX * (pageRect.width / realPdfWidth);
      const backToScreenY = (realPdfHeight - pdfY - convertedHeight) * (pageRect.height / realPdfHeight);
      const backToScreenWidth = convertedWidth * (pageRect.width / realPdfWidth);
      const backToScreenHeight = convertedHeight * (pageRect.height / realPdfHeight);
      
      console.log(`  Test conversion (PDF to screen):`);
      console.log(`    PDF: ${convertedX},${pdfY} ${convertedWidth}x${convertedHeight}`);
      console.log(`    Screen: ${backToScreenX},${backToScreenY} ${backToScreenWidth}x${backToScreenHeight}`);
      
      // Verificar precisión
      const xDiff = Math.abs(testX - backToScreenX);
      const yDiff = Math.abs(testY - backToScreenY);
      const widthDiff = Math.abs(testWidth - backToScreenWidth);
      const heightDiff = Math.abs(testHeight - backToScreenHeight);
      
      console.log(`  Precision check (differences):`);
      console.log(`    X diff: ${xDiff}, Y diff: ${yDiff}, Width diff: ${widthDiff}, Height diff: ${heightDiff}`);
    });
    
    console.log('Areas actuales:');
    this.signatureAreas.forEach(area => {
      console.log(`  ${area.id}: x=${area.x}, y=${area.y}, w=${area.width}, h=${area.height}, page=${area.page}`);
    });
    
    console.log('Page positions:');
    this.pagePositions.forEach((pos, index) => {
      console.log(`  Page ${index + 1}: top=${pos.top}, height=${pos.height}`);
    });
    
    console.log('=====================================');
  }

  clearAllAreas(): void {
    this.signatureAreas = [];
    this.renderCanvas();
    this.snackBar.open('Todas las áreas han sido eliminadas', 'OK', { duration: 2000 });
  }

  createTestAreas(): void {
    // Crear áreas de prueba con coordenadas conservadoras que sabemos que funcionan
    const testAreas: SignatureArea[] = [
      {
        id: 'test_area_1',
        x: 50,
        y: 50,
        width: 150,
        height: 80,
        page: 1,
        partyId: 1,
        color: '#4CAF50',
        isDefined: true,
        isSigned: false
      },
      {
        id: 'test_area_2',
        x: 50,
        y: 150,
        width: 150,
        height: 80,
        page: 1,
        partyId: 2,
        color: '#2196F3',
        isDefined: true,
        isSigned: false
      }
    ];

    this.signatureAreas = testAreas;
    this.renderCanvas();
    this.snackBar.open('Áreas de prueba creadas (coordenadas conservadoras)', 'OK', { duration: 2000 });
    
    console.log('Test areas created (conservative coordinates):');
    testAreas.forEach(area => {
      console.log(`  ${area.id}: x=${area.x}, y=${area.y}, w=${area.width}, h=${area.height}, page=${area.page}`);
    });
  }

  validateCoordinates(x: number, y: number, width: number, height: number): { isValid: boolean; message: string } {
    // Obtener las dimensiones reales del PDF
    const pdfPages = document.querySelectorAll('.pdf-viewer .page') as NodeListOf<HTMLElement>;
    let realPdfWidth = 595; // Default A4 width
    let realPdfHeight = 842; // Default A4 height
    
    if (pdfPages.length > 0) {
      const firstPage = pdfPages[0];
      const pageRect = firstPage.getBoundingClientRect();
      const pdfViewport = firstPage.querySelector('.pdfViewport') as HTMLElement;
      
      if (pdfViewport) {
        const viewportStyle = window.getComputedStyle(pdfViewport);
        const transform = viewportStyle.transform;
        if (transform && transform !== 'none') {
          const matrix = transform.match(/matrix\(([^)]+)\)/);
          if (matrix) {
            const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
            if (values.length >= 4) {
              const scaleX = values[0];
              const scaleY = values[3];
              realPdfWidth = Math.round(pageRect.width / scaleX);
              realPdfHeight = Math.round(pageRect.height / scaleY);
            }
          }
        }
      }
    }
    
    let message = '';
    let isValid = true;
    
    // Validar rangos básicos
    if (x < 0 || y < 0 || width <= 0 || height <= 0) {
      message = 'Coordenadas deben ser positivas';
      isValid = false;
    }
    
    // Validar que no excedan las dimensiones del PDF
    if (x + width > realPdfWidth) {
      message = `Ancho excede PDF (${x + width} > ${realPdfWidth})`;
      isValid = false;
    }
    
    if (y + height > realPdfHeight) {
      message = `Alto excede PDF (${y + height} > ${realPdfHeight})`;
      isValid = false;
    }
    
    // Validar rangos conservadores para evitar problemas
    if (y > 750) {
      message = 'Coordenada Y muy alta (>750) - puede causar problemas';
      isValid = false;
    }
    
    if (x > 500) {
      message = 'Coordenada X muy alta (>500) - puede causar problemas';
      isValid = false;
    }
    
    if (width > 250) {
      message = 'Ancho muy grande (>250) - puede causar problemas';
      isValid = false;
    }
    
    if (height > 150) {
      message = 'Alto muy grande (>150) - puede causar problemas';
      isValid = false;
    }
    
    // Validar dimensiones mínimas
    if (width < 50) {
      message = 'Ancho muy pequeño (<50)';
      isValid = false;
    }
    
    if (height < 30) {
      message = 'Alto muy pequeño (<30)';
      isValid = false;
    }
    
    return { isValid, message };
  }

  // Método mejorado para ajustar coordenadas automáticamente
  adjustCoordinates(x: number, y: number, width: number, height: number): { x: number; y: number; width: number; height: number } {
    // Obtener las dimensiones reales del PDF
    const pdfPages = document.querySelectorAll('.pdf-viewer .page') as NodeListOf<HTMLElement>;
    let realPdfWidth = 595; // Default A4 width
    let realPdfHeight = 842; // Default A4 height
    
    if (pdfPages.length > 0) {
      const firstPage = pdfPages[0];
      const pageRect = firstPage.getBoundingClientRect();
      const pdfViewport = firstPage.querySelector('.pdfViewport') as HTMLElement;
      
      if (pdfViewport) {
        const viewportStyle = window.getComputedStyle(pdfViewport);
        const transform = viewportStyle.transform;
        if (transform && transform !== 'none') {
          const matrix = transform.match(/matrix\(([^)]+)\)/);
          if (matrix) {
            const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
            if (values.length >= 4) {
              const scaleX = values[0];
              const scaleY = values[3];
              realPdfWidth = Math.round(pageRect.width / scaleX);
              realPdfHeight = Math.round(pageRect.height / scaleY);
            }
          }
        }
      }
    }
    
    let adjustedX = x;
    let adjustedY = y;
    let adjustedWidth = width;
    let adjustedHeight = height;
    
    // Asegurar dimensiones mínimas (200x100 como solicitado)
    if (adjustedWidth < 200) adjustedWidth = 200;
    if (adjustedHeight < 100) adjustedHeight = 100;
    
    // Asegurar dimensiones máximas conservadoras (máximo 40% del PDF)
    const maxWidth = Math.round(realPdfWidth * 0.4);
    const maxHeight = Math.round(realPdfHeight * 0.4);
    
    if (adjustedWidth > maxWidth) adjustedWidth = maxWidth;
    if (adjustedHeight > maxHeight) adjustedHeight = maxHeight;
    
    // Ajustar coordenadas para que no excedan los límites
    if (adjustedX < 0) adjustedX = 0;
    if (adjustedY < 0) adjustedY = 0;
    
    if (adjustedX + adjustedWidth > realPdfWidth) {
      adjustedX = Math.max(0, realPdfWidth - adjustedWidth);
    }
    
    if (adjustedY + adjustedHeight > realPdfHeight) {
      adjustedY = Math.max(0, realPdfHeight - adjustedHeight);
    }
    
    // Asegurar que las coordenadas estén en rangos conservadores
    const maxX = Math.round(realPdfWidth * 0.8);
    const maxY = Math.round(realPdfHeight * 0.8);
    
    if (adjustedX > maxX) adjustedX = maxX;
    if (adjustedY > maxY) adjustedY = maxY;
    
    return {
      x: Math.round(adjustedX),
      y: Math.round(adjustedY),
      width: Math.round(adjustedWidth),
      height: Math.round(adjustedHeight)
    };
  }

  validateCurrentAreas(): void {
    console.log('=== VALIDATING CURRENT AREAS ===');
    
    if (this.signatureAreas.length === 0) {
      this.snackBar.open('No hay áreas definidas para validar', 'OK', { duration: 2000 });
      return;
    }
    
    let allValid = true;
    let validationMessages: string[] = [];
    
    this.signatureAreas.forEach((area, index) => {
      const validation = this.validateCoordinates(area.x, area.y, area.width, area.height);
      
      console.log(`Area ${index + 1} (${area.id}):`);
      console.log(`  Coordinates: x=${area.x}, y=${area.y}, w=${area.width}, h=${area.height}`);
      console.log(`  Valid: ${validation.isValid}, Message: ${validation.message}`);
      
      if (!validation.isValid) {
        allValid = false;
        validationMessages.push(`Área ${index + 1}: ${validation.message}`);
      }
    });
    
    if (allValid) {
      this.snackBar.open('Todas las áreas tienen coordenadas válidas', 'OK', { 
        duration: 3000,
        panelClass: ['success-snackbar']
      });
    } else {
      this.snackBar.open(`Problemas encontrados: ${validationMessages.join('; ')}`, 'OK', { 
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
    }
    
    console.log('=== VALIDATION COMPLETE ===');
  }

  private async renderCanvas(): Promise<void> {
    // Prevenir múltiples renders simultáneos
    if (this.isRendering) {
      console.log('🔍 Render already in progress, skipping...');
      return;
    }
    
    this.isRendering = true;
    
    try {
      console.log('🔍 ===== renderCanvas METHOD CALLED =====');
      console.log('🔍 canvasCtx available:', !!this.canvasCtx);
      console.log('🔍 signatureCanvasRef available:', !!this.signatureCanvasRef);
      console.log('🔍 Number of signature areas:', this.signatureAreas.length);
      console.log('🔍 Current page:', this.currentPage);
      console.log('🔍 Signature areas:', this.signatureAreas);
      
      if (!this.canvasCtx || !this.signatureCanvasRef) {
        console.log('🔍 Canvas context or signature canvas ref not available, returning');
        return;
      }
    
    // Actualizar las posiciones de las páginas antes de renderizar
    this.updatePagePositions();
    
    const canvas = this.signatureCanvasRef.nativeElement;
    console.log('🔍 Canvas dimensions:', canvas.width, 'x', canvas.height);
    
    // Limpiar el canvas y dejarlo transparente
    this.canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Obtener las dimensiones reales del PDF desde el visor
    const pdfPages = document.querySelectorAll('.pdf-viewer .page') as NodeListOf<HTMLElement>;
    if (pdfPages.length === 0) {
      console.log('🔍 No PDF pages found for rendering');
      return;
    }
    
    // Obtener dimensiones robustas del PDF
    const dims = await this.getRealPdfDimensions(this.currentPage);
    const pageRect = dims.pageRect;
    const realPdfWidth = dims.realPdfWidth;
    const realPdfHeight = dims.realPdfHeight;
    
    // Calcular las escalas de conversión (PDF a pantalla)
    const scaleX = pageRect.width / realPdfWidth;
    const scaleY = pageRect.height / realPdfHeight;

    console.log('🔍 Render canvas - PDF dimensions:', realPdfWidth, 'x', realPdfHeight);
    console.log('🔍 Render canvas - Scale factors:', scaleX, 'x', scaleY);
    console.log('🔍 Render canvas - Current page:', this.currentPage);

    // Obtener todas las páginas visibles
    const container = this.pdfContainerRef?.nativeElement;
    const containerRect = container?.getBoundingClientRect();
    const visiblePages: { pageElement: HTMLElement, pageNumber: number }[] = [];
    
    if (containerRect) {
      pdfPages.forEach((page, index) => {
        const pageRect = page.getBoundingClientRect();
        const visibleTop = Math.max(pageRect.top, containerRect.top);
        const visibleBottom = Math.min(pageRect.bottom, containerRect.bottom);
        if (visibleBottom > visibleTop) {
          visiblePages.push({ pageElement: page, pageNumber: index + 1 });
        }
      });
    }
    
    console.log('🔍 Visible pages:', visiblePages.map(p => p.pageNumber));
    
    const pageRealWidth = dims.realPdfWidth;
    const pageRealHeight = dims.realPdfHeight;
    
    const pageScaleX = canvas.width / pageRealWidth;
    const pageScaleY = canvas.height / pageRealHeight;
    
    // Obtener posición del canvas relativa a esta página
    const canvasRect = canvas.getBoundingClientRect();
    const pageOffsetX = pageRect.left - canvasRect.left;
    const pageOffsetY = pageRect.top - canvasRect.top;
    
    // Filtrar áreas de esta página específica
    const areasForThisPage = this.signatureAreas.filter(area => area.page === this.lastVisitedPage);
    console.log(`🔍 Rendering ${areasForThisPage.length} areas for page ${this.lastVisitedPage}`);
    
    areasForThisPage.forEach((area, index) => {
      console.log(`🔍 Rendering area ${index + 1}/${areasForThisPage.length} for page ${this.lastVisitedPage}:`, area);
      
      // Convertir coordenadas del PDF (puntos) a coordenadas de pantalla (píxeles)
      // Convertir Y del sistema PDF (origen abajo) al sistema HTML (origen arriba)
      const pdfYInverted = pageRealHeight - area.y - area.height;
      
      const screenX = (area.x * pageScaleX) + pageOffsetX;
      const screenY = (pdfYInverted * pageScaleY) + pageOffsetY;
      const screenWidth = area.width * pageScaleX;
      const screenHeight = area.height * pageScaleY;
      
      console.log(`🔍 Drawing area ${area.id} on page ${area.page}:`);
      console.log(`🔍   PDF coordinates: x=${area.x}, y=${area.y}, w=${area.width}, h=${area.height}`);
      console.log(`🔍   PDF Y inverted: ${pdfYInverted}`);
      console.log(`🔍   Screen coordinates: x=${screenX}, y=${screenY}, w=${screenWidth}, h=${screenHeight}`);
      console.log(`🔍   Page offset: x=${pageOffsetX}, y=${pageOffsetY}`);
      
      // Verificar que las coordenadas estén dentro del canvas
      if (screenX >= 0 && screenY >= 0 && screenWidth > 0 && screenHeight > 0) {
        this.drawAreaOnCanvas(area, screenX, screenY, screenWidth, screenHeight);
      } else {
        console.log(`🔍 Area ${area.id} coordinates out of bounds, skipping`);
      }
      });

    // Dibujar el área actual si está dibujando SOLO en la página visible
    if (this.currentRect && this.isDragging) {
      console.log('🔍 Drawing current rect:', this.currentRect);
      
      // Dibujar el rectángulo de drag con estilo más visible
      this.canvasCtx.strokeStyle = '#00FF00'; // Verde para que sea muy visible 
      this.canvasCtx.lineWidth = 3;
      this.canvasCtx.setLineDash([8, 4]);
      this.canvasCtx.strokeRect(this.currentRect.x, this.currentRect.y, this.currentRect.width, this.currentRect.height);
      this.canvasCtx.setLineDash([]);
      
      // Relleno semi-transparente
      this.canvasCtx.fillStyle = 'rgba(0, 255, 0, 0.2)';
      this.canvasCtx.fillRect(this.currentRect.x, this.currentRect.y, this.currentRect.width, this.currentRect.height);
      
      // Mostrar dimensiones del área que se está creando
      const width = Math.abs(this.currentRect.width);
      const height = Math.abs(this.currentRect.height);
      const dimensionsText = `${Math.round(width)} x ${Math.round(height)}`;
      
      // Dibujar fondo para el texto
      this.canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      this.canvasCtx.fillRect(this.currentRect.x - 5, this.currentRect.y + this.currentRect.height / 2 - 10, 80, 20);
      
      // Dibujar el texto de dimensiones
      this.canvasCtx.fillStyle = '#00FF00';
      this.canvasCtx.font = 'bold 12px Arial';
      this.canvasCtx.fillText(dimensionsText, this.currentRect.x, this.currentRect.y + this.currentRect.height / 2 + 5);
    }
    } catch (error) {
      console.error('🔍 Error in renderCanvas:', error);
    } finally {
      this.isRendering = false;
    }
  }

  private drawAreaOnCanvas(area: SignatureArea, x: number, y: number, width: number, height: number): void {
    console.log('🔍 ===== drawAreaOnCanvas METHOD CALLED =====');
    console.log('🔍 Area ID:', area.id);
    console.log('🔍 Coordinates:', x, y, width, height);
    console.log('🔍 Canvas context available:', !!this.canvasCtx);
    
    if (!this.canvasCtx) {
      console.log('🔍 No canvas context available');
      return;
    }
    
    // Dibujar el borde del área en azul para que sea visible sobre el fondo rojo
    this.canvasCtx.strokeStyle = '#0000FF'; // Azul para que sea muy visible sobre el rojo
    this.canvasCtx.lineWidth = 3;
    this.canvasCtx.setLineDash([]); // Áreas definidas sin línea punteada
    this.canvasCtx.strokeRect(x, y, width, height);
    this.canvasCtx.setLineDash([]);
    
    // Relleno semi-transparente en azul
    this.canvasCtx.fillStyle = 'rgba(0, 0, 255, 0.2)'; // Azul semi-transparente
    this.canvasCtx.fillRect(x, y, width, height);
    
    // Dibujar información del firmante
    if (area.partyId) {
      const party = this.parties.find(p => p.id === area.partyId);
      const partyName = party ? `${party.firstName} ${party.lastName}` : 'Firmante desconocido';
      this.canvasCtx.fillStyle = '#FFFFFF'; // Texto blanco para que sea visible sobre el rojo
      this.canvasCtx.font = 'bold 12px Arial';
      this.canvasCtx.fillText(partyName, x + 5, y + 15);
      
      const status = 'Definida';
      this.canvasCtx.fillStyle = '#00FF00'; // Verde para el status
      this.canvasCtx.font = 'bold 10px Arial';
      this.canvasCtx.fillText(status, x + 5, y + 25);
    }
    
    console.log('🔍 Area drawn successfully');
  }

  // Método auxiliar para detectar en qué página está un punto dado
  private getPageForPoint(clientX: number, clientY: number): { pageElement: HTMLElement | null, pageNumber: number } {
    const pdfPages = document.querySelectorAll('.pdf-viewer .page') as NodeListOf<HTMLElement>;
    if (pdfPages.length === 0) {
      return { pageElement: null, pageNumber: 1 };
    }
    
    const pagesArray = Array.from(pdfPages);
    for (let i = 0; i < pagesArray.length; i++) {
      const pageRect = pagesArray[i].getBoundingClientRect();
      // Verificar si el punto está dentro de los límites de esta página
      if (clientX >= pageRect.left && clientX <= pageRect.right &&
          clientY >= pageRect.top && clientY <= pageRect.bottom) {
        return { pageElement: pagesArray[i], pageNumber: i + 1 };
      }
    }
    
    // Si no se encuentra ninguna página, usar la más cercana
    let minDistance = Infinity;
    let closestPage = pagesArray[0];
    let closestPageNumber = 1;
    
    pagesArray.forEach((page, index) => {
      const pageRect = page.getBoundingClientRect();
      const pageCenterX = pageRect.left + pageRect.width / 2;
      const pageCenterY = pageRect.top + pageRect.height / 2;
      const distance = Math.sqrt(
        Math.pow(clientX - pageCenterX, 2) + Math.pow(clientY - pageCenterY, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestPage = page;
        closestPageNumber = index + 1;
      }
    });
    
    return { pageElement: closestPage, pageNumber: closestPageNumber };
  }

  // Métodos del canvas overlay - Solo drag para definir áreas
  onCanvasMouseDown(event: MouseEvent): void {
    console.log('Canvas MouseDown - isDefiningArea:', this.isDefiningArea);
    if (!this.isDefiningArea) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    this.isMouseDown = true;
    const canvas = this.signatureCanvasRef.nativeElement;
    const container = this.pdfContainerRef.nativeElement;
    
    // Usar la página actual del paginador en lugar de detectar por posición del mouse
    // ya que solo mostramos una página a la vez
    const pageNumber = this.lastVisitedPage;
    console.log('🔍 Using current page from paginator:', pageNumber);
    
    // Detectar en qué página se está haciendo clic (solo para obtener el pageElement)
    const { pageElement } = this.getPageForPoint(event.clientX, event.clientY);
    
    if (!pageElement) {
      console.warn('🔍 No page element found for click');
      return;
    }
    
    // Obtener el rectángulo de la página específica
    const pageRect = pageElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Calcular coordenadas relativas a la PÁGINA específica (no al canvas combinado)
    const pageX = event.clientX - pageRect.left;
    const pageY = event.clientY - pageRect.top;
    
    // Guardar también información de la página para uso posterior
    this.currentDefiningPageRect = pageRect;
    
    // Calcular coordenadas relativas al canvas (para el dibujo)
    const canvasRect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;
    
    this.canvasStartX = canvasX;
    this.canvasStartY = canvasY;
    // Guardar las coordenadas relativas a la página en el rect
    this.currentRect = { 
      x: canvasX, 
      y: canvasY, 
      width: 0, 
      height: 0,
      pageX: pageX,  // Coordenada X relativa a la página
      pageY: pageY,  // Coordenada Y relativa a la página
      pageNumber: pageNumber  // Número de página desde el paginador
    };
    
    console.log('Canvas MouseDown - Mouse position:', event.clientX, event.clientY);
    console.log('Canvas MouseDown - Page number:', pageNumber);
    console.log('Canvas MouseDown - Page coordinates:', pageX, pageY);
    console.log('Canvas MouseDown - Canvas coordinates:', canvasX, canvasY);
    console.log('Canvas MouseDown - currentRect created:', this.currentRect);
    
    // Cambiar cursor
    canvas.style.cursor = 'crosshair';
    
    // Si no hay un party seleccionado, mostrar mensaje para seleccionar uno
    if (!this.currentDefiningPartyId) {
      this.snackBar.open('Selecciona un firmante de la lista para definir su área de firma', 'OK', { 
        duration: 3000,
        panelClass: ['warning-snackbar']
      });
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    console.log('Canvas MouseMove called - isMouseDown:', this.isMouseDown, 'currentRect:', !!this.currentRect, 'isDefiningArea:', this.isDefiningArea, 'canvasCtx:', !!this.canvasCtx);
    
    if (!this.isMouseDown || !this.currentRect || !this.isDefiningArea || !this.canvasCtx) {
      console.log('Canvas MouseMove - Early return, conditions not met');
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    const canvas = this.signatureCanvasRef.nativeElement;
    
    // Calcular coordenadas relativas al canvas
    const canvasRect = canvas.getBoundingClientRect();
    const currentX = event.clientX - canvasRect.left;
    const currentY = event.clientY - canvasRect.top;
    
    // Si tenemos la página de inicio guardada, calcular también las coordenadas relativas a esa página
    if (this.currentDefiningPageRect) {
      const currentPageX = event.clientX - this.currentDefiningPageRect.left;
      const currentPageY = event.clientY - this.currentDefiningPageRect.top;
      // Actualizar las coordenadas relativas a la página en el rect
      this.currentRect.pageEndX = currentPageX;
      this.currentRect.pageEndY = currentPageY;
    }
    
    // Solo activar el drag si se ha movido una distancia mínima
    const deltaX = Math.abs(currentX - this.canvasStartX);
    const deltaY = Math.abs(currentY - this.canvasStartY);
    
    if (deltaX > 5 || deltaY > 5) {
      this.isDragging = true;
    }
    
    if (this.isDragging) {
      // Actualizar dimensiones en coordenadas del canvas (para dibujar)
      this.currentRect.width = currentX - this.canvasStartX;
      this.currentRect.height = currentY - this.canvasStartY;
      
      // Actualizar dimensiones en coordenadas de la página (para guardar)
      if (this.currentRect.pageX !== undefined && this.currentRect.pageEndX !== undefined) {
        this.currentRect.pageWidth = this.currentRect.pageEndX - this.currentRect.pageX;
        this.currentRect.pageHeight = this.currentRect.pageEndY - this.currentRect.pageY;
      }
      
      this.renderCanvas();
    }
  }

  onCanvasMouseUp(event: MouseEvent): void {
    console.log('Canvas MouseUp - isDragging:', this.isDragging, 'isDefiningArea:', this.isDefiningArea);
    const shouldFinish = this.isDefiningArea && this.currentRect && (Math.abs(this.currentRect.width) > 2 || Math.abs(this.currentRect.height) > 2);
    this.isDragging = false;
    this.isMouseDown = false;
    const finalize = shouldFinish ? { ...this.currentRect } : null;
    this.currentRect = null;
    if (shouldFinish) {
      // Reasignar snapshot para finishDefiningArea
      this.currentRect = finalize as any;
      this.finishDefiningArea(this.lastVisitedPage, this.signatureAreas);
    }
    
    // Restaurar cursor
    if (this.signatureCanvasRef) {
      this.signatureCanvasRef.nativeElement.style.cursor = 'default';
    }
  }

  onCanvasTouchStart(event: TouchEvent): void {
    if (!this.isDefiningArea) return;
    
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    
    this.isMouseDown = true;
    const canvas = this.signatureCanvasRef.nativeElement;
    const touch = event.touches[0];
    
    // Usar la página actual del paginador en lugar de detectar por posición
    const pageNumber = this.currentPage;
    console.log('🔍 Touch detected, using current page from paginator:', pageNumber);
    
    // Detectar en qué página se está tocando (solo para obtener el pageElement)
    const { pageElement } = this.getPageForPoint(touch.clientX, touch.clientY);
    
    if (!pageElement) {
      console.warn('🔍 No page element found for touch');
      return;
    }
    
    // Obtener el rectángulo de la página específica
    const pageRect = pageElement.getBoundingClientRect();
    
    // Calcular coordenadas relativas a la PÁGINA específica
    const pageX = touch.clientX - pageRect.left;
    const pageY = touch.clientY - pageRect.top;
    
    // Guardar también información de la página para uso posterior
    this.currentDefiningPageRect = pageRect;
    
    // Calcular coordenadas relativas al canvas (para el dibujo)
    const canvasRect = canvas.getBoundingClientRect();
    const canvasX = touch.clientX - canvasRect.left;
    const canvasY = touch.clientY - canvasRect.top;
    
    this.canvasStartX = canvasX;
    this.canvasStartY = canvasY;
    // Guardar las coordenadas relativas a la página en el rect
    this.currentRect = { 
      x: canvasX, 
      y: canvasY, 
      width: 0, 
      height: 0,
      pageX: pageX,  // Coordenada X relativa a la página
      pageY: pageY,  // Coordenada Y relativa a la página
      pageNumber: pageNumber  // Número de página desde el paginador
    };
  }

  onCanvasTouchMove(event: TouchEvent): void {
    if (!this.isMouseDown || !this.currentRect || !this.isDefiningArea || !this.canvasCtx) return;
    
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    
    const canvas = this.signatureCanvasRef.nativeElement;
    const touch = event.touches[0];
    
    // Calcular coordenadas relativas al canvas
    const canvasRect = canvas.getBoundingClientRect();
    const currentX = touch.clientX - canvasRect.left;
    const currentY = touch.clientY - canvasRect.top;
    
    // Si tenemos la página de inicio guardada, calcular también las coordenadas relativas a esa página
    if (this.currentDefiningPageRect) {
      const currentPageX = touch.clientX - this.currentDefiningPageRect.left;
      const currentPageY = touch.clientY - this.currentDefiningPageRect.top;
      // Actualizar las coordenadas relativas a la página en el rect
      this.currentRect.pageEndX = currentPageX;
      this.currentRect.pageEndY = currentPageY;
    }
    
    // Solo activar el drag si se ha movido una distancia mínima
    const deltaX = Math.abs(currentX - this.canvasStartX);
    const deltaY = Math.abs(currentY - this.canvasStartY);
    
    if (deltaX > 5 || deltaY > 5) {
      this.isDragging = true;
    }
    
    if (this.isDragging) {
      // Actualizar dimensiones en coordenadas del canvas (para dibujar)
      this.currentRect.width = currentX - this.canvasStartX;
      this.currentRect.height = currentY - this.canvasStartY;
      
      // Actualizar dimensiones en coordenadas de la página (para guardar)
      if (this.currentRect.pageX !== undefined && this.currentRect.pageEndX !== undefined) {
        this.currentRect.pageWidth = this.currentRect.pageEndX - this.currentRect.pageX;
        this.currentRect.pageHeight = this.currentRect.pageEndY - this.currentRect.pageY;
      }
      
      this.renderCanvas();
    }
  }

  onCanvasTouchEnd(event: TouchEvent): void {
    const shouldFinish = this.isDefiningArea && this.currentRect && (Math.abs(this.currentRect.width) > 2 || Math.abs(this.currentRect.height) > 2);
    this.isDragging = false;
    this.isMouseDown = false;
    const finalize = shouldFinish ? { ...this.currentRect } : null;
    this.currentRect = null;
    if (shouldFinish) {
      this.currentRect = finalize as any;
      this.finishDefiningArea(this.lastVisitedPage, this.signatureAreas);
    }
  }

  deleteAreaForParty(partyId: number): void {
    // Buscar el área en la página actual
    const area = this.getAreaForPartyInCurrentPage(partyId);
    if (area) {
      this.deleteArea(area);
      this.renderCanvas();
    }
  }

  // Método para refirmar un área específica
  refirmAreaForParty(partyId: number): void {
    console.log('🔍 refirmAreaForParty called with partyId:', partyId);
    
    // Verificar que el party existe
    const party = this.parties.find(p => p.id === partyId);
    if (!party) {
      console.error('🔍 Party not found:', partyId);
      this.snackBar.open(`Error: No se encontró el firmante con ID ${partyId}`, 'Cerrar', { duration: 3000 });
      return;
    }
    
    const partyName = this.getPartyName(partyId);
    const existingArea = this.getAreaForPartyInCurrentPage(partyId);
    
    if (existingArea) {
      console.log('🔍 Refirming existing area for party:', existingArea);
      this.snackBar.open(`Refirmando área para ${partyName}. Haz click y arrastra para actualizar el área de firma.`, 'OK', { 
        duration: 5000,
        panelClass: ['info-snackbar']
      });
    } else {
      console.log('🔍 No existing area found, creating new one');
      this.snackBar.open(`Definiendo área para ${partyName}. Haz click y arrastra en el PDF para crear el área de firma.`, 'OK', { 
        duration: 5000,
        panelClass: ['info-snackbar']
      });
    }
    
    // Activar el modo de definición para este party
    this.startDefiningAreaForParty(partyId);
  }

  // Método para cancelar la definición de área actual
  cancelAreaDefinition(): void {
    this.currentDefiningPartyId = null;
    this.isDragging = false;
    this.isMouseDown = false;
    this.currentRect = null;
    
    // Mantener los eventos del canvas habilitados ya que siempre estamos en modo definición
    if (this.signatureCanvasRef) {
      this.signatureCanvasRef.nativeElement.style.pointerEvents = 'auto';
      console.log('Canvas pointer events kept enabled (cancelled)');
    }
    
    // Actualizar la posición del canvas
    setTimeout(() => {
      this.renderCanvas();
    }, 100);
    
    this.renderCanvas();
    this.snackBar.open('Definición de área cancelada. Puedes hacer click y arrastrar en cualquier lugar para definir una nueva área.', 'OK', { duration: 3000 });
  }

  // Método de debug para verificar coordenadas
  // Método para determinar en qué página se encuentra una coordenada Y
  private determineCurrentPage(y: number): number {
    console.log('determineCurrentPage called with Y:', y);
    console.log('Page positions:', this.pagePositions);
    
    if (this.pagePositions.length === 0) {
      console.log('No page positions available, defaulting to page 1');
      return 1; // Default to page 1 if no page positions available
    }
    
    // Buscar en qué página está la coordenada Y
    for (let i = 0; i < this.pagePositions.length; i++) {
      const pagePosition = this.pagePositions[i];
      const pageTop = pagePosition.top;
      const pageBottom = pageTop + pagePosition.height;
      
      console.log(`Page ${i + 1}: Y range ${pageTop} to ${pageBottom}, checking if ${y} is in range`);
      
      if (y >= pageTop && y <= pageBottom) {
        console.log(`Found: Y ${y} is on page ${i + 1}`);
        return i + 1; // Return 1-based page number
      }
    }
    
    // Si no se encuentra en ninguna página, usar la página actual como fallback
    console.log(`Y ${y} not found in any page, using current page ${this.currentPage} as fallback`);
    return this.currentPage;
  }


  // Método para obtener el party actualmente seleccionado para definición
  getCurrentDefiningParty(): PartyReadDto | null {
    if (!this.currentDefiningPartyId) return null;
    return this.parties.find(p => p.id === this.currentDefiningPartyId) || null;
  }

  // Método para verificar si un party está siendo definido actualmente
  isPartyBeingDefined(partyId: number): boolean {
    return this.currentDefiningPartyId === partyId;
  }

  // Método para verificar el estado de navegación (debug)
  getNavigationState(): { currentPage: number; totalPages: number; canGoPrev: boolean; canGoNext: boolean } {
    const canGoPrev = this.currentPage > 1;
    const canGoNext = this.currentPage < this.totalPages;
    
    console.log('🔍 Navigation state:', {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      canGoPrev,
      canGoNext
    });
    
    return {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      canGoPrev,
      canGoNext
    };
  }

  // Método para deshabilitar la navegación automática
  private disableAutomaticNavigation(): void {
    console.log('🔍 Disabling automatic navigation...');
    
    // Deshabilitar eventos de teclado que pueden causar cambios de página
    const pdfViewer = document.querySelector('.pdf-viewer') as HTMLElement;
    if (pdfViewer) {
      // Prevenir eventos de teclado de navegación
      const preventNavigation = (event: KeyboardEvent) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || 
            event.key === 'PageUp' || event.key === 'PageDown' ||
            event.key === 'Home' || event.key === 'End' ||
            event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          console.log('🔍 Prevented keyboard navigation:', event.key);
        }
      };
      
      // Agregar event listener para teclado
      pdfViewer.addEventListener('keydown', preventNavigation, true);
      
      // Prevenir eventos de mouse wheel
      const preventWheel = (event: WheelEvent) => {
        event.preventDefault();
        event.stopPropagation();
        console.log('🔍 Prevented mouse wheel navigation');
      };
      
      pdfViewer.addEventListener('wheel', preventWheel, true);
      
      console.log('🔍 Automatic navigation disabled successfully');
    } else {
      console.log('🔍 PDF viewer not found, retrying in 500ms...');
      setTimeout(() => {
        this.disableAutomaticNavigation();
      }, 500);
    }
  }

  // Método para obtener el número total de páginas desde el DOM
  private getTotalPagesFromDOM(): void {
    console.log('🔍 Getting total pages from DOM...');
    
    // Estrategia 1: Buscar elementos de página directamente en el viewerContainer
    const viewerContainerPages = document.querySelectorAll('#viewerContainer .page');
    if (viewerContainerPages.length > 0) {
      this.totalPages = viewerContainerPages.length;
      console.log('🔍 Total pages found using #viewerContainer .page selector:', this.totalPages);
      this.forceNavigationUpdate();
      return;
    }
    
    // Estrategia 2: Buscar elementos de página en el PDF viewer
    const pdfViewerPages = document.querySelectorAll('.pdf-viewer .page');
    if (pdfViewerPages.length > 0) {
      this.totalPages = pdfViewerPages.length;
      console.log('🔍 Total pages found using .pdf-viewer .page selector:', this.totalPages);
      this.forceNavigationUpdate();
      return;
    }
    
    // Estrategia 3: Buscar elementos de página directamente
    const pages = document.querySelectorAll('.page');
    if (pages.length > 0) {
      this.totalPages = pages.length;
      console.log('🔍 Total pages found using .page selector:', this.totalPages);
      this.forceNavigationUpdate();
      return;
    }
    
    // Estrategia 4: Intentar obtener desde el PDF viewer usando la API interna
    try {
      const pdfViewer = document.querySelector('.pdf-viewer') as any;
      if (pdfViewer && pdfViewer._pdfViewer) {
        const numPages = pdfViewer._pdfViewer.pagesCount || pdfViewer._pdfViewer.numPages;
        if (numPages && numPages > 0) {
          this.totalPages = numPages;
          console.log('🔍 Total pages found using PDF viewer API:', this.totalPages);
          this.forceNavigationUpdate();
          return;
        }
      }
    } catch (error) {
      console.log('🔍 Error accessing PDF viewer API:', error);
    }
    
    // Estrategia 5: Intentar obtener desde el viewerContainer usando la API
    try {
      const viewerContainer = document.querySelector('#viewerContainer') as any;
      if (viewerContainer && viewerContainer._pdfViewer) {
        const numPages = viewerContainer._pdfViewer.pagesCount || viewerContainer._pdfViewer.numPages;
        if (numPages && numPages > 0) {
          this.totalPages = numPages;
          console.log('🔍 Total pages found using viewerContainer API:', this.totalPages);
          this.forceNavigationUpdate();
          return;
        }
      }
    } catch (error) {
      console.log('🔍 Error accessing viewerContainer API:', error);
    }
    
    console.log('🔍 No pages found in DOM, keeping totalPages as:', this.totalPages);
  }

  // Método para verificar y actualizar el número total de páginas
  private checkAndUpdateTotalPages(): void {
    console.log('🔍 Checking and updating total pages...');
    
    // Intentar obtener el número de páginas desde el DOM
    this.getTotalPagesFromDOM();
    
    // Si aún no se ha encontrado, intentar con un delay adicional
    if (this.totalPages <= 1) {
      setTimeout(() => {
        console.log('🔍 Retrying to get total pages...');
        this.getTotalPagesFromDOM();
        
        // Si aún no se encuentra, intentar una última vez
        if (this.totalPages <= 1) {
          setTimeout(() => {
            console.log('🔍 Final attempt to get total pages...');
            this.getTotalPagesFromDOM();
          }, 2000);
        }
      }, 1000);
    }
  }

  // Método para forzar la actualización del estado de navegación
  private forceNavigationUpdate(): void {
    console.log('🔍 Force updating navigation state...');
    console.log('🔍 Current state - currentPage:', this.currentPage, 'totalPages:', this.totalPages);
    
    // Forzar la detección de cambios
    setTimeout(() => {
      this.getNavigationState();
    }, 100);
  }

  // Método para verificar el estado de los botones de navegación
  getButtonStates(): { prevDisabled: boolean; nextDisabled: boolean; reason: string } {
    const prevDisabled = this.currentPage <= 1 || this.totalPages <= 1;
    const nextDisabled = this.currentPage >= this.totalPages || this.totalPages <= 1;
    
    let reason = '';
    if (this.totalPages <= 1) {
      reason = 'Solo hay 1 página';
    } else if (this.currentPage <= 1) {
      reason = 'Estás en la primera página';
    } else if (this.currentPage >= this.totalPages) {
      reason = 'Estás en la última página';
    } else {
      reason = 'Navegación disponible';
    }
    
    console.log('🔍 Button states:', { prevDisabled, nextDisabled, reason, currentPage: this.currentPage, totalPages: this.totalPages });
    
    return { prevDisabled, nextDisabled, reason };
  }

  // Método para obtener el número total de páginas desde el estado interno del PDF viewer
  private getTotalPagesFromPDFViewer(): void {
    console.log('🔍 Getting total pages from PDF viewer internal state...');
    
    // Estrategia 1: Intentar acceder al PDF viewer a través de ngx-extended-pdf-viewer
    try {
      const pdfViewerElement = document.querySelector('ngx-extended-pdf-viewer') as any;
      if (pdfViewerElement && pdfViewerElement._pdfViewer) {
        const pdfViewer = pdfViewerElement._pdfViewer;
        if (pdfViewer.pagesCount) {
          this.totalPages = pdfViewer.pagesCount;
          console.log('🔍 Total pages found using ngx-extended-pdf-viewer:', this.totalPages);
          this.forceNavigationUpdate();
          return;
        }
      }
    } catch (error) {
      console.log('🔍 Error accessing ngx-extended-pdf-viewer:', error);
    }
    
    // Estrategia 2: Intentar acceder al PDF viewer a través del elemento con clase pdf-viewer
    try {
      const pdfViewerElement = document.querySelector('.pdf-viewer') as any;
      if (pdfViewerElement) {
        // Buscar en las propiedades del elemento
        const properties = Object.getOwnPropertyNames(pdfViewerElement);
        console.log('🔍 PDF viewer properties:', properties);
        
        // Intentar acceder a diferentes propiedades que podrían contener el número de páginas
        for (const prop of properties) {
          if (prop.toLowerCase().includes('page') || prop.toLowerCase().includes('count')) {
            const value = pdfViewerElement[prop];
            if (typeof value === 'number' && value > 0) {
              this.totalPages = value;
              console.log(`🔍 Total pages found using property ${prop}:`, this.totalPages);
              this.forceNavigationUpdate();
              return;
            }
          }
        }
      }
    } catch (error) {
      console.log('🔍 Error accessing PDF viewer properties:', error);
    }
    
    // Estrategia 3: Intentar acceder al PDF viewer a través del window object
    try {
      if ((window as any).PDFViewerApplication) {
        const pdfViewer = (window as any).PDFViewerApplication;
        if (pdfViewer.pagesCount) {
          this.totalPages = pdfViewer.pagesCount;
          console.log('🔍 Total pages found using window.PDFViewerApplication:', this.totalPages);
          this.forceNavigationUpdate();
          return;
        }
      }
    } catch (error) {
      console.log('🔍 Error accessing window.PDFViewerApplication:', error);
    }
    
    console.log('🔍 No pages found using PDF viewer internal state');
  }

  // Método para obtener el número total de páginas cargando el PDF directamente
  private getTotalPagesFromPDFDocument(): void {
    console.log('🔍 Getting total pages from PDF document...');
    
    try {
      // Estrategia 1: Intentar acceder al PDF document a través del PDF.js viewer
      const pdfViewerElement = document.querySelector('ngx-extended-pdf-viewer') as any;
      if (pdfViewerElement && pdfViewerElement._pdfViewer) {
        const pdfViewer = pdfViewerElement._pdfViewer;
        if (pdfViewer.pdfDocument) {
          const numPages = pdfViewer.pdfDocument.numPages;
          if (numPages && numPages > 0) {
            this.totalPages = numPages;
            console.log('🔍 Total pages found using PDF document:', this.totalPages);
            this.forceNavigationUpdate();
            return;
          }
        }
      }
      
      // Estrategia 2: Intentar acceder al PDF document a través del viewerContainer
      const viewerContainer = document.querySelector('#viewerContainer') as any;
      if (viewerContainer && viewerContainer._pdfViewer) {
        const pdfViewer = viewerContainer._pdfViewer;
        if (pdfViewer.pdfDocument) {
          const numPages = pdfViewer.pdfDocument.numPages;
          if (numPages && numPages > 0) {
            this.totalPages = numPages;
            console.log('🔍 Total pages found using viewerContainer PDF document:', this.totalPages);
            this.forceNavigationUpdate();
            return;
          }
        }
      }
      
      // Estrategia 3: Intentar acceder al PDF document a través del window object
      if ((window as any).PDFViewerApplication && (window as any).PDFViewerApplication.pdfDocument) {
        const numPages = (window as any).PDFViewerApplication.pdfDocument.numPages;
        if (numPages && numPages > 0) {
          this.totalPages = numPages;
          console.log('🔍 Total pages found using window PDF document:', this.totalPages);
          this.forceNavigationUpdate();
          return;
        }
      }
      
      // Estrategia 4: Intentar acceder al PDF document a través del PDF.js viewer usando diferentes propiedades
      const allElements = document.querySelectorAll('*');
      for (const element of allElements) {
        try {
          const anyElement = element as any;
          if (anyElement._pdfViewer && anyElement._pdfViewer.pdfDocument) {
            const numPages = anyElement._pdfViewer.pdfDocument.numPages;
            if (numPages && numPages > 0) {
              this.totalPages = numPages;
              console.log('🔍 Total pages found using element PDF document:', this.totalPages);
              this.forceNavigationUpdate();
              return;
            }
          }
        } catch (error) {
          // Ignorar errores al acceder a propiedades
        }
      }
      
    } catch (error) {
      console.log('🔍 Error accessing PDF document:', error);
    }
    
    console.log('🔍 No pages found using PDF document');
  }

  // Método para forzar la detección del número total de páginas
  private forceDetectTotalPages(): void {
    console.log('🔍 ===== FORCE DETECTING TOTAL PAGES =====');
    
    // Estrategia 1: Intentar acceder al PDF viewer a través de ngx-extended-pdf-viewer
    try {
      const pdfViewerElement = document.querySelector('ngx-extended-pdf-viewer') as any;
      console.log('🔍 PDF viewer element found:', !!pdfViewerElement);
      
      if (pdfViewerElement) {
        // Buscar en todas las propiedades del elemento
        const properties = Object.getOwnPropertyNames(pdfViewerElement);
        console.log('🔍 PDF viewer properties:', properties);
        
        // Buscar propiedades que contengan información de páginas
        for (const prop of properties) {
          try {
            const value = pdfViewerElement[prop];
            console.log(`🔍 Property ${prop}:`, value);
            
            if (typeof value === 'number' && value > 0 && (prop.toLowerCase().includes('page') || prop.toLowerCase().includes('count'))) {
              this.totalPages = value;
              console.log(`🔍 Found total pages in property ${prop}:`, this.totalPages);
              this.forceNavigationUpdate();
              return;
            }
            
            // Si es un objeto, buscar en sus propiedades
            if (typeof value === 'object' && value !== null) {
              const subProperties = Object.getOwnPropertyNames(value);
              for (const subProp of subProperties) {
                if (subProp.toLowerCase().includes('page') || subProp.toLowerCase().includes('count')) {
                  const subValue = value[subProp];
                  if (typeof subValue === 'number' && subValue > 0) {
                    this.totalPages = subValue;
                    console.log(`🔍 Found total pages in ${prop}.${subProp}:`, this.totalPages);
                    this.forceNavigationUpdate();
                    return;
                  }
                }
              }
            }
          } catch (error) {
            // Ignorar errores al acceder a propiedades
          }
        }
      }
    } catch (error) {
      console.log('🔍 Error in force detect strategy 1:', error);
    }
    
    // Estrategia 2: Intentar acceder al PDF viewer a través del DOM
    try {
      const allElements = document.querySelectorAll('*');
      console.log('🔍 Searching through', allElements.length, 'elements');
      
      for (const element of allElements) {
        try {
          const anyElement = element as any;
          if (anyElement._pdfViewer) {
            console.log('🔍 Found element with _pdfViewer:', element);
            
            const pdfViewer = anyElement._pdfViewer;
            const pdfViewerProperties = Object.getOwnPropertyNames(pdfViewer);
            console.log('🔍 PDF viewer properties:', pdfViewerProperties);
            
            for (const prop of pdfViewerProperties) {
              const value = pdfViewer[prop];
              if (typeof value === 'number' && value > 0 && (prop.toLowerCase().includes('page') || prop.toLowerCase().includes('count'))) {
                this.totalPages = value;
                console.log(`🔍 Found total pages in _pdfViewer.${prop}:`, this.totalPages);
                this.forceNavigationUpdate();
                return;
              }
            }
          }
        } catch (error) {
          // Ignorar errores al acceder a propiedades
        }
      }
    } catch (error) {
      console.log('🔍 Error in force detect strategy 2:', error);
    }
    
    // Estrategia 3: Intentar acceder al PDF viewer a través del window object
    try {
      if ((window as any).PDFViewerApplication) {
        const pdfViewer = (window as any).PDFViewerApplication;
        console.log('🔍 PDFViewerApplication found:', pdfViewer);
        
        const properties = Object.getOwnPropertyNames(pdfViewer);
        console.log('🔍 PDFViewerApplication properties:', properties);
        
        for (const prop of properties) {
          const value = pdfViewer[prop];
          if (typeof value === 'number' && value > 0 && (prop.toLowerCase().includes('page') || prop.toLowerCase().includes('count'))) {
            this.totalPages = value;
            console.log(`🔍 Found total pages in PDFViewerApplication.${prop}:`, this.totalPages);
            this.forceNavigationUpdate();
            return;
          }
        }
      }
    } catch (error) {
      console.log('🔍 Error in force detect strategy 3:', error);
    }
    
    console.log('🔍 Force detect completed, totalPages:', this.totalPages);
  }

  // Configurar visor para usar scroll y dimensiones consistentes con el contenedor
  private configureViewerForScroll(): void {
    console.log('🔍 Configuring viewer for scroll...');
    try {
      const pdfViewerElement = document.querySelector('ngx-extended-pdf-viewer') as any;
      if (pdfViewerElement && pdfViewerElement._pdfViewer) {
        const pdfViewer = pdfViewerElement._pdfViewer;
        if (pdfViewer.viewer) {
          // Mantener escala por página y permitir scroll normal
          pdfViewer.viewer.currentScaleValue = 'page-fit';
          console.log('🔍 currentScaleValue set to page-fit');
        }
        if (pdfViewer.setViewerOption) {
          pdfViewer.setViewerOption('showAllPages', true);
          console.log('🔍 showAllPages set to true');
        }
      }
      const viewerContainer = document.querySelector('#viewerContainer') as HTMLElement | null;
      if (viewerContainer) {
        viewerContainer.style.height = '100%';
        viewerContainer.style.overflow = 'auto';
        console.log('🔍 viewerContainer height=100%, overflow=auto');
      }
    } catch (error) {
      console.log('🔍 Error configuring viewer:', error);
    }
  }

  // Método para manejar el evento pagesLoaded
  onPagesLoaded(event: any): void {
    console.log('🔍 ===== onPagesLoaded METHOD CALLED =====');
    console.log('🔍 Pages loaded event:', event);
    console.log('🔍 Event type:', typeof event);
    console.log('🔍 Event keys:', event ? Object.keys(event) : 'No event object');
    
    // Obtener el número total de páginas del evento
    let pagesCount = 0;
    
    if (event && event.pagesCount) {
      pagesCount = event.pagesCount;
      console.log('🔍 Total pages from event.pagesCount:', pagesCount);
    } else if (event && event.numPages) {
      pagesCount = event.numPages;
      console.log('🔍 Total pages from event.numPages:', pagesCount);
    } else if (event && typeof event === 'number') {
      pagesCount = event;
      console.log('🔍 Total pages from event (number):', pagesCount);
    } else if (event && typeof event === 'object') {
      // Buscar propiedades que contengan información de páginas
      const eventKeys = Object.keys(event);
      console.log('🔍 Event keys:', eventKeys);
      
      for (const key of eventKeys) {
        const value = event[key];
        if (typeof value === 'number' && value > 0 && (key.toLowerCase().includes('page') || key.toLowerCase().includes('count'))) {
          pagesCount = value;
          console.log(`🔍 Found total pages in event.${key}:`, pagesCount);
          break;
        }
      }
    }
    
    // Si no se encontró en el evento, intentar obtener desde el DOM
    if (pagesCount <= 0) {
      console.log('🔍 No pages count in event, trying DOM detection');
      const pages = document.querySelectorAll('#viewerContainer .page, .pdf-viewer .page, .page');
      if (pages.length > 0) {
        pagesCount = pages.length;
        console.log('🔍 Total pages from DOM detection:', pagesCount);
      }
    }
    
    // Si aún no se encontró, intentar obtener desde el PDF viewer
    if (pagesCount <= 0) {
      console.log('🔍 Trying PDF viewer API');
      try {
        const pdfViewerElement = document.querySelector('ngx-extended-pdf-viewer') as any;
        if (pdfViewerElement && pdfViewerElement._pdfViewer) {
          const pdfViewer = pdfViewerElement._pdfViewer;
          if (pdfViewer.pagesCount) {
            pagesCount = pdfViewer.pagesCount;
            console.log('🔍 Total pages from PDF viewer API:', pagesCount);
          }
        }
      } catch (error) {
        console.log('🔍 Error accessing PDF viewer API:', error);
      }
    }
    
    // Actualizar totalPages solo si se encontró un valor válido
    if (pagesCount > 0) {
      this.totalPages = pagesCount;
      console.log('🔍 Updated totalPages to:', this.totalPages);
    } else {
      console.log('🔍 No valid page count found, keeping current totalPages:', this.totalPages);
    }
    
    // Asegurar que totalPages sea al menos 1
    if (this.totalPages < 1) {
      this.totalPages = 1;
    }
    
    console.log('🔍 Final total pages after pagesLoaded:', this.totalPages);
    console.log('🔍 Navigation state after pagesLoaded:', this.getNavigationState());
    console.log('🔍 Button states after pagesLoaded:', this.getButtonStates());
    
    // Actualizar la navegación inmediatamente
    this.forceNavigationUpdate();
    
    // Actualizar las posiciones de las páginas
    setTimeout(() => {
      this.updatePagePositions();
      this.renderCanvas();
    }, 500);
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
    
    console.log('✅ [SIGNATURE-PAGE] Anotación de error dibujada en el canvas');
  }

  goToFirstPage(): void {
    if (this.currentPage !== 1) {
      this.currentPage = 1;
      this.lastVisitedPage = 1;
      this.renderCanvas();
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.lastVisitedPage = this.currentPage;
      this.renderCanvas();
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.lastVisitedPage = this.currentPage;
      this.renderCanvas();
    }
  }

  goToLastPage(): void {
    if (this.currentPage !== this.totalPages) {
      this.currentPage = this.totalPages;
      this.lastVisitedPage = this.currentPage;
      this.renderCanvas();
    }
  }
} 