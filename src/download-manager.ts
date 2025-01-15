import { readFile, stat } from 'fs/promises';
import { basename, join } from 'path';
import dotenv from 'dotenv';
import l from './logger.js';
import {
  IDownloader,
  TorrentInfo
} from './models/index.js';
import { 
  AuthManager,
  Aria2Downloader,
  FetchDownloader,
  DebridLinkClient,
  SmtpMailer
} from './services/index.js';
import { resolvePath, sleep } from './utils.js';

dotenv.config();
const argv = process.argv.slice(2);
const logger = l.child({}, { msgPrefix: '[DownloadManager]' });

(async() => {
  if (!process.env.DEBRID_LINK_CLIENT_ID) {
    throw new Error('Missing OAuth2 clientId');
  }
  const target = argv?.[0];
  if (!target) {
    throw new Error('Missing torrent or magnet link');
  }
  logger.info(`Starting download for '${target}'`);
  const destination = resolvePath(process.env.DOWNLOADS, ['downloads']);
  const tempDestination = resolvePath(process.env.IN_PROGRESS, ['torrents', 'in-progress']) || destination;
  if (!destination && process.env.DOWNLOADER?.toLowerCase() === 'fetch') {
    throw new Error(`Missing downloads destination configuration`);
  }
  logger.debug(`destination: '${destination}' - temp destination: ${tempDestination}`);
  logger.debug(`downloader: '${process.env.DOWNLOADER}' (${process.env.DOWNLOADER?.toLowerCase()})`);
  try {
    const content = await readFile(target);
    const mailer = new SmtpMailer();
    const authManager = new AuthManager(mailer);
    const debridLinkClient: DebridLinkClient = new DebridLinkClient(authManager);
    let torrentInfo: TorrentInfo;
    if (target.endsWith('.magnet')) {
      logger.trace(`Target is a magnet`);
      torrentInfo = await debridLinkClient.addTorrent({
        async: true,
        url: content.toString()
      });
    }
    else {
      logger.trace(`Target is a torrent`);
      torrentInfo = await debridLinkClient.addTorrent({
        async: true,
        file: content,
        fileName: basename(target)
      });
    }
    let completed = false;
    while(!completed) {
      torrentInfo = (await debridLinkClient.listTorrents({ ids: torrentInfo.id }))[0];
      completed = torrentInfo.downloadPercent === 100;
      if (!completed) await sleep(30 * 1000);
    }
    const downloadLinks = torrentInfo.files;
    if (downloadLinks.length) {
      let downloader: IDownloader;
      switch(process.env.DOWNLOADER?.toLowerCase()) {
        case 'aria2':
          logger.debug(`Selected Aria2 downloader`);
          downloader = new Aria2Downloader();
          break;
        case 'fetch':
          logger.debug(`Selected Fetch downloader`);
          downloader = new FetchDownloader();
          break;
        default:
          logger.debug(`Selected no downloader, outputing links`);
          downloadLinks.forEach(link => console.log(link.downloadUrl));
          process.exit(0);
      }
      for(let downloadLink of downloadLinks) {
        try {
          const { name, downloadUrl, size } = downloadLink;
          const fileTempDestination = join(tempDestination, name);
          const fileDestination = join(destination, name);
          try {
            const stats = await stat(fileDestination);
            if (stats.size === size) {
              logger.trace(`A file with the same size already exists, skipping '${fileDestination}'`);
              continue;
            }
          }
          catch {}
          await downloader.download(downloadUrl, fileTempDestination, fileDestination);
        }
        catch (ex) {
          logger.warn({ msg: `Failed to download from '${downloadLink.downloadUrl}'`,  ex });
          process.exitCode = 1;
        }
      }
      await downloader.destroy();
      // logger.debug({ msg: `Removing torrent`,  torrentInfo });
      // await debridLinkClient.removeTorrent(torrentInfo.id);      
    }
    logger.info(`Processed '${target}'`);
    process.exit();
  }
  catch (ex) {
    logger.info(`Couldn't process '${target}'`);
    logger.error(ex);
    process.exit(1);
  }
})();