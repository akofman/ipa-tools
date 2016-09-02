const glob = require('glob');
const path = require('path');
const tmp = require('tmp');
const extractZip = require('extract-zip');
const plist = require('simple-plist');
const merge = require('deepmerge');
const clone = require('clone');
const fs = require('fs');
const archiver = require('archiver');

const extractIpa = (options) => {
  let result = {};
  const filterPlistFileName = (entry) => {
    if(/\.plist*/.test(entry.fileName)){
      result.plistFileName = entry.fileName;
    }
  };
  return new Promise((resolve, reject) => {
    glob('**/*.ipa', { cwd: process.cwd() }, (error, files) => {
      if (error) reject(error);
      if(files.length > 0) {
        result.path = path.join(process.cwd(), files[0]);
        result.ipaName = files[0];
        tmp.dir({ unsafeCleanup: true }, (err, dirPath, cleanupCallback) => {
          if (err) reject(err);
          result.extractDirPath = dirPath;
          extractZip(result.path, {dir: dirPath, onEntry: filterPlistFileName}, (err) => {
            if (!result.plistFileName){
              reject(new Error('No plist found'));
            } else {
              resolve(result);
            }
          });
        });
      }
      else {
        reject(new Error('ipa not found'));
      }
    });
  });
};

const read = (callback) => {
  return extractIpa().then((result) => {
    return {
      ipaPath: result.path,
      plist: plist.readFileSync(path.join(result.extractDirPath, result.plistFileName))
    };
  });
};

const update = (options, callback) => {
  return extractIpa().then((result) => {
    const plistPath = path.join(result.extractDirPath, result.plistFileName);
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
      if (err) throw err;
      zipPath = path.join(zipDirPath, result.ipaName);
      output = fs.createWriteStream(zipPath);

      archive.pipe(output);
      archive.directory(path.join(result.extractDirPath, 'Payload'), 'Payload').finalize();
      return zipPath;
    });
  });
}

exports.read = read;
exports.update = update;
