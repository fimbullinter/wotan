import * as cp from 'child_process';
import {
    getLastReleaseTag,
    getPackages,
    getChangedPackageNames,
    writeManifest,
    execAndLog,
    ensureCleanTree,
    sortPackagesForPublishing,
    getRootPackage,
} from './util';

if (process.argv.length < 3) {
    console.log('Usage: node scripts/nightly <rev> [<options>...]');
    throw process.exit(1);
}

const {packages, publicPackages} = getPackages();

ensureCleanTree(Array.from(publicPackages.keys(), (p) => 'packages/' + p));

const currentDate = new Date();
const version =
    `${getRootPackage().nextVersion}-dev.${currentDate.getFullYear() * 10000 + (currentDate.getMonth() + 1) * 100 + currentDate.getDate()}`;

const needsRelease = new Set<string>();
function markForRelease(name: string) {
    if (needsRelease.has(name))
        return;
    needsRelease.add(name);
    const manifest = packages.get(name)!;
    manifest.version = version;
    updateDependency(manifest.name, version, markForRelease);
}
function updateDependency(name: string, newVersion: string, onchange: (name: string) => void) {
    for (const [k, v] of publicPackages) {
        if (v.dependencies && v.dependencies[name]) {
            v.dependencies[name] = newVersion;
            onchange(k);
        }
        if (v.peerDependencies && v.peerDependencies[name]) {
            v.peerDependencies[name] = newVersion;
            onchange(k);
        }
    }
}
/** Update dependency of public packages that are not published today to the latest nightly (or stable) version. */
function updatePublicPackageDependencies() {
    for (const [name, manifest] of publicPackages) {
        if (needsRelease.has(name))
            continue; // this dependency will be released and is therefore already updated in all packages
        const lastNightlyVersion = cp.execSync(`npm info ${manifest.name}@next version`, {encoding: 'utf8'}).trim();
        updateDependency(manifest.name, lastNightlyVersion, () => {});
    }
}

const lastNightly = process.argv[2]; // revision of the last nightly
const [lastReleaseTag] = getLastReleaseTag();
console.log('last stable release tag', lastReleaseTag);
// if there was a release since the last nightly, only get the diff since that release
const diffStart = lastNightly && cp.execSync(`git rev-list ${lastReleaseTag}...${lastNightly}`, {encoding: 'utf8'}).split(/\r?\n/)[0]
    || lastReleaseTag;
console.log('releasing changes since', diffStart);

for (const name of getChangedPackageNames(diffStart, publicPackages.keys()))
    markForRelease(name);

if (needsRelease.size !== 0) {
    updatePublicPackageDependencies();
    for (const name of sortPackagesForPublishing(needsRelease, (p) => publicPackages.get(p)!)) {
        writeManifest(`packages/${name}/package.json`, publicPackages.get(name)!);
        execAndLog(`npm publish packages/${name}/ --tag next ${process.argv.slice(3).join(' ')}`);
    }
} else {
    console.log('nothing changed');
}
