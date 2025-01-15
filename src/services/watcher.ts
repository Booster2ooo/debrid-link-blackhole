import { EventEmitter } from 'events';
import { readdir, stat } from 'fs/promises';
import { resolve  } from 'path';

export class Watcher extends EventEmitter {
  readonly #handle: NodeJS.Timeout | undefined;
  #previousList: Set<string> = new Set<string>();

  constructor(
    private readonly directory: string,
    interval: number = 1000
  ) {
    super();
    this.#refresh();
    this.#handle = setInterval(async () => {
      await this.#refresh();
    }, interval);
  }

  async #refresh() {
    const directoryContent = await readdir(this.directory);
    const torrentOrMagnets = new Set<string>();
    for(const item of directoryContent) {
      if (!item.endsWith('.torrent') && !item.endsWith('.magnet')) {
        continue;
      }
      const { isFile } = await stat(resolve(this.directory, item));
      if (!isFile) {
        continue;
      }
      torrentOrMagnets.add(item);
      if (!this.#previousList.has(item)) {
        this.emit('add', resolve(this.directory, item));
      }
    }
    this.#previousList = torrentOrMagnets;
  }

  close() {
    if (this.#handle) {
      clearInterval(this.#handle);
    }
  }

}