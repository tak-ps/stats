import fs from 'fs';
import path from 'path';
import cors from 'cors';
import express from 'express';
import minify from 'express-minify';
import history from 'connect-history-api-fallback';
import Schema from '@openaddresses/batch-schema';
import { Pool } from '@openaddresses/batch-generic';
import minimist from 'minimist';
import TileBase from 'tilebase';
import BlueprintLogin from '@tak-ps/blueprint-login';

import Config from './lib/config.js';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url)));

const args = minimist(process.argv, {
    boolean: ['help', 'silent'],
    string: ['postgres']
});

if (import.meta.url === `file://${process.argv[1]}`) {
    const config = Config.env(args);
    await server(config);
}

/**
 * @apiDefine user User
 *   A user must be logged in to use this endpoint
 */
/**
 * @apiDefine public Public
 *   This API endpoint does not require authentication
 */

export default async function server(config) {
    config.pool = await Pool.connect(process.env.POSTGRES || args.postgres || 'postgres://postgres@localhost:5432/tak_ps_stats', {
        schemas: {
            dir: new URL('./schema', import.meta.url)
        }
    });

    try {
        config.tb = new TileBase(config.TileBaseURL);
        await config.tb.open();
    } catch (err) {
        console.error(err);
        console.log('ok - Skipping TileBase');
    }

    const app = express();

    const schema = new Schema(express.Router(), {
        schemas: new URL('./schema', import.meta.url)
    });

    app.disable('x-powered-by');
    app.use(cors({
        origin: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }));

    app.use(minify());

    /**
     * @api {get} /api Get Metadata
     * @apiVersion 1.0.0
     * @apiName Server
     * @apiGroup Server
     * @apiPermission public
     *
     * @apiDescription
     *     Return basic metadata about server configuration
     *
     * @apiSchema {jsonschema=./schema/res.Server.json} apiSuccess
     */
    app.get('/api', (req, res) => {
        return res.json({
            version: pkg.version
        });
    });

    app.use('/api', schema.router);
    app.use('/docs', express.static('./doc'));

    await schema.api();

    await schema.blueprint(new BlueprintLogin({
        secret: config.SigningSecret,
        username: config.Username,
        password: config.Password
    }));

    await schema.load(
        new URL('./routes/', import.meta.url),
        config,
        {
            silent: !!config.silent
        }
    );
    schema.not_found();
    schema.error();

    fs.writeFileSync(new URL('./doc/api.js', import.meta.url), schema.docs.join('\n'));

    app.use(history({
        rewrites: [{
            from: /.*\/js\/.*$/,
            to: function(context) {
                return context.parsedUrl.pathname.replace(/.*\/js\//, '/js/');
            }
        },{
            from: /.*$/,
            to: function(context) {
                const parse = path.parse(context.parsedUrl.path);
                if (parse.ext) {
                    return context.parsedUrl.pathname;
                } else {
                    return '/';
                }
            }
        }]
    }));

    app.use(express.static('web/dist'));

    return new Promise((resolve, reject) => {
        const srv = app.listen(4999, (err) => {
            if (err) return reject(err);

            if (!config.silent) console.log('ok - http://localhost:4999');
            return resolve(srv);
        });
    });
}
