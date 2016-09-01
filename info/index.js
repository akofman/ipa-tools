const glob = require('glob');
const path = require('path');
const tmp = require('tmp');
const extractZip = require('extract-zip');
const plist = require('simple-plist');
const merge = require('deepmerge');
const clone = require('clone');
const fs = require('fs');
const archiver = require('archiver');

const filterPlistFileName = (entry, callback) => {
  if(/\.plist*/.test(entry.fileName)){
    callback(entry.fileName);
  }
};

const read = (callback) => {
  glob('**/*.ipa', { cwd: process.cwd() }, (error, files) => {
    let plistFileName, info = {};
    const initPlistFileName = (entry) => {
      filterPlistFileName(entry, (fileName) => {
        plistFileName = fileName;
      });
    };

    if(files.length > 0) {
      info.path = path.join(process.cwd(), files[0]);
      tmp.dir({ unsafeCleanup: true }, (err, dirPath, cleanupCallback) => {
        if (err) callback(err);
        extractZip(info.path, {dir: dirPath, onEntry: initPlistFileName}, (err) => {
          if (!plistFileName) callback(new Error('No plist found'));
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

const update = (options, callback) => {
  glob('**/*.ipa', { cwd: process.cwd() }, (error, files) => {
    let plistFileName, zipPath;
    const initPlistFileName = (entry) => {
      filterPlistFileName(entry, (fileName) => {
        plistFileName = fileName;
      });
    };

    if(files.length > 0) {
      tmp.dir({ unsafeCleanup: true }, (err, extractDirPath, cleanupCallback) => {
        if (err) callback(err);
        extractZip(path.join(process.cwd(), files[0]), {dir: extractDirPath, onEntry: initPlistFileName}, (err) => {
          const plistPath = path.join(extractDirPath, plistFileName);
          const plistObj = plist.readFileSync(plistPath);
          const archive = archiver.create('zip', {});
          let updatedPlistObj, output, newProps = {};

          // Keep only plist props
          for ( let prop in plistObj ) {
            if (options[prop]) {
              newProps[prop] = options[prop];
            }
          }

          updatedPlistObj = merge(plistObj, newProps);
          plist.writeBinaryFileSync(plistPath, updatedPlistObj);

          tmp.dir({ keep: true }, (err, zipDirPath, cleanupCallback) => {
            zipPath = path.join(zipDirPath, files[0]);
            output = fs.createWriteStream(zipPath);

            archive.pipe(output);
            archive.directory(path.join(extractDirPath, 'Payload'), 'Payload').finalize();
            callback(err, zipPath);
          });
        });
      });
    }
    else {
      callback(new Error('ipa not found'));
    }
  });
}

exports.read = read;
exports.update = update;
