

export let files = {
    add: function (data) {
        var file = {
            id: this.getID(),
            name: data.name || 'Unknown file',
            originalName: data.name || 'Unknown file',
            status: 'uploading',
            startSize: 0,
            endSize: 0,
            setStatus,
            setFilename,
            path: data.path || false,
            bind: function () {
                this.elem = $(".elem--file[data-id='" + this.id + "']")
                this.elem.find('.actions .save-button').click(actionSaveButton)
                this.elem.find('.actions .more-button').click(actionMoreButton)
                this.elem.find('.preview').click(showComparison)
            },
            elem: false,
            menuItemID: -1
        }
        this.list.push(file)
        return file
    },
    list: [],
    nextID: 0,
    getFormattedPercent,
    getFormattedSize,
    updateTotals,
    getID: function () { return this.nextID++ },
    getFileID: function (uuid) {
        var id = false
        for (var i = 0; i < files.list.length; i++) {
            if (files.list[i].uuid == uuid) {
                id = i
                break
            }
        }
        return id
    }
}


function setFilename(filename) {
    this.elem.find(".title").text(filename);
}

function setStatus(inStatus, context = this) {
    console.log(inStatus)
    let status = inStatus.toLowerCase()
    context.status = status
    context.elem.attr('data-status', status)
    if (status === "done") {
        var size = getFormattedSize(context.endSize)
        var percent = getFormattedPercent
        context.elem.find('.preview img').attr('src', context.preview)
        context.elem.find('.details .title').text(context.filename)
        context.elem.find('.details .subtitle').html(`<span>${size}</span><span>&centerdot;</span><span class="bold">${percent(context.startSize, context.endSize)}</span>`)
        updateTotals()
    } else if (status === "error") {
        context.elem.find('.details .subtitle').html(`<span class="bold error">Error: Could not process context file</span>`)
    } else if (status === "crushing") {
        context.elem.find('.details .subtitle').html(`<span class="bold">Crushing...</span>`)
    } else if (status === "deleted") {
        var foundDeleted = false
        for (var i = 0; i < files.list.length; i++) {
            if (files.list[i].status != "deleted") {
                foundDeleted = true
                break
            }
        }
        if (!foundDeleted) {
            clearAllFiles()
        }
    }
}

function getFormattedSize(size) {
    let absSize = Math.abs(size);
    let outSize = size;
    if (absSize < 1000) {
        // bytes
        outSize = size + " bytes"
    } else if (absSize < 1000 * 1000) {
        // KB
        outSize = (size / 1000).toFixed(1) + "KB"
    } else if (absSize < 1000 * 1000 * 1000) {
        // MB
        outSize = (size / (1000 * 1000)).toFixed(1) + "MB"
    }
    return outSize
}

function getFormattedPercent(start, end) {
    if (start == 0 || end == 0)
        return "0%"
    if (start < end) {
        return ((100 + ((end / start) * 100)).toFixed(0) + "% larger")
    } else {
        return ((100 - ((end / start) * 100)).toFixed(0) + "% smaller")
    }

}


function updateTotals() {
    var totalStart = 0;
    var totalEnd = 0;
    for (var i in files.list) {
        totalStart += files.list[i].startSize
        totalEnd += files.list[i].endSize
    }

    var size = getFormattedSize(totalStart - totalEnd)
    var percent = getFormattedPercent(totalStart, totalEnd);
    $(".page--files--after-list .totals").html(`Total saved: ${size} &middot; <span>${percent}</span>`)
}


