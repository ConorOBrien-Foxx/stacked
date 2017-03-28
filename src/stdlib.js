var isNode = typeof require !== "undefined";

let produceOps = (Stacked, StackedFunc, StackedPseudoType, Func, Lambda, world) => {
    const FUNC_LIKE = (e) => e instanceof Lambda || e instanceof Func;
    const STP = (...args) => new StackedPseudoType(...args);
    const STP_HAS = (prop) => STP(e => isDefined(e[prop]), "{has#" + prop.toString() + "}");
    const ANY = STP(() => true, "{Any}");
    const ITERABLE = STP((e) => isDefined(e[Symbol.iterator]), "{Iterable}");
    const REFORMABLE = STP_HAS(REFORM);
    const INTEGER = STP(e => StackedFunc.ofUnaryType(Decimal)(e) && e.floor().eq(e), "{Integer}");
    const STP_FUNC_LIKE = STP(FUNC_LIKE, "{Func-like}");
    const STP_EXECABLE = STP((e) => isDefined(e.exec), "{Executable}");
    return new Map([
        // todo: fix with charstring
        ["+", new StackedFunc([
            [[Decimal, Decimal], (a, b) => a.add(b)],
            [[String, String], (a, b) => a + b],
            [[Func, Func], (f, g) => Func.of(
                function(inst){
                    [f, g].forEach(e => {
                        inst.stack.push(e);
                        ops.get("!").exec(inst);
                    });
                },
                (f.body + " " + g.body).replace(/ +/g, " ")
            )],
        ], 2, { vectorize: true, name: "+" })],
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
            [[String, String], (s, t) => s.replace(new StRegex(t, "g"), "")],
        ], 2, { vectorize: true })],
        ["/", new StackedFunc([
            [[Decimal, Decimal], (a, b) => a.div(b)],
            [[String, String], (s, t) => s.replace(RegExp.of(t, "g"), "")],
            [[STP_FUNC_LIKE, Decimal], (f, d) => {
                f.arity = +d;
                return f;
            }],
        ], 2, { vectorize: true })],
        ["^", new StackedFunc([
            [[Decimal, Decimal], (a, b) => a.pow(b)],
        ], 2, { vectorize: true })],
        ["*", new StackedFunc([
            [[Decimal, Decimal],       (a, b) => a.mul(b)],
            [[Decimal, String],        (a, b) => b.repeat(+a)],
            [[String, Decimal],        (a, b) => a.repeat(+b)],
            [[Decimal, String],        (b, a) => a.repeat(+b)],
            [[STP_FUNC_LIKE, Decimal], function(f, b){
                let c = Decimal(b);
                while(c.gt(0)){
                    c = c.sub(1);
                    f.exec(this);
                }
            }],
            [[Decimal, STP_FUNC_LIKE], function(b, f){
                this.stack.push(f, b);
                ops.get("*").exec(this);
            }],
        ], 2, { vectorize: true })],
        ["rep", new StackedFunc([
            [[ANY, Decimal], (a, b) => [...Array(+b)].fill(a)],
        ], 2, { vectorize: "right" })],
        [",", new StackedFunc((a, b) => flatten([a, b], 1), 2, { untyped: true })],
        ["pair", new StackedFunc(
            (a, b) => [a, b]
        , 2, { untyped: true })],
        ["%", new StackedFunc([
            [[String, String],
                (a, b) => a.replace(RegExp((a.match(new StRegex(b, "g")) || [])
                                .map(RegExp.escape)
                                .join("|"), "g"), "")],
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
        // generators are pretty bad in stacked...
        // takes a condition P and a generation function F. Instead of iterating from
        // x = 0... untll P(x), this iterates from x = f(0), f(1), ... until P(f(x)).
        // yields a function that does this.
        // ["seqnth", new StackedFunc([
            // [[STP_FUNC_LIKE, STP_FUNC_LIKE], function(condition, gen){
                // Func.of();
            // }],
        // ], 2)],
        ["prime", new StackedFunc([
            [[Decimal], isPrime]
        ], 1, { vectorize: true })],
        ["get", new StackedFunc(getFrom, 2, { vectorize: "right", untyped: true })],
        ["stack", function(){
            this.stack.push(clone(this.stack));
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
            [[INTEGER], (a) => factorial(a)],
            [[String],  function(a){
                let frepl = (total, fname) => {
                    let oldStack = clone(this.stack);
                    // let append = "";
                    // if(/(?:\s|@)$/.test(fname)){
                        // append = fname[fname.length - 1];
                        // fname = fname.slice(0, -1);
                    // }
                    this.execOp(this.ops.get(fname));
                    let res = this.stack.pop();
                    this.stack = oldStack;
                    return res;//+ append;
                }
                return a.replace(/%(\w+)/g, (total, varname) => this.getVar(varname))
                        .replace(/%\{(\w+)}/g, (total, varname) => this.getVar(varname))
                        .replace(/@(\w+|.+?(?=\s|$|@))/g, frepl)
                        .replace(/@\{(.+)\}/g, frepl);
            }],
            [[STP_FUNC_LIKE], function(f){
                f.exec(this);
            }],
            [[STP_EXECABLE], function(f){
                f.exec(this);
            }],
        ], 1, { vectorize: true })],
        // volatile
        ["nexec", function(){
            console.warn(pp(this.stack));
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
        ["#>", new StackedFunc([
            [[Decimal, Decimal], (a, b) => range(a, a.add(b.add(1)))],
        ], 2, { vectorize: true })],
        [":>", new StackedFunc([
            [[Decimal], (a) => range(Decimal(0), a)],
        ], 1, { vectorize: true })],
        ["~>", new StackedFunc([
            [[Decimal], (a) => range(Decimal(1), a.add(1))],
        ], 1, { vectorize: true })],
        ["~", new StackedFunc([
            [[Decimal], a => a.floor().add(1).neg()],
            [[Func], function(f){
                let k = new Func(f);
                k.toString = function(){
                    return f.toString() + "~";
                }
                k.exec = function(inst){
                    inst.stack.reverse();
                    f.exec(inst);
                }
                k.arity = f.arity;
                k.scope = f.scope;
                return k;
            }],
        ], 1, { vectorize: true })],
        ["neg", new StackedFunc([
            [[Decimal], a => a.neg()],
        ], 1, { vectorize: true })],
        ["join", new StackedFunc([
            [[ITERABLE, String], (a, b) => [...a].join(b)],
        ], 2)],
        ["split", new StackedFunc([
            [[String, String], (a, b) => a.split(b)],
        ], 2)],
        ["rsplit", new StackedFunc([
            [[String, String], (a, b) => a.split(new StRegex(b))],
        ], 2)],
        ["oneach", new StackedFunc([
            [[STP_FUNC_LIKE], (f) => {
                let k = new Func(f + "oneach");
                k.toString = function(){
                    return f.toString() + " oneach";
                }
                // dirty hack, todo: fix it
                // dear past me: in your dreams.
                // dear past me's: you guys are so immature
                // dear all of my past me's: I've fixed it. HAHA.
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
            }],
        ], 1)],
        ["each", function(){
            ops.get("oneach").exec(this);
            ops.get("!").exec(this);
        }],
        ["match", new StackedFunc([
            [[String, String],
                (str, target) => str.match(new StRegex(target, "g")) || [],
            ],
        ], 2, { vectorize: true })],
        ["frepl", new StackedFunc([
            [[String, String, String, String],
                (orig, target, sub, flags) =>
                    orig.replace(new StRegex(target, flags), sub)],
            [[String, String, STP_FUNC_LIKE, String], function(orig, target, f, flags){
                return orig.replace(new StRegex(target, flags), (...a) => f.sanatized(this, ...a));
            }],
        ], 4)],
        ["recrepl", new StackedFunc([
            [[String, String, String], 
                (orig, target, sub) =>
                    recursiveRepl(orig, new StRegex(target, "g"), sub)],
            [[String, String, STP_FUNC_LIKE], function(orig, target, sub){
                return recursiveRepl(orig, new StRegex(target, "g"), (...a) => sub.sanatized(this, ...a));
            }],
        ], 3)],
        ["frecrepl", new StackedFunc([
            [[String, String, String, String], 
                (orig, target, sub, flags) =>
                    recursiveRepl(orig, new StRegex(target, flags), sub)],
            [[String, String, STP_FUNC_LIKE, String], function(orig, target, sub, flags){
                return recursiveRepl(orig, new StRegex(target, flags), (...a) => sub.sanatized(this, ...a));
            }],
        ], 4)],
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
        ["dup", function(){
            if(this.stack.length == 0)
                error("(in `" + (this.displayName || "dup") + "`) popping from an empty stack");
            let top = this.stack.pop();
            this.stack.push(top, top);
        }],
        ["swap", function(){
            if(this.stack.length < 2)
                error("(in `" + (this.displayName || "swap") + "`) popping from an empty stack");
            let top = this.stack.pop();
            let secondTop = this.stack.pop();
            this.stack.push(top, secondTop);
        }],
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
        ["exec", new StackedFunc([
            [[STP_EXECABLE], function(f){
                f.exec(this);
            }]
        ], 1)],
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
        ["loop", new StackedFunc([
            [[STP_FUNC_LIKE], function(f){
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
                        this.stack.push(k);
                        if(falsey(k)){
                            break;
                        }
                    }
                }
            }],
        ], 1)],
        ["until", new StackedFunc([
            [[ANY, STP_FUNC_LIKE, STP_FUNC_LIKE], function(ent, effect, cond){
                let r = ent;
                while(true){
                    if(truthy(cond.overWith(this, r))){
                        this.stack.push(r);
                        break;
                    }
                    r = effect.overWith(this, r);
                }
            }],
        ], 3)],
        ["while", function(){
            let cond = this.stack.pop();
            let effect = this.stack.pop();
            while(true){
                cond.exec(this);
                let e = this.stack.pop();
                if(falsey(e)) break;
                effect.exec(this);
            }
        }],
        ["whilst", function(){
            let cond = this.stack.pop();
            let effect = this.stack.pop();
            while(true){
                effect.exec(this);
                cond.exec(this);
                let e = this.stack.pop();
                if(falsey(e)) break;
            }
        }],
        ["joingrid", new StackedFunc([
            [[Array], joinGrid],
        ], 1)],
        ["togrid", new StackedFunc([
            [[String], gridify],
        ], 1)],
        ["ungrid", new StackedFunc([
            [[Array], ungridify],
        ], 1)],
        ["DEBUG", function(){
            console.log(dispJS(this.stack));
            console.log(this.stack);
        }],
        // todo: take from a textarea, maybe
        // or make another command for that
        ["input", new StackedFunc(
            () => parseNum(prompt())
        , 0, { untyped: true })],
        ["prompt", StackedFunc.zero(prompt)],
        ["INPUT",  new StackedFunc(
            ((e) => parseNum(prompt(e)))
        , 1, { untyped: true })],
        ["PROMPT",  new StackedFunc(
            ((e) => prompt(e))
        , 1, { untyped: true })],
        ["for", function(){
            let [f, min, max] = this.stack.splice(-3);
            // console.log(f, min, max);
            assureTyped(f,   Lambda);
            assureTyped(min, Decimal);
            assureTyped(max, Decimal);
            //todo:fix with slow
            //nvm, slow is evil
            for(var c = min; c.lte(max); c = c.add(1)){
                this.stack.push(c);
                f.exec(this);
            }
        }],
        ["agenda", new StackedFunc([
            [[Array, STP_FUNC_LIKE], function(agenda, agendaCond){
                let k = new Func(agenda + " agenda");
                k.toString = function(){
                    return "#(" + disp(agenda) + " " + disp(agendaCond) + " agenda)";
                }
                k.arity = agendaCond.arity;
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
                return k;
            }]
        ], 2)],
        ["size", new StackedFunc([
            [[Decimal], a => new Decimal(a.toFixed().length)],
            [[String], s => new Decimal([...s].length)],
            [[STP_HAS("length")], a => new Decimal(a.length)]
        ], 1)],
        // todo: if/unless fix
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
        ["unless", new StackedFunc(function(f, ent){
            if(falsey(ent))
                if(f.exec)
                    f.exec(this);
                else
                    this.stack.push(f);
        }, 2, { untyped: true })],
        ["ifelse", new StackedFunc([
            [[ANY, ANY, ANY], function(f1, f2, ent){
                let f = truthy(ent) ? f1 : f2;
                if(f.exec)
                    f.exec(this);
                else
                    this.stack.push(f);
            }],
        ], 3)],
        ["slen", function(){
            this.stack.push(Decimal(this.stack.length));
        }],
        ["flush", function(){
            while(this.stack.length) this.stack.pop();
        }],
        ["map", new StackedFunc([
            [[Array, STP_FUNC_LIKE], function(arr, f){
                if(f instanceof Lambda){
                    return arr.map((e, i) => f.overWith(this, e, Decimal(i)));
                } else if(f instanceof Func){
                    return arr.map(e => {
                        let t = new Stacked("", this.options);
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
            ops.get("map").exec(this);
            this.stack = this.stack.pop();
        }],
        ["sfold", function(){
            let f = this.stack.pop();
            if(this.stack.length === 1) return;
            this.stack = [this.stack.reduce((p, c) => {
                let t = new Stacked("", this.options);
                t.stack.push(p, c);
                f.exec(t);
                return t.stack.pop();
            })].reject(falsey);
        }],
        ["sfoldr", function(){
            let f = this.stack.pop();
            if(this.stack.length === 1) return;
            this.stack = [this.stack.reverse().reduce((p, c) => {
                let t = new Stacked("", this.options);
                t.stack.push(p, c);
                f.exec(t);
                return t.stack.pop();
            })].reject(falsey);
        }],
        ["apply", function(){
            let [arr, f] = this.stack.splice(-2);
            let isString = typeof arr === "string";
            let inst = new Stacked("", this.options);
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
        ["rand", new StackedFunc([
            [[Decimal], (a) => a == 0 ? Decimal.random() : a.mul(Decimal.random()).floor()],
        ], 1, { vectorize: true })],
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
                (arr, len) => arr.padStart(len, isString(flatten(arr)[0]) ? " " : Decimal(0))],
        ], 2, { vectorize: "right" })],
        ["insert", new StackedFunc(function(func){
            let k = new Func(func+"insert");
            k.exec = function(inst){
                if(!inst.stack.length)
                    error("popping from an empty stack");
                let ent = inst.stack.pop();
                if(!(ent instanceof Array))
                    error(typeName(ent.constructor) + " is not insertable");
                
                inst.stack.push(ent.length <= 1 ? ent[0] : ent.reduce((p, c) => func.overWith(inst, p, c)));
            }
            return k;
        }, 1, { untyped: true })],
        ["ffix", new StackedFunc([
            [[STP_FUNC_LIKE], function(f){
                f.scope = clone(this.vars);
                return f;
            }],
        ], 1, { vectorize: true })],
        ["and", new StackedFunc([
            [[Decimal, Decimal], (a, b) => new Decimal(+(truthy(a) && truthy(b)))],
        ], 2, { vectorize: true })],
        ["or", new StackedFunc([
            [[Decimal, Decimal], (a, b) => new Decimal(+(truthy(a) || truthy(b)))],
        ], 2, { vectorize: true })],
        ["xor", new StackedFunc([
            [[Decimal, Decimal], (a, b) => new Decimal(+(truthy(a) ^ truthy(b)))],
        ], 2, { vectorize: true })],
        ["BAND", new StackedFunc([
            [[Decimal, Decimal], (a, b) => new Decimal(+a & +b)],
        ], 2, { vectorize: true })],
        ["BOR", new StackedFunc([
            [[Decimal, Decimal], (a, b) => new Decimal(+a | +b)],
        ], 2, { vectorize: true })],
        ["BXOR", new StackedFunc([
            [[Decimal, Decimal], (a, b) => new Decimal(+a ^ +b)],
        ], 2, { vectorize: true })],
        ["table", new StackedFunc([
            [[Object, Object, STP_FUNC_LIKE],
                function(a, b, f){
                    return table(a, b, (...args) => f.overWith(this, ...args));
                }
            ],
        ], 3)],
        ["filter", new StackedFunc([
            [[STP_HAS("filter"), STP_FUNC_LIKE], function(a, f){
                return a.filter((...args) => {
                    let r = f.overWith(
                        this,
                        ...(
                            isDefined(f.arity) && f.arity !== null
                                ? args.map(world.sanatize).slice(0, f.arity + 1)
                                : args.map(world.sanatize)
                        )
                    );
                    // console.log(disp(r));
                    return truthy(r);
                });
            }],
        ], 2)],
        ["reject", new StackedFunc([
            [[STP_HAS("filter"), STP_FUNC_LIKE], function(a, f){
                return a.filter((...args) => {
                    let r = f.overWith(
                        this,
                        ...(
                            isDefined(f.arity) && f.arity !== null
                                ? args.map(world.sanatize).slice(0, f.arity + 1)
                                : args.map(world.sanatize)
                        )
                    );
                    // console.log(disp(r));
                    return falsey(r);
                });
            }],
        ], 2)],
        ["date", new StackedFunc([
            [[String], (fmt) => formatDate(new Date, fmt)],
        ], 1, { vectorize: true })],
        ["plusminus", new StackedFunc([
            [[Decimal, Decimal], (a, b) => [a.add(b), a.sub(b)]],
        ], 2, { vectorize: true })],
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
            let f = (...args) => fa.overWith(this, ...args);
            let g = (a, b) => ga.overWith(this, a, b);
            let h = (...args) => ha.overWith(this, ...args);
            let arity = 1;
            if(isDefined(fa.arity) && isDefined(ha.arity)){
                if(fa.arity !== ha.arity && fa.arity !== null && ha.arity !== null)
                    error("(in `fork`) `" + fa + "` and `" + ha + "` have different arities");
                arity = Math.max(fa.arity, ha.arity);
            }
            let k = new Func("");
            k.exec = function(inst){
                if(inst.stack.length < arity)
                    error("(in `" + k + "`) popping from an empty stack");
                let args = arity ? inst.stack.splice(-arity) : [];  
                let ltine = f(...args);
                let rtine = h(...args);
                let res = g(ltine, rtine);
                inst.stack.push(res);
            }
            k.toString = function(){
                return arr.toString();
            }
            k.arity = arity;
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
            let arity = g.arity;
            k.exec = function(inst){
                let arg = inst.stack.pop();
                let res = g(arg, f(arg));
                inst.stack.push(res);
            }
            k.toString = function(){
                return arr.toString();
            }
            k.arity = arity;
            this.stack.push(k);
        }],
        ["nfloor", new StackedFunc([
            [[Decimal, Decimal], (n, p) => {
                let pow10 = Decimal(10).pow(p);
                return n.times(pow10).floor().div(pow10);
            }]
        ], 2, { vectorize: true })],
        ["nceil", new StackedFunc([
            [[Decimal, Decimal], (n, p) => {
                let pow10 = Decimal(10).pow(p);
                return n.times(pow10).ceil().div(pow10);
            }]
        ], 2, { vectorize: true })],
        ["nround", new StackedFunc([
            [[Decimal, Decimal], (n, p) => {
                let pow10 = Decimal(10).pow(p);
                return n.times(pow10).round().div(pow10);
            }]
        ], 2, { vectorize: true })],
        ["todec", new StackedFunc([
            [[Decimal], x => x],
            [[String], parseNum],
            [[Array], t => parseNum(flatten(t).join(""))],
        ], 1)],
        // ["todec", function(){
            // let t = this.stack.pop();
            // let res;
            // if(t.constructor === Decimal){
                // res = t;
            // } else if(t.constructor === String){
                // res = parseNum(t);
            // } else if(t.constructor === Array){
                // res = parseNum(flatten(t).join(""));
            // } else {
                // error("invalid type `" + t.constructor.name + "`");
            // }
            // this.stack.push(res);
        // }],
        ["toarr", new StackedFunc([
            [[ITERABLE], (e) => [...e]],
        ], 1)],
        ["tofunc", new StackedFunc(
            (s) => new Func(s)
        , 1, { untyped: true })],
        ["rot", new StackedFunc([
            [[String, Decimal], rotate],
            [[ITERABLE, Decimal], (a, n) => rotate([...a], n)],
        ], 2)],
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
        ["hcat", new StackedFunc([
            [[Array, Array], hcat],
            [[String, String], hcat],
        ], 2)],
        ["chars", new StackedFunc([
            [[String], (e) => [...e]],
        ], 1)],
        ["chunk", new StackedFunc([
            [[String, Decimal], (a, b) => chunk([...a], b).map(e => e.join(""))],
            [[REFORMABLE, Decimal], (a, b) => a[REFORM](chunk([...a], b))],
        ], 2, { vectorize: "right" })],
        ["chunkby", new StackedFunc([
            [[ITERABLE, STP_FUNC_LIKE], function(a, f){
                return chunkBy(a, (...args) => world.unsanatize(f.overWith(this, ...args.map(world.sanatize))));
            }],
        ], 2)],
        ["runsof", new StackedFunc([
            [[Array, STP_FUNC_LIKE], (a, f) => runsOf(a, (x, y) => f.over(x, y))],
            [[String, STP_FUNC_LIKE], (a, f) => runsOf(a, (x, y) => f.over(x, y))],
        ], 2)],
        ["eval", function(){
            let t = this.stack.pop();
            new Func(t).exec(this, 2);
            // this.stack.push(new Func(t));
            // let k = ops.get("!").exec(this);
            // if(k instanceof Function) k();
        }],
        // todo: add error handling via functions
        ["evalp", new StackedFunc([
            [[String], function(s){
                let k = stacked.silentError;
                stacked.silentError = true;
                try {
                    let inst = stacked(s);
                    inst.vars = clone(this.vars);
                    inst.ops = clone(this.ops);
                    stacked.silentError = k;
                    return inst.stack;
                } catch(e){
                    stacked.silentError = k;
                    return new Nil;
                }
            }],
        ], 1)],
        ["perm", new StackedFunc([
            [[Array], permute],
            [[String], e => permute([...e]).map(e => e.join(""))],
        ], 1)],
        ["powerset", new StackedFunc([
            [[Array], powerSet],
            [[String], e => powerSet(e).map(e => e.join(""))],
        ], 1)],
        // possibly evil
        ["setprop", new StackedFunc(
            (a, b, c) => (a[b] = c, a)
        , 3, { untyped: true })],
        ["clamp", new StackedFunc([
            [[Decimal, Decimal, Decimal], (a, min, max) => a.add(max).mod(min).sub(min)],
        ], 3)],
        ["animate", new StackedFunc([
            [[STP_FUNC_LIKE, Decimal, Decimal, Decimal], function(f, min, max, delay){
                let msDelay = +delay.mul(1000);
                let rec = (i) => {
                    f.overWith(this, i);
                    if(i.lt(max))
                        setTimeout(rec, msDelay, i.add(1));
                }
                rec(min);
            }]
        ], 4)],
        ["animation", new StackedFunc([
            [[STP_FUNC_LIKE, Decimal], function(f, d){
                let n = +d.mul(1000);
                f.exec(this);
                let i = setInterval(() => f.exec(this), n);
                return typeof i === "number" ? new Decimal(i) : i;
            }]
        ], 2)],
        ["stopani", new StackedFunc([
            [[Decimal], function(d){
                clearInterval(+d);
            }],
            [[Timeout], function(d){
                clearInterval(d);
            }],
        ], 1)],
        // possibly evil
        ["typeof", new StackedFunc(
            (a) => a.constructor
        , 1, { untyped: true })],
        ["timeop", function(){
            let f = this.stack.pop();
            let start = +new Date;
            f.exec(this);
            let end = +new Date;
            this.stack.push(Decimal(end - start).div(1000));
        }],
        ["format", new StackedFunc([
            [[String, Array], (s, ar) => format(s, ...ar)]
        ], 2)],
        // ["grade", new StackedFunc([
            // [[Array], id],
        // ], 1)],
        ["sorted", new StackedFunc([
            [[REFORMABLE], (a) => a[REFORM](betterSort([...a]))],
            [[Array], betterSort],
        ], 1)],
        ["sortby", new StackedFunc([
            [[REFORMABLE, STP_FUNC_LIKE], function(a, f){
                return a[REFORM]([...a].sort((l, r) => f.overWith(this, l, r)));
            }],
            [[Array, STP_FUNC_LIKE], function(a, f){
                return a.sort((l, r) => f.overWith(this, l, r));
            }],
        ], 2)],
        ["transpose", new StackedFunc([
            [[Array], transpose],
        ], 1)],
        ["prefix", new StackedFunc([
            [[STP_HAS("slice"), Decimal], (a, d) => prefix(a, d)],
        ], 2, { vectorize: "right" })],
        ["keys", new StackedFunc([
            [[STP_HAS("keys")], (a) => world.sanatize([...a.keys()])]
        ], 1)],
        ["values", new StackedFunc([
            [[STP_HAS("values")], (a) => world.sanatize([...a.values()])]
        ], 1)],
        ["lower", new StackedFunc([
            [[String], a => a.toLowerCase()]
        ], 1, { vectorize: true })],
        ["upper", new StackedFunc([
            [[String], a => a.toUpperCase()]
        ], 1, { vectorize: true })],
        ["wrap", new StackedFunc(
            (a) => [a]
        , 1, { untyped: true })],
        ["flat", new StackedFunc([
            [[Array], flatten],
            [[ANY], e => e]
        ], 1)],
        ["enflat", new StackedFunc([
            [[Array, Decimal], (a, b) => flatten(a, +b)],
            [[ANY, Decimal], e => e]
        ], 2, { vectorize: "right" })],
        ["cellmap", new StackedFunc([
            [[Array, STP_FUNC_LIKE], function(a, f){ return cellMap(a, (...args) => f.overWith(this, ...args.map(world.sanatize))) }],
        ], 2)],
        ["deepmap", new StackedFunc([
            [[Array, STP_FUNC_LIKE], function(a, f){ return deepMap(a, (...args) => f.overWith(this, ...args.map(world.sanatize))) }],
        ], 2)],
        ["has", new StackedFunc([
            [[String, ANY],    (a, b) => world.sanatize(!!a.find(e => equal(e, b)))],
            [[ITERABLE, ANY],  (a, b) => world.sanatize(!![...a].find(e => equal(e, b)))],
        ], 2, { vectorize: "right" })],
        ["intersection", new StackedFunc([
            [[ITERABLE, ITERABLE], intersection],
        ], 2)],
        ["union", new StackedFunc([
            [[ITERABLE, ITERABLE], union],
        ], 2)],
        ["partition", new StackedFunc([
            [[ITERABLE, ITERABLE], partition],
        ], 2)],
        ["vrep", new StackedFunc([
            [[String, Decimal], verticalRepeat],
        ], 2)],
        ["hrep", new StackedFunc([
            [[String, Decimal], horizontalRepeat]
        ], 2)],
        ["uniq", new StackedFunc([
            [[String], s => unique(s).join("")],
            [[ITERABLE], unique],
        ], 1)],
        ["periodloop", new StackedFunc([
            [[ANY, STP_FUNC_LIKE], function(o, f){
                return periodLoop(o, (...a) => f.sanatized(this, ...a)).result;
            }],
        ], 2)],
        ["periodsteps", new StackedFunc([
            [[ANY, STP_FUNC_LIKE], function(o, f){
                return periodLoop(o, (...a) => f.sanatized(this, ...a)).steps;
            }],
        ], 2)],
        ["jsonparse", new StackedFunc([
            [[String], JSON.parse],
        ], 1)],
        ["jsonstr", new StackedFunc([
            [[ANY], JSON.stringify],
        ], 1)],
        ["fixshape", new StackedFunc([
            [[Array], e => world.sanatize(fixShape(e))],
        ], 1)],
        ["nfixshape", new StackedFunc([
            [[Array, ANY], (e, x) => world.sanatize(fixShape(e, x))],
        ], 2)],
        ["compose", new StackedFunc([
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
        ["alert", new StackedFunc(
            e => alert(e)
        , 1, { untyped: true })],
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
                        this.vars = clone(vars);
                        this.ops = clone(ops);
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
            [[String, String], (a, b) => new Decimal(+new StRegex(b).test(a))],
        ], 2)],
        ["takewhile", new StackedFunc([
            [[REFORMABLE, STP_FUNC_LIKE], function(a, b){
                return world.sanatize(a[REFORM](takeWhile([...a], (...e) => {
                    return world.unsanatize(b.overWith(this, world.sanatize(e)));
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
            [[String], (s) => world.sanatize(bytes(s))],
        ], 1)],
        ["fromshape", new StackedFunc([
            [[Array, ANY], (shpe, f) => {
                return deepMap(createArray(...shpe.map(e => +e)), () => f);
            }],
        ], 2)],
        ["ofshape", new StackedFunc([
            [[Array], (shpe) => {
                return createArray(...shpe.map(e => +e));
            }],
        ], 1)],
        ["shapef", new StackedFunc([
            [[Array, STP_FUNC_LIKE], function(shpe, f){
                return deepMap(
                    createArray(
                        ...shpe.map(e => +e)
                    ),
                    (a, e, i) => f.sanatized(this, i)
                );
            }],
        ], 2)],
        ["eye", new StackedFunc([
            [[INTEGER], eye],
        ], 1, { vectorize: true })],
        ["program", new StackedFunc([
            [[], function(){ return this.raw; }],
        ], 0)],
        ["shape", new StackedFunc([
            [[ANY], (a) => world.sanatize(shape(a))],
        ], 1)],
        ["arrparse", new StackedFunc([
            [[String], parseArr],
        ], 1, { vectorize: true })],
        ["trim", new StackedFunc([
            [[String], (e) => e.trim()],
        ], 1, { vectorize: true })],
        ["rtrim", new StackedFunc([
            [[String], (e) => e.trimRight()],
        ], 1, { vectorize: true })],
        ["ltrim", new StackedFunc([
            [[String], (e) => e.trimLeft()],
        ], 1, { vectorize: true })],
        // ["?", new StackedFunc([
            // [[STP_FUNC_LIKE], function(f){
                // let k = clone(f);
                // k.modify = false;
                // k.toString = function(){
                    // return f.toString() + "?";
                // }
                // return k;
            // }],
        // ], 1, { vectorize: true })],
        ["isa", new StackedFunc([
            [[ANY, ANY], (inst, type) => new Decimal(+StackedFunc.ofUnaryType(type)(inst))],
        ], 2)],
        /*
        (
          typeString ['' split]
          typeArray  []
          
        */
        ["typed", new StackedFunc([
            [[Array], function(arr){
                if(arr.length % 2){
                    let tmp = arr.pop();
                    arr.push(ANY, tmp);
                }
                let typeMap = chunk(arr, 2);
                let [types, fs] = transpose(typeMap);
                typeMap = typeMap.map(e => {
                    let [a, b] = e;
                    if(!Array.isArray(a)) a = [a];
                    let nextb = function(...args){
                        return b.overWith(this, ...args);
                    }
                    return [a, nextb];
                });
                let arity = typeMap[0][0].length;
                let _stkfunc = new StackedFunc(typeMap, arity);
                let k = new Func("[unprintable typed func]");
                k.exec = function(inst){
                    // if(arity > inst.stack.length)
                        // error("(in `typed`) popping from an empty stack");
                    // let args = arity == 0 ? [] : inst.stack.splice(-arity);
                    // let ind = types.findIndex(e => StackedFunc.match(e, ...args));
                    // if(ind == -1)
                        // error
                    _stkfunc.exec(inst);
                }
                k.arity = arity;
                return k;
            }],
        ], 1)],
        
        ["pop", new StackedFunc([
            [[Array], (a) => a.pop()],
        ], 1)],
        ["shift", new StackedFunc([
            [[Array], (a) => a.shift()],
        ], 1)],
        ["push", new StackedFunc([
            [[Array, ANY], (a, b) => (a.push(b), a)],
        ], 2)],
        ["rescape", new StackedFunc([
            [[String], RegExp.escape],
        ], 1)],
        ["tomap", new StackedFunc([
            [[Array], (a) => new Map(a)],
        ], 1)],
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
}

let essential = `
[2 tobase] @:bits
[2 antibase] @:unbits
[2 tobaserep] @:bin
[2 antibaserep] @:unbin
[10 tobase] @:digits
[10 antibase] @:undigits
[16 tobaserep] @:tohex
[16 antibaserep] @:unhex

{ x y :
  (x y) show $size map MIN @min_len
  (x y) [min_len take] map tr
} @:zip

{ f :
  [zip f #/ map]
} @:zipwith
[sgroup tail merge] @:isolate
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
[0 >] 1/ @:ispos
[0 <] 1/ @:isneg
[0 >=] 1/ @:isnneg
[0 <=] 1/ @:isnpos
[0 eq] 1/ @:iszero

(* todo: expand *)
[ fixshape ] @:FIX

[#/ !] @:doinsert

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

[: *] 1/ @:square

{ f : {! n f ! n =} } @:invariant
`;

let k = `
(* degrees to radians *)
[180 / pi *] 1/ @:torad
[pi / 180 *] 1/ @:todeg
[sign 1 +] 1/ @:skewsign
[map flat] 2/ @:flatmap
[$rev map] @:reveach
['txt' download] @:savetxt
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
{ x : x } @:id
{ . x : x } @:sid
{ . . x : x } @:tid
[: floor -] @:fpart
[: fpart -] @:ipart
$(fpart , ipart) fork @:fipart
$(ipart , fpart) fork @:ifpart
[2 /] 1/ @:halve
[2 *] 1/ @:double
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
[2 * 1 -] 1/ @:tmo
[2 * 1 +] 1/ @:tpo
[100 *] 1/ @:hundred
[1000 *] 1/ @:thousand
[1e6 *] 1/ @:million
[1e9 *] 1/ @:billion

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
  x y / floor @c1
  (c1 x c1 -)
} @:cusp

{ f p : [f 0 rand p < if] } @:randomly

{ a i :
  [a i pop # i rget] [a] i size ifelse
} @:rget

{ a f : a ... f a size / ! } @:spread

[stack $disp map @.] @:SOUT
`

produceOps.boot = k;
produceOps.essential = essential;

if(isNode)
    module.exports = exports.defualt = produceOps;