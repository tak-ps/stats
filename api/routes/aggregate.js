import Err from '@openaddresses/batch-error';
import Field from '../lib/types/field.js';
import Auth from '../lib/auth.js';

export default async function router(schema, config) {
    await schema.get('/aggregate/:aggregate', {
        name: 'Get Aggregates',
        group: 'Aggregate',
        auth: 'public',
        description: 'Retrieve aggregates for a given time range',
        ':aggregate': 'string',
        res: 'res.Aggregate.json'
    }, async (req, res) => {
        try {
            await Auth.is_auth(req);

            const agg = await Field.aggregate(config.pool, req.params.aggregate);

            return res.json(agg);
        } catch (err) {
            return Err.respond(err, res);
        }
    });
}
