document.addEventListener("DOMContentLoaded", () => {
    // 1. BOOT & LOGIN SEQUENCE
    setTimeout(() => {
        document.getElementById('boot-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
    }, 2000);

    document.getElementById('login-btn').addEventListener('click', () => {
        const username = document.getElementById('username-input').value || 'User';
        localStorage.setItem('nova_user', username);
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('desktop').classList.add('active');
        nova.initDesktop();
    });

    // Clock
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }, 1000);
});

// NOVA OS CORE
const nova = {
    windows: [],
    highestZIndex: 100,
    fileHandleAccess: null, // Stores actual directory handle

    // 2. WINDOW MANAGER
    openApp: function(appId, title = "App") {
        if(appId === 'filemanager') return this.openFileManager();
        
        const winId = 'win_' + Date.now();
        const winHtml = `
            <div id="${winId}" class="window" style="top: 100px; left: 150px; width: 600px; height: 400px; z-index: ${++this.highestZIndex}">
                <div class="window-header">
                    <div class="window-title"><i class="ph-fill ph-app-window"></i> ${title}</div>
                    <div class="window-controls">
                        <button class="win-btn win-min"></button>
                        <button class="win-btn win-max" onclick="nova.maximizeWindow('${winId}')"></button>
                        <button class="win-btn win-close" onclick="nova.closeWindow('${winId}')"></button>
                    </div>
                </div>
                <div class="window-content" id="content_${winId}">
                    <p style="color:var(--text-muted)">Welcome to ${title}. UI is currently under construction.</p>
                </div>
            </div>
        `;
        document.getElementById('window-container').insertAdjacentHTML('beforeend', winHtml);
        this.makeDraggable(document.getElementById(winId));
        this.windows.push(winId);
    },

    closeWindow: function(winId) {
        document.getElementById(winId).remove();
        this.windows = this.windows.filter(id => id !== winId);
    },

    makeDraggable: function(el) {
        const header = el.querySelector('.window-header');
        let isDragging = false, startX, startY, initialX, initialY;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            el.style.zIndex = ++this.highestZIndex;
            startX = e.clientX; startY = e.clientY;
            initialX = el.offsetLeft; initialY = el.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = `${initialX + dx}px`;
            el.style.top = `${initialY + dy}px`;
        });

        document.addEventListener('mouseup', () => isDragging = false);
    },

    // 3. REAL FILE MANAGER (File System Access API)
    openFileManager: async function() {
        const winId = 'win_fm_' + Date.now();
        const winHtml = `
            <div id="${winId}" class="window" style="top: 80px; left: 100px; width: 700px; height: 500px; z-index: ${++this.highestZIndex}">
                <div class="window-header">
                    <div class="window-title"><i class="ph-fill ph-folder-notch"></i> NOVA File Manager</div>
                    <div class="window-controls">
                        <button class="win-btn win-close" onclick="nova.closeWindow('${winId}')"></button>
                    </div>
                </div>
                <div class="window-content" id="fm_content_${winId}">
                    <div class="fm-toolbar">
                        <button id="btn_grant_${winId}"><i class="ph ph-hard-drives"></i> Akses Folder Asli</button>
                        <span style="font-size: 0.8rem; color: #94a3b8; align-self: center;">Pilih folder untuk mengelola file nyata di perangkat Anda.</span>
                    </div>
                    <div id="fm_grid_${winId}" class="fm-grid"></div>
                </div>
            </div>
        `;
        document.getElementById('window-container').insertAdjacentHTML('beforeend', winHtml);
        this.makeDraggable(document.getElementById(winId));

        document.getElementById(`btn_grant_${winId}`).addEventListener('click', async () => {
            try {
                // Minta akses folder sungguhan ke user
                const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                this.fileHandleAccess = dirHandle;
                this.renderFiles(`fm_grid_${winId}`, dirHandle);
            } catch (err) {
                console.warn("Akses ditolak atau browser tidak mendukung.", err);
                document.getElementById(`fm_grid_${winId}`).innerHTML = `<p style="color:#ef4444">Akses ditolak atau API tidak didukung.</p>`;
            }
        });
    },

    renderFiles: async function(gridId, dirHandle) {
        const grid = document.getElementById(gridId);
        grid.innerHTML = '<p>Loading files...</p>';
        let html = '';
        
        for await (const entry of dirHandle.values()) {
            const icon = entry.kind === 'file' ? 'ph-file-text' : 'ph-folder-notch';
            const color = entry.kind === 'file' ? '#e2e8f0' : '#60a5fa';
            html += `
                <div class="fm-item" oncontextmenu="nova.showFileContext(event, '${entry.name}', '${entry.kind}')">
                    <i class="ph-fill ${icon}" style="color: ${color}"></i>
                    <span>${entry.name}</span>
                </div>
            `;
        }
        grid.innerHTML = html || '<p>Folder kosong.</p>';
    },

    // 4. DESKTOP ICONS & DRAG DROP
    initDesktop: function() {
        const defaultIcons = [
            { id: 'ic_pc', title: 'My Computer', icon: 'ph-monitor', type: 'system' },
            { id: 'ic_trash', title: 'Recycle Bin', icon: 'ph-trash', type: 'system' },
            { id: 'ic_files', title: 'Files', icon: 'ph-folder', type: 'app', action: "nova.openApp('filemanager')" }
        ];

        const grid = document.getElementById('desktop-grid');
        defaultIcons.forEach((ic, index) => {
            const top = 20 + (index * 110);
            grid.insertAdjacentHTML('beforeend', `
                <div id="${ic.id}" class="desktop-icon" style="top: ${top}px; left: 20px;" 
                     onclick="nova.selectIcon('${ic.id}')" 
                     ondblclick="${ic.action || 'console.log(\'clicked\')'}"
                     oncontextmenu="nova.showDesktopContext(event, '${ic.id}')">
                    <i class="ph-fill ${ic.icon}"></i>
                    <span>${ic.title}</span>
                </div>
            `);
            this.makeIconDraggable(document.getElementById(ic.id));
        });

        // Hide Context Menu on click elsewhere
        document.addEventListener('click', () => {
            document.getElementById('context-menu').classList.add('hidden');
            document.querySelectorAll('.desktop-icon').forEach(el => el.classList.remove('selected'));
        });
        
        // Desktop Right Click
        document.getElementById('desktop').addEventListener('contextmenu', (e) => {
            if(e.target.id === 'desktop' || e.target.id === 'desktop-grid') {
                e.preventDefault();
                nova.showCustomContext(e, [
                    { label: 'View', icon: 'ph-eye' },
                    { label: 'Refresh', icon: 'ph-arrows-clockwise' },
                    { label: 'Personalize', icon: 'ph-paint-brush' }
                ]);
            }
        });
    },

    selectIcon: function(id) {
        document.querySelectorAll('.desktop-icon').forEach(el => el.classList.remove('selected'));
        document.getElementById(id).classList.add('selected');
    },

    makeIconDraggable: function(el) {
        let isDragging = false, startX, startY, initialX, initialY;

        el.addEventListener('mousedown', (e) => {
            if(e.button !== 0) return; // Only left click drag
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            initialX = el.offsetLeft; initialY = el.offsetTop;
            this.selectIcon(el.id);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            el.style.left = `${initialX + (e.clientX - startX)}px`;
            el.style.top = `${initialY + (e.clientY - startY)}px`;
        });

        document.addEventListener('mouseup', () => isDragging = false);
    },

    // 5. CONTEXT MENU SYSTEM
    showDesktopContext: function(e, iconId) {
        e.preventDefault();
        e.stopPropagation();
        this.selectIcon(iconId);
        this.showCustomContext(e, [
            { label: 'Open', icon: 'ph-folder-open', action: `document.getElementById('${iconId}').ondblclick()` },
            { label: 'Rename', icon: 'ph-pencil-simple' },
            { label: 'Remove from Desktop', icon: 'ph-x-circle', action: `document.getElementById('${iconId}').style.display='none'` },
            { label: 'Properties', icon: 'ph-info' }
        ]);
    },

    showCustomContext: function(e, items) {
        const menu = document.getElementById('context-menu');
        menu.innerHTML = items.map(item => `
            <div class="context-item" onclick="nova.executeContextAction('${item.action || ''}')">
                <i class="${item.icon}"></i> ${item.label}
            </div>
        `).join('');
        
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;
        menu.classList.remove('hidden');
    },

    executeContextAction: function(actionStr) {
        if(actionStr) eval(actionStr);
    }
};
