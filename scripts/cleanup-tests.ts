import * as glob from 'glob';
import * as semver from 'semver';
import * as path from 'path';
import * as fs from 'fs';
import * as rimraf from 'rimraf';

const supportedTypescriptVersions = new semver.Range(require('../package.json').peerDependencies.typescript);

for (const file of glob.sync('packages/*/test/**/{,*.}test.json')) {
    const config = require(path.resolve(file));
    if ('typescriptVersion' in config && !semver.intersects(supportedTypescriptVersions, config.typescriptVersion)) {
        console.log('removing', file);
        fs.unlinkSync(file);
        const baselineDir = `baselines/${path.dirname(file)}/${path.basename(file).slice(0, -10) || 'default'}`;
        console.log('removing', baselineDir);
        rimraf.sync(baselineDir);
    }
}
