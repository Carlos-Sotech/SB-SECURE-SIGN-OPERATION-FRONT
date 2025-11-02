import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FileUrlService {
  
  /**
   * Construye la URL completa para acceder a un archivo del directorio media
   * @param fileName Nombre del archivo (puede incluir subdirectorios como operations/123/archivo.pdf)
   * @param operationId ID de la operación (opcional, para construir ruta completa)
   * @returns URL completa para acceder al archivo
   */
  getMediaFileUrl(fileName: string, operationId?: number): string {
    if (!fileName) {
      return '';
    }

    // Si ya es una URL completa, devolverla tal como está
    if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
      return fileName;
    }

    // Construir la URL base del backend
    const baseUrl = environment.apiUrl.replace('/api', '');
    
    // Si el fileName ya incluye 'media/', usar solo el fileName
    if (fileName.startsWith('media/')) {
      return `${baseUrl}/${fileName}`;
    }
    
    // Si se proporciona operationId y el fileName parece ser solo el nombre del archivo,
    // construir la ruta completa
    if (operationId && !fileName.includes('/')) {
      return `${baseUrl}/media/operations/${operationId}/${fileName}`;
    }
    
    // Si no incluye 'media/', agregarlo
    return `${baseUrl}/media/${fileName}`;
  }

  /**
   * Construye la URL para un archivo PDF de operación
   * @param operationId ID de la operación
   * @param fileName Nombre del archivo (opcional, por defecto buscará el PDF de la operación)
   * @returns URL completa para acceder al archivo PDF
   */
  getOperationPdfUrl(operationId: number, fileName?: string): string {
    const baseUrl = environment.apiUrl.replace('/api', '');
    
    if (fileName) {
      return `${baseUrl}/media/operations/${operationId}/${fileName}`;
    }
    
    // Si no se especifica fileName, intentar usar el endpoint del backend
    return `${environment.apiUrl}/operations/${operationId}/pdf`;
  }

  /**
   * Extrae el nombre del archivo de una URL completa
   * @param url URL completa del archivo
   * @returns Nombre del archivo extraído
   */
  extractFileName(url: string): string {
    if (!url) {
      return '';
    }

    // Si es una URL completa, extraer el nombre del archivo
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1];
    }

    // Si ya es un nombre de archivo, devolverlo tal como está
    return url;
  }

  /**
   * Verifica si una URL es accesible
   * @param url URL a verificar
   * @returns Promise que resuelve a true si la URL es accesible
   */
  async isUrlAccessible(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.warn('URL not accessible:', url, error);
      return false;
    }
  }
}

