let login=false;



document
.getElementById("login")
.onclick=async()=>{


login=
await window.launcher.adminLogin(

document
.getElementById("password")
.value

);



if(login){

alert(
"관리자 인증 성공"
);

}


};



document
.getElementById("upload")
.onclick=async()=>{


if(!login){

alert(
"관리자 로그인 필요"
);

return;

}



const file=
document
.getElementById("file")
.files[0];



await window.launcher.uploadContent({

path:file.path,


type:
document
.getElementById("type")
.value


});


alert(
"업로드 완료"
);


};