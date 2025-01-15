export interface DownloadInfo {
  id: string;
  expired: boolean;
  chunk: number;
  host: string;
  size: number;
  created: number;
  url: string;
  downloadUrl: string;
  name: string
}