const express = require("express")
const fileUpload = require('express-fileupload');
const fs = require("fs")
const path = require("path")
const { fork } = require('child_process');
const del = require('del')
const uuidv1 = require('uuid/v1')
const JSZip = require("jszip");


const outPath = "public/out/"
const tmpPath = outPath + "tmp/"

const app = express();

// Limit extra threads
let maxProcessingThreads = process.env.CRUSHEE_THREADS || 4
let fileProcessorThreads = []

/*
//
//
//   STARTUP
//
//
*/

// Clear output folder at startup
function cleanUp() {
    console.log("Cleaning old output files")

    try {
        del.sync([outPath + "**", "!" + outPath])
    } catch (e) {
        console.log(e)
    }

    if (!fs.existsSync(outPath)) {
        fs.mkdirSync(outPath, { recursive: true })
    }

    console.log("Done cleaning!")

}
cleanUp()

// Set up processing threads
for (let i = 0; i < maxProcessingThreads; i++) {
    const forked = {
        queue: 0,
        threadNum: i,
        thread: fork('manipulate-file.js', [], { silent: false })
    }
    forked.thread.send({
        type: 'setThreadNum',
        result: i
    })

    // Handle messages and queue updates
    forked.thread.on('message', (data) => {
        if (data.type === "queueLength") {
            fileProcessorThreads[data.threadNum].queue = data.result
        } else if (data.type === "generic") {
            console.log(`Thread ${data.threadNum} says "${data.message}"`)
        }

    })

    fileProcessorThreads.push(forked)
}

// Print queues to console
printQueues = () => {
    let outStrs = []
    for (let i = 0; i < fileProcessorThreads.length; i++) {
        outStrs.push(`${fileProcessorThreads[i].queue}`)
    }
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`[${Date.now()}] Thread queues: ` + outStrs.join(" | ") + "\r")
}
//setInterval(printQueues, 1000)




/*
//
//
//   FUNCTIONS
//
//
*/


// Get thread with least jobs, or random
function getAvailableThread() {
    let availableThreadNum = Math.floor(Math.random() * fileProcessorThreads.length)
    for (let i = 0; i < fileProcessorThreads.length; i++) {
        if (fileProcessorThreads[i].queue < fileProcessorThreads[availableThreadNum].queue)
            availableThreadNum = i
    }
    return fileProcessorThreads[availableThreadNum].thread
}

async function processFile(uuid, uploadName, inFile, outDir, options = {}) {

    // Get thread with least jobs
    const forked = getAvailableThread()

    // Send job to thread
    forked.send({
        type: 'job',
        uuid: uuid,
        payload: [uuid, uploadName, inFile, outDir, options]
    }, (e) => {
        if (e) {
            console.log(e)
        }
    })

    // Wait for response from thread
    return new Promise((resolve, reject) => {
        forked.on('message', (data) => {
            if (data.type == "finished" && data.uuid == uuid) {
                resolve(data.result)
            }
        })
    }).then((result) => {
        // We did it!
        return result
    }).catch((e) => {
        // Something bad went wrong with the job
        console.log(e)
        return false
    })

}




/*
//
//
//   EXPRESS.JS CONFIG
//
//
*/


// Serve HTML if available
app.use("/", express.static('public/html'))

// Default upload options
app.use(fileUpload({
    fileSize: 10 * 1024 * 1024, // Max size of 10MB
    abortOnLimit: true,
}));

app.post('/upload', function (req, res) {
    if (Object.keys(req.files).length == 0) {
        return res.status(400).send('No files were uploaded.');
    }

    // Process uploaded image
    let file = req.files.file;

    // Make UUID
    let uuid = uuidv1();
    let uuidDir = outPath + uuid + "/"

    // Check if folder UUID exists, reroll
    while (fs.existsSync(uuidDir)) {
        consoleLog("manipulate-file.js: " + "UUID exists, rerolling")
        uuid = uuidv1();
        uuidDir = outPath + uuid + "/"
    }
    fs.mkdirSync(uuidDir)
    
    const filePath = uuidDir + "source" + path.extname(file.name)
    file.mv(filePath, function (err) {
        if (err) {
            return res.status(500).send(err);
        }
        let settings = {}
        try {
            settings = JSON.parse(req.body.settings)
        } catch (e) {
            console.log("Couldn't decode recieved settings")
        }

        // Send off to a thread
        processFile(uuid, file.name, filePath, outPath, settings).then((result) => {
            // Respond with crushed image and preview thumbnail
            result.dl = 'd/' + result.uuid + '/crushed/' + result.filename
            result.preview = 'd/' + result.uuid + '/preview/' + 'min.preview.jpg'
            res.json(result);
        })
    });
});


app.post('/zip', function (req, res) {
    let uuids = JSON.parse(req.param.uuids)
    // let zip = new JSZip();
})

app.post('/recrush', function (req, res) {
    let uuid = req.param.uuid
    let original = req.param.fileName
    const filePath = original

    // THIS NO WORK
    // Send off to a thread
    processFile(uuid, original, filePath, outPath, settings).then((result) => {
        // Respond with crushed image and preview thumbnail
        result.dl = 'd/' + result.uuid + '/crushed/' + result.filename
        result.preview = 'd/' + result.uuid + '/preview/' + 'min.preview.jpg'
        res.json(result);
    })
    
})

// Images that have been compressed will be served here
app.use("/d", express.static(outPath, {
    'index': false,
    'setHeaders': setDownloadHeader
}))

// Force download
function setDownloadHeader(res, pathname) {
    res.setHeader('Content-Disposition', 'attachment;filename=' + path.basename(pathname))
}

// Non-user assets
app.use("/assets", express.static('public/assets'))

// Check server alive
app.all('/health', (req, res) => {
    res.send(`OK`)
})

// Start listening
const port = process.env.PORT || process.env.CRUSHEE_PORT || 1603
app.listen(port, (e) => {
    console.log(`Starting server on port ${port}`)
})

