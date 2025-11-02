// src/app/services/company.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment'; // Ajusta la ruta
import { Company } from '../models/company.model';         // Ajusta la ruta
import { CompanyReadDto } from '../models/company-read.dto';

export interface CompanyCreationPayload {
  name: string;
  companyCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CompanyService { // <--- ASEGÚRATE DE QUE 'export' ESTÉ AQUÍ
  private apiUrl = `${environment.apiUrl}/companies`;

  constructor(private http: HttpClient) { }

  getCompanies(): Observable<CompanyReadDto[]> {
    return this.http.get<CompanyReadDto[]>(this.apiUrl)
      .pipe(catchError(this.handleError));
  }

  getCompany(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  createCompany( companyData: Omit<Company, 'id' | 'createdAt'>): Observable<Company> {
    return this.http.post<Company>(this.apiUrl, companyData)
      .pipe(catchError(this.handleError));
  }

  updateCompany(id: number, companyData: Company): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, companyData)
      .pipe(catchError(this.handleError));
  }

  deleteCompany(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocurrió un error desconocido en el servicio de empresas.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error del cliente: ${error.error.message}`;
    } else {
      console.error(
        `[CompanyService] Backend devolvió código ${error.status}, ` +
        `cuerpo del error: ${JSON.stringify(error.error)}`);
      errorMessage = error.error?.message || `Error del servidor ${error.status}: ${error.message || 'Error desconocido'}`;
    }
    return throwError(() => new Error(errorMessage));
  }
}