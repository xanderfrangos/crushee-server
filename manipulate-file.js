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
        quality: 85
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


//
//   Manipulate images
//
async function processImage(file, outFolder, options = {}) {
    const settings = Object.assign(imgSettings, options)
    let ext = path.extname(file).toLowerCase()
    
    sendGenericMessage(JSON.stringify(settings))
    try {
        let image = sharp(file)
        if(settings.resize.width || settings.resize.height) {
            image.resize(
                (settings.resize.width ? parseInt(settings.resize.width) : null), 
                (settings.resize.height ? parseInt(settings.resize.height) : null), 
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
            image.jpeg({
                quality: 100,
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

        const outPath = outFolder + "file" + ext
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
async function compressFile(file, outFolder, options = {}) {
    const settings = Object.assign(imgSettings, options)

    const inExt = path.extname(file).toLowerCase()

    // Abort unsupported file types
    // ...mostly webp
    if(!(inExt == ".png" || inExt == ".jpg" || inExt == ".jpeg" || inExt == ".svg" || inExt == "gif"))
        return file

    jpgOptions = Object.assign(jpgEngine)
    jpgOptions.command[1] = settings.jpg.quality + ""

    pngOptions = Object.assign(pngEngine)
    if(settings.png.qualityMin > settings.png.qualityMax)
        settings.png.qualityMax = settings.png.qualityMin;
    pngOptions.command[0] = `--quality=${settings.png.qualityMin}-${settings.png.qualityMax}`

    return new Promise((resolve, reason) => {
        
        compress_images(file, outFolder + "min.", { compress_force: true, statistic: false, autoupdate: false }, false,
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
            quality: 100,
            chromaSubsampling: '4:4:4'
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

    let uuidDir = o + uuid + "/"

    // Convert with Sharp
    let resized = await processImage(f, uuidDir, options)
    if (!resized) {
        consoleLog("Failed manipulation! Returning original file :(")
        resized = f;
    }

    // Compress
    let compressed = await compressFile(resized, uuidDir, options)
    if (!compressed) {
        consoleLog("Failed compress! Returning original file :(")
        compressed = f;
    }

    // Collect sizes to send back
    let sourceSize = fs.statSync(f).size
    let finalSize = fs.statSync(compressed).size

    // Copy finished file to final location
    fs.mkdirSync(uuidDir + "crushed/")
    let finalFile = uuidDir + "crushed/" + path.basename(fn, path.extname(fn)) + path.extname(compressed)

    if(sourceSize < finalSize) {
        fs.copyFileSync(f, uuidDir + "crushed/" + path.basename(fn, path.extname(fn)) + path.extname(fn))
        finalSize = sourceSize;
    } else {
        fs.copyFileSync(compressed, finalFile)
    }

    

    // Make thumbnails
    fs.mkdirSync(uuidDir + "preview/")
    let preview = await makePreview(finalFile, uuidDir + "preview/")
    let minPreview = await compressFile(preview, uuidDir + "preview/")

    // Write timestamp for cleanup
    fs.writeFileSync(uuidDir + "ts", Date.now())

    // Get rid of unnecessary files
    try {
        //del(resized)
        del(compressed)
    } catch (e) {
        consoleLog(e)
    }

    // Build and send results
    let result = {
        uuid: uuid,
        filename: path.basename(finalFile, path.extname(finalFile)) + path.extname(finalFile),
        sourcesize: sourceSize,
        finalsize: finalSize,
        preview: minPreview
    }

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