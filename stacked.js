const stacked = require("./src/stacked.js");
const fs = require("fs");

let err = (msg) => {
    console.error(msg);
    process.exit(1);
};

if(require.main === module){
    let args = require("minimist")(process.argv.slice(2), {
        alias: { "t" : "test" },
        boolean: ["t"]
    });
    let prog;
    if(args.t){
        require("./test/test.js").test();
        return;
    }
    if(args.e){
        prog = args.e;
    } else {
        let fileName = args.f ? args.f : args._.shift();
        if(!fileName){
            err("no file passed");
        } else if(!fs.exists(fileName)){
            err("no such file `" + fileName + "`");
        }
        prog = fs.readFileSync(fileName).toString();
    }
    let inst = new stacked.Stacked(prog);
    inst.vars.set("args", args._);
    inst.run();
}

module.exports = stacked;