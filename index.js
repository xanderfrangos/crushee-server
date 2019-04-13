const express = require("express")
const app = express();
const expressWs = require('express-ws')(app);
const fileUpload = require('express-fileupload');
const fs = require("fs")
const os = require("os")
const path = require("path")
const { fork, spawn } = require('child_process');
const del = require('del')
const uuidv1 = require('uuid/v1')
const JSZip = require("jszip");
const EventEmitter = require('events');

// Server version
const serverVersion = require('./package.json').version

const outPath = "public/out/"
const tmpPath = outPath + "tmp/"



let jobQueue = []
let uploads = []

// Limit extra threads
let maxProcessingThreads = process.env.CRUSHEE_THREADS || os.cpus().length
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

    try {
        if (!fs.existsSync(outPath)) {
            fs.mkdirSync(outPath, { recursive: true })
        }
    } catch (e) {
        console.log(e)
    }


    console.log("Done cleaning!")

}
cleanUp()

// Set up processing threads
for (let i = 0; i < maxProcessingThreads; i++) {
    const forked = makeThread(i)
    fileProcessorThreads.push(forked)
}

function makeThread(threadNum) {
    let thread = fork('./manipulate-file.js', [], { silent: false })

    const forked = {
        queue: 0,
        threadNum,
        thread,
        jobs: [],
        lastAlive: Date.now()
    }
    forked.thread.send({
        type: 'setThreadNum',
        result: threadNum
    })

    // Handle messages and queue updates
    forked.thread.on('message', (data) => {
        if (data.type === "queueLength") {
            fileProcessorThreads[data.threadNum].queue = data.result
        } else if (data.type === "generic") {
            console.log(`Thread ${data.threadNum} says "${data.message}"`)
        } else if (data.type === "alive") {
            forked.lastAlive = Date.now()
        } else if (data.type === "jobRequest") {

            if (jobQueue.length > 0) {
                // Get job from queue
                let job = jobQueue.splice(0, 1)[0]
                forked.jobs[job.uuid] = job

                // Send job to thread
                forked.thread.send({
                    type: 'job',
                    uuid: job.uuid,
                    payload: job.payload
                }, (e) => {
                    if (e) {
                        console.log(e)
                    }
                })
            }

        } else if (data.type === "finished") {
            // Return response from server
            forked.jobs[data.uuid].callback(data.result)
            delete forked.jobs[data.uuid];
        }

    })

    return forked
}


// Monitor and restart unresponsive threads
setInterval(monitorThreads, 3000)
function monitorThreads() {
    fileProcessorThreads.forEach((fork, idx) => {
        const now = Date.now()
        //console.log(`Thread ${idx} last alive ${(now - fork.lastAlive) / 1000}s ago`)
        if (fork.lastAlive < now - (1000 * 10)) {
            console.log(`Thread ${idx} responsive. Restarting thread.`)
            fork.thread.kill()
            fileProcessorThreads[idx] = makeThread(idx)
        }
    })
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
    uploads[uuid].status = "crushing"
    fileUpdateEvent(uuid)

    // Wait for response from thread
    return new Promise((resolve, reject) => {

        jobQueue.push({
            uuid,
            payload: [uuid, uploadName, inFile, outDir, options],
            callback: resolve
        })

    }).then((result) => {
        // We did it!
        uploads[uuid] = Object.assign(uploads[uuid], result)
        uploads[uuid].status = "done"
        fileUpdateEvent(uuid)
        return result
    }).catch((e) => {
        // Something bad went wrong with the job
        console.log(e)
        uploads[uuid].status = "error"
        fileUpdateEvent(uuid)
        throw e
    })

}

getUUID = () => {
    // Make UUID
    let uuid = uuidv1();
    let uuidDir = outPath + uuid + "/"

    // Check if folder UUID exists, reroll
    while (fs.existsSync(uuidDir)) {
        consoleLog("UUID exists, rerolling")
        uuid = uuidv1();
        uuidDir = outPath + uuid + "/"
    }
    fs.mkdirSync(uuidDir)
    return uuid
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
    const uuid = getUUID()
    const uuidDir = outPath + uuid + "/"

    fs.writeFileSync(uuidDir + "filename", file.name)

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

        newFile(file.name, uuid)

        res.json(uploads[uuid])

        fileUpdateEvent(uuid)

        // Send off to a thread
        processFile(uuid, file.name, filePath, outPath, settings)
    });
});

const fileStatus = new EventEmitter()
const fileUpdateEvent = (uuid) => {
    let file = Object.assign({}, uploads[uuid])
    // Remove sever-only data... once I add some?
    fileStatus.emit("update", file)
}

