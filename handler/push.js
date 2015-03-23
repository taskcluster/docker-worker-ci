import Debug from 'debug';
import denodeify from 'denodeify';
import _ from 'lodash';
import GraphFactory from 'taskcluster-task-factory/graph';
import jsTemplate from 'json-templater/object';
import slugid from 'slugid';

let debug = Debug('docker-worker-ci:handler:push');

const TASKGRAPH_PATH = 'taskgraph_push.json';
const FAKE_DOMAIN = 'github.taskcluster.net';
const GITHUB_CONTENT_URL = 'https://raw.githubusercontent.com';

function getDefaultTask() {
  return {
    provisionerId: 'aws-provisioner',
    retries: 1,
    extra: {
      github: {
        baseUser: '{{githubBaseUser}}',
        baseRepo: '{{githubBaseRepo}}',
        baseRevision: '{{githubBaseRevision}}',
        baseBranch: '{{githubBaseBranch}}',

        headUser: '{{githubHeadUser}}',
        headRepo: '{{githubHeadRepo}}',
        headRevision: '{{githubBaseRevision}}}',
        headBranch: '{{githubHeadBranch}}',
      }
    },
    metadata: {},
    payload: {
      env: {
        CI: true,
        GITHUB_PULL_REQUEST: '0',

        // Base details
        GITHUB_BASE_REPO: '{{githubBaseRepo}}',
        GITHUB_BASE_USER: '{{githubBaseUser}}',
        GITHUB_BASE_GIT: 'https://github.com/{{githubBaseUser}}/{{githubBaseRepo}}',
        GITHUB_BASE_REV: '{{githubBaseRevision}}',
        GITHUB_BASE_BRANCH: '{{githubBaseBranch}}',

        // Head details
        GITHUB_HEAD_REPO: '{{githubHeadRepo}}',
        GITHUB_HEAD_USER: '{{githubHeadUser}}',
        GITHUB_HEAD_GIT: 'https://github.com/{{githubHeadUser}}/{{githubHeadRepo}}',
        GITHUB_HEAD_REV: '{{githubHeadRevision}}',
        GITHUB_HEAD_BRANCH: '{{githubHeadBranch}}',
      },
      maxRunTime: 7200,
      features: {}
    }
  };
}

export default async function(runtime, pushEvent, reply) {
  /*
   * find taskgraph.json at the repo (repo.full_name)
   * subsittute things for github repo, version, and tag "created for"
   */
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

  let username = repository.owner.name;
  let repoName = repository.name;
  let commit = String(pushEvent.head_commit.id);
  let owner = `${pushEvent.pusher.name}@${FAKE_DOMAIN}`;
  let source = `${GITHUB_CONTENT_URL}/${username}/${repoName}/${branch}/${TASKGRAPH_PATH}`;

  let fetchGraph = denodeify(runtime.github.repos.getContent.bind(runtime.github.repos));
  let content = await fetchGraph({
    user: username,
    repo: repoName,
    path: TASKGRAPH_PATH,
    ref: branch
  });

  var buffer = new Buffer(content.content, 'base64');
  let graph = buffer.toString();
  graph = JSON.parse(graph);

  debug(`Fetched graph`);

  let params = {
    // Base repository details...
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
      { task: getDefaultTask() }
    );

    task.task.routes = task.task.routes || [];
    task.task.scopes = task.task.scopes || [];

    return task;
  });

  debug(JSON.stringify(graph, null, 4));

  graph = GraphFactory.create(jsTemplate(graph, params));

  graph.tasks = graph.tasks.map(function(task) {
    task.taskId = slugid.v4();
    return task;
  });

  let createdTasks = graph.tasks.map((task) => {
    return task.taskId;
  });

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
