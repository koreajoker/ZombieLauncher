const axios=require("axios");

const fs=require("fs-extra");

const path=require("path");


const paths=
require("./paths");



const UPDATE_URL=

"http://SERVER-IP:3000/update";





async function checkUpdate(){



const result=
await axios.get(
UPDATE_URL
);



return result.data;


}




async function downloadFile(
file
){



let folder;



if(
file.type==="mods"
)
folder=
paths.mods;



if(
file.type==="shaderpacks"
)
folder=
paths.shaderpacks;



if(
file.type==="resourcepacks"
)
folder=
paths.resourcepacks;




await fs.ensureDir(
folder
);



const response=
await axios({

url:file.url,

method:"GET",

responseType:"stream"


});



const writer=
fs.createWriteStream(

path.join(
folder,
file.name
)

);



response.data.pipe(
writer
);



return new Promise(
resolve=>{


writer.on(
"finish",
resolve
);


});


}





async function update(){




const data=
await checkUpdate();



for(
const file of data.files
){


await downloadFile(file);


}



return data.version;


}



module.exports={

update

};