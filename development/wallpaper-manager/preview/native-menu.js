/* Local prototype adapter using the same OEM List2 factory as Applications. */
(function (global) {
    'use strict';
    function create(options) {
        options = options || {};
        var session = null, selection = null;
        function send(type, value) {
            if (session) { session.frame.contentWindow.postMessage({type:type,token:session.token,index:value},'*'); }
        }
        function destroyList() {
            if (session && session.control) { try { global.framework.destroyControl(session.control); } catch (ignore) {} session.control = null; }
        }
        function close() {
            var old = session, fw = global.framework, app;
            if (!old) { return; }
            global.clearTimeout(selection); selection = null; destroyList(); session = null;
            if (options.preview) { options.preview(null,null); }
            if (fw.sendEventToMmui === old.backWrapper) { fw.sendEventToMmui = old.originalSend; }
            if (old.container.parentNode) { old.container.parentNode.removeChild(old.container); }
            if (old.previewPane && old.previewPane.parentNode) { old.previewPane.parentNode.removeChild(old.previewPane); }
            old.frame.style.display = old.display;
            old.root.style.cssText = old.css; old.root.className = old.className;
            if (fw.getCurrentApp() === 'system' && fw.getCurrCtxtId() === 'Applications') {
                app = fw.getAppInstance('system');
                if (!app._currentContextTemplate || !app._currentContextTemplate.divElt || app._currentContextTemplate.divElt.style.visibility !== 'hidden') {
                    if (app._currentContextTemplate && app._currentContextTemplate.list2Ctrl) { app._currentContextTemplate.list2Ctrl.setLineNumbers(); }
                    if (fw.common && fw.common.setSbNameId) { fw.common.setSbNameId('system','Applications'); }
                }
            }
        }
        function attach(frame, token) {
            var fw = global.framework, root = frame.parentNode, container, originalSend;
            if (session && session.frame === frame && session.token === token) { return; }
            close();
            if (!fw || typeof fw.instantiateControl !== 'function' || typeof fw.destroyControl !== 'function') { throw new Error('Mazda list factory unavailable.'); }
            container = document.createElement('div');
            container.className = 'TemplateWithStatusLeft List2Tmplt';
            container.style.cssText = 'position:absolute;left:0;top:0;width:740px;height:416px;';
            session = {frame:frame,source:frame.contentWindow,token:token,root:root,container:container,control:null,page:'',signature:'',
                css:root.style.cssText,className:root.className,display:frame.style.display,originalSend:fw.sendEventToMmui};
            frame.style.display = 'none';
            root.style.cssText = 'position:absolute;left:60px;top:64px;width:740px;height:416px;z-index:7;background:transparent;overflow:visible;';
            root.className = ''; root.appendChild(container);
            var style = document.createElement('style');
            style.textContent = '.wallpaperImportSplit .List2Ctrl{width:390px!important;overflow:hidden}.wallpaperImportSplit .List2Ctrl .line1{max-width:300px!important;overflow:hidden;text-overflow:ellipsis}.wallpaperImportSplit .List2Ctrl .mask,.wallpaperImportSplit .List2Ctrl .scroller{max-width:390px!important}';
            container.appendChild(style);
            session.splitStyle = style;
            originalSend = session.originalSend;
            session.backWrapper = function (uia, event) {
                if (session && event === 'Global.GoBack' && fw.getCurrentApp() === 'system' && fw.getCurrCtxtId() === 'Applications') {
                    session.frame.contentWindow.postMessage({type:'mzd-gui-input',token:session.token,action:'back',phase:'step'},'*'); return;
                }
                return originalSend.apply(this,arguments);
            };
            fw.sendEventToMmui = session.backWrapper;
        }
        function render(frame, token, menu) {
            var fw = global.framework, items = [], i, row, captured, signature, current, oldPage;
            if (!menu || typeof menu.title !== 'string' || !menu.rows || menu.rows.length > 202) { throw new Error('Invalid native menu.'); }
            attach(frame,token); current = session;
            // OEM StatusBar treats any .png substring as an icon path.
            if (fw.common && fw.common.setSbName) { fw.common.setSbName(menu.title.replace(/[.]png/gi,'')); }
            if (options.preview) { options.preview(menu.previewId || null,frame); }
            session.container.className = 'TemplateWithStatusLeft List2Tmplt' + (menu.split ? ' wallpaperImportSplit' : '');
            if (!session.previewPane) {
                session.previewPane = document.createElement('div');
                session.previewPane.style.cssText = 'position:absolute;left:408px;top:65px;width:300px;color:white;font-size:22px;white-space:normal;word-wrap:break-word;';
                session.root.appendChild(session.previewPane);
            }
            session.previewPane.style.display = menu.split ? 'block' : 'none';
            session.previewPane.innerHTML = '';
            if (menu.split && menu.rightPreview) {
                var preview = menu.rightPreview, picture, caption;
                if (preview.url && /^http:\/\/(?:localhost:8091\/usb-image\/|127\.0\.0\.1:[0-9]+\/image\/wallpaper-manager\/usb\/)/.test(preview.url)) {
                    picture = document.createElement('img'); picture.src = preview.url;
                    picture.style.cssText = 'width:300px;height:180px;object-fit:contain;'; session.previewPane.appendChild(picture);
                }
                caption = document.createElement('div'); caption.textContent = preview.error || preview.label || '';
                session.previewPane.appendChild(caption);
            }
            for (i = 0; i < menu.rows.length; i += 1) {
                row = menu.rows[i];
                items.push({appData:{wallpaperIndex:i},text1Id:null,text1:row.label,
                    itemStyle:row.checkable ? 'style03' : row.detail ? 'style06' : 'style01',
                    image1:row.checkable ? (row.radio ? 'radio' : 'tick') : '',checked:row.checked === true,
                    label1Id:null,label1:row.detail || '',hasCaret:row.caret === true,disabled:row.disabled === true});
            }
            signature = JSON.stringify(items); oldPage = session.page;
            if (session.control && oldPage === menu.page && session.signature === signature) { return; }
            if (session.control && oldPage === menu.page) {
                captured = session.control.getContextCapture();
                // setDataList alone empties the OEM scroller without repainting.
                session.control.setDataListAndUpdateItems({itemCountKnown:true,itemCount:items.length,items:items,vuiSupport:false});
                if (captured.focussedItem >= items.length) { captured.focussedItem = 0; captured.topItem = 0; }
                session.control.restoreContext(captured);
            } else {
                global.clearTimeout(selection); destroyList(); session.container.innerHTML = ''; session.container.appendChild(session.splitStyle);
                session.control = fw.instantiateControl('system',session.container,'List2Ctrl',{
                    titleConfiguration:'noTitle',numberedList:true,
                    focussedItem:menu.index || 0,
                    dataList:{itemCountKnown:true,itemCount:items.length,items:items,vuiSupport:false},
                    selectCallback:function (source, data) {
                        if (session !== current || source !== current.control || !data) { return; }
                        global.clearTimeout(selection);
                        selection = global.setTimeout(function () {
                            if (session === current && current.control === source) { send('wallpaper-native-select',data.wallpaperIndex); }
                        },0);
                    }
                });
                session.control.handleControllerEvent('acceptFocusInit');
            }
            session.page = menu.page; session.signature = signature;
        }
        function input(frame, token, action, phase) {
            var control, event, capture;
            if (!session || session.frame !== frame || session.token !== token || !session.control) { return; }
            control = session.control;
            if (action === 'rotateRight' || action === 'rotateLeft') {
                if (phase === 'release') { return; }
                event = action === 'rotateRight' ? 'cw' : 'ccw';
            } else {
                if (['up','down','left','right','select'].indexOf(action) < 0) { return; }
                if (phase === 'step') { control.handleControllerEvent(action + 'Start'); event = action; }
                else { event = phase === 'press' ? action + 'Start' : action; }
            }
            control.handleControllerEvent(event);
            capture = control.getContextCapture(); send('wallpaper-native-focus',capture.focussedItem);
        }
        return {render:render,input:input,close:close,owns:function (source, token) { return session && session.source === source && session.token === token; },check:function () {
            if (session && (!document.documentElement.contains(session.frame) || global.framework.getCurrentApp() !== 'system' || global.framework.getCurrCtxtId() !== 'Applications')) { close(); }
        }};
    }
    global.WallpaperNativeMenu = {create:create};
}(window));
