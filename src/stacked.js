var isNode = false;
var DEBUG = false;
if(typeof require !== "undefined"){
    isNode = true;
    fs = require("fs");
    utf8 = require("./utf8.js");
	Decimal = require("./decimal.js");
	Color = require("./color.js");
	Icon = require("./icon.js");
	Table = require("./table.js");
	Element = require("./element.js");
	require("./turtle.js");
	let toMerge = require("./funcs.js");
    for(let k of Object.getOwnPropertyNames(toMerge)){
        global[k] = toMerge[k];
    }
	Complex = require("./complex.js");
	CellularAutomata = require("./automata.js");
    AutomataRule = CellularAutomata.AutomataRule;
	// require("./stacked.js");
    
    // waiting for that glorious synchronous stdin!
    // prompt = require("syncprompt");
    
    
    readLineSync = require("readline-sync");
    prompt = (message = "") => readLineSync.question(message);
}

const DELAY = 200;

error = (err) => {
    try {
        new Stacked("").output("error: " + err);
    } catch(e){
        throw new Error(err);
    }
    throw new Error("haha have fun");
};

if(isNode)
    error = (err) => {
        process.stderr.write("error: " + err + "\n");
        process.exit(1);
    }

// todo: burninate this evil thingy
function typed(typeMap){
    return function(...args){
        redo: for(let t of typeMap){
            let [key, func] = t;
            let i = 0;
            for(let k of key){                
                let matched = true;
                if(k instanceof StackedPseudoType)
                    matched = k.match(args[i]);
                else if(k instanceof Array)
                    matched = k[0](args[i]);
                else
                    matched = args[i] instanceof k || args[i].constructor === k;
                
                if(!matched)
                    continue redo;
                
                i++;
            }
            return func.bind(this)(...args);
        }
        error("no matching types for " +
            args.map(e => e ? typeName(e.constructor) : "undefined")
                .join(", "));
    }
}

class StackedPseudoType {
    constructor(f){
        this.f = f;
    }
    
    match(arg){
        return this.f(arg);
    }
}

const STP = (f) => new StackedPseudoType(f);
const STP_HAS = (prop) => STP(e => isDefined(e[prop]));
const ANY = STP(() => true);
const ITERABLE = STP((e) => isDefined(e[Symbol.iterator]));
const REFORMABLE = STP_HAS(REFORM);

// todo: integrate this into everything; throw warnings for all things that don't
class StackedFunc {
    constructor(typeMap, arity = -1, options = {}){
        if(arity < 0)
            error("invalid arity `" + arity + "`");
        
        this.options = options;
        
        this.options.result = defined(this.options.result, true);
        
        if(this.options.untyped)
            this.typeMap = [
                [[ANY, ANY], typeMap],
            ];
        else
            this.typeMap = typeMap;
        
        this.arity = arity;
    }
    
    match(...args){
        // console.log(args);
        redo: for(let t of this.typeMap){
            let [key, func] = t;
            let i = 0;
            for(let k of key){
                let matched = true;
                if(k instanceof StackedPseudoType)
                    matched = k.match(args[i]);
                else
                    matched = args[i] instanceof k || args[i].constructor === k;
                
                if(!matched)
                    continue redo;
                
                i++;
            }
            return func.bind(this.dest)(...args);
        }
        error("no matching types for " +
            args.map(e => isDefined(e) ? typeName(e.constructor) : "undefined")
                .join(", "));
    }
    
    exec(dest){
        // get arguments
        let args;
        if(this.arity)
            if(dest.stack.length < this.arity)
                error("popping from an empty stack");
            else
                args = dest.stack.splice(-this.arity);
        else
            args = [];
        let res;
        this.dest = dest;   // for `match`
        if(this.options.vectorize){
            res = (this.options.vectorize === "right" ? vectorizeRight : vectorize)((...a) => {
                // console.log(a, args, this.arity);
                return this.match(...a);
            }, this.arity)(...args);
        } else {
            res = this.match(...args);
        }
        delete this.dest;
        if(this.options.result && isDefined(res))
            dest.stack.push(res);
    }
}

function func(f, merge = false, refs = [], arity = f.length){
    // warn("func is deprecated.");
    // this works for retaining the `this` instance.
    return function(){
        let args = arity ? this.stack.splice(-arity) : [];
        if(args.length !== arity){
            error("popping from an empty stack");
        }
        if(args.some(e => typeof e === "undefined"))
            error("popping from empty stack");
        args = args.map((e, i) =>
            e.type === "word" ?
                this.vars.has(e.raw) ?
                this.vars.get(e.raw)
                    : refs[i] ?
                        e : error("undefined variable `" + e.raw + "`")
                : e
        );
        let res = f.bind(this)(...args);
        if(typeof res === "undefined") return;
        if(merge)
            this.stack.push(...res);
        else
            this.stack.push(res);
    }
}

function vectorTyped(typeMap, arity = -1){
    if(arity < 0) throw new Error("bad arity");
    return func(
        vectorize(typed(new Map(typeMap)), arity),
        false,
        [],
        arity
    );
}

function rightVectorTyped(typeMap, arity = -1){
    if(arity < 0) throw new Error("bad arity");
    return func(
        vectorizeRight(typed(new Map(typeMap)), arity),
        false,
        [],
        arity
    );
}

function typedFunc(typeMap, arity = -1){
    if(arity < 0) throw new Error("bad arity");
    return func(
        typed(new Map(typeMap)),
        false,
        [],
        arity
    );
}

const FUNC_LIKE = (e) => e instanceof Lambda || e instanceof Func;

class Token {
    constructor(str, isComment){
        if(str instanceof Token) str = str.raw;
        if(isArray(str)){
            this.type = "op";
            this.func = str[0];
            return;
        }
        this.raw = str;
        if(isComment){
            this.type = "comment";
        }
        // let's identify what type of token this is
        else if(str == "."){
            this.type = "accessor";
        }
        else if(/^\s$/.test(str)){
            this.type = "whitespace";
        } else if(str === "nil"){
            this.type = "nil";
            this.value = new Nil;
        } else if(str.match(/^[_.]?\d[\d.A-Za-z]*$/)){
            this.type = "number";
            this.value = parseNum(str);
        } else if(ops.has(str)){
            this.type = "op";
            this.name = str;
            this.func = ops.get(str);
        } else if(str[0] === "'"){
            this.value = str.slice(1, -1).replace(/''/g, "'");
            this.type = "string";
        } else if(str[0] === "@"){
            this.value = str.slice(1);
            this.type = "setvar";
            if(str[1] === ":"){
                this.value = this.value.slice(1);
                this.type = "setfunc";
            }
        } else if(str.match(/^[A-Za-z_]/) || vars.has(str)){
            this.value = str;
            this.type = "word";
        } else if(str === "["){
            this.type = "funcStart";
        } else if(str === "]"){
            this.type = "funcEnd";
        } else if(str === "(*"){
            this.type = "commentStart";
        } else if(str === "*)"){
            this.type = "commentEnd";
        } else if(str === "("){
            this.type = "arrayStart";
        } else if(str === "$("){
            this.type = "funcArrayStart";
        } else if(str.slice(0, 2) === "$'"){
            this.type = "charString";
            this.value = new CharString(str.slice(2, -1).replace(/''/g, "'"));
        } else if(str[0] === "$"){
            this.type = "quoteFunc";
            this.value = str.slice(1);
        } else if(str === ")"){
            this.type = "arrayEnd";
        } else if(str === "{"){
            this.type = "lambdaStart";
        } else if(str === "}"){
            this.type = "lambdaEnd";
        } else {
            this.type = "unknown";
        }
    }
    
    toString(){
        return "{" + this.type + ":" + (this.value || this.name || this.raw || "") + "}";
    }
}

class Func {
    constructor(body){
        this.body = body;
        this.arity = body.arity || null;
    }
    
