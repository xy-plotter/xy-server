const fs   = require('fs');
const path = require('path');

function getFiles(dir) {
  let files = fs.readdirSync(dir)
                .map(function(v) {
                  return {
                    name: v,
                    time: fs.statSync(path.join(dir, v)).mtime.getTime()
                  };
                })
                .sort(function(a, b) { return a.time - b.time; })
                .map(function(v) { return v.name; });
  return files;
}

module.exports = getFiles;