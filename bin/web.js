import createServer from '../lib/webhook_server';

async () => {
  let profile = process.argv[2];
  if (!profile) { console.log('Must supply a profile'); process.exit(); };
  let server;
  try {
    server = await createServer(profile);
    server.start(() => console.log('server started'));
  }
  catch (e) {
    console.log(e.stack);
  }
}();
