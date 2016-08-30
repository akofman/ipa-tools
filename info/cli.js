#!/usr/bin/env node

// USAGE :
// $ ipaInfo
// $ ipaInfo --short
const ipaInfo = require('./');
const argv = require('minimist')(process.argv.slice(2));
const chalk = require('chalk');

ipaInfo((err, info) => {
  if(argv.short){
    console.log(`
      BUNDLE NAME: ${chalk.green(info.plist.CFBundleName)}
      BUILD VERSION: ${chalk.green(info.plist.CFBundleShortVersionString)}
      BUNDLE VERSION: ${chalk.green(info.plist.CFBundleVersion)}
      MINIMUM OS VERSION: ${chalk.green(info.plist.MinimumOSVersion)}
      PATH: ${chalk.green(info.path)}
      `
    );
  } else {
    console.log(info);
  }
});
