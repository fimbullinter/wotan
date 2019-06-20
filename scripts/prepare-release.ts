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
    ensureBranchMatches,
    getRootPackage,
} from './util';
import { SemVer, Range, satisfies } from 'semver';

const rootManifest = getRootPackage();
const {releaseType, releaseVersion, releaseTag} =
    determineReleaseTypeAndVersion(process.argv.slice(2), rootManifest.version, rootManifest.nextVersion);

if (releaseType === 'patch') {
    // branch name must either be 'master' or 'release-<major>.<minor>'
    ensureBranchMatches(new RegExp(`^(?:master|release-${rootManifest.version.replace(/^(\d+\.\d+)\..+$/, '$1')})$`));
} else if (releaseType !== 'prerelease' || releaseTag === 'rc') {
    ensureBranch('master');
}
ensureCleanTree(undefined, ['CHANGELOG.md']);

execAndLog('yarn');
execAndLog('yarn verify');
ensureCleanTree(undefined, ['CHANGELOG.md', 'yarn.lock']);

const {packages} = getPackages();

// if the current release is a major release OR the first prerelease of a tag of a major version, release all packages
const changedPackages =
    releaseVersion.minor === 0 &&
    releaseVersion.patch === 0 &&
    (releaseVersion.prerelease.length === 0 || +releaseVersion.prerelease[1] === 0)
        ? new Set(packages.keys())
        : getChangedPackageNames(getLastReleaseTag()[0], packages.keys());
const needsRelease = new Set<string>();

function determineReleaseTypeAndVersion([type, tag]: string[], currentVersion: string, nextVersion: string) {
    if (type === undefined)
        return <const>{releaseType: /^\d+\.0\.0$/.test(nextVersion) ? 'major' : 'minor', releaseVersion: new SemVer(nextVersion)};
    switch (type) {
        case 'patch':
            return <const>{releaseType: 'patch', releaseVersion: new SemVer(currentVersion).inc('patch')};
        case 'prerelease': {
            if (tag === undefined)
                throw new Error("Release type 'prerelease' requires a tag name, but none was specified.");
            const curr = new SemVer(currentVersion);
            const next = new SemVer(nextVersion);
            const release = curr.compareMain(next) === 0 ? curr : next;
            // if we the current version is already a prerelease, we need to increment that one
            if (release.prerelease[0] !== tag) {
                release.prerelease = [tag, '0'];
            } else {
                release.prerelease = [tag, String(+curr.prerelease[1] + 1)];
            }

            return <const>{releaseType: 'prerelease', releaseVersion: new SemVer(release.format()), releaseTag: tag};
        }
        default:
            throw new Error(
                `Unexpected release type '${
                    type
                }'. Only 'patch' and 'prerelease' are allowed. 'major' and 'minor' are determined automatically.`,
            );
    }
}

function markForRelease(name: string) {
    if (needsRelease.has(name))
        return false;
    needsRelease.add(name);
    return true;
}

function updateManifest(manifest: PackageData, willBeReleased: boolean): boolean {
    let updated = false;
    for (const localName of needsRelease.keys()) {
        const {name} = packages.get(localName)!;
        update(manifest.dependencies, name);
        update(manifest.peerDependencies, name);
    }
    return updated;

    function update(dependencies: Dependencies | undefined, name: string) {
        if (!dependencies || !dependencies[name])
            return;
        const range = new Range(dependencies[name]);
        // if we are publishing the package anyway, update the constraint to the current released version to ensure compatibility
        if (willBeReleased || !satisfies(releaseVersion, range)) {
            // preserve the range sigil, if present
            const newRange = `${range.raw.replace(/\d.+$/, '')}${releaseVersion.version}`;
            if (newRange !== range.raw) {
                dependencies[name] = newRange;
                updated = true;
            }
        }
    }
}

for (const name of changedPackages)
    markForRelease(name);

let dependencyUpdated;
do {
    dependencyUpdated = false;
    for (const [localName, manifest] of packages)
        if (updateManifest(manifest, needsRelease.has(localName)) && markForRelease(localName))
            dependencyUpdated = true;
} while (dependencyUpdated);

const supportedTypescriptVersions = rootManifest.peerDependencies.typescript;
rootManifest.version = releaseVersion.version;
if (releaseType === 'major' || releaseType === 'minor')
    rootManifest.nextVersion = new SemVer(releaseVersion.version).inc('minor').version;
updateManifest(rootManifest, true);
writeManifest('package.json', rootManifest);

for (const name of needsRelease) {
    const manifest = packages.get(name)!;
    manifest.version = releaseVersion.version;
    if (manifest.peerDependencies && manifest.peerDependencies.typescript)
        manifest.peerDependencies.typescript = supportedTypescriptVersions;
    writeManifest(`packages/${name}/package.json`, manifest);
}

// install dependencies to update yarn.lock
execAndLog('yarn');

execAndLog(`git commit -a -m "v${releaseVersion.version}"`);
execAndLog(`git tag v${releaseVersion.version}`);
execAndLog(`git push origin master --tags`);
