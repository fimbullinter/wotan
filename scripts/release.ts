import {
    getPackages,
    getChangedPackageNames,
    execAndLog,
    ensureCleanTree,
    sortPackagesForPublishing,
    getRootPackage,
} from './util';
import { SemVer } from 'semver';

ensureCleanTree();

const {publicPackages} = getPackages();

const needsRelease = getChangedPackageNames('HEAD^', publicPackages.keys());

const tag = new SemVer(getRootPackage().version).prerelease[0] || 'latest';

for (const name of sortPackagesForPublishing(needsRelease, (p) => publicPackages.get(p)!)) {
    const manifest = publicPackages.get(name)!;
    execAndLog(`npm publish packages/${name}/ --tag ${tag} ${process.argv.slice(2).join(' ')}`);
    if (tag === 'latest' || tag === 'rc')
        execAndLog(`npm dist-tag add ${manifest.name}@${manifest.version} next`);
}
