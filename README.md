
# Ring Timelapse generator

A Docker container that periodically takes snapshots from your [Ring](https://www.ring.com) cameras and then creates timelapse videos of the snapshots.

[![Docker Image Version (tag latest semver)](https://img.shields.io/docker/v/wictorwilen/ring-timelapse/latest)](https://hub.docker.com/repository/docker/wictorwilen/ring-timelapse)
[![MIT License](https://img.shields.io/apm/l/atomic-design-ui.svg?)](https://github.com/wictorwilen/ring-timelapse/blob/main/LICENSE.md)

## Features

- Takes snapshots of all Ring cameras periodically, default 15 minutes
- Creates a timelapse video periodically, default every day
- Runs as a Docker container with minimal footprint

> **NOTE**: Taking snapshots often will drain the battery faster than normal.

## Installation

In order to run the Docker container you need a Ring refresh token.
To generate the token use the following command:

``` bash
npx -p ring-client-api ring-auth-cli
```

Use the following to pull the Docker container from Docker hub.

``` bash
docker pull wictorwilen/ring-timelapse
```

Before starting the container, create a directory that will be shared with the 
container to persist the snapshots and timelapses, for instance:

``` bash
cd /media
mkdir timelapse
```

Start the container by running:

``` bash
docker run \
  -d \
  -e TOKEN="<insert token here>" \
  -v "/media/timelapse:/app/dist/target" \
  --restart unless-stopped \
  wictorwilen/ring-timelapse
```

> **NOTE**: In the `-v` argument replace the local path (`/media/timelapse`) with the directory you created

## Environment Variables

The following variables are required:

`TOKEN` - your generated Ring token, see Installation

The following variables are optional:

`CRON_SCHEDULE` - Schedule for taking snapshots, in [Crontab format](https://linuxhandbook.com/crontab/). Default: `*/15 * * * *`

`CRON_SCHEDULE_TIMELAPSE` - Schedule for generating the timelapse video. Default: `0 7 * * *`

`NEW_RELIC_ACCOUNT_ID` and `NEW_RELIC_LICENSE_KEY` - when both are set, every snapshot run sends a `RingTimelapseSnapshot` custom event to New Relic with a `status` of `success` or `failure` (plus `error`, `cameras` and `snapshotsSaved`). The key must be an ingest license key.

`NEW_RELIC_REGION` - set to `EU` if your New Relic account is in the EU region.

## Refresh token

Ring rotates the refresh token as it is used. The latest token is saved to `.ring-token.json` in the mounted target directory, so it survives container restarts. If you generate a new token and change `TOKEN`, the new value takes precedence over the saved one.

## Authors

- [@wictorwilen](https://www.github.com/wictorwilen)
  
## License

[MIT](https://choosealicense.com/licenses/mit/)
