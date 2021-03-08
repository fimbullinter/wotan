import * as glob from 'glob';
import * as semver from 'semver';
import * as path from 'path';
import * as fs from 'fs';
import * as rimraf from 'rimraf';
import { getRootPackage } from './util';

const minimumTypescriptVersion = new semver.Range(getRootPackage().peerDependencies.typescript).set[0][0].semver;
const supportedRange = new semver.Range('>=' + minimumTypescriptVersion.version);

for (const file of glob.sync('packages/*/test/**/{,*.}test.json')) {
    const config = require(path.resolve(file));
    if (config.typescriptVersion) {
        const range = new semver.Range(config.typescriptVersion);
        if (!semver.intersects(supportedRange, range)) {
            console.log('removing', file);
            fs.unlinkSync(file);
            const baselineDir = `baselines/${path.dirname(file)}/${path.basename(file).slice(0, -10) || 'default'}`;
            console.log('removing', baselineDir);
            rimraf.sync(baselineDir);
        } else {
            const newRange = cleanupTypescriptVersion(range);
            if (newRange !== config.typescriptVersion)
                fs.writeFileSync(file, JSON.stringify({...config, typescriptVersion: newRange}, undefined, 2) + '\n', 'utf8');
        }
    }
}

function cleanupTypescriptVersion(range: semver.Range): string | undefined {
    const set = range.set
        .map(
            (comparators) => comparators.filter(
                (c) => operatorToTestFunction(c.operator)(c.semver, minimumTypescriptVersion),
            ),
        )
        .filter((comparators) => comparators.length !== 0);
    if (set.length === 0)
        return;
    return set.map(formatComparators).join(' || ');
}

function formatComparators(comparators: readonly semver.Comparator[]): string {
    if (comparators.length === 2 && comparators[0].operator === '>=' && comparators[1].operator === '<') {
        const [{semver: low}, {semver: high}] = comparators;
        if (low.major === high.major && low.minor + 1 === high.minor && high.patch === 0)
            return '~' + low.version;
        if (low.major + 1 === high.major && high.minor === 0 && high.patch === 0)
            return '^' + low.version;
    }
    return comparators.map((c) =>  c.value).join(' ');
}

function operatorToTestFunction(operator: string): (comparatorVersion: semver.SemVer, currentVersion: semver.SemVer) => boolean {
    switch (operator) {
        case '<':
        case '>=':
            return semver.gt;
        case '<=':
        case '>':
        default: // equality
            return semver.gte;
    }
}
