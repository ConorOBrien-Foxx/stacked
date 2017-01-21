const stacked = require("./../src/stacked.js");
const Decimal = require("./../src/decimal.js");
const equal   = require("./../src/funcs.js").equal;
const defined = require("./../src/funcs.js").defined;
const repr    = require("./../src/funcs.js").repr;

const FALSE = Decimal(0);
const TRUE  = Decimal(1);

// wrapper for decimal for making testcases; usable in map, e.g.
//   [1, 2].map(D);
let D = (e) => new Decimal(e);

let err = (msg) => {
    console.error(msg);
    process.exit(1);
};

let expectationError = (code) => (type, wanted, got) => {
    err(`When running \`${code}\`: Expected ${type} to look like:
\`\`\`
${wanted}
\`\`\`
but got ${type}
\`\`\`
${got}
\`\`\``);
}

let expect = (code, check) => {
    let out = "";
    
    let tErr = expectationError(code);
    
    let ent;
    try {
        ent = stacked(code, { output: (e) => out += e });
    } catch(e){
        // if(check.error)
        err(`When running \`${code}\`: Runtime error: ${e}`);
    }
    
    if(defined(check.out, out) !== out){
        tErr("output", check.out, out);
    }
    
    if(!equal(defined(check.stack, ent.stack), ent.stack)){
        tErr("stack", disp(check.stack), disp(ent.stack));
    }
    
    let etop = ent.stack[ent.stack.length - 1];
    
    if(!equal(defined(check.top, etop), etop)){
        tErr("top of stack", disp(check.top), disp(etop));
    } else {
        if(ent.stack.length > 1){
            console.warn("warning: in `" + code + "`: only checked top of stack, but there are still members on it.");
        }
    }
}

let tester = {};

tester.testCases = [
    ["'Hello, World!'", { top: "Hello, World!" }],
    ["'Hello, World!' put", { out: "Hello, World!" }],
    ["'Hello, World!' out", { out: "Hello, World!\n" }],
    ["'Hello, World!' disp", { out: "'Hello, World!'\n" }],
    ["'O''Brien' put", { out: "O'Brien" }],
    ["'''' put", { out: "'" }],
    ["[]", {}],
    ["3 @a  a", { stack: [ D(3) ] }],
    ["[3 +]", {}],
    ["{ x : x }", {}],
    ["{! n }", {}],
    ["3 4 + put", { out: "7" }],
    ["3 4 +", { stack: [D(7)] }],
    ["'foo' 'bar' +", { stack: ["foobar"] }],
    ["'ca' ('r' 't' 'b') +", { stack: [ ["car", "cat", "cab"] ] }],
    ["4 [3 +] !", { stack: [ D(7) ] }],
    ["4 [3] [+] + !", { stack: [ D(7) ] }],
    ["(1 2) (3 4) +", { stack: [ [4, 6].map(D) ] }],
    ["(1 2) (3 4) ++", { stack: [ [1, 2, 3, 4].map(D) ] }],
    ["(1 2) (3 4) \\ ++", { stack: [ [3, 4, 1, 2].map(D) ] }],
    ["22 [+] [3] ++ !", { stack: [ D(25) ] }],
    ["2 1 -", { stack: [ D(1) ] }],
    ["(1 2) 1 -", { stack: [ [0, 1].map(D) ] }],
    ["1 2 /", { stack: [ D(0.5) ] }],
    ["4 _2 /", { stack: [ D(-2) ] }],
    ["3 4 ^", { stack: [ D(81) ] }],
    ["4 6 *", { stack: [ D(24) ] }],
    ["3 'q' *", { stack: [ "qqq" ] }],
    ["'>_<' 2 *", { stack: [ ">_<>_<" ] }],
    ["4 [1 +] 10 *", { stack: [ D(14) ] }],
    ["(2 3) 2 rep", { stack: [ [ [2, 3].map(D), [2, 3].map(D) ] ] }],
    ["1 2 ,", { stack: [ [1, 2].map(D) ] }],
    ["1 2 3 ,,", { stack: [ [1, 2, 3].map(D) ] }],
    ["1 2 (3),,", { stack: [ [1, 2, 3].map(D) ] }],
    ["1 2 ((3)),,", { stack: [ [D(1), D(2), [D(3)]] ] }],
    ["1 2 pair", { stack: [ [1, 2].map(D) ] }],
    ["1 (2) pair", { stack: [ [D(1), [D(2)]] ] }],
    ["1 2 %", { top: D(1) }],
    ["3 2 %", { top: D(1) }],
    ["_1 2 %", { top: D(-1) }],
    ["_3 2 %", { top: D(-1) }],
    ["_3 2 mod", { top: D(1) }],
    ["3 2 mod", { top: D(1) }],
    ["42", { top: D(42) }],
    ["4 $even nth!", { stack: [ D(8) ] }],
    ["4 $prime nth!", { stack: [ D(11) ] }],
    ["(4 5 12) 2 get", { stack: [ D(12) ] }],
    ["(4 5 12) (0 2) get", { stack: [ [4, 12].map(D) ] }],
    ["1 2 3 isolate", { stack: [ D(3) ] }],
    ["1 2 3 stack isolate", { stack: [ [1, 2, 3].map(D) ] }],
    
    ["1 2 =", { top: FALSE }],
    ["2 2 =", { top: TRUE }],
    ["3 4 =", { top: FALSE }],
    ["'a' 'a' =", { top: TRUE }],
    ["'a' 'b' =", { top: FALSE }],
    ["'a' 'ab' =", { top: FALSE }],
    ["$'a' $'a' =", { top: TRUE }],
    ["$'a' $'ab' =", { top: FALSE }],
    ["$'foo' $'barbaz' =", { top: FALSE }],
    ["(1 2) (1 2) =", { top: TRUE }],
    ["(1 2) (4 2) =", { top: FALSE }],
];
tester.test = (info = true) => {
    for(let [prog, out] of tester.testCases){
        expect(prog, out);
    }
    if(info)
        console.log(`All checks (${tester.testCases.length}) passed successfully`);
}

module.exports = tester;