    over(...args){
        let t = new Stacked("");
        t.stack = args;
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    overWith(inst, ...args){
        if(!(inst instanceof Stacked))
            throw new Error(inst, " is not a Stacked instance.");
        let t = new Stacked("");
        t.vars = inst.vars;
        t.ops = inst.ops;
        t.stack = this.arity ? args.slice(0, this.arity) : args;
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    sanatized(inst, ...args){
        let k = this.overWith(inst, ...args.map(sanatize));
        return unsanatize(k);
    }
    
    // degree of scoping:
    // 0 - none         (nothing touched)
    // 1 - intelligent  (everything updated)
    // 2 - obnoxious    (everything integrated)
    exec(inst, scoping = 1){
        let temp = new Stacked(this.body);
        temp.stack = inst.stack;
        temp.reg = inst.reg;
        temp.ops = inst.ops.clone();
        temp.output = inst.output;
        temp.heldString = inst.heldString;
        temp.hold = inst.hold;
        temp.oldOut = inst.oldOut;
        temp.slow = inst.slow;
        temp.vars = inst.vars.clone();
        
        temp.run();
        
        inst.stack = temp.stack;
        inst.output = temp.output;
        inst.heldString = temp.heldString;
        inst.hold = temp.hold;
        inst.oldOut = temp.oldOut;
        if(temp.running === null)
            inst.running = false;
        
        // let's do some scoping. only update variables,
        // do not merge variables made inside the func
        
        // #### scoping
        // idea: make argument scoping different
        // nevermind, just have degrees of scoping
        if(scoping === 1){
            for(let [key, val] of inst.vars){
                if(temp.vars.has(key)){
                    inst.vars.set(key, temp.vars.get(key));
                }
            }
        } else if(scoping === 2){
            inst.vars = temp.vars.clone();
        } else if(scoping === 0){
            return;
        } else {
            error("invalid scoping degree `" + scoping + "`");
        }
    }
    
    toString(){
        return "[" + (this.display || this.body).trim() + "]";
    }
}

class Lambda {
    constructor(args, body){
        this.args = args;
        this.body = body;
    }
    
    get arity(){
        return this.args.length;
    }
    
    set arity(v){
        return this.arity;
    }
    
    over(...args){
        let t = new Stacked("");
        t.stack = args.slice(0, this.args.length);
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    overWith(inst, ...args){
        let t = new Stacked("");
        t.vars = inst.vars;
        t.ops = inst.ops;
        t.stack = this.arity ? args.slice(0, this.arity) : args;
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    sanatized(inst, ...args){
        let k = this.overWith(inst, ...args.map(sanatize));
        return unsanatize(k);
    }
    
    exec(inst, scoping = 1){
        let temp = new Stacked(this.body);
        // console.log(inst);
        temp.ops = inst.ops.clone();
        temp.reg = inst.reg;
        temp.output = inst.output;
        temp.heldString = inst.heldString;
        temp.hold = inst.hold;
        temp.oldOut = inst.oldOut;
        temp.slow = inst.slow;
        temp.vars = inst.vars.clone();
        
        // add the arguments
        let slice = inst.stack.splice(-this.args.length);
        for(let arg of this.args){
            temp.vars.set(arg, slice.shift());
        }
        
        temp.run();
        
        if(temp.running === null)
            inst.running = false;
        inst.stack = inst.stack.concat(temp.stack);
        inst.output = temp.output;
        inst.heldString = temp.heldString;
        inst.hold = temp.hold;
        inst.oldOut = temp.oldOut;
        
        // scoping, as per above
        
        // #### scoping
        // idea: make argument scoping different
        // nevermind, just have degrees of scoping
        if(scoping === 1){
            for(let [key, val] of inst.vars){
                if(temp.vars.has(key)){
                    inst.vars.set(key, temp.vars.get(key));
                }
            }
        } else if(scoping === 2){
            inst.vars = temp.vars.clone();
        } else if(scoping === 0){
            return;
        } else {
            error("invalid scoping degree `" + scoping + "`");
        }
        // inst.vars.forEach((key, val) => {
            // console.log(key);
            // if(temp.vars.has(key)){
                // inst.vars.set(temp.vars.get(key));
            // }
        // });
        // console.log(inst.vars);
    }
    
    toString(){
        return "{" + this.args.join(" ") + ":" + this.body.trim() + "}";
    }
}

const range = (a, b) => {
    let n = +b.sub(a);
    if(n !== ~~n)
        error("expected integer, received `" + [a, b].find(e => !e.eq(e.floor())) + "`");
    let c = Array();
    while(b.gt(a)){
        b = b.sub(1);
        c[b.sub(a)] = b;
    }
    
    return c;
}

const ops = new Map([
    // todo: fix with charstring
    ["+", new StackedFunc([
        [[Decimal, Decimal], (a, b) => a.add(b)],
        [[String, String], (a, b) => a + b],
        [[Func, Func], function(f, g){
            let k = new Func((f.body + " " + g.body).replace(/ +/g, " "));
            k.exec = function(inst){
                [f, g].forEach(e => {
                    inst.stack.push(e);
                    // console.log(disp(inst.stack));
                    ops.get("!").exec(inst);
                });
            }
            return k;
        }],
    ], 2, { vectorize: true })],
    ["++", new StackedFunc([
        [[STP_HAS("concat"), ANY], (a, b) => a.concat(b)],
        [[Func, Func], function(f, g){
            let k = new Func((f.body + " " + g.body).replace(/ +/g, " "));
            k.exec = function(inst){
                [g, f].forEach(e => {
                    inst.stack.push(e);
                    ops.get("!").exec(inst);
                });
            }
            return k;
        }],
    ], 2)],
    ["-", new StackedFunc([
        [[Decimal, Decimal], (a, b) => a.sub(b)],
    ], 2, { vectorize: true })],
    ["/", new StackedFunc([
        [[Decimal, Decimal], (a, b) => a.div(b)],
    ], 2, { vectorize: true })],
    ["^", new StackedFunc([
        [[Decimal, Decimal], (a, b) => a.pow(b)],
    ], 2, { vectorize: true })],
    ["*", new StackedFunc([
        [[Decimal, Decimal], (a, b) => a.mul(b)],
        [[Decimal, String],  (a, b) => b.repeat(+a)],
        [[String, Decimal],  (a, b) => a.repeat(+b)],
        [[Func, Decimal],    function(f, b){
            let c = Decimal(b);
            while(c.gt(0)){
                c = c.sub(1);
                f.exec(this);
            }
        }]
    ], 2, { vectorize: true })],
    ["rep", new StackedFunc([
        [[ANY, Decimal], (a, b) => [...Array(+b)].fill(a)],
    ], 2)],
    [",", new StackedFunc((a, b) => flatten([a, b], 1), 2, { untyped: true })],
    ["pair", func((a, b) => [a, b])],
    ["%", new StackedFunc([
        [[Decimal, Decimal], (a, b) => a.mod(b)],
    ], 2, { vectorize: true })],
    ["mod", new StackedFunc([
        [[Decimal, Decimal], (a, b) => {
            var c = a.mod(b);
            return c.lt(0) ? c.add(b) : c;
        }],
    ], 2, { vectorize: true })],
    // given a function, returns a function that
    // finds the nth integer after 0 for which
    // that functon yields a truthy value
    ["nth", function(){
        let func = this.stack.pop();
        if(!FUNC_LIKE(func))
            error("expected `Func` or `Lambda`, but got `" +
                typeName(func.constructor) + "` instead.");
        let k = new Func(func + " nth");
        k.exec = function(inst){
            let n = inst.stack.pop();
            assureTyped(n, Decimal);
            let last;
            for(let i = Decimal(0); n.gte(0); i = i.add(1)){
                if(falsey(func.over(i))) continue;
                n = n.sub(1);
                last = i;
            }
            inst.stack.push(last);
        }
        this.stack.push(k);
    }],
    ["prime", new StackedFunc([
        [[Decimal], isPrime]
    ], 1, { vectorize: true })],
    ["get", new StackedFunc((a, b) => {
        if(isDefined(a.get)){
            return a.get(b);
        } else {
            return a[b];
        }
    }, 2, { vectorize: "right", untyped: true })],
    ["stack", function(){
        this.stack.push(this.stack.clone());
    }],
    ["=", new StackedFunc(
        (a, b) => Decimal(+equal(a, b)),
        2,
        { untyped: true }
    )],
    ["!=", new StackedFunc(
        (a, b) => Decimal(+!equal(a, b)),
        2,
        { untyped: true }
    )],
    ["eq", new StackedFunc(
        (a, b) => Decimal(+equal(a, b)),
        2,
        { untyped: true, vectorize: true }
    )],
    ["neq", new StackedFunc(
        (a, b) => Decimal(+!equal(a, b)),
        2,
        { untyped: true, vectorize: true }
    )],
    ["<", new StackedFunc([
        [[Decimal, Decimal], (a, b) => Decimal(+a.lt(b))],
        [[String, String], (a, b) => Decimal(+(a < b))]
    ], 2, { vectorize: true })],
    ["<", new StackedFunc([
        [[Decimal, Decimal], (a, b) => Decimal(+a.lt(b))],
        [[String, String], (a, b) => Decimal(+(a < b))]
    ], 2, { vectorize: true })],
    ["<=", new StackedFunc([
        [[Decimal, Decimal], (a, b) => Decimal(+a.lte(b))],
        [[String, String], (a, b) => Decimal(+(a <= b))]
    ], 2, { vectorize: true })],
    [">", new StackedFunc([
        [[Decimal, Decimal], (a, b) => Decimal(+a.gt(b))],
        [[String, String], (a, b) => Decimal(+(a > b))]
    ], 2, { vectorize: true })],
    [">=", new StackedFunc([
        [[Decimal, Decimal], (a, b) => Decimal(+a.gte(b))],
        [[String, String], (a, b) => Decimal(+(a >= b))]
    ], 2, { vectorize: true })],
    ["!", new StackedFunc([
        [[Decimal], (a) => factorial(a)],
        [[STP(FUNC_LIKE)], function(f){
            f.exec(this);
        }],
    ], 1, { vectorize: true })],
    // ["!", function(){
        // let obj = this.stack.pop();
        // if(obj instanceof Decimal || obj instanceof Array){
            // this.stack.push(vectorize(factorial)(obj));
        // } else if(obj instanceof Func || obj instanceof Lambda){
            // obj.exec(this);
        // } else {
            // error("unrecognized type `" + typeName(obj.constructor) + "` for `!`");
        // }
    // }],
    ["nexec", function(){
        console.log(pp(this.stack));
        let [k, n] = this.stack.splice(-2);
        assureTyped(n, Decimal);
        k.exec(this, +n);
    }],
    // divides
    ["|", new StackedFunc([
        [[Decimal, Decimal], (a, b) => Decimal(+b.mod(a).eq(0))]
    ], 2, { vectorize: true })],
    ["|>", new StackedFunc([
        [[Decimal, Decimal], (a, b) => range(a, b.add(1))],
    ], 2, { vectorize: true })],
    ["..", new StackedFunc([
        [[Decimal, Decimal], range],
    ], 2, { vectorize: true })],
    [":>", new StackedFunc([
        [[Decimal], (a) => range(Decimal(0), a)],
    ], 1, { vectorize: true })],
    ["~", new StackedFunc([
        [[Decimal], a => a.floor().add(1).neg()],
    ], 1, { vectorize: true })],
    ["neg", new StackedFunc([
        [[Decimal], a => a.neg()],
    ], 1, { vectorize: true })],
    // vectorize?
    ["join", func((a, b) => a.join(b.toString()))],
    ["split", func((a, b) => a.split(b.toString()))],
    ["oneach", func((f) => {
        let k = new Func(f + "oneach");
        // dirty hack, todo: fix it
		// dear past me: in your dreams.
        // dear past me's: you guys are so immature
        if(f.arity && f.arity == 2){
            k.exec = function(inst){
                let vec = vectorize((a, b) => f.overWith(inst, a, b));
                let [e1, e2] = inst.stack.splice(-2);
                inst.stack.push(vec(e1, e2));
            };
        } else
            k.exec = function(inst){
                let vec = vectorize(e => f.overWith(inst, e));
                let entity = inst.stack.pop();
                inst.stack.push(vec(entity));
            };
        return k;
    })],
    ["each", function(){
        ops.get("oneach").bind(this)();
        ops.get("!").exec(this)();
    }],
    ["repl", new StackedFunc([
        [[String, String, String],
            (orig, target, sub) =>
                orig.replace(new RegExp(target, "g"), sub)],
        [[String, String, STP(FUNC_LIKE)], function(orig, target, sub){
            return orig.replace(new RegExp(target, "g"), (...a) => sub.sanatized(this, ...a))
        }],
    ], 3)],
    ["mrepl", new StackedFunc([
        [[String, String, String],
            (orig, target, sub) =>
                orig.replace(new RegExp(target, "gm"), sub)],
        [[String, String, STP(FUNC_LIKE)], function(orig, target, sub){
            return orig.replace(new RegExp(target, "gm"), (...a) => sub.sanatized(this, ...a));
        }],
    ], 3)],
    ["recrepl", new StackedFunc([
        [[String, String, String], 
            (orig, target, sub) =>
                recursiveRepl(orig, new RegExp(target, "g"), sub)],
        [[String, String, STP(FUNC_LIKE)], function(orig, target, sub){
            return recursiveRepl(orig, new RegExp(target, "g"), (...a) => sub.sanatized(this, ...a));
        }],
    ], 3)],
    ["merge", function(){
        let k = this.stack.pop();
        this.stack = this.stack.concat(k);
    }],
    ["sgroup", function(){
        this.stack = [this.stack];
    }],
    ["nsgroup", function(){
        this.stack.push(this.stack.splice(-this.stack.pop()));
    }],
    ["debug", new StackedFunc(e => console.log(dispJS(e)), 1, { untyped: true })],
    ["put", new StackedFunc(
        function(e){  this.output(e);  },
        1,
        { result: false, untyped: true }
    )],
    ["rawout", new StackedFunc(
        function(e){
            this.output(joinArray(e));
            this.output("\n");
        },
        1,
        { result: false, untyped: true }
    )],
    ["sout", new StackedFunc(
        function(){
            this.output(disp(this.stack));
            this.output("\n");
        },
        0,
        { result: false, untyped: true }
    )],
    ["out", new StackedFunc(
        function(e){
            this.output(e);
            this.output("\n");
        },
        1,
        { result: false, untyped: true }
    )],
    ["disp", new StackedFunc(function(e){
        this.output(disp(e));
        this.output("\n");
    }, 1, { untyped: true })],
    ["repr", new StackedFunc(repr, 1, { untyped: true })],
    ["dup", func(e => [e, e], true)],
    ["swap", func((x, y) => [y, x], true)],
    ["spop", function(){ this.stack.pop(); }],
    ["drop", new StackedFunc([
        [[STP_HAS("slice"), Decimal], (a, b) => a.slice(+b)]
    ], 2, { vectorize: "right" })],
    ["take", new StackedFunc([
        [[STP_HAS("slice"), Decimal], (a, b) => a.slice(0, +b)]
    ], 2, { vectorize: "right" })],
    ["srev", function(){ this.stack.reverse(); }],
    ["rev", new StackedFunc([
        [[String], (e) => [...e].reverse().join("")],
        [[ITERABLE], (e) => [...e].reverse()],
    ], 1)],
    ["behead", new StackedFunc([
        [[STP_HAS("slice")], e => e.slice(1)],
    ], 1)],
    ["head", new StackedFunc([
        [[STP_HAS("slice")], e => e.slice(0, 1)],
    ], 1)],
    ["betail", new StackedFunc([
        [[STP_HAS("slice")],   a => a.slice(0, -1)],
    ], 1)],
    ["tail", new StackedFunc([
        [[STP_HAS("slice")],   a => a.slice(-1)],
    ], 1)],
    ["exec", function(){
        let k = this.stack.pop();
        k.exec(this);
    }],
    ["not", new StackedFunc(a => Decimal(+falsey(a)), 1, { untyped: true })],
    ["ord", new StackedFunc([
        [[String], a => Decimal(a.charCodeAt())]
    ], 1, { vectorize: true })],
    ["chr", new StackedFunc([
        [[Decimal], a => String.fromCharCode(+a)]
    ], 1, { vectorize: true })],
    ["hold", function(){
        this.hold = true;
        this.heldString = "";
        this.oldOut = this.output;
        this.output = e => this.heldString += pp(e);
    }],
    ["release", function(){
        this.hold = false;
        this.stack.push(this.heldString);
        this.output = this.oldOut;
    }],
    ["loop", function(){
        let f = this.stack.pop();
        if(this.slow){
            let k = (f, t) => {
                f.exec(t);
                let tp = t.stack[t.stack.length - 1];
                if(falsey(tp))
                    return;
                return setTimeout(k, DELAY, f, t);
            }
            k(f, this);
        } else {
            while(true){
                f.exec(this);
                let k = this.stack.pop();
                if(falsey(k)){
                    this.stack.push(k);
                    break;
                }
            }
        }
    }],
    ["until", function(){
        let cond = this.stack.pop();
        let effect = this.stack.pop();
        let ent = this.stack.pop();
        while(true){
            let r = effect.overWith(this, ent);
            if(truthy(cond.overWith(this, r, ent))){
                this.stack.push(r);
                break;
            }
        }
    }],
    ["while", function(){
        let cond = this.stack.pop();
        let effect = this.stack.pop();
        // console.log(cond, cond+[]);
        while(true){
            cond.exec(this);
            let e = this.stack.pop();
            if(falsey(e)) break;
            effect.exec(this);
        }
    }],
    ["jump", func(function(k){
        this.index = k - 1;
    })],
    ["grid", new StackedFunc([
        [[Array], joinGrid],
    ], 1)],
    ["DEBUG", function(){
        console.log(dispJS(this.stack));
        console.log(this.stack);
    }],
    // todo: take from a textarea, maybe
    // or make another command for that
    ["input", func(() => parseNum(prompt()))],
    ["prompt", func(() => prompt())],
    ["INPUT", func((e) => parseNum(prompt(e)))],
    ["PROMPT", func((e) => prompt(e))],
    ["for", function(){
        let [f, min, max] = this.stack.splice(-3);
        // console.log(f, min, max);
        assureTyped(f,   Lambda);
        assureTyped(min, Decimal);
        assureTyped(max, Decimal);
        //todo:fix with slow
        for(var c = min; c.lte(max); c = c.add(1)){
            this.stack.push(c);
            f.exec(this);
        }
    }],
    ["agenda", function(){
        let agendaCond = this.stack.pop();  // function
        let agenda = this.stack.pop();
        let k = new Func("$(" + agenda.join(" ") + ") " + agendaCond + " agenda");
        k.exec = function(inst){
            let args = [];
            args.push(inst.stack.pop());
            if(agendaCond.arity && agendaCond.arity === 2){
                args.unshift(inst.stack.pop());
            }
            let selection = agendaCond.overWith(inst, ...args);
            inst.stack.push(...args);
            let todoNext = agenda.get(selection);
            if(!isDefined(todoNext)){
                error("no agenda item at position `" + selection + "`");
            }
            todoNext.exec(inst);
        }
        this.stack.push(k);
    }],
    ["size", new StackedFunc([
        [[Decimal], a => a.toFixed().length],
        [[STP_HAS("length")], a => new Decimal(a.length)]
    ], 1)],
    // ["size", func(a => new Decimal(a.length))],
    ["if", function(){
        let [f, ent] = this.stack.splice(-2);
        if(!FUNC_LIKE(f))
            error("type conflict; expected a function-like, received `" + f + "`, which is of type " + typeName(f.constructor));
        if(truthy(ent))
            if(f.exec)
                f.exec(this);
            else
                this.stack.push(f);
    }],
    ["unless", function(){
        let [ent, f] = this.stack.splice(-2);
        if(falsey(ent))
            if(f.exec)
                f.exec(this);
            else
                this.stack.push(f);
    }],
    ["ifelse", function(){
        if(this.stack.length < 3)
            error("popping from an empty stack");
        let [f1, f2, ent] = this.stack.splice(-3);
        let f = truthy(ent) ? f1 : f2;
        if(f.exec)
            f.exec(this);
        else
            this.stack.push(f);
    }],
    ["len", function(){
        this.stack.push(Decimal(this.stack.length));
    }],
    ["flush", function(){
        while(this.stack.length) this.stack.pop();
    }],
    ["map", new StackedFunc([
        [[Array, STP(FUNC_LIKE)], function(arr, f){
            if(f instanceof Lambda){
                return arr.map((e, i) => f.overWith(this, e, Decimal(i)));
            } else if(f instanceof Func){
                return arr.map(e => {
                    let t = new Stacked("");
                    t.vars = this.vars;
                    t.ops = this.ops;
                    t.stack.push(e);
                    f.exec(t);
                    return defined(t.stack.pop(), new Nil);
                });
            }
        }]
    ], 2)],
    // map the stack
    ["smap", function(){
        let f = this.stack.pop();
        this.stack = [this.stack, f];
        ops.get("map").bind(this)();
        this.stack = this.stack.pop();
    }],
    ["sfold", function(){
        let f = this.stack.pop();
        if(this.stack.length === 1) return;
        this.stack = [this.stack.reduce((p, c) => {
            let t = new Stacked("");
            t.stack.push(p, c);
            f.exec(t);
            return t.stack.pop();
        })].reject(falsey);
    }],
    ["sfoldr", function(){
        let f = this.stack.pop();
        if(this.stack.length === 1) return;
        this.stack = [this.stack.reverse().reduce((p, c) => {
            let t = new Stacked("");
            t.stack.push(p, c);
            f.exec(t);
            return t.stack.pop();
        })].reject(falsey);
    }],
    ["apply", function(){
        let [arr, f] = this.stack.splice(-2);
        let isString = typeof arr === "string";
        let inst = new Stacked("");
        inst.stack = [...arr];
        inst.vars = this.vars;
        f.exec(inst);
        this.stack.push(isString ? inst.stack.join("") : inst.stack);
    }],
    ["precision", function(){
        Decimal.set({
            precision: +this.stack.pop()
        });
    }],
    ["exit", function(){ this.running = false; }],
    ["ret", function(){ this.running = null; }],
    ["return", function(){
        this.stack = [this.stack.pop()];
        this.running = null;
    }],
    ["rand", vectorTyped([
        [[Decimal], (a) => a == 0 ? Decimal.random() : a.mul(Decimal.random()).floor()],
    ], 1)],
    ["nswap", function(){
        let [a0, a1] = this.stack.splice(-2);
        [this.stack[a0], this.stack[a1]] = [this.stack[a1], this.stack[a0]];
    }],
    ["tobase", new StackedFunc([
        [[Decimal, Decimal], (a, b) => toBase(a, b)]
    ], 2, { vectorize: true })],
	["antibase", new StackedFunc([
		[[Array, Decimal], (a, b) => antiBase(a, b)]
	], 2)],
	["baserep", new StackedFunc([
		[[Decimal, Decimal], (a, b) => toBaseString(a, b)],
	], 2, { vectorize: true })],
	["antibaserep", new StackedFunc([
		[[String, Decimal], (a, b) => antiBaseString(a, b)],
	], 2, { vectorize: true })],
    ["pad", new StackedFunc([
        [[STP(e => isDefined(e.padStart)), ANY, Decimal], (a, f, len) => a.padStart(len, f)],
    ], 3)],
    ["rpad", new StackedFunc([
        [[STP(e => isDefined(e.padEnd)), ANY, Decimal], (a, f, len) => a.padEnd(len, f)],
    ], 3)],
    ["dpad", new StackedFunc([
        [[STP(e => isDefined(e.padStart)), Decimal],
            (arr, len) => arr.padStart(len, isString(flatten(arr)[0]) ? " " : 0)],
    ], 2, { vectorize: "right" })],
    ["insert", function(){
        let func = this.stack.pop();
		let k = new Func(func+"insert");
		k.exec = function(inst){
			let ent = inst.stack.pop();
			if(!(ent instanceof Array))
				error(typeName(ent.constructor) + " is not insertable");
			
			inst.stack.push(ent.length <= 1 ? ent[0] : ent.reduce((p, c) => func.overWith(inst, p, c)));
		}
		this.stack.push(k);
    }],
    ["and", func((a, b) => new Decimal(+(truthy(a) && truthy(b))))],
    ["or", func((a, b) => new Decimal(+(truthy(a) || truthy(b))))],
    ["xor", func((a, b) => new Decimal(+(truthy(a) ^ truthy(b))))],
    ["BAND", func((a, b) => new Decimal(+a & +b))],
    ["BOR", func((a, b) => new Decimal(+a | +b))],
    ["BXOR", func((a, b) => new Decimal(+a ^ +b))],
    ["table", new StackedFunc([
        [[Object, Object, STP(FUNC_LIKE)],
            (a, b, f) => table(a, b, (...args) => f.over(...args))],
    ], 3)],
    ["filter", typedFunc([
        [[[(e) => isDefined(e.filter)], STP(FUNC_LIKE)], function(a, f){
            return a.filter((...args) => {
                let r = f.overWith(this, ...args.map(sanatize));
                // console.log(pp(r), ";", pp(args));
                return truthy(r);
            });
        }],
    ], 2)],
    ["reject", typedFunc([
        [[[(e) => isDefined(e.filter)], STP(FUNC_LIKE)], function(a, f){
            return a.filter((...args) => falsey(f.overWith(this, ...args)));
        }],
    ], 2)],
    ["date", vectorTyped([
        [[String], (fmt) => formatDate(new Date, fmt)],
    ], 1)],
    ["plusminus", vectorTyped([
        [[Decimal, Decimal], (a, b) => [a.add(b), a.sub(b)]],
    ], 2)],
    ["cases", function(){
        let k = new Func("case function");
        let origArr = this.stack.pop();
        k.exec = function(inst){
            let x = inst.stack.pop();
            let elseCase = null;
            let arr = [...origArr]; // copy so that in future runs it's not destroyed
            if(!arr.every(FUNC_LIKE))
                error("invalid types in `cases`: `"
                        + arr.find(e => !FUNC_LIKE(e)).toString() + "`");
            else if(arr.length % 2 == 1)
                elseCase = arr.pop();
                // error("missing effect for case (received `" +
                        // arr.length + "` entities)");
            let cases = chunk(arr, 2);
            // todo: overWith instead of over
            for(let cse of cases){
                let [qualifier, result] = cse;
                if(truthy(qualifier.overWith(inst, x))){
                    inst.stack.push(result.overWith(inst, x));
                    return;
                }
            }
            if(!elseCase)
                error("no matching case for `" + x.toString() + "`");
            else
                inst.stack.push(elseCase.overWith(inst, x));    
        }
        this.stack.push(k);
    }],
    ["fork", function(){
        let arr = this.stack.pop();
        if(arr.length !== 3)
            error("argument vector must be 3, got " + arr.length);
        let [fa, ga, ha] = arr;
        let f = a => fa.overWith(this, a);
        let g = (a, b) => ga.overWith(this, a, b);
        let h = a => ha.overWith(this, a);
        let k = new Func("");
        k.exec = function(inst){
            let arg = inst.stack.pop();
            let ltine = f(arg);
            let rtine = h(arg);
            let res = g(ltine, rtine);
            inst.stack.push(res);
        }
        k.toString = function(){
            return arr.toString();
        }
        this.stack.push(k);
    }],
    ["hook", function(){
        let arr = this.stack.pop();
        if(arr.length !== 2)
            error("argument vector must be 2, got " + arr.length);
        let [ga, fa] = arr;
        let f = a => fa.overWith(this, a);
        let g = (a, b) => ga.overWith(this, a, b);
        let k = new Func("");
        k.exec = function(inst){
            let arg = inst.stack.pop();
            let res = g(arg, f(arg));
            inst.stack.push(res);
        }
        k.toString = function(){
            return arr.toString();
        }
        this.stack.push(k);
    }],
    ["nfloor", vectorTyped([
        [[Decimal, Decimal], (n, p) => {
			let pow10 = Decimal(10).pow(p);
			return n.times(pow10).floor().div(pow10);
		}]
    ], 2)],
    ["nceil", vectorTyped([
        [[Decimal, Decimal], (n, p) => {
			let pow10 = Decimal(10).pow(p);
			return n.times(pow10).ceil().div(pow10);
		}]
    ], 2)],
    ["nround", vectorTyped([
        [[Decimal, Decimal], (n, p) => {
			let pow10 = Decimal(10).pow(p);
			return n.times(pow10).round().div(pow10);
		}]
    ], 2)],
	["todec", function(){
		let t = this.stack.pop();
		let res;
		if(t.constructor === Decimal){
			res = t;
		} else if(t.constructor === String){
			res = parseNum(t);
		} else if(t.constructor === Array){
			res = parseNum(flatten(t).join(""));
		} else {
			error("invalid type `" + t.constructor.name + "`");
		}
		this.stack.push(res);
	}],
    ["toarr", new StackedFunc([
        [[ITERABLE], (e) => [...e]],
    ], 1)],
    ["tofunc", func((s) => new Func(s))],
	["rot", func((a, n) => rotate(a, n))],
	["index", new StackedFunc([
        [[ITERABLE, ANY], (ent, n) => {
            return new Decimal([...ent].newIndexOf(n))
        }],
    ], 2, { vectorize: "right" })],
	["execeach", function(){
		let funcArr = this.stack.pop();
        if(!funcArr.every(FUNC_LIKE))
            error("expected an array of Lambdas or Funcs, received " + funcArr);
		let k = new Func("$(" + funcArr.join(" ") + ")execeach");
		k.exec = function(inst){
			let e = inst.stack.pop();
			inst.stack.push(funcArr.map(f => f.overWith(inst, e)));
		}
		this.stack.push(k);
	}],
	["hcat", typedFunc([
		[[Array, Array], hcat],
		[[String, String], hcat],
	], 2)],
	["chars", typedFunc([
		[[String], (e) => [...e]],
	], 1)],
	["chunk", func((a, b) => chunk(a, b))],
    ["chunkby", typedFunc([
        [[ITERABLE, STP(FUNC_LIKE)], function(a, f){
            return chunkBy(a, (...args) => unsanatize(f.overWith(this, ...args.map(sanatize))));
        }],
    ], 2)],
    ["runsof", typedFunc([
        [[[e => e instanceof Array || typeof e === "string"], STP(FUNC_LIKE)], (a, f) => runsOf(a, (x, y) => f.over(x, y))],
    ], 2)],
    ["eval", function(){
        let t = this.stack.pop();
        this.stack.push(new Func(t));
        ops.get("!").exec(this)();
    }],
    // ["uneval", func(Stacked.uneval)],
    ["perm", typedFunc([
        [[Array], permute],
        [[String], e => permute([...e]).map(e => e.join(""))],
    ], 1)],
    ["powerset", typedFunc([
        [[Array], powerSet],
        [[String], e => powerSet(e).map(e => e.join(""))],
    ], 1)],
    ["set", func((a, b, c) => (a[b] = c, a))],
    ["clamp", typedFunc([
        [[Decimal, Decimal, Decimal], (a, min, max) => a.add(max).mod(min).sub(min)],
    ], 3)],
    ["animate", typedFunc([
        [[STP(FUNC_LIKE), Decimal, Decimal, Decimal], function(f, min, max, delay){
            let msDelay = +delay.mul(1000);
            let rec = (i) => {
                f.overWith(this, i);
                if(i.lt(max))
                    setTimeout(rec, msDelay, i.add(1));
            }
            rec(min);
        }]
    ], 4)],
    ["animation", typedFunc([
        [[STP(FUNC_LIKE), Decimal], function(f, d){
            let n = +d.mul(1000);
            f.exec(this);
            let i = setInterval(() => f.exec(this), n);
            return new Decimal(i);
        }]
    ], 2)],
    ["stopani", typedFunc([
        [[Decimal], function(d){
            clearInterval(+d);
        }],
    ], 1)],
    ["typeof", func((a) => a.constructor)],
    ["timeop", function(){
        let f = this.stack.pop();
        let start = +new Date;
        f.exec(this);
        let end = +new Date;
        this.stack.push(Decimal(end - start).div(1000));
    }],
    ["format", typedFunc([
        [[String, Array], (s, ar) => format(s, ...ar)]
    ], 2)],
    ["sorted", typedFunc([
        [[Array], betterSort],
    ], 1)],
    ["sortby", typedFunc([
        [[Array, STP(FUNC_LIKE)], function(a, f){
            return a.sort((l, r) => f.overWith(this, l, r));
        }],
    ], 2)],
    ["transpose", typedFunc([
        [[Array], transpose],
    ], 1)],
	["prefix", new StackedFunc([
		[[STP_HAS("slice"), Decimal], (a, d) => prefix(a, d)],
	], 2, { vectorize: "right" })],
    ["keys", func((a) => sanatize([...a.keys()]))],
    ["values", func((a) => sanatize([...a.values()]))],
    ["lower", vectorTyped([
        [[String], a => a.toLowerCase()]
    ], 1)],
    ["upper", vectorTyped([
        [[String], a => a.toLowerCase()]
    ], 1)],
    ["wrap", func((a) => [a])],
    ["flat", new StackedFunc([
        [[Array], flatten],
        [[ANY], e => e]
    ], 1)],
    ["enflat", new StackedFunc([
        [[Array, Decimal], (a, b) => flatten(a, +b)],
        [[ANY, Decimal], e => e]
    ], 2, { vectorize: "right" })],
    ["cellmap", typedFunc([
        [[Array, STP(FUNC_LIKE)], function(a, f){ return cellMap(a, (...args) => f.overWith(this, ...args.map(sanatize))) }],
    ], 2)],
    ["deepmap", typedFunc([
        [[Array, STP(FUNC_LIKE)], function(a, f){ return deepMap(a, (...args) => f.overWith(this, ...args.map(sanatize))) }],
    ], 2)],
    ["has", new StackedFunc([
        [[String, ANY],    (a, b) => sanatize(!!a.find(e => equal(e, b)))],
        [[ITERABLE, ANY],  (a, b) => sanatize(!![...a].find(e => equal(e, b)))],
    ], 2, { vectorize: "right" })],
    ["intersection", typedFunc([
        [[ITERABLE, ITERABLE], intersection],
    ], 2)],
    ["union", typedFunc([
        [[ITERABLE, ITERABLE], union],
    ], 2)],
    ["partition", typedFunc([
        [[ITERABLE, ITERABLE], partition],
    ], 2)],
    ["vrep", typedFunc([
        [[String, Decimal], verticalRepeat],
    ], 2)],
    ["hrep", typedFunc([
        [[String, Decimal], horizontalRepeat]
    ], 2)],
    ["uniq", typedFunc([
        [[String], s => unique(s).join("")],
        [[ITERABLE], unique],
    ], 1)],
    ["periodloop", new StackedFunc([
        [[ANY, STP(FUNC_LIKE)], function(o, f){
            return periodLoop(o, (...a) => f.sanatized(this, ...a)).result;
        }],
    ], 2)],
    ["periodsteps", new StackedFunc([
        [[ANY, STP(FUNC_LIKE)], function(o, f){
            return periodLoop(o, (...a) => f.sanatized(this, ...a)).steps;
        }],
    ], 2)],
    ["jsonparse", typedFunc([
        [[String], JSON.parse],
    ], 1)],
    ["fixshape", typedFunc([
        [[Array], e => sanatize(fixShape(e))],
    ], 1)],
    ["nfixshape", new StackedFunc([
        [[Array, ANY], (e, x) => sanatize(fixShape(e, x))],
    ], 2)],
    ["compose", typedFunc([
        [[Func, Func], (a, b) => {
            let k = new Func(a + " " + b + " compose");
            k.exec = function(inst){
                a.exec(inst);
                b.exec(inst);
            }
            return k;
        }],
        // [[Func, Func], (a, b) => new Func(a.body + " " + b.body)],
    ], 2)],
    // takes a function and binds it to the current scope
    // works by replacing all occuracnes of variables/functions with their respective
    // entries
    ["bind", function(){
        let f = this.stack.pop();
        if(f.exec != Func.prototype.exec && f.exec != Lambda.prototype.exec){
            error("cannot bind `" + f + "`");
        }
        let toks = tokenize(f.body).map(e => {
            if(e.type === "word"){
                if(this.ops.has(e.value)){
                    let nf = this.ops.get(e.value);
                    return new Token([function(){
                        nf.bind(this)();
                    }]);
                } else if(this.vars.has(e.value)){
                    let val = this.vars.get(e.value);
                    return new Token([function(){
                        this.stack.push(val);
                    }]);
                } else {
                    return e;
                }
            } else {
                return e;
            }
        });
        let k;
        if(f instanceof Func){
            k = new Func(f.body);
        } else if(f instanceof Lambda){
            k = new Lambda(f.args, f.body);
            toks.unshift(...[...f.args].reverse().map(e => new Token("@" + e)));
        }
        k.exec = function(inst){
            let st = new Stacked("");
            st.raw = f.body;
            st.toks = toks.clone();
            st.stack = inst.stack.clone();
            st.run();
            inst.stack = st.stack.clone();
        }
        console.log(k+[]);
        console.log(k);
        this.stack.push(k);
    }],
    ["alert", func(e => alert(e))],
    ["download", new StackedFunc([
        [
            [ANY, ANY, String],
            (content, name, type) => download(content.toString(), name.toString(), type)
        ],
    ], 3)],
    ["forget", function(){
        let nextTok = this.toks[++this.index];
        if(nextTok.type === "setfunc"){
            this.ops.delete(nextTok.value);
        } else if(nextTok.type === "setvar"){
            this.vars.delete(nextTok.value);
        } else if(nextTok.type === "word"){
            switch(nextTok.value){
                case "all":
                    this.vars = vars.clone();
                    this.ops = ops.clone();
                    break;
                case "about":
                    if(this.toks[this.index + 1].value === "it"
                    && this.toks[this.index + 1].type === "word"){
                        this.index++;
                        this.output("No, seriously, forget about it!");
                    }
                    break;
                default:
                    error("unknown option `" + nextTok.value + "`");
                    break;
            }
        }
    }],
    ["retest", new StackedFunc([
        [[String, String], (a, b) => new Decimal(+new RegExp(b).test(a))],
    ], 2)],
    ["takewhile", new StackedFunc([
        [[REFORMABLE, STP(FUNC_LIKE)], function(a, b){
            return sanatize(a[REFORM](takeWhile([...a], (...e) => {
                return unsanatize(b.overWith(this, ...sanatize(e)));
            })));
        }]
    ], 2)],
    ["cartprod", new StackedFunc([
        [[REFORMABLE, REFORMABLE], (a, b) =>
            cartProd([...a], [...b]).exhaust().map(e => a[REFORM](e))
        ]
    ], 2)],
    ["multicartprod", new StackedFunc([
        [[Array], (a) =>
            cartProd(...a).exhaust()]
    ], 1)],
    ["surround", new StackedFunc([
        [[String, ANY], surround],
        [[Array, ANY], surround],
    ], 2)],
    ["bytes", new StackedFunc([
        [[String], (s) => sanatize(bytes(s))],
    ], 1)],
    // ["upload", typedFunc([
        // [[]]
    // ])],
    // ["extend", function(){
        // // (typeString typeDecimal) { a b : a tostr b tostr + } '+' extend
        // let name = this.stack.pop();
        // let f = this.stack.pop();
        // let types = this.stack.pop();
        // console.log(name, f+[], types);
        // let a = [name, types, (...a) => f.over(...a), types.length, false];
        // console.log(a);
        // extendTypedLocale(this.ops, ...a);
        // // this.ops.set(name, ops.get("name"));
    // }],
]);

ops.set("cls", isNode
    ? () => cls()
    : () => document.getElementById("stacked-output").innerHTML = "");

// node specific functions
if(isNode){
    ops.set("read", new StackedFunc([
        [[String], (e) => fs.readFileSync(e).toString()]
    ], 1, { vectorize: true }));
    ops.set("exit", () => process.exit());
}

// math functions
let arityOverides = new Map([
    ["max", 2],
    ["min", 2],
]);
["sqrt", "cbrt", "ln", "pow", "mul", "exp",
 "add", "sub", "log", "div", "cos", "sin",
 "tan", "cosh", "sinh", "tanh", "acos", "asin",
 "atan", "acosh", "asinh", "atanh", "sign",
 "atan2", "log2", "log10", "abs", "ceil",
 "floor", "round", "trunc", "max", "min"].map(name => {
    let len = arityOverides.has(name) ? arityOverides.get(name) : Decimal[name].length;
    let k = [...Array(len).keys()]
            .map(e => String.fromCharCode(97 + e));
    ops.set(
        name,
        vectorTyped([
            [k.map(e => Decimal), new Function(
                ...k,
                k.map(e => "assureTyped(" + e + ", Decimal)").join(";") +
                ";\nreturn Decimal(Decimal." + name + "(" + k.join(",") + "))"
            )]
        ], len)
    );
    // ops.set(
        // name,
        // func(new Function(
            // ...k,
            // k.map(e => "assureTyped(" + e + ", Decimal)").join(";") +
            // ";\nreturn Decimal(Decimal." + name + "(" + k.join(",") + "))"
        // ))
    // );
});

const makeAlias = (k, v) => {
    let n = ops.get(k);
    if(!n)
        console.error("no func `" + k + "`");
    if(v.forEach)
        v.forEach(e => ops.set(e, n));
    else
        ops.set(v, n);
}

// aliases
new Map([
    ["oneach", '"'],
    ["dup", ":"],
    ["swap", "\\"],
    ["get", "#"],
    ["insert", "#/"],
    ["betail", "curtail"],
    ["plusminus", ["pm", "±"]],
    ["sqrt", "√"],
    ["filter", "accept"],
    ["neg", "_"],
    ["mod", "%%"],
	["execeach", "#!"],
    ["powerset", ["\u2119", "P"]],
    ["transpose", "tr"],
    ["intersection", "\u2229"],
    ["union", "\u222A"],
    ["has", "\u2208"],
    [">=", "≥"],
    ["<=", "≤"],
    ["not", "¬"],
    ["rep", "×"],
    ["!=", "≠"],
    ["merge", "..."],
    ["ord", "#."],
    ["chr", "#:"],
    ["pair", "#,"],
    // ["prefix", "inits"],
]).forEach((v, k) => {
    makeAlias(k, v);
});

const tokenize = (str, keepWhiteSpace = false) => {
    if(str === "") return [];

    // // this is incredibly slow, but kept here in comments for historical purposes.
    // let toks = str.match(reg);
    
    let opNames = [...ops.keys()]
        // sort by lengths
        .sort((x, y) => y.length - x.length);
    
    let varNames = [...vars.keys()]
        // sort by lengths
        .sort((x, y) => y.length - x.length);
    
    let toks = [];
    // given a word, determines if that word exists at this index
    let i = 0;
    let needle = (word) =>
        str.indexOf(word, i) === i;
    let isDigit = (d) => (/[0-9]/.test(d));
    let isAlphaNumeric = (d) => (/[A-Za-z0-9]/.test(d));
    let isDigitPrefix = (d) => "_.".has(d);
    let cur = () => str[i];
    let peekNext = () => str[i + 1];
    let curAdvance = () => str[i++];
    let next = () => str[++i];
    let advance = (n = 1) => i += n;
    let isStringPrefix = (d) => d === "'";
    let hasCharsLeft = () => i < str.length;
    let isAlpha = (d) => (/[A-Za-z]/.test(d));
    let isIdentifierPrefix = isAlpha;
    let isIdentifier = (d) => isAlphaNumeric(d) || d === "_";
    let commentDepth = 0;
    tokenizeLoop: while(hasCharsLeft()){
        // 0. skip whitespace
        if(/^\s$/.test(cur())){
            if(keepWhiteSpace)
                toks.push(cur());
            advance();
        }
        // 1. tokenize `nil` if available
        else if(needle("nil")){
            advance(3);
            toks.push("nil");
        }
        // 2. tokenize a number, if available.
        // regex: (?:_?\\.?\\d[a-zA-Z0-9.]*)
        else if((isDigitPrefix(cur()) && isDigit(peekNext())) || isDigit(cur())){
            let build = "";
            if(isDigitPrefix(cur())){
                build += curAdvance();
            }
            build += curAdvance();
            while((isAlphaNumeric(cur()) || cur() === ".") && hasCharsLeft()){
                build += curAdvance();
            }
            toks.push(build);
        }
        
        // 3. tokenize a string, if available.
        // 3b. or a char string
        else if(isStringPrefix(cur()) || needle("$'")){
            let build = cur();
            if(cur() === '$'){
                build += next();
            }
            next();
            while(!(cur() === "'" && peekNext() !== "'") && hasCharsLeft()){
                // escape quote
                if(cur() === "'" && peekNext() === "'"){
                    build += "''";
                    advance(2);
                } else {
                    build += cur();
                    advance();
                }
            }
            advance();
            toks.push(build + "'");
        }
        // // 3c. or a data string
        // else if(needle("`")){
            
        // }
        // 4. match a comment start symbol, if available
        // 5. match a function array start, if available (`$(`)
        else if(needle("(*")){
            toks.push(cur() + next());
            advance();
            commentDepth++;
        }
        else if(needle("*)") && commentDepth > 0){
            toks.push(cur() + next());
            advance();
            commentDepth--;
        }
        else if(needle("$(")){
            toks.push(cur() + next());
            advance();
        }
        // 6. match any brace character
        else if("()[]{}".split("").some(needle)){
            toks.push(curAdvance());
        }
        // 7. match:
        // 7a. words          e.g. `foo`
        // 7b. setvars        e.g. `@foo`
        // 7c. setfuncs       e.g. `@:foo`
        else if(needle("@:") || needle("@") || isIdentifierPrefix(cur())){
			let setvarf = needle("@");
            let build = curAdvance();
            if(needle(":") && setvarf) build += curAdvance();
            while(isIdentifier(cur()) && hasCharsLeft()){
                build += curAdvance();
            }
            toks.push(build);
        }
        // 8. quotefuncs     e.g. `$foo` or `$<sym>... `
        else if(needle("$")){
            let build = curAdvance();
			for(let name of opNames){
				if(needle(name)){
					advance(name.length);
					toks.push("$" + name);
					continue tokenizeLoop;
				}
			}
            let condition = isAlpha(cur()) ? isIdentifier : (d) => (!/^\s$/.test(d));
            while(condition(cur()) && hasCharsLeft()){
                build += curAdvance();
            }
            toks.push(build);
        }
        // 9. tokenize an operator, if avaialable
        else {
            for(let name of opNames){
                if(needle(name)){
                    advance(name.length);
                    toks.push(name);
                    continue tokenizeLoop;
                }
            }
            for(let name of varNames){
                if(needle(name)){
                    advance(name.length);
                    toks.push(name);
                    continue tokenizeLoop;
                }
            }
            // 10. match a blank
            if(needle(".")){
                toks.push(cur());
                advance();
            } else {
                // 11. make sure these error
                toks.push(new Token(cur()));
                advance();
            }
        }
    }
    
    // preprocess comments
    let commentInds = toks.map(e => false);
    // let max = 100;
    // for(let i = 0, t = 0; i < toks.length && t < max; i++, t++){
    for(let i = 0; i < toks.length; i++){
        if(toks[i] === "(*"){
            let depth = 1;
            i++;
            while(depth && i < toks.length){
                let cur = toks[i];
                if(cur === "(*") depth++;
                else if(cur === "*)") depth--;
                else commentInds[i] = true;
                i++;
            }
            i--;
            if(depth)
                warn("unclosed comment");
        }
    }
    
    return toks.map((e, i) => new Token(e, commentInds[i]));
};

const parseNum = function(str){
    str = str.replace(/\s/g, "");
    if(str.has("i")){
        if(str.endsWith("i")){
            return new Complex(Decimal(0), parseNum(str.slice(0, -1)));
        }
        let parts = str.split("i").map(parseNum);
        return new Complex(...parts);
    }
    str = str.replace(/(.+)n$/, "-$1").replace(/^_/, "-");
    try {
        return new Decimal(str);
    } catch(e){
        error("invalid number `" + str + "`");
    }
}

const vars = new Map([
	["LF",         "\n"],
	["CR",         "\r"],
	["CRLF",       "\r\n"],
	["PI",         Decimal.PI],
	["TAU",        Decimal.PI.mul(2)],
	["PAU",        Decimal.PI.mul(1.5)],
	["E",          Decimal(1).exp()],
	["alpha",      "abcdefghijklmnopqrstuvwxyz"],
	["ALPHA",      "ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    ["vowels",     "aeiouy"],
    ["VOWELS",     "AEIOUY"],
    ["consonants", "bcdfghjklmnpqrstvwxz"],
    ["CONSONANTS", "BCDFGHJKLMNPQRSTVWXZ"],
    ["qwerty",     ["qwertyuiop", "asdfghjkl", "zxcvbnm"]],
    ["QWERTY",     ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]],
    ["EPA",        []],
    ["EPS",        ""]
]);

vars.set("π",      vars.get("PI"));
vars.set("τ",      vars.get("TAU"));
vars.set("\u2205", vars.get("EPA"));
vars.set("ε",      vars.get("EPS"));

class Stacked {
    constructor(code, opts = {}){
        this.raw = code;
        this.ops = opts.ops || ops.clone();
        this.toks = tokenize(code) || [];
        this.index = 0;
        this.stack = [];
        // todo: fix popping from an empty stack
        this.slow = opts.slow || false;
        if(this.slow)
            warn("slow mode is buggy.");
        this.reg = new Decimal(0);
        this.vars = opts.vars || vars;
        
        // environment variables
        this.vars.set("program", this.raw);
        if(isNode)
            this.vars.set("argv", process.argv);
        
        this.running = true;
        this.output = opts.output;
        if(!this.output) this.output = !isNode ?
            document.getElementById("stacked-output") ?
                e => document.getElementById("stacked-output").appendChild(
                    document.createTextNode(pp(e || ""))    //todo: is this necessary?
                )
                : e => alert(e)
            : e => process.stdout.write(pp(e));
        // todo: this.error
    }
    
    inherit(instance){
        this.ops = instance.ops;
        this.vars = instance.vars;
        this.output = instance.output;
        // idk anymore ;_;
    }
    
    execOp(opname){
        if(opname instanceof StackedFunc){
            opname.exec(this);
        } else {
            opname.bind(this)();
        }
    }
    
    uneval(ent){
        // todo
    }
    
    step(){
        if(this.index >= this.toks.length || !this.running)
            return this.running = false;
        
        let cur = this.toks[this.index];
        if(["comment", "commentStart", "commentEnd"].indexOf(cur.type) >= 0){
            // do nothing, it's a comment.
        } else if(cur.type === "accessor"){
            this.index++;
            let ref = this.toks[this.index].raw;
            let e = this.stack.pop();
            // todo: make proper stack
            let pt = e[ref];
            if(!isDefined(pt) || pt.constructor === Function){
                // todo: perhaps make this a sort of currying?
                // or it's too unpredicatable
                error("`" + repr(e) + "` has no property `" + ref + "`");
            }
            this.stack.push(e[ref]);
        } else if(cur.type === "quoteFunc"){
            let k = new Func(cur.value);
            k.toString = function(){ return cur.raw; }
            k.exec = function(inst){
                let toExec = inst.ops.get(cur.value);
                inst.execOp(toExec);
            }
            this.stack.push(k);
        } else if(["number", "string", "nil", "charString"].includes(cur.type)){
            this.stack.push(cur.value);
        } else if(cur.type === "setvar"){
            if(this.ops.has(cur.value)){
                error("reserved identifier `" + cur.value + "`");
            }
            if(!this.stack.length)
                error("popping from an empty stack");
            this.vars.set(cur.value, this.stack.pop());
        } else if(cur.type === "setfunc"){
            if(!this.stack.length)
                error("popping from an empty stack");
            else if(ops.has(cur.value)){
                error("reserved identifier `" + cur.value + "`");
            }
            let next = this.stack.pop();
            if(!FUNC_LIKE(next)){
                error("invalid function-like `" + next.toString() + "`");
            }
            this.ops.set(cur.value, function(){
                next.exec(this);
            });
        } else if(cur.type === "op"){
            // execute command
            this.execOp(cur.func);
        } else if(this.ops.has(cur.value || cur.raw)/* && cur.type === "word"*/){
            this.ops.get(cur.value || cur.raw).bind(this)();
        } else if(cur.type === "funcStart"){
            let depth = 1;
            let build = [];
            this.index++;
            while(depth && this.index < this.toks.length){
                let cur = this.toks[this.index];
                if(cur.type === "funcStart") depth++;
                if(cur.type === "funcEnd") depth--;
                build += cur.raw + " ";
                this.index++;
            }
            this.index--;
            build = build.slice(0, -2); // remove trailing " ]"
            this.stack.push(new Func(build));
        } else if(cur.type === "funcArrayStart"){
            let arr = [];
            this.index++;
            while(this.index < this.toks.length){
                let cur = this.toks[this.index];
                if(cur.type === "arrayEnd")
                    break;
                if(cur.type === "op" || cur.type == "word"){
                    arr.push(new Func(cur.raw));
                } else {
                    error("`" + cur.raw + "` is not a function.");
                }
                this.index++;
            }
            arr.exec = function(inst){
                arr.forEach(e => e.exec(inst));
            }
            this.stack.push(arr);
        } else if(cur.type === "arrayStart"){
            let build = "";
            let depth = 1;
            this.index++;
            while(depth && this.index < this.toks.length){
                let cur = this.toks[this.index];
                if(cur.type === "arrayStart") depth++;
                if(cur.type === "arrayEnd") depth--;
                build += cur.raw + " ";
                this.index++;
            }
            this.index--;
            build = build.slice(0, -2); // remove trailing " )"
            // execute it
            let inst = new Stacked(build);
            inst.inherit(this);
            inst.run(this);
            this.stack.push(inst.stack);
        } else if(cur.type === "lambdaStart"){
            let args = [];
            this.index++;
            if(this.toks[this.index].raw == "!"){
                args.push("n");
            } else {
                // look for args
                while(this.toks[this.index].raw !== ":"){
                    let cur = this.toks[this.index];
                    if(cur.type === "word"){
                        args.push(cur.raw);
                    } else if(cur.raw === "."){
                        args.push("");
                    }
                    this.index++;
                    if(!isDefined(this.toks[this.index])){
                        error("unexpected end in lambda while looking for `:`");
                    }
                }
            }
            this.index++;    // skip over `:` or `.`
            // parse body
            let build = "";
            let depth = 1;
            while(depth && this.index < this.toks.length){
                let cur = this.toks[this.index];
                if(cur.type === "lambdaStart") depth++;
                if(cur.type === "lambdaEnd") depth--;
                build += cur.raw + " ";
                this.index++;
            }
            this.index--;
            build = build.slice(0, -2); // remove trailing " }"
            this.stack.push(new Lambda(args, build));
        } else if(cur.type === "word"){
            if(this.vars.has(cur.raw)){
                this.stack.push(this.vars.get(cur.raw));
            } else {
                error("undefined variable `" + cur.raw + "`");
            }
        } else {
            error("Invalid character `" + cur.raw + "` (token type `" + cur.type + "`)");
        }
        this.index++;
    }
    
    run(){
        if(this.slow){
            this.step();
            if(this.running)
                setTimeout(Stacked.prototype.run.bind(this), DELAY);
            return;
        }
        while(this.running){
            this.step();
        }
        return this.stack.filter(e => typeof e !== "undefined")
                    .map(e => e[e.toFixed ? "toFixed" : "toString"]());
    }
}

const stacked = (...args) => {
    Decimal.set({ precision: DECIMAL_DEFAULT_PRECISION });
    let inst = new Stacked(...args);
    inst.run();
    return inst;
}

stacked.Stacked = Stacked;

// code to be executed before program start
// looks for all vars not in the default scope
const bootstrap = (code) => {
    let inst = stacked(code);
    // find that func
    for(let [key] of inst.ops){
        if(!ops.has(key)){
            let func = inst.ops.get(key);
            ops.set(key, func);
        }
    }
}
bootstrap(`
{ init arr func :
  arr toarr @arr
  init arr, func doinsert
} @:fold
[sgroup tail merge] @:isolate
[: *] @:square
[map flat] @:flatmap
(* Until I fix scoping *)
(* { f : { n : n f! n = } bind } @:invariant *)
[0 >] @:ispos
[0 <] @:isneg
[0 eq] @:iszero
{ x : x } @:id
[: floor -] @:fpart
[: fpart -] @:ipart
$(fpart , ipart) fork @:fipart
$(ipart , fpart) fork @:ifpart
[2 tobase] @:bits
[2 antibase] @:unbits
[10 tobase] @:digits
[10 antibase] @:undigits
[$rev map] @:reveach
{ f :
  [, $bits map reveach fixshape reveach
    tr
  ] f compose
  [clmn
    flat
    unbits
  ] compose
} @:bitwise
['txt' download] @:savetxt
$and bitwise @:band
$or  bitwise @:bor
$xor bitwise @:bxor
[2 /] @:halve
[2 *] @:double
[1 +] @:inc
[1 -] @:dec
{ e f : e [f apply] map } @:clmn
[0 get] @:first
[_1 get] @:last
[2 mod 1 eq] @:odd
[2 mod 0 eq] @:even
{ x : 1 0 x ifelse } @:truthy
[truthy not] @:falsey
$max #/ @:MAX
$min #/ @:MIN
$* #/ @:prod
$+ #/ @:sum
$and #/ @:all
$or #/ @:any
$not $any ++ @:none
[95 baserep] @:compnum
[95 antibaserep] @:decompnum
$(+ + -) { x . : x sign } agenda @:increase
$(- - +) { x . : x sign } agenda @:decrease
{ a b :
  [b 0 !=] [
    b @t
    a b mod @b
    t @a
  ] while
  a isolate
} oneach @:gcd
{ a b :
  a b * abs @num
  a b gcd @den
  num den /
} oneach @:lcm
{ a f : a [merge f!] map } @:with

{ arr mask :
  arr { . i : mask i get } accept
} @:keep

{ a f :
  a   a f map keep
} @:fkeep

(
  [1 <=] [()]               (* return empty array for n <= 1*)
  [3 <=] { n : (n) }        (* 2 and 3 are prime, so return them *)
  (* otherwise, we can apply the general divisor alogirthm *)
  { n :
    1 n |> @divs
    divs divs n | keep
  }
) cases oneach @:divisors

{ a : a size 0 = } @:empty

(* [lower ptable keys'|'join lower''repl empty] *)

{ ent :
  ent size rand @ind
  ent ind get
} @:randin

{ arr i j : arr [i j nswap] apply } @:exch

{ arr :
  arr size @n
  { i :
    i n .. randin @j
    arr i j exch @arr
  } 0 n 2- for
  arr isolate
} @:shuf

{ ent : hold ent put release } @:tostr

{ arr e :
  arr e index @ind
  [ arr ]
  [ arr ind _rot ]
  ind _1 = ifelse
} @:mount

{ a : a perm [a eq none] accept } @:derangements

{ f :
  f tostr @str
  'Operation %0 took %1 seconds' (str  f timeop) format out
} @:time

{ ent :
  ent { el . build : el build first = } chunkby
  { run :
    run first @k
    (k   run size)
  } map KeyArray
} @:rle

[rle toarr $rev map flat] @:flatrle

[2 chunk [rev $rep apply] map flat] @:flatrld

[toarr $rev map flat flatrld] @:rld

[Conway '' CellularAutomata] @:conway

{ c : c repr out [cls c step repr out] 1 animation } @:cellani

[#/ !] @:doinsert
`);

makeAlias("prod", "\u220f");
makeAlias("square", "²");
makeAlias("iszero", "is0");
makeAlias("doinsert", "#\\");

// ---stealing--- adapting some of Haskell's Data.List stuff
bootstrap(`
{ list el : list [el pair] map $++ #\\ betail } @:intersperse
[intersperse flat] @:intercalate
`);

vars.set("typeDecimal", Decimal);
Decimal.toString = function(){ return "[type Decimal]"; }
vars.set("typeString", String);
String.toString = function(){ return "[type String]"; }
vars.set("typeFunc", Func);
Func.toString = function(){ return "[type Func]"; }
vars.set("typeLabmda", Lambda);
Lambda.toString = function(){ return "[type Lambda]"; }
vars.set("typeArray", Array);
Array.toString = function(){ return "[type Array]"; }

// extends a current operation for typed-ness
const extendTypedLocale = (locale, opName, newTypeArr, resultFunc, arity = -1, vectorized = true) => {
    let pfunc = locale.get(opName);
    if(pfunc instanceof StackedFunc){
        pfunc.typeMap.push([newTypeArr, resultFunc]);
    } else {
        locale.set(opName, (vectorized ? vectorTyped : typedFunc)([
            [newTypeArr, resultFunc],
            [newTypeArr.map(() => ANY), function(...args){
                this.stack = this.stack.concat(args);
                pfunc.bind(this)();
            }],
        ], arity));
    }
}
const extendTyped = (...a) => {
    extendTypedLocale(ops, ...a);
}

const sanatize = (ent) => {
    if(typeof ent === "number") return new Decimal(ent);
    if(typeof ent === "boolean") return new Decimal(+ent);
    if(ent instanceof Array) return ent.map(sanatize);
    return ent;
}

const unsanatize = (ent) => {
    if(ent instanceof Decimal)
        return +ent;
    else if(ent instanceof Array)
        return ent.map(unsanatize);
    else if(ent instanceof Func || ent instanceof Lambda)
        return (...a) => ent.over(...a.map(sanatize));
    else
        return ent;
}

// integrates a class into stacked
const integrate = (klass, opts = {}) => {
    opts.merge = opts.merge || false;
    opts.ignore = opts.ignore || [];
    opts.methods = opts.methods || [];
    opts.vectors = opts.vectors || [];
    opts.ignore = opts.ignore.concat(["map", "filter", "keys", "values", "forEach", "repr"]);
    opts.sanatize = opts.sanatize || false;
	let props = Object.getOwnPropertyNames(klass.prototype);
	ops.set(klass.name, function(){
		let args = this.stack.splice(-klass.length);
		this.stack.push(new klass(...args));
	});
    let kname = klass.name;
    vars.set("type" + kname, klass);
    klass.toString = function(){ return "[type " + kname + "]"; }
	let kdispname = kname;
	for(let nme of opts.methods){
		// so that scoping of `nme` persists
		let prop = nme;
		let dprop = prop;
		if(["constructor", "toString"].indexOf(prop) >= 0
            || opts.ignore.indexOf(prop) >= 0
            || prop.constructor === Symbol) continue;
		if(ops.has(prop)){
			// todo: overload
			warn("name conflict under `" + dprop + "` of `" + kname + "`; renaming to `" + kdispname + dprop + "`");
			dprop = kdispname + dprop; 
		}
		ops.set(dprop, typedFunc([
			[[klass], (k) => k[prop]]
		], 1));
	}
	for(let nme of props){
		// so that scoping of `nme` persists
		let prop = nme;
		let dprop = prop;
		if(["constructor", "toString", "length"].indexOf(prop) >= 0
            || opts.ignore.indexOf(prop) >= 0) continue;
        let arity = klass.prototype[prop].length;
        let body = function(){
            let instance = this.stack.pop();
            assureTyped(instance, klass);
            let args = this.stack.splice(-arity);
            if(opts.sanatize) args = args.map(unsanatize);
            this.stack.push(sanatize(instance[prop](...args)));
        };
		if(ops.has(prop) && !opts.merge){
            warn("name conflict under `" + dprop + "` of `" + kname + "`; renaming to `" + kdispname + dprop + "`");
            dprop = kdispname + dprop;
            ops.set(dprop, body);
		} else if(ops.has(prop) && opts.merge){
            // construct type
            let types = [...Array(arity)];
            types.fill(ANY);
            types.push(klass);
            // if(opts.vectors.length) console.log(opts.vectors, prop, opts.vectors.has(prop));
            permute(types).forEach(typeArr => {
                extendTyped(prop, typeArr, (...a) => {
                    let inst = a.find(e => e instanceof klass);
                    if(!inst){
                        error("no instance of `" + kname + "` found in arguments (`" + prop + "`)")
                    }
                    a.splice(a.indexOf(inst), 1);
                    if(opts.sanatize) a = a.map(unsanatize);
                    return sanatize(inst[prop](...a));
                }, arity + 1, opts.vectors.has(prop)); 
            });
        } else {
            ops.set(dprop, body);
        }
	}
	let staticProps = Object.getOwnPropertyNames(klass);
	for(let nme of staticProps){
		let staticProp = nme;
		if(["name", "length", "prototype", "toString", ...opts.ignore]
            .indexOf(staticProp) >= 0) continue;
		let dstaticProp = staticProp;
		if(ops.has(staticProp)){
			// todo: overload
			warn("name conflict under static `" + dstaticProp + "` of `" + kname + "`; renaming to `" + kdispname + dstaticProp + "`");
			dstaticProp = kdispname + dstaticProp; 
		}
        if(klass[staticProp] instanceof Function){
            ops.set(dstaticProp, function(){
                let ar = -klass[staticProp].length;
                let args = ar ? this.stack.splice(ar) : [];
                if(opts.sanatize) args = args.map(unsanatize);
                this.stack.push(sanatize(klass[staticProp](...args)));
            });
        } else {
            vars.set(staticProp, klass[staticProp]);
        }
	}
}

integrate(Element, { merge: false, methods: ["atomic", "sym", "name", "weight"] });

Element.ptable.forEach((v, k) => {
	vars.set("E" + k, v);
});

// color
Color.prototype["-"] = Color.prototype.sub;
Color.prototype["="] = Color.prototype.equal;
integrate(Color, { merge: true });

const aliasPrototype = (klass, alias, name) => {
    klass.prototype[alias] = klass.prototype[name];
}

// char string
class CharString {
    constructor(a){
        this.members = [...a];
        // todo: shape
    }
    
    *[Symbol.iterator](){
        for(let k of this.members){
            yield k;
        }
    }
    
    map(f){
        return new CharString([...this].map(f));
    }
    
    get length(){
        return this.members.length;
    }
    
    add(c){
        // return this.concat(c);
        assureTyped(c, CharString);
        return new CharString([...this, ...c]);
    }
    
    concat(c){
        let resArr = [...this];
        if(c[Symbol.iterator]){
            for(let k of c)
                resArr.push(k);
        } else
            resArr.push(c);
        return new CharString(resArr);
    }
    
    get(ind){
        return this.members[ind];
    }
    
    set(ind, v){
        return this.members[ind] = v;
    }
    
    clone(){
        return new CharString(this);
    }
    
    exch(i, j){
        let c = this.clone();
        [c.members[i], c.members[j]] = [c.members[j], c.members[i]];
        return c;
    }
    
    perm(){
        return permute([...this]).map(e => new CharString(e));
    }
    
    eq(c){
        assureTyped(c, CharString);
        if(c.length !== this.length){
            error("dimension error");
        }
        return [...this].map((e, i) => e == c.get(i));
    }
    
    repr(){
        return "$'" + pp(this.members).replace(/'/g, "''") + "'";
    }
    
    toString(){
        return pp(this.members);
    }
}

CharString.prototype[VECTORABLE] = true;

aliasPrototype(CharString, "+", "add");

integrate(CharString, { merge: true });

makeAlias("CharString", "CS");

class KeyArray {
    constructor(arr){
        this.kmap = arr;
    }
    
    *[Symbol.iterator](){
        for(let [k, v] of this.kmap){
            yield [k, v];
        }
    }
    
    forEach(f){
        for(let [k, v] of this.kmap){
            f(k, v, this);
        }
    }
    
    map(f){
        let arr = [];
        for(let [k, v] of this.kmap){
            arr.push([k, f(k, v)]);
        }
        return new KeyArray(arr);
    }
    
    filter(f){
        let arr = [];
        for(let [k, v] of this.kmap){
            if(f(k, v))
                arr.push([k, v]);
        }
        return new KeyArray(arr);
    }
    
    // todo: make key array not read-only
    
    get(nk){
        for(let [k, v] of this.kmap){
            if(equal(k, nk)) return v;
        }
        return new Nil;
    }
    
    *keys(){
        for(let [k, _] of this.kmap){
            yield k;
        }
    }
    
    *values(){
        for(let [_, v] of this.kmap){
            yield v;
        }
    }
    
    toString(){
        let str = "KeyArray [ ";
        let body = "";
        this.forEach((k, v) => {
            body += `${k} => ${v}, `;
        });
        str += body.slice(0, -2);
        str += " ]";
        return str;
    }
}

// allow the default `map`, `filter`, etc. to be used
integrate(KeyArray, { merge: true });

aliasPrototype(Complex, "+", "add");
aliasPrototype(Complex, "-", "sub");
integrate(Complex, { merge: true, methods: ["re", "im"], vectors: ["add", "-", "sub", "+"] });

integrate(AutomataRule, { merge: true });
integrate(CellularAutomata, { merge: true, ignore: ["AutomataRule"] });

integrate(Table, { sanatize: true });

integrate(Icon, { sanatize: true, ignore: ["writeToCanvas"] });

if(isNode){
    module.exports = exports.default = stacked;
}