import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Operation, OperationReadDto, OperationStatusEnum } from '../models/operation.model';
import { tap } from 'rxjs/operators';

export interface OperationFilterDto {
    minMinutesAlive?: number;
    maxMinutesAlive?: number;
    operationType?: string;
    status?: string;
    readingAllPages?: boolean;
    readingConfirmed?: boolean;
    createdFrom?: Date;
    createdTo?: Date;
    page?: number;
    pageSize?: number;
    userId?: number;
}

export interface PaginatedResultDto<T> {
    items: T[];
    totalCount: number;
    totalPages: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

@Injectable({
    providedIn: 'root'
})   
export class OperationFilterService {
    private apiUrl = `${environment.apiUrl}/Operations`;

    constructor(private http: HttpClient) {}

    mapStatusToBackend(status: string): string {
        switch (status) {
            case 'Pending': return 'Pendiente';
            case 'Completed': return 'Completada';
            case 'Cancelled': return 'Lanzada';
            default: return 'Pendiente';
        }
    }

    getOperations(filter: OperationFilterDto): Observable<PaginatedResultDto<OperationReadDto>> {
        let params = new HttpParams();
        
        // Solo añadir parámetros que tengan valores válidos
        if (filter.minMinutesAlive !== undefined && filter.minMinutesAlive !== null) {
            params = params.set('minMinutesAlive', filter.minMinutesAlive.toString());
        }
        
        if (filter.maxMinutesAlive !== undefined && filter.maxMinutesAlive !== null) {
            params = params.set('maxMinutesAlive', filter.maxMinutesAlive.toString());
        }
        
        if (filter.operationType !== undefined && filter.operationType !== null && filter.operationType !== '') {
            params = params.set('operationType', filter.operationType);
        }
        
        if (filter.status !== undefined && filter.status !== null && filter.status !== '') {
            params = params.set('status', this.mapStatusToBackend(filter.status));
        }
        
        if (filter.readingAllPages === true) {
            params = params.set('readingAllPages', 'true');
        }
        
        if (filter.readingConfirmed === true) {
            params = params.set('readingConfirmed', 'true');
        }
        
        if (filter.createdFrom !== undefined && filter.createdFrom !== null) {
            params = params.set('createdFrom', filter.createdFrom.toISOString());
        }
        
        if (filter.createdTo !== undefined && filter.createdTo !== null) {
            params = params.set('createdTo', filter.createdTo.toISOString());
        }
        
        // Siempre incluir paginación
        params = params.set('page', (filter.page || 1).toString());
        params = params.set('pageSize', (filter.pageSize || 10).toString());

        // Incluir userId si está disponible
        if (filter.userId !== undefined && filter.userId !== null) {
            params = params.set('userId', filter.userId.toString());
        }

        console.log('Sending filter request with params:', params.toString());
        console.log('Full URL:', `${this.apiUrl}/filter`);

        return this.http.get<PaginatedResultDto<OperationReadDto>>(`${this.apiUrl}/filter`, { params }).pipe(
            tap(response => {
                console.log('Filter response received:', response);
                console.log('Items count:', response.items?.length || 0);
            })
        );
    }

    hasActiveFilters(filter: OperationFilterDto): boolean {
        return Object.entries(filter).some(([key, value]) => {
            if (key === 'page' || key === 'pageSize') return false;
            return value !== undefined && value !== null && value !== '';
        });
    }

    clearFilters(filter: OperationFilterDto): OperationFilterDto {
        return {
            page: 1,
            pageSize: 10,
        };
    }
}