const express=require(
"express"
);


function createPanel(){


const router=
express.Router();



router.get(
"/status",
(req,res)=>{


res.json({

server:
"online",

launcher:
"ZombieLauncher"

});


});



return router;


}



module.exports={
createPanel

};