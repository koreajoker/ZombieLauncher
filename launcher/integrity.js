const crypto=require("crypto");

const fs=require("fs-extra");



function hashFile(file){


return new Promise(
(resolve,reject)=>{


const hash=
crypto.createHash(
"sha256"
);


const stream=
fs.createReadStream(file);



stream.on(
"data",
data=>hash.update(data)
);



stream.on(
"end",
()=>resolve(
hash.digest("hex")
)
);



stream.on(
"error",
reject
);



});


}



async function verifyFile(
file,
hash
){


const current=
await hashFile(file);



return current===hash;


}



module.exports={

hashFile,

verifyFile

};