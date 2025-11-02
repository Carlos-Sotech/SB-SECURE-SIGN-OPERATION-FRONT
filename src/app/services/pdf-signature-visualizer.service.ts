import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PdfSignatureExtractorService, ExtractedSignature } from './pdf-signature-extractor.service';

export interface SignatureAreaDto {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SignatureVisualizationRequest {
  operationId: number;
  originalPdfPath: string;
  signatureAreas: SignatureAreaDto[];
}

@Injectable({
  providedIn: 'root'
})
export class PdfSignatureVisualizerService {
  private apiUrl = `${environment.apiUrl}/pdf-signature-visualizer`;

  constructor(
    private http: HttpClient,
    private pdfSignatureExtractor: PdfSignatureExtractorService
  ) {}

  generatePdfWithVisibleSignatures(request: SignatureVisualizationRequest): Observable<any> {
    console.log('🔧 [PDF-SERVICE] API URL:', this.apiUrl);
    return this.http.post(`${this.apiUrl}/generate`, request);
  }

  checkVisibleSignaturesPdfExists(operationId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/check/${operationId}`);
  }

  getVisibleSignaturesPdfUrl(operationId: number): string {
    return `${this.apiUrl}/download/${operationId}`;
  }

  generatePdfWithVisibleSignaturesFromFile(pdfFile: File): Observable<Blob> {
    console.log('🔧 [PDF-SERVICE] API URL:', this.apiUrl);
    const formData = new FormData();
    formData.append('pdfFile', pdfFile);
    
    return this.http.post(`${this.apiUrl}/generate-from-file`, formData, {
      responseType: 'blob'
    });
  }

  // Nuevo método que usa PDF.js en el frontend
  async generatePdfWithVisibleSignaturesFromFileFrontend(pdfFile: File): Promise<Blob> {
    try {
      console.log('🔧 [PDF-SERVICE] Procesando PDF en frontend con PDF.js...');
      
      // Extraer firmas del PDF
      const signatures = await this.pdfSignatureExtractor.extractSignaturesFromPdf(pdfFile);
      
      console.log('🔧 [PDF-SERVICE] Firmas extraídas:', signatures.length);
      
      if (signatures.length === 0) {
        console.log('🔧 [PDF-SERVICE] No se encontraron firmas, devolviendo PDF original');
        return pdfFile;
      }
      
      // Generar PDF con firmas visibles
      const processedPdf = await this.pdfSignatureExtractor.generatePdfWithVisibleSignatures(pdfFile, signatures);
      
      console.log('🔧 [PDF-SERVICE] PDF procesado exitosamente');
      return processedPdf;
      
    } catch (error) {
      console.error('❌ [PDF-SERVICE] Error procesando PDF en frontend:', error);
      
      // Si hay error, devolver el PDF original
      console.log('🔧 [PDF-SERVICE] Devolviendo PDF original debido al error');
      return pdfFile;
    }
  }

  // Método para extraer solo las firmas sin procesar el PDF
  async extractSignaturesFromFile(pdfFile: File): Promise<ExtractedSignature[]> {
    try {
      console.log('🔧 [PDF-SERVICE] Extrayendo firmas del PDF...');
      return await this.pdfSignatureExtractor.extractSignaturesFromPdf(pdfFile);
    } catch (error) {
      console.error('❌ [PDF-SERVICE] Error extrayendo firmas:', error);
      throw error;
    }
  }
}
