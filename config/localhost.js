export const config = {
  github: {
    accessToken: process.env.GITHUB_ACCESS_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET
  },
  port: process.env.PORT || 8800,
  taskGraphPath: 'taskgraph.json',
  taskcluster: {
    clientId:    process.env.TASKCLUSTER_CLIENT_ID,
    accessToken: process.env.TASKCLUSTER_ACCESS_TOKEN
  },
};
