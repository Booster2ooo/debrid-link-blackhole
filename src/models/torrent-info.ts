import { TorrentFileInfo } from "./torrent-file-info.js";
import { TorrentTrackerInfo } from "./torrent-tracker-info.js";

export interface TorrentInfo {
  id: string;
  name: string;
  hashString: string;
  uploadRatio: number;
  serverId: string;
  wait: boolean;
  peersConnected: number;
  status: number;
  totalSize: number;
  created: number; //timestamp
  downloadPercent: number;
  downloadSpeed: number;
  uploadSpeed: number;
  trackers: TorrentTrackerInfo[];
  files: TorrentFileInfo[];
}