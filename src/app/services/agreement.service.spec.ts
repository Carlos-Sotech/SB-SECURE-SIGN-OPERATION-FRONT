import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AgreementService } from './agreement.service';
import { AgreementCreateDto, AgreementReadDto } from '../models/agreement.model';

describe('AgreementService', () => {
  let service: AgreementService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AgreementService]
    });
    service = TestBed.inject(AgreementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create agreement', () => {
    const agreementDto: AgreementCreateDto = {
      idOperation: 1,
      text: 'Test agreement text',
      accepted: true
    };

    const mockResponse: AgreementReadDto = {
      id: 1,
      idOperation: 1,
      text: 'Test agreement text',
      accepted: true
    };

    service.createAgreement(agreementDto).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${service['apiUrl']}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(agreementDto);
    req.flush(mockResponse);
  });

  it('should get agreement by id', () => {
    const mockResponse: AgreementReadDto = {
      id: 1,
      idOperation: 1,
      text: 'Test agreement text',
      accepted: true
    };

    service.getAgreement(1).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${service['apiUrl']}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should get agreements by operation', () => {
    const mockResponse: AgreementReadDto[] = [
      {
        id: 1,
        idOperation: 1,
        text: 'Test agreement text',
        accepted: true
      }
    ];

    service.getAgreementsByOperation(1).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${service['apiUrl']}/operation/1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
}); 