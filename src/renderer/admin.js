window.addEventListener("DOMContentLoaded", async () => {
    const discord = document.getElementById("discord");
    const news = document.getElementById("news");
    const notice = document.getElementById("notice");
    const saveButton = document.getElementById("save-btn");
    const closeButton = document.getElementById("close-btn");
    const lists = {
        mod: document.getElementById("modList"),
        shader: document.getElementById("shaderList"),
        resourcepack: document.getElementById("resourcepackList")
    };

    function message(error) {
        return error?.message || String(error || "알 수 없는 오류");
    }

    async function loadFiles() {
        try {
            const result = await window.admin.files();
            Object.values(lists).forEach(list => { list.textContent = ""; });
            for (const file of result.files || []) {
                const row = document.createElement("div");
                row.className = "file-row";
                const name = document.createElement("span");
                name.textContent = file.name;
                const remove = document.createElement("button");
                remove.textContent = "삭제";
                remove.onclick = async () => {
                    if (!confirm(`${file.name} 파일을 삭제하시겠습니까?`)) return;
                    try {
                        await window.admin.deleteFile(file.id);
                        await loadFiles();
                    } catch (error) {
                        alert(message(error));
                    }
                };
                row.append(name, remove);
                lists[file.type]?.appendChild(row);
            }
        } catch (error) {
            alert(message(error));
        }
    }

    async function upload(type) {
        try {
            const result = await window.admin.upload(type);
            if (!result.canceled) {
                alert("업로드가 완료되었습니다.");
                await loadFiles();
            }
        } catch (error) {
            alert(message(error));
        }
    }

    document.getElementById("uploadMod").onclick = () => upload("mod");
    document.getElementById("uploadShader").onclick = () => upload("shader");
    document.getElementById("uploadResourcepack").onclick = () => upload("resourcepack");
    closeButton.onclick = () => window.admin.close();
    saveButton.onclick = async () => {
        try {
            await window.admin.saveConfig({ discord: discord.value, news: news.value, notice: notice.value });
            alert("저장되었습니다.");
        } catch (error) {
            alert(message(error));
        }
    };
    document.addEventListener("keydown", event => {
        if (event.ctrlKey && event.key.toLowerCase() === "s") {
            event.preventDefault();
            saveButton.click();
        }
    });

    try {
        const config = await window.launcher.loadLauncherConfig();
        discord.value = config.discord || "";
        news.value = config.news || "";
        notice.value = config.notice || "";
        await loadFiles();
    } catch (error) {
        alert(message(error));
    }
});
