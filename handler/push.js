import Debug from 'debug';
import denodeify from 'denodeify';
import _ from 'lodash';
import GraphFactory from 'taskcluster-task-factory/graph';
import jsTemplate from 'json-templater/object';
import slugid from 'slugid';
import { getContent } from '../lib/github';
import { encryptEnvVariables } from '../lib/encrypt_env_variables';
import { DEFAULT_TASK } from '../config/default_task';

let debug = Debug('docker-worker-ci:handler:push');

const FAKE_DOMAIN = 'github.taskcluster.net';
const GITHUB_CONTENT_URL = 'https://raw.githubusercontent.com';

export default async function(runtime, pushEvent, reply) {
  const TASKGRAPH_PATH = runtime.config.taskGraphPath;
  const BRANCHES = runtime.config.github.watchedBranches.split(',');
  let repository = pushEvent.repository;
  let branch = pushEvent.ref.split('/').pop();

  if (!repository || !branch) {
    return reply('Invalid push format missing branch or repository').code(400);
  }

  // we get push notifications for branches, etc.. we only care about incoming
  // commits with new data.x
  if (!pushEvent.commits || !pushEvent.commits.length) {
    return reply('No commits to take action on').code(200);
  }

  if (BRANCHES.indexOf(branch) === -1) {
    // Return successful even though nothing could be done.  Nothing is wrong
    // with the request, it's just not a configured branch
    return reply('Unsupported branch').code(200);
  }

  let username = repository.owner.name;
  let repoName = repository.name;
  let commit = String(pushEvent.head_commit.id);
  let owner = `${pushEvent.pusher.name}@${FAKE_DOMAIN}`;
  let source = `${GITHUB_CONTENT_URL}/${username}/${repoName}/${branch}/${TASKGRAPH_PATH}`;

  let graph = await getContent(runtime, username, repoName, branch, TASKGRAPH_PATH);
  graph = JSON.parse(graph);
  debug(`Fetched graph`);

  let params = {
    // Base repository details...
    githubPullRequestNumber: '0',
    githubBaseRepo: repository.name,
    githubBaseUser: repository.owner.name,
    githubBaseRevision: commit,
    githubBaseBranch: branch,

    // Head repository details are the same as base for push.
    githubHeadRepo: repository.name,
    githubHeadUser: repository.owner.name,
    githubHeadRevision: commit,
    githubHeadBranch: branch,
  };

  graph = _.merge(
    {
      scopes: [
        '*'
      ],
      metadata: {
        owner: owner,
        source: source
      },
    },
    graph
  );

  graph.tasks = graph.tasks.map((task) => {
    task = _.merge(
      {
        task: {
          metadata: {
            owner: owner,
            source: source
          }
        }
      },
      task,
      { task: DEFAULT_TASK }
    );

    task.task.routes = task.task.routes || [];
    task.task.scopes = task.task.scopes || [];

    return task;
  });

  debug(JSON.stringify(graph, null, 4));

  graph = GraphFactory.create(jsTemplate(graph, params));

  let createdTasks = [];
  let credentials = {
    'TASKCLUSTER_ACCESS_TOKEN': runtime.config.taskcluster.accessToken,
    'TASKCLUSTER_CLIENT_ID': runtime.config.taskcluster.clientId,
    'PULSE_USERNAME': runtime.config.pulse.username,
    'PULSE_PASSWORD': runtime.config.pulse.password
  };
  graph.tasks = await Promise.all(graph.tasks.map(async (task) => {
    let taskId = slugid.v4();
    task.taskId = taskId;
    createdTasks.push(taskId);
    task.task.payload['encryptedEnv'] = await encryptEnvVariables(
      task, credentials, runtime.config.publicKeyUrl
    );
    return task;
  }));

  let graphId = slugid.v4();
  debug('create graph', {
    id: graphId,
    graph: JSON.stringify(graph)
  });

  var graphStatus = await runtime.scheduler.createTaskGraph(graphId, graph);

  let body = {
    taskGraphId: graphId,
    taskIds: createdTasks,
  };

  return reply(body).code(201);
}
