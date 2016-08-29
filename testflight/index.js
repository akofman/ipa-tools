const glob = require('glob');
const fs = require('fs');
const plist = require('simple-plist');;
const merge = require('deepmerge')
const path = require('path');
const extractZip = require('extract-zip')
const archiver = require('archiver');
let updatedProps, plistFileName;

const updatePlist = (entry) => {
  if(/\.plist*/.test(entry.fileName)){
    plistFileName = entry.fileName;
  }
};

const upload = (props) => {
  glob('**/*.ipa', { cwd: __dirname }, (error, files) => {
    if(props){
      extractZip(files[0], {dir: __dirname + '/temp', onEntry: updatePlist}, (err) => {
        const archive = archiver.create('zip', {});
        updatedProps = merge(plist.readFileSync('temp/' + plistFileName), props);
        plist.writeBinaryFileSync('temp/' + plistFileName, updatedProps);
        const output = fs.createWriteStream(__dirname + '/zip_folder.zip');
        archive.pipe(output);
        archive.directory('temp/Payload', 'Payload').finalize();
      });
    }
  });
};

upload({CFBundleShortVersionString: '0.0.4'});
module.exports = upload;
