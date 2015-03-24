import taskcluster from 'taskcluster-client';
import GithubAPI from 'github';

export default function(profile) {
  let runtime = {
    config: require(`../config/${profile}`).config,
  };
  runtime.scheduler = new taskcluster.Scheduler(runtime.config.taskcluster);
  runtime.github = new GithubAPI({
    version: '3.0.0',
    debug: true,
    protocol: 'https',
    timeout: 5000
  });

  runtime.github.authenticate({
    type: "oauth",
    token: runtime.config.github.accessToken
  });
  return runtime;
}
