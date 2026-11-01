-- LuaPOSIX 5.1.19 + LuaFileSystem 1.5.0, as present in the original CMU dump.
-- process is the existing shared argv-only runner from lib/lua-bridge.
local p=require("posix")
local lfs=require("lfs")
local M={}
local function need(ok,message) if not ok then error(message,0) end;return ok end
function M.create(process,options)
    options=options or {}
    local mounts_file=options.mounts_file or "/proc/mounts"
    local function checked(path,kind)
        need(type(path)=="string" and path:sub(1,1)=="/" and path:sub(-1)~="/" and not path:find("//"),"Noncanonical path.")
        local prefix,meta="",nil
        for part in path:gmatch("[^/]+") do
            need(part~="." and part~=".." and not part:find("[%z\1-\31\127]"),"Unsupported path component.")
            prefix=prefix.."/"..part
            meta=need(lfs.symlinkattributes(prefix),"Missing path: "..prefix)
            need(meta.mode~="link" and (prefix==path or meta.mode=="directory"),"Linked or unsupported path.")
        end
        need(meta and (not kind or meta.mode==kind),"Unsupported file type.")
        if kind=="file" then need(meta.nlink==1,"Linked file is not supported.") end
        return meta
    end
    local function regular(path)
        local m=checked(path,"file")
        return {bytes=m.size,device=m.dev,inode=m.ino,modified=m.modification}
    end
    local function read(path,limit)
        local before=regular(path);need(before.bytes<=limit,"File exceeds its size limit.")
        local f=need(io.open(path,"rb"),"Cannot open file.")
        local data=f:read(limit+1) or "";local ok=f:close();need(ok,"Cannot close file.")
        local after=regular(path)
        need(#data<=limit and #data==before.bytes and before.device==after.device and before.inode==after.inode and before.modified==after.modified and before.bytes==after.bytes,"File changed while reading.")
        return data
    end
    local function command(program,args)
        local r=process.run(program,args,nil,nil,10)
        need(r.started and r.exitCode==0 and not r.signal and not r.stdoutTruncated and not r.stderrTruncated,"Filesystem operation failed: "..program)
        return r.stdout
    end
    local function parent(path) return need(path:match("^(.*)/[^/]+$"),"Missing parent directory.") end
    local function sync() command(options.sync_program or "/bin/sync",{}) end
    local function mounts()
        local f=need(io.open(mounts_file,"r"),"Cannot inspect mounts.")
        local text=f:read(65537) or "";f:close();need(#text<=65536,"Mount table is too large.")
        local result={}
        for line in text:gmatch("[^\n]+") do
            local device,path,kind,flags=line:match("^(%S+) (%S+) (%S+) (%S+)")
            if device and device:match("^/dev/sd[a-z]%d+$") and path:match("^/tmp/mnt/sd[a-z]%d+$") then
                local ok=pcall(checked,path,"directory")
                if ok then result[#result+1]={id=path:match("([^/]+)$"),path=path,device=device,kind=kind,flags=flags} end
            end
        end
        table.sort(result,function(a,b)return a.id<b.id end)
        return result
    end
    return {
        regular=regular,read=read,directory=function(path)return checked(path,"directory")end,
        exists=function(path)return lfs.symlinkattributes(path)~=nil end,
        list=function(path)
            checked(path,"directory");local rows={}
            for name in lfs.dir(path) do if name~="." and name~=".." then rows[#rows+1]=name;need(#rows<=4096,"Directory has too many entries.") end end
            return rows
        end,
        write_new=function(path,data)
            checked(parent(path),"directory")
            local fd=need(p.open(path,{"wronly","creat","excl"},"rw-------"),"Cannot create private file.")
            local ok,err=pcall(function()
                local at=1
                while at<=#data do local n=need(p.write(fd,data:sub(at)),"Cannot write file.");need(n>0,"Short file write.");at=at+n end
            end)
            local closed=p.close(fd)
            if not ok or not closed then os.remove(path);error(ok and "Cannot close written file." or err,0) end
            local synced,message=pcall(sync)
            if not synced then os.remove(path);error(message,0) end
        end,
        rename=function(source,target)
            regular(source);checked(parent(target),"directory")
            if lfs.symlinkattributes(target) then regular(target) end
            need(os.rename(source,target),"Cannot publish file.")
        end,
        remove_if_exists=function(path)
            if lfs.symlinkattributes(path) then regular(path);need(os.remove(path),"Cannot remove owned file.") end
        end,
        sync_directory=function(path)checked(path,"directory");sync()end,
        space=function(path)
            checked(path,"directory")
            local text=command(options.df_program or "/bin/df",{"-Pk",path})
            local capacity,available
            for line in text:gmatch("[^\n]+") do
                local total,used,free=line:match("^%S+%s+(%d+)%s+(%d+)%s+(%d+)%s+")
                if total then need(not capacity,"Ambiguous storage response.");capacity=tonumber(total)*1024;available=tonumber(free)*1024 end
            end
            need(capacity and available,"Cannot inspect available storage.");return {capacity=capacity,available=available}
        end,
        random=function()
            local f=need(io.open("/dev/urandom","rb"),"Entropy unavailable.");local data=f:read(16);f:close()
            need(data and #data==16,"Entropy unavailable.");return (data:gsub(".",function(c)return string.format("%02x",c:byte())end))
        end,
        now=function()
            local f=need(io.open("/proc/uptime","r"),"Monotonic clock unavailable.");local value=f:read("*n");f:close();return need(value,"Monotonic clock unavailable.")
        end,
        usb_mounts=mounts,
        usb_mount=function(id)
            need(type(id)=="string" and id:match("^sd[a-z]%d+$"),"Invalid USB source.")
            for _,m in ipairs(mounts()) do if m.id==id then return m.path end end
            error("USB stick is no longer connected.",0)
        end
    }
end
return M
