import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { MatIconModule } from '@angular/material/icon';
import { PdfSignatureVisualizerService } from '../services/pdf-signature-visualizer.service';

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
  selector: 'app-pdf-signature-areas',
  templateUrl: './pdf-signature-areas.component.html',
  styleUrls: ['./pdf-signature-areas.component.css'],
  standalone: true,
  imports: [NgxExtendedPdfViewerModule, MatIconModule]
})
export class PdfSignatureAreasComponent implements AfterViewInit, OnChanges, OnInit {
  @Input() pdfUrl!: string;
  @Input() originalFile: File | null = null;
  @Input() areas: SignatureArea[] = [];
  @Input() activePartyId: number | null = null;
  @Output() areaCreated = new EventEmitter<SignatureArea>();

  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  isDrawing = false;
  startX = 0;
  startY = 0;
  currentRect: any = null;
  private ctx: CanvasRenderingContext2D | null = null;
  isAssigningArea = false;
  processedPdfUrl: string | null = null;
  showProcessingError = false;

  constructor(private pdfSignatureService: PdfSignatureVisualizerService) {
    console.log('🔍 PdfSignatureAreasComponent constructor called');
    console.log('🔍 areaCreated EventEmitter:', this.areaCreated);
  }

  ngOnInit() {
    console.log('🔍 PdfSignatureAreasComponent ngOnInit called');
    console.log('🔍 pdfUrl:', this.pdfUrl);
    console.log('🔍 originalFile:', this.originalFile);
    
    if (this.originalFile) {
      this.processPdfForDisplay();
    } else {
      // Si no hay archivo original, usar la URL directamente
      this.processedPdfUrl = this.pdfUrl;
    }
  }

