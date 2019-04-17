import $ from 'jquery';
    window.$ = $;
    window.jQuery = $;


const parseBool = (value) => {
    let str = String(value)
    return (str.toLowerCase() === "true" || str.toLowerCase() === "yes" || str.toLowerCase() === "1" || value === 1 || value === true ? true : false)
}

var Upload = function (file, callback) {
    this.file = file;
    this.callback = callback;
};
Upload.prototype.doUpload = function (file) {
    var that = this;
    var formData = new FormData();
    this.fileData = file

    formData.append("file", this.file, this.file.name);
    formData.append("settings", JSON.stringify(settings))

    if(isApp) {
        // App local transfer
        sendMessage("upload", {
            path: file.path,
            settings: JSON.stringify(settings),
            id: files.list.indexOf(file)
        })
    } else {
        // Browser HTTP upload
        $.ajax({
            type: "POST",
            url: "/upload",
            xhr: function () {
                var myXhr = $.ajaxSettings.xhr();
                myXhr.upload.file = file;
                myXhr.upload.callback = that.callback;
                myXhr.upload.upload = that;
                if (myXhr.upload) {
                    myXhr.upload.addEventListener('progress', that.progressHandling, false);
                }
                return myXhr;
            },
            success: function (data) {
                $("#output").append(data);
                that.callback(data, that.fileData);
            },
            error: function (error) {
                console.log(error)
                that.fileData.setStatus("error")
            },
            async: true,
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            timeout: 60000
        });
    }

    



};

Upload.prototype.progressHandling = function (event) {

    var percent = 0;
    var position = event.loaded || event.position;
    var total = event.total;
    if (event.lengthComputable) {
        percent = Math.ceil(position / total * 100);
    }
    console.log(event);

    event.target.file.elem.find('div.progress-bar').css("width", percent + "%");

    if (percent == 100) {
        event.target.file.setStatus("crushing")
    }

};





function UploadedFileCallback(data, file) {
    console.log("RESPONSE", data, file);

    if (data === false) {
        file.setStatus("error")
        return false
    }


    for (var key in data) {
        file[key] = data[key]
    }

    file.setFilename(file.name)
    file.setStatus(file.status)
}



function openFilePicker() {
    console.log("Open file picker")
    window.document.getElementById("file").click();
}






function actionSaveButton(e) {
    window.location.href = files.list[$(this).attr('data-id')].url
}

function actionMoreButton(e) {
    var pos = $(this).position()
    var menu = $(".elem--menu.single-file")

    files.menuItemID = parseInt($(this).attr("data-id"))

    menu.css("top", (pos.top - 5) + "px")
    menu.css("left", (pos.left - menu.width() + $(this).width()) + "px")
    menu.toggleClass("active")
}

function fileUploading(file) {

    var file = files.add({
        name: file.name,
        path: file.path || false
    })

    showBackButton(true)
    createNewFileHTML(file)
    return file
}




document.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('File(s) you dragged here: ', e.dataTransfer.files);
    return false;
});

document.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    //ipcRenderer.send('ondragstart', '/path/to/item')
});






var showingList = false;
function createNewFileHTML(file) {

    if (!showingList) {
        showingList = true;
        $(".page--files").addClass("show");
    }

    var html = `
    <div class="elem--file" data-id="${file.id}" data-status="${file.status}">
                    <div class="inner">

                        <div class="preview">
                            <div class="inner">
                                <div class="overlay">
                                    <div class="progress-bar"></div>
                                    <div class="compare-hover">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M10 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v2h2V1h-2v2zm0 15H5l5-6v6zm9-15h-5v2h5v13l-5-6v9h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
                                    </div>
                                </div>
                                <img src="assets/unknown.svg" />
                            </div>
                        </div>

                        <div class="details">
                            <div class="title">${file.name}
                            </div>
                            <div class="subtitle"><span class="bold">Uploading...</span></div>
                        </div>

                        <div class="actions">
                            <div class="more-button" data-id="${file.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                            </div>
                        </div>

                    </div>
                </div>
    `;
    $('.page--files--list').prepend(html);
    file.bind()
}





function showComparison(e) {
    var file = files.list[$(this).parent().parent().attr("data-id")]
    if (file.status != "done")
        return false;

    $(".page--comparison").addClass("show");

    $(".page--comparison .before").css("background-image", `url('${file.originalURL}')`);
    $(".page--comparison .after").css("background-image", `url('${file.url}')`);
}
















function downloadFile(file) {
    if (file.status != "done") {
        console.log("File not ready to be downloaded!")
        return false
    }
    console.log(file)
    if (settings.app.overwrite == "true" && typeof window.electron != "undefined" && typeof window.electron.download == "function") {
        window.electron.download(window.location.origin + "/" + file.url, file.path, file.name, (cb) => {
            console.log(cb)
        })
    } else {
        window.location = file.url
    }
}






function recrushAll() {
    var uuids = []
    for (var i = 0; i < files.list.length; i++) {
        if (files.list[i].status == "done") {
            //recrush(files.list[i])
            uuids.push(files.list[i].uuid)
        }
    }
    sendMessage("recrush", {
        uuids,
        options: JSON.stringify(settings)
    })
}




export function clearAllFiles() {
    sendMessage("clear", getAllUUIDS())
    files.nextID = 0
    files.list = []
    $(".page--files--list").html("")
    $(".page--files").removeClass("show")
    updateTotals()
    showingList = false
    showBackButton(false)
}


function getAllUUIDS() {
    var uuids = []
    files.list.forEach((file) => {
        uuids.push(file.uuid)
    })
    return uuids
}




var backButtonDepth = 0
function showBackButton(show) {
    if (show) {
        backButtonDepth++
        $("body").addClass("show-back-button")
        $(".elem--mobile-nav .back-button").addClass("animate")
    } else {
        backButtonDepth--
        if (backButtonDepth == 0)
            $("body").removeClass("show-back-button")
    }
}



function recrush(file) {
    sendMessage("recrush", {
        uuids: file.uuid,
        options: JSON.stringify(settings)
    })
    return true;
}








var menuItemID = -1;


function deleteUUID(uuid) {
    files.list.forEach((file, idx) => {
        if (uuid == file.uuid) {
            $(".elem--file[data-id='" + idx + "'").remove()
            delete files.list[idx].setStatus("deleted")
        }
    })

}










function checkUUIDs(uuids) {
    files.list.forEach((file) => {
        if (uuids.indexOf(file.uuid) === -1) {
            deleteUUID(file.uuid)
        }
    })
    return uuids
}


