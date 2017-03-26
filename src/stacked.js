var isNode = false;
var DEBUG = false;
if(typeof require !== "undefined"){
    isNode = true;
    fs = require("fs");
    utf8 = require("./utf8.js");
    Decimal = require("./decimal.js");
    path = require("path");
    winpath = path.win32;
    Color = require("./color.js");
    Icon = require("./icon.js");
    Table = require("./table.js");
    Element = require("./element.js");
    http = require("http");
    produceOps = require("./stdlib.js");
    require("./turtle.js");
    let toMerge = require("./funcs.js");
    for(let k of Object.getOwnPropertyNames(toMerge)){
        if(k !== "highlight")
            global[k] = toMerge[k];
    }

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
        "standard": 39,
        "bgblack": 40,
        "bgred": 41,
        "bggreen": 42,
        "bgyellow": 43,
        "bgblue": 44,
        "bgpurple": 45,
        "bgcyan": 46,
        "bgwhite": 47,
    };
    const colorize = (color, ...others) => (str) =>
        (
            others.length ? colorize(...others) : (x => x)
        )(ESCAPE + "[" + colors[color] + "m" + str + ESCAPE + "[0m");
    const styles = {
        "string": colorize("purple"),
        "charString": colorize("purple", "bold"),
        "number": colorize("yellow"),
        "setfunc": colorize("green"),
        "setvar": colorize("green"),
        "quoteFunc": colorize("bold", "green"),
        "op": colorize("bold"),
    };
    styles["lambdaStart"] = styles["lambdaEnd"] =
    styles["funcStart"] = styles["funcEnd"] = colorize("cyan");
    const getStyle = (e) => styles[e.type] ? styles[e.type](e.raw) : e.raw;
    const highlight = (prog) =>
        stacked.tokenize(prog, { keepWhiteSpace: true, ignoreError: true })
            .map(getStyle).join("");
    toMerge.highlight = global.highlight = highlight;
    Complex = require("./complex.js");
    CellularAutomata = require("./automata.js");
    AutomataRule = CellularAutomata.AutomataRule;
    // require("./stacked.js");
    
    // waiting for that glorious synchronous stdin!
    // rip, it requires VS. Haha, not getting that.
    // prompt = require("syncprompt");
    
    readLineSync = require("readline-sync");
    prompt = (message = "") => readLineSync.question(message);
}

Timeout = typeof Timeout === "undefined" ? (class X {}) : Timeout;

const errorColor = isNode ? (x) => `\x1b[31m${x}\x1b[0m` : (x) => x;

const DELAY = 200;

silentError = false;
error = (err) => {
    if(!silentError){
        try {
            new Stacked("").output("error: " + err);
        } catch(e){
            throw new Error(err);
        }
        throw new Error("haha have fun");
    } else
        throw new Error("error: " + err);
};

if(isNode){
    error = (e) => {
        let hasStacked = false;
        try { stacked; hasStacked = true } catch(e) {}
        if(hasStacked && stacked.silentError)
            throw new Error(e);
        else {
            console.error("error: " +e);
            process.exit(1);
        }
    }
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
    constructor(f, name){
        this.f = f;
        this.name = name;
    }
    
    match(arg){
        return this.f(arg);
    }
}

const FUNC_LIKE = (e) => e instanceof Lambda || e instanceof Func;
const STP = (...args) => new StackedPseudoType(...args);
const STP_HAS = (prop) => STP(e => isDefined(e[prop]), "{has#" + prop.toString() + "}");
const ANY = STP(() => true, "{Any}");
const ITERABLE = STP((e) => isDefined(e[Symbol.iterator]), "{Iterable}");
const REFORMABLE = STP_HAS(REFORM);
const INTEGER = STP(e => StackedFunc.ofUnaryType(Decimal)(e) && e.floor().eq(e), "{Integer}");
const STP_FUNC_LIKE = STP(FUNC_LIKE, "{Func-like}");
const STP_EXECABLE = STP((e) => isDefined(e.exec), "{Executable}");

// todo: integrate this into everything; throw warnings for all things that don't
class StackedFunc {
    constructor(typeMap, arity = -1, options = {}){
        if(arity < 0)
            error("invalid arity `" + arity + "`");
        
        this.options = options;
        
        this.modify = defined(this.options.modify, true);
        
        this.options.typeMap = clone(typeMap);
        this.displayName = options.displayName = options.name || options.displayName;
        
        this.options.result = defined(this.options.result, true);
        
        if(this.options.untyped)
            this.typeMap = [
                [[ANY, ANY], typeMap],
            ];
        else
            this.typeMap = typeMap;
        
        this.options.untyped = false;
        
        this.arity = arity;
    }
    
    clone(){
        return new StackedFunc(this.typeMap, this.arity, this.options);
    }
    
    findMatch(...args){
        redo: for(let typePair of this.typeMap){
            let [key, func] = typePair;
            let i = 0;
            for(let type of key){
                let matched = true;
                if(type instanceof StackedPseudoType)
                    matched = type.match(args[i]);
                else
                    matched = args[i] instanceof type || args[i].constructor === type;
                
                if(!matched)
                    continue redo;
                
                i++;
            }
            return func;
        }
        return StackedFunc.NO_MATCH;
    }
    
    match(...args){
        let fm = this.findMatch(...args);
        let tpname = (e) => isDefined(e) ? typeName(e) : "undefined";
        if(fm === StackedFunc.NO_MATCH){
            let typeMapStr =
                this.typeMap
                    .map(e => e[0].map(tpname).join(", "))
                    .join("\n")
                    .replace(/^/gm, " - ");
            error(
                (this.displayName ? "(in `" + this.displayName + "`) " : "") +
                "no matching types for " +
                args.map(e => tpname(e.constructor))
                    .join(", ") + "; " +
                "expected one of:\n" + typeMapStr + "\n(got arguments: " +
                    args.map(disp).join(" ") + ")"
            );
        }
        // console.log(fm);
        let k = fm.bind(this.dest)(...args);
        return k;
    }
    
