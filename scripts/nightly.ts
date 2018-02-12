import * as fs from 'fs';
import * as cp from 'child_process';

if (process.argv.length < 3) {
    console.log('Usage: node scripts/nightly <rev> [<options>...]');
    process.exit(1);
}

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

const lastNightly = process.argv[2].split('..')[0]; // revision of the last nightly
console.log('last nightly release', lastNightly);
const lastReleaseTag = cp.execSync('git describe --tags --match=v*.*.* --abbrev=0', {encoding: 'utf8'}).trim();
console.log('last stable release tag', lastReleaseTag);
// if there was a release since the last nightly, only get the diff since that release
const diffStart = lastNightly
    ? cp.execSync(`git rev-list ${lastReleaseTag}...${lastNightly}`, {encoding: 'utf8'}).split(/\r?\n/)[0]
    : lastReleaseTag;
console.log('releasing changes since', diffStart);

const diff = cp.execSync(
    `git diff ${diffStart} --name-only -z --no-color -- packages/${Array.from(publicPackages.keys()).join(' packages/')}`,
    {encoding: 'utf8'},
).trim();
for (const file of diff.split('\0'))
    if (file)
        markChanged(file.split(/[/\\]/)[1]);

for (const name of changed) {
    fs.writeFileSync(`packages/${name}/package.json`, JSON.stringify(publicPackages.get(name), undefined, 2) + '\n');
    console.log(cp.execSync(`npm publish packages/${name} --tag next ${process.argv.slice(3).join(' ')}`, {encoding: 'utf8'}));
}
