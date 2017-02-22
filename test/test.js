 const stacked   = require("./../src/stacked.js");
const Decimal   = require("./../src/decimal.js");
const equal     = require("./../src/funcs.js").equal;
const defined   = require("./../src/funcs.js").defined;
const isDefined = require("./../src/funcs.js").isDefined;
const repr      = require("./../src/funcs.js").repr;

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

let lookingForTypes = ["quoteFunc", "op"];

let expect = (code, check) => {
    let out = "";
    let foundOps = [];
    
    let tErr = expectationError(code);
    
    let ent;
    try {
        ent = stacked(code, {
            output: (e) => out += e,
            observeToken: (op) => {
                // assumption: ES7's includes. Present in node.js
                if(lookingForTypes.includes(op.type)){
                    foundOps.push(op.value || op.name);
                }
            },
        });
    } catch(e){
        // if(check.error)
        err(`When running \`${code}\`: Runtime error: ${e}`);
    }
    
    if(defined(check.out, out) !== out){
        tErr("output", check.out, out);
    } else if(!isDefined(check.out) && out !== ""){
        console.warn("warning: in `" + code + "`: output received without output check specified.");
        console.warn(out.replace(/^/gm, "  "));
    }
    
    if(!equal(defined(check.stack, ent.stack), ent.stack)){
        tErr("stack", disp(check.stack), disp(ent.stack));
    }
    
    let etop = ent.stack[ent.stack.length - 1];
    
    if(!equal(defined(check.top, etop), etop)){
        tErr("top of stack", disp(check.top), disp(etop));
    } else if(isDefined(check.top)){
        if(ent.stack.length > 1){
            console.warn("warning: in `" + code + "`: only checked top of stack, but there are still members on it.");
        }
    }
    foundOps.output = out;
    foundOps.stack = ent.stack;
    return foundOps;
}

let tester = {};

