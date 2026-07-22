// renderer.js


window.addEventListener(
"DOMContentLoaded",
async()=>{


// ==============================
// Elements
// ==============================


const playBtn =
document.getElementById("play-btn");


const profileBtn =
document.getElementById("profile-btn");


const discordBtn =
document.getElementById("discord-btn");


const settingBtn =
document.getElementById("setting-btn");



const minimizeBtn =
document.getElementById("minimize-btn");


const maximizeBtn =
document.getElementById("maximize-btn");


const closeBtn =
document.getElementById("close-btn");



const nickname =
document.getElementById("nickname");


const profileImage =
document.getElementById("profile-image");




// ==============================
// Window
// ==============================


if(minimizeBtn){

minimizeBtn.onclick=()=>{

window.api.minimize();

};

}



if(maximizeBtn){

maximizeBtn.onclick=()=>{

window.api.maximize();

};

}



if(closeBtn){

closeBtn.onclick=()=>{

window.api.close();

};

}





// ==============================
// Profile
// ==============================


function setProfile(account){


if(!account)
return;



nickname.innerText =
account.name || "Player";



if(profileImage){


const uuid =
account.uuid ||
account.id;



if(uuid){


profileImage.src =
`https://mc-heads.net/avatar/${uuid}/128`;


}
else{


profileImage.src =
"./assets/default.png";


}


}


}




async function loadAccount(){


const account =
await window.launcher.getAccount();



if(account){

setProfile(account);

}
else{


if(nickname)
nickname.innerText =
"오프라인";


}


}



loadAccount();






// ==============================
// Login
// ==============================


if(profileBtn){


profileBtn.onclick =
async()=>{


const result =
await window.launcher.login();



if(result.success){


setProfile(
result.account
);


}
else{


alert(
result.message ||
"로그인 실패"
);


}



};



}




window.launcher.onLoginSuccess(

(account)=>{


setProfile(account);


}

);







// ==============================
// PLAY
// ==============================


if(playBtn){


playBtn.onclick =
async()=>{


playBtn.innerText =
"실행중...";



const result =
await window.launcher.play();



if(!result.success){


alert(
result.message
);


}



playBtn.innerText =
"PLAY";



};


}







// ==============================
// Discord
// ==============================


if(discordBtn){


discordBtn.onclick =
async()=>{


const config =
await window.launcher.loadLauncherConfig();



if(config.discord){


window.api.openExternal(
config.discord
);


}
else{


alert(
"관리자에서 Discord 주소를 설정해주세요."
);


}



};


}









// ==============================
// Settings
// ==============================


const settingsModal =
document.getElementById(
"settings-modal"
);



const settingsClose =
document.getElementById(
"settings-close"
);



const saveSettings =
document.getElementById(
"save-settings"
);



const logoutBtn =
document.getElementById(
"logout-btn"
);



const minRam =
document.getElementById(
"min-ram"
);



const maxRam =
document.getElementById(
"max-ram"
);





if(settingBtn){


settingBtn.onclick =
async()=>{


const settings =
await window.launcher.loadSettings();



if(minRam)
minRam.value =
settings.minRam;



if(maxRam)
maxRam.value =
settings.maxRam;



if(settingsModal)
settingsModal.style.display =
"flex";



};


}






if(settingsClose){


settingsClose.onclick=()=>{


settingsModal.style.display =
"none";


};


}






if(saveSettings){


saveSettings.onclick =
async()=>{


await window.launcher.saveSettings({


minRam:
Number(minRam.value),


maxRam:
Number(maxRam.value)



});



alert(
"설정 저장 완료"
);



};



}







if(logoutBtn){


logoutBtn.onclick =
async()=>{


await window.launcher.logout();



if(nickname)
nickname.innerText =
"오프라인";



settingsModal.style.display =
"none";


};


}








// ==============================
// NEWS
// ==============================


const newsBtn =
document.getElementById(
"news-btn"
);


const newsPanel =
document.getElementById(
"news-panel"
);


const newsClose =
document.getElementById(
"news-close"
);


const newsContent =
document.getElementById(
"news-content"
);



if(newsBtn){


newsBtn.onclick =
async()=>{


console.log(
"NEWS BUTTON CLICK"
);



const config =
await window.launcher.loadLauncherConfig();



console.log(
"NEWS CONFIG:",
config
);





if(newsContent){


newsContent.innerHTML =

config.news ||

"새로운 소식이 없습니다.";



}



if(newsPanel){

newsPanel.classList.add(
"active"
);


}



};



}






if(newsClose){


newsClose.onclick =
()=>{


newsPanel.classList.remove(
"active"
);


};


}







// ==============================
// Admin Shortcut
// CTRL + SHIFT + A
// ==============================


document.addEventListener(

"keydown",

async(e)=>{


if(

e.ctrlKey &&

e.shiftKey &&

e.key.toUpperCase()==="A"

){



const input =
document.createElement(
"input"
);



input.type =
"password";


input.placeholder =
"관리자 비밀번호";



input.style.position =
"fixed";


input.style.top =
"50%";


input.style.left =
"50%";


input.style.transform =
"translate(-50%,-50%)";


input.style.zIndex =
"9999";


input.style.padding =
"15px";


input.style.fontSize =
"18px";



document.body.appendChild(
input
);



input.focus();




input.onkeydown =
async(ev)=>{


if(ev.key==="Enter"){



const result =
await window.launcher.adminLogin(
input.value
);



input.remove();



if(result){


window.api.openAdmin();


}
else{


alert(
"비밀번호 오류"
);


}



}


};



}



}

);



});

const updateStatus = document.getElementById("update-status");

window.launcher.onProgress((progress, name) => {
    if (!updateStatus) return;
    const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
    updateStatus.textContent = percent >= 100
        ? "콘텐츠 동기화 완료"
        : `콘텐츠 다운로드 ${percent}%${name ? ` · ${name}` : ""}`;
});
