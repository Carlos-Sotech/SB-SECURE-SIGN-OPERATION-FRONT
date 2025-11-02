import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PartyService } from './party.service';
import { PartyCreateDto, PartyReadDto } from '../models/party.model';

describe('PartyService', () => {
  let service: PartyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PartyService]
    });
    service = TestBed.inject(PartyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create party', () => {
    const partyDto: PartyCreateDto = {
      idOperation: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phoneNumber: '+1234567890',
      x: 100,
      y: 200,
      width: 150,
      height: 50,
      page: 1,
      required: true,
      partyTexts: [{ text: 'Sample text' }]
    };

    const mockResponse: PartyReadDto = {
      id: 1,
      idOperation: 1,
      uniqueIdentifier: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phoneNumber: '+1234567890',
      x: 100,
      y: 200,
      width: 150,
      height: 50,
      page: 1,
      required: true,
      partyTexts: []
    };

    service.createParty(partyDto).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${service['apiUrl']}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(partyDto);
    req.flush(mockResponse);
  });

  it('should get party by id', () => {
    const mockResponse: PartyReadDto = {
      id: 1,
      idOperation: 1,
      uniqueIdentifier: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phoneNumber: '+1234567890',
      x: 100,
      y: 200,
      width: 150,
      height: 50,
      page: 1,
      required: true,
      partyTexts: []
    };

    service.getParty(1).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${service['apiUrl']}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should get parties by operation', () => {
    const mockResponse: PartyReadDto[] = [
      {
        id: 1,
        idOperation: 1,
        uniqueIdentifier: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '+1234567890',
        x: 100,
        y: 200,
        width: 150,
        height: 50,
        page: 1,
        required: true,
        partyTexts: []
      }
    ];

    service.getPartiesByOperation(1).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${service['apiUrl']}/operation/1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
}); 