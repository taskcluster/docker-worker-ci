# Docker-worker CI

Docker-worker CI is a continuous integration solution for testing docker-worker within taskcluster.

Docker-worker CI integrated between:

* Github - Listens for webhooks and comments on pull requests with taskcluster graph inspector links.
* Taskcluster - Publishes taskgraphs for pull requests.

When a github webhook contacts docker-worker CI, the taskgraph template will be pulled
from the head repo and used to construct the graph.  By default, this file is named `taskgraph.json`
and found within the root of the repo.

## Configuration

Several environment variables are used to build the configuration for docker-worker CI.

```
PORT=<port to listen on>
PUBLIC_KEY=<URL for docker-worker public key used for encrypted variables>
GITHUB_ACCESS_TOKEN=<access token for increase rate limits and commenting on pull requests>
GITHUB_WEBHOOK_SECRET=<secret so only approved repositories can use the webhook>
GITHUB_WATCHED_BRANCHES=<comma separated list of branches to watch for pushes>
TASKCLUSTER_CLIENT_ID=<client id used for creating task graphs and injecting as encrypted env variables for tasks>
TASKCLUSTER_ACCESS_TOKEN=<access token for taskcluster, also encrypted and injected into tasks>
PULSE_USERNAME=<used in tasks>
PULSE_PASSWORD=<used in tasks>
```

Taskcluster and Pulse credentials will be encrypted using the docker-worker public key
to be used with tests.  These crentials should be restricted to scopes only necessary for tests.

## Server

Docker-worker CI can be started by running

```
babel-node -r ./bin/web.js [localhost|production]
```

## Docker image

Docker-worker tests are run within a docker container that contains its own docker
daemon so it can create and manage containers used for tests.  These containers can only
be run within an environment that allows the docker container to run in privileged mode.

Docker image can be found under `docker/`
