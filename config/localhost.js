export const config = {
  port: process.env.PORT || 8800,
  publicKeyUrl: 'http://references.taskcluster.net/docker-worker/v1/docker-worker-pub.pem',
  github: {
    accessToken: process.env.GITHUB_ACCESS_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET
  },
  taskGraphPath: 'taskgraph.json',
  taskcluster: {
    clientId:    process.env.TASKCLUSTER_CLIENT_ID,
    accessToken: process.env.TASKCLUSTER_ACCESS_TOKEN
  },
  pulse: {
    username: process.env.PULSE_USERNAME,
    password: process.env.PULSE_PASSWORD
  }
};
