import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PartyCreateDto, PartyUpdateDto, PartyReadDto } from '../models/party.model';

@Injectable({
  providedIn: 'root'
})
export class PartyService {
  private apiUrl = `${environment.apiUrl}/Parties`;

  constructor(private http: HttpClient) { }

  createParty(partyDto: PartyCreateDto): Observable<PartyReadDto> {
    return this.http.post<PartyReadDto>(this.apiUrl, partyDto);
  }

  getParty(id: number): Observable<PartyReadDto> {
    return this.http.get<PartyReadDto>(`${this.apiUrl}/${id}`);
  }

  getPartiesByOperation(operationId: number): Observable<PartyReadDto[]> {
    return this.http.get<PartyReadDto[]>(`${this.apiUrl}/operation/${operationId}`);
  }

  updateParty(id: number, partyDto: PartyUpdateDto): Observable<PartyReadDto> {
    return this.http.put<PartyReadDto>(`${this.apiUrl}/${id}`, partyDto);
  }

  deleteParty(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
} 