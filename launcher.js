const { Client } = require("minecraft-launcher-core");


const launcher = new Client();


function start(){

    const opts = {

        authorization:{
            access_token: global.minecraftToken,

            client_token:"",
            
            uuid:global.minecraftProfile.id,

            name:global.minecraftProfile.name

        },


        root:
        "./minecraft",


        version:{
            number:"1.20.1",
            type:"release"
        },


        memory:{
            max:"4G",
            min:"2G"
        }

    };


    launcher.launch(opts);


    launcher.on(
        "debug",
        (e)=>{
            console.log(e);
        }
    );


    launcher.on(
        "data",
        (e)=>{
            console.log(e);
        }
    );


}


module.exports={
    start
};