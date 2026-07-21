const {
Client
}=require(
"minecraft-launcher-core"
);


const fs=require("fs-extra");


const paths=require("./paths");

const {
checkJava
}=require("./java");




async function launchMinecraft(){



const java =
checkJava();



if(!java.installed){


throw new Error(
"Java가 설치되어 있지 않습니다."
);


}




await fs.ensureDir(
paths.logs
);



const launcher =
new Client();



const opts={



authorization:{


access_token:"",

client_token:"",

uuid:"Offline",

name:"ZombiePlayer"


},



root:

paths.minecraft,



version:{


number:"1.21.1",


type:"release"


},



forge:"21.1.232",



memory:{


max:6144,


min:2048


},



javaPath:"java"

};




launcher.on(
"debug",
(message)=>{


console.log(
"[MC]",
message
);


});



launcher.on(
"data",
(message)=>{


console.log(
message
);


});



launcher.launch(opts);



}



module.exports={
launchMinecraft
};