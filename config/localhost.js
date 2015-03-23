export const config = {
  githubSecret: process.env.GITHUB_SECRET,
  port: process.env.PORT || 8800,
  taskGraphPath: 'taskgraph.json',
  taskcluster: {
    clientId:    process.env.TASKCLUSTER_CLIENT_ID,
    accessToken: process.env.TASKCLUSTER_ACCESS_TOKEN
  },
};

