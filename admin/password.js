const crypto=require("crypto");


const ADMIN_PASSWORD_HASH =
"CHANGE_PASSWORD_HASH";



function checkPassword(password){


const hash =
crypto
.createHash("sha256")
.update(password)
.digest("hex");



return hash===ADMIN_PASSWORD_HASH;


}



module.exports={
checkPassword
};