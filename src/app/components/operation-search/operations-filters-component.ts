import { Component, EventEmitter, inject, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { OperationSearchService } from '../../services/operation-search.service';
import { OperationSearchDto } from '../../models/operation-search.dto';
import { OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-operation-search',
  templateUrl: './operation-search.component.html',
  styleUrls: ['./operation-search-component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatTableModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatExpansionModule,
  ],
})
export class OperationSearchComponent implements OnInit, OnDestroy, AfterViewInit {
  private fb = inject(FormBuilder);
  @Output() searchChanged = new EventEmitter<OperationSearchDto>();

  // Properties for responsive design
  isExpanded = false;

  searchForm: FormGroup = this.fb.group({
    query: [''],
    page: [1],
    pageSize: [20],
    showExpired: [false]
  });

  private subscriptions: Subscription = new Subscription();

  constructor(private operationSearchService: OperationSearchService) {}

  ngOnInit(): void {
    // Setup search with debounce to avoid too many API calls
    this.subscriptions.add(
      this.searchForm.get('query')?.valueChanges.pipe(
        debounceTime(500),
        distinctUntilChanged()
      ).subscribe(() => {
        this.performSearch();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  ngAfterViewInit(): void {
    // No longer needed for pagination
  }

  toggleSearch(): void {
    this.isExpanded = !this.isExpanded;
  }

  expandAll(): void {
    this.isExpanded = true;
  }

  collapseAll(): void {
    this.isExpanded = false;
  }

  performSearch() {
    const formValue = this.searchForm.value;
    
    const searchDto: OperationSearchDto = {
      query: formValue.query || '',
      page: formValue.page || 1,
      pageSize: formValue.pageSize || 20,
      showExpired: formValue.showExpired || false
    };

    this.searchChanged.emit(searchDto);
  }

  clearSearch() {
    this.searchForm.patchValue({
      query: '',
      page: 1,
      pageSize: 20,
      showExpired: false
    });
    
    const defaultSearch = this.operationSearchService.createDefaultSearchDto();
    this.searchChanged.emit(defaultSearch);
  }

  hasSearchQuery(): boolean {
    const query = this.searchForm.get('query')?.value;
    return query && query.trim().length > 0;
  }

  getSearchQueryLength(): number {
    const query = this.searchForm.get('query')?.value;
    return query ? query.trim().length : 0;
  }

  // Method to handle search button click
  onSearchClick() {
    this.performSearch();
  }

  // Method to handle enter key press
  onSearchKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.performSearch();
    }
  }
}       
