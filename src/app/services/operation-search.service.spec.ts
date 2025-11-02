import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OperationSearchService } from './operation-search.service';
import { OperationSearchDto, PaginatedResultDto } from '../models/operation-search.dto';
import { OperationReadDto } from '../models/operation.model';
import { environment } from '../../environments/environment';

describe('OperationSearchService', () => {
  let service: OperationSearchService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OperationSearchService]
    });
    service = TestBed.inject(OperationSearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should search operations with query', () => {
    const searchDto: OperationSearchDto = {
      query: 'test query',
      page: 1,
      pageSize: 10
    };

    const mockResponse: PaginatedResultDto<OperationReadDto> = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    };

    service.searchOperations(searchDto).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/Operations/search?query=test%20query&page=1&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should search operations without query (get all)', () => {
    const searchDto: OperationSearchDto = {
      query: '',
      page: 1,
      pageSize: 10
    };

    const mockResponse: PaginatedResultDto<OperationReadDto> = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    };

    service.searchOperations(searchDto).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/Operations/search?page=1&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should get all operations with default pagination', () => {
    const mockResponse: PaginatedResultDto<OperationReadDto> = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    };

    service.getAllOperations().subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/Operations/search?page=1&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should get all operations with custom pagination', () => {
    const mockResponse: PaginatedResultDto<OperationReadDto> = {
      items: [],
      totalCount: 0,
      page: 2,
      pageSize: 20,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    };

    service.getAllOperations(2, 20).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/Operations/search?page=2&pageSize=20`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should create default search DTO', () => {
    const defaultDto = service.createDefaultSearchDto();
    expect(defaultDto).toEqual({
      query: '',
      page: 1,
      pageSize: 10
    });
  });

  it('should handle search with special characters in query', () => {
    const searchDto: OperationSearchDto = {
      query: 'test@email.com & special chars',
      page: 1,
      pageSize: 10
    };

    const mockResponse: PaginatedResultDto<OperationReadDto> = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    };

    service.searchOperations(searchDto).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(req => 
      req.url === `${environment.apiUrl}/Operations/search` &&
      req.params.has('query') &&
      req.params.has('page') &&
      req.params.has('pageSize')
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should handle empty query string', () => {
    const searchDto: OperationSearchDto = {
      query: '   ', // whitespace only
      page: 1,
      pageSize: 10
    };

    const mockResponse: PaginatedResultDto<OperationReadDto> = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    };

    service.searchOperations(searchDto).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/Operations/search?page=1&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
}); 