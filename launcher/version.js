const axios=require("axios");


const CURRENT_VERSION=
"1.0.0";


const VERSION_SERVER=

"http://SERVER-IP:3000/version.json";



async function checkLauncherVersion(){


const result=
await axios.get(
VERSION_SERVER
);



return {


current:
CURRENT_VERSION,


latest:
result.data.launcherVersion,


update:
CURRENT_VERSION !== result.data.launcherVersion


};


}



module.exports={
checkLauncherVersion
};