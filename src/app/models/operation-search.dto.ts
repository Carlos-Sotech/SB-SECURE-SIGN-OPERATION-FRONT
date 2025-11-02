export interface OperationSearchDto {
  query: string;
  page: number;
  pageSize: number;
  showExpired?: boolean;
}

export interface PaginatedResultDto<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
} 