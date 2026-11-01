-- Registered service factory. No bundled images or default image collection.
local lfs=require('lfs')
local catalog=require('catalog')
local store=require('store')
local api=require('api')
return function(context)
    local fs=context.files
    local root=context.data..'/gallery'
    if not fs.exists(root)then
        -- Only an explicitly owned, otherwise empty module data folder is initialized.
        for _,name in ipairs(fs.list(context.data))do assert(name=='owner','Unknown existing module data; nothing adopted.')end
        assert(lfs.mkdir(root))
        fs.write_new(root..'/owner','MZD_WALLPAPER_DATA_V1\n')
        fs.write_new(root..'/gallery.tsv',catalog.encode({},catalog.settings({})))
    end
    local collection=store.create(fs,root)
    local request=api.create(collection,{
        image=function(key)return context.urls.image('gallery',key)end,
        preview=function(key)return context.urls.image('preview',key)end,
        usb=function(source,name)return context.urls.image('usb',source..'\0'..name)end})
    return {
        request=request,tick=collection.tick,close=collection.close,
        image=function(kind,key)
            local data
            if kind=='gallery'then data=collection.image(key)
            elseif kind=='preview'then data=collection.preview(key)
            elseif kind=='usb'then
                local source,name=key:match('^([^%z]+)%z([^%z]+)$');assert(source,'Invalid USB image key.')
                data=collection.usb_image(source,name,true)
            else error('Unknown wallpaper image kind.')end
            return data,'image/png'
        end
    }
end
