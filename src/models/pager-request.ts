/**
 * Represents the paging parameters for Debrid-Link list requests
 */
export interface PagerRequest {
  /** Torrent IDs (comma-delimited or json). (50 max.) */
  ids?: string|string[];
  /** Files structure type. list or tree. Default to list. */
  structureType?: 'list'|'tree';
  /** The page number. (Start at 0) */
  page?: number;
  /** Number of items per page. (min: 20, max: 50) */
  perPage?: number;
}
