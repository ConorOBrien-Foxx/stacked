const stacked = require("./src/stacked.js");
const fs = require("fs");

if(require.main === module){
    let args = require("minimist")(process.argv.slice(2));
    let prog;
    if(args.e){
        prog = args.e;
    } else {
        let fileName = args.f ? args.f : args._.shift();
        prog = fs.readFileSync(fileName).toString();
    }
    let inst = new stacked.Stacked(prog);
    inst.vars.set("args", args._);
    inst.run();
}

module.exports = stacked;