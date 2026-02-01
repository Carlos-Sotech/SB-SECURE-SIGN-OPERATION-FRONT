import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { 
  SharePointConfigurationReadDto, 
  SharePointConfigurationCreateDto, 
  SharePointConfigurationUpdateDto 
} from '../models/sharepoint-configuration.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SharePointConfigurationService {
  private apiUrl = `${environment.apiUrl}/Companies`;

  constructor(private http: HttpClient) { }

  // GET - Obtener configuración de SharePoint de una empresa
  getSharePointConfiguration(companyId: number): Observable<SharePointConfigurationReadDto> {
    return this.http.get<SharePointConfigurationReadDto>(`${this.apiUrl}/${companyId}/sharepoint`)
      .pipe(
        tap(config => console.log('[SharePointService] Configuration retrieved:', config)),
        catchError(this.handleError)
      );
  }

  // POST - Crear nueva configuración de SharePoint para una empresa
  createSharePointConfiguration(companyId: number, config: SharePointConfigurationCreateDto): Observable<SharePointConfigurationReadDto> {
    return this.http.post<SharePointConfigurationReadDto>(`${this.apiUrl}/${companyId}/sharepoint`, config)
      .pipe(
        tap(result => console.log('[SharePointService] Configuration created:', result)),
        catchError(this.handleError)
      );
  }

  // PUT - Actualizar configuración de SharePoint de una empresa
  updateSharePointConfiguration(companyId: number, config: SharePointConfigurationUpdateDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${companyId}/sharepoint`, config)
      .pipe(
        tap(() => console.log('[SharePointService] Configuration updated')),
        catchError(this.handleError)
      );
  }

  // DELETE - Eliminar configuración de SharePoint de una empresa
  deleteSharePointConfiguration(companyId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${companyId}/sharepoint`)
      .pipe(
        tap(() => console.log('[SharePointService] Configuration deleted')),
        catchError(this.handleError)
      );
  }

  // Manejo de errores
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ha ocurrido un error desconocido';
    
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      if (error.status === 404) {
        // No existe configuración (esto es normal si no se ha configurado)
        errorMessage = 'No hay configuración de SharePoint para esta empresa';
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = `Error ${error.status}: ${error.statusText}`;
      }
    }
    
    console.error('[SharePointService] Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
