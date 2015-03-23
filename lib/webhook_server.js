import Hapi from 'hapi';
import Debug from 'debug';
import runtime from './runtime';

let debug = Debug('docker-worker-ci:githubWebhook');

const GITHUB_EVENTS = {
  'push': require('../handler/push.js'),
  'pull_request': require('../handler/pull_request.js')
};

export default async function createServer(profile) {
  let server = new Hapi.Server();
  try {
    server.app.runtime = runtime(profile);
  }
  catch (e) {
    console.log(`Could not create server configuration. ${e}`);
    process.exit();
  }
  server.connection({ port: parseInt(server.app.runtime.config.port) });

  server.route([
    {
      method:   'GET',
      path:     '/',
      handler:  (request, reply) => { reply('Server running'); }
    },
    {
      method:   'POST',
      path:     '/github',
      handler:  async (request, reply) => {
        let eventType = request.headers['x-github-event'];
        let githubEvent = request.payload;
        debug(`Recevied ${eventType} event for ${githubEvent.repository.full_name}`);

        if (!(eventType in GITHUB_EVENTS)) {
          let message = `Cannot handle ${eventType} event`;
          debug(message);
          return reply(message).code(400);
        }

        try {
          return await GITHUB_EVENTS[eventType](
            server.app.runtime, githubEvent, reply
          );
        }
        catch (e) {
          debug(`Error caught: ${e}`);
          return reply('Server error').code(500);
        }

      }
    }
  ]);
  return server
}
