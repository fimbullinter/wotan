import * as fs from 'fs';
import * as parseGithubUrl from 'github-url-to-object';
import * as Github  from '@octokit/rest';

if (!process.env.GITHUB_TOKEN) {
    console.error('Missing environment variable GITHUB_TOKEN');
    throw process.exit(1);
}

const content = fs.readFileSync('./CHANGELOG.md', 'utf8');
const re = /^## (v\d+\.\d+\.\d+)$/mg;
const startMatch = re.exec(content)!;
const start = startMatch.index + startMatch[0].length;
const end = re.exec(content)!.index;
const body = content.substring(start, end).trim();
const tag = startMatch[1];
const { user, repo } = parseGithubUrl(require(process.cwd() + '/package.json').repository)!;

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
