document
.getElementById("close")
.onclick=()=>{

window.launcher.close();

};



document
.getElementById("min")
.onclick=()=>{

window.launcher.minimize();

};




document
.getElementById("loginButton")
.onclick=async()=>{


const result =
await window.launcher.login();



if(result.success){


document
.getElementById("username")
.innerText =
result.account.username;



document
.getElementById("status")
.innerText =
"Online";


document
.getElementById("loginButton")
.innerText =
"LOGOUT";


}


};





window.onload=async()=>{


const account =
await window.launcher.getAccount();



if(account){


document
.getElementById("username")
.innerText =
account.username;


document
.getElementById("status")
.innerText =
"Online";


document
.getElementById("loginButton")
.innerText =
"LOGOUT";


}


};
window.onload=async()=>{


const update=
await window.launcher.checkUpdate();



if(update.success){


console.log(
"Updated:",
update.version
);


}



};