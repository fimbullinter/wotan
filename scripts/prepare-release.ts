import {
    getPackages,
    getChangedPackageNames,
    getLastReleaseTag,
    PackageData,
    writeManifest,
    execAndLog,
    ensureBranch,
    ensureCleanTree,
    Dependencies,
} from './util';
import * as semver from 'semver';

ensureBranch('master');
ensureCleanTree(undefined, ['CHANGELOG.md']);

execAndLog('yarn');
execAndLog('yarn verify');
ensureCleanTree(undefined, ['CHANGELOG.md', 'yarn.lock']);

const rootManifest = require('../package.json');
const releaseVersion = rootManifest.version;
const version = new semver.SemVer(releaseVersion);
const isMajor = version.minor === 0 && version.patch === 0 && version.prerelease.length === 0 && version.build.length === 0;

const {packages} = getPackages();

const changedPackages = isMajor ? new Set<string>(packages.keys()) : getChangedPackageNames(getLastReleaseTag(), packages.keys());
const needsRelease = new Set<string>();

function markForRelease(name: string) {
    if (needsRelease.has(name))
        return;
    needsRelease.add(name);
    updateManifest(rootManifest);
    for (const [localName, manifest] of packages)
        if (updateManifest(manifest))
            markForRelease(localName);
}

function updateManifest(manifest: PackageData): boolean {
    let updated = false;
    for (const localName of packages.keys()) {
        const changed = changedPackages.has(localName);
        if (!changed && !needsRelease.has(localName))
            continue;
        const {name} = packages.get(localName)!;
        update(manifest.dependencies, name, changed);
        update(manifest.peerDependencies, name, changed);
    }
    return updated;

    function update(dependencies: Dependencies | undefined, name: string, changed: boolean) {
        if (!dependencies || !dependencies[name])
            return;
        const range = new semver.Range(dependencies[name]);
        // make sure to publish a new version of a dependent package if the updated dependency wouldn't satisfy the constraint
        if (changed || !semver.satisfies(version, range)) {
            dependencies[name] = `^${releaseVersion}`;
            updated = true;
        }
    }
}

for (const name of changedPackages)
    markForRelease(name);

rootManifest.version = semver.inc(version, 'minor');
writeManifest('package.json', rootManifest);

for (const name of needsRelease) {
    const manifest = packages.get(name)!;
    manifest.version = releaseVersion;
    writeManifest(`packages/${name}/package.json`, manifest);
}

// install dependencies to update yarn.lock
execAndLog('yarn');

execAndLog(`git commit -a -m "v${releaseVersion}"`);
execAndLog(`git tag v${releaseVersion}`);
execAndLog(`git push origin master --tags`);
