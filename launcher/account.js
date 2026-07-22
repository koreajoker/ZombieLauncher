// launcher/account.js


const fs = require("fs");
const path = require("path");




// ==============================
// Account File
// ==============================


const DATA_DIR =
path.join(
    process.env.APPDATA,
    "ZombieLauncher"
);



const ACCOUNT_FILE =
path.join(
    DATA_DIR,
    "account.json"
);








// ==============================
// Ensure Folder
// ==============================


function ensureFolder(){


    if(
        !fs.existsSync(DATA_DIR)
    ){


        fs.mkdirSync(

            DATA_DIR,

            {
                recursive:true
            }

        );


    }


}










// ==============================
// Save Account
// ==============================


function saveAccount(account){


    ensureFolder();


    const data = {


        name:
        account.name || "Player",



        uuid:
        account.uuid || "",



        accessToken:
        account.accessToken || "",



        minecraftToken:
        account.minecraftToken || "",



        userType:
        account.userType || "msa",



        xuid:
        account.xuid || "",



        clientId:
        account.clientId || "",



        profile:
        account.profile || {},



        loginTime:
        Date.now()



    };




    fs.writeFileSync(

        ACCOUNT_FILE,

        JSON.stringify(

            data,

            null,

            4

        ),

        "utf8"

    );




    console.log(
        "ACCOUNT SAVED",
        {
            name:data.name,
            uuid:data.uuid,
            token:data.accessToken ?
            "OK" :
            "EMPTY"
        }
    );


}









// ==============================
// Get Account
// ==============================


function getAccount(){



    ensureFolder();




    if(
        !fs.existsSync(ACCOUNT_FILE)
    ){


        return null;


    }





    try{


        return JSON.parse(

            fs.readFileSync(

                ACCOUNT_FILE,

                "utf8"

            )

        );



    }
    catch(error){



        console.error(
            "ACCOUNT LOAD ERROR",
            error
        );



        return null;


    }


}









// ==============================
// Remove Account
// ==============================


function removeAccount(){



    if(
        fs.existsSync(ACCOUNT_FILE)
    ){


        fs.unlinkSync(
            ACCOUNT_FILE
        );


    }



}








module.exports={


    saveAccount,


    getAccount,


    removeAccount


};