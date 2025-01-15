import { stringify } from 'querystring';
import {
  ActivityRequest,
  AddTorrentRequest,
  DebridLinkApiResponse as Response,
  DownloadInfo,
  LimitsAndUsage,
  PagerRequest,
  TorrentActivityMap,
  TorrentInfo
} from '../models/index.js';
import l from '../logger.js';
import { retryableFetch } from '../utils.js';
import { AuthManager } from './auth-manager.js';

const logger = l.child({}, { msgPrefix: '[DebridLinkClient]' });

/**
 * A client wrapping Debrid-Link.com API
 */
export class DebridLinkClient {
  #API_URI = 'https://debrid-link.com/api/v2';
  #authManager: AuthManager;

  constructor(
    authManager: AuthManager
  ) {
    if (!authManager) {
      throw new Error('[DebridLinkClient] missing auth manager');
    }
    this.#authManager = authManager;
  }

  /**
   * Fetch, automatically adding token
   * @param input 
   * @param init 
   * @returns 
   */
  async #fetch<T>(input: string | URL, init?: RequestInit | undefined): Promise<T> {
    if (init?.body && init.body.constructor.name !== 'Buffer') {
      init.body = stringify(init.body as any);
    }
    const url = `${this.#API_URI}${input}`;
    const token = await this.#authManager.getToken();
    const response = await retryableFetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      ...init
    });
    if (response.status >= 200 && response.status < 300) {
      return response.json()
        .catch(() => Promise.resolve())
        .then((json: Response<T>) => {
          logger.trace(`Got response payload`, { json });
          return json.value as T;
        });
    }
    let body: string | undefined;
    try {
      body = await response.text();
    }
    catch {}
    throw new Error(`[DebridLinkClient] The server returned an error for '${url}': (${response.status}) ${response.statusText}` + body ? ` - ${body}` : '');
  }

  /**
   * List the torrents
   * A file is ready for download when "downloadPercent" == 100. You can refresh torrents status with the "/seedbox/activity" endpoint that return less informations to get new states faster.
   * @param pager 
   * @returns 
   */
  async listTorrents(pager?: PagerRequest): Promise<TorrentInfo[]> {
    const params = stringify(pager as any);
    logger.trace(`Listing torrents`, { pager });
    return this.#fetch(`/seedbox/list?${params}`);
  }

  /**
   * Get torrents activity
   * Activity indexed by torrent ID. The "files" field is the downloaded percent for each file, same index that "files" field on "/seedbox/list".
   * @param pager 
   * @returns 
   */
  async getTorrentsActivity(pager?: ActivityRequest): Promise<TorrentActivityMap> {
    const params = stringify(pager as any);
    logger.trace(`Getting torrents activity`, { pager });
    return this.#fetch(`/seedbox/activity?${params}`);
  }

  /**
   * Add a torrent
   * 
   * A torrent URL must be public. The hash is only added if it is already cached on our servers. A magnet can be slow to add when async=false (require to get meta from network), when async=true you must pool the "/seedbox/list?ids=torrentID" endpoint to properly get all informations (files, names, size ...).
   * 
   * You can upload a ".torrent" file with the "file" field but you must use the "multipart/form-data" content-type.
   * @param request 
   * @returns 
   */
  async addTorrent(request: AddTorrentRequest): Promise<TorrentInfo> {
    logger.trace(`Adding torrent`, { request });
    if (request.url) {
      if (request.file || request.fileName) {
        logger.warn('Using URL, ignoring file and fileName');
      }
      delete request.file;
      delete request.fileName
      return this.#fetch(`/seedbox/add`, {
        method: 'POST',
        body: request as any
      });
    }
    if (!request.file || !request.fileName) {
      throw new Error('[DebridLinkClient] missing URL or file & fileName');
    }
    const body = new FormData();
    Object.entries(request)
      .filter(([prop]) => prop != 'file' && prop != 'fileName')
      .forEach(([prop, value]) => body.set(prop, value));
    const fileBlob = new Blob([request.file]);
    body.set('file', fileBlob, request.fileName);
    return this.#fetch(`/seedbox/add`, {
      method: 'POST',
      body
    });
  }

  /**
   * Remove the torrent(s)
   * @param ids The ids list (comma-delimited or json)
   * @returns 
   */
  async removeTorrent(ids: string|string[]): Promise<string[]> {
    logger.trace(`Removing torrents`, { ids });
    return this.#fetch(`/seedbox/${(Array.isArray(ids) ? JSON.stringify(ids) : ids)}/remove`, {
      method: 'DELETE'
    });
  }

  /**
   * Create zip of files
   * @param id The id of torrent
   */
  async zipTorrentFiles(id: string): Promise<string[]> {
    logger.trace(`Compressing torrent files`, { id });
    return this.#fetch(`/seedbox/${id}/zip`, {
      method: 'POST'
    });
  }

  /**
   * Configure a waiting torrent
   * @param id The id of torrent
   * @param unwantedFileIds The ids list of files. Set empty array to download all files. (comma-delimited or json)
   * @returns 
   */
  async configureTorrent(id: string, unwantedFileIds: string|string[]): Promise<void> {
    logger.trace(`Configure unwanted torrent files`, { id });
    return this.#fetch(`/seedbox/${id}/config`, {
      method: 'POST',
      body: {
        'files-unwanted': unwantedFileIds
      } as any
    });
  }

  /**
   * Get limits and usage
   * @returns 
   */
  async getTorrentsLimitsAndUsage(): Promise<LimitsAndUsage> {
    logger.trace(`Get limits and usage`);
    return this.#fetch(`/seedbox/limits`);
  }

  /**
   * 
   * Seedbox rss methods not implemented
   * 
   */

  // /**
  //  * List link(s)
  //  * @param pager 
  //  * @returns 
  //  */
  // async listDownloadLinks(pager?: PagerRequest): Promise<DownloadInfo[]> {
  //   const params = stringify(pager as any);
  //   logger.trace(`Listing download links`, { pager });
  //   return this.#fetch(`/downloader/list?${params}`);
  // }

  // /**
  //  * Add a link
  //  * 
  //  * In most case the result is an associative array (link object), but it can be an sequential array when you send a folder that have multiple links.
  //  * @param url The host URL http://host...
  //  * @param password The link password
  //  * @returns 
  //  */
  // async addLink(url: string, password?: string): Promise<DownloadInfo> {
  //   const body = { url } as any;
  //   if (password) {
  //     body.password = password;
  //   }
  //   logger.trace(`Add link`, { url, password });
  //   return this.#fetch(`/downloader/add`, {
  //     method: 'POST',
  //     body
  //   });
  // }

  // /**
  //  * Remove the link(s)
  //  * @param url The host URL http://host...
  //  * @param password The link password
  //  * @returns 
  //  */
  // async removeLink(ids: string|string[]): Promise<DownloadInfo> {
  //   logger.trace(`Remove link(s)`, { ids });
  //   return this.#fetch(`/downloader/${(Array.isArray(ids) ? JSON.stringify(ids) : ids)}/remove`, {
  //     method: 'DELETE'
  //   });
  // }
}