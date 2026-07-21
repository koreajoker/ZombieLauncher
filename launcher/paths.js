const path=require("path");
const os=require("os");


const ZOMBIE_FOLDER =
path.join(
os.homedir(),
".ZombieLauncher"
);



module.exports={


zombie:
ZOMBIE_FOLDER,


minecraft:
path.join(
ZOMBIE_FOLDER,
"minecraft"
),


mods:
path.join(
ZOMBIE_FOLDER,
"minecraft",
"mods"
),


shaderpacks:
path.join(
ZOMBIE_FOLDER,
"minecraft",
"shaderpacks"
),


resourcepacks:
path.join(
ZOMBIE_FOLDER,
"minecraft",
"resourcepacks"
),


updates:
path.join(
ZOMBIE_FOLDER,
"updates"
),


config:
path.join(
ZOMBIE_FOLDER,
"config"
)


};