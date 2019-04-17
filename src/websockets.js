


var ws = null;
var reconnect = false;
var connecting = false;
function websocketConnect() {
    if (connecting) return false;
    connecting = true
    ws = new WebSocket('ws://' + window.location.host + '/messages');

    ws.onopen = function () {
        console.log('Connected to server!')
        connecting = false
        clearInterval(reconnect)
        sendMessage('check', getAllUUIDS())
    }

    ws.onmessage = function (ev) {
        var data = JSON.parse(ev.data)
        console.log(data)
        if (typeof data.type != "undefined")
            switch (data.type) {
                case "check":
                    checkUUIDs(data.payload);
                    break;
                case "update":
                    var id = files.getFileID(data.payload.uuid)
                    if (id !== false) {
                        for (var key in data.payload.file) {
                            files.list[id][key] = data.payload.file[key]
                        }
                        files.list[id].setStatus(data.payload.file.status)
                    }
                    break;
                case "upload":
                    var id = data.payload.id;
                    for (var key in data.payload.file) {
                        files.list[id][key] = data.payload.file[key]
                    }
                    files.list[id].setStatus(data.payload.file.status)
                    break;
                case "replace":
                    var id = files.getFileID(data.payload.oldUUID)
                    for (var key in data.payload.file) {
                        files.list[id][key] = data.payload.file[key]
                    }
                    files.list[id].setStatus(data.payload.file.status)
                    break;

            }
    }

    ws.onclose = (ev) => {
        console.warn("Lost connection to server.")
        reconnect = setInterval(websocketConnect, 500)
    }

    ws.onerror = (ev) => {
        console.error(ev)
    }

}

const sendMessage = (type, payload = {}) => {
    ws.send(JSON.stringify({
        type,
        payload
    }))
}