class Table {
    // assumes CSV
    constructor(content){
        this.data = Table.parseCSV(content);
    }
    
    toString(){
        // get column lengths
        let clens = [];
        for(let row of this.data){
            for(let i = 0; i < row.length; i++){
                clens[i] = clens[i] || 0;
                clens[i] = Math.max(clens[i], row[i].length);
            }
        }
        let res = "";
        let headerMade = false;
        for(let row of this.data){
            res += row.map((e, i) => {
                let k = Table.conf.padf(e, clens[i]);
                if(Table.conf.pretty)
                    k = " " + k + " ";
                return k;
            }).join(Table.conf.vstrut) + "\n";
            if(!headerMade){
                res += row.map((e, i) => Table.conf.hstrut.repeat(clens[i] + 2)).join(Table.conf.intersect) + "\n";
                headerMade = true;
            }
        }
        return res;
    }
    
    static center(a, l, c = " "){
        while(a.length + 1 < l){
            a = c + a + c;
        }
        if(a.length < l) a = c + a;
        return a;
    }
    
    // based on the ABNF grammar found in https://www.ietf.org/rfc/rfc4180.txt
    // differences: records are separated by LF not CRLF.
    // input: a string representing a CSV document.
    // output: a 2d array of strings
    static parseCSV(str){
        let index = 0;
        let hasCharsLeft = () => index < str.length;
        let matcher = (f) => {
            let newf = f instanceof Function ? f : (e) => e == f;
            return () => {
                if(newf(str[index])){
                    return str[index++];
                } else
                    return false;
            }
        }
        let readDQuote = matcher('"');
        let readComma = matcher(',');
        let readCR = matcher('\r');
        let readLF = matcher('\n');
        let readCRLF = () => {
            let res, build = "";
            let saveIndex = index;
            if(res = readCR()){
                build += res;
                if(res = readLF()){
                    build += res;
                    return build;
                } else {
                    index = saveIndex;
                    return false;
                }
            } else {
                index = saveIndex;
                return false;
            }
        }
        let read2DQuote = () => {
            let res, build = "";
            let saveIndex = index;
            if(res = readDQuote()){
                build += res;
                if(res = readDQuote()){
                    build += res;
                    return build;
                } else {
                    index = saveIndex;
                    return false;
                }
            } else {
                index = saveIndex;
                return false;
            }
        }
        let readTextData = matcher(e => (/[\x20\x21\x23-\x2B\x2D-\x7E]/).test(e));
        let readNonEscaped = () => {
            let res, build = "";
            while(res = readTextData()){
                build += res;
            }
            return build;
        }
        let readEscaped = () => {
            let build = "";
            let saveIndex = index;
            let res;
            if(res = readDQuote()){
                while(res =
                    readTextData() ||
                    readComma() ||
                    readCR() ||
                    readLF() ||
                    read2DQuote()
                ){
                    build += res;
                }
                if(res = readDQuote()){
                    return build.replace(/""/g, "\"");
                } else {
                    index = saveIndex;
                    return false;
                }
            } else {
                index = saveIndex;
                return false;
            }
        }
        let readField = () => {
            let res;
            let build = "";
            while(res = readEscaped() || readNonEscaped())
                build += res;
            return build;
        }
        let readRecord = () => {
            let build = [], res;
            if(res = readField()){
                build.push(res);
                for(;;){
                    if(res = readComma()){
                        if(res = readField()){
                            build.push(res);
                        }
                    } else
                        break;
                }
                return build;
            } else
                return false;
        }
        let readCSV = () => {
            let res, build = [];
            if(res = readRecord()){
                build.push(res);
                for(;;){
                    if(res = readLF()){
                        if(res = readRecord()){
                            build.push(res);
                        } else
                            break;
                    } else
                        break;
                }
                return build;
            } else
                return false;
        }
        return readCSV();
    }
    
    static setPadF(v){
        if(Table[v]) Table.conf.padf = Table[v];
        else Table.conf.padf = v;
    }
}

Table.conf = {
    hstrut: "-",
    vstrut: "|",
    intersect: "+",
    padf: Table.center,
    pretty: true,
}