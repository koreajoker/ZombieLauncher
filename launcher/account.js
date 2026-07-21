const fs=require("fs-extra");

const paths=require("./paths");

const path=
require("path");



const accountFile=
path.join(
paths.zombie,
"config",
"account.json"
);



function saveAccount(data){


fs.ensureDirSync(
path.dirname(accountFile)
);



fs.writeJsonSync(
accountFile,
data,
{
spaces:4
}

);


}




function getAccount(){


if(
!fs.existsSync(accountFile)
){

return null;

}



return fs.readJsonSync(
accountFile
);


}



function removeAccount(){


if(
fs.existsSync(accountFile)
){

fs.removeSync(accountFile);

}


}



module.exports={

saveAccount,

getAccount,

removeAccount

};