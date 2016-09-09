#!/usr/bin/env node

// USAGE :
// ipa-info
// ipa-info --short
// ipa-info --input *.ipa
// ipa-info update --CFBundleVersion 2 --output .
const ipaInfo = require('./');
const argv = require('minimist')(process.argv.slice(2), {'string': ['CFBundleVersion']});
const chalk = require('chalk');
const stripIndents = require('common-tags/lib/stripIndents');

if (argv._.length === 0) {
  ipaInfo.read(argv).then((info) => {
    if (argv.short) {
      console.log(stripIndents `Bundle name: ${chalk.green(info.plist.CFBundleName)}
      Build version: ${chalk.green(info.plist.CFBundleShortVersionString)}
      Bundle version: ${chalk.green(info.plist.CFBundleVersion)}
      Minimum OS version: ${chalk.green(info.plist.MinimumOSVersion)}
      Path: ${chalk.green(info.ipaPath)}`);
    } else {
      console.log(info);
    }
  }).catch((err) => {
    console.log(chalk.red(err.message));
    process.exit();
  });
}

if (argv._.length === 1 && argv._[0] === 'update') {
  ipaInfo.update(argv).then((ipaPath) => {
    console.log(`updated IPA: ${chalk.green(ipaPath)}`);
  }).catch((err) => {
    console.log(chalk.red(err.message));
    process.exit();
  });
}
