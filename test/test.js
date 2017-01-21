const stacked = require("./../src/stacked.js");
const Decimal = require("./../src/decimal.js");
const equal   = require("./../src/funcs.js").equal;
const defined = require("./../src/funcs.js").defined;
const repr    = require("./../src/funcs.js").repr;

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
        err(`When running \`${code}\`: Runtime error: ${e}`);
    }
    
    if(defined(check.out, out) !== out){
        tErr("output", check.out, out);
    }
    
    if(!equal(defined(check.stack, ent.stack), ent.stack)){
        tErr("stack", disp(check.stack), disp(ent.stack));
    }
}

let tester = {};

tester.testCases = [
    ["'Hello, World!' put", { out: "Hello, World!" }],
    ["'Hello, World!' out", { out: "Hello, World!\n" }],
    ["'Hello, World!' disp", { out: "'Hello, World!'\n" }],
    ["'O''Brien' put", { out: "O'Brien" }],
    ["'''' put", { out: "'" }],
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
];
tester.test = (info = true) => {
    for(let [prog, out] of tester.testCases){
        expect(prog, out);
    }
    if(info)
        console.log(`All checks (${tester.testCases.length}) passed successfully`);
}

module.exports = tester;