const fs=require("fs-extra");
const path=require("path");

const paths=require("./paths");


function writeLog(type,message){


fs.ensureDirSync(
paths.logs
);


const file=
path.join(
paths.logs,
"launcher.log"
);


const time=
new Date()
.toISOString();



const text=
`[${time}]
[${type}]
${message}

`;



fs.appendFileSync(
file,
text
);


}



module.exports={

writeLog

};