tester.testCases = [
    ["'Hello, World!'", { top: "Hello, World!" }],
    ["'Hello, World!' put", { out: "Hello, World!" }],
    ["'Hello, World!' out", { out: "Hello, World!\n" }],
    ["'Hello, World!' disp", { out: "'Hello, World!'\n" }],
    ["(1 2 'a') disp", { out: "(1 2 'a')\n" }],
    ["(1 2 'a') repr out", { out: "(1 2 'a')\n" }],
    ["'O''Brien' put", { out: "O'Brien" }],
    ["'''' put", { out: "'" }],
    ["(1 2 'a') rawout", { out: "(1 2 a)\n" }],
    ["('a' 'b' 'c') rawout", { out: "(a b c)\n" }],
    ["1 2 3 sout", { out: "(1 2 3)\n" }],
    
    ["[]", {}],
    ["[3 +]", {}],
    ["{ x : x }", {}],
    ["{! n }", {}],
    
    ["3 @a  a", { stack: [ D(3) ] }],
    // globally declares!??!?!?!
    
    ["3 4 + put", { out: "7" }],
    ["3 4 +", { stack: [D(7)] }],
    ["(1 2) (3 4) +", { stack: [ [4, 6].map(D) ] }],
    ["'foo' 'bar' +", { stack: ["foobar"] }],
    ["'ca' ('r' 't' 'b') +", { stack: [ ["car", "cat", "cab"] ] }],
    
    ["4 [3 +] !", { stack: [ D(7) ] }],
    ["4 [3] [+] + !", { stack: [ D(7) ] }],
    ["(1 2) (3 4) ++", { stack: [ [1, 2, 3, 4].map(D) ] }],
    ["(1 2) (3 4) \\ ++", { stack: [ [3, 4, 1, 2].map(D) ] }],
    ["22 [+] [3] ++ !", { stack: [ D(25) ] }],
    
    ["2 1 -", { stack: [ D(1) ] }],
    ["(1 2) 1 -", { stack: [ [0, 1].map(D) ] }],
    ["'Hello, world!' 'l' -", { top: "Heo, word!" }],
    ["'Hello... world!' '.' /", { top: "Hello world!" }],
    
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
    ["'Hello!' 'l' %", { top: "Heo!" }],
    ["'Hello!' '\\w' %", { top: "!" }],
    
    // test StRegex
    ["'Hello, World-02391!' '\\m' %", { top: "H, W-02391!" }],
    ["'Hello, World-02391!' '\\M' %", { top: "elloorld" }],
    ["'Hello, World-02391!' '\\o' %", { top: "ello, orld-02391!" }],
    ["'Hello, World-02391!' '\\O' %", { top: "HW" }],
    ["'Hello, World-02391!' '\\i' %", { top: ", -!" }],
    ["'Hello, World-02391!' '\\I' %", { top: "HelloWorld02391" }],
    ["'Hello, World-02391!' '\\l' %", { top: ", -02391!" }],
    ["'Hello, World-02391!' '\\L' %", { top: "HelloWorld" }],
    
    ["_3 2 mod", { top: D(1) }],
    ["3 2 mod", { top: D(1) }],
    
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
    ["(1 2) (2) =", { top: FALSE }],
    ["(1 2) (1 2 3 4) =", { top: FALSE }],
    
    ["1 2 !=", { top: TRUE }],
    ["2 2 !=", { top: FALSE }],
    ["3 4 !=", { top: TRUE }],
    ["'a' 'a' !=", { top: FALSE }],
    ["'a' 'b' !=", { top: TRUE }],
    ["'a' 'ab' !=", { top: TRUE }],
    ["$'a' $'a' !=", { top: FALSE }],
    ["$'a' $'ab' !=", { top: TRUE }],
    ["$'foo' $'barbaz' !=", { top: TRUE }],
    ["(1 2) (1 2) !=", { top: FALSE }],
    ["(1 2) (4 2) !=", { top: TRUE }],
    ["(1 2) (2) !=", { top: TRUE }],
    ["(1 2) (1 2 3 4) !=", { top: TRUE }],
    
    ["1 2 eq", { top: FALSE }],
    ["2 2 eq", { top: TRUE }],
    ["2 (1 2 3) eq", { top: [FALSE, TRUE, FALSE] }],
    ["(3 2 1) (1 2 3) eq", { top: [FALSE, TRUE, FALSE] }],
    
    ["1 2 neq", { top: TRUE }],
    ["2 2 neq", { top: FALSE }],
    ["2 (1 2 3) neq", { top: [TRUE, FALSE, TRUE] }],
    ["(3 2 1) (1 2 3) neq", { top: [TRUE, FALSE, TRUE] }],
    
    ["1 2 <", { top: TRUE }],
    ["2 2 <", { top: FALSE }],
    ["3 2 <", { top: FALSE }],
    ["2 (1 2 3) <", { top: [FALSE, FALSE, TRUE] }],
    ["(3 2 1) (1 2 3) <", { top: [FALSE, FALSE, TRUE] }],
    
    ["1 2 >", { top: FALSE }],
    ["2 2 >", { top: FALSE }],
    ["3 2 >", { top: TRUE }],
    ["2 (1 2 3) >", { top: [TRUE, FALSE, FALSE] }],
    ["(3 2 1) (1 2 3) >", { top: [TRUE, FALSE, FALSE] }],
    
    ["1 2 <=", { top: TRUE }],
    ["2 2 <=", { top: TRUE }],
    ["3 2 <=", { top: FALSE }],
    ["2 (1 2 3) <=", { top: [FALSE, TRUE, TRUE] }],
    ["(3 2 1) (1 2 3) <=", { top: [FALSE, TRUE, TRUE] }],
    
    ["1 2 >=", { top: FALSE }],
    ["2 2 >=", { top: TRUE }],
    ["3 2 >=", { top: TRUE }],
    ["2 (1 2 3) >=", { top: [TRUE, TRUE, FALSE] }],
    ["(3 2 1) (1 2 3) >=", { top: [TRUE, TRUE, FALSE] }],
    
    ["3!", { top: D(6) }],
    ["4 [3 +]!", { top: D(7) }],
    
    ["3 4 |", { top: FALSE }],
    ["4 4 |", { top: TRUE }],
    
    ["3 4 |>", { top: [3, 4].map(D) }],
    ["3 6 |>", { top: [3, 4, 5, 6].map(D) }],
    ["3 3 |>", { top: [3].map(D) }],
    ["3 2 |>", { top: [] }],
    ["_2 2 |>", { top: [-2, -1, 0, 1, 2].map(D) }],
    
    ["3 4 ..", { top: [3].map(D) }],
    ["3 6 ..", { top: [3, 4, 5].map(D) }],
    ["3 3 ..", { top: [] }],
    ["3 2 ..", { top: [] }],
    ["_2 2 ..", { top: [-2, -1, 0, 1].map(D) }],
    ["_2 2 ..", { top: [-2, -1, 0, 1].map(D) }],
    
    ["0 :>", { top: [] }],
    ["1 :>", { top: [0].map(D) }],
    ["4 :>", { top: [0, 1, 2, 3].map(D) }],
    
    ["0 ~>", { top: [] }],
    ["1 ~>", { top: [1].map(D) }],
    ["4 ~>", { top: [1, 2, 3, 4].map(D) }],
    
    ["2 ~", { top: D(-3) }],
    ["2 ~ ~", { top: D(2) }],
    ["2.5 ~ ~", { top: D(2) }],
    
    ["3 neg", { top: D(-3) }],
    ["3 neg neg", { top: D(3) }],
    
    ["(1 2 3) ' ' join", { top: "1 2 3" }],
    ["(1) ' ' join", { top: "1" }],
    ["'abc' ' ' join", { top: "a b c" }],
    ["'abc' '()' join", { top: "a()b()c" }],
    
    ["(1 2 3) $! oneach!", { top: [1, 2, 6].map(D) }],
    ["4 $! oneach!", { top: D(24) }],
    ["(1 2 3) $! \"!", { top: [1, 2, 6].map(D) }],
    ["4 $! \"!", { top: D(24) }],
    
    ["(1 2 3) $! each", { top: [1, 2, 6].map(D) }],
    ["4 $! each", { top: D(24) }],
    
    ["'abcdef' '.+c' 'foo' repl", { top: "foodef" }],
    ["'abcdef' '.+c' $rev repl", { top: "cbadef" }],
    
    ["'abc\ndef' '^.' '@' mrepl", { top: "@bc\n@ef" }],
    ["'abc\ndef' '^.' $upper mrepl", { top: "Abc\nDef" }],
    
    ["'<<<><>>' '<>' '' recrepl", { top: "<" }],
    ["'<<<><>>' '<>' $rev recrepl", { top: ">>><<<<" }],
    ["'<<<><>>' '<>' '' rrepl", { top: "<" }],
    ["'<<<><>>' '<>' $rev rrepl", { top: ">>><<<<" }],
    
    ["(1 2 3) merge", { stack: [1, 2, 3].map(D) }],
    ["(1 2 3) ...", { stack: [1, 2, 3].map(D) }],
    
    ["1 2 3 sgroup", { top: [1, 2, 3].map(D) }],
    ["sgroup", { top: [] }],
    
    ["1 2 3 2 nsgroup", { stack: [D(1), [2, 3].map(D)] }],
    
    ["3 dup", { stack: [3, 3].map(D) }],
    ["3 :", { stack: [3, 3].map(D) }],
    
    ["1 4 swap", { stack: [4, 1].map(D) }],
    ["1 4 \\", { stack: [4, 1].map(D) }],
    
    ["1 4 spop", { stack: [1].map(D) }],
    ["spop", { stack: [] }],
    
    ["'abcdef' 2 drop", { top: "cdef" }],
    
    ["'abcdef' 2 take", { top: "ab" }],
    
    ["1 2 3 4 srev", { stack: [4, 3, 2, 1].map(D) }],
    
    ["'asdf' behead", { top: "sdf" }],
    ["'asdf' head", { top: "a" }],
    ["'asdf' betail", { top: "asd" }],
    ["'asdf' tail", { top: "f" }],
    
    ["1 2 $+ exec", { top: D(3) }],
    ["1 2 $+ !", { top: D(3) }],
    
    ["1 not", { top: FALSE }],
    ["0 not", { top: TRUE }],
    ["() not", { top: FALSE }],
    ["'' not", { top: TRUE }],
    ["_1 not", { top: FALSE }],
    
    ["'a' ord", { top: D(97) }],
    ["'ab' ord", { top: D(97) }],
    ["$'ab' ord", { top: [97, 98].map(D) }],
    ["'a' #.", { top: D(97) }],
    ["'ab' #.", { top: D(97) }],
    ["$'ab' #.", { top: [97, 98].map(D) }],
    
    ["hold 3 put release", { top: "3" }],
    ["hold 3 out release", { top: "3\n" }],
    ["hold forget about it release", { top: "No, seriously, forget about it!" }],
    
    ["((1 2) (3 4)) joingrid", { top: "12\n34" }],
    
    ["3 [: 1 -] loop", { stack: [3, 2, 1, 0].map(D) }],
    
    ["{ i : i put } 3 6 for", { out: "3456" }],
    
    ["(_2 0 32) skewsign", { top: [0, 1, 2].map(D) }],
    
    ["($neg $inc $square) $skewsign agenda oneach @:t  (_2 0 2) t", { top: [2, 1, 4].map(D) }],
    ["$(neg inc square) $skewsign agenda oneach @:t  (_2 0 2) t", { top: [2, 1, 4].map(D) }],
    // ["$(- * +) $<=> agenda @:t _2 3 DEBUG t", { top: D(1) }],
    
    ["(0 4 2) size", { top: D(3) }],
    ["42 size", { top: D(2) }],
    
    ["#(_2 3 >) #(_2 3 <) -", { stack: [D(-1)] }],
    
    ["5 ulam", { top: [5, 16, 8, 4, 2, 1].map(D) }],
    
    ["[3 out] 1 if", { out: "3\n" }],
    ["[3 out] 0 if", { out: "" }],
    ["[3 out] '' if", { out: "" }],
    
    ["[3 out] '' unless", { out: "3\n" }],
    ["[3 out] 1 unless", { out: "" }],
    
    ["1 2 3 ifelse", { top: D(1) }],
    ["1 2 [+] [-] 3 ifelse", { top: D(3) }],
    ["1 2 [+] [-] 0 ifelse", { top: D(-1) }],
    
    ["1 2 slen put", { out: "2" }],
    ["slen put", { out: "0" }],
    
    ["1 2 3 4 3 flush", { stack: [] }],
    ["flush", { stack: [] }],
    
    ["(1 2 3) $square map", { top: [1, 4, 9].map(D) }],
    ["(1 2 3) [2+] map", { top: [3, 4, 5].map(D) }],
    
    ["1 2 3 $square smap", { stack: [1, 4, 9].map(D) }],
    ["1 2 3 [2+] smap", { stack: [3, 4, 5].map(D) }],
    
    ["1 2 3 $+ sfold", { top: D(6) }],
    ["4 5 2 $/ sfold", { top: D(0.4) }],
    ["1 2 3 [+ square] sfold", { top: D(144) }],
    
    ["1 2 3 $+ sfoldr", { top: D(6) }],
    ["4 5 2 $/ sfoldr", { top: D(0.1) }],
    ["1 2 3 [+ square] sfoldr", { top: D(676) }],
    
    ["1 2 3 4   0 2 nswap", { stack: [3, 2, 1, 4].map(D) }],
    
    ["(1 2 3 4) [0 2 nswap] apply", { top: [3, 2, 1, 4].map(D) }],
    
    ["1 precision       3.2  2 +", { top: D(5) }],
    // make sure precision doesn't persist
    ["                  3.2  2 +", { top: D(5.2) }],
    ["22 precision        2 71 ^", { top: D("2361183241434822606848") }],
    
    ["5 2 tobase", { top: [1, 0, 1].map(D) }],
    ["5 5 tobase", { top: [1, 0].map(D) }],
    ["5 2 tb", { top: [1, 0, 1].map(D) }],
    ["5 5 tb", { top: [1, 0].map(D) }],
    ["(1 0) 5 antibase", { top: D(5) }],
    ["(1 0 1) 2 antibase", { top: D(5) }],
    ["(1 0) 5 ab", { top: D(5) }],
    ["(1 0 1) 2 ab", { top: D(5) }],
    ["123 36 baserep", { top: "3F" }],
    ["123 2 baserep", { top: "1111011" }],
    ["'3F' 36 antibaserep", { top: D(123) }],
    ["'1111011' 2 antibaserep", { top: D(123) }],
    ["'3F' 36 abr", { top: D(123) }],
    ["'1111011' 2 abr", { top: D(123) }],
    
    ["'Hello' '.' 10 pad", { top: ".....Hello" }],
    ["'Hello' '.' 8 pad", { top: "...Hello" }],
    ["'Hello' '.:' 8 pad", { top: ".:.Hello" }],
    ["'Hello' '.:' 0 pad", { top: "Hello" }],
    
    ["'Hello' '.' 10 rpad", { top: "Hello....." }],
    ["'Hello' '.' 8 rpad", { top: "Hello..." }],
    ["'Hello' '.:' 8 rpad", { top: "Hello.:." }],
    ["'Hello' '.:' 0 rpad", { top: "Hello" }],
    
    ["'Hello' 7 dpad", { top: "  Hello" }],
    ["(1 2 3 4 5) 7 dpad", { top: [0, 0, 1, 2, 3, 4, 5].map(D) }],
    
    // insert and ffix later
    
    ["0 0 and", { top: D(0) }],
    ["1 0 and", { top: D(0) }],
    ["0 1 and", { top: D(0) }],
    ["1 1 and", { top: D(1) }],
    
    ["0 0 or", { top: D(0) }],
    ["1 0 or", { top: D(1) }],
    ["0 1 or", { top: D(1) }],
    ["1 1 or", { top: D(1) }],
    
    ["0 0 xor", { top: D(0) }],
    ["1 0 xor", { top: D(1) }],
    ["0 1 xor", { top: D(1) }],
    ["1 1 xor", { top: D(0) }],
    
    ["3 10 BAND", { top: D(2) }],
    ["3 10 BOR", { top: D(11) }],
    ["3 10 BXOR", { top: D(9) }],
    
    ["(1 2 3) (4 5 6) $+ table", { top: 
        [[5, 6, 7], [6, 7, 8], [7, 8, 9]].map(e => e.map(D))
    }],
    
    //--bootstrapped functions
    
    ["_2 3 cmp", { stack: [D(-1)] }],
    ["3 3 cmp", { stack: [D(0)] }],
    ["10 3 cmp", { stack: [D(1)] }],
    ["_2 3 <=>", { stack: [D(-1)] }],
    ["3 3 <=>", { stack: [D(0)] }],
    ["10 3 <=>", { stack: [D(1)] }],
    
    ["4 dec", { top: D(3) }],
    ["4 inc", { top: D(5) }],
    ["4 double", { top: D(8) }],
    ["4 halve", { top: D(2) }],
    
    ["5 bits", { top: [1, 0, 1].map(D) }],
    ["123 bin", { top: "1111011" }],
];

