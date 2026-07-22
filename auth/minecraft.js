const axios = require("axios");


async function minecraftLogin(xstsResponse){

    try{


        const uhs =
        xstsResponse.DisplayClaims
        .xui[0]
        .uhs;


        const xstsToken =
        xstsResponse.Token;



        const identityToken =
        `XBL3.0 x=${uhs};${xstsToken}`;



        console.log(
            "MINECRAFT IDENTITY TOKEN CREATED"
        );



        const response =
        await axios.post(

            "https://api.minecraftservices.com/authentication/login_with_xbox",

            {
                identityToken
            },

            {
                headers:{
                    "Content-Type":
                    "application/json"
                }
            }

        );


        console.log(
            "MINECRAFT LOGIN SUCCESS"
        );


        return response.data;


    }

    catch(error){

        console.log(
            "MINECRAFT LOGIN ERROR"
        );


        console.log(
            error.response?.data ||
            error.message
        );


        throw error;

    }

}



async function profile(accessToken){


    const response =
    await axios.get(

        "https://api.minecraftservices.com/minecraft/profile",

        {
            headers:{
                Authorization:
                `Bearer ${accessToken}`
            }
        }

    );


    return response.data;


}



module.exports={

    minecraftLogin,

    profile

};