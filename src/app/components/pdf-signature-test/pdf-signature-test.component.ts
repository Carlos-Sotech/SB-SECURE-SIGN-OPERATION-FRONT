import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PdfSignatureVisualizerService } from '../../services/pdf-signature-visualizer.service';
import { ExtractedSignature } from '../../services/pdf-signature-extractor.service';

@Component({
  selector: 'app-pdf-signature-test',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatProgressSpinnerModule, MatSnackBarModule],
  template: `
    <div class="container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Prueba de Extracción de Firmas PDF</mat-card-title>
          <mat-card-subtitle>Sube un PDF con firmas para probar la extracción</mat-card-subtitle>
        </mat-card-header>
        
        <mat-card-content>
          <div class="upload-section">
            <input 
              type="file" 
              #fileInput 
              (change)="onFileSelected($event)" 
              accept=".pdf"
              style="display: none;">
            
            <button 
              mat-raised-button 
              color="primary" 
              (click)="fileInput.click()"
              [disabled]="isProcessing">
              Seleccionar PDF
            </button>
            
            <div *ngIf="selectedFile" class="file-info">
              <p><strong>Archivo seleccionado:</strong> {{ selectedFile.name }}</p>
              <p><strong>Tamaño:</strong> {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</p>
            </div>
          </div>

          <div *ngIf="isProcessing" class="processing">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Procesando PDF...</p>
          </div>

          <div *ngIf="extractedSignatures.length > 0" class="results">
            <h3>Firmas Encontradas: {{ extractedSignatures.length }}</h3>
            
            <div *ngFor="let signature of extractedSignatures; let i = index" class="signature-item">
              <mat-card>
                <mat-card-content>
                  <h4>Firma {{ i + 1 }}</h4>
                  <p><strong>Página:</strong> {{ signature.pageIndex }}</p>
                  <p><strong>Posición:</strong> X: {{ signature.x.toFixed(2) }}, Y: {{ signature.y.toFixed(2) }}</p>
                  <p><strong>Tamaño:</strong> {{ signature.width.toFixed(2) }} x {{ signature.height.toFixed(2) }}</p>
                  <p><strong>Nombre del campo:</strong> {{ signature.fieldName }}</p>
                  <p><strong>Tiene imagen:</strong> {{ signature.hasImage ? 'Sí' : 'No' }}</p>
                  
                  <div *ngIf="signature.imageData" class="signature-image">
                    <h5>Imagen de la firma:</h5>
                    <img [src]="signature.imageData" alt="Firma extraída" style="max-width: 200px; border: 1px solid #ccc;">
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </div>

          <div *ngIf="processedPdfUrl" class="download-section">
            <h3>PDF Procesado</h3>
            <button mat-raised-button color="accent" (click)="downloadProcessedPdf()">
              Descargar PDF con Firmas Visibles
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .upload-section {
      margin-bottom: 20px;
      text-align: center;
    }
    
    .file-info {
      margin-top: 10px;
      padding: 10px;
      background-color: #f5f5f5;
      border-radius: 4px;
    }
    
    .processing {
      text-align: center;
      margin: 20px 0;
    }
    
    .results {
      margin-top: 20px;
    }
    
    .signature-item {
      margin-bottom: 15px;
    }
    
    .signature-image {
      margin-top: 10px;
    }
    
    .download-section {
      margin-top: 20px;
      text-align: center;
    }
  `]
})
export class PdfSignatureTestComponent {
  selectedFile: File | null = null;
  isProcessing = false;
  extractedSignatures: ExtractedSignature[] = [];
  processedPdfUrl: string | null = null;

  constructor(
    private pdfSignatureService: PdfSignatureVisualizerService,
    private snackBar: MatSnackBar
  ) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      this.extractedSignatures = [];
      this.processedPdfUrl = null;
    } else {
      this.snackBar.open('Por favor selecciona un archivo PDF válido', 'Cerrar', {
        duration: 3000
      });
    }
  }

  async extractSignatures(): Promise<void> {
    if (!this.selectedFile) return;

    this.isProcessing = true;
    try {
      console.log('🔍 [TEST-COMPONENT] Extrayendo firmas...');
      this.extractedSignatures = await this.pdfSignatureService.extractSignaturesFromFile(this.selectedFile);
      
      this.snackBar.open(`Se encontraron ${this.extractedSignatures.length} firmas`, 'Cerrar', {
        duration: 3000
      });
      
    } catch (error) {
      console.error('❌ [TEST-COMPONENT] Error extrayendo firmas:', error);
      this.snackBar.open('Error extrayendo firmas del PDF', 'Cerrar', {
        duration: 3000
      });
    } finally {
      this.isProcessing = false;
    }
  }

  async processPdf(): Promise<void> {
    if (!this.selectedFile) return;

    this.isProcessing = true;
    try {
      console.log('🔍 [TEST-COMPONENT] Procesando PDF...');
      const processedBlob = await this.pdfSignatureService.generatePdfWithVisibleSignaturesFromFileFrontend(this.selectedFile);
      
      // Crear URL para descarga
      this.processedPdfUrl = URL.createObjectURL(processedBlob);
      
      this.snackBar.open('PDF procesado exitosamente', 'Cerrar', {
        duration: 3000
      });
      
    } catch (error) {
      console.error('❌ [TEST-COMPONENT] Error procesando PDF:', error);
      this.snackBar.open('Error procesando el PDF', 'Cerrar', {
        duration: 3000
      });
    } finally {
      this.isProcessing = false;
    }
  }

  downloadProcessedPdf(): void {
    if (this.processedPdfUrl) {
      const link = document.createElement('a');
      link.href = this.processedPdfUrl;
      link.download = 'pdf_con_firmas_visibles.pdf';
      link.click();
    }
  }
}


