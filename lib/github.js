import denodeify from 'denodeify';
import Debug from 'debug';

let debug = Debug('docker-worker-ci:github');
const SLEEP = 1000;
const MAX_RETRIES = 2;

export async function addComment(runtime, user, repo, number, comment) {
  let addComment = denodeify(runtime.github.issues.createComment.bind(runtime.github.issues));
  await addComment({
    body: comment,
    user: user,
    repo: repo,
    number: number,
    token: runtime.config.github.accessToken
  });
}

export async function getContent(runtime, user, repo, ref, path) {
  let getContent = denodeify(runtime.github.repos.getContent.bind(runtime.github.repos));
  let content = await getContent({
    user: user,
    repo: repo,
    path: path,
    ref: ref
  });

  var buffer = new Buffer(content.content, 'base64');
  return buffer.toString();
}

export async function getPullRequestContent(runtime, pullRequest, path) {
  let getReference = denodeify(runtime.github.gitdata.getReference.bind(runtime.github.gitdata));
  let getCommits = denodeify(runtime.github.repos.getCommits.bind(runtime.github.repos));
  let targetSha = pullRequest.head.sha;
  let refString = `pull/${pullRequest.number}/merge`;
  let user = pullRequest.base.user.login;
  let repo = pullRequest.base.repo.name;
  debug(
    'Fetching graph from repository',
    pullRequest.head.user.login,
    pullRequest.head.repo.name,
    refString
  );

  let retry = 0;
  let commit;
  while (retry++ < MAX_RETRIES) {
    let potentialCommit;
    try {
      potentialCommit = await getReference({
        user  : user,
        repo  : repo,
        ref   : refString
      });
    }
    catch (e) {
      debug('caught');
      debug(e);
      if (!e.status || e.status != 404) throw e;
    }
    debug(potentialCommit);

    if (!potentialCommit) {
      debug('no commit');
      await new Promise((accept) => setTimeout(accept, SLEEP));
      continue;
    }

    let commitList = await getCommits({
      user  : user,
      repo  : repo,
      sha   : potentialCommit.object.sha
    });

    for (let commitEntry of commitList) {
      if (commitEntry.sha === targetSha) {
        commit = potentialCommit.object.sha;
        break;
      }
    }

    if (commit) break;

    debug(`Sha found for fetch ref "${refString}" but commits are out of date`);
    await new Promise((accept) => setTimeout(accept, SLEEP));
  }

  if (!commit) {
    throw new Error(`Timed out while attempting to fetch ref ${refString}`);
  }

  return await getContent(runtime, user, repo, commit, path);
}
