<p align="center">
  <img src="https://crushee.app/assets/img/icon.svg">
</p>
<h1 align="center">Crushee Server</h1>

*An image squisher*

Crushee is an image compression tool, accessed through a web browser. It accepts JPEG, PNG, GIF, SVG, and WebP files, and will output to JPEG, PNG, or WebP. It's useful for batch optimization and resizing images. You can carefully tune your images to meet your needs without having to re-upload or restart every time.

Crushee was primarily built with [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [sharp](https://github.com/lovell/sharp/), and [compress-images](https://github.com/semiromid/compress-images).



## Desktop App

For the average user, It's recommended that you use the [desktop app](https://github.com/xanderfrangos/crushee) (available for MacOS and Windows) instead of the server. The app has all of the capabilities of the server, but without needing to run a Node server and remember URLs.

**Download Crushee for Desktop here:**

<https://github.com/xanderfrangos/crushee/releases>



## Requirements

- **Node.js** (v10+)

- **libjpeg** (Actual library depends on your OS)

- What what I've experienced, all other image libraries should come pre-built through *npm install*



## Usage

- Download or clone
- Run *npm install*
- If you're missing any image libraries (depending on your OS), get those and re-run *npm install* as needed
- Run *node index.js*
- Access Crushee through port 1603. By default, it listens only on the loopback interface (ex. `http://localhost:1603`). You may change the listening interface by modifying the `CRUSHEE_HOST` environment variable (ex. to listen to all network interfaces, `export CRUSHEE_HOST=0.0.0.0`) and the listening port by modifying either the `CRUSHEE_PORT` or `PORT` environment variable (ex. to listen on 8080/tcp, `export CRUSHEE_PORT=8080`).



## License

Copyright © 2019 Xander Frangos

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
