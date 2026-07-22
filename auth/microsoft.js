const {
    BrowserWindow
} = require("electron");

const axios = require("axios");
const http = require("http");


const {
    xboxLogin
} = require("./xbox");


const {
    xstsLogin
} = require("./xsts");


const {
    minecraftLogin,
    profile
} = require("./minecraft");



const CLIENT_ID =
"219e3606-4a8f-4d80-9eb8-6d381dc45c2b";


const REDIRECT_URI =
"http://127.0.0.1:4567/callback";





function microsoftLogin(){


return new Promise(
(resolve,reject)=>{


const server =
http.createServer(
async(req,res)=>{


if(req.url.startsWith("/callback")){


const callbackURL =
new URL(
    req.url,
    REDIRECT_URI
);



const code =
callbackURL.searchParams.get(
    "code"
);



console.log(
"CALLBACK RECEIVED"
);



if(!code){

reject(
new Error(
"Microsoft 인증 코드 없음"
)
);

return;

}




res.writeHead(
200,
{
"Content-Type":
"text/html; charset=utf-8"
}
);



res.end(`

<html>

<body>

<h2>
ZombieLauncher 로그인 완료
</h2>

<p>
창을 닫아주세요.
</p>

</body>

</html>

`);




server.close();





try{


console.log(
"STEP 1 : MICROSOFT CODE OK"
);



const microsoftToken =
await exchangeCode(
code
);



console.log(
"STEP 2 : MICROSOFT TOKEN OK"
);





const xbox =
await xboxLogin(
microsoftToken
);



console.log(
"STEP 3 : XBOX TOKEN OK"
);





const xsts =
await xstsLogin(
xbox
);



console.log(
"STEP 4 : XSTS TOKEN OK"
);





const minecraft =
await minecraftLogin(
xsts
);



console.log(
"STEP 5 : MINECRAFT TOKEN OK"
);





const user =
await profile(
minecraft.access_token
);



console.log(
"STEP 6 : PROFILE OK"
);






const account = {

name:user.name,

uuid:user.id,

minecraftToken:minecraft.access_token,

accessToken:minecraft.access_token,

xuid:
xbox.DisplayClaims.xui[0].xid,

userType:"msa",

clientId:CLIENT_ID,

profile:{
 id:user.id,
 name:user.name
}

};





console.log(
"ACCOUNT CREATED",
account
);





resolve(
account
);




}
catch(error){


console.error(
"LOGIN ERROR",
error.response?.data ||
error.message
);



reject(
error
);



}



}



}


);






server.listen(
4567,
"127.0.0.1",
()=>{


console.log(
"OAuth callback server : 4567"
);


}

);







const win =
new BrowserWindow({

width:500,

height:700,

resizable:false,


webPreferences:{

nodeIntegration:false,

contextIsolation:true,

sandbox:false

}

});





const params =
new URLSearchParams({


client_id:
CLIENT_ID,


response_type:
"code",


redirect_uri:
REDIRECT_URI,


response_mode:
"query",


scope:
"XboxLive.signin offline_access openid profile"


});





const loginURL =
"https://login.live.com/oauth20_authorize.srf?"
+
params.toString();





console.log(
"LOGIN URL:",
loginURL
);





win.loadURL(
loginURL
);





}

);

}



async function exchangeCode(code){



const body =
new URLSearchParams({


client_id:
CLIENT_ID,


code:
code,


grant_type:
"authorization_code",


redirect_uri:
REDIRECT_URI



});





const response =
await axios.post(


"https://login.live.com/oauth20_token.srf",


body.toString(),



{

headers:{

"Content-Type":
"application/x-www-form-urlencoded"

}

}



);




return response.data.access_token;



}






module.exports = {

microsoftLogin

};