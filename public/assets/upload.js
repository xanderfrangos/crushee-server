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
    formData.append("settings", JSON.stringify(settings))

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
        event.target.file.setStatus("crushing")
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
    file.originalURL = data.original
    file.name = data.filename

    file.setFilename(file.name)

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


function setFilename(filename) {
    this.elem.find(".title").text(filename);
}

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
    } else if(status === "crushing") {
        this.elem.find('.details .subtitle').html(`<span class="bold">Crushing...</span>`)
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
            originalName: data.name || 'Unknown file',
            status: 'uploading',
            startSize: 0,
            endSize: 0,
            setStatus: setStatus,
            setFilename: setFilename,
            bind: function () { 
                this.elem = $(".elem--file[data-id='" + this.id + "']") 
                this.elem.find('.actions .save-button').click(actionSaveButton)
                this.elem.find('.preview').click(showComparison)
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





function showComparison(e) {
    var file = files.list[$(this).parent().parent().attr("data-id")]
    if(file.status != "done")
        return false;

    $(".page--comparison").addClass("show");

    $(".page--comparison .before").css("background-image", `url('${file.originalURL}')`);
    $(".page--comparison .after").css("background-image", `url('${file.url}')`);
}



$(".page--comparison").click(function() {
    $(this).removeClass("show")
})

var beforeElem = $(".page--comparison .before")
$(".page--comparison").mousemove(function(e) {
    beforeElem.width(e.pageX)
})






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








$("[data-linked]").on("change", function(e) {
    var linkedTo = $(this).attr("data-linked");
    $("input[data-linked='" + linkedTo + "']").val($(this).val());
});

$("[data-linked]").on("input", function(e) {
    var linkedTo = $(this).attr("data-linked");
    $("input[data-linked='" + linkedTo + "']").val($(this).val());
});

$(".input--toggle input").on("change", function(e) {
    syncInput(this)
});

$(".sidebar--section input").on("change", function(e) {
    updateSetting($(this).attr("name"), $(this).val())
});

$(".input--toggle").click(function(){
    var input = $(this).children("input");
    console.log(input.attr("value"))
    input.attr("value", (input.attr("value") == "true" ? "false" : "true"))
    
    syncInput(this)
});

function syncInput(elem) {
    if($(elem).hasClass("input--toggle")) {
        $(elem).attr("data-value", $(elem).children("input").eq(0).attr("value"))
        updateSetting($(elem).attr("data-linked"), $(elem).children("input").eq(0).attr("value"))
    }
    if($(elem).attr("data-action")) {
        window[$(elem).attr("data-action")](elem)
    }
};



var defaultSettings = {
    resize: {
        width: "",
        height: "",
        crop: false
    },
    jpg: {
        quality: 85,
        make: false
    },
    png: {
        qualityMin: 50,
        qualityMax: 99
    },
    gif: {
        colors: 128
    },
    webp: {
        quality: 99,
        make: false,
        only: false
    },
    app: {
        overwite: false,
        darkMode: false
    }
}


var getSettings = function() {
    var encoded = localStorage.getItem("settings");
    var parsed = JSON.parse(encoded);
    var merged = Object.assign(defaultSettings, parsed);
    return merged;
}

function writeSettings() {
    var encoded = JSON.stringify(settings);
    localStorage.setItem("settings", encoded);
}

var settings = getSettings();


function updateSetting(setting, value) {
    var keys = setting.split(".");
    if(keys.length == 1)
        settings[keys[0]] = value;
    else if(keys.length == 2)
        settings[keys[0]][keys[1]] = value;
    else if(keys.length == 3)
        settings[keys[0]][keys[1]][keys[2]] = value;

    writeSettings();
}

$(".sidebar--section input").each(function(e) {
    var input = $(this);
    var settingKeys = input.attr("name").split(".");
    var arr = settings;
    for(var i = 0; i < settingKeys.length; i++) {
        arr = arr[settingKeys[i]];
    }
    $(this).val(arr);
});
$("[data-linked]").each(function() {
    syncInput(this);
})


function toggleDarkMode(elem) {
    $("body").attr("data-theme", ($(elem).attr("data-value") == "true" ? "dark" : "light"))
}









$(".action--download-all").click(function(){
    var that = this;
    var formData = new FormData();
    var filesList = [];
    
    for(var i = 0; i < files.list.length; i++) {
        if(files.list[i].status == "done") {
            filesList.push({
                name: files.list[i].name,
                uuid: files.list[i].uuid
            });
        }
    }

    console.log(JSON.stringify(filesList))
    formData.append("files", JSON.stringify(filesList))

    $.ajax({
        type: "POST",
        url: "/zip",
        xhr: function () {
            var myXhr = $.ajaxSettings.xhr();
            //myXhr.upload.file = file;
            //myXhr.upload.callback = that.callback;
            //myXhr.upload.upload = that;
            if (myXhr.upload) {
                //myXhr.upload.addEventListener('progress', that.progressHandling, false);
            }
            return myXhr;
        },
        success: function (data) {
            console.log(data)
            window.location = data.dl
        },
        error: function (error) {
            console.log(error)
        },
        async: true,
        data: formData,
        cache: false,
        contentType: false,
        processData: false,
        timeout: 60000
    });
});



$(".action--recompress").click(function(){
    
    for(var i = 0; i < files.list.length; i++) {
        if(files.list[i].status == "done") {
            recrush(files.list[i])
        }
    }
    
});








function recrush(fileObj) {
    var that = this;
    var formData = new FormData();
    formData.append("uuid", fileObj.uuid);
    formData.append("settings", JSON.stringify(settings))


    fileObj.setStatus("crushing")

    $.ajax({
        type: "POST",
        url: "/recrush",
        xhr: function () {
            var myXhr = $.ajaxSettings.xhr();
            //myXhr.upload.file = file;
            //myXhr.upload.callback = that.callback;
            //myXhr.upload.upload = that;
            if (myXhr.upload) {
                //myXhr.upload.addEventListener('progress', that.progressHandling, false);
            }
            return myXhr;
        },
        success: function (data) {
            console.log(data)
            UploadedFileCallback(data, fileObj)
        },
        error: function (error) {
            console.log(error)
        },
        async: true,
        data: formData,
        cache: false,
        contentType: false,
        processData: false,
        timeout: 60000
    });
}