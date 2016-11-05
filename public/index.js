var io = require('socket.io-client');
var SocketIOFileUpload = require('socketio-file-upload');

ready(function() {
  var socket = io('http://192.168.0.17:8080');
  var debugURL = 'http://192.168.0.17:8080/';

  var consoleContainer = window.document.getElementById('console');
  var queueContainer = window.document.getElementById('queue');
  var historyContainer = window.document.getElementById('history');
  var cardTemplate = queueContainer.querySelector('#template');
  cardTemplate.remove();

  window.scroll(queueContainer.getBoundingClientRect().left, 0);

  // -------------------------------------------------------------------------

  socket.on('handshake', function(data) {
    var cards = document.querySelectorAll('.card');
    for (let i = 0; i < cards.length; i++) cards[i].remove();
    for (let i = 0; i < data.queue.length; i++) spawnJobCard(data.queue[i]);
    for (let i = 0; i < data.history.length; i++) {
      spawnJobCard(data.history[i]);
      archiveCard(data.history[i].file);
    }
  });

  socket.on('job-queue', function(job) { spawnJobCard(job, true); });
  socket.on('job-archive', function(job) { archiveCard(job.file); });

  socket.on('job-delete', function(job) {
    var card = document.getElementById(job.file);
    card.classList.remove('ready');
    setTimeout(function() {
      card.remove();
    }, 300);
  });

  socket.on('job-progress', function(data) {
    var card = document.getElementById(data.job.file);
    if (card) {
      if (!card.classList.contains('running')) card.classList.add('running');
      var progressbar = card.querySelector('.progress');
      var percent = data.progress.value / data.progress.total * 100;
      progressbar.style.width = percent.toFixed(2) + '%';

      var timeContainer = card.querySelector('time.btn > .elapsed');
      var t = data.time.now - data.time.start;
      var h = Math.floor(t / (1000 * 60 * 60));
      var m = Math.floor((t / (1000 * 60)) % 60);
      var s = Math.floor((t / 1000) % 60);
      timeContainer.innerHTML = ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);

      var cmdContainer = card.querySelector('.cmd > h1');
      cmdContainer.innerHTML = data.progress.cmd;
    }
  });

  socket.on('err', function(err) {
    console.error(err);
    consoleContainer.querySelector('h1').innerHTML = err;

    if (!consoleContainer.classList.contains('show')) consoleContainer.classList.add('show');
    setTimeout(function() {
      consoleContainer.style.display = 'block';
    }, 500);
  });

  consoleContainer.addEventListener('click', function() {
    if (consoleContainer.classList.contains('show')) consoleContainer.classList.remove('show');
    setTimeout(function() {
      consoleContainer.style.display = 'none';
    }, 500);
  })

  // -------------------------------------------------------------------------

  var siofu = new SocketIOFileUpload(socket);
  var dropzone = document.getElementById('file_drop');
  var progress = dropzone.querySelector('#uploadProgress');

  siofu.listenOnDrop(dropzone);

  document.body.addEventListener('dragover', addDragClass);
  document.body.addEventListener('dragenter', addDragClass);
  document.body.addEventListener('dragleave', removeDragClass);
  document.body.addEventListener('dragend', removeDragClass);

  function addDragClass() { document.body.setAttribute('data-drag', 'true'); }
  function removeDragClass() { document.body.setAttribute('data-drag', ''); }

  siofu.addEventListener('progress', function(event){
      var percent = event.bytesLoaded / event.file.size * 100;
      progress.style.width = percent.toFixed(2) + '%';
  });

  siofu.addEventListener('complete', function(){
      removeDragClass();
      setTimeout(function() {
        progress.style.width = 0;
      }, 500);
  });

  // -----------------------------------------------------------------------

  function spawnJobCard(job, scrollToEnd = false) {
    var card = cardTemplate.cloneNode(true);
    card.id = job.file;

    // ----------------
    card.querySelector('header > h1').innerHTML = job.name;
    card.querySelector('header > aside > .uid').innerHTML = job.file.split('.xy').shift();

    var date = new Date(job.date);
    card.querySelector('header > aside > time').innerHTML = date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate();
    card.querySelector('.toolbar time.duration .eta').innerHTML = job.duration.estimation.formatted;

    // ----------------
    // TODO: remove debugURL
    card.querySelector('header > aside > .uid').setAttribute('href', debugURL + '.queue/' + job.file)
    var img = new Image();
    img.onload = function() {
      card.classList.add('ready');
      card.querySelector('img').src = img.src;
      if (scrollToEnd) window.scroll(document.body.scrollWidth, 0);
    };
    // TODO: remove debugURL
    img.src = debugURL + '.cache/' + job.file.replace('.xy', '.png')

    // ----------------
    var toolbar = card.querySelector('.toolbar .buttons');
    var run = createBtn('run', 'run', 'green', function() {
      socket.emit('run');
      card.classList.add('running');
      if (card.classList.contains('paused')) card.classList.remove('paused');
    });

    var pause = createBtn('pause', 'pause', 'blue', function() {
      socket.emit('pause');
      card.classList.add('paused');
    });

    var resume = createBtn('resume', 'resume', 'blue', function() {
      socket.emit('resume');
      if (card.classList.contains('paused')) card.classList.remove('paused');
    });

    var cancel = createBtn('cancel', 'cancel', 'red', function() {
      socket.emit('cancel');
      if (card.classList.contains('running')) card.classList.remove('running');
    });

    var del = createBtn('del', 'delete', 'red', function() {
      socket.emit('delete', job.file);
    });

    toolbar.appendChild(run);
    toolbar.appendChild(pause);
    toolbar.appendChild(resume);
    toolbar.appendChild(cancel);
    toolbar.appendChild(del);

    queueContainer.appendChild(card);
  }

  function archiveCard(jobID) {
    var card = document.getElementById(jobID);
    var cardURL = card.querySelector('header > aside > .uid').getAttribute('href').replace('.queue', '.history');
    card.querySelector('header > aside > .uid').setAttribute('href', cardURL);
    if (card.classList.contains('running')) card.classList.remove('running');
    var fragment = document.createDocumentFragment();
    fragment.appendChild(card);
    fragment.querySelector('.toolbar .buttons').innerHTML = '';


    var toolbar = card.querySelector('.toolbar .buttons');

    // TODO: handle deletion of queued redrawn jobs
    // var redraw = createBtn('again', 'redraw', 'green', function() {
    //   socket.emit('redraw', jobID);
    // });

    // toolbar.appendChild(redraw);


    historyContainer.appendChild(fragment);
  }

  function createBtn(id, label, color, cb) {
    var btn = document.createElement('a');
    btn.id = id;
    btn.className = 'btn easing ' + color;
    btn.setAttribute('href', '#');
    btn.innerHTML = label;

    btn.addEventListener('click', cb);
    return btn;
  }

});



// -------------------------------------------------------------------------

function ready(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}