const {execSync}=require("child_process");



function checkJava(){


try{


let result =
execSync(
"java -version",
{
encoding:"utf8",
stdio:"pipe"
}
);



return {

installed:true,
version:result

};



}

catch(error){


return {

installed:false,
version:null

};


}


}



module.exports={
checkJava
};