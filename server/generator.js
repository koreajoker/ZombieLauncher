const fs=require("fs-extra");

const crypto=require("crypto");

const path=require("path");



const ROOT=
path.join(
__dirname,
"storage"
);



async function generate(){


let files=[];



async function scan(folder,type){


const dir=
path.join(
ROOT,
type
);



if(
!fs.existsSync(dir)
)
return;



const list=
await fs.readdir(
dir
);



for(
const file of list
){


const full=
path.join(
dir,
file
);



const hash=
crypto
.createHash("sha256")
.update(
await fs.readFile(full)
)
.digest("hex");



files.push({


name:file,


type:type,


sha256:hash,


url:
`/files/${type}/${file}`


});


}


}



await scan(
ROOT,
"mods"
);


await scan(
ROOT,
"shaders"
);


await scan(
ROOT,
"resourcepacks"
);



await fs.writeJson(

path.join(
ROOT,
"update.json"
),

{


version:
Date.now()
.toString(),


files

},


{
spaces:4
}

);


}



module.exports={
generate
};