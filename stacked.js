const stacked = require("./src/stacked.js");
const fs = require("fs");
const path = require("path");
const Stacked = stacked.Stacked;
const sanatize = stacked.sanatize;
const highlight = stacked.highlight;

let err = (msg) => {
    console.error(msg);
    process.exit(1);
}

let readFile = (name) => {
	if(!name){
		err("no file passed");
	}
	try {
		return fs.readFileSync(name).toString();
	} catch(e){
		// console.log(e);
		err("no such file `" + name + "`");
	}
}

let use = (filePath) => {
	if(/^\.(?:stk|stacked)$/.test(filePath)){
		stacked.bootstrapExp(readFile(filePath));
	} else {
		require(filePath)(stacked);
	}
}
stacked.use = use;

if(require.main === module){
    let args = require("minimist")(process.argv.slice(2), {
        alias: {
            "t": "test",
            "T": "verboseTest",
            "p": "printLast",
            "P": "printStack", 
            "e": "exec",
			"c": "config",
			"f": "file",
            "h": "highlight",
            "o": "outLast",
            "n": "overStdin",
            "N": "overStdinPrint",
            "a": "afterPrint",
            "A": "afterDisp",
            "b": "bare",
        },
        boolean: ["t", "p", "P", "h", "o", "T", "n", "N", "a", "A", "b"],
    });
    let prog;
	let conf = JSON.parse(readFile(args.config ||
		path.join(__dirname, "stacked.config")
	));
    if(args.overStdinPrint){
        args.afterPrint = true;
        args.overStdin = true;
    }
    if(args.e === true)
        args.e = args.exec = " ";
	for(let p in conf){
		args[p] = conf[p];
	}
    if(!args.bare)
        stacked.init();
    
    if(args.test){
        require("./test/test.js").test();
        return;
    } else if(args.verboseTest){
        require("./test/test.js").verboseTest();
        return;
    }
    if(args.exec){
        prog = args.exec.toString();
    } else {
        let fileName = args.file ? args.file : args._.shift();
		prog = readFile(fileName);
    }
    if(args.afterPrint)
        prog += " echo";
    if(args.afterDisp)
        prog += " show";
    if(args.overStdin){
        prog = "{ L N : L@LINE N@LINENUM N L " + prog + " } online";
    }
    if(args.highlight){
        process.stdout.write(highlight(prog));
        return;
    }
    let inst = new Stacked(prog.replace(/\r/g, ""));
    inst.vars.set("args", sanatize(args._));
    inst.run();
    if(args.printStack){
        console.log(disp(inst.stack));
    }
    if(args.printLast){
        let outInst = new Stacked("disp");
        outInst.stack.push(inst.stack.pop());
        outInst.run();
    }
    if(args.outLast){
        let outInst = new Stacked("out");
        outInst.stack.push(inst.stack.pop());
        outInst.run();
    }
}

module.exports = stacked;