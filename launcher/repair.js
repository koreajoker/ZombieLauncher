const fs=require("fs-extra");

const paths=require("./paths");



async function repair(){


const folders=[


paths.root,


paths.minecraft,


paths.mods,


paths.shaderpacks,


paths.resourcepacks,


paths.logs,


paths.config


];



for(
const folder of folders
){


await fs.ensureDir(folder);


}


return true;


}



module.exports={
repair
};