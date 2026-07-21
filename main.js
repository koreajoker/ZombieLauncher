const {
    app,
    BrowserWindow,
    ipcMain
} = require("electron");

const {
launchMinecraft
}=require("./launcher/minecraft");

const path = require("path");
const fs = require("fs-extra");

const {
microsoftLogin
}=require("./auth/microsoft");

const {
BrowserWindow,
dialog
}=require("electron");


const {
checkPassword
}=require("./admin/password");


const {
uploadFile
}=require("./admin/uploader");

const {

update

}=require(
"./launcher/updater"
);


const {

saveAccount,

getAccount,

removeAccount

}=require("./launcher/account");


let mainWindow;


function createWindow(){

    mainWindow = new BrowserWindow({

        width:1280,
        height:720,

        minWidth:1100,
        minHeight:650,

        frame:false,

        backgroundColor:"#050505",

        webPreferences:{
            preload:path.join(__dirname,"preload.js"),
            nodeIntegration:false,
            contextIsolation:true
        }

    });


    mainWindow.loadFile(
        path.join(
            __dirname,
            "src",
            "renderer",
            "index.html"
        )
    );

}



function createZombieFolder(){

    const folder = path.join(
        app.getPath("home"),
        ".ZombieLauncher"
    );


    fs.ensureDirSync(folder);


    fs.ensureDirSync(
        path.join(folder,"config")
    );


    fs.ensureDirSync(
        path.join(folder,"minecraft")
    );


    fs.ensureDirSync(
        path.join(folder,"minecraft","mods")
    );


    fs.ensureDirSync(
        path.join(folder,"minecraft","shaderpacks")
    );


    fs.ensureDirSync(
        path.join(folder,"minecraft","resourcepacks")
    );


}



app.whenReady()
.then(()=>{


    createZombieFolder();

    createWindow();


});

globalShortcut.register(

"Control+Shift+A",

()=>{


openAdmin();


}

);

ipcMain.on(
    "window-close",
    ()=>{
        mainWindow.close();
    }
);



ipcMain.on(
    "window-minimize",
    ()=>{
        mainWindow.minimize();
    }
);

ipcMain.handle(
"minecraft-launch",
async()=>{


try{


await launchMinecraft();


return {

success:true

};


}

catch(error){


return {


success:false,

message:error.message


};


}


});

ipcMain.handle(

"login-microsoft",

async()=>{


try{


const account =
await microsoftLogin();


saveAccount(account);



return {


success:true,


account

};


}

catch(error){


return {


success:false,


message:error.message

};


}



});


ipcMain.handle(

"get-account",

()=>{


return getAccount();


});



ipcMain.handle(

"logout",

()=>{


removeAccount();


return true;


});

function openAdmin(){


const adminWindow=
new BrowserWindow({

width:900,

height:600,

webPreferences:{


preload:path.join(
__dirname,
"preload.js"
),

nodeIntegration:false,

contextIsolation:true

}


});



adminWindow.loadFile(

path.join(

__dirname,

"src",

"renderer",

"admin",

"admin.html"

)

);


}

ipcMain.handle(

"admin-login",

(event,password)=>{


if(
checkPassword(password)
){


openAdmin();


return true;


}



return false;


});



ipcMain.handle(

"upload-content",

async(event,data)=>{


return await uploadFile(

data.path,

data.type

);

globalShortcut=require(
"electron"
).globalShortcut;


});

ipcMain.handle(

"check-update",

async()=>{


try{


const version=
await update();



return {


success:true,

version

};



}

catch(error){


return {


success:false,

message:error.message

};


}



});