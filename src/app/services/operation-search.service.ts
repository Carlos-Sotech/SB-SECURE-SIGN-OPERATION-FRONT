import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OperationReadDto } from '../models/operation.model';
import { OperationSearchDto, PaginatedResultDto } from '../models/operation-search.dto';
import { tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class OperationSearchService {
  private apiUrl = `${environment.apiUrl}/Operations`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  searchOperations(searchDto: OperationSearchDto): Observable<PaginatedResultDto<OperationReadDto>> {
    let params = new HttpParams();
    
    // Add search query parameter
    if (searchDto.query && searchDto.query.trim()) {
      params = params.set('query', searchDto.query.trim());
    }
    
    // Add pagination parameters
    params = params.set('page', searchDto.page.toString());
    params = params.set('pageSize', searchDto.pageSize.toString());

    // Always add the current user ID for backend filtering
    const currentUser = this.authService.currentUserValue;
    if (currentUser?.id) {
      params = params.set('requestingUserId', currentUser.id.toString());
      console.log('Adding requestingUserId to search params:', currentUser.id);
    } else {
      console.warn('No current user found for search request');
    }

    console.log('Sending search request with params:', params.toString());
    console.log('Full URL:', `${this.apiUrl}/search`);

    return this.http.get<PaginatedResultDto<OperationReadDto>>(`${this.apiUrl}/search`, { params }).pipe(
      tap(response => {
        console.log('Search response received:', response);
        console.log('Items count:', response.items?.length || 0);
      })
    );
  }

  // Method to get all operations when no search query is provided
  getAllOperations(page: number = 1, pageSize: number = 10): Observable<PaginatedResultDto<OperationReadDto>> {
    const searchDto: OperationSearchDto = {
      query: '',
      page,
      pageSize
    };
    return this.searchOperations(searchDto);
  }

  // Helper method to create default search DTO
  createDefaultSearchDto(): OperationSearchDto {
    return {
      query: '',
      page: 1,
      pageSize: 10,
      showExpired: false
    };
  }
} 