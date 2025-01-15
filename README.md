# debrid-link-client
 A torrent blackhole using Debrid-Link as client.
 
 **Please respect the law, don't use this software to download materials you don't have the rights for.**

## Config
Configuration via env variables (see `docker-compose.yml` ):
| Key | Description |
| --- | --- |
| DEBRID_LINK_CLIENT_ID | Your Debrid-Link.com client's ID. Get it from https://debrid-link.fr/webapp/account/apps (Device code flow) |
| SMTP_HOST | SMTP host |
| SMTP_PORT | SMTP TLS port |
| SMTP_USER | SMTP user |
| SMTP_PASS | SMTP pass |
| MAIL_FROM | The sending email address |
| MAIL_TO | The receiving email address |
| BLACKHOLE | A directory where to pick up .torrent or .magnet files from (overrides DATA) |
| DOWNLOADS | A directory where the completed media will be moved to (overrides DATA) |
| IN_PROGESS | A directory where the media are being downloaded, before being moved to DOWNLOADS. (overrides DATA, default = BLACKHOLE + /in-progress)|
| DATA | A single root directory containing BLACKHOLE, DOWNLOADS and IN_PROGESS* such as |
| DOWNLOADER | The downloader to use (see below) |
| LOG_LEVEL | A [pino](https://github.com/pinojs/pino) log level |
| ARIA2_HOST | (For Aria2 downloader) The Aria2 server host |
| ARIA2_PORT | (For Aria2 downloader) The Aria2 server port |
| ARIA2_PATH | (For Aria2 downloader) The Aria2 server json rpc path |
| ARIA2_SECURE | (For Aria2 downloader) true for https, false otherwise |
| ARIA2_SECRET | (For Aria2 downloader) The Aria2 server rpc secret |

This application uses the `device code` flow of Debrid-Link for authentication. The code is sent by email using SMTP -- TLS ONLY.

\* The DATA folders structure is a shortcut for the following config:
- BLACKHOLE = DATA + /torrents
- IN_PROGESS = DATA + /torrents/in-progress
- DOWNLOADS = DATA + /downloads

## Downloaders
The app features 3 downloader:
- Aria2: (prefered) delegates the download process to an [Aria2](https://aria2.github.io/) server
- Fetch: uses internal NodeJS fetch api (no resume, no download throttling, ...)
- none specified: will output the Debrid-Link unrestricted links so they can be piped down (set LOG_LEVEL to silent)