// console.log(stacked("10 4 cmp").stack.join(";;;;"));

let foundOps = [
    // include the ones that don't/can't be tested
    "debug", "DEBUG", "input", "INPUT", "prompt", "PROMPT",
    "exit", "ret", "return", "rand"
];
tester.test = (info = true) => {
    for(let [prog, out] of tester.testCases){
        foundOps = foundOps.concat(expect(prog, out));
    }
    if(info){
        console.log(`All checks (${tester.testCases.length}) passed successfully`);
        foundOps = new Set(foundOps);
        let coveredOps = foundOps.size;
        let totalOps = stacked("").ops.size;
        let ratio = Math.ceil(coveredOps / totalOps * 10000) / 100;
        console.log(`Number of ops tested: ${coveredOps} out of ${totalOps} = ${ratio}%`);
    }
}

tester.verboseTest = () => {
    for(let [prog, out] of tester.testCases){
        let expectations = expect(prog, out);   // these are surely great!
        console.log(stacked.highlight("   " + prog + "\n" + repr(expectations.stack)));
        foundOps = foundOps.concat();
    }
    console.log(`All checks (${tester.testCases.length}) passed successfully`);
    foundOps = new Set(foundOps);
    let coveredOps = foundOps.size;
    let totalOps = stacked("").ops.size;
    let ratio = Math.ceil(coveredOps / totalOps * 10000) / 100;
    console.log(`Number of ops tested: ${coveredOps} out of ${totalOps} = ${ratio}%`);
}

module.exports = tester;