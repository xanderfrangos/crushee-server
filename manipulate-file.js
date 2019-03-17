const sharp = require("sharp")
const compress_images = require("compress-images")
const fs = require("fs")
const path = require("path")
const uuidv1 = require('uuid/v1')
const del = require('del')


let imgSettings = {
    size: {
        width: 200,
        height: 200,
        crop: false
    },
    jpg: {
        quality: 85
    },
    png: {
        qualityMin: 50,
        qualityMax: 100
    },
    gif: {
        colors: 128
    },
    webP: {
        make: false,
        only: false
    }
}
const jpgEngine = { engine: 'mozjpeg', command: ['-quality', '85'] }
const pngEngine = { engine: 'pngquant', command: ['--quality=50-80', '--speed=2'] }
const svgEngine = { engine: 'svgo', command: '--multipass' }
const gifEngine = { engine: 'gifsicle', command: ['--colors', '128', '--use-col=web'] }
const webEngine = { engine: 'webp', command: false }
const noEngine = { engine: false, command: false }


const oldLogger = console.log
console.log = () => {}


async function processImage(file, outFolder) {

    

    let ext = path.extname(file).toLowerCase()
    let base = path.basename(file, path.extname(file))

    

    const outPath = outFolder + "file" + ext

    console.log("manipulate-file.js: " + "Processing to: " + outPath)

    try {
        let image = sharp(file)
        //image.resize(1200, 1200, {fit: "inside"})
        if (ext === ".jpg" || ext === ".jpeg") {
            image.jpeg({
                quality: 100,
                chromaSubsampling: '4:4:4'
            })
        } else if (ext === ".png") {
            image.png()
        } else {
            return false
        }
    
        let promise = image.toFile(outPath)
            .then(() => {
                console.log("manipulate-file.js: " + "Processed to: " + outPath)
                return outPath
            }).catch((e) => {
                return false
            })
        return promise
    } catch (e) {
        console.log(e)
    }
    

}


async function compressFile(file, outFolder, options = {}) {
    console.log("manipulate-file.js: " + "Compressing " + file)
    return new Promise((resolve, reason) => {
        compress_images(file, outFolder + "min.", { compress_force: true, statistic: false, autoupdate: false }, false,
            { jpg: jpgEngine },
            { png: pngEngine },
            { svg: svgEngine },
            { gif: gifEngine },
            (a, b, c) => {
                resolve(c)
            })
    }).then((a) => {
        if (a.err !== null) {
            return false
        }
        return a.path_out_new
    }).catch((e) => {
        console.log(e)
        return false
    })
}

async function makePreview(file, outFolder) {
    const outPath = outFolder + "preview" + path.extname(file).toLowerCase()
    try {
        let image = sharp(file)
        image.resize(200, 200, {fit: "cover"})
        image.jpeg({
            quality: 100,
            chromaSubsampling: '4:4:4'
        })
        let promise = image.toFile(outPath)
            .then(() => {
                console.log("manipulate-file.js: " + "Preview step 1 to: " + outPath)
                return outPath
            }).catch((e) => {
                return false
            })
        return promise
    } catch (e) {
        console.log(e)
    }
}


async function init(f, o, options = {}) {


    console.log("manipulate-file.js: " + "Making UUID folder")
    let uuid = uuidv1();
    let uuidDir = o + uuid + "/"
    console.log("manipulate-file.js: " + "Trying " + uuidDir)

    // Check if folder UUID exists, reroll
    while (fs.existsSync(uuidDir)) {
        console.log("manipulate-file.js: " + "UUID exists, rerolling")
        uuid = uuidv1();
        uuidDir = o + uuid + "/"
    }
    console.log("Making UUID folder:" + uuidDir)
    fs.mkdirSync(uuidDir)

    let resized = await processImage(f, uuidDir)

    if (!resized) {
        console.log("Aborted because of failed resize")
        return false;
    }

    let compressed = await compressFile(resized, uuidDir)

    if (!compressed) {
        console.log("Aborted because of failed compress")
        return false;
    }

    console.log("In file: " + f, "Resized: " + resized, "Compressed: " + compressed)
    let sourceSize = fs.statSync(f).size
    let finalSize = fs.statSync(compressed).size
    console.log(((finalSize / sourceSize) * 100).toPrecision(3) + "% smaller")


    const finalFile = uuidDir + path.basename(f)
    fs.copyFileSync(compressed, finalFile)

    let preview = await makePreview(finalFile, uuidDir)
    let minPreview = await compressFile(preview, uuidDir)

    fs.writeFileSync(uuidDir + "ts", Date.now())

    try {
        del(f)
        del(resized)
        del(compressed)
    } catch (e) {
        console.log(e)
    }

    let result = {
        uuid: uuid,
        filename: path.basename(f),
        sourcesize: sourceSize,
        finalsize: finalSize,
        preview: minPreview
    }

    return result
}

process.on('message', (data) => {
    console.log('manipulate-file.js: ' + 'message recieved', data)
    init(data.payload[0], data.payload[1], data.payload[2]).then((result) => {
        process.send(result)
        process.exit()
    }).catch((e) => {
        process.send(false)
        process.exit()
    })
})


console.log("manipulate-file.js: started!")

//console.log = oldLogger