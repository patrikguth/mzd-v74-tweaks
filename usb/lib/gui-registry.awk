# Literal manifest-derived records, never executable module source.
function quote(s, out,i,c) {
    out="\""
    for(i=1;i<=length(s);i++) {
        c=substr(s,i,1)
        if(c=="\\")out=out "\\\\"
        else if(c=="\"")out=out "\\\""
        else if(c=="<")out=out "\\u003c"
        else out=out c
    }
    gsub(/\342\200\250/,"\\u2028",out);gsub(/\342\200\251/,"\\u2029",out)
    return out "\""
}
BEGIN {FS="\t";print "window.mzdGuiRegistry={api:1,modules:["}
NF!=4 {bad=1;next}
{if(n++)printf ",\n";printf "{id:%s,menuPath:%s,label:%s,entrypoint:%s}",quote($1),quote($2),quote($3),quote($4)}
END {print "\n]};";if(bad || n>100)exit 1}
