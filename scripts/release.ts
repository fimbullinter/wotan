import {
    getPackages,
    getChangedPackageNames,
    execAndLog,
    ensureCleanTree,
    sortPackagesForPublishing,
} from './util';

ensureCleanTree();

const {publicPackages} = getPackages();

const needsRelease = getChangedPackageNames('HEAD^', publicPackages.keys());

for (const name of sortPackagesForPublishing(needsRelease, (p) => publicPackages.get(p)!)) {
    const manifest = publicPackages.get(name)!;
    execAndLog(`npm publish packages/${name} --tag latest ${process.argv.slice(2).join(' ')}`);
    execAndLog(`npm dist-tag add ${manifest.name}@${manifest.version} next`);
}
