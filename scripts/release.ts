import {
    getPackages,
    getChangedPackageNames,
    execAndLog,
    ensureCleanTree,
} from './util';

ensureCleanTree();

const {publicPackages} = getPackages();

const needsRelease = getChangedPackageNames('HEAD^', publicPackages.keys());

for (const [name, manifest] of publicPackages) {
    if (needsRelease.has(name)) {
        execAndLog(`npm publish packages/${name} --tag latest ${process.argv.slice(2).join(' ')}`);
        execAndLog(`npm dist-tag add ${manifest.name}@${manifest.version} next`);
    }
}
