const os       = require('os');
const path     = require('path');
const sh       = require('kool-shell');

const express  = require('express');
const siofu    = require('socketio-file-upload');
const app      = express();
const server   = require('http').Server(app);
const io       = require('socket.io')(server);

const getFiles = require('./utils/getfiles');
const jsonfile = require('jsonfile');

const public = path.join(__dirname, 'public');
const port = 8080;

const paths = {
  queue: path.join(public, '.queue'),
  cache: path.join(public, '.cache'),
  history: path.join(public, '.history'),
  trash: path.join(public, '.deleted')
};
const queue = require('./utils/queue')(paths);

// -------------------------------------------------------------------------

app.use(siofu.router);
app.use(express.static(public));
server.listen(port, () => {
  let interfaces = os.networkInterfaces();
  let addresses = [];
  for (let k in interfaces) {
    for (let k2 in interfaces[k]) {
      let address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }

  sh.success(`Server up and running on http://${addresses[0]}:${port}`);
});

// -------------------------------------------------------------------------
let progressTimer,
    progressTotal = 0;

io.on('connection', (socket) => {
  console.log(socket.id);

  socket.emit('handshake', {queue: queue.jobs, history: queue.history});

  let uploader = new siofu();
  uploader.dir = paths.trash;
  uploader.listen(socket);

  uploader.on('saved', (event) => {
    try {
      let content = jsonfile.readFileSync(event.file.pathName);
      queue.push(content.name, content.buffer);
    } catch (e) {
      sh.error(e);
      socket.emit('err', e);
    }
  });

  uploader.on('error', (err) => socket.emit('err', err.toString()));
  queue.plotter.on('error', (err) => socket.emit('err', err.toString()));

  queue.plotter.on('job-start', (data) => {
    progressTimer = Date.now();
    socket.emit('job-progress', {
      job: queue.currentJob,
      progress: {
        value: 0,
        total: data.job.getBuffer().length,
      },
      time: {
        start: progressTimer,
        now: progressTimer,
      }
    });
  });

  queue.plotter.on('job-progress', (data) => {
    socket.emit('job-progress', {
      job: queue.currentJob,
      progress: {
        value: data.progress.elapsed,
        total: data.progress.total,
      },
      time: {
        start: progressTimer,
        now: Date.now(),
      }
    });
  });

  queue.on('job-queue', (job) => socket.emit('job-queue', job));
  queue.on('job-archive', (job) => socket.emit('job-archive', job));
  queue.on('job-delete', (job) => socket.emit('job-delete', job));

  listen('job', (data) => {
    sh.info(`${data.name} received.`);
    if (data.buffer) {
      sh.info(`${data.name} valid.`);
      queue.push(data.name, data.buffer);
    }
  });

  listen('redraw', (jobID) => queue.redraw(jobID));
  listen('delete', (jobID) => queue.trash(jobID));
  listen('resume', () => queue.serial.resume());
  listen('pause', () => queue.serial.pause());
  listen('run', () => queue.run());
  listen('cancel', () => queue.serial.disconnect());

  function listen(event, cb, validate = null) {
    validate = validate || function() { return true; };
    socket.on(event, function(data, fn = null) {
      cb(data);
      if (fn) fn(validate(data));
    });
  }

});