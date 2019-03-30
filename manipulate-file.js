const sharp = require("sharp")
const compress_images = require("compress-images")
const fs = require("fs")
const path = require("path")
const uuidv1 = require('uuid/v1')
const del = require('del')

const consoleLog = console.log
console.log = () => {}

// Default image settings
let imgSettings = {
    resize: {
        width: "",
        height: "",
        crop: false
    },
    jpg: {
        quality: 95
    },
    png: {
        qualityMin: 50,
        qualityMax: 99
    },
    gif: {
        colors: 128
    },
    webp: {
        quality: 80,
        alphaQuality: 100,
        make: false,
        only: false
    }
}

// Default engine settings for compressor
const jpgEngine = { engine: 'mozjpeg', command: ['-quality', '85'] }
const pngEngine = { engine: 'pngquant', command: ['--quality=50-80', '--speed=2'] }
const svgEngine = { engine: 'svgo', command: '--multipass' }
const gifEngine = { engine: 'gifsicle', command: ['--colors', '128', '--use-col=web'] }
const webEngine = { engine: 'webp', command: false }
const noEngine = { engine: false, command: false }





/*
//
//
//   IMAGE PROCESSING
//
//
*/

var debug = false;
//
//   Manipulate images
//
async function processImage(file, outFolder, options = {}, quality = 100) {
    
    // Merge and santize options
    let settings = Object.assign(imgSettings, options)
    settings.resize.width = (parseInt(settings.resize.width) > 5400 ? 5400 : settings.resize.width)
    settings.resize.height = (parseInt(settings.resize.height) > 5400 ? 5400 : settings.resize.height)


    let ext = path.extname(file).toLowerCase()

    try {
        let image = sharp(file, {
            density: 300
        })
        if(settings.resize.width || settings.resize.height) {
            image.resize(
                (settings.resize.width && parseInt(settings.resize.width) > 0 ? parseInt(settings.resize.width) : null), 
                (settings.resize.height && parseInt(settings.resize.height) > 0 ? parseInt(settings.resize.height) : null), 
                {fit: (settings.resize.crop == "true" ? "cover" : "inside")}
                )
        }

        if(options.jpg.make == "true") {
            ext = ".jpg"
        }

        if(options.webp.make == "true") {
            ext = ".webp"
        }
        
        if (ext === ".jpg" || ext === ".jpeg") {
            ext = ".jpg" // Force .jpg because it's objectively correct
            image.flatten({
                background: {r:255, g:255, b:255}
            })
            image.jpeg({
                quality: quality,
                chromaSubsampling: '4:4:4'
            })
            
        } else if (ext === ".png") {
            image.png()
        } else if(ext === ".webp") {
            image.webp({
                quality: parseInt(settings.webp.quality)
            })
        } else {
            return false
        }

        const outPath = outFolder + "manipulated" + ext
        let promise = image.toFile(outPath)
            .then(() => {
                return outPath
            }).catch((e) => {
                return false
            })
        return promise
    } catch (e) {
        consoleLog(e)
    }

}

//
//    Compress images after manipulation
//
async function compressFile(file, outFolder, options = {}, jpgEngineName = "jpegRecompress") {
    const settings = Object.assign(imgSettings, options)

    const inExt = path.extname(file).toLowerCase()

    // Abort unsupported file types
    // ...mostly webp
    if(!(inExt == ".png" || inExt == ".jpg" || inExt == ".jpeg" || inExt == ".svg" || inExt == "gif"))
        return file

    jpgOptions = Object.assign(jpgEngine)
    jpgOptions.command[1] = settings.jpg.quality + ""

    if(jpgEngineName == "mozjpeg") {
        jpgOptions.engine = "mozjpeg"
        if(parseInt(settings.jpg.quality) >= 95) {
            sendGenericMessage("4:4:4 Chroma")
            jpgOptions.command = ["-quality", settings.jpg.quality + "", "-optimize", "-sample", "1x1"]
        } else {
            sendGenericMessage("4:2:0 Chroma")
            jpgOptions.command = ["-quality", settings.jpg.quality + "", "-optimize"]
        }
    } else {
        jpgOptions.engine = "jpegRecompress"
        if(parseInt(settings.jpg.quality) >= 95) {
            jpgOptions.command = ["--quality", "high", "--min", settings.jpg.quality + "", "--subsample", "disable"]
        } else {
            jpgOptions.command = ["--quality", "high", "--min", settings.jpg.quality + "", "--method", "smallfry"]
        }
    }

    pngOptions = Object.assign(pngEngine)
    if(settings.png.qualityMin > settings.png.qualityMax)
        settings.png.qualityMax = settings.png.qualityMin;
    pngOptions.command[0] = `--quality=${settings.png.qualityMin}-${settings.png.qualityMax}`

    return new Promise((resolve, reason) => {
        
        compress_images(file, outFolder + jpgOptions.engine + ".", { compress_force: true, statistic: false, autoupdate: false }, false,
            { jpg: jpgEngine },
            { png: pngOptions },
            { svg: svgEngine },
            { gif: gifEngine },
            (a, b, c) => {
                resolve(c)
            })
    }).then((a) => {
        if (a.err !== null) {
            throw a.err
        }
        return a.path_out_new
    }).catch((e) => {
        // Compression didn't go so well
        consoleLog(e)
        return false
    })
}


