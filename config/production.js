export const config = {
  github: {
    accessToken: process.env.GITHUB_ACCESS_TOKEN
  },
  port: process.env.PORT || 80,
  taskGraphPath: 'taskgraph.json',
  taskcluster: {
    clientId:    process.env.TASKCLUSTER_CLIENT_ID,
    accessToken: process.env.TASKCLUSTER_ACCESS_TOKEN
  },
};
