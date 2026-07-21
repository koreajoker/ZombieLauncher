const axios = require("axios");
const { BrowserWindow } = require("electron");



const CLIENT_ID =
"219e3606-4a8f-4d80-9eb8-6d381dc45c2b";



async function microsoftLogin(){


return new Promise((resolve,reject)=>{


const authWindow =
new BrowserWindow({

width:500,

height:700,

webPreferences:{

nodeIntegration:false

}

});



const url =
"https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?"
+
new URLSearchParams({

client_id:CLIENT_ID,

response_type:"code",

redirect_uri:
"https://login.live.com/oauth20_desktop.srf",

scope:
"XboxLive.signin offline_access",

response_mode:"query"


});



authWindow.loadURL(url);



authWindow.webContents.on(
"will-redirect",
async(event,newURL)=>{


if(newURL.includes("code=")){


event.preventDefault();


const code =
new URL(
newURL
).searchParams.get(
"code"
);



authWindow.close();



try{


const account =
await exchangeCode(code);


resolve(account);



}

catch(error){

reject(error);

}


}


});


});


}





async function exchangeCode(code){


/*

Microsoft
↓
Xbox Live
↓
XSTS
↓
Minecraft Token

추후 실제 인증 구현

*/


return {


username:
"Microsoft User",


uuid:
"",

accessToken:
code


};


}



module.exports={

microsoftLogin

};