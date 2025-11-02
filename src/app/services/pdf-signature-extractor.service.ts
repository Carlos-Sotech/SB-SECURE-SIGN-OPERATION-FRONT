import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb } from 'pdf-lib';

// Configurar el worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';

export interface ExtractedSignature {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fieldName: string;
  hasImage: boolean;
  imageData?: string; // Base64 de la imagen de la firma
}

@Injectable({
  providedIn: 'root'
})
export class PdfSignatureExtractorService {

  constructor() { }

  async extractSignaturesFromPdf(pdfFile: File): Promise<ExtractedSignature[]> {
    try {
      console.log('🔍 [PDF-EXTRACTOR] Iniciando extracción de firmas...');
      
      // Usar FileReader como en el HTML que funciona
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(pdfFile);
      });
      
      // Usar la misma configuración que el HTML que funciona
      const typedarray = new Uint8Array(arrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
      
      console.log('🔍 [PDF-EXTRACTOR] PDF cargado, páginas:', pdf.numPages);
      
      const signatures: ExtractedSignature[] = [];
      
      // Buscar firmas en todas las páginas usando la lógica del HTML que funciona
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const annotations = await page.getAnnotations();
          const viewport = page.getViewport({ scale: 2 });
          
          console.log(`🔍 [PDF-EXTRACTOR] Página ${pageNum}, anotaciones:`, annotations.length);
          
          // Crear canvas para renderizar la página
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) continue;
          
          // Renderizar la página
          await page.render({ canvasContext: ctx, viewport }).promise;
          
          // Buscar campos de firma digital
          const firmasEnPagina = annotations.filter(a => a.fieldType === 'Sig');
          
