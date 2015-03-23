import Debug from 'debug';

let debug = Debug('docker-worker-ci:handler:pullRequest');

const TASKGRAPH_PATH = 'taskgraph_pull.json';

function getDefaultTask() {
  return {
    provisionerId: 'aws-provisioner',
    workerType: 'worker-ci-tests',
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
        GITHUB_PULL_REQUEST: '{{githubPullNumber}}',

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

export default async function(runtime, pullRequestEvent, reply) {
  /*
   * find taskgraph.json at the repo (repo.full_name)
   * subsittute things for github repo, version, and tag "created for"
   */
  return reply('hi from push').code(200);
}
