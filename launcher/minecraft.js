const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const launcherPaths = require("./paths");

// ==================================================
// Launcher Settings
// ==================================================

const SETTINGS_FILE =
path.join(
    __dirname,
    "..",
    "config",
    "settings.json"
);



function loadSettings(){


    const defaultSettings = {

        minRam:1024,

        maxRam:4096

    };



    try{


        if(
            fs.existsSync(
                SETTINGS_FILE
            )
        ){


            const data =
            JSON.parse(

                fs.readFileSync(

                    SETTINGS_FILE,

                    "utf8"

                )

            );


            return {

                ...defaultSettings,

                ...data

            };


        }


    }
    catch(e){


        console.log(
            "SETTINGS ERROR",
            e
        );


    }



    return defaultSettings;


}

// ==================================================
// Minecraft Directory
// ==================================================

const GAME_DIR = launcherPaths.minecraft;



// ==================================================
// JSON
// ==================================================

function readJson(file){

    return JSON.parse(
        fs.readFileSync(
            file,
            "utf8"
        )
    );

}



// ==================================================
// Find Version
// ==================================================

function findVersion(){


    const dir =
    path.join(
        GAME_DIR,
        "versions"
    );



    if(
        !fs.existsSync(dir)
    ){

        throw new Error(
            "Minecraft versions 없음"
        );

    }



    const versions =
    fs.readdirSync(dir)
    .filter(v=>{

        return fs.existsSync(
            path.join(
                dir,
                v,
                v+".json"
            )
        );

    });



    if(
        versions.length===0
    ){

        throw new Error(
            "설치된 버전 없음"
        );

    }



    // NeoForge 우선

    const neo =
    versions.find(v=>

        v.startsWith(
            "neoforge-"
        )

    );



    if(neo)
        return neo;



    return versions[0];

}



// ==================================================
// Load Version
// ==================================================

function loadVersion(version){


    const file =
    path.join(

        GAME_DIR,

        "versions",

        version,

        version+".json"

    );



    if(
        !fs.existsSync(file)
    ){

        throw new Error(
            "버전 json 없음 : "+file
        );

    }



    return readJson(file);

}



// ==================================================
// Merge NeoForge Parent
// ==================================================

function loadMergedVersion(version){


    const current =
    loadVersion(
        version
    );



    if(
        !current.inheritsFrom
    ){

        return current;

    }



    const parent =
    loadMergedVersion(
        current.inheritsFrom
    );



    return {

        ...parent,

        ...current,


        libraries:[

            ...(parent.libraries || []),

            ...(current.libraries || [])

        ],



        arguments:{


            jvm:[

                ...(parent.arguments?.jvm || []),

                ...(current.arguments?.jvm || [])

            ],



            game:[

                ...(parent.arguments?.game || []),

                ...(current.arguments?.game || [])

            ]


        }


    };

}



// ==================================================
// Library Path
// ==================================================

function getLibraryPath(lib){


    if(
        lib.downloads &&
        lib.downloads.artifact &&
        lib.downloads.artifact.path
    ){

        return path.join(

            GAME_DIR,

            "libraries",

            lib.downloads.artifact.path

        );

    }



    if(
        !lib.name
    )
        return null;



    const p =
    lib.name.split(":");



    if(
        p.length!==3
    )
        return null;



    const group =
    p[0]
    .replaceAll(
        ".",
        "/"
    );


    const name =
    p[1];


    const version =
    p[2];



    return path.join(

        GAME_DIR,

        "libraries",

        group,

        name,

        version,

        `${name}-${version}.jar`

    );

}



// ==================================================
// Libraries
// ==================================================

function getLibraries(versionData){


    const result=[];



    for(
        const lib of versionData.libraries || []
    ){


        const jar =
        getLibraryPath(
            lib
        );



        if(
            jar &&
            fs.existsSync(jar)
        ){

            result.push(
                jar
            );

        }


    }



    return [

        ...new Set(result)

    ];

}

// ==================================================
// Argument Resolver
// ==================================================

function resolveValue(
    value,
    vars
){

    if(
        typeof value !== "string"
    ){

        return value;

    }



    let result=value;



    for(
        const key of Object.keys(vars)
    ){

        result =
        result.replaceAll(
            "${"+key+"}",
            vars[key]
        );

    }



    return result;

}





function resolveArguments(args, vars){

    const result=[];


    if(!args)
        return result;



    for(const item of args){


        if(typeof item==="string"){

            result.push(
                resolveValue(item,vars)
            );

            continue;
        }



        if(typeof item!=="object")
            continue;



        let allowed=true;



        if(item.rules){


            allowed=false;


            for(const rule of item.rules){


                if(rule.action==="allow"){


                    let pass=true;



                    if(rule.features){


                        for(const key of Object.keys(rule.features)){


                            const value =
                            rule.features[key];



                            /*
                                현재 런처 상태
                            */

                            const features={

                                is_demo_user:false,

                                has_custom_resolution:true,

                                is_quick_play_multiplayer:false,

                                is_quick_play_singleplayer:false,

                                is_quick_play_realms:false

                            };



                            if(
                                features[key] !== value
                            ){

                                pass=false;

                            }


                        }

                    }



                    if(pass){

                        allowed=true;

                    }


                }


            }


        }



        if(!allowed)
            continue;



        if(Array.isArray(item.value)){


            for(const v of item.value){

                result.push(
                    resolveValue(v,vars)
                );

            }


        }
        else{


            result.push(
                resolveValue(
                    item.value,
                    vars
                )
            );

        }



    }


    return result;

}



