const Travis = require('travis-ci');

const travis = new Travis({
    version: '2.0.0'
});

travis.repos('fimbullinter', 'wotan').builds.get((err, builds) => {
    if (err)
        throw err;
    for (const build of builds.builds) {
        if (build.event_type !== 'cron' || build.state !== 'passed')
            continue;
        const commit = builds.commits.find((c) => c.id === build.commit_id);
        if (commit === undefined || commit.branch !== 'master')
            continue;
        console.error('Last successful nightly build #%s at %s', build.number, build.started_at);
        console.error('Commit %s: %s', commit.sha, commit.message);
        process.stdout.write(commit.sha);
        return;
    }
    throw new Error('no successful nightly build found');
});
