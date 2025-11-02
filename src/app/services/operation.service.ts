import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, interval } from 'rxjs';
import { catchError, switchMap, startWith, tap } from 'rxjs/operators';
import { Operation, OperationTypeEnum, OperationReadDto, OperationCreateDto } from '../models/operation.model';
import { environment } from '../../environments/environment';
import { PaginatedResultDto } from '../models/operation-search.dto';
import { FileUrlService } from './file-url.service';

@Injectable({
  providedIn: 'root'
})
export class OperationService {
  private apiUrl = `${environment.apiUrl}/operations`;
  private readonly REFRESH_INTERVAL = 10000; // 10 segundos

  constructor(private http: HttpClient, private fileUrlService: FileUrlService) { }

  getOperations(): Observable<OperationReadDto[]> {
    return this.http.get<OperationReadDto[]>(this.apiUrl)
      .pipe(
        catchError(this.handleError),
                          tap((operations) => {
                    if (operations.length > 0) {
                      console.log('[OperationService] First operation descripcionOperacion:', operations[0].descripcionOperacion);
                    }
                  })
      );
  }

  // Método para obtener operaciones con actualización automática cada 10 segundos
  getOperationsWithAutoRefresh(): Observable<OperationReadDto[]> {
    return interval(this.REFRESH_INTERVAL).pipe(
      startWith(0), // Emitir inmediatamente al suscribirse
      switchMap(() => this.getOperations())
    );
  }

