const glob = require('glob');
const fs = require('fs');
const plist = require('simple-plist');;
const merge = require('deepmerge')
const path = require('path');
const extractZip = require('extract-zip')
const archiver = require('archiver');
const uuid = require('node-uuid');
let updatedProps, plistFileName;

const upload = (props) => {
  glob('**/*.ipa', { cwd: __dirname }, (error, files) => {

  });
};

module.exports = upload;
