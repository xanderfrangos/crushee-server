const express = require("express")
const fileUpload = require('express-fileupload');
const fs = require("fs")
const path = require("path")
const { fork } = require('child_process');
const del = require('del')

const inPath = "public/in/"
const outPath = "public/out/"
const tmpPath = outPath + "tmp/"

const app = express();

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

    if (!fs.existsSync(tmpPath)) {
        fs.mkdirSync(tmpPath, { recursive: true })
    }

    console.log("Done cleaning!")

}



function processTestFiles() {
    let files = fs.readdirSync(inPath)

    for (let i in files) {
        processFile(inPath + files[i], outPath).then((e) => {
            console.log(e)
        })
    }
}

async function processFile(inFile, outDir, options = {}) {
    const forked = fork('manipulate-file.js', [], { silent: false });

    forked.send({
        type: 'init',
        payload: [inFile, outDir, options]
    }, (e) => {
        if (e) {
            console.log(e)
        }
    })

    return new Promise((resolve, reject) => {
        forked.on('message', (msg) => {
            resolve(msg)
        });
    }).then((msg) => {
        return msg
    }).catch((e) => {
        console.log(e)
        return false
    })

}

cleanUp()
//processTestFiles()





// default options
app.use(fileUpload());

app.post('/upload', function (req, res) {
    if (Object.keys(req.files).length == 0) {
        return res.status(400).send('No files were uploaded.');
    }

    let file = req.files.file;
    file.mv(tmpPath + file.name, function (err) {
        if (err)
            return res.status(500).send(err);

        processFile(tmpPath + file.name, outPath).then((result) => {
            let json = result
            result.dl = 'crushed/' + result.uuid + '/' + result.filename
            result.preview = 'crushed/' + result.uuid + '/' + 'min.preview.jpg'
            result.tmp = result.preview
            res.json(result);
        })



    });



});

app.use("/", express.static('public/html'))

app.use("/crushed", express.static(outPath, {
    'index': false,
    'setHeaders': setDownloadHeader
}))

app.use("/assets", express.static('public/assets'))




app.all('/health', (req, res) => {
    res.send(`OK`)
})



app.listen(1603, (e) => {
    console.log("Listening on port 1603")
})



function setDownloadHeader(res, pathname) {
    res.setHeader('Content-Disposition', 'attachment;filename=' + path.basename(pathname))
}