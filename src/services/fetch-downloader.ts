import { createWriteStream } from 'fs';
import { rename } from 'fs/promises';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { ReadableStream } from 'stream/web';
import { IDownloader } from '../models/downloader.js';
import l from '../logger.js';
import { retryableFetch } from '../utils.js';

const logger = l.child({}, { msgPrefix: '[FetchDownloader]' });

/**
 * Download files using Node.JS fetch API
 */
export class FetchDownloader implements IDownloader {
  /** @inheritdoc */
  async download(url: string, tempDestination: string, destination: string): Promise<void> {
    logger.debug(`Starting download of '${url}' to '${destination}`, { url, destination , tempDestination });
    const response = await retryableFetch(url);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`FetchDownloader: The server returned an error for '${url}': (${response.status}) ${response.statusText}`);
    }
    const data = Readable.fromWeb(response.body as ReadableStream<any>);
    const writer = createWriteStream(tempDestination);
    await pipeline(data, writer);
    logger.trace(`Moving out from temp`, { url, destination , tempDestination });
    await rename(tempDestination, destination);
    logger.debug(`Download completed`, { url, destination , tempDestination });
  }

  /** @inheritdoc */
  async destroy(): Promise<void> {
    return;
  }
}