// ==================================================
// JVM Arguments Clean
// ==================================================

function cleanJvmArgs(args){


    return args.filter(arg=>{


        if(
            typeof arg !== "string"
        ){
            return false;
        }



        if(
            arg.includes(
                "XstartOnFirstThread"
            )
        ){

            return false;

        }



        if(
            arg.startsWith(
                "-Djava.library.path="
            )
        ){

            return false;

        }



        return true;

    });


}



// ==================================================
// Build Launch
// ==================================================

function buildLaunch(
    version,
    versionData,
    account
){


    const libraries =
    getLibraries(
        versionData
    );



    const classpath =
    libraries.join(
        path.delimiter
    );

    console.log(
        "BUILD ACCOUNT",
        JSON.stringify(account,null,2)
    );


    const vars = {


        auth_player_name:
        account.name ||
        "Player",



        version_name:
        version,



        game_directory:
        GAME_DIR,



        game_assets:
        path.join(
            GAME_DIR,
            "assets"
        ),



        assets_root:
        path.join(
            GAME_DIR,
            "assets"
        ),



        assets_index_name:
        versionData.assetIndex?.id ||
        "17",



        auth_uuid:
        account.uuid,



        auth_access_token:
        account.accessToken,



        user_type:
        account.userType || "msa",



        version_type:
        "ZombieLauncher",



        library_directory:
        path.join(
            GAME_DIR,
            "libraries"
        ),



        classpath:
        classpath,



        classpath_separator:
        path.delimiter,

        resolution_width:
"1280",

resolution_height:
"720",

clientid:
account.clientId || "",


auth_xuid:
account.xuid ||
(
 account.accessToken?.match(
 /"xuid":"([^"]+)"/
 )
 ?
 account.accessToken.match(
 /"xuid":"([^"]+)"/
 )[1]
 :
 ""
),



    };



    let jvmArgs =
    resolveArguments(

        versionData.arguments?.jvm,

        vars

    );



    jvmArgs =
    cleanJvmArgs(
        jvmArgs
    );

// =====================================
// RAM SETTINGS
// =====================================


const settings =
loadSettings();



jvmArgs.unshift(

    `-Xms${settings.minRam}M`

);



jvmArgs.unshift(

    `-Xmx${settings.maxRam}M`

);



console.log(

    "RAM CONFIG",

    {
        min:
        settings.minRam,

        max:
        settings.maxRam
    }

);

    const gameArgs =
    resolveArguments(

        versionData.arguments?.game,

        vars

    );



    return {


        libraries,


        classpath,


        jvmArgs,


        gameArgs


    };


}

// ==================================================
// Launch Minecraft
// ==================================================


async function launchMinecraft(
    account="Player"
){
console.log(
    "ACCOUNT:",
    JSON.stringify(account,null,2)
);

    const version =
    findVersion();



    console.log(
        "VERSION",
        version
    );



    const versionData =
    loadMergedVersion(
        version
    );



const launch =
buildLaunch(

    version,

    versionData,

    account

);



    const java =
    process.env.JAVA_HOME
    ?
    path.join(
        process.env.JAVA_HOME,
        "bin",
        "java.exe"
    )
    :
    "java";




    const mainClass =
    versionData.mainClass ||
    "cpw.mods.bootstraplauncher.BootstrapLauncher";



    console.log(
        "MAIN CLASS",
        mainClass
    );



    /*
        NeoForge 1.21.x

        BootstrapLauncher 실행

        classpath만 사용

        module-path 금지
    */

console.log(
    "FINAL AUTH",
    {
        name: account.name,
        uuid: account.uuid,
        token:
        account.accessToken ?
        account.accessToken.substring(0,20)
        :
        "NONE",
        xuid: account.xuid
    }
);

    const args=[



        "-cp",

        launch.classpath,



        ...launch.jvmArgs,



        mainClass,



        ...launch.gameArgs



    ];





    console.log(
        "JAVA START"
    );




// =====================================
// Java ArgFile (Windows length fix)
// =====================================


const argFile =
path.join(
    GAME_DIR,
    "zombielauncher.args"
);



fs.writeFileSync(

    argFile,

    args.map(arg=>{


        if(
            arg.includes(" ")
        ){

            return `"${arg}"`;

        }


        return arg;


    })
    .join("\n"),

    "utf8"

);



console.log(
    "JAVA ARGFILE:",
    argFile
);



const child =
spawn(

    java,

    [

        "@"+argFile

    ],

    {

        cwd:
        GAME_DIR,


        windowsHide:false,


        stdio:[
            "ignore",
            "pipe",
            "pipe"
        ]

    }

);





    child.stdout.on(
        "data",
        data=>{


            console.log(
                "MC:",
                data.toString()
            );


        }

    );





    child.stderr.on(
        "data",
        data=>{


            console.log(
                "MC ERROR:",
                data.toString()
            );


        }

    );





    child.on(
        "close",
        code=>{


            console.log(
                "GAME EXIT",
                code
            );


        }

    );



    return child;


}



// ==================================================
// Export
// ==================================================

module.exports = {

    launchMinecraft

};
