import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AgreementCreateDto, AgreementReadDto } from '../models/agreement.model';

@Injectable({
  providedIn: 'root'
})
export class AgreementService {
  private apiUrl = `${environment.apiUrl}/Agreements`;

  constructor(private http: HttpClient) { }

  createAgreement(agreementDto: AgreementCreateDto): Observable<AgreementReadDto> {
    return this.http.post<AgreementReadDto>(this.apiUrl, agreementDto);
  }

  getAgreement(id: number): Observable<AgreementReadDto> {
    return this.http.get<AgreementReadDto>(`${this.apiUrl}/${id}`);
  }

  getAgreementsByOperation(operationId: number): Observable<AgreementReadDto[]> {
    return this.http.get<AgreementReadDto[]>(`${this.apiUrl}/operation/${operationId}`);
  }

  updateAgreement(id: number, agreementDto: AgreementCreateDto): Observable<AgreementReadDto> {
    return this.http.put<AgreementReadDto>(`${this.apiUrl}/${id}`, agreementDto);
  }

  deleteAgreement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
} 