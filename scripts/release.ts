import { getPackages, getChangedPackageNames, getLastRelaseTag, PackageData, writeManifest, execAndLog } from './util';
import * as semver from 'semver';

const rootManifest = require('../package.json');
const releaseVersion = rootManifest.version;
const version = new semver.SemVer(releaseVersion);
const isMajor = version.minor === 0 && version.patch === 0 && version.prerelease.length === 0 && version.build.length === 0;

const {packages, publicPackages} = getPackages();

const needsRelease = isMajor ? new Set<string>(packages.keys()) : getChangedPackageNames(getLastRelaseTag(), publicPackages.keys());

function updateManifest(path: string, manifest: PackageData, toVersion: string) {
    manifest.version = toVersion;
    for (const localName of needsRelease) {
        const {name} = packages.get(localName)!;
        if (manifest.dependencies && manifest.dependencies[name])
            manifest.dependencies[name] = `^${releaseVersion}`;
        if (manifest.peerDependencies && manifest.peerDependencies[name])
            manifest.peerDependencies[name] = `^${releaseVersion}`;
        if (isMajor && manifest.devDependencies && manifest.devDependencies[name])
            manifest.devDependencies[name] = `^${releaseVersion}`;
    }
    writeManifest(path, manifest);
}

updateManifest('package.json', rootManifest, semver.inc(version, 'minor')!); // set root version to next minor version
for (const [name, manifest] of packages)
    if (needsRelease.has(name))
        updateManifest(`packages/${name}/package.json`, manifest, releaseVersion);

writeManifest('package.json', rootManifest);
for (const [name, manifest] of packages) {
    if (!manifest.private && needsRelease.has(name)) {
        execAndLog(`npm publish packages/${name} --tag latest ${process.argv.slice(2).join(' ')}`);
        execAndLog(`npm dist-tag ${manifest.name}@${manifest.version} next`);
    }
}
execAndLog(`git commit -a -m "v${releaseVersion}"`);
execAndLog(`git tag v${releaseVersion}`);
execAndLog(`git push origin master --tags`);
