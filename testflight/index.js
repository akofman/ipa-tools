const glob = require('glob');
const fs = require('fs-extra');
const path = require('path');
const tmp = require('tmp');
const md5File = require('md5-file');
const stripIndent = require('common-tags/lib/stripIndent');
const request = require('request');
const mkdirp = require('mkdirp');

const getITCServiceKey = () => {
  return new Promise((resolve, reject) => {
    request.get({url: 'https://itunesconnect.apple.com/itc/static-resources/controllers/login_cntrl.js'},
    (error, response, body) => {
      if (error) reject(error);
      const serviceKeyVar = body.match(/itcServiceKey = '(.*)'/)[1];
      resolve(serviceKeyVar);
    });
  });
};

const getAuthCookie = (login, password) => {
  return getITCServiceKey().then((itcServiceKey) => {
    return new Promise((resolve, reject) => {
      request.post({url: `https://idmsa.apple.com/appleauth/auth/signin?widgetKey=${itcServiceKey}`,
        json: {
          'accountName': login,
          'password': password,
          'rememberMe': true }
        },
        (error, response, body) => {
          if (error) reject(error);
          const cookie = /myacinfo=.+?;/.exec(response.headers['set-cookie']);
          if (!cookie) {
            reject(new Error('cannot log in'));
          } else {
            resolve(cookie[0]);
          }
        }
      );
    });
  });
};

const getAppId = (login, password, bundleId) => {
  return getAuthCookie(login, password).then((appleAuthCookie) => {
    return new Promise((resolve, reject) => {
      request.get({
        url: 'https://itunesconnect.apple.com/WebObjects/iTunesConnect.woa/ra/apps/manageyourapps/summary/v2',
        headers: {
          'Cookie': appleAuthCookie
        }
      }, (err, response, body) => {
        if (err) reject(err);
        const app = JSON.parse(response.body).data.summaries.find((app) => {
          return app.bundleId === bundleId;
        });
        resolve(app.adamId);
      });
    });
  });
};

const upload = (user, password) => {
  return new Promise((resolve, reject) => {
    glob('**/*.ipa', { cwd: process.cwd() }, (err, files) => {
      if (err) reject(err);
      if (files.length > 0) {
        const stats = fs.statSync(files[0]);
        const archiveType = 'bundle';
        const ipaPath = path.join(process.cwd(), files[0]);
        const platform = 'ios';

        md5File(ipaPath, (err, md5) => {
          if (err) reject(err);

          getAppId(user, password, 'com.synchronized.senna').then((appId) => {
            const metadata = stripIndent `
            <?xml version="1.0" encoding="UTF-8"?>
            <package xmlns="http://apple.com/itunes/importer" version="software5.4">
              <software_assets apple_id="${appId}" app_platform="${platform}">
                <asset type="${archiveType}">
                  <data_file>
                    <size>${stats.size}</size>
                    <file_name>${files[0]}</file_name>
                    <checksum type="md5">${md5}</checksum>
                  </data_file>
                </asset>
              </software_assets>
            </package>`;

            tmp.dir({ keep: true }, (err, dirPath, cleanupCallback) => {
              if (err) reject(err);
              const itmsp = path.join(dirPath, `${files[0].substr(0, files[0].lastIndexOf('.'))}.itmsp`);
              mkdirp(itmsp, (err) => {
                if (err) reject(err);
                fs.writeFile(path.join(itmsp, 'metadata.xml'), metadata, (err) => {
                  if (err) reject(err);
                  try {
                    fs.copySync(ipaPath, path.join(itmsp, files[0]));
                  } catch (err) {
                    reject(err);
                  }
                  console.log(dirPath);
                });
              });
            });
          }).catch((err) => {
            reject(err);
          });
        });
      } else {
        reject(new Error('ipa not found'));
      }
    });
  });
};

upload('developer@synchronized.tv', 'Th3Crazy0n3').then((appId) => {
  console.log(appId);
}).catch((err) => {
  console.log(err);
});

module.exports = upload;
