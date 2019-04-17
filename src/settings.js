








function syncInput(elem) {
    if ($(elem).hasClass("input--toggle")) {
        $(elem).attr("data-value", $(elem).children("input").eq(0).attr("value"))
        updateSetting($(elem).attr("data-linked"), $(elem).children("input").eq(0).attr("value"))
    }
    if ($(elem).attr("data-action")) {
        try {
            window[$(elem).attr("data-action")](elem)
        } catch(e) {
            console.log($(elem).attr("data-action"))
        }
        
    }
};

function toggleDarkMode(elem) {
    $("body").attr("data-theme", ($(elem).attr("data-value") == "true" ? "dark" : "light"))
}
window.toggleDarkMode = toggleDarkMode


function changePreset(elem) {
    var newPreset = $(elem).val()
    if (newPreset != settings.app.qualityPreset) {
        settings.app.qualityPreset = newPreset
        loadPreset(settings.app.qualityPreset)
    }
}
window.changePreset = changePreset

var loadingPreset = false;
function loadPreset(idx) {
    if (loadingPreset) return false;
    settings.jpg = Object.assign(settings.jpg, qualityPresets[idx].jpg)
    settings.png = Object.assign(settings.png, qualityPresets[idx].png)
    settings.webp = Object.assign(settings.webp, qualityPresets[idx].webp)
    loadingPreset = true
    readAllInputSources()
    loadingPreset = false
}


function toggleAdvancedQuality() {
    if (settings.app.advancedQuality == "false") {
        //$(".sidebar--section .quality-basic").removeClass("hide")
        $(".sidebar--section .quality-advanced").addClass("hide")
        loadPreset(settings.app.qualityPreset)
    } else {
        // $(".sidebar--section .quality-basic").addClass("hide")
        $(".sidebar--section .quality-advanced").removeClass("hide")
    }
}
window.toggleAdvancedQuality = toggleAdvancedQuality


var defaultSettings = {
    resize: {
        width: "",
        height: "",
        crop: false
    },
    jpg: {
        quality: 95,
        make: false,
        subsampling: 1,
        useOriginal: false
    },
    png: {
        qualityMin: 50,
        qualityMax: 95
    },
    gif: {
        colors: 128
    },
    webp: {
        quality: 90,
        make: false,
        only: false
    },
    app: {
        qualityPreset: 4,
        advancedQuality: "false",
        overwite: false,
        darkMode: false
    }
}



const qualityPresets = [
    // Low
    {
        jpg: {
            quality: 77,
            subsampling: 3,
            useOriginal: false
        },
        png: {
            qualityMin: 1,
            qualityMax: 75
        },
        webp: {
            quality: 70
        }
    },
    // Medium
    {
        jpg: {
            quality: 85,
            subsampling: 2,
            useOriginal: false
        },
        png: {
            qualityMin: 10,
            qualityMax: 85
        },
        webp: {
            quality: 88
        }
    },
    // High
    {
        jpg: {
            quality: 94,
            subsampling: 2,
            useOriginal: false
        },
        png: {
            qualityMin: 15,
            qualityMax: 95
        },
        webp: {
            quality: 92
        }
    },
    // Lossless-ish
    {
        jpg: {
            quality: 95,
            subsampling: 1,
            useOriginal: false
        },
        png: {
            qualityMin: 25,
            qualityMax: 98
        },
        webp: {
            quality: 95
        }
    },
]


var getSettings = function () {
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
    if (keys.length == 1)
        settings[keys[0]] = value;
    else if (keys.length == 2)
        settings[keys[0]][keys[1]] = value;
    else if (keys.length == 3)
        settings[keys[0]][keys[1]][keys[2]] = value;

    writeSettings();
}

function readAllInputSources() {
    $(".sidebar--section input").each(function (e) {
        var input = $(this);
        var settingKeys = input.attr("name").split(".");
        var arr = settings;
        for (var i = 0; i < settingKeys.length; i++) {
            arr = arr[settingKeys[i]];
        }
        $(this).val(arr);
    });
    resyncAllInputs();
}



function resyncAllInputs() {
    $("[data-linked]").each(function () {
        syncInput(this)
    });
}
