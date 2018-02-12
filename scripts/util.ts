import * as cp from 'child_process';
import * as fs from 'fs';

export interface Dependencies {
    [name: string]: string;
}

export interface PackageData {
    name: string;
    version: string;
    private?: boolean;
    dependencies?: Dependencies;
    devDependencies?: Dependencies;
    peerDependencies?: Dependencies;
}

export function getLastRelaseTag() {
    return cp.execSync('git describe --tags --match=v*.*.* --abbrev=0', {encoding: 'utf8'}).trim();
}

export function getPackages() {
    const packages = new Map(
        fs.readdirSync('packages').map((name): [string, PackageData] => {
            return [name, require(`../packages/${name}/package.json`)];
        }),
    );
    const publicPackages = new Map(Array.from(packages).filter((v) => !v[1].private));
    return {
        packages,
        publicPackages,
    };
}

export function getChangedPackageNames(startRev: string, packageNames: Iterable<string>) {
    const diff = cp.execSync(
        `git diff ${startRev} --name-only -z --no-color -- packages/${Array.from(packageNames).join(' packages/')}`,
        {encoding: 'utf8'},
    );
    const result = new Set<string>();
    for (const file of diff.split('\0'))
        if (file)
            result.add(file.split(/[/\\]/)[1]);
    return result;
}

export function writeManifest(path: string, content: PackageData) {
    fs.writeFileSync(path, JSON.stringify(content, undefined, 2) + '\n');
}

export function execAndLog(command: string) {
    console.log(`> ${command}`);
    console.log(cp.execSync(command, {encoding: 'utf8'}));
}
