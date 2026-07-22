const crypto=require("crypto");


const algorithm="aes-256-cbc";


function createKey(){

return crypto
.createHash("sha256")
.update(
"ZombieLauncher-Key"
)
.digest();

}



function encrypt(text){


const iv=
crypto.randomBytes(16);


const cipher=
crypto.createCipheriv(
algorithm,
createKey(),
iv
);



let encrypted=
cipher.update(
text,
"utf8",
"hex"
);


encrypted+=
cipher.final("hex");



return {

iv:
iv.toString("hex"),

data:
encrypted

};


}



function decrypt(obj){


const decipher=
crypto.createDecipheriv(

algorithm,

createKey(),

Buffer.from(
obj.iv,
"hex"
)

);



let result=
decipher.update(
obj.data,
"hex",
"utf8"
);



result+=
decipher.final(
"utf8"
);



return result;


}



module.exports={

encrypt,

decrypt

};