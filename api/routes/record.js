import Err from '@openaddresses/batch-error';
import moment from 'moment';
import Total from '../lib/types/total.js';
import Field from '../lib/types/field.js';
import Auth from '../lib/auth.js';

export default async function router(schema, config) {
    await schema.post('/record', {
        name: 'Record Stats',
        group: 'Record',
        auth: 'user',
        description: 'The daily ETL process will push updates to this endpoint',
        body: 'req.body.Record.json',
        res: 'res.Standard.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            if (req.auth.access !== 'machine') {
                throw new Err(401, null, 'Unauthorized');
            }

            const dt = req.body.date || moment().format('YYYY-MM-DD');
            delete req.body.date;

            await Total.generate(config.pool, {
                dt,
                count: req.body.count
            });
            delete req.body.count;

            for (const field in req.body) {
                await Field.generate(config.pool, {
                    dt,
                    dim: field,
                    stats: req.body[field]
                });
            }

            return res.json({
                status: 200,
                message: 'Recorded Stats'
            });
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
