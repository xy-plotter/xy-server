const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const events   = require('events');
const eventEmitter = new events.EventEmitter();

const getFiles = require('./getfiles');
const jsonfile = require('jsonfile');
const sh       = require('kool-shell');
const _plotter  = require('xy-plotter');

function Queue(paths) {
  const plotter = _plotter();
  const plotterFile   = plotter.File();
  let plotterSerial;

  let files = getFiles(paths.queue);
  let jobs = getJobs(paths.queue, files);
  let current = null;

  const api = {
    get plotter() { return plotter; },
    get serial() { return plotterSerial; },

    run() {
      files = getFiles(paths.queue);
      jobs = getJobs(paths.queue, files);
      plotterSerial = plotter.Serial('/dev/ttyUSB0', {
        verbose: false,
        progressBar: false,
        disconnectOnJobEnd: true,
      });
      if (files.length > 0) api.currentJob = jobs[files[0]];
    },

    push(name, buffer) {
      let job = plotter.Job(name).setBuffer(buffer);
      let filename = checksum(buffer) + '.xy';
      let file = path.join(paths.queue, filename);
      let duration = plotter.Stats(job).getDuration();
      jsonfile.writeFileSync(file, {
        name: name,
        duration: duration,
        buffer: buffer,
      });

      jobs[filename] = {
        name: name,
        file: filename,
        duration: duration,
        date: Date.now(),
        plotter: job
      };

      let preview = path.join(paths.cache, filename.split('.xy').shift() + '.png');
      if (!fileExists(preview)) {
        plotterFile.export(job, preview);
      }

      eventEmitter.emit('job-queue', jobs[filename]);
      sh.success(`${name} successfully saved to ${file} (${getFilesizeInKiloBytes(file)}kb)`);
    },

    archive(job) {
      return new Promise((resolve, reject) => {
        let newPath  = path.join(paths.history, job.file);
        sh.info(`Archiving ${job.file}...`);
        fs.rename(path.join(paths.queue, job.file), newPath, () => {
          sh.success(`${job.file} archived.`);
          eventEmitter.emit('job-archive', jobs[job.file]);
          delete jobs[job.file];
          resolve();
        });
      });
    },

    trash(jobID) {
      return new Promise((resolve, reject) => {
        if (jobs[jobID]) {
          let newPath  = path.join(paths.trash, jobID);
          sh.info(`Deleting ${jobID}...`);
          fs.rename(path.join(paths.queue, jobID), newPath, () => {
            sh.success(`${jobID} deleted.`);
            eventEmitter.emit('job-delete', jobs[jobID]);
            delete jobs[jobID];
            resolve();
          });
        } else reject();
      });
    },

    redraw(jobID) {
      let file = path.join(paths.history, jobID);
      if (fileExists(file) && !jobs[jobID]) {
        let content = getFileContent(file);
        let job = plotter.Job(content.name).setBuffer(content.buffer);
        let mtime = fs.statSync(file).mtime.getTime();

        jobs[jobID] = {
          name: content.name,
          file: jobID,
          buffer: content.buffer,
          duration: content.duration,
          date: mtime,
        };

        let preview = path.join(paths.cache, jobID.split('.xy').shift() + '.png');
        if (!fileExists(preview)) {
          plotterFile.export(job, preview);
        }
        eventEmitter.emit('job-queue', jobs[jobID]);
      } else sh.error(`${jobID} not found.`);
    },

    get jobs() {
      let _jobs = [];
      for (let jobID in jobs) {
        if (jobs.hasOwnProperty(jobID)) {
          _jobs.push({
            name: jobs[jobID].name,
            file: jobs[jobID].file,
            duration: jobs[jobID].duration,
            date: jobs[jobID].date
          });
        }
      }
      return _jobs;
    },

    get history() {
      let files = getFiles(paths.history);
      let historyJob = getJobs(paths.history, files);
      let history = [];
      for (let jobID in historyJob) {
        if (historyJob.hasOwnProperty(jobID)) {
          history.push({
            name: historyJob[jobID].name,
            file: historyJob[jobID].file,
            duration: historyJob[jobID].duration,
            date: historyJob[jobID].date
          });
        }
      }
      return history;
    },

    get currentJob() { return current; },
    set currentJob(job) {
      current = job;
      sh.warning(`setting current job to ${job.name}`);
      plotterSerial.send(job.plotter).then(() => {
        api.archive(job).then(() => {
            // yay
        });
      }).catch((err) => sh.error(err));
    },

    on(event, cb) { eventEmitter.on(event, cb); },

  };

  // -------------------------------------------------------------------------

  function getJobs(dir, files) {
    let jobs = {};
    for (let i = 0; i < files.length; i++) {
      let filename = files[i];
      if (!jobs[filename]) {
        let file = path.join(dir, filename);

        let content = getFileContent(file);

        let job = plotter.Job(content.name).setBuffer(content.buffer);
        let mtime = fs.statSync(file).mtime.getTime();

        jobs[filename] = {
          name: content.name,
          file: filename,
          duration: content.duration,
          date: mtime,
          plotter: job
        };

        let preview = path.join(paths.cache, filename.split('.xy').shift() + '.png');
        if (!fileExists(preview)) {
          plotterFile.export(job, preview);
        }
      }
    }
    return jobs;
  }

  function getFileContent(file) {
    try {
      return jsonfile.readFileSync(file);
    } catch (e) {
      sh.error(e);
      return null;
    }
  }

  function getFilesizeInKiloBytes(filename) {
    let stats = fs.statSync(filename);
    let fileSizeInBytes = stats["size"];
    return Math.ceil(fileSizeInBytes / 1000);
  }

  function checksum(json, algorithm, encoding) {
    let str = JSON.stringify(json);
    return crypto.createHash(algorithm || 'md5').update(str, 'utf8').digest(encoding || 'hex')
  }

  function fileExists(filePath) {
    try {
      return fs.statSync(filePath).isFile();
    } catch (err) {
      return false;
    }
  }

  return api;
}

module.exports = Queue;