  getOperationById(id: number): Observable<OperationReadDto> {
    return this.http.get<OperationReadDto>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(this.handleError),
        tap((operation) => {
          console.log('[OperationService] descripcionOperacion field:', operation.descripcionOperacion);
        })
      );
  }

  // Método para obtener una operación específica con actualización automática
  getOperationByIdWithAutoRefresh(id: number): Observable<OperationReadDto> {
    return interval(this.REFRESH_INTERVAL).pipe(
      startWith(0), // Emitir inmediatamente al suscribirse
      switchMap(() => this.getOperationById(id))
    );
  }

  // Método para actualizar el estado de confirmación de lectura
  updateReadingStatus(operationId: number, readingConfirmed: boolean, readingText?: string): Observable<any> {
    const updateData = {
      readingConfirmed: readingConfirmed,
      readingText: readingText || ''
    };
    
    console.log('[OperationService] Updating reading status for operation:', operationId, updateData);
    
    return this.http.patch(`${this.apiUrl}/${operationId}/reading`, updateData)
      .pipe(
        catchError(this.handleError),
        tap(() => console.log('[OperationService] Reading status updated successfully'))
      );
  }

  createOperation(operationData: OperationCreateDto, filePDF?: File): Observable<OperationReadDto> {
    const formData = new FormData();
    
    // Debug: mostrar qué se está enviando
    console.log('[OperationService] Creating operation with data:', operationData);
    console.log('[OperationService] PDF file:', filePDF);
    
    // Agregar todos los campos del DTO al FormData
    formData.append('minutesAlive', operationData.minutesAlive.toString());
    formData.append('status', operationData.status);
    formData.append('userId', operationData.userId.toString());
    if (operationData.superUserId) {
      formData.append('superUserId', operationData.superUserId.toString());
    }
    formData.append('operationType', operationData.operationType);
    formData.append('readingAllPages', operationData.readingAllPages.toString());
    formData.append('readingConfirmed', operationData.readingConfirmed.toString());
    if (operationData.readingText) {
      formData.append('readingText', operationData.readingText);
    }
    if (operationData.certificateId) {
      formData.append('certificateId', operationData.certificateId);
    }
    
    // Agregar el campo isNecessaryConfirmReading
    console.log('[OperationService] Adding isNecessaryConfirmReading to FormData:', operationData.isNecessaryConfirmReading);
    formData.append('isNecessaryConfirmReading', operationData.isNecessaryConfirmReading.toString());
    
            // Agregar el campo descripcionOperacion
        if (operationData.descripcionOperacion) {
            console.log('[OperationService] Adding descripcionOperacion to FormData:', operationData.descripcionOperacion);
            formData.append('descripcionOperacion', operationData.descripcionOperacion);
        } else {
            console.log('[OperationService] No descripcionOperacion provided');
        }
    
    // Debug: mostrar todo el FormData que se está enviando
    console.log('[OperationService] === FormData Debug ===');
    for (let [key, value] of formData.entries()) {
      console.log(`[OperationService] FormData entry: ${key} = ${value}`);
    }
    console.log('[OperationService] ======================');
    
    // Agregar el archivo PDF si existe
    if (filePDF) {
      console.log('[OperationService] Adding PDF file to FormData with name: pdfFile');
      formData.append('pdfFile', filePDF);
    } else {
      console.log('[OperationService] No PDF file provided');
    }

    return this.http.post<OperationReadDto>(this.apiUrl, formData)
      .pipe(catchError(this.handleError));
  }

  updateOperation(id: number, operationData: Partial<OperationCreateDto>, filePDF?: File): Observable<OperationReadDto> {
    const formData = new FormData();
    
    // Debug: mostrar qué se está enviando
    console.log('[OperationService] Updating operation with ID:', id);
    console.log('[OperationService] Update data:', operationData);
    console.log('[OperationService] PDF file:', filePDF);
    
    // Agregar todos los campos del DTO al FormData
    if (operationData.minutesAlive !== undefined) {
      formData.append('minutesAlive', operationData.minutesAlive.toString());
    }
    if (operationData.status) {
      formData.append('status', operationData.status);
    }
    if (operationData.userId !== undefined) {
      formData.append('userId', operationData.userId.toString());
    }
    if (operationData.superUserId) {
      formData.append('superUserId', operationData.superUserId.toString());
    }
    if (operationData.operationType) {
      formData.append('operationType', operationData.operationType);
    }
    if (operationData.readingAllPages !== undefined) {
      formData.append('readingAllPages', operationData.readingAllPages.toString());
    }
    if (operationData.readingConfirmed !== undefined) {
      formData.append('readingConfirmed', operationData.readingConfirmed.toString());
    }
    if (operationData.readingText) {
      formData.append('readingText', operationData.readingText);
    }
    if (operationData.certificateId) {
      formData.append('certificateId', operationData.certificateId);
    }
    
    // Agregar el campo isNecessaryConfirmReading
    if (operationData.isNecessaryConfirmReading !== undefined) {
      console.log('[OperationService] Adding isNecessaryConfirmReading to FormData (update):', operationData.isNecessaryConfirmReading);
      formData.append('isNecessaryConfirmReading', operationData.isNecessaryConfirmReading.toString());
    }
    
            // Agregar el campo descripcionOperacion
        if (operationData.descripcionOperacion !== undefined) {
            console.log('[OperationService] Adding descripcionOperacion to FormData (update):', operationData.descripcionOperacion);
            formData.append('descripcionOperacion', operationData.descripcionOperacion);
        } else {
            console.log('[OperationService] No descripcionOperacion provided for update');
        }
    
    // Debug: mostrar todo el FormData que se está enviando
    console.log('[OperationService] === FormData Debug (Update) ===');
    for (let [key, value] of formData.entries()) {
      console.log(`[OperationService] FormData entry: ${key} = ${value}`);
    }
    console.log('[OperationService] ===============================');
    
    // Agregar el archivo PDF si existe (para actualización usa FilePDF)
    if (filePDF) {
      console.log('[OperationService] Adding PDF file to FormData with name: FilePDF');
      formData.append('FilePDF', filePDF);
    } else {
      console.log('[OperationService] No PDF file provided for update');
    }

    return this.http.put<OperationReadDto>(`${this.apiUrl}/${id}`, formData)
      .pipe(catchError(this.handleError));
  }

  deleteOperation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  getOperationsByUser(userId: number, page: number = 1, pageSize: number = 20): Observable<PaginatedResultDto<OperationReadDto>> {
    const url = `${this.apiUrl}/user/${userId}?page=${page}&pageSize=${pageSize}`;
    console.log(`[OperationService] Calling: ${url}`);
    
    return this.http.get<PaginatedResultDto<OperationReadDto>>(url)
      .pipe(catchError(this.handleError));
  }

  getUserOperationsCountForDeletion(userId: number): Observable<number> {
    const url = `${this.apiUrl}/user/${userId}/count-for-deletion`;
    console.log(`[OperationService] Calling: ${url}`);
    
    return this.http.get<number>(url)
      .pipe(catchError(this.handleError));
  }

  getUserOperationsCountForCompanyChange(userId: number): Observable<number> {
    const url = `${this.apiUrl}/user/${userId}/count-for-company-change`;
    console.log(`[OperationService] Calling: ${url}`);
    
    return this.http.get<number>(url)
      .pipe(catchError(this.handleError));
  }

  // Método para obtener operaciones por usuario con actualización automática cada 10 segundos
  getOperationsByUserWithAutoRefresh(userId: number, page: number = 1, pageSize: number = 20): Observable<PaginatedResultDto<OperationReadDto>> {
    return interval(this.REFRESH_INTERVAL).pipe(
      startWith(0), // Emitir inmediatamente al suscribirse
      switchMap(() => this.getOperationsByUser(userId, page, pageSize))
    );
  }

  getOperationsBySuperUser(superUserId: number): Observable<OperationReadDto[]> {
    return this.http.get<OperationReadDto[]>(`${this.apiUrl}/superuser/${superUserId}`)
      .pipe(catchError(this.handleError));
  }

  getOperationsByCompany(companyId: number, page: number = 1, pageSize: number = 20): Observable<PaginatedResultDto<OperationReadDto>> {
    return this.http.get<PaginatedResultDto<OperationReadDto>>(`${environment.apiUrl}/Users/company/${companyId}/operations?page=${page}&pageSize=${pageSize}`)
      .pipe(catchError(this.handleError));
  }

  // Método para obtener operaciones pendientes de un usuario específico
  getPendingOperationsByUser(userId: number): Observable<OperationReadDto[]> {
    return this.http.get<OperationReadDto[]>(`${this.apiUrl}/pending?userId=${userId}`)
      .pipe(catchError(this.handleError));
  }

  // Método para obtener operaciones pendientes de un usuario específico con actualización automática
  getPendingOperationsByUserWithAutoRefresh(userId: number): Observable<OperationReadDto[]> {
    return interval(this.REFRESH_INTERVAL).pipe(
      startWith(0), // Emitir inmediatamente al suscribirse
      switchMap(() => this.getPendingOperationsByUser(userId))
    );
  }

  // Método para obtener operaciones pendientes de una empresa
  getPendingOperationsByCompany(companyId: number): Observable<OperationReadDto[]> {
    return this.http.get<OperationReadDto[]>(`${this.apiUrl}/pending/company/${companyId}`)
      .pipe(catchError(this.handleError));
  }

  getOperationPdf(operationId: number): Observable<Blob> {
    const url = `${environment.apiUrl}/Operations/${operationId}/pdf`;
    
    return this.http.get(url, { responseType: 'blob' })
      .pipe(catchError(this.handleError));
  }

  /**
   * Obtiene la URL para acceder a un archivo del directorio media
   * @param fileName Nombre del archivo
   * @returns URL completa para acceder al archivo
   */
  getMediaFileUrl(fileName: string): string {
    return this.fileUrlService.getMediaFileUrl(fileName);
  }

  updateWorkflowUrl(operationId: number, workflowUrl: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${operationId}/workflow-url`, { workFlowUrl: workflowUrl })
      .pipe(catchError(this.handleError));
  }

  getOperationTypes(): OperationTypeEnum[] {
    return Object.values(OperationTypeEnum);
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocurrió un error desconocido en el servicio de operaciones.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error del cliente: ${error.error.message}`;
    } else {
      console.error(
        `[OperationService] Backend devolvió código ${error.status}, ` +
        `cuerpo del error: ${JSON.stringify(error.error)}`);
      errorMessage = error.error?.message || `Error del servidor ${error.status}: ${error.message || 'Error desconocido'}`;
    }
    return throwError(() => new Error(errorMessage));
  }
} 