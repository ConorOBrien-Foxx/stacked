const stacked = require("./src/stacked.js");
const fs = require("fs");
const path = require("path");
const Stacked = stacked.Stacked;

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

const ESCAPE = "\x1b";
const colors = {
    "bold": 1,
    "black": 30,
    "red": 31,
    "green": 32,
    "yellow": 33,
    "blue": 34,
    "purple": 35,
    "cyan": 36,
    "white": 37,
    "standard": 39
};
const colorize = (color) => (str) =>
    ESCAPE + "[" + colors[color] + "m" + str + ESCAPE + "[0m";
const styles = {
    "string": colorize("purple"),
    "number": colorize("yellow"),
    "setfunc": colorize("green"),
    "setvar": colorize("green"),
    "op": colorize("bold"),
};
styles["lambdaStart"] = styles["lambdaEnd"] =
styles["funcStart"] = styles["funcEnd"] = colorize("cyan");
const getStyle = (e) => styles[e.type] ? styles[e.type](e.raw) : e.raw;
const highlight = (prog) =>
    stacked.tokenize(prog, { keepWhiteSpace: true, ignoreError: true })
        .map(getStyle).join("");

if(require.main === module){
    let args = require("minimist")(process.argv.slice(2), {
        alias: {
            "t": "test",
            "p": "printLast",
            "P": "printStack", 
            "e": "exec",
			"c": "config",
			"f": "file",
            "h": "highlight",
        },
        boolean: ["t", "p", "P", "h"],
    });
    let prog;
	let conf = JSON.parse(readFile(args.config ||
		path.join(__dirname, "stacked.config")
	));
    if(args.e === true)
        args.e = args.exec = " ";
	for(let p in conf){
		args[p] = conf[p];
	}
    if(args.test){
        require("./test/test.js").test();
        return;
    }
    if(args.exec){
        prog = args.exec.toString();
    } else {
        let fileName = args.file ? args.file : args._.shift();
		prog = readFile(fileName);
    }
    if(args.highlight){
        process.stdout.write(highlight(prog));
        return;
    }
    let inst = new Stacked(prog.replace(/\r/g, ""));
    inst.vars.set("args", args._);
    inst.run();
    if(args.printStack){
        console.log(disp(inst.stack));
    }
    if(args.printLast){
        let outInst = new Stacked("disp");
        outInst.stack.push(inst.stack.pop());
        outInst.run();
    }
}

module.exports = stacked;