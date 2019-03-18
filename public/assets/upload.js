var Upload = function (file, callback) {
    this.file = file;
    this.callback = callback;
};

Upload.prototype.getType = function () {
    return this.file.type;
};
Upload.prototype.getSize = function () {
    return this.file.size;
};
Upload.prototype.getName = function () {
    return this.file.name;
};
Upload.prototype.doUpload = function (file) {
    var that = this;
    var formData = new FormData();
    this.fileData = file

    formData.append("file", this.file, this.getName());

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
        event.target.file.elem.find('.details .subtitle').html(`<span class="bold">Crushing...</span>`)
    }

};



$("html").bind("dragover", function (e) {
    e.preventDefault();
    $("#app").addClass("drop-hover");
    return false;
});
$("html").bind("dragenter", function (e) {
    e.preventDefault();
    $("#app").addClass("drop-hover");
    return false;
});
$("html").bind("dragexit", function (e) {
    e.preventDefault();
    $("#app").removeClass("drop-hover");
    return false;
});
$("html").bind("dragleave", function (e) {
    e.preventDefault();
    // $("#app").removeClass("drop-hover"); 
    return false;
});
$("html").bind("drop", function (e) {
    $("#app").removeClass("drop-hover");
    e.preventDefault();
    e.stopPropagation();

    var files = e.originalEvent.dataTransfer.files;

    for (var i = 0, file; file = files[i]; i++) {
        var upload = new Upload(file, UploadedFileCallback);
        var fileData = fileUploading(file.name)
        upload.doUpload(fileData);
    }

    return false;
});


function UploadedFileCallback(data, file) {
    console.log("RESPONSE", data, file);

    if(data === false) {
        file.setStatus("error")
        return false
    }

    file.startSize = data.sourcesize
    file.endSize = data.finalsize
    file.uuid = data.uuid
    file.url = data.dl
    file.preview = data.preview
    file.name = data.filename

    file.setStatus("done")

}


var forcingFileNameChange = false;
$("#file").on("change", function (e) {
    if(forcingFileNameChange) {
        forcingFileNameChange = false;
        return false;
    }

    var files = e.target.files;

    for (var i = 0, file; file = files[i]; i++) {
        var upload = new Upload(file, UploadedFileCallback);
        var fileData = fileUploading(file.name)
        upload.doUpload(fileData);
    }

    // Reset so we can pick the same one again, if desired
    $("#file").val("")

});
$(".action--add-file").click(function (e) {
    console.log("Open file picker")
    e.preventDefault();
    $("#file").click();
    return false;
});


function setStatus(inStatus) {
    let status = inStatus.toLowerCase()
    this.status = status
    this.elem.attr('data-status', status)
    if (status === "done") {
        var size = getFormattedSize(this.endSize)
        var percent = getFormattedPercent
        this.elem.find('.preview img').attr('src', this.preview)
        this.elem.find('.details .subtitle').html(`<span>${size}</span><span>&centerdot;</span><span class="bold">${percent(this.startSize, this.endSize)}</span>`)
        updateTotals()
    } else if(status === "error") {
        this.elem.find('.details .subtitle').html(`<span class="bold error">Error: Could not process this file</span>`)
    }
}

function getFormattedSize(size) {
    outSize = size;
    if (size < 1000) {
        // bytes
        outSize = size + " bytes"
    } else if (size < 1000 * 1000) {
        // KB
        outSize = (size / 1000).toFixed(1) + "KB"
    } else if (size < 1000 * 1000 * 1000) {
        // MB
        outSize = (size / (1000 * 1000)).toFixed(1) + "MB"
    }
    return outSize
}

function getFormattedPercent(start, end) {
    if(start < end) {
        return ((100 + ((end / start) * 100)).toFixed(0) + "% larger")
    } else {
        return ((100 - ((end / start) * 100)).toFixed(0) + "% smaller")
    }
    
}


function updateTotals() {
    var totalStart = 0;
    var totalEnd = 0;
    for(var i in files.list) {
        totalStart += files.list[i].startSize
        totalEnd += files.list[i].endSize
    }

    var size = getFormattedSize(totalEnd)
    var percent = getFormattedPercent(totalStart, totalEnd);
    $(".page--files--after-list .totals").html(`Total saved: ${size} &middot; <span>${percent}</span>`)
}


function actionSaveButton(e) {
    console.log('saction')
    window.location.href = files.list[$(this).attr('data-id')].url
}


var files = {
    add: function (data) {
        var file = {
            id: this.getID(),
            name: data.name || 'Unknown file',
            status: 'uploading',
            startSize: 0,
            endSize: 0,
            setStatus: setStatus,
            bind: function () { 
                this.elem = $(".elem--file[data-id='" + this.id + "']") 
                this.elem.find('.actions .save-button').click(actionSaveButton)
            },
            elem: false
        }
        this.list.push(file)
        return file
    },
    list: [],
    nextID: 0,
    getID: function () { return this.nextID++ }
}
function fileUploading(name) {

    var file = files.add({
        name: name
    })

    createNewFileHTML(file)
    return file
}

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
                            <div class="save-button" data-id="${file.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path fill="none" d="M0 0h24v24H0V0z" />
                                    <path
                                        d="M16.59 9H15V4c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v5H7.41c-.89 0-1.34 1.08-.71 1.71l4.59 4.59c.39.39 1.02.39 1.41 0l4.59-4.59c.63-.63.19-1.71-.7-1.71zM5 19c0 .55.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1H6c-.55 0-1 .45-1 1z" />
                                </svg>
                            </div>
                        </div>

                    </div>
                </div>
    `;
    $('.page--files--list').prepend(html);
    file.bind()
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


