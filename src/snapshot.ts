// Copyright (c) Wictor Wilén. All rights reserved. 
// Licensed under the MIT license.

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { RingApi } from 'ring-client-api'
import * as path from 'path'
import * as dotenv from "dotenv";
import * as lodash from "lodash";
import { readFileSync } from 'fs'
import * as https from 'https'

const log = console.log;

const targetDir = path.resolve(__dirname, "target");
// Stored in the mounted volume so rotated tokens survive across runs and container restarts
const tokenFile = path.resolve(targetDir, ".ring-token.json");

// Use the last rotated token, unless TOKEN has been changed since (i.e. a new token was generated)
const loadToken = (): string => {
    const envToken = process.env.TOKEN as string;
    if (existsSync(tokenFile)) {
        const stored = JSON.parse(readFileSync(tokenFile).toString());
        if (stored.seed == envToken) {
            return stored.token;
        }
        log('TOKEN has changed since the stored token was saved, using TOKEN');
    }
    return envToken;
}

const reportToNewRelic = (attributes: { [key: string]: string | number }): Promise<void> => {
    const accountId = process.env.NEW_RELIC_ACCOUNT_ID;
    const licenseKey = process.env.NEW_RELIC_LICENSE_KEY;
    if (!accountId || !licenseKey) {
        return Promise.resolve();
    }
    const host = (process.env.NEW_RELIC_REGION || "").toUpperCase() == "EU" ?
        "insights-collector.eu01.nr-data.net" : "insights-collector.newrelic.com";
    const body = JSON.stringify([{ eventType: "RingTimelapseSnapshot", ...attributes }]);

    return new Promise(resolve => {
        const req = https.request({
            host,
            path: `/v1/accounts/${accountId}/events`,
            method: "POST",
            headers: { "Api-Key": licenseKey, "Content-Type": "application/json" },
            timeout: 10000
        }, res => {
            if (res.statusCode != 200) {
                log(`New Relic event failed with status ${res.statusCode}`);
            }
            res.resume();
            res.on("end", resolve);
        });
        req.on("timeout", () => req.destroy(new Error("timeout")));
        req.on("error", err => {
            log(`New Relic event failed: ${err}`);
            resolve();
        });
        req.end(body);
    });
}


const snapshot = async (): Promise<{ cameras: number, saved: number, errors: string[] }> => {
    log("running snapshot")

    if (!existsSync(targetDir)) {
        log("creating target");
        mkdirSync(targetDir);
    }

    const ringApi = new RingApi({
        refreshToken: loadToken(),
        debug: true // false
    });
    
    // Ring rotates refresh tokens, so persist each new one or the next run will use an expired token
    ringApi.onRefreshTokenUpdated.subscribe(
        ({ newRefreshToken }) => {
            log('Refresh token updated, saving to ' + tokenFile)
            writeFileSync(tokenFile, JSON.stringify({ seed: process.env.TOKEN, token: newRefreshToken }));
        }
    )

    const cameras = await ringApi.getCameras();
    const errors: string[] = [];
    let saved = 0;

    for (const camera of cameras) {
        // cameras.forEach(async camera => {
        const name = lodash.camelCase(camera.name);
        log(`Retrieving snapshot for ${camera.name}`);
        try {
            const result = await camera.getSnapshot();

            log((path.resolve(__dirname, "target", name)));
            if (!existsSync(path.resolve(__dirname, "target", name))) {
                mkdirSync(path.resolve(__dirname, "target", name));
            }
            writeFileSync(path.resolve(__dirname, "target", path.join(name, Date.now() + '.png')), result, );
            log(`Snapshot for ${camera.name} saved`);
            saved++;

        }
        catch (err) {
            log(`Snapshot error: ${err}`);
            errors.push(`${camera.name}: ${err}`);
        }
    

    };
    return { cameras: cameras.length, saved, errors };
}

dotenv.config();

snapshot() .then(async result => {
    log("done");
    const failed = result.errors.length > 0 || result.cameras == 0;
    await reportToNewRelic({
        status: failed ? "failure" : "success",
        cameras: result.cameras,
        snapshotsSaved: result.saved,
        error: result.errors.join("; ")
    });
    process.exit(failed ? 1 : 0);
})
.catch(async err => {
    log(err)
    await reportToNewRelic({ status: "failure", error: `${err}` });
    process.exit(1);
});