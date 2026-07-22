const crypto=require("crypto");

const fs=require("fs-extra");


const file=
"admin/password.hash";



function hash(value){


return crypto
.createHash("sha256")
.update(value)
.digest("hex");


}



function checkPassword(password){


if(
!fs.existsSync(file)
){

return false;

}



const saved =
fs.readFileSync(
file,
"utf8"
);



return hash(password)===saved;


}



function createPassword(password){


fs.writeFileSync(

file,

hash(password)

);


}



module.exports={

checkPassword,

createPassword

};