//
//   Builds thumbnail previews
//
async function makePreview(file, outFolder) {
    const outPath = outFolder + "preview.jpg"
    try {
        let image = sharp(file)
        image.resize(200, 200, { fit: "cover" })
        image.jpeg({
            quality: 75,
            chromaSubsampling: '4:2:0'
        })
        let promise = image.toFile(outPath)
            .then(() => {
                // Preview made!
                return outPath
            }).catch((e) => {
                // Preview failed to write
                throw e
                return false
            })
        return promise
    } catch (e) {
        // Preview super failed
        consoleLog(e)
    }
}

//
//   Process queued image
//
async function job(uuid, fn, f, o, options = {}) {


    // JPEG Presets
    // Max: 99
    // High: 95
    // Medium: 94
    // Low: 88

    debug = (options.app.darkMode == "true" ? true : false)

    let uuidDir = o + uuid + "/"

    sendGenericMessage("Manipulating...")
    // Convert with Sharp
    let resized = await processImage(f, uuidDir, options)
    if (!resized) {
        consoleLog("Failed manipulation! Returning original file :(")
        resized = f;
    }


    // Use MozJPEG to adjust overall quality
    let tmpResize
    if(path.extname(resized) == ".jpg" && parseInt(options.jpg.quality) < 95) {
        sendGenericMessage("MozCompressing...")
        resized = await compressFile(resized, uuidDir, options, "mozjpeg")
        if (!resized) {
            consoleLog("Failed mozcompress! Returning original file :(")
            resized = tmpResize;
        }
    }
    debug = false

    // Compress
    sendGenericMessage("Compressing...")
    let compressed = await compressFile(resized, uuidDir, options)
    if (!compressed) {
        consoleLog("Failed compress! Returning original file :(")
        compressed = resized;
    }

    // Collect sizes to send back
    let sourceSize = fs.statSync(f).size
    let finalSize = fs.statSync(compressed).size

    sendGenericMessage("Preparing final file...")
    // Copy finished file to final location
    fs.mkdirSync(uuidDir + "crushed/")
    let finalFile = uuidDir + "crushed/" + path.basename(fn, path.extname(fn)) + path.extname(compressed)

    if(false && sourceSize < finalSize && path.extname(fn).toLowerCase() == path.extname(compressed).toLowerCase()) {
        sendGenericMessage("WARNING: New file is larger. Returning original...")
        fs.copyFileSync(f, uuidDir + "crushed/" + path.basename(fn, path.extname(fn)) + path.extname(fn))
        finalSize = sourceSize;
    } else {
        fs.copyFileSync(compressed, finalFile)
    }

    
    sendGenericMessage("Making previews...")
    // Make thumbnails
    fs.mkdirSync(uuidDir + "preview/")
    let preview = ""
    try {
        preview = await makePreview(finalFile, uuidDir + "preview/", {})
    } catch(e) {
        sendGenericMessage("ERROR: Creating preview failed")
    }

    // Compress preview
    try {
        const compressedP = await compressFile(preview, uuidDir + "preview/", {
            jpg: {
                quality: 75
            }
        }, "mozjpeg")
        preview = compressedP
    } catch(e) {
        sendGenericMessage("ERROR: Compressing preview failed")
    }

    sendGenericMessage("Writing timestamp...")
    // Write timestamp for cleanup
    fs.writeFileSync(uuidDir + "ts", Date.now())

    sendGenericMessage("Clearing temp files...")
    // Get rid of unnecessary files
    try {
        //await del(resized)
        //await del(compressed)
    } catch (e) {
        consoleLog(e)
    }

    // Build and send results
    let result = {
        uuid: uuid,
        filename: path.basename(finalFile, path.extname(finalFile)) + path.extname(finalFile),
        sourcesize: sourceSize,
        finalsize: finalSize,
        preview: preview
    }

    sendGenericMessage("Done!")
    // Congrats, job well done!
    return result
}




/*
//
//
//   QUEUE/JOB MANAGEMENT
//
//
*/

let processQueue = []
let processBusy = false
let threadNum = -1
process.on('message', (data) => {
    if (data.type == "job") {
        processQueue.push(data)
        sendGenericMessage(`Recieved job ${data.uuid} | Current queue: ${processQueue.length}`)
        sendQueueUpdate()
        checkCanDoJob()
    } else if (data.type == 'setThreadNum') {
        threadNum = data.result
    }
})

// Send queue updates after events and every so often
setInterval(sendQueueUpdate, 1000)
function sendQueueUpdate() {
    process.send({
        type: 'queueLength',
        result: processQueue.length,
        threadNum: threadNum
    })
}

function sendGenericMessage(message) {
    process.send({
        type: 'generic',
        message: message,
        threadNum: threadNum
    })
}

// Try to run a job, if able
setInterval(checkCanDoJob, 333)
async function checkCanDoJob() {
    if (processBusy == false && processQueue.length > 0) {

        processBusy = true
        let data = processQueue[0]
        job(...data.payload).then((result) => {

            // Send response that the job was finished
            process.send({
                type: 'finished',
                result: result,
                uuid: data.uuid,
                threadNum: threadNum
            })

            // Remove old job and make not busy
            processQueue.splice(0, 1)
            processBusy = false

            sendGenericMessage(`Finished job ${data.uuid} | Current queue: ${processQueue.length}`)

            // Finished job, start another
            checkCanDoJob()

        }).catch((e) => {

            // Something went wrong :(
            // Tell someone
            process.send(false)
            process.send({
                type: 'finished',
                result: false,
                uuid: processQueue[0].uuid,
                threadNum: threadNum
            })

            // Remove old, errored-out job
            processQueue.splice(0, 1)
            processBusy = false

            // Try next job
            checkCanDoJob()
        })
    }
}










var deleteFolderRecursive = function(path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(function(file, index){
        var curPath = path + "/" + file;
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  };