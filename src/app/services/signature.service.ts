import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LaunchOperationDto {
  operationId: number;
}

export interface LaunchOperationResponse {
  id: number;
  externalId?: string;
  minutesAlive: number;
  status: string;
  userId: number;
  userName: string;
  superUserId: number;
  superUserName: string;
  filePDF: string;
  operationType: string;
  operationTypeName: string;
  readingAllPages: boolean;
  readingConfirmed: boolean;
  readingText: string;
  certificateId: string;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
  expirationDate: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class SignatureService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  launchOperation(operationId: number): Observable<LaunchOperationResponse> {
    const launchDto: LaunchOperationDto = { operationId };
    return this.http.post<LaunchOperationResponse>(`${this.apiUrl}/Signature/launch-operation`, launchDto);
  }

  getSignedPdf(operationId: number): Observable<Blob> {
    console.log('🔄 [SIGNATURE SERVICE] getSignedPdf called for operationId:', operationId);
    console.log('🔄 [SIGNATURE SERVICE] Making HTTP GET request to:', `${this.apiUrl}/Webhook/signed-pdf/${operationId}`);
    return this.http.get(`${this.apiUrl}/Webhook/signed-pdf/${operationId}`, { responseType: 'blob' });
  }

  getSignedPdfCopy(operationId: number): Observable<Blob> {
    console.log('🔄 [SIGNATURE SERVICE] getSignedPdfCopy called for operationId:', operationId);
    console.log('🔄 [SIGNATURE SERVICE] Making HTTP GET request to:', `${this.apiUrl}/Webhook/signed-pdf-copy/${operationId}`);
    return this.http.get(`${this.apiUrl}/Webhook/signed-pdf-copy/${operationId}`, { responseType: 'blob' });
  }
  getAuditPDF(operationId: number): Observable<Blob> {
    console.log('🔄 [SIGNATURE SERVICE] getAudit called for operationId:', operationId);
    console.log('🔄 [SIGNATURE SERVICE] Making HTTP GET request to:', `${this.apiUrl}/Webhook/audit-pdf/${operationId}`);
    return this.http.get(`${this.apiUrl}/Webhook/audit-pdf/${operationId}`, { responseType: 'blob' });
  }

  checkAuditFileExists(operationId: number): Observable<boolean> {
    console.log('🔄 [SIGNATURE SERVICE] checkAuditFileExists called for operationId:', operationId);
    console.log('🔄 [SIGNATURE SERVICE] Making HTTP GET request to check if audit file exists:', `${this.apiUrl}/Webhook/audit-pdf/${operationId}`);
    
    // Usar el método GET existente pero solo para verificar existencia
    // Si la petición es exitosa, el archivo existe
    return this.http.get(`${this.apiUrl}/Webhook/audit-pdf/${operationId}`, { 
      responseType: 'blob'
    }).pipe(
      map((blob) => {
        console.log('✅ [SIGNATURE SERVICE] Audit file exists, blob size:', blob.size);
        return true;
      }),
      catchError((error) => {
        console.log('⚠️ [SIGNATURE SERVICE] Audit file does not exist or error occurred:', error);
        console.log('⚠️ [SIGNATURE SERVICE] Error details:', error);
        return of(false);
      })
    );
  }
} 