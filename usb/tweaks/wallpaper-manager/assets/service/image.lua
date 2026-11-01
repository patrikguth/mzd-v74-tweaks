-- Lua 5.1, no extra native modules. Decode the staged bytes in the OEM browser
-- before commit; header inspection alone is never treated as successful decode.
local M={max_bytes=1024*1024,width=800,height=480}
local function need(ok,message) if not ok then error(message,0) end end
local function u16(s,p) local a,b=s:byte(p,p+1);need(b,"Truncated image.");return a*256+b end
local function u32(s,p) return u16(s,p)*65536+u16(s,p+2) end
local nibble={}
for a=0,15 do for b=0,15 do
    local x,y,n,p=a,b,0,1
    for i=1,4 do if x%2~=y%2 then n=n+p end;x=math.floor(x/2);y=math.floor(y/2);p=p*2 end
    nibble[a*16+b]=n
end end
local floor=math.floor
local function xor(a,b)
    local n,p=0,1
    while a>0 or b>0 do n=n+nibble[a%16*16+b%16]*p;a=floor(a/16);b=floor(b/16);p=p*16 end
    return n
end
local crc_table={}
for n=0,255 do local x=n;for i=1,8 do x=x%2==1 and xor(math.floor(x/2),3988292384) or math.floor(x/2) end;crc_table[n]=x end
-- A bounded byte-XOR lookup avoids per-pixel bit loops on the CMU CPU.
local byte_xor={}
for a=0,255 do for b=0,255 do byte_xor[a*256+b]=nibble[a%16*16+b%16]+16*nibble[floor(a/16)*16+floor(b/16)] end end
local c0,c1,c2,c3={},{},{},{}
for n=0,255 do local v=crc_table[n];c0[n]=v%256;c1[n]=floor(v/256)%256;c2[n]=floor(v/65536)%256;c3[n]=floor(v/16777216) end
local function crc(s,first,last)
    local a,b,c,d=255,255,255,255
    for p=first,last do
        local n=byte_xor[a*256+s:byte(p)]
        a,b,c,d=byte_xor[b*256+c0[n]],byte_xor[c*256+c1[n]],byte_xor[d*256+c2[n]],c3[n]
    end
    return 4294967295-(a+b*256+c*65536+d*16777216)
end
function M.inspect(s, listing)
    need(type(s)=="string" and #s>0,"Image is empty.")
    need(#s<=M.max_bytes,"Image exceeds 1 MiB.")
    local width,height,format
    if s:sub(1,8)=="\137PNG\13\10\26\10" then
        format="png"
        local p,ended,idat,closed=9,false,false,false
        while p<=#s do
            need(p+11<=#s,"PNG is truncated.")
            local size,kind=u32(s,p),s:sub(p+4,p+7)
            need(size<=M.max_bytes and p+size+11<=#s,"PNG is truncated.")
            need(kind:match("^[A-Za-z][A-Za-z][A-Za-z][A-Za-z]$"),"Invalid PNG chunk.")
            if not listing or kind=="IHDR" then need(crc(s,p+4,p+7+size)==u32(s,p+8+size),"PNG checksum is invalid.") end
            if p==9 then
                need(kind=="IHDR" and size==13,"Invalid PNG header.")
                width,height=u32(s,p+8),u32(s,p+12)
                local depth,color,compression,filter,interlace=s:byte(p+16,p+20)
                local depths={[0]={[1]=true,[2]=true,[4]=true,[8]=true,[16]=true},[2]={[8]=true,[16]=true},[3]={[1]=true,[2]=true,[4]=true,[8]=true},[4]={[8]=true,[16]=true},[6]={[8]=true,[16]=true}}
                need(depths[color] and depths[color][depth] and compression==0 and filter==0 and interlace<=1,"Unsupported PNG header.")
            else need(kind~="IHDR","Duplicate PNG header.") end
            need(kind~="acTL","Animated PNG is not supported.")
            if kind=="IDAT" then need(not closed,"Invalid PNG data order.");idat=true
            elseif idat then closed=true end
            if kind=="IEND" then need(size==0 and p+11==#s and idat,"Invalid PNG ending.");ended=true;break end
            p=p+size+12
        end
        need(ended,"PNG is incomplete.")
    else error("Only PNG images are supported.",0) end
    need(width==800 and height==480,"Required: 800 x 480 pixels. Detected: "..tostring(width).." x "..tostring(height)..".")
    return {format=format,width=width,height=height,bytes=#s}
end
return M
