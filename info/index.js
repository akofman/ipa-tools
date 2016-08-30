const glob = require('glob');
const path = require('path');
const tmp = require('tmp');
const extractZip = require('extract-zip');
const plist = require('simple-plist');;
let plistFileName, info = {};

const filterPlistFileName = (entry) => {
  if(/\.plist*/.test(entry.fileName)){
    plistFileName = entry.fileName;
  }
};

const ipaInfo = (callback) => {
  glob('**/*.ipa', { cwd: __dirname }, (error, files) => {
    if(files.length > 0) {
      info.path = path.join(__dirname, files[0]);

      tmp.dir(function _tempDirCreated(err, dirPath, cleanupCallback) {
        if (err) callback(err);

        extractZip(files[0], {dir: dirPath, onEntry: filterPlistFileName}, (err) => {
          info.plist = plist.readFileSync(path.join(dirPath, plistFileName));
          callback(err, info);
        });
      });
    }
    else {
      callback(new Error('ipa not found'));
    }
  });
};

module.exports = ipaInfo;
