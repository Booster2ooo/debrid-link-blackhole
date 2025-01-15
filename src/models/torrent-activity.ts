export interface TorrentActivity {
  uploadRatio: number;
  peersConnected: number;
  status: number;
  wait: boolean;
  act_progress: boolean;
  files: number[];
  zip: unknown[];
  size: number;
  downloadPercent: number;
  downloadSpeed: number;
  uploadSpeed: number;
}