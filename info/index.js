const glob = require('glob');
const path = require('path');
const tmp = require('tmp');
const extractZip = require('extract-zip');
const plist = require('simple-plist');
const merge = require('deepmerge');
const fs = require('fs');
const archiver = require('archiver');
const Applesign = require('applesign');

const extractIpa = (options) => {
  let result = {};
  const filterPlistFileName = (entry) => {
    if (/Info\.plist*/.test(entry.fileName)) {
      result.plistFileName = entry.fileName;
    }
  };
  return new Promise((resolve, reject) => {
    let ipaPattern = options && options.input || '**/*.ipa';
    glob(ipaPattern, { cwd: process.cwd() }, (error, files) => {
      if (error) reject(error);
      if (files.length > 0) {
        result.path = path.join(process.cwd(), files[0]);
        result.ipaName = files[0];
        tmp.dir({ unsafeCleanup: true }, (err, dirPath, cleanupCallback) => {
          if (err) reject(err);
          result.extractDirPath = dirPath;
          extractZip(result.path, {dir: dirPath, onEntry: filterPlistFileName}, (err) => {
            if (err) reject(err);
            if (!result.plistFileName) {
              reject(new Error('No plist found'));
            } else {
              resolve(result);
            }
          });
        });
      } else {
        reject(new Error('ipa not found'));
      }
    });
  });
};

const read = (options) => {
  return extractIpa(options).then((result) => {
    return {
      ipaPath: result.path,
      plist: plist.readFileSync(path.join(result.extractDirPath, result.plistFileName))
    };
  });
};

const update = (options) => {
  return extractIpa(options).then((result) => {
    const plistPath = path.join(result.extractDirPath, result.plistFileName);
    const plistObj = plist.readFileSync(plistPath);
    const archive = archiver.create('zip', {});
    let updatedPlistObj;
    let output;
    let newProps = {};

    // Keep only plist props
    for (let prop in plistObj) {
      if (options[prop]) {
        newProps[prop] = options[prop];
      }
    }

    updatedPlistObj = merge(plistObj, newProps);
    plist.writeBinaryFileSync(plistPath, updatedPlistObj);

    return new Promise((resolve, reject) => {
      tmp.dir({ keep: true }, (err, zipDirPath) => {
        if (err) reject(err);
        const zipPath = options && options.output && path.join(options.output, result.ipaName) || path.join(process.cwd(), result.ipaName);
        output = fs.createWriteStream(zipPath);
        archive.pipe(output);
        archive.directory(path.join(result.extractDirPath, 'Payload'), 'Payload').finalize();
        archive.on('end', () => {
          const applesign = new Applesign({
            identity: options.identity,
            mobileprovision: options.mobileprovision,
            outfile: zipPath,
            withoutWatchapp: true
          });

          const onEnd = (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(zipPath);
            }
          };

          applesign.signIPA(zipPath, onEnd)
          .on('warning', (msg) => {
            console.log('WARNING', msg);
          })
          .on('message', (msg) => {
            console.log('msg', msg);
          });
        });
      });
    });
  });
};

exports.read = read;
exports.update = update;
