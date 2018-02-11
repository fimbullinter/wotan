import * as fs from 'fs';
import * as cp from 'child_process';

interface Dependencies {
    [name: string]: string;
}

interface PackageData {
    name: string;
    version: string;
    private?: boolean;
    dependencies?: Dependencies;
    devDependencies?: Dependencies;
    peerDependencies?: Dependencies;
}

const currentDate = new Date();
const version = // tslint:disable-next-line
    `${require('../package.json').version}-dev.${currentDate.getFullYear() * 10000 + (currentDate.getMonth() + 1) * 100 + currentDate.getDate()}`;

const packages = new Map(
    fs.readdirSync('packages').map((name): [string, PackageData] => {
        return [name, require(`../packages/${name}/package.json`)];
    }),
);
const publicPackages = new Map(Array.from(packages).filter((v) => !v[1].private));

const changed = new Set<string>();
function markChanged(name: string) {
    if (changed.has(name))
        return;
    changed.add(name);
    const manifest = packages.get(name)!;
    manifest.version = version;
    for (const [k, v] of publicPackages) {
        if (v.dependencies && v.dependencies[manifest.name]) {
            v.dependencies[manifest.name] = version;
            markChanged(k);
        }
        if (v.peerDependencies && v.peerDependencies[manifest.name]) {
            v.peerDependencies[manifest.name] = version;
            markChanged(k);
        }
    }
}

const commits = process.env.TRAVIS_COMMIT_RANGE!.split('...');
const lastReleaseTag = cp.execSync('git describe --tags --match=v*.*.* --abbrev=0', {encoding: 'utf8'}).trim();
console.log('last release tag', lastReleaseTag);
// if there was a release since the last nightly, only get the diff since the release
const diffStart = cp.execSync(`git rev-list ${lastReleaseTag}...${commits[0]}`, {encoding: 'utf8'}).split(/\r?\n/)[0];
console.log('newest release', diffStart);

const diff = cp.execSync(
    `git diff ${diffStart} --name-only -- packages/${Array.from(publicPackages.keys()).join(' packages/')}`,
    {encoding: 'utf8'},
).trim();
if (diff !== '')
    for (const file of diff.split(/\r?\n/))
        markChanged(file.split(/[/\\]/)[1]);

for (const name of changed) {
    fs.writeFileSync(`packages/${name}/package.json`, JSON.stringify(publicPackages.get(name), undefined, 2) + '\n');
    cp.exec(`npm publish packages/${name} --tag next`);
}