app.ws('/messages', function (ws, req) {

    let send = (type, payload = {}) => {
        if (ws.readyState === 1)
            ws.send(JSON.stringify({
                type,
                payload
            }))
    }

    const uploadFile = (pathName, settings = {}, id = -1) => {
        // Process uploaded image
        const uuid = getUUID()
        const uuidDir = outPath + uuid + "/"

        const file = newFile(path.basename(pathName), uuid)
        send("upload", {
            id,
            file
        })
        const filePath = uuidDir + "source" + path.extname(pathName)
        fs.writeFileSync(uuidDir + "filename", path.basename(pathName))
        fs.copyFileSync(pathName, filePath)
    
            // Send off to a thread
            processFile(uuid, path.basename(pathName), filePath, outPath, settings)
        
}

    fileStatus.on("update", (file) => {
        send("update", {
            uuid: file.uuid,
            file
        })
    })

    fileStatus.on("replaceUUID", (oldUUID, file) => {
        send("replace", {
            oldUUID,
            file
        })
    })

    ws.on('close', (e) => {
        
    })

    ws.on('message', function (msg) {
        data = JSON.parse(msg)
        console.log(data)
        let uuids
        if (typeof data.type != undefined)
            switch (data.type) {
                case "all-files":
                    send("all-files", getAllFiles())
                    break;
                case "clear":
                    removeFiles(data.payload)
                    break;
                case "upload":
                    uploadFile(data.payload.path, JSON.parse(data.payload.settings), data.payload.id)
                    break;
                case "check":
                    uuids = checkUUIDs(data.payload)
                    send("check", uuids)
                    break;
                case "recrush":
                    uuids = data.payload.uuids
                    if (typeof uuids == "object") {
                        uuids.forEach((uuid) => recrush(uuid, data.payload.options))
                    } else {
                        recrush(uuids, data.payload.options)
                    }
                    break;
            }
    });
});


const newFile = (filename, uuid) => {
    uploads[uuid] = {
        uuid,
        filename: filename,
        status: 'crushing',
        url: "",
        endSize: 1,
        original: filename,
        preview: "",
        startSize: 1
    }
    return uploads[uuid]
}


const getAllFiles = () => {
    files = []
    console.log(uploads)
    for (let uuid in uploads) {
        if (uploads[uuid].status != "error") {
            files.push(uploads[uuid])
        }
    }
    return files
}

const removeFiles = (uuids) => {

    if (typeof uuids === "string") {
        // Only one UUID provided. Deleting files and metadata.
        removeUUID(uuids)
        return true
    } else if (typeof uuids === "object") {
        // Multiple UUIDs provided. Deleting files and metadata.
        uuids.forEach((uuid) => {
            removeUUID(uuid)
        })
        return true
    }
    // WTF did you send?
    return false
}

const removeUUID = (uuid) => {
    try {
        let cleanedUUID = uuid.replace(".", "")
        uploads[cleanedUUID].status = "deleted"
        del(outPath + cleanedUUID + "/")
        fileUpdateEvent(uuid)
    } catch (e) {
        console.log(`Couldn't delete ${uuid}`)
    }
}

const checkUUIDs = (uuids) => {
    if (typeof uuids === "string") {
        if (typeof uploads[uuids] === "object") {
            return [uuids]
        }
    } else if (typeof uuids === "object") {
        let availableUUIDs = []
        uuids.forEach((uuid) => {
            if (typeof uploads[uuids] === "object") {
                availableUUIDs.push(uuid)
            }
        })
        return availableUUIDs
    }
}


const recrush = (oldUUID, options = {}) => {
    let uuid = getUUID()
    let settings = JSON.parse(options)
    let original = fs.readFileSync(outPath + oldUUID + "/filename", "utf8")
    const filePath = outPath + uuid + "/source" + path.extname(original)
    fs.copyFileSync(outPath + oldUUID + "/source" + path.extname(original), filePath)

    fs.writeFileSync(outPath + uuid + "/filename", original)

    uploads[oldUUID].status = "crushing"
    fileUpdateEvent(oldUUID)

    uploads[uuid] = {
        uuid,
        filename: uploads[oldUUID].filename,
        status: 'crushing',
        url: "",
        endSize: 1,
        original: uploads[oldUUID].original,
        preview: "",
        startSize: 1
    }

    // Send off to a thread
    processFile(uuid, original, filePath, outPath, settings).then((result) => {
        fileStatus.emit("replaceUUID", oldUUID, uploads[uuid])
    })
}



app.post('/zip', function (req, res) {
    let files = JSON.parse(req.body.files)
    let zip = new JSZip();
    for (let file of files) {
        zip.file(file.name, fs.readFileSync(outPath + "/" + file.uuid + "/crushed/" + file.name));
    }
    zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: {
            level: 9
        }
    })
        .then((content) => {
            const uuid = getUUID()
            const zipPath = outPath + uuid + "/download.zip"
            fs.writeFile(zipPath, content, () => {
                res.json({
                    uuid,
                    dl: "d/" + uuid + "/download.zip"
                });
            })

        });
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
// On macOS, $HOST is already taken by default.
const host = process.env.CRUSHEE_HOST || '127.0.0.1';
app.listen(port, host, (e) => {
    console.log(`Starting server v${serverVersion} on ${host}:${port}`)
    process.send({
        type: "ready"
    })
})