    exec(dest){
        // get arguments
        let args;
        if(this.arity)
            if(dest.stack.length < this.arity)
                error(
                    (this.displayName ? "(in `" + this.displayName + "`) " : "") +
                    "popping from an empty stack"
                );
            else
                args = dest.stack[this.modify ? "splice" : "slice"](-this.arity);
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
    
    static constant(v){
        return StackedFunc.zero(() => v);
    }
    
    static zero(f){
        return new StackedFunc([
            [[], () => f()],
        ], 0);
    }
    
    static match(types, ...args){
        return StackedFunc.NO_MATCH !== (new StackedFunc([[types, () => {}]], 1).findMatch(...args));
    }
    
    static ofUnaryType(type){
        return (n) => StackedFunc.match([type], n);
    }
}

StackedFunc.NO_MATCH = Symbol("NO_MATCH");

function func(f, merge = false, refs = [], arity = f.length){
    // warn("func is deprecated.");
    // this works for retaining the `this` instance.
    return function(){
        let args = arity ? this.stack.splice(-arity) : [];
        if(args.length !== arity){
            error("popping from an empty stackX");
        }
        if(args.some(e => typeof e === "undefined"))
            error("popping from empty stackQ");
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

// function typedFunc(typeMap, arity = -1){
    // if(arity < 0) throw new Error("bad arity");
    // return func(
        // typed(new Map(typeMap)),
        // false,
        // [],
        // arity
    // );
// }

class Token {
    constructor(str, isComment){
        this.raw = str;
        this.isComment = isComment;
        if(str instanceof Token){
            this.raw = str = str.raw;
            this.isComment = str.isComment;
        }
        // todo: not cycle through all options for copying, maybe?
        if(isComment){
            this.type = "comment";
        }
        
        else if(Array.isArray(str)){
            this.type = "op";
            this.func = str[0];
        }
        // let's identify what type of token this is
        else if(str == "."){
            this.type = "accessor";
        }
        
        else if(str == "(:"){
            this.type = "mapStart";
        }
        
        else if(/^\s$/.test(str)){
            this.type = "whitespace";
        }
        
        else if(str === "nil"){
            this.type = "nil";
            this.value = new Nil;
        }
        
        else if(str.match(/^[_.]?\d[\d.A-Za-z]*$/)){
            this.type = "number";
            this.value = parseNum(str);
        }
        
        else if(ops.has(str)){
            this.type = "op";
            this.name = str;
            this.func = ops.get(str);
        }
        
        else if(str[0] === "'"){
            this.value = str.slice(1, -1).replace(/''/g, "'");
            this.type = "string";
        }
        
        else if(str === "@."){
            this.type = "popstack";
        }
        
        else if(str[0] === "@"){
            this.value = str.slice(1);
            this.type = "setvar";
            if(str[1] === ":"){
                this.value = this.value.slice(1);
                this.type = "setfunc";
            } else if(str[1] === "("){
                this.type = "setdestruct";
            }
        }
        
        else if(str.match(/^[A-Za-z_]/) || vars.has(str)){
            this.value = str;
            this.type = "word";
        }
        
        else if(str === "["){
            this.type = "funcStart";
        }
        
        else if(str === "]"){
            this.type = "funcEnd";
        }
        
        else if(str === "("){
            this.type = "arrayStart";
        }
        
        else if(str === "$("){
            this.type = "funcArrayStart";
        }
        
        else if(str === "#("){
            this.type = "groupStart";
        }
        
        else if(str.slice(0, 2) === "$'"){
            this.type = "charString";
            this.value = new CharString(str.slice(2, -1).replace(/''/g, "'"));
        }
        
        else if(str[0] === "$"){
            this.type = "quoteFunc";
            this.value = str.slice(1);
        }
        
        else if(str === ")"){
            this.type = "arrayEnd";
        }
        
        else if(str === "{"){
            this.type = "lambdaStart";
        }
        
        else if(str === "}"){
            this.type = "lambdaEnd";
        }
        
        else {
            this.type = "unknown";
        }
    }
    
    static disp(tok){
        return tok.raw;
    }
    
    // given a Func, yields an op that performs that func
    static from(func){
        let k = new Token("");
        k.raw = repr(func);
        k.type = "op";
        if(func instanceof Func)
            k.func = function(){ func.exec(this); }
        else if(func instanceof Lambda)
            k.func = function(){ func.exec(this); }
        else
            error("bad type to Token.from");
        return k;
    }
    
    toString(){
        return "{" + this.type + ":" + (this.value || this.name || this.raw || "") + "}";
    }
}

class Func {
    constructor(body, options = {}){
        this.body = body;
        this.arity = defined(body.arity, null);
        this.options = options;
        this.modify = defined(options.modify, true);
        this.scope = null;
    }
    
    clone(){
        let newf = new Func(this.body, this.options);
        newf.exec = clone(this.exec);
        newf.toString = clone(this.toString);
        newf.scope = clone(this.scope);
        newf.modify = this.modify;
        newf.arity = this.arity;
        newf.displayName = this.displayName;
        return newf;
    }
    
    static of(func, toStr){
        let k = new Func("");
        if(isDefined(toStr)){
            if(typeof toStr === "function")
                k.toString = toStr;
            else
                k.body = toStr;
        }
        k.exec = func;
        return k;
    }
    
    over(...args){
        let t = new Stacked("");
        t.stack = args;
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    singleOverWith(inst, ...args){
        if(!(inst instanceof Stacked))
            throw new Error(inst, " is not a Stacked instance.");
        let t = new Stacked("", inst.options);
        t.vars = inst.vars;
        t.ops = inst.ops;
        t.stack = [args[0]];
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    overWith(inst, ...args){
        if(!(inst instanceof Stacked))
            throw new Error(inst, " is not a Stacked instance.");
        let t = new Stacked("", inst.options);
        t.vars = inst.vars;
        t.ops = inst.ops;
        t.stack = isDefined(this.arity) && this.arity !== null ? args.slice(0, this.arity) : args;
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    sanatized(inst, ...args){
        args = args.map(sanatize);
        let k = this.overWith(inst, ...args);
        return unsanatize(k);
    }
    
    // degree of scoping:
    // 0 - none         (nothing touched)
    // 1 - intelligent  (everything updated)
    // 2 - obnoxious    (everything integrated)
    closeScope(inst, temp, scoping = 1){
        // let's do some scoping. only update variables,
        // do not merge variables made inside the func
        
        // #### scoping
        // idea: make argument scoping different
        // nevermind, just have degrees of scoping
        if(scoping === 1){
            for(let [key, val] of inst.vars){
                if(temp.vars.has(key) && key !== "program"){
                    inst.vars.set(key, temp.vars.get(key));
                }
            }
        } else if(scoping === 2){
            inst.vars = clone(temp.vars);
        } else if(scoping === 0){
            return;
        } else {
            error("invalid scoping degree `" + scoping + "`");
        }
    }
    
    exec(inst, scoping = 1){
        let temp = new Stacked(this.body, inst.options);
        temp.stack = clone(inst.stack);
        temp.reg = inst.reg;
        temp.ops = clone(inst.ops);
        temp.output = inst.output;
        temp.heldString = inst.heldString;
        temp.hold = inst.hold;
        temp.oldOut = inst.oldOut;
        temp.slow = inst.slow;
        temp.vars = clone(this.scope || inst.vars);
        
        temp.run();
        
        // fix each func
        temp.stack = temp.stack.map(e => {
            if(e instanceof Func || e instanceof Lambda)
                e.scope = clone(temp.vars);
            return e;
        });
        
        inst.stack = (this.modify ? [] : inst.stack).concat(temp.stack);
        inst.output = temp.output;
        inst.heldString = temp.heldString;
        inst.hold = temp.hold;
        inst.oldOut = temp.oldOut;
        if(temp.running === null)
            inst.running = false;
        
        this.closeScope(inst, temp, scoping);
    }
    
    [EQUAL](y){
        return this.body === y.body;
    }
    
    toString(){
        return "[" + defined(this.display, this.body, "<not displayable>").toString().trim() + "]";
    }
}

class LambdaArgument {
    constructor(name){
        this.name = name;
    }
    
    toString(){
        return this.name;
    }
    
    [EQUAL](y){
        return this.toString() === y.toString();
    }
}

class Lambda {
    constructor(args, body, options = {}){
        this.options = options;
        this.modify = defined(options.modify, true);
        this.args = args//.map(e => new LambdaArgument(e));
        this.body = body;
        this.scope = null;
    }
    
    clone(){
        // return new Lambda(this.args.map(e => e.name), this.body, this.options);
        return new Lambda(this.args, this.body, this.options);
    }
    
    get arity(){
        return this.args.length;
    }
    
    // non-settable property
    set arity(v){
        return this.arity;
    }
    
    singleOverWith(inst, ...args){
        if(!(inst instanceof Stacked))
            throw new Error(inst, " is not a Stacked instance.");
        let t = new Stacked("", inst.options);
        t.vars = inst.vars;
        t.ops = inst.ops;
        t.stack = [args[0]];
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    over(...args){
        let t = new Stacked("");
        t.stack = args.slice(0, this.args.length);
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    exec(inst, scoping = 1){
        let temp = new Stacked(this.body, inst.options);
        // console.log(inst);
        temp.ops = clone(inst.ops);
        temp.reg = inst.reg;
        temp.output = inst.output;
        temp.heldString = inst.heldString;
        temp.hold = inst.hold;
        temp.oldOut = inst.oldOut;
        temp.slow = inst.slow;
        temp.vars = clone(this.scope || inst.vars);
        
        // add the arguments
        let stackArguments
        if(this.args.length === 0)
            stackArguments = [];
        else
            if(inst.stack.length < this.args.length)
                error("insufficient arguments passed to `" + (this.displayName || this.name || this.toString()) + "`");
            else
                stackArguments = inst.stack[this.modify ? "splice" : "slice"](-this.args.length);
        for(let i = 0; i < this.args.length; i++){
            let arg = this.args[i];
            // problem with variable retrieval
            temp.vars.delete(arg.toString());
            temp.vars.set(arg, stackArguments.shift());
        }
        
        temp.run();
        
        // fix each func
        temp.stack = temp.stack.map(e => {
            if(e instanceof Func || e instanceof Lambda){
                e.scope = new Map;
                for(let [k, v] of temp.vars){
                    e.scope.set(k.toString(), v);
                }
                // console.log(e.scope.get("asdf")+[]);
            }
            return e;
        });
        
        if(temp.running === null)
            inst.running = false;
        inst.stack = inst.stack.concat(temp.stack);
        inst.output = temp.output;
        inst.heldString = temp.heldString;
        inst.hold = temp.hold;
        inst.oldOut = temp.oldOut;
        
        // scoping, as per above
        if(scoping === 1){
            for(let [key, val] of inst.vars){
                if(temp.vars.has(key)
                    && key !== "program"
                    && this.args.indexOf(key) < 0){
                    inst.setVar(key, temp.vars.get(key));
                }
            }
        } else if(scoping === 2){
            inst.vars = clone(temp.vars);
            inst.funcs = clone(temp.funcs);
        } else if(scoping === 0){
            return;
        } else {
            error("invalid scoping degree `" + scoping + "`");
        }
    }
    
    [EQUAL](y){
        return equal(this.args, y.args) && equal(this.body, y.body);
    }
    
    toString(){
        return "{ " +
            this.args.map(e => e === "" ? "." : e).join(" ") +
            " : " +
            this.body.trim()
            + " }";
    }
}

Lambda.prototype.sanatized = Func.prototype.sanatized;
Lambda.prototype.overWith = Func.prototype.overWith;

const tokenize = (str, opts = {}) => {
    if(str === "") return [];
    keepWhiteSpace = opts.keepWhiteSpace || false;
    ignoreError = opts.ignoreError || false;

    // // this is incredibly slow, but kept here in comments for historical purposes.
    // let toks = str.match(reg);
    
    let opNames = [...(opts.ops || ops).keys()]
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
        else if(needle("(*")){
            let commentDepth = 1;
            let queue = [];
            queue.push(cur() + next());
            advance(); // remove initial (*
            while(commentDepth && hasCharsLeft()){
                if(needle("(*")){
                    commentDepth++;
                    queue.push(cur() + next());
                    advance();
                } else if(needle("*)")){
                    commentDepth--;
                    queue.push(cur() + next());
                    advance();
                } else {
                    queue.push(cur());
                    advance();
                }
            }
            while(queue.length){
                let t = new Token(queue.shift(), true);
                toks.push(t);
            }
        }
        // 5. match a function array start, if available (`$(`)
        // 5b. match a grouping symbol (`#(`)
        // 5c. match a map symbol (`(:`)
        else if(needle("$(") || needle("#(") || needle("(:")){
            toks.push(cur() + next());
            advance();
        }
        // 6. match any brace character
        else if("()[]{}".split("").some(needle)){
            toks.push(curAdvance());
        }
        // 7. match:
        // 7a. words          e.g. `foo`
        else if(isIdentifierPrefix(cur())){
            let build = curAdvance();
            while(isIdentifier(cur()) && hasCharsLeft()){
                build += curAdvance();
            }
            toks.push(build);
        }
        // 7b. setvars        e.g. `@foo`
        // 7c. setfuncs       e.g. `@:foo`
        // 7d. setdestruct    e.g. `@(a b)`
        else if(needle("@:") || needle("@") || needle("@(")){
            let build = curAdvance();
            if(needle("(")){
                build += curAdvance();
                let parenDepth = 1;
                while(parenDepth){
                    if(cur() === "(") parenDepth++;
                    else if(cur() === ")") parenDepth--;
                    build += curAdvance();
                }
            } else {
                if(needle(":")) build += curAdvance();
                if(cur() === ".")
                    build += curAdvance();
                else
                    while(isIdentifier(cur()) && hasCharsLeft()){
                        build += curAdvance();
                    }
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
    
    return toks.map(e => e instanceof Token ? e : new Token(e));
        // try {
            // return new Token(e)
        // } catch(E) {
            // if(ignoreError){
                // let t = new Token("");
                // t.raw = e;
                // return t;
            // }
            // else
                // throw E;
        // }
    // });
};

let deconstruct = (str) => {
    let toks = tokenize(str);
    let compiled = [];
    let recurse = (toks) => {
        let build = ["merge"];
        for(let i = 0; i < toks.length; i++){
            if(toks[i].type === "arrayStart"){
                let depth = 1;
                let capture = [];
                i++;
                while(i < toks.length && depth){
                    if(toks[i].type === "arrayStart") depth++;
                    else if(toks[i].type === "arrayEnd") depth--;
                    capture.push(toks[i]);
                    i++;
                }
                i--;
                capture.pop();
                console.log(capture.join` `);
                build = [].concat(build, recurse(capture));
                build.push("sgroup");
                // compiled = compiled.
            } else if(toks[i].type === "word"){
                build.push("@" + toks[i].value);
            }
        }
    }
    recurse(toks);
    return compiled.join(" ");
};

const vars = new Map([
    ["LF",         "\n"],
    ["CR",         "\r"],
    ["CRLF",       "\r\n"],
    ["PI",         Decimal.PI],
    ["pi",         Decimal.PI],
    ["TAU",        Decimal.PI.mul(2)],
    ["tau",        Decimal.PI.mul(2)],
    ["PAU",        Decimal.PI.mul(1.5)],
    ["pau",        Decimal.PI.mul(1.5)],
    ["E",          Decimal(1).exp()],
    ["e",          Decimal(1).exp()],
    ["alpha",      "abcdefghijklmnopqrstuvwxyz"],
    ["ALPHA",      "ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    ["digs",       "0123456789"],
    ["vowels",     "aeiouy"],
    ["VOWELS",     "AEIOUY"],
    ["consonants", "bcdfghjklmnpqrstvwxz"],
    ["CONSONANTS", "BCDFGHJKLMNPQRSTVWXZ"],
    ["qwerty",     ["qwertyuiop", "asdfghjkl", "zxcvbnm"]],
    ["QWERTY",     ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]],
    ["EPA",        []],
    ["EPS",        ""],
    ["ascii",      " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~"],
    ["ASCII",      [..." !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~"]],
    ["BEL",        "\x07"]
]);

vars.set("π",      vars.get("PI"));
vars.set("τ",      vars.get("TAU"));
vars.set("\u2205", vars.get("EPA"));
vars.set("ε",      vars.get("EPS"));

class Stacked {
    constructor(code, opts = {}){
        this.raw = code.raw || code;
        this.ops = clone(opts.ops || ops);
        this.toks = Array.isArray(code) ? code : tokenize(code, this.opts) || [];
        this.index = 0;
        this.stack = [];
        // todo: fix popping from an empty stack
        this.slow = opts.slow || false;
        if(this.slow)
            warn("slow mode is buggy.");
        this.reg = new Decimal(0);
        this.vars = opts.vars || clone(vars);
        this.lambdaArgs = [];   // for scoping
        
        // check whether or not the running status is valid
        this.runningCheck = defined(opts.runningCheck, (b) => !!b);
        
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
        this.observeToken = opts.observeToken || null;
    }
    
    static assignNames(){
        for(let [opName, op] of ops){
            op.displayName = op.displayName || opName;
        }
    }
    
    // static from(func){
        
    // }
    
    inherit(instance){
        this.ops = instance.ops;
        this.vars = instance.vars;
        this.output = instance.output;
        // idk anymore ;_;
    }
    
    execOp(opname){
        if(opname instanceof StackedFunc){
            // console.log(opname.modify, opname.displayName);
            opname.exec(this);
        } else {
            opname.bind(this)();
        }
    }
    
    uneval(ent){
        // todo
    }
    
    trace(){
        let res = "";
        for(let i = 0; i < this.toks.length; i++){
            let e = Token.disp(this.toks[i]);
            if(i === this.index){
                let build = "";
                build += "\n  " + e + "\n";
                build += "  " + "^".repeat(e.length) + "\n\n";
                res += errorColor(build);
            } else
                res += e + " ";
        }
        return res.trimRight();
        // return this.toks.slice(this.index - 2, this.index + 2).join(" ");
    }
    
    getVar(name){
        for(let [key, val] of this.vars){
            if(key.toString() === name)
                return val;
        }
        // console.log(name, this.vars.get(name));
        error("undefined variable `" + name + "`\n" + this.trace());
    }
    
    setVar(name, val){
        this.vars.set(name.toString(), val);
    }
    
    readOp(cur){
        if(this.observeToken)
            this.observeToken.bind(this)(cur, "readOp");
        if(cur.type === "comment"){
            // do nothing, it's a comment.
        } else if(cur.type === ""){
            
        } else if(cur.type === "popstack"){
            this.stack.pop();
        } else if(cur.type === "accessor"){
            this.index++;
            let ref = this.toks[this.index].raw;
            let e = this.stack.pop();
            // todo: make proper stack
            let pt = isDefined(e.get) ? e.get(ref) : e[ref];
            if(!isDefined(pt)){
                // todo: perhaps make this a sort of currying?
                // or it's too unpredicatable
                // ^^^ what does this mean?? wish younger self would be more helpful
                error("`" + repr(e) + "` has no property `" + ref + "`");
            } else if(pt.constructor === Function){
                pt = pt.bind(e);
                // error("Function properties are currently unsupported");
                let k = new Func("[unprintable foreign function]");
                k.exec = function(inst){
                    let args = inst.getLastN(defined(this.arity, pt.length), "[unprintable foreign function]");
                    inst.stack.push(sanatize(pt(...args)));
                }
                this.stack.push(k);
            } else {
                this.stack.push(sanatize(pt));
            }
        } else if(cur.type === "quoteFunc"){
            let k = new Func(cur.value);
            k.toString = function(){ return cur.raw; }
            k.exec = function(inst){
                let toExec = clone(inst.ops.get(cur.value));
                toExec.modify = this.modify;
                toExec.scope = this.scope;
                inst.execOp(toExec);
            }
            k.displayName = cur.raw;
            k.arity = (this.ops.get(cur.value) || { arity: null }).arity;
            this.stack.push(k);
        } else if(["number", "string", "nil", "charString"].includes(cur.type)){
            this.stack.push(cur.value);
        } else if(cur.type === "setdestruct"){
            error("destructuring assignment is yet unimplemented");
        } else if(cur.type === "setvar"){
            if(this.ops.has(cur.value)){
                error("reserved identifier `" + cur.value + "`");
            }
            if(!this.stack.length)
                error("popping from an empty stack (expected a variable for `" + cur.raw + "`)");
            this.vars.set(cur.value, this.stack.pop());
        } else if(cur.type === "setfunc"){
            if(!this.stack.length)
                error("popping from an empty stack (expected a function-like for `" + cur.raw + "`)");
            else if(ops.has(cur.value)){
                error("reserved identifier `" + cur.value + "`");
            }
            let funcToSet = this.stack.pop();
            if(!FUNC_LIKE(funcToSet)){
                error("invalid function-like `" + funcToSet.toString() + "` for `" + cur.raw + "`");
            }
            let resultFunc = funcToSet instanceof StackedFunc ? myFunc : function(){
                let myFunc = clone(funcToSet);
                myFunc.displayName = cur.value;
                myFunc.modify = defined(resultFunc.modify, funcToSet.modify, true);       // _really_ weird
                myFunc.exec(this);
            };
            resultFunc.arity = funcToSet.arity;
            resultFunc.scope = funcToSet.scope;
            // loses information about arity?
            this.ops.set(cur.value, resultFunc);
        } else if(cur.type === "op"){
            // execute command
            this.execOp(cur.func);
        } else if(this.ops.has(cur.value || cur.raw)/* && cur.type === "word"*/){
            this.execOp(this.ops.get(cur.value || cur.raw));
        } else if(cur.type === "funcStart"){
            let depth = 1;
            let build = [];
            this.index++;
            while(depth && this.index < this.toks.length){
                let cur = this.toks[this.index];
                if(cur.type === "funcStart") depth++;
                if(cur.type === "funcEnd") depth--;
                build.push(cur);
                this.index++;
            }
            this.index--;
            if(this.toks[this.index].type !== "funcEnd")
                error("expected `]`, got EOF");
            build = build.slice(0, -1); // remove trailing " ]"
            this.stack.push(new Func(build));
        } else if(cur.type === "funcArrayStart"){
            let arr = [];
            this.index++;
            while(this.index < this.toks.length){
                let cur = this.toks[this.index];
                if(cur.type === "arrayEnd")
                    break;
                if(cur.type === "op" || cur.type == "word"){
                    let f = new Func(cur.raw);
                    f.arity = defined(this.ops.get(cur.raw), { arity: null }).arity;
                    arr.push(f);
                } else {
                    error("`" + cur.raw + "` is not a function.");
                }
                this.index++;
            }
            arr.exec = function(inst){
                arr.forEach(e => e.exec(inst));
            }
            this.stack.push(arr);
        } else if(cur.type === "groupStart"){
            let stackCopy = clone(this.stack);
            this.stack = [];
            let depth = 1;
            this.index++;
            while(depth && this.index < this.toks.length){
                let cur = this.toks[this.index];
                if(cur.type === "groupStart") depth++;
                if(cur.type === "arrayEnd") depth--;
                if(!depth) break;
                this.readOp(cur);
                // this.index++;
            }
            this.stack = stackCopy.concat(this.stack);
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
            let inst = new Stacked(build, this.options);
            inst.inherit(this);
            inst.run(this);
            this.stack.push(inst.stack);
        } else if(cur.type === "lambdaStart"){
            let args = [];
            this.index++;
            let isGenerator = this.toks[this.index].raw === "*";
            this.index += isGenerator;
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
            let res = new Lambda(args, build);
            if(isGenerator)
                res = new GeneratorFactory(res);
            this.stack.push(res);
        } else if(cur.type === "word"){
            this.stack.push(this.getVar(cur.raw));
        } else {
            error("Invalid character `" + cur.raw + "` (token type `" + cur.type + "`)");
        }
        this.index++;
    }
    
    get isRunning(){
        return this.runningCheck(this.running);
    }
    
    step(){
        if(!this.isRunning)
            return this.running;
        if(this.index >= this.toks.length)
            return this.running = false;
        
        let cur = this.toks[this.index];
        this.readOp(cur);
    }
    
    run(){
        if(this.slow){
            this.step();
            if(this.isRunning)
                setTimeout(Stacked.prototype.run.bind(this), DELAY);
            return;
        }
        while(this.isRunning){
            this.step();
        }
        return this.stack.filter(e => typeof e !== "undefined")
                    .map(e => e[e.toFixed ? "toFixed" : "toString"]());
    }
    
    static getLastN(arr, n, source = ""){
        let r = [];
        while(n --> 0)
            if(arr.length === 0)
                error((source ? "(in `" + source + "`) " : "") + "popping from an empty stack");
            else
                r.unshift(arr.pop());
        return r;
    }
    
    getLastN(n, source = ""){
        return Stacked.getLastN(this.stack, n, source);
    }
}

ops = produceOps(Stacked, StackedFunc, StackedPseudoType, Func, Lambda);

ops.set("cls", isNode
    ? () => cls()
    : () => document.getElementById("stacked-output").innerHTML = "");

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
        new StackedFunc([
            [k.map(e => Decimal), new Function(
                ...k,
                k.map(e => "assureTyped(" + e + ", Decimal)").join(";") +
                ";\nreturn Decimal(Decimal." + name + "(" + k.join(",") + "))"
            )]
        ], len, { vectorize: true })
    );
});

const makeAlias = (k, v) => {
    let n = clone(ops.get(k));
    if(!n)
        console.error("no func `" + k + "` to alias");
    if(v.forEach)
        v.forEach(e => ops.set(e, n));
    else
        ops.set(v, n);
}

// aliases
new Map([
    ["oneach", '"'],
    ["recrepl", "rrepl"],
    ["frecrepl", "frrepl"],
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
    ["eval", "#~"],
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
    ["antibase", "ab"],
    ["antibaserep", "abr"],
    ["tobase", "tb"],
    ["baserep", ["tbr", "tobaserep"]],
    ["join", "#`"],
    ["retest", "rtest"],
    ["upper", ["upcase", "uc"]],
    ["lower", ["downcase", "lc", "dc"]],
    ["chunk", "#<"],
]).forEach((v, k) => {
    makeAlias(k, v);
});

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

const stacked = (...args) => {
    Decimal.set({ precision: DECIMAL_DEFAULT_PRECISION });
    let inst = new Stacked(...args);
    inst.run();
    return inst;
}

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

const bootstrapExp = (code) => {
    let tOps = clone(ops);
    tOps.set("export", function(){
        let nextToken = this.toks[++this.index];
        if(nextToken.type === "setvar")
            vars.set(nextToken.value, this.getVar(nextToken.value));
        else if(nextToken.type === "setfunc"){
            let v = this.ops.get(nextToken.value);
            if(!isDefined(v))
                error("undefined function `" + nextToken.value + "`");
            ops.set(nextToken.value, v);
        } else {
            error("invalid following token `" + nextToken.raw + "`");
        }
    });
    let inst = stacked(code, { ops: tOps });
    inst.run();
}

// node specific functions
if(isNode){
    ops.set("read", new StackedFunc([
        [[String], (e) => {
            if(!fs.existsSync(e))
                fs.writeFileSync(e, "");
            return fs.readFileSync(e).toString();
        }]
    ], 1, { vectorize: true }));
    ops.set("write", new StackedFunc([
        [[String, String], (data, name) => { fs.writeFileSync(name, data) }]
    ], 2, { vectorize: true }));
    ops.set("exit", () => process.exit());
    
    ops.set("basename", new StackedFunc([
        [[String], winpath.basename],
    ], 1, { vectorize: true }));
    ops.set("basenamext", new StackedFunc([
        [[String, String], winpath.basename],
    ], 2, { vectorize: true }));
    ops.set("dirname", new StackedFunc([
        [[String], path.dirname],
    ], 1, { vectorize: true }));
    ops.set("abspath", new StackedFunc([
        [[String], path.isAbsolute],
    ], 1, { vectorize: true }));
    ops.set("joinpath", new StackedFunc([
        [[Array], (arr) => path.join(...arr)],
    ], 1));
    ops.set("normpath", new StackedFunc([
        [[String], path.normalize],
    ], 1, { vectorize: true }));
    ops.set("parsepath", new StackedFunc([
        [[String], path.parse],
    ], 1, { vectorize: true }));
    ops.set("relativepath", new StackedFunc([
        [[String, String], path.relative]
    ], 2, { vectorize: true }));
    ops.set("resolvepath", new StackedFunc([
        [[Array], (e) => path.resolve(...e)],
    ], 1));
    ops.set("getpath", new StackedFunc(
        () => process.env.PATH.split(path.delimiter),
        0,
        { untyped: true }
    ));
    vars.set("pathdelim", path.delimiter);
    vars.set("pathsep", path.delimiter);
    
    ops.set("termcol", StackedFunc.zero(() => new Decimal(process.stdout.columns)));
    ops.set("termrow", StackedFunc.zero(() => new Decimal(process.stdout.rows)));
    bootstrap("[(termcol termrow)] @:termdim");
    bootstrap("['\r' put ' ' termcol 1- * put '\r' put] @:cll");
    
    // todo: add path.format
    
    bootstrap("[argv 2 get] @:d0");
    
    ops.set("rwrite", new StackedFunc([
        [[http.ServerResponse, String], (resp, text) => {
            resp.write(text);
            return resp;
        }],
        [[http.ServerResponse, Map], (resp, m) => {
            resp.writeHeader(200, mapToObject(m));
            return resp;
        }],
    ], 2));
    ops.set("makeserver", new StackedFunc([
        [[Lambda], function(f){
            return http.createServer((req, resp) => {
                f.overWith(this, req, resp);
            });
        }],
    ], 1));
    ops.set("listen", new StackedFunc([
        [[http.Server, Decimal], function(server, n){
            server.listen(+n);
        }],
    ], 2));
}

bootstrap(`
(* degrees to radians *)
[180 / pi *] 1/ @:torad
[pi / 180 *] 1/ @:todeg

{ arr skew :
  [
    arr size @L
    L skew - inc :> skew dec #> @inds
    arr inds get
  ]
  [
    arr skew neg chunk fixshape
  ] skew 0 >= ifelse
} 2/ @:infixes
[: size ~> prefix] 1/ @:inits
{ a f : a inits f map } 2/ @:onpref
[prime not] @:notprime
$(+ + -) { x . : x sign } agenda @:increase
$(- - +) { x . : x sign } agenda @:decrease
{ init arr func :
  arr toarr @arr
  init arr, func doinsert
} @:fold
[sign 1 +] 1/ @:skewsign
[sgroup tail merge] @:isolate
[: *] 1/ @:square
[map flat] 2/ @:flatmap
[0 >] 1/ @:ispos
[0 <] 1/ @:isneg
[0 >=] 1/ @:isnneg
[0 <=] 1/ @:isnpos
[0 eq] 1/ @:iszero
{ x : x } @:id
{ . x : x } @:sid
{ . . x : x } @:tid
[: floor -] @:fpart
[: fpart -] @:ipart
$(fpart , ipart) fork @:fipart
$(ipart , fpart) fork @:ifpart
[2 tobase] @:bits
[2 antibase] @:unbits
[2 tobaserep] @:bin
[2 antibaserep] @:unbin
[10 tobase] @:digits
[10 antibase] @:undigits
[16 tobaserep] @:tohex
[16 antibaserep] @:unhex
[$rev map] @:reveach
['txt' download] @:savetxt
[2 /] 1/ @:halve
[2 *] 1/ @:double
[1 +] 1/ @:inc
[1 -] 1/ @:dec
[0 get] 1/ @:first
[_1 get] 1/ @:last
[2 mod 1 eq] 1/ @:odd
[2 mod 0 eq] 1/ @:even
{ x : 1 0 x ifelse } 1/ @:truthy
[truthy not] 1/ @:falsey
$max #/ @:MAX
$min #/ @:MIN
$* #/ @:prod
$+ #/ @:sum
$and #/ @:all
$or #/ @:any
$not $any ++ @:none
[95 baserep] @:compnum
[95 antibaserep] @:decompnum
{ a b :
  [
    b @t
    a b mod @b
    t @a
  ] [b 0 !=] while
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
  arr
  [ ind neg rot ]
  ind _1 = unless
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

{ f d : 0 @i [i f! i inc @i] d animation } @:ani

[#/ !] @:doinsert

[: _ \\ |>]" @:steps

[: disp] @:show
[: out] @:echo
[: put] @:say

([3 * 1 +] $halve) $even agenda @:ulamstep
{ x :
  (x) @a
  x { n :
    n ulamstep
    dup a swap , @a
  } [1 =] until
  a isolate
} @:ulam

[ofshape $tid deepmap] @:ints


['g'    frepl] 3/ @:repl
[''     frepl] @:nrepl
['gm'   frepl] @:mrepl
['gmi'  frepl] @:mirepl
['gi'   frepl] @:irepl
['m'    frepl] @:nmrepl
['mi'   frepl] @:nmirepl
['i'    frepl] @:nirepl
['ge'   frepl] @:erepl
['gme'  frepl] @:emrepl
['gmie' frepl] @:emirepl
['gie'  frepl] @:eirepl
['e'    frepl] @:nerepl
['ei'   frepl] @:neirepl
['em'   frepl] @:nemrepl
['emi'  frepl] @:nemirepl
['' repl] @:del
['' rrepl] @:DEL
[CR del LF split] @:lines
{ a b : #(a b >) #(a b <) - } @:cmp
{ ent i :
  ent i ent size mod #
} @:modget
{ shpe e F :
  e flat @e_flat
  shpe { i : e_flat i F! } shapef } @:FSHAPE
{ shpe e :
  e flat @e_flat
  shpe { i : e_flat i modget } shapef } @:SHAPE
{ shpe ent pad_el : shpe ent { ent i :
  [ent i #] [pad_el] i #(ent size) < ifelse
} FSHAPE } @:PSHAPE
[2 * 1 -] 1/ @:tmo
[2 * 1 +] 1/ @:tpo
[100 *] 1/ @:hundred
[1000 *] 1/ @:thousand
[1e6 *] 1/ @:million
[1e9 *] 1/ @:billion

(* $notprime? whilst doesn't work *)
[[:notprime] whilst] @:untilprime
[$inc untilprime] @:nextprime
[$dec untilprime] @:prevprime

(
  [1 <=] []
  { n :
    2 [nextprime] [: n |] until
  }
) cases" @:minpf


(* todo: scoping only directly within lambdas should preserve args? *)
{ n :
  () @facs
  n @m
  [
    m minpf @d
    facs d , @facs
    m d / @m
  ] [m 1 >] while
  facs
} @:pf

[2000 precision] @:lprec

{ x y :
  (x y) show $size map MIN @min_len
  (x y) [min_len take] map tr
} @:zip

{ f :
  [zip f #/ map]
} @:zipwith

[ fixshape ] @:FIX
{ x y :
  x y / floor @c1
  (c1 x c1 -)
} @:cusp

{ f : {! n f ! n =} } @:invariant

{ f p : [f 0 rand p < if] } @:randomly

{ a i :
  [a i pop # i rget] [a] i size ifelse
} @:rget

{ a f : a ... f! } @:spread

(* doesn't work, 'p' undefined *)
(*{ f : f 0.5 randomly } @:rbinly*)

[stack $disp map @.] @:SOUT
`);

makeAlias("prod", "\u220f");
makeAlias("modget", "##");
makeAlias("SHAPE", "#$");
makeAlias("cmp", "<=>");
makeAlias("square", "²");
makeAlias("iszero", "is0");
makeAlias("doinsert", "#\\");
makeAlias("doinsert", "fold");
makeAlias("FIX", "#&");
makeAlias("inc", "↑");
makeAlias("inc", "#+");
makeAlias("dec", "↓");
makeAlias("dec", "#-");
makeAlias("reject", "NO");
makeAlias("accept", "YES");


// some string functions
bootstrapExp(`
'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.' @lorem
{ str : str head upper str behead ++ } @:encap
[' ' split $encap map ' ' join] @:titlecase
('a' 'an' 'the'
 'is' 'for' 'and' 'nor' 'but' 'or' 'yet' 'so'
 'at' 'around' 'by' 'after' 'along' 'for' 'from' 'of' 'on' 'to' 'with' 'without'
) @articles
{ str :
  str ' ' split @word_list
  word_list shift encap wrap @fin
  fin
   word_list { word : (word encap  word) articles word has # } map
  , @fin
  fin ' ' join
} @:smarttitlecase

{ str n :
  n str size - 2 cusp ' ' * str join
}" @:center

(
  typeString { str :
    str lines centerlines
  }
  typeArray { arr :
    arr $size map MAX @mlen
    arr mlen center LF join
  }
) typed @:centerlines

[ '\\s+' rsplit ] @:words

{ str width :
  str words @str_words
  () @res_lines
  () @bld_line
  [
    str_words first @word
    bld_line word ++ @next_possible
    [
      res_lines bld_line ' ' join push spop
      () @bld_line
    ] [
      next_possible @bld_line
      str_words shift
    ] #(next_possible ' ' join size) width > ifelse
  ] [str_words size] while
  res_lines bld_line , LF join
} @:wraptext

{ str width :
  str words @str_words
  () @res_lines
  () @bld_line
  [
    str_words first @word
    bld_line word ++ @next_possible
    next_possible ' ' join size @next_size
    (* algorithm inspired by http://code.activestate.com/recipes/414870 *)
    [
      bld_line size
      width bld_line ' ' join size - @l_count
      [
        bld_line {!
          [n ' ' +] n l_count ispos ifelse
          l_count 1 - @l_count
        } map @bld_line
      ] [l_count ispos] while
      res_lines bld_line ' ' join push spop
      () @bld_line
    ] [
      next_possible @bld_line
      str_words shift
    ] next_size width > ifelse
  ] [str_words size] while
  res_lines bld_line , LF join
} @:fulljustify

{ str :
  str str lines $size map MAX fulljustify
} @:dfulljustify

($lower invariant [not and] $upper invariant) fork @:islower
($upper invariant [not and] $lower invariant) fork @:isupper

{ str : 
  str '' split {! n $(lower upper) n islower # ! } map '' join
} @:swapcase

export @:encap
export @:titlecase
export @:smarttitlecase
export @:center
export @:centerlines
export @:wraptext
export @:fulljustify
export @:dfulljustify
export @:swapcase
export @:islower
export @:isupper
export @:words
export @articles
export @lorem
`);

makeAlias("encap", "capitalize");
makeAlias("titlecase", "tc");
makeAlias("smarttitlecase", "stc");

// ---stealing--- adapting some of Haskell's Data.List stuff
bootstrap(`
{ list el : list [el pair] map $++ #\\ betail } @:intersperse
[intersperse flat] @:intercalate
$(take pair drop) fork @:splitat
([1 - take] $pair $drop) fork" @:splitdr
($take $pair [1 + drop]) fork" @:splitdl
`);

// extends a current operation for typed-ness
const extendTypedLocale = (locale, opName, newTypeArr, resultFunc, arity = -1, vectorized = true) => {
    let pfunc = locale.get(opName);
    if(pfunc instanceof StackedFunc){
        pfunc.typeMap.push([newTypeArr, resultFunc]);
    } else {
        locale.set(opName, new StackedFunc([
            [newTypeArr, resultFunc],
            [newTypeArr.map(() => ANY), function(...args){
                this.stack = this.stack.concat(args);
                pfunc.bind(this)();
            }],
        ], arity, { vectorize: vectorized }));
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
        ops.set(dprop, new StackedFunc([
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

const aliasPrototype = (klass, alias, name) => {
    klass.prototype[alias] = klass.prototype[name];
}

// color
aliasPrototype(Color, "-", "sub");
aliasPrototype(Color, "=", "equal");
Color.prototype.repr = function(){
    let s = this.a == Color.A_MAX - 1
        ? "'" + this + "' Color"
        : "(" + [...this].join(" ") + ") Color";
    return "#(" + s + ")";
}
integrate(Color, { merge: true });
vars.set("colors", Color.colors);

// char string
class CharString {
    constructor(a){
        this.members = [...a];
        // todo: shape
        return this;
    }
    
    [EQUAL](y){
        assureTyped(y, CharString);
        return equal(this.members, y.members);
    }
    
    *[Symbol.iterator](){
        for(let k of this.members){
            yield k;
        }
    }
    
    map(f){
        let res = [...this].map(f);
        if(res.every(e => typeof e === "string"))
            res = new CharString(res);
        return res;
    }
    
    get length(){
        return this.members.length;
    }
    
    slice(...a){
        return new CharString(this.members.slice(...a));
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
        let c = clone(this);
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

integrate(CharString, { merge: true, ignore: "slice" });

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

class GeneratorFactory {
    constructor(body){
        this.body = body;
    }
    
    exec(inst){
        let res;
        if(this.body instanceof Lambda){
            let args = Stacked.getLastN(inst.stack, this.body.arity);
            res = new StackedGenerator(this.body, args);
        } else
            res = new StackedGenerator(this.body);
        inst.stack.push(res);
        return res;
    }
    
    static next(stackGen){
        assureTyped(stackGen, StackedGenerator);
        return stackGen.next();
    }
    
    static exhaust(stackGen){
        assureTyped(stackGen, StackedGenerator);
        
    }
}

class StackedGenerator {
    constructor(body, args){
        this.index = 0;
        // might not work
        this.body = FUNC_LIKE(body) ? body : new Func(body);
        let prog = "";
        // if(args){
            // prog = args.map(e => e ? "@" + e : "sdrop").join(" ");
        // }
        this.inst = new Stacked(prog, {
            runningCheck: (running) => running !== StackedGenerator.YIELD_STOP
                                    && !!running,
        });
        if(args){
            this.inst.stack = args;
        }
        this.inst.toks = [Token.from(this.body)];
        let self = this;
        this.inst.ops.set("yield", new StackedFunc(function(a){
            self.queue.push(a);
            this.running = self.inst.running = StackedGenerator.YIELD_STOP;
        }, 1, { untyped: true }));
        // queue of results to return
        this.queue = [];
        this.done = false;
    }
    
    next(){
        // return results in queue until empty
        if(this.queue.length)
            return this.queue.shift();
        // run until StackedGenerator.YIELD_STOP or regular interrupt
        this.inst.run();
        if(this.inst.running === StackedGenerator.YIELD_STOP){
            this.inst.running = true;
        } else {
            this.done = true;
            return new Nil;
        }
        
        if(this.queue.length)
            return this.queue.shift();
        
        this.done = true;
        return new Nil;
    }
    
    *[Symbol.iterator](){
        let res;
        do {
            res = this.next();
            if(this.done) break;
            yield res;
        } while(true);
    }
    
    toString(){
        return "StackedGenerator " + this.body;
    }
}

StackedGenerator.YIELD_STOP = Symbol("YIELD_STOP");

integrate(GeneratorFactory, { merge: true });

// finally, assign names to each op
Stacked.assignNames();

// options
stacked.Stacked = Stacked;
stacked.bootstrap = bootstrap;
stacked.bootstrapExp = bootstrapExp;
stacked.silentError = false;
stacked.tokenize = tokenize;
stacked.sanatize = sanatize;
stacked.unsanatize = unsanatize;

if(isNode){
    stacked.highlight = highlight;
    module.exports = exports.default = stacked;
}