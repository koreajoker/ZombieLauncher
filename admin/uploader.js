const fs=require("fs-extra");
const path=require("path");


const paths=require("../launcher/paths");



async function uploadFile(
source,
type
){


let target;



if(type==="mods"){

target=paths.mods;

}



if(type==="shaderpacks"){

target=paths.shaderpacks;

}



if(type==="resourcepacks"){

target=paths.resourcepacks;

}



await fs.ensureDir(target);



await fs.copy(
source,
path.join(
target,
path.basename(source)
)
);



return true;


}



module.exports={
uploadFile
};