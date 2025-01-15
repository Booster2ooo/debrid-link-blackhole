export interface DebridLinkApiResponse<T> {
  success: boolean;
  value: T;
  pagination: {
    page: number;
    pages: number;
    next: number;
    previous: number;
  }
}