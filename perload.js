const {
contextBridge,
ipcRenderer
}=require("electron");



contextBridge.exposeInMainWorld(

"launcher",

{


close(){

ipcRenderer.send(
"window-close"
);

},



minimize(){

ipcRenderer.send(
"window-minimize"
);

},



launchMinecraft(){

return ipcRenderer.invoke(
"minecraft-launch"
);

},



login(){

return ipcRenderer.invoke(
"login-microsoft"
);

},



getAccount(){

return ipcRenderer.invoke(
"get-account"
);

},



logout(){

return ipcRenderer.invoke(
"logout"
);

},


adminLogin(password){

return ipcRenderer.invoke(
"admin-login",
password
);

},



uploadContent(data){

return ipcRenderer.invoke(
"upload-content",
data
);

},
checkUpdate(){

return ipcRenderer.invoke(
"check-update"
);

}
}

);

