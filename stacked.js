const stacked = require("./src/stacked.js");
const fs = require("fs");
const Stacked = stacked.Stacked;

let err = (msg) => {
    console.error(msg);
    process.exit(1);
};

if(require.main === module){
    let args = require("minimist")(process.argv.slice(2), {
        alias: {
            "t": "test",
            "p": "printLast",
            "P": "printStack", 
            "e": "exec"
        },
        boolean: ["t", "p", "P"],
    });
    let prog;
    if(args.t){
        require("./test/test.js").test();
        return;
    }
    if(args.e){
        prog = args.e.toString();
    } else {
        let fileName = args.f ? args.f : args._.shift();
        if(!fileName){
            err("no file passed");
        } else if(!fs.exists(fileName)){
            err("no such file `" + fileName + "`");
        }
        prog = fs.readFileSync(fileName).toString();
    }
    let inst = new Stacked(prog);
    inst.vars.set("args", args._);
    inst.run();
    if(args.P){
        console.log(disp(inst.stack));
    }
    if(args.p){
        let outInst = new Stacked("disp");
        outInst.stack.push(inst.stack.pop());
        outInst.run();
    }
}

module.exports = stacked;