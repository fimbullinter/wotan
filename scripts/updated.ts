import { getChangedPackageNames, getLastReleaseTag, getPackages } from './util';

// Usage: node scripts/updated [rev]
// rev can be any valid git revision
// if omitted, it defaults to the last release tag

const since = process.argv[2] || getLastReleaseTag()[0];

const result = Array.from(getChangedPackageNames(since, getPackages().publicPackages.keys()));
console.log(result.join(' '));
