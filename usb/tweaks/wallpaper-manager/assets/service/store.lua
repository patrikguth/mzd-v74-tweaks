-- Factory Lua 5.1 domain layer. fs is a narrow POSIX adapter, not a command API.
local image=require("image")
local catalog=require("catalog")
local M={}
local function need(ok,message) if not ok then error(message,0) end end
function M.create(fs,root)
    need(type(root)=="string" and root:sub(1,1)=="/" and not root:find("/%.%.?/"),"Invalid gallery root.")
    fs.directory(root)
    need(fs.read(root.."/owner",128)=="MZD_WALLPAPER_DATA_V1\n","Gallery ownership is missing or unknown.")
    local index=root.."/gallery.tsv"
    local pending=nil
    local function load()
        local rows,settings=catalog.decode(fs.read(index,30000))
        for _,r in ipairs(rows) do
            local meta=fs.regular(root.."/"..r.id.."."..r.format)
            need(meta.bytes>0 and meta.bytes<=image.max_bytes,"Invalid gallery image size.")
        end
        return rows,settings
    end
    local journal=root.."/transaction"
    local recover
    local function atomic(rows,settings)
        local owned=not fs.exists(journal)
        if owned then
            local id,token="img-"..fs.random(),fs.random()
            need(not fs.exists(root.."/.index-"..token),"Unknown existing index scratch file; retained.")
            fs.write_new(journal,"S\t"..id.."\t"..token.."\tpng\n")
        end
        local text=fs.read(journal,256)
        local id,token=text:match("^[IDS]\t(img%-[0-9a-f]+)\t([0-9a-f-]+)\tpng\n$")
        need(catalog.id(id) and (token=="-" or #token==32),"Invalid gallery transaction.")
        local temp=root.."/.index-"..(token=="-" and id or token)
        local created=false
        local ok,err=pcall(function()fs.write_new(temp,catalog.encode(rows,settings));created=true;fs.rename(temp,index);fs.sync_directory(root)end)
        if not ok then if created then fs.remove_if_exists(temp) end;if owned then recover()end;error(err,0)end
        if owned then fs.remove_if_exists(journal);fs.sync_directory(root)end
    end
    recover=function()
        if not fs.exists(journal)then return end
        local text=fs.read(journal,256)
        local phase,id,token,format=text:match("^([IDS])\t(img%-[0-9a-f]+)\t([0-9a-f-]+)\t(png)\n$")
        need(phase and catalog.id(id) and (token=="-" or #token==32),"Invalid gallery transaction; files retained.")
        local rows=load();local indexed=false
        for _,r in ipairs(rows)do if r.id==id then indexed=true end end
        if phase~="S" and not indexed then fs.remove_if_exists(root.."/"..id.."."..format)end
        if phase=="I" then need(#token==32,"Invalid import journal.");fs.remove_if_exists(root.."/.pending-"..token.."."..format)end
        fs.remove_if_exists(root.."/.index-"..(token=="-" and id or token))
        fs.remove_if_exists(journal);fs.sync_directory(root)
    end
    recover()
    local function reserve(bytes,rows,allocated)
        need(#rows<50,"Gallery limit: 50 images.")
        local total=0
        -- Include unindexed files left by an interrupted commit in capacity checks.
        for _,name in ipairs(fs.list(root)) do
            if name:match("^img%-[0-9a-f]+%.png$") or name:match("^img%-[0-9a-f]+%.jpg$") then
                total=total+fs.regular(root.."/"..name).bytes
            end
        end
        need(total+bytes<=50*1024*1024,"Gallery limit: 50 MiB.")
        local space=fs.space(root)
        need(type(space.available)=="number" and type(space.capacity)=="number" and space.available>=0 and space.capacity>0,"Cannot inspect persistent space.")
        need(space.available-(allocated and 0 or bytes)>=math.max(64*1024*1024,space.capacity/10),"Not enough free space; storage reserve must remain available.")
    end
    local function expire()
        if pending and fs.now()-pending.created>=120 then fs.remove_if_exists(pending.path);fs.remove_if_exists(journal);pending=nil end
    end
    local function ticket(value)
        expire();need(pending and type(value)=="string" and value==pending.ticket,"Import expired. Please retry.")
        return pending
    end
    local function gallery()
        local rows=load()
        for _,r in ipairs(rows) do r.bytes=fs.regular(root.."/"..r.id.."."..r.format).bytes end
        return rows
    end
    local function usb_file(source,name,listing)
        need(type(name)=="string" and #name>0 and #name<=255 and not name:find("[/\\%z\1-\31\127]") and name~="." and name~="..","Invalid USB image name.")
        need(name:lower():match("%.png$"),"Only PNG images are supported.")
        -- Adapter resolves a current USB mount ID on every operation, never a client path.
        local mount=fs.usb_mount(source)
        fs.directory(mount.."/wallpapers")
        local path=mount.."/wallpapers/"..name
        local before=fs.regular(path);need(before.bytes<=image.max_bytes,"Image exceeds 1 MiB.")
        local data=fs.read(path,image.max_bytes)
        local after=fs.regular(path)
        need(before.device==after.device and before.inode==after.inode and before.modified==after.modified and before.bytes==after.bytes and #data==before.bytes,"USB image changed during reading.")
        local meta=image.inspect(data,listing)
        return data,meta
    end
    local function list_usb()
        local result,found={status="disconnected",items={}},false
        for _,mount in ipairs(fs.usb_mounts()) do
            local base=fs.usb_mount(mount.id)
            local names=fs.list(base)
            for _,name in ipairs(names) do
                if name=="wallpapers" then
                    fs.directory(base.."/wallpapers");found=true
                    local files=fs.list(base.."/wallpapers");table.sort(files)
                    for _,file in ipairs(files) do
                        if file:lower():match("%.png$") then
                            local valid=pcall(fs.regular,base.."/wallpapers/"..file)
                            if valid then
                                local ok,data,meta=pcall(usb_file,mount.id,file,true)
                                local row={source=mount.id,name=file,label=file}
                                if ok then row.bytes=#data;row.format=meta.format else row.error=tostring(data) end
                                result.items[#result.items+1]=row
                                if #result.items==200 then result.limited=true;result.status="ready";return result end
                            end
                        end
                    end
                end
            end
        end
        if #result.items>0 then result.status="ready"
        elseif found then result.status="empty"
        elseif #fs.usb_mounts()>0 then result.status="missing" end
        return result
    end
    return {
        settings=function(value)
            local rows,settings=load()
            if value then settings=catalog.settings(rows,value,true);atomic(rows,settings)end
            return settings
        end,
        gallery=gallery,list_usb=list_usb,usb_image=usb_file,
        prepare=function(source,name)
            expire();need(not pending,"Another import is waiting for image validation.")
            local data,meta=usb_file(source,name)
            reserve(#data,load(),false)
            local id,token="img-"..fs.random(),fs.random()
            need(catalog.id(id) and #token==32 and token:match("^[0-9a-f]+$"),"Invalid entropy.")
            local path=root.."/.pending-"..token.."."..meta.format
            need(not fs.exists(root.."/"..id..".png") and not fs.exists(path) and not fs.exists(root.."/.index-"..token),"Generated import filename already exists; nothing overwritten.")
            fs.write_new(journal,"I\t"..id.."\t"..token.."\tpng\n")
            local ok,err=pcall(fs.write_new,path,data)
            if not ok then fs.remove_if_exists(journal);error(err,0) end
            pending={id=id,ticket=token,path=path,bytes=data,meta=meta,label=name,created=fs.now()}
            return {ticket=token,width=800,height=480,bytes=#data}
        end,
        preview=function(value) local p=ticket(value);return fs.read(p.path,image.max_bytes),p.meta.format end,
        abort=function(value) local p=ticket(value);fs.remove_if_exists(p.path);fs.remove_if_exists(journal);pending=nil end,
        commit=function(value,width,height)
            local p=ticket(value)
            need(width==800 and height==480,"Staged image could not be decoded at 800 x 480.")
            local data=fs.read(p.path,image.max_bytes)
            need(data==p.bytes,"Staged image changed.")
            -- prepare already validated these exact bytes; the browser decoded them.
            local rows,settings=load();reserve(#data,rows,true)
            local output=root.."/"..p.id.."."..p.meta.format
            need(not fs.exists(output),"Gallery filename already exists.")
            fs.rename(p.path,output)
            rows[#rows+1]={id=p.id,label=p.label,format=p.meta.format}
            local ok,err=pcall(atomic,rows,settings)
            if not ok then
                -- If rename published the index but its fsync failed, retain the image.
                local readable,current=pcall(load);local published=false
                if readable then for _,r in ipairs(current) do if r.id==p.id then published=true end end end
                if readable and not published then fs.remove_if_exists(output) end
                pending=nil;recover();error(err,0)
            end
            pending=nil;fs.remove_if_exists(journal);fs.sync_directory(root);return gallery()
        end,
        remove=function(id)
            expire();need(not pending,"Finish or cancel the current import first.")
            need(catalog.id(id),"Invalid gallery image ID.")
            local rows,settings=load();local keep,target={},nil
            for _,r in ipairs(rows) do if r.id==id then target=r else keep[#keep+1]=r end end
            need(target,"Unknown gallery image.")
            need(not fs.exists(root.."/.index-"..target.id),"Unknown existing index scratch file; retained.")
            fs.write_new(journal,"D\t"..target.id.."\t-\tpng\n")
            local ok,err=pcall(atomic,keep,catalog.settings(keep,settings,false))
            if not ok then recover();error(err,0)end
            fs.remove_if_exists(root.."/"..target.id.."."..target.format)
            fs.remove_if_exists(journal);fs.sync_directory(root)
            return gallery()
        end,
        image=function(id)
            need(catalog.id(id),"Invalid gallery image ID.")
            for _,r in ipairs(load()) do if r.id==id then return fs.read(root.."/"..r.id.."."..r.format,image.max_bytes),r.format end end
            error("Unknown gallery image.",0)
        end,
        tick=expire,
        close=function()if pending then fs.remove_if_exists(pending.path);fs.remove_if_exists(journal);pending=nil end end
    }
end
return M
