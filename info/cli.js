#!/usr/bin/env node

// USAGE :
// $ ipaInfo
// $ ipaInfo --short
const ipaInfo = require('./');
const argv = require('minimist')(process.argv.slice(2));
const chalk = require('chalk');
const stripIndents = require('common-tags/lib/stripIndents');

if (argv._.length === 0) {
  ipaInfo.read((err, info) => {
    if (err) {
      console.log(chalk.red(err.message));
      process.exit();
    }
    if (argv.short) {
      console.log(stripIndents `Bundle name: ${chalk.green(info.plist.CFBundleName)}
      Build version: ${chalk.green(info.plist.CFBundleShortVersionString)}
      Bundle version: ${chalk.green(info.plist.CFBundleVersion)}
      Minimum OS version: ${chalk.green(info.plist.MinimumOSVersion)}
      Path: ${chalk.green(info.path)}`);
    } else {
      console.log(info);
    }
  });
}

if (argv._.length === 1 && argv._[0] === 'update') {
  ipaInfo.update(argv, (err, result) => {
    if (err) {
      console.log(chalk.red(err.message));
      process.exit();
    }

    console.log(`updated IPA: ${chalk.green(result)}`);
  });
}
