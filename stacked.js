if(typeof require !== "undefined") require("decimal.js");

const DELAY = 200;

const error = (err) => {
    new Stacked("").output("error: " + err)
    // console.log("error: " + err);
    throw new Error("haha have fun");
};

function func(f, merge = false, refs = [], arity = f.length){
    // this works for retaining the `this` instance.
    return function(){
        let args = arity ? this.stack.splice(-arity) : [];
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

const ANY = [() => true];
const ITERABLE = [(e) => typeof e[Symbol.iterator] !== "undefined"];

function typed(typeMap){
    return function(...args){
        redo: for(let t of typeMap){
            let [key, func] = t;
            let i = 0;
            for(let k of key){
                if(!(k instanceof Array && k[0](args[i]) ||
                        args[i] instanceof k ||
                        args[i].constructor === k)){
                    continue redo;
                }
                i++;
            }
            return func.bind(this)(...args);
        }
        error("no matching types for " +
            args.map(e => e ? typeName(e.constructor) : "undefined")
                .join(", "));
    }
}

const FUNC_LIKE = (e) => e instanceof Lambda || e instanceof Func;

class Token {
    constructor(str, isComment){
        this.raw = str;
        if(isComment){
            this.type = "comment";
        }
        // let's identify what type of token this is
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
            this.value = str.slice(1, -1);
            this.type = "string";
        } else if(str[0] === "@"){
            this.value = str.slice(1);
            this.type = "setvar";
            if(str[1] === ":"){
                this.value = this.value.slice(1);
                this.type = "setfunc";
            }
        } else if(str.match(/^[A-Za-z_]/) || str[0] === "`"){
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
        } else if(str[0] === "$" && str[1] === "'"){
            this.type = "charString";
            this.value = new CharString(str.slice(2, -1));
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

class Nil {
    constructor(){};
    
    toString(){
        return "nil";
    }
}

class Func {
    constructor(body){
        this.body = body;
    }
    
    over(...args){
        let t = new Stacked("");
        t.stack = args;
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    overWith(inst, ...args){
        let t = new Stacked("");
        t.vars = inst.vars;
        t.ops = inst.ops;
        t.stack = args;
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    sanatized(inst, ...args){
        let k = this.overWith(inst, ...args.map(sanatize));
        return unsanatize(k);
    }
    
    exec(inst){
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
        
        // fuck scoping
        // idea: make argument scoping different
        for(let [key, val] of inst.vars){
            if(temp.vars.has(key)){
                inst.vars.set(key, temp.vars.get(key));
            }
        }
    }
    
    toString(){
        return "[" + this.body.trim() + "]";
    }
}

class Lambda {
    constructor(args, body){
        this.args = args;
        this.body = body;
        this.arity = this.args.length;
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
        t.stack = args.slice(0, this.args.length);
        this.exec(t);
        return defined(t.stack.pop(), new Nil);
    }
    
    sanatized(inst, ...args){
        let k = this.overWith(inst, ...args.map(sanatize));
        return unsanatize(k);
    }
    
    exec(inst){
        let temp = new Stacked(this.body);
        temp.ops = inst.ops.clone();
        // console.log(inst.ops.get("h"));
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
        
        // console.log(temp.vars);
        
        temp.run();
        
        if(temp.running === null)
            inst.running = false;
        inst.stack = inst.stack.concat(temp.stack);
        inst.output = temp.output;
        inst.heldString = temp.heldString;
        inst.hold = temp.hold;
        inst.oldOut = temp.oldOut;
        
        // scoping, as per above
        
        // fuck scoping
        for(let [key, val] of inst.vars){
            if(temp.vars.has(key)){
                inst.vars.set(key, temp.vars.get(key));
            }
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
    ["+", vectorTyped([
        [[Decimal, Decimal],     (a, b) => a.add(b)],
        [[String, String],       (a, b) => a + b],
        [[Func, Func],           function(f, g){
            let k = new Func(f + "+" + g);
            k.exec = function(inst){
                [g, f].forEach(e => {
                    inst.stack.push(e);
                    ops.get("!").bind(inst)();
                });
            }
            return k;
        }],
    ], 2)],
    ["++", func(typed(new Map([
        [[Array, Array],     (a, b) => a.concat(b)],
    ])), false, [], 2)],
    ["-", vectorTyped([
        [[Decimal, Decimal], (a, b) => a.sub(b)],
    ], 2)],
    ["/", vectorTyped([
        [[Decimal, Decimal], (a, b) => a.div(b)],
    ], 2)],
    ["^", vectorTyped([
        [[Decimal, Decimal], (a, b) => a.pow(b)],
    ], 2)],
    ["*", vectorTyped([
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
    ], 2)],
    // todo: make this work with fold(r?)
    [",", func((a, b) => [...(a instanceof Array ? a : [a]), ...(b instanceof Array ? b : [b])])],
    // [",", func((a, b) => [a, ...(b instanceof Array ? b : [b])])],
    ["%", vectorTyped([
        [[Decimal, Decimal], (a, b) => a.mod(b)],
    ], 2)],
    ["mod", vectorTyped([
        [[Decimal, Decimal], (a, b) => {
            var c = a.mod(b);
            return c.lt(0) ? c.add(b) : c;
        }],
    ], 2)],
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
    ["prime", vectorTyped([
        [[Decimal], isPrime]
    ], 1)],
    ["get", func(vectorizeRight((a, b) => {
        if(isDefined(a.get)){
            return a.get(b);
        } else {
            return a[b];
        }
    }))],
    ["=", func((a, b) => Decimal(+equal(a, b)))],
    // ["=", func((a, b) => Decimal(+equal(a, b)))],
    ["eq", func(vectorize((a, b) => Decimal(+equal(a, b))), false, [], 2)],
    ["<", vectorTyped([
        [[Decimal, Decimal], (a, b) => Decimal(+a.lt(b))],
        [[String, String], (a, b) => Decimal(+(a < b))]
    ], 2)],
    ["<=", vectorTyped([
        [[Decimal, Decimal], (a, b) => Decimal(+a.lte(b))],
        [[String, String], (a, b) => Decimal(+(a <= b))]
    ], 2)],
    [">", vectorTyped([
        [[Decimal, Decimal], (a, b) => Decimal(+a.gt(b))],
        [[String, String], (a, b) => Decimal(+(a > b))]
    ], 2)],
    [">=", vectorTyped([
        [[Decimal, Decimal], (a, b) => Decimal(+a.gte(b))],
        [[String, String], (a, b) => Decimal(+(a >= b))]
    ], 2)],
    // ["<=>", vectorTyped([
        
    // ])],
    ["!", function(){
        let obj = this.stack.pop();
        if(obj instanceof Decimal || obj instanceof Array){
            this.stack.push(vectorize(factorial)(obj));
        } else if(obj instanceof Func || obj instanceof Lambda){
            obj.exec(this);
        } else {
            error("unrecognized type `" + typeName(obj.constructor) + "` for `!`");
        }
    }],
    // divides
    ["|", vectorTyped([
            [[Decimal, Decimal], (a, b) => Decimal(+b.mod(a).eq(0))]
        ],
        2
    )],
    ["|>", vectorTyped([
        [[Decimal, Decimal], (a, b) => range(a, b.add(1))],
    ], 2)],
    ["..", vectorTyped([
        [[Decimal, Decimal], range],
    ], 2)],
    [":>", vectorTyped([
        [[Decimal], (a) => range(Decimal(0), a)],
    ], 1)],
    ["~", vectorTyped([
        [[Decimal], a => a.floor().add(1).neg()],
    ], 1)],
    ["neg", vectorTyped([
        [[Decimal], a => a.neg()],
    ], 1)],
    // vectorize?
    ["join", func((a, b) => a.join(b.toString()))],
    ["split", func((a, b) => a.split(b.toString()))],
    ["oneach", func((f) => {
        let k = new Func(f.body);
        // dirty hack, todo: fix it
		// dear past me: in your dreams.
        // dear past me's: you guys are so immature
        k.exec = function(inst){
			let vec = vectorize(e => f.overWith(inst, e));
			let entity = inst.stack.pop();
			inst.stack.push(vec(entity));
        };
        return k;
    })],
    ["each", function(){
        ops.get("oneach").bind(this)();
        ops.get("!").bind(this)();
    }],
    ["repl", typedFunc([
        [[String, String, String],
            (orig, target, sub) =>
                orig.replace(new RegExp(target, "g"), sub)],
    ], 3)],
    ["recrepl", typedFunc([
        [[String, String, String], 
            (orig, target, sub) =>
                recursiveRepl(orig, new RegExp(target, "g"), sub)]
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
    ["debug", func(e => console.log(disp(e)))],
    ["put", function(){
        this.output(this.stack.pop());
        // this.output(tp.type === "word" ? this.vars.get(tp.raw) : tp);
    }],
    ["rawout", function(){
        this.output(joinArray(this.stack.pop()));
        this.output("\n");
    }],
    ["sout", function(){
        this.output(pp(this.stack));
        this.output("\n");
    }],
    ["out", function(){
        var tp = this.stack.pop();
		if(typeof tp === "undefined") error("popping from empty stack");
        this.output(tp.type === "word" ? this.vars.get(tp.raw) : tp);
        this.output("\n");
    }],
    ["repr", func(pp)],
    ["dup", func(e => [e, e], true)],
    ["swap", func((x, y) => [y, x], true)],
    ["sdrop", function(){ this.stack.pop(); }],
    ["drop", typedFunc([
        [[Array], (a) => (a.slice(1))],
        [[String], (a) => (a.slice(1))],
    ], 1)],
    ["srev", function(){ this.stack.reverse(); }],
    ["rev", func(typed([
        [[Array],  a => a.clone().reverse()],
        [[String], a => [...a].reverse().join("")],
    ]), false, [], 1)],
    ["behead", typedFunc([
        [[Array],   a => a.slice(1)],
        [[String],   a => a.slice(1)],
    ], 1)],
    ["head",   typedFunc([
        [[Object],   a => a[0]],
    ], 1)],
    ["betail", typedFunc([
        [[Array],   a => a.slice(0, -1)],
        [[String],   a => a.slice(0, -1)],
    ], 1)],
    ["tail",   typedFunc([
        [[Object],   a => a.slice(-1)],
    ], 1)],
    ["exec", function(){
        let k = this.stack.pop();
        k.exec(this);
    }],
    ["not", func(a => Decimal(+falsey(a)))],
        // return new Decimal(+falsey(this.stack.pop()));
    // }],
    ["ord", func(a => Decimal(a.charCodeAt()))],
    ["chr", vectorTyped([
        [[Decimal], a => String.fromCharCode(+a)]
    ], 1)],
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
    ["jump", func(function(k){
        this.index = k - 1;
    })],
    ["grid", typedFunc([
        [[Array], joinGrid],
    ], 1)],
    ["DEBUG", function(){
        console.log(disp(this.stack));
        console.log(this.stack);
    }],
    // todo: take from a textarea
    ["input", func(() => Decimal(prompt()))],
    ["prompt", func(() => prompt())],
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
    // ["agenda", function(){
        // let agenda = this.stack.pop();
        // let size = 
    // }],
    ["size", func(a => new Decimal(a.length))],
    ["if", function(){
        let [ent, f] = this.stack.splice(-2);
        assureTyped(f, Func);
        if(truthy(ent)) f.exec(this);
    }],
    ["unless", function(){
        let [ent, f] = this.stack.splice(-2);
        if(falsey(ent)) f.exec(this);
    }],
    ["ifelse", function(){
        let [f1, f2, ent] = this.stack.splice(-3);
        (truthy(ent) ? f1 : f2).exec(this);
    }],
    ["len", function(){
        this.stack.push(Decimal(this.stack.length));
    }],
    ["flush", function(){
        while(this.stack.length) this.stack.pop();
    }],
    ["map", function(){
        let f = this.stack.pop();
        let arr = this.stack.pop();
        if(f instanceof Lambda){
            this.stack.push(arr.map((e, i) => {
                switch(f.args.length){
                    case 1:
                        return f.overWith(this, e);
                    case 2:
                        return f.overWith(this, e, Decimal(i));
                    default:
                        error("unsupported function arity `" + f.args.length + "` for `map`");    
                }
            }));
        } else if(f instanceof Func){
            this.stack.push(arr.map(e => {
                let t = new Stacked("");
                t.vars = this.vars;
                t.ops = this.ops;
                t.stack.push(e);
                f.exec(t);
                return defined(t.stack.pop(), new Nil);
            }));
        }
    }],
    // map the stack
    ["smap", function(){
        let f = this.stack.pop();
        this.stack = [this.stack, f];
        ops.get("map").bind(this)();
        this.stack = this.stack.pop();
    }],
    ["fold", function(){
        let f = this.stack.pop();
        if(this.stack.length === 1) return;
        this.stack = [this.stack.reduce((p, c) => {
            let t = new Stacked("");
            t.stack.push(p, c);
            // console.log(p, c);
            f.exec(t);
            return t.stack.pop();
        })].reject(falsey);
    }],
    ["foldr", function(){
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
    ["isolate", function(){
        this.stack = [this.stack.pop()];
    }],
    ["return", function(){
        this.stack = [this.stack.pop()];
        this.running = null;
    }],
    ["rand", vectorTyped([
        [[Decimal], (a) => a == 0 ? Decimal.random() : a.mul(Decimal.random()).floor()],
    ], 1)],
    // ["randin", typedFunc([
        // [[Array], (arr) => arr[Math.random() * arr.length | 0]],
        // [[String], (arr) => arr[Math.random() * arr.length | 0]],
    // ], 1)],
    ["nswap", function(){
        let [a0, a1] = this.stack.splice(-2);
        // possibly unsafe
        [this.stack[a0], this.stack[a1]] = [this.stack[a1], this.stack[a0]];
    }],
    // ["shuf", func(shuffle)],
    // or use a header, like #op ++
    ["def", function(){
        let name = this.stack.pop(); // a word or string
        let ref = name.type === "word" ? name.raw : name;
        let next = this.stack.pop();
        if(next instanceof Lambda || next instanceof Func){
            this.ops.set(ref, function(){
                next.exec(this);
            })
        } else {
            error("unsupported body type `" + typeName(next.constructor) + "` for `def`");
        }
    }],
    ["bits", vectorTyped([
        [[Decimal], (n) => toBase(n, 2)]
    ], 2)],
    ["digits", vectorTyped([
        [[Decimal], (n) => toBase(n, 10)]
    ], 1)],
    ["tobase", vectorTyped([
        [[Decimal, Decimal], (a, b) => toBase(a, b)]
    ], 2)],
	["antibase", typedFunc([
		[[Array, Decimal], (a, b) => antiBase(a, b)]
	], 2)],
	["baserep", vectorTyped([
		[[Decimal, Decimal], (a, b) => toBaseString(a, b)],
	], 2)],
	["antibaserep", vectorTyped([
		[[String, Decimal], (a, b) => antiBaseString(a, b)],
	], 2)],
    ["pad", typedFunc([
        [[[e => isDefined(e.padStart)], ANY, Decimal], (a, f, len) => a.padStart(len, f)],
    ], 3)],
    ["dpad", rightVectorTyped([
        [[[e => isDefined(e.padStart)], Decimal], (arr, len) => arr.padStart(len,
            isString(flatten(arr)[0]) ? " " : 0)],
    ], 2)],
    ["insert", function(){
        let func = this.stack.pop();
		let k = new Func(func+"insert");
		k.exec = function(inst){
			let ent = inst.stack.pop();
			if(!(ent instanceof Array))
				error(typeName(ent.constructor) + " is not insertable");
			
			inst.stack.push(ent.length <= 1 ? ent[0] : ent.reduce((p, c) => func.over(p, c)));
		}
		this.stack.push(k);
    }],
    ["and", func((a, b) => new Decimal(+(truthy(a) && truthy(b))))],
    ["or", func((a, b) => new Decimal(+(truthy(a) || truthy(b))))],
    ["xor", func((a, b) => new Decimal(+(truthy(a) ^ truthy(b))))],
    ["table", typedFunc([
        [[Object, Object, [FUNC_LIKE]],
            (a, b, f) => table(a, b, (...args) => f.over(...args))],
    ], 3)],
    ["filter", typedFunc([
        [[Array, [FUNC_LIKE]], function(a, f){
            // console.log(a.map(e=>e+[]));
            return a.filter(e => truthy(f.overWith(this, e)));
        }],
    ], 2)],
    ["reject", typedFunc([
        [[Array, [FUNC_LIKE]], function(a, f){
            // console.log(a.map(e=>e+[]));
            return a.reject(e => truthy(f.overWith(this, e)));
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
        console.log(arr+[]);
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
    ["square", function(){
        ops.get(":").bind(this)();
        ops.get("*").bind(this)();
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
    ["tofunc", func((s) => new Func(s))],
	["rot", func((a, n) => rotate(a, n))],
	["index", rightVectorTyped([
        [[ITERABLE, ANY], (ent, n) => {
            // console.log(ent, n);
            // console.log(pp([ent, n]));
            return new Decimal([...ent].newIndexOf(n))
        }],
    ], 2)],
	["execeach", function(){
		let funcArr = this.stack.pop();
		let k = new Func("$(" + funcArr.join(" ") + ")#!");
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
        [[Array, [FUNC_LIKE]], function(a, f){
            return chunkBy(a, (...args) => unsanatize(f.overWith(this, ...args.map(sanatize))));
        }],
    ], 2)],
    ["runsof", typedFunc([
        [[[e => e instanceof Array || typeof e === "string"], [FUNC_LIKE]], (a, f) => runsOf(a, (x, y) => f.over(x, y))],
    ], 2)],
    ["eval", function(){
        let t = this.stack.pop();
        this.stack.push(new Func(t));
        ops.get("!").bind(this)();
    }],
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
        [[[FUNC_LIKE], Decimal, Decimal, Decimal], function(f, min, max, delay){
            let msDelay = +delay.mul(1000);
            let rec = (i) => {
                f.overWith(this, i);
                if(i.lt(max))
                    setTimeout(rec, msDelay, i.add(1));
            }
            rec(min);
        }]
    ], 4)],
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
    ["transpose", typedFunc([
        [[Array], transpose],
    ], 1)],
	["prefix", rightVectorTyped([
		[[Array, Decimal], (a, d) => prefix(a, d)],
		[[String, Decimal], (a, d) => prefix(a, d)],
	], 2)],
    ["keys", func((a) => sanatize([...a.keys()]))],
    ["lower", vectorTyped([
        [[String], a => a.toLowerCase()]
    ], 1)],
    ["upper", vectorTyped([
        [[String], a => a.toLowerCase()]
    ], 1)],
    ["wrap", func((a) => [a])],
    ["flat", typedFunc([
        [[Array], flatten],
        [[ANY], e => e]
    ], 2)],
    ["cellmap", typedFunc([
        [[Array, [FUNC_LIKE]], function(a, f){ return cellMap(a, (...args) => f.overWith(this, ...args.map(sanatize))) }],
    ], 2)],
    ["deepmap", typedFunc([
        [[Array, [FUNC_LIKE]], function(a, f){ return deepMap(a, (...args) => f.overWith(this, ...args.map(sanatize))) }],
    ], 2)],
    ["has", typedFunc([
        [[String, ANY],    (a, b) => sanatize(!!a.find(e => equal(e, b)))],
        [[ITERABLE, ANY],  (a, b) => sanatize(!!a.find(e => equal(e, b)))],
    ], 2)],
    ["intersection", typedFunc([
        [[ITERABLE, ITERABLE], intersection],
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
    ["periodloop", typedFunc([
        [[ANY, [FUNC_LIKE]], function(o, f){
            return periodLoop(o, (...a) => f.sanatized(this, ...a)).result;
        }],
    ], 2)],
    ["periodsteps", typedFunc([
        [[ANY, [FUNC_LIKE]], function(o, f){
            return periodLoop(o, (...a) => f.sanatized(this, ...a)).steps;
        }],
    ], 2)],
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
    ["square", "²"],
    ["mod", "%%"],
    ["+", "compose"],
	["execeach", "#!"],
    ["powerset", ["\u2119", "P"]],
    ["transpose", "tr"],
    ["intersection", "\u2229"],
    ["union", "\u222A"],
    ["has", "\u2208"],
    [">=", "≥"],
    ["<=", "≤"],
    ["not", "¬"],
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
                    build += "'";
                    advance(2);
                } else {
                    build += cur();
                    advance();
                }
            }
            advance();
            toks.push(build + "'");
        }
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
                if(window.DEBUG)
                    console.log(name);
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
            } else
                error("`" + cur() + "` is an invalid character.");
        }
    }
    
    // preprocess comments
    let commentInds = toks.map(e => false);
    // let max = 100;
    // for(let i = 0, t = 0; i < toks.length && t < max; i++, t++){
    for(let i = 0; i < toks.length; i++){
        if(toks[i] === "(*"){
            // console.log(i, t);
            let depth = 1;
            i++;
            // console.group();
            while(depth && i < toks.length){
                let cur = toks[i];
                // console.log(cur, i);
                if(cur === "(*") depth++;
                else if(cur === "*)") depth--;
                else commentInds[i] = true;
                // console.log(cur, i, commentInds);
                i++;
            }
            // console.groupEnd();
            // console.log(i);
            i--;
            if(depth)
                warn("unclosed comment");
        }
    }
    
    return toks.map((e, i) => new Token(e, commentInds[i]));
};

const parseNum = function(str){
    // \d+n == -\d+
    // for now, this will do
    str = str.replace(/(.+)n$/, "-$1").replace(/^_/, "-");
    try {
        return new Decimal(str);
    } catch(e){
        error("invalid number `" + str + "`");
    }
}

const vars = new Map([
	["LF",     "\n"],
	["CR",     "\r"],
	["CRLF",   "\r\n"],
	["PI",     Decimal.PI],
	["TAU",    Decimal.PI.mul(2)],
	["PAU",    Decimal.PI.mul(1.5)],
	["E",      Decimal(1).exp()],
	["alpha",  "abcdefghijklmnopqrstuvwxyz"],
	["ALPHA",  "ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
    ["\u2205", []],
]);

vars.set("π", vars.get("PI"));
vars.set("τ", vars.get("TAU"));

class Stacked {
    constructor(code, slow = false){
        this.raw = code;
        this.ops = ops.clone();
        this.toks = tokenize(code) || [];
        this.index = 0;
        this.stack = [];
        this.slow = slow;
        this.reg = new Decimal(0);
        this.vars = vars;
        
        // environment variables
        this.vars.set("program", this.raw);
        
        this.running = true;
        this.output = document ?
            document.getElementById("stacked-output") ?
                e => document.getElementById("stacked-output").appendChild(
                    document.createTextNode(pp(e || ""))
                )
                : e => alert(e)
            : e => console.log(e);
    }
    
    inherit(instance){
        this.ops = instance.ops;
        this.vars = instance.vars;
        this.output = instance.output;
        // idk anymore ;_;
    }
    
    step(){
        if(this.index >= this.toks.length || !this.running)
            return this.running = false;
        
        let cur = this.toks[this.index];
        if(["comment", "commentStart", "commentEnd"].indexOf(cur.type) >= 0){
            // do nothing, it's a comment.
        } else if(cur.type === "quoteFunc"){
            let k = new Func(cur.value);
            k.toString = function(){ return cur.raw; }
            k.exec = function(inst){
                inst.ops.get(cur.value).bind(inst)();
            }
            this.stack.push(k);
        } else if(["number", "string", "nil", "charString"].includes(cur.type)){
            this.stack.push(cur.value);
        } else if(cur.type === "setvar"){
            if(this.ops.has(cur.value)){
                error("reserved identifier `" + cur.value + "`");
            }
            this.vars.set(cur.value, this.stack.pop());
        } else if(cur.type === "setfunc"){
            if(!this.stack.length)
                error("popping from an empty stack");
            let next = this.stack.pop();
            if(!FUNC_LIKE(next)){
                error("invalid function-like `" + next.toString() + "`");
            }
            // console.log(cur.value, next+[], this.ops.get(cur.value)+[]);
            this.ops.set(cur.value, function(){
                next.exec(this);
            });
            // console.log(this.ops.get(cur.value)+[]);
        } else if(cur.type === "op"){
            // execute command
            cur.func.bind(this)();
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
                if(cur.type === "op"){
                    arr.push(new Func(cur.raw));
                } else {
                    error("`" + cur.raw + "` is not a function.");
                }
                this.index++;
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
            if(this.toks[this.index].raw == "."){
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
            error("unhandled type `" + cur.type +"` of `" + cur.raw + "`");
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
[0 get] @:first
[_1 get] @:last
$max #/ @:MAX
$min #/ @:MIN
$* #/ @:prod
$+ #/ @:sum
$and #/ @:all
$or #/ @:any
$not $any + @:none
[95 baserep] @:compnum
[95 antibaserep] @:decompnum
{ a f : a [merge f!] map } @:with
{ arr mask :
  arr { e i :
    [e] [] mask i get 1 and ifelse
  } map { e : e nil = } reject
} @:keep

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

[0 get] @:first

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
`);

makeAlias("prod", "\u220f");

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
    locale.set(opName, (vectorized ? vectorTyped : typedFunc)([
        [newTypeArr, resultFunc],
        [newTypeArr.map(() => ANY), function(...args){
            this.stack = this.stack.concat(args);
            pfunc.bind(this)();
        }],
    ], arity));
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
    else
        return ent;
}

// integrates a class into stacked
const integrate = (klass, merge = false, ...methods) => {
	let props = Object.getOwnPropertyNames(klass.prototype);
	ops.set(klass.name, function(){
		let args = this.stack.splice(-klass.length);
		this.stack.push(new klass(...args));
	});
    let kname = klass.name;
    vars.set("type" + kname, klass);
    klass.toString = function(){ return "[type " + kname + "]"; }
	let kdispname = kname;
	for(let nme of methods){
		// so that scoping of `nme` persists
		let prop = nme;
		let dprop = prop;
		if(["constructor", "toString"].indexOf(prop) >= 0
            || prop.constructor === Symbol) continue;
		if(ops.has(prop)){
			// todo: overload
			console.warn("name conflict under `" + dprop + "` of `" + kname + "`; renaming to `" + kdispname + dprop + "`");
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
		if(["constructor", "toString", "length"].indexOf(prop) >= 0) continue;
        let arity = klass.prototype[prop].length;
        let body = function(){
            let instance = this.stack.pop();
            assureTyped(instance, klass);
            let args = this.stack.splice(-arity);
            this.stack.push(sanatize(instance[prop](...args)));
        };
		if(ops.has(prop) && !merge){
            console.warn("name conflict under `" + dprop + "` of `" + kname + "`; renaming to `" + kdispname + dprop + "`");
            dprop = kdispname + dprop;
            ops.set(dprop, body);
		} else if(ops.has(prop) && merge){
            // construct type
            let types = [...Array(arity)];
            types.fill(ANY);
            types.push(klass);
            permute(types).forEach(typeArr => {
                extendTyped(prop, typeArr, (...a) => {
                    let inst = a.find(e => e instanceof klass);
                    if(!inst){
                        error("no instance of `" + kname + "` found in arguments (`" + prop + "`)")
                    }
                    a.splice(a.indexOf(inst), 1);
                    return sanatize(inst[prop](...a));
                }, arity + 1, false); 
            });
        } else {
            ops.set(dprop, body);
        }
	}
	let staticProps = Object.getOwnPropertyNames(klass);
	for(let nme of staticProps){
		let staticProp = nme;
		if(["name", "length", "prototype", "toString"].indexOf(staticProp) >= 0) continue;
		let dstaticProp = staticProp;
		if(ops.has(staticProp)){
			// todo: overload
			console.warn("name conflict under static `" + dstaticProp + "` of `" + kname + "`; renaming to `" + kdispname + dstaticProp + "`");
			dstaticProp = kdispname + dstaticProp; 
		}
        if(klass[staticProp] instanceof Function){
            ops.set(dstaticProp, function(){
                let args = this.stack.splice(-klass[staticProp].length);
                this.stack.push(sanatize(klass[staticProp](...args)));
            });
        } else {
            vars.set(staticProp, klass[staticProp]);
        }
	}
}

integrate(Element, false, "atomic", "sym", "name", "weight");

Element.ptable.forEach((v, k) => {
	vars.set("E" + k, v);
});

// color
Color.prototype["-"] = Color.prototype.sub;
Color.prototype["="] = Color.prototype.equal;
integrate(Color, true);

// ["white", "silver", "gray", "grey", "black", "red", "maroon", "yellow", "olive",
 // "lime", "green", "aqua", "teal", "blue", "navy", "fuchsia", "purple"].forEach(c =>
     // vars.set(c, Color.colorFromName(c))
// );

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
        assureTyped(c, CharString);
        return new CharString([...this, ...c]);
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
    
    toString(){
        return pp(this.members);
    }
}

CharString.prototype[VECTORABLE] = true;

aliasPrototype(CharString, "+", "add");

integrate(CharString, true);

makeAlias("CharString", "CS");

let hw = new CharString("hello, world!");

if(typeof module !== "undefined"){
    module.exports = exports.default = stacked;
}