export interface AddTorrentRequest {
  /** The torrent URL, Magnet, hash */
  url?: string;
  /** File MUST use "multipart/form-data" content-type */
  fileName?: string;
  file?: Buffer;
  /** Wait before start the torrent to select files. Default to false */
  wait?: boolean;
  /** Async add magnet. (Fast add, don't wait meta before return result). true is recommended. Default to false (for compatibility with old versions). */
  async?: boolean;
  /** Files structure type. list or tree. Default to list */
  structureType?: 'list'|'tree';
}