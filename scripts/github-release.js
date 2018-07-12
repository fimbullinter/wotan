// @ts-check
"use strict";
const fs = require("fs");
const parseGithubUrl = require("github-url-to-object");
const Github = require('@octokit/rest');

const content = fs.readFileSync('./CHANGELOG.md', 'utf8');
const re = /^## (v\d+\.\d+\.\d+)$/mg;
const startMatch = re.exec(content);
const start = startMatch.index + startMatch[0].length;
const end = re.exec(content).index;
const body = content.substring(start, end).trim();
const tag = startMatch[1];
const { user, repo } = parseGithubUrl(require(process.cwd() + '/package.json').repository);

const ghClient = new Github();
ghClient.authenticate({
    type: 'oauth',
    token: process.env.GITHUB_TOKEN,
});

(async () => {
    console.log('Logged into GitHub as', (await ghClient.users.get({})).data.login);
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
});;
