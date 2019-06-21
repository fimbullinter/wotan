import * as parseGithubUrl from 'github-url-to-object';
import * as Github from '@octokit/rest';
import { getLastReleaseTag, getRootPackage, getChangeLogForVersion } from './util';

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

const ghClient = new Github();
ghClient.authenticate({
    type: 'oauth',
    token: process.env.GITHUB_TOKEN,
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
})().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
