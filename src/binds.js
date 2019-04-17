
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
    console.log(files)

    for (var i = 0, file; file = files[i]; i++) {
        console.log(file)
        var upload = new Upload(file, UploadedFileCallback);
        var fileData = fileUploading(file)
        upload.doUpload(fileData);
    }

    return false;
});




var forcingFileNameChange = false;
$("#file").on("change", function (e) {
    if (forcingFileNameChange) {
        forcingFileNameChange = false;
        return false;
    }

    var files = e.target.files;

    for (var i = 0, file; file = files[i]; i++) {
        var upload = new Upload(file, UploadedFileCallback);
        var fileData = fileUploading(file)
        upload.doUpload(fileData);
    }

    // Reset so we can pick the same one again, if desired
    $("#file").val("")

});
$(".action--add-file").click(function (e) {
    e.preventDefault();
    openFilePicker()
    return false;
});





$(".action--reset-settings").click(function (e) {
    console.log("Resetting settings")
    e.preventDefault();
    localStorage.clear();
    location.reload();
    return false;
});




$(".page--comparison").click(function () {
    $(this).removeClass("show")
})

var beforeElem = $(".divider-wrap")
$(".page--comparison").mousemove(function (e) {
    beforeElem.width(e.pageX)
})









$("[data-linked]").on("change", function (e) {
    var linkedTo = $(this).attr("data-linked");
    $("input[data-linked='" + linkedTo + "']").val($(this).val());
    syncInput(this)
});

$("[data-linked]").on("input", function (e) {
    var linkedTo = $(this).attr("data-linked");
    $("input[data-linked='" + linkedTo + "']").val($(this).val());
    syncInput(this)
});

$(".input--toggle input").on("change", function (e) {
    syncInput(this)
});

$(".sidebar--section input").on("change", function (e) {
    updateSetting($(this).attr("name"), $(this).val())
});

$(".input--toggle").click(function () {
    var input = $(this).children("input");
    console.log(input.attr("value"))
    input.attr("value", (input.attr("value") == "true" ? "false" : "true"))

    syncInput(this)
});

















$(".action--download-all").click(function () {
    var that = this;
    var formData = new FormData();
    var filesList = [];

    for (var i = 0; i < files.list.length; i++) {
        if (files.list[i].status == "done") {
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
            if (parseBool(settings.app.overwrite) && typeof window.electron != "undefined" && typeof window.electron.download == "function") {
                for (var i = 0; i < files.list.length; i++) {
                    downloadFile(files.list[i])
                }
            } else {
                window.location = data.dl
            }
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





$(".action--clear-all").click(clearAllFiles);





$(".action--display-settings").click(function (e) {
    if ($("body").hasClass("display-settings")) {
        $("body").removeClass("display-settings")
        showBackButton(false)
    } else {
        $("body").addClass("display-settings")
        showBackButton(true)
    }
    $(".sidebar").addClass("animate")
})








$(".action--back-button").click(function (e) {
    if ($("body").hasClass("display-settings")) {
        $("body").removeClass("display-settings")
        showBackButton(false)
    } else if ($(".page--files").hasClass("show")) {
        clearAllFiles()
        showBackButton(false)
    }
})










$(".page--menu-layer .bg").click(function (e) {
    $(".elem--menu").removeClass("active")
})

$(".elem--menu.single-file .download").click(function (e) {
    downloadFile(files.list[files.menuItemID])
    $(".elem--menu").removeClass("active")
})
$(".elem--menu.single-file .recrush").click(function (e) {
    recrush(files.list[files.menuItemID])
    $(".elem--menu").removeClass("active")
})
$(".elem--menu.single-file .remove").click(function (e) {
    deleteUUID(files.list[files.menuItemID].uuid)
    $(".elem--menu").removeClass("active")
})










$(".action--recompress").click(recrushAll);