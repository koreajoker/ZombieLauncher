const path=require("path");
const os=require("os");


const ROOT =
path.join(
    os.homedir(),
    ".ZombieLauncher"
);



module.exports={


root:ROOT,


minecraft:
path.join(
    ROOT,
    "minecraft"
),


mods:
path.join(
    ROOT,
    "minecraft",
    "mods"
),


shaderpacks:
path.join(
    ROOT,
    "minecraft",
    "shaderpacks"
),


resourcepacks:
path.join(
    ROOT,
    "minecraft",
    "resourcepacks"
),


logs:
path.join(
    ROOT,
    "logs"
),


config:
path.join(
    ROOT,
    "config"
)


};