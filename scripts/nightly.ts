import * as cp from 'child_process';
import { getLastRelaseTag, getPackages, getChangedPackageNames, writeManifest, execAndLog } from './util';

if (process.argv.length < 3) {
    console.log('Usage: node scripts/nightly <rev> [<options>...]');
    process.exit(1);
}

const currentDate = new Date();
const version = // tslint:disable-next-line
    `${require('../package.json').version}-dev.${currentDate.getFullYear() * 10000 + (currentDate.getMonth() + 1) * 100 + currentDate.getDate()}`;

const {packages, publicPackages} = getPackages();

const needsRelease = new Set<string>();
function markForRelease(name: string) {
    if (needsRelease.has(name))
        return;
    needsRelease.add(name);
    const manifest = packages.get(name)!;
    manifest.version = version;
    for (const [k, v] of publicPackages) {
        if (v.dependencies && v.dependencies[manifest.name]) {
            v.dependencies[manifest.name] = version;
            markForRelease(k);
        }
        if (v.peerDependencies && v.peerDependencies[manifest.name]) {
            v.peerDependencies[manifest.name] = version;
            markForRelease(k);
        }
    }
}

const lastNightly = process.argv[2].split('..')[0]; // revision of the last nightly
console.log('last nightly release', lastNightly);
const lastReleaseTag = getLastRelaseTag();
console.log('last stable release tag', lastReleaseTag);
// if there was a release since the last nightly, only get the diff since that release
const diffStart = lastNightly
    ? cp.execSync(`git rev-list ${lastReleaseTag}...${lastNightly}`, {encoding: 'utf8'}).split(/\r?\n/)[0]
    : lastReleaseTag;
console.log('releasing changes since', diffStart);

for (const name of getChangedPackageNames(diffStart, publicPackages.keys()))
    markForRelease(name);

if (needsRelease.size !== 0) {
    for (const name of needsRelease) {
        writeManifest(`packages/${name}/package.json`, publicPackages.get(name)!);
        execAndLog(`npm publish packages/${name} --tag next ${process.argv.slice(3).join(' ')}`);
    }
} else {
    console.log('nothing changed');
}