  ngAfterViewInit() {
    this.setupCanvas();
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('🔍 ngOnChanges called with changes:', changes);
    
    if (changes['activePartyId']) {
      console.log('🔍 activePartyId changed from:', changes['activePartyId'].previousValue, 'to:', changes['activePartyId'].currentValue);
      this.isAssigningArea = this.activePartyId !== null;
      console.log('🔍 isAssigningArea set to:', this.isAssigningArea);
      
      // Scroll automático al PDF cuando se activa el modo de dibujo
      if (this.activePartyId !== null) {
        setTimeout(() => {
          const container = document.querySelector('.pdf-signature-areas-container');
          if (container) {
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
    if (changes['areas'] && this.canvasRef) {
      console.log('🔍 Areas changed, re-rendering canvas');
      setTimeout(() => this.renderCanvas(), 100);
    }
    if (changes['originalFile'] && this.originalFile) {
      console.log('🔍 originalFile changed, reprocessing PDF');
      this.processPdfForDisplay();
    }
  }

  private async processPdfForDisplay(): Promise<void> {
    if (!this.originalFile) {
      console.warn('⚠️ [PDF AREAS] No hay archivo original para procesar');
      this.processedPdfUrl = this.pdfUrl;
      return;
    }

    console.log('🔄 [PDF AREAS] Procesando PDF para mostrar firmas visibles...');
    console.log('🔄 [PDF AREAS] Archivo a procesar:', this.originalFile.name, 'tamaño:', this.originalFile.size);

    try {
      const processedBlob = await this.pdfSignatureService.generatePdfWithVisibleSignaturesFromFileFrontend(this.originalFile);
      this.processedPdfUrl = URL.createObjectURL(processedBlob);
      this.showProcessingError = false;
      console.log('✅ [PDF AREAS] PDF procesado exitosamente para mostrar firmas visibles');
    } catch (error) {
      console.error('❌ [PDF AREAS] Error procesando PDF:', error);
      // Fallback: mostrar el PDF original
      this.processedPdfUrl = this.pdfUrl;
      this.showProcessingError = true;
    }
  }

  setupCanvas() {
    if (!this.canvasRef) return;
    
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    
    if (!this.ctx) return;
    
    const container = canvas.parentElement;
    if (container) {
      // Asegurar que el contenedor esté visible ANTES de obtener dimensiones
      const containerElement = container as HTMLElement;
      containerElement.style.setProperty('display', 'block', 'important');
      containerElement.style.setProperty('visibility', 'visible', 'important');
      containerElement.style.setProperty('width', '100%', 'important');
      containerElement.style.setProperty('min-width', '280px', 'important');
      containerElement.style.setProperty('min-height', '200px', 'important');
      
      const resizeCanvas = () => {
        // Esperar al siguiente frame para que el DOM se actualice
        requestAnimationFrame(() => {
          const rect = containerElement.getBoundingClientRect();
          
          console.log('🔍 [PDF AREAS] Container dimensions:', rect.width, 'x', rect.height);
          
          // Si el contenedor tiene dimensiones 0x0, reintentar
          if (rect.width === 0 || rect.height === 0) {
            console.warn('🔍 [PDF AREAS] Container dimensions are 0x0, retrying...');
            setTimeout(() => {
              resizeCanvas();
            }, 100);
            return;
          }
          
          // Usar dimensiones mínimas si son muy pequeñas
          const width = Math.max(rect.width, 280);
          const height = Math.max(rect.height, 200);
          
          canvas.width = width;
          canvas.height = height;
          this.renderCanvas();
        });
      };
      
      resizeCanvas();
      
      // Escuchar cambios de tamaño
      const resizeObserver = new ResizeObserver(() => {
        resizeCanvas();
      });
      resizeObserver.observe(containerElement);
    }
  }

  onMouseDown(event: MouseEvent) {
    if (!this.activePartyId && !this.isAssigningArea) return;
    
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    
    this.isDrawing = true;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;
    this.currentRect = { x: this.startX, y: this.startY, width: 0, height: 0 };
    
    // Cambiar cursor
    this.canvasRef.nativeElement.style.cursor = 'crosshair';
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDrawing || !this.currentRect || (!this.activePartyId && !this.isAssigningArea) || !this.ctx) return;
    
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;
    
    this.currentRect.width = currentX - this.startX;
    this.currentRect.height = currentY - this.startY;
    
    this.renderCanvas();
  }

  onMouseUp(event: MouseEvent) {
    console.log('🔍 onMouseUp called');
    console.log('🔍 isDrawing:', this.isDrawing);
    console.log('🔍 currentRect:', this.currentRect);
    console.log('🔍 activePartyId:', this.activePartyId);
    console.log('🔍 isAssigningArea:', this.isAssigningArea);
    console.log('🔍 ctx:', this.ctx);
    
    if (!this.isDrawing || !this.currentRect || !this.ctx) {
      console.log('❌ onMouseUp: Basic conditions not met');
      return;
    }
    
    if (!this.activePartyId) {
      console.log('❌ onMouseUp: No activePartyId');
      return;
    }
    
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    
    const width = Math.abs(this.currentRect.width);
    const height = Math.abs(this.currentRect.height);
    
    console.log('🔍 onMouseUp - width:', width, 'height:', height);
    console.log('🔍 onMouseUp - activePartyId:', this.activePartyId);
    console.log('🔍 onMouseUp - isAssigningArea:', this.isAssigningArea);
    
    if (width > 20 && height > 20) {
      const area: SignatureArea = {
        id: `area_${Date.now()}`,
        x: Math.min(this.startX, this.startX + this.currentRect.width),
        y: Math.min(this.startY, this.startY + this.currentRect.height),
        width,
        height,
        page: 1,
        partyId: this.activePartyId,
        color: this.getRandomColor()
      };
      
      console.log('🔍 Created area:', area);
      console.log('🔍 About to emit areaCreated event');
      console.log('🔍 areaCreated EventEmitter:', this.areaCreated);
      this.areaCreated.emit(area);
      console.log('🔍 areaCreated event emitted');
    } else {
      console.log('❌ Area too small, not creating');
    }
    
    this.isDrawing = false;
    this.currentRect = null;
    this.canvasRef.nativeElement.style.cursor = 'default';
    this.renderCanvas();
  }

  private getRandomColor(): string {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  renderCanvas() {
    if (!this.ctx || !this.canvasRef) return;
    
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibuja áreas existentes
    this.areas.forEach(area => {
      this.drawArea(area, false);
    });

    // Dibuja el área actual si está dibujando
    if (this.currentRect && this.isDrawing) {
      this.ctx.strokeStyle = '#2196F3';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.strokeRect(this.currentRect.x, this.currentRect.y, this.currentRect.width, this.currentRect.height);
      this.ctx.setLineDash([]);
      
      // Mostrar dimensiones
      this.ctx.fillStyle = '#2196F3';
      this.ctx.font = '12px Arial';
      const width = Math.abs(this.currentRect.width);
      const height = Math.abs(this.currentRect.height);
      this.ctx.fillText(`${Math.round(width)} x ${Math.round(height)}`, 
        this.currentRect.x, this.currentRect.y - 5);
    }
  }

  private drawArea(area: SignatureArea, isSelected: boolean = false) {
    if (!this.ctx) return;
    
    this.ctx.strokeStyle = isSelected ? '#FF5722' : area.color;
    this.ctx.lineWidth = isSelected ? 3 : 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(area.x, area.y, area.width, area.height);
    this.ctx.setLineDash([]);
    
    // Fondo semi-transparente
    this.ctx.fillStyle = area.color + '20';
    this.ctx.fillRect(area.x, area.y, area.width, area.height);
    
    // Texto del área
    this.ctx.fillStyle = area.color;
    this.ctx.font = 'bold 12px Arial';
    const text = area.partyId ? `Firmante ${area.partyId}` : 'Área sin asignar';
    this.ctx.fillText(text, area.x, area.y - 5);
    
    // Dimensiones
    this.ctx.font = '10px Arial';
    this.ctx.fillText(`${Math.round(area.width)} x ${Math.round(area.height)}`, 
      area.x, area.y + area.height + 15);
  }
} 