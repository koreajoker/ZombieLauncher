const axios = require("axios");


async function xstsLogin(
    xbox
){


    try{


        const response =
        await axios.post(

            "https://xsts.auth.xboxlive.com/xsts/authorize",


            {


                Properties:{


                    SandboxId:
                    "RETAIL",


                    UserTokens:[

                        xbox.Token

                    ]


                },


                RelyingParty:
                "rp://api.minecraftservices.com/",


                TokenType:
                "JWT"


            },


            {

                headers:{

                    "Content-Type":
                    "application/json"

                }

            }


        );


console.log(JSON.stringify(response.data,null,2));

        console.log(
            "XSTS RESPONSE:",
            response.data
        );



        return response.data;


    }


    catch(error){


        console.error(
            "XSTS ERROR"
        );


        console.error(
            error.response?.data ||
            error.message
        );


        throw error;


    }


}



module.exports={

    xstsLogin

};