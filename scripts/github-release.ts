import * as fs from 'fs';
import * as parseGithubUrl from 'github-url-to-object';
import * as Github from '@octokit/rest';
import { getLastReleaseTag, getRootPackage } from './util';

if (!process.env.GITHUB_TOKEN) {
    console.error('Missing environment variable GITHUB_TOKEN');
    throw process.exit(1);
}

const [tag, newerCommits] = getLastReleaseTag();
if (newerCommits !== 0) {
    console.error('Missing release tag on the current commit.');
    throw process.exit(1);
}
const content = fs.readFileSync('./CHANGELOG.md', 'utf8');
const re = /^## (v\d+\.\d+\.\d+(?:-\w+\.\d+)?)$/mg;
const startMatch = re.exec(content)!;
let body: string | undefined;
if (startMatch[1] !== tag) {
    console.log('No CHANGELOG entry for %s', tag);
} else {
    const start = startMatch.index + startMatch[0].length;
    const end = re.exec(content)!.index;
    body = content.substring(start, end).trim();
}
const { user, repo } = parseGithubUrl(getRootPackage().repository)!;

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
