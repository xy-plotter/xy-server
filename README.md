<h1 align="center">xy-server</h1>
<div align="center">
  <img src="preview.png?raw=true">
</div>
<h3 align="center">raspberry pi node.js server for makeblock XY plotter v2.0</h3>
<div align="center">
  <!-- License -->
  <a href="https://raw.githubusercontent.com/arnaudjuracek/xy/master/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" />
  </a>
</div>

## Installation

```sh
svn export https://github.com/arnaudjuracek/xy-servert/trunk xy-server
cd xy-server
npm install
```

<sup>Follow this [rpi-setup-guide](https://gist.github.com/arnaudjuracek/1b760c00d0e00a685341a93942a10cb4#file-rpi-setup-guide-md) for the Raspberry PI setup.
</sup>

## Usage

###### server side
```sh
node xy-server
```

###### client side
Either use the web interface, or :
```js
var plotter = require('./../index.js')();
var job = plotter.Job('my-job');

var server = plotter.Server('192.168.0.17');
server.queue(job, (success) => {
  if (success) console.log('job successfully queued');
});
```
<sup>See [arnaudjuracek/xy](https://github.com/arnaudjuracek/xy) for more details.</sup>

## Development

```sh
npm run dev
```

## License

[MIT](https://tldrlegal.com/license/mit-license).
