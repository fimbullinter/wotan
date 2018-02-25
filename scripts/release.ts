import {
    getPackages,
    getChangedPackageNames,
    execAndLog,
    ensureCleanTree,
} from './util';
import { SemVer } from 'semver';

ensureCleanTree();

const semver = new SemVer(require('../package.json').version);
const currentVersion = `${semver.major}.${semver.minor - 1}.0`;

const {publicPackages} = getPackages();

const needsRelease = getChangedPackageNames('HEAD^', publicPackages.keys());

for (const [name, manifest] of publicPackages) {
    if (manifest.version === currentVersion && needsRelease.has(name)) {
        execAndLog(`npm publish packages/${name} --tag latest ${process.argv.slice(2).join(' ')}`);
        execAndLog(`npm dist-tag add ${manifest.name}@${manifest.version} next`);
    }
}
