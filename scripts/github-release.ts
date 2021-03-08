import * as parseGithubUrl from 'github-url-to-object';
import { Octokit } from '@octokit/rest';
import { getLastReleaseTag, getRootPackage, getChangeLogForVersion, getObjectIds } from './util';
import { fixedIssues } from './fixed-issues';

if (!process.env.GITHUB_TOKEN) {
    console.error('Missing environment variable GITHUB_TOKEN');
    throw process.exit(1);
}

const [tag, newerCommits] = getLastReleaseTag();
if (newerCommits !== 0) {
    console.error('Missing release tag on the current commit.');
    throw process.exit(1);
}
const rootManifest = getRootPackage();
if (tag !== 'v' + rootManifest.version) {
    console.error('Git tag and version in package.json are different.');
    throw process.exit(1);
}
const body = getChangeLogForVersion(rootManifest.version);
const { user, repo } = parseGithubUrl(rootManifest.repository)!;

const ghClient = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

(async () => {
    console.log('Logged into GitHub as', (await ghClient.users.getAuthenticated({})).data.login);
    const release = await ghClient.repos.createRelease({
        repo,
        body,
        owner: user,
        name: tag,
        tag_name: tag,
    });
    console.log('Created GitHub release %s at %s', release.data.name, release.data.html_url);

    const previousReleaseTag = getLastReleaseTag(`${tag}^`)[0];
    const [currentReleaseOid, previousReleaseOid] = getObjectIds(tag, previousReleaseTag);
    const commentBody = `:tada: This issue has been resolved in version [${tag}](${release.data.html_url}) :tada:`;
    for await (const issueNumber of fixedIssues(user, repo, ghClient.request, currentReleaseOid, previousReleaseOid)) {
        console.log('Posting comment on issue #%d', issueNumber);
        await ghClient.issues.createComment({
            repo,
            issue_number: issueNumber,
            owner: user,
            body: commentBody,
        });
    }
})().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
