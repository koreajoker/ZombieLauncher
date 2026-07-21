const express=require("express");

const cors=require("cors");

const fs=require("fs-extra");

const path=require("path");


const app=
express();



app.use(cors());

app.use(
express.json()
);



const STORAGE=
path.join(
__dirname,
"storage"
);



app.use(
"/files",
express.static(STORAGE)
);



app.get(
"/update",
(req,res)=>{


const file=
path.join(
STORAGE,
"update.json"
);



if(
!fs.existsSync(file)
){


return res.json({

version:"1.0.0",

files:[]

});


}



res.sendFile(file);



});




app.listen(
3000,
()=>{


console.log(
"ZombieLauncher Update Server : 3000"
);


});