          for (const firma of firmasEnPagina) {
            try {
              const [x1, y1, x2, y2] = firma.rect;
              const width = (x2 - x1) * viewport.scale;
              const height = (y2 - y1) * viewport.scale;
              
              if (width <= 0 || height <= 0) continue;
              
              const scaledX = x1 * viewport.scale;
              const scaledY = viewport.height - y2 * viewport.scale;
              
              // Extraer la imagen de la firma del canvas
              const imgData = ctx.getImageData(scaledX, scaledY, width, height);
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = width;
              tempCanvas.height = height;
              tempCanvas.getContext('2d')?.putImageData(imgData, 0, 0);
              const imgUrl = tempCanvas.toDataURL('image/png');
              
              if (!imgUrl.startsWith('data:image/png')) continue;
              
              const signature: ExtractedSignature = {
                pageIndex: pageNum,
                x: x1,   // pdf-lib y PDF.js ambos usan (0,0) abajo-izquierda
                y: y1,
                width: x2 - x1,
                height: y2 - y1,
                fieldName: firma.fieldName || `Firma_${pageNum}_${signatures.length}`,
                hasImage: true,
                imageData: imgUrl
              };
              
              signatures.push(signature);
              console.log('🔍 [PDF-EXTRACTOR] Firma extraída:', signature.fieldName);
              
            } catch (errFirma) {
              console.warn('⚠️ [PDF-EXTRACTOR] Firma visual no extraída correctamente:', errFirma);
            }
          }
          
        } catch (pageError) {
          console.warn(`⚠️ [PDF-EXTRACTOR] Error procesando página ${pageNum}:`, pageError);
          // Continuar con la siguiente página
        }
      }
      
      console.log('🔍 [PDF-EXTRACTOR] Firmas extraídas:', signatures.length);
      return signatures;
      
    } catch (error) {
      console.error('❌ [PDF-EXTRACTOR] Error extrayendo firmas:', error);
      
      // Si es un error de PDF.js, proporcionar un mensaje más específico
      if (error instanceof Error) {
        if (error.message.includes('Invalid PDF')) {
          throw new Error('PDF no válido o corrupto');
        } else if (error.message.includes('password')) {
          throw new Error('PDF protegido con contraseña');
        }
      }
      
      throw error;
    }
  }

  private async extractSignatureImage(page: any, annotation: any): Promise<string | undefined> {
    try {
      // Obtener el contenido de la página
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return undefined;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Renderizar la página
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Extraer la región de la firma
      const rect = annotation.rect;
      const scale = viewport.scale;
      
      const signatureCanvas = document.createElement('canvas');
      const signatureContext = signatureCanvas.getContext('2d');
      
      if (!signatureContext) return undefined;
      
      const signatureWidth = (rect[2] - rect[0]) * scale;
      const signatureHeight = (rect[3] - rect[1]) * scale;
      
      signatureCanvas.width = signatureWidth;
      signatureCanvas.height = signatureHeight;
      
      // Copiar la región de la firma
      signatureContext.drawImage(
        canvas,
        rect[0] * scale, rect[1] * scale, signatureWidth, signatureHeight,
        0, 0, signatureWidth, signatureHeight
      );
      
      // Convertir a base64
      return signatureCanvas.toDataURL('image/png');
      
    } catch (error) {
      console.warn('⚠️ [PDF-EXTRACTOR] Error extrayendo imagen de firma:', error);
      return undefined;
    }
  }

  async generatePdfWithVisibleSignatures(pdfFile: File, signatures: ExtractedSignature[]): Promise<Blob> {
    try {
      console.log('🔍 [PDF-EXTRACTOR] Generando PDF con firmas visibles usando pdf-lib...');
      
      const arrayBuffer = await pdfFile.arrayBuffer();
      
      // Cargar el PDF con pdf-lib
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // Obtener las páginas
      const pages = pdfDoc.getPages();
      
      // Procesar cada firma usando la lógica del HTML que funciona
      for (const signature of signatures) {
        const pageIndex = signature.pageIndex - 1; // pdf-lib usa índice 0
        
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          
          // Dibujar la firma en la página
          if (signature.imageData) {
            try {
              // Extraer solo los datos base64 (sin el prefijo data:image/png;base64,)
              const base64Data = signature.imageData.split(',')[1];
              const pngImage = await pdfDoc.embedPng(base64Data);
              
              // POSICIÓN EXACTA: pdf-lib y PDF.js ambos usan (0,0) abajo-izquierda
              page.drawImage(pngImage, {
                x: signature.x,
                y: signature.y,
                width: signature.width,
                height: signature.height,
              });
              
              console.log('🔍 [PDF-EXTRACTOR] Firma insertada en página:', signature.pageIndex);
              
            } catch (imageError) {
              console.warn('⚠️ [PDF-EXTRACTOR] Error insertando firma en PDF-lib:', imageError);
            }
          }
        }
      }
      
      // Generar el PDF final
      const pdfBytes = await pdfDoc.save();
      return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      
    } catch (error) {
      console.error('❌ [PDF-EXTRACTOR] Error generando PDF con firmas:', error);
      throw error;
    }
  }

  private async drawSignatureOnCanvas(context: CanvasRenderingContext2D, signature: ExtractedSignature, scale: number): Promise<void> {
    try {
      const x = signature.x * scale;
      const y = signature.y * scale;
      const width = signature.width * scale;
      const height = signature.height * scale;
      
      if (signature.imageData) {
        // Dibujar la imagen de la firma
        const img = new Image();
        img.onload = () => {
          context.drawImage(img, x, y, width, height);
        };
        img.src = signature.imageData;
      } else {
        // Dibujar un rectángulo con texto como fallback
        context.strokeStyle = '#FF0000';
        context.lineWidth = 2;
        context.strokeRect(x, y, width, height);
        
        context.fillStyle = '#FF0000';
        context.font = '12px Arial';
        context.fillText('FIRMA', x + 5, y + height / 2);
      }
    } catch (error) {
      console.warn('⚠️ [PDF-EXTRACTOR] Error dibujando firma:', error);
    }
  }

}
