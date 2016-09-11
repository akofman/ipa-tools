const glob = require('glob');
const path = require('path');
const tmp = require('tmp');
const extractZip = require('extract-zip');
const plist = require('simple-plist');
const merge = require('deepmerge');
const fs = require('fs-extra');
const archiver = require('archiver');
const Applesign = require('applesign');
const mkdirp = require('mkdirp');
const spawn = require('child_process').spawn;

const getXcodeDevPath = () => {
  return new Promise((resolve, reject) => {
    const xcodeSelect = spawn('xcode-select', ['--print-path']);
    xcodeSelect.stdout.on('data', function (data) {
      resolve(data.toString().replace(/\r?\n|\r/g, ''));
    });
    xcodeSelect.stderr.on('data', function (data) {
      reject(data.toString());
    });
  });
};

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

const addSwiftSupport = (signedZipPath, appName, ipaName, dylibPath, dylibs, options) => {
  return new Promise((resolve, reject) => {
    tmp.dir({ keep: true }, (err, extractDirPath, cleanupCallback) => {
      if (err) reject(err);
      const swiftSupport = path.join(extractDirPath, 'SwiftSupport');
      const archive = archiver.create('zip', {});
      const zipPath = options && options.output && path.join(options.output, ipaName) || path.join(process.cwd(), ipaName);
      let output;

      extractZip(signedZipPath, {dir: extractDirPath}, (err) => {
        if (err) reject(err);

        mkdirp(swiftSupport, (err) => {
          if (err) reject(err);
          dylibs.forEach((lib) => {
            const dylib = path.join(dylibPath, lib);
            try {
              fs.copySync(dylib, path.join(swiftSupport, lib));
              console.log(`copy ${dylib} to ${path.join(swiftSupport, lib)}`);
            } catch (e) {
              console.log(`WARN: ${path.join(dylibPath, lib)} not found`);
            }
          });
          output = fs.createWriteStream(zipPath);
          archive.pipe(output);
          archive.directory(extractDirPath, '.').finalize();
          archive.on('end', () => {
            resolve(zipPath);
          });
        });
      });
    });
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
      getXcodeDevPath().then((xcodeDevPath) => {
        tmp.dir({ unsafeCleanup: true }, (err, zipDirPath) => {
          if (err) reject(err);
          const frameworks = path.join(result.extractDirPath, `Payload/${plistObj.CFBundleName}.app/Frameworks`);
          const zipPath = path.join(zipDirPath, result.ipaName);
          const dylibPath = path.join(xcodeDevPath, 'Toolchains/XcodeDefault.xctoolchain/usr/lib/swift/iphoneos');

          fs.readdir(frameworks, (err, files) => {
            if (err) reject(err);

            files.forEach((lib) => {
              try {
                fs.copySync(path.join(dylibPath, lib), path.join(frameworks, lib));
              } catch (e) {
                console.log(`WARN: ${path.join(dylibPath, lib)} not found`);
              }
            });

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
                  addSwiftSupport(zipPath, plistObj.CFBundleName, result.ipaName, dylibPath, files, options).then((zipPath) => {
                    resolve(zipPath);
                  });
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
    });
  });
};

exports.read = read;
exports.update = update;
