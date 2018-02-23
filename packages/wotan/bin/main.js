#! /usr/bin/env node
(require('import-local')(__dirname + '/../src/cli.js') || require('../src/cli.js')).run(process.argv.slice(2));
