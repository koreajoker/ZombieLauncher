const axios = require("axios");


async function xboxLogin(
    microsoftToken
){


    const response =
    await axios.post(

        "https://user.auth.xboxlive.com/user/authenticate",

        {

            Properties:{

                AuthMethod:
                "RPS",

                SiteName:
                "user.auth.xboxlive.com",

                RpsTicket:
                `d=${microsoftToken}`

            },


            RelyingParty:
            "http://auth.xboxlive.com",

            TokenType:
            "JWT"

        },

        {

            headers:{

                "Content-Type":
                "application/json",

                Accept:
                "application/json"

            }

        }

    );


    console.log(
        "XBOX LOGIN SUCCESS"
    );


    return response.data;


}



module.exports={
    xboxLogin
};