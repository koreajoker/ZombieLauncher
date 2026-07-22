const {
generate
}=require("./generator");



function adminAPI(app){



app.post(
"/admin/generate",

async(req,res)=>{


await generate();


res.json({

success:true

});


});


}



module.exports={
adminAPI
};