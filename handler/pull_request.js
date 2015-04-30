import _ from 'lodash';
import GraphFactory from 'taskcluster-task-factory/graph';
import jsTemplate from 'json-templater/object';
import slugid from 'slugid';
import Debug from 'debug';
import { getPullRequestContent, addComment } from '../lib/github';
import { DEFAULT_TASK } from '../config/default_task';
import { encryptEnvVariables } from '../lib/encrypt_env_variables';

let debug = Debug('docker-worker-ci:handler:pullRequest');

const TASKGRAPH_INSPECTOR = 'http://docs.taskcluster.net/tools/task-graph-inspector';
const FAKE_DOMAIN = 'github.taskcluster.net';
const GITHUB_CONTENT_URL = 'https://raw.githubusercontent.com';
const PULL_ACTIONS = ['opened', 'reopened', 'synchronize'];

export default async function(runtime, pullRequestEvent, reply) {
  if (PULL_ACTIONS.indexOf(pullRequestEvent.action) === -1) {
    // TODO use new cancel endpoint for closed/updated PR's
    return reply('Pull Request action not supported.  No action taken.').code(200);
  }

  const TASKGRAPH_PATH = runtime.config.taskGraphPath;

  let repository = pullRequestEvent.repository;
  let pullRequest = pullRequestEvent.pull_request;
  let commit = String(pullRequest.head.sha);

  let graph = await getPullRequestContent(runtime, pullRequest, TASKGRAPH_PATH);
  graph = JSON.parse(graph);
  debug(`Fetched graph`);

  let params = {
    // Base repository details...
    githubPullRequestNumber: pullRequestEvent.number,
    githubBaseRepo: repository.name,
    githubBaseUser: repository.owner.login,
    githubBaseRevision: pullRequest.base.sha,
    githubBaseBranch: pullRequest.base.ref,


    // Head repository details are the same as base for push.
    githubHeadUser: pullRequest.head.user.login,
    githubHeadRepo: pullRequest.head.repo.name,
    githubHeadRevision: commit,
    githubHeadBranch: pullRequest.head.ref,
  };

  let owner = `${pullRequest.user.login}@${FAKE_DOMAIN}`;
  let source = `${GITHUB_CONTENT_URL}/${pullRequest.head.repo.full_name}/` +
               `${pullRequest.head.ref}/${TASKGRAPH_PATH}`;

  let scopes = [
    'queue:create-task:aws-provisioner-v1/worker-ci-test',
    'queue:define-task:aws-provisioner-v1/worker-ci-test'
  ];

  graph.tasks.forEach((task) => {
    let scopes = task.task.scopes || [];
    scopes.forEach(scopes.push);
  });

  graph = _.merge(
    {
      scopes: scopes,
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

  let graphStatus = await runtime.scheduler.createTaskGraph(graphId, graph);
  let prComment = `Taskcluster graph created. ${TASKGRAPH_INSPECTOR}/#${graphId}`;
  await addComment(runtime, repository.owner.login, repository.name, pullRequestEvent.number, prComment);

  let body = {
    taskGraphId: graphId,
    taskIds: createdTasks,
  };

  return reply(body).code(201);
}
