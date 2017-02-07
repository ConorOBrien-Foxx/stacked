var isNode = typeof require !== "undefined";

if(isNode){
    var Decimal = require("./decimal.js");
    Complex = require("./complex.js");
    utf8 = require("./utf8.js");
    cls = require("clear");
}

const parseNum = function(str){
    str = str.replace(/\s/g, "");
    if(str.has("i")){
        if(str.endsWith("i")){
            return new Complex(Decimal(0), parseNum(str.slice(0, -1)));
        }
        let parts = str.split("i").map(parseNum);
        return new Complex(...parts);
    } else if(str.has("r")){
        if(str.endsWith("r")){
            return parseNum(str.slice(0, -1));
            // todo: add Rational
            // return new Rational(parseNum(str.slice(0, -1)), Decimal(1));
        }
        let parts = str.split("r").map(parseNum);
        // return new Rational(...parts);
        return parts[0].div(parts[1]);  
    }
    str = str.replace(/(.+)n$/, "-$1").replace(/^_/, "-");
    try {
        return new Decimal(str);
    } catch(e){
        error("invalid number `" + str + "`");
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

var error;
error = error || ((e) => { throw new Error(e) });

class Nil {
    constructor(){};
    
    toString(){
        return "nil";
    }
}

const VECTORABLE = Symbol("VECTORABLE");
const REFORM = Symbol("REFORM");
const EQUAL = Symbol("EQUAL");

const isDefined = (a) => typeof a !== "undefined";
const defined = (...a) => a.find(isDefined);

String.prototype[REFORM] = function(s){
    return s.constructor === String ? s : s.join ? s.join("") : s[Symbol.iterator] ? [...s].join("") : [s].join("");
}

Array.prototype[REFORM] = function(a){
    return [...a];
}

// from http://stackoverflow.com/a/38580140/4119004 (my question! :D)
const Generator = Object.getPrototypeOf(function* () {});
const GeneratorFunction = Generator.constructor;

Generator.prototype.exhaust = function(callback){
    let collect = isDefined(callback) ? this : [];
    callback = defined(callback, (e) => collect.push(e));
    for(let x of this)
        callback(x);
    
    return collect;
}

function* cartProd(...arrs){
    arrs.reverse();
    let count = arrs.reduce((p, c) => p * c.length, 1);
    let indToItem = (ind) => {
        return arrs.map((arr) => {
            let e = arr[ind % arr.length];
            ind = ind / arr.length | 0;
            return e;
        }).reverse();
    };
    let start = 0;
    let stop = count;
    for(let i = start; i < stop; i++){
        yield indToItem(i);
    }
}

const isString = (s) => typeof s === "string";

Array.prototype.reject = function(f){
    return this.filter((...a) => !f(...a));
}

const clone = (x) => {
    if(!isDefined(x))
        return x;
    if(isDefined(x.clone)){
        return x.clone();
    } else if([Function, String, Number, Boolean, RegExp].has(x.constructor)){
        return x;
    } else if(isDefined(x.map)){
        return x.map(clone);
    } else if(x.constructor === Object){
        return Object.assign({}, x);
    } else {
        // console.warn(x + " is not cloneable");
        return x;
    }
}

Array.prototype[VECTORABLE] = true;

Array.prototype.newIndexOf = String.prototype.newIndexOf = function(a, index = 0){
    for(let i = index; i < this.length; i++){
        if(equal(this[i], a)) return i;
    }
    return -1;
}

Array.prototype.has = String.prototype.has = function(a, index = 0){
    return this.newIndexOf(a, index) >= 0;
}

Array.prototype.padStart = function(len, fill){
    let k = clone(this);
    while(k.length < len){
        k.unshift(fill);
    }
    return k;
}

Array.prototype.padEnd = function(len, fill){
    let k = clone(this);
    while(k.length < len){
        k.push(fill);
    }
    return k;
}

String.prototype.padStart = function(len, fill = " "){
    let str = this.toString();
    while(str.length < len)
        str = fill + str;
    return str;
}

String.prototype.padEnd = function(len, fill = " "){
    let str = this.toString();
    while(str.length < len)
        str += fill;
    return str;
}

Map.prototype.clone = function(){
    return new Map([...this]);
}
Map.prototype.toString = function(){
    // subject to change
    let str = "{ ";
    this.forEach((v, k) => {
        str += k + ": " + v + ", ";
    });
    str = str.slice(0, -2);
    str += " }";
    return str;
}

Map.prototype.repr = function(){
    // subject to change
    let str = "{ ";
    this.forEach((v, k) => {
        str += repr(k) + ": " + repr(v) + ", ";
    });
    str = str.slice(0, -2);
    str += " }";
    return str;
}

Array.prototype.get = String.prototype.get = function(i){
    i = +i;
    if(isDefined(this[i]))
        return this[i];
    else if(isDefined(this[i + this.length]))
        return this[i + this.length];
    else error("index `" + i + "` out of bounds in `" + repr(this) + "`");
}

const getFrom = (a, b) => {
    if(isDefined(a.get)){
        return a.get(b);
    } else {
        return a[b];
    }
}

RegExp.escape = function(str){
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

RegExp.of = function(str, flags = ""){
    return new RegExp(RegExp.escape(str), flags);
}

RegExp.getBody = function(reg){
    let str = reg.toString();
    return str.slice(1, str.lastIndexOf("/"));
}

RegExp.getFlags = function(reg){
    let str = reg.toString();
    return str.slice(str.lastIndexOf("/") + 1);
}

const betterSort = (arr, f = (l, r) => l > r) => {
    return arr.sort((left, right) => 2 * f(l, r) - 1);
}

const makeArray = (len, fill) => [...Array(len)].map(() => fill);

// modified from http://stackoverflow.com/a/966938/4119004
function createArray(length) {
    var arr = new Array(length || 0),
        i = length;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[length - 1 - i] = createArray.apply(this, args);
    } else {
        for(let i = 0; i < arr.length; i++){
            arr[i] = 0;
        }
    }

    return arr;
}


const surround = (s, f) => {
    if(isString(s)) return ungridify(surround(gridify(s), f));
    if(!isDefined(s[0]))
        s = [[]];
    else if(shape(s).length == 1)
        s = [s];
    s = fixShape(s);
    let height = s.length;
    let width = s[0].length;
    if(width == 0 && height == 1)
        return [[f]];
    if(width == 0 && height == 0)
        return [[f, f], [f, f]];
    s = s.map(a => [].concat(f, a, f));
    s.unshift(makeArray(width + 2, f));
    s.push(makeArray(width + 2, f));
    return s;
}

const moore = (arr, x, y, n = 1, m = n) => {
    let grid = [];
    for(let i = y - n; i <= y + n; i++){
        if(typeof arr[i] === "undefined") continue;
        let row = [];
        for(let j = x - m; j <= x + m; j++){
            if(typeof arr[i][j] === "undefined") continue;
            row.push(arr[i][j]);
        }
        grid.push(row);
    }
    return grid;
}

const fixShape = (arr, fill = 0) => {
    let recur = (a) => {
        if(!isDefined(a) || !a.map) return a;
        let maxlen = Math.max(...a.map(e => Array.isArray(e) ? e.length : -1));
        return a.map(e => recur(Array.isArray(e) ? e.padEnd(maxlen, fill) : e));
    }
    return recur(arr);
}

const union = (a, b) => unique([...a, ...b]);

const intersection = (a, b) =>
    unique(union(a, b).filter(e => a.indexOf(e) >= 0 && b.indexOf(e) >= 0));

const partition = (a, b) => {
    b = flatten([...b]);
    let res = [];
    let i = 0;
    for(let n of a){
        n = +n;
        if(b.length < i + n){
            let build = b.slice(i, i + n);
            res.push(build.concat(b.slice(0, n - build.length)));
            i = 0;
        } else {
            res.push(b.slice(i, i + n));
            i += n;
        }
    }
    return res;
}

function periodLoop(o, f){
    let it = o;
    let steps = [];
    while(intersection(steps, steps.concat(it)).length === steps.length){
        steps.push(it);
        it = f(it);
    }
    steps.pop();    // remove dup. entry
    if(steps.length === 2 && equal(steps[0], steps[1]))
        steps.pop();
    return {
        result: it,
        steps: steps
    };
}

const unique = (s) => {
    let res = [];
    for(let k of s){
        if(!res.has(k))
            res.push(k);
    }
    return res;
}

const prefix = (arr, len) => {
    return arr.slice(0, len);
};

const runsOf = (arr, func) => {
    if(typeof arr === "string"){
        return runsOf([...arr], func);
    }
    let res = [];
    let build = [];
    for(let i = 0; i < arr.length; i++){
        build.push(arr[i]);
        if(i == arr.length - 1 || falsey(func(arr[i], arr[i + 1]))){
            res.push(build);
            build = [];
        }
    }
    return res;
}

const format = (s, ...ar) => {
    return s.replace(/%(\d+)/g, (all, n) => ar[n].toString());
}

// modified from http://stackoverflow.com/a/11509565/4119004
function permute(inputArr) {
  var results = [];

  function _permute(arr, memo) {
    var cur, memo = memo || [];

    for (var i = 0; i < arr.length; i++) {
      cur = arr.splice(i, 1);
      if (arr.length === 0) {
        results.push(memo.concat(cur));
      }
      _permute(arr.slice(), memo.concat(cur));
      arr.splice(i, 0, cur[0]);
    }

    return results;
  }

  return _permute(inputArr);
}

// modified from http://stackoverflow.com/a/36164530/4119004
const transpose = (m) => {
    m = [...m];
    return [...m[0]].map((x, i) => m.map(x => getFrom(x, i)));
};

// http://codereview.stackexchange.com/a/39747/81013
function powerSet( list ){
    var s = [],
        listSize = list.length,
        combinationsCount = (1 << listSize);

    for (var i = 1; i < combinationsCount ; i++ , s.push(combination) )
        for (var j=0, combination = [];j<listSize;j++)
            if ((i & (1 << j)))
                combination.push(list[j]);
    return s;
}



let dateOpts = new Map([
    ["YYYY", (date) => date.getFullYear().toString().slice(-4)],
    ["YY", (date) => date.getFullYear().toString().slice(-2)],
    ["MM", (date) => (date.getMonth() + 1).toString().slice(-2)],
    ["DD", (date) => (date.getDate()).toString().slice(-2)],
    ["hh", (date) => (date.getHours()).toString().slice(-2)],
    ["mm", (date) => (date.getMinutes()).toString().slice(-2)],
    ["sss", (date) => (date.getMilliseconds()).toString().slice(-3)],
    ["ss", (date) => (date.getSeconds()).toString().slice(-2)],
]);
const formatDate = (time, str) => {
    str = str || "YYYY-MM-DD hh:mm:ss.sss";
    let date = new Date(+time);
    return str.replace(new RegExp([...dateOpts.keys()]
                        .map(RegExp.escape)
                        .join("|"), "g"),
            (opt) => dateOpts.get(opt)(date));
}

const chunkBy = (arr, f) => {
    let collect = [];
    arr = [...arr];
    let build = [arr[0]];
    for(let i = 1; i < arr.length; i++){
        let k = arr[i];
        if(!f(k, i, build, arr)){
            collect.push(build);
            build = [];
        }
        build.push(k);
    }
    if(build.length)
        collect.push(build);
    return collect;
}

const deepMap = (arr, f) => {
    let i = 0;
    let trav = (arr, d = 0) => {
        if(arr instanceof Array){
            return arr.map(e => trav(e, d + 1));
        } else {
            return f(arr, d, i++);
        }
    }
    return trav(arr);
}

const cellMap = (arr, f) => {
    let collect = [];
    let trav = (arr, d = 0) => {
        if(arr instanceof Array){
            arr.forEach((e, i) => trav(e, d + 1));
        } else {
            collect.push(f(arr, d));
        }
    }
    trav(arr);
    return collect;
};

const recursiveRepl = (orig, re, sub) => {
    // console.log(orig, re, sub);
    while(orig.match(re)){
        orig = orig.replace(re, sub);
    }
    return orig;
}

const FALSE = Decimal(0);
const TRUE = Decimal(1);

const toBase = (dec, base) => {
    base = base instanceof Decimal ? base : Decimal(base);
    if(dec.eq(0) || dec.eq(1)) return [dec];
    let maxLen = +dec.add(1).log(base).ceil();
    let baseNums = Array(maxLen).fill(Decimal(0));
    while(dec.gt(0)){
        let c = dec.log(base).floor();
        let rm = base.pow(c);
        dec = dec.sub(rm);
        let ind = maxLen - +c - 1;
        baseNums[ind] = (baseNums[ind] || Decimal(0)).add(1); 
    }
    return baseNums;
}

const antiBase = (decArr, base) => {
    return decArr.map((e, i) => base.pow(decArr.length - i - 1).mul(e))
                 .reduce((a, b) => a.add(b), FALSE);
}

const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const toBaseString = (a, b) => {
    let arr = toBase(a, b);
    if(+b <= 36)
        return arr.map(e => {
            let k = +e;
            return ALNUM[+e];
        }).join("");
    else if(+b == 95)
        return arr.map(e => {
            let k = +e;
            return String.fromCharCode(32 + k);
        }).join("");
    else
        error("invalid radix `" + b + "`");
}

const antiBaseString = (a, b) => {
    if(+b <= 36){
        return antiBase([...a].map(e => Decimal(ALNUM.indexOf(e))), b);
    } else if(+b == 95){
        return antiBase([...a].map(e => Decimal(e.charCodeAt() - 32)), b);
    } else {
        error("invalid radix `" + b + "`");
    }
}

let primeMem = new Map([
    ["2", TRUE],
    ["3", TRUE],
    ["4", FALSE],
    ["5", TRUE],
    ["6", FALSE],
    ["7", TRUE],
    ["8", FALSE],
    ["9", FALSE],
    ["10", FALSE]
]);
const isPrime = (n) => {
    let strOf = n.toString();
    if(n.lt(2)){//really slow... all of this function is, but why?
        return FALSE;
    } else if(primeMem.has(strOf)){
        return primeMem.get(strOf);
    } else {
        for(let i = Decimal(2); i.lte(n.sqrt()); i = i.add(1)){
            if(n.mod(i).eq(0)){
                primeMem.set(strOf, FALSE);
                return FALSE;
            }
        }
        primeMem.set(strOf, TRUE);
        return TRUE;
    }
}

const DECIMAL_DEFAULT_PRECISION = 20;
Decimal.set({ precision: DECIMAL_DEFAULT_PRECISION });

Decimal.PI = Decimal(640320).pow(3)            // (640320^3
            .add(Decimal(744)).pow(2)        // + 744)^2
            .sub(Decimal(196884).mul(2))    // - (196884*2)
            .ln().div(
                Decimal(163).sqrt().mul(2)
            );

let rotate = (a, n) => {
    if(typeof a === "string") return rotate(a.split(""), n).join("");
    if(n < 0) return rotate([...a].reverse(), -n).reverse();
    for(let i = 0; i < n; i++){
        a.unshift(a.pop());
    }
    return a;
}

const eye = (size) => {
    let d = [], i, j;
    for(i = 0; i < size;i++)
        for( d[i] = [], j = 0; j < size; j++)
            d[i][j] = Decimal(+(j == i));
    return d;
}

// broken
const shape = (arr) => {
    let build = [];
    if(!isDefined(arr))
        return build;
    if(arr.length === 0)
        return [0];
    let trav = (arr) => {
        // if(isDefined(arr[Symbol.iterator])){
        if(isDefined(arr.map)){
            build.push(arr.length);
            let next = [...arr][0];
            if(next === arr || !isDefined(next)) return;
            trav(next);
        }
    }
    trav(fixShape(arr));
    return build;
}

let gridify = (str) => {
    return fixShape(str.split(/\r?\n/).map(e => [...e]), " ");
}
let ungridify = (arr) => arr.map(e => e.join("")).join("\n");

let verticalRepeat = (x, n) => {
    let arr = [...Array(+n)];
    arr.fill(x);
    return arr.join("\n");
}

let horizontalRepeat = (x, n) => {
    let res = [];
    n = +n;
    for(let c of x.split("\n")){
        res.push(c.repeat(n));
    }
    return res.join("\n");
}

let hcat = (a1, a2) => {
    if(typeof a1 === "string" && typeof a2 === "string"){
        let g1 = gridify(a1);
        let g2 = gridify(a2);
        if(g1.length !== g2.length){
            if(g2.length === 1){
                return ungridify(hcat(g1, [...Array(g1.length)].map((e, i) => a2[i % a2.length])));
            }   
            error("dimension error");
        }
        return ungridify(hcat(g1, g2));
    }
    if(a1.length !== a2.length){
        if(a2.length === 1){
            return hcat(a1, [...Array(a1.length)].map(() => a2));
        }
        error("dimension error");
    }
    return a1.map((e, i) => e.concat(a2[i]));
}

const equal = (x, y) => {
    if(x == null){
        if(y == null){
            return true;
        }
        return false;
    }
    if(x.constructor !== y.constructor)
        return false;
    
    // handle arrays specially
    if(x instanceof Array){
        if(x.length !== y.length)
            return false;
        
        for(let i = 0; i < x.length; i++){
            if(!equal(x[i], y[i]))
                return false;
        }
        return true;
    } else if(x instanceof Nil){
        return true;
    } else if(x.constructor === String){
        return x === y;
    } else if(x instanceof Decimal){
        return x.eq(y);
    } else if(isDefined(x[EQUAL])){
        return x[EQUAL](y);
    } else if(x.constructor === Number){
        return x === y;
    } else if(x.constructor === Function){
        return x === y;
    }{
        console.warn("no equal property for " + x.constructor.name + " -- " + x);
        console.warn("                  and " + y.constructor.name + " -- " + y);
        return x === y;
    }
    
    // they have same type and SHOULD have (and have same)
    // iterator, if any
    // this alternative definition is used to guess equality
    // for unfamiliar types
    // this would only be a problem if there is some cell K in
    // either iterable for which K and the iterable share the same
    // class; for example, [..."Hello"] (an iterable string) would
    // yield 5 iterable single-length strings
    if(x[Symbol.iterator]){
        return equal([...x], [...y]);
    }
}

const less = (x, y) => {
	if(x.lt){
		return x.lt(y);
	} else {
		return x < y;
	}
}

const greater = (x, y) => {
	if(x.gt){
		return x.gt(y);
	} else if(y.lt){
		return !less(y, x);
	}
}

const warn = (err) => {
    if(typeof DEBUG !== "undefined" && DEBUG)
        (console.warn || console.log)("warning: " + err);
}

const typeName = (type) =>
    (type.name || type.toString()).replace(/^e$/, "Decimal");

const falsey = (tp) => {
    let c =
        tp === ""
     || tp instanceof Decimal && tp.cmp(0) == 0
     || typeof tp === "undefined"
    // c |= Number.isNaN(tp);
     || tp instanceof Nil;
    return !!c;
}

const truthy = (tp) => !falsey(tp);

function vectorize(f, arity = f.length){
    if(arity === 1){
        function trav(item){
            if(item[VECTORABLE]){
                return item.map(trav);
            } else {
                return f.bind(this)(item);
            }
        }
        
        return trav;
    } else if(arity === 2){
        function trav2(a, b){
            if(a[VECTORABLE]){
                if(b[VECTORABLE]){
                    if(b.length !== a.length){
                        error("length error");
                    }
                    return a.map((e, i) => trav2.bind(this)(e, b[i]));
                } else {
                    return a.map(e => trav2.bind(this)(e, b));
                }
            } else if(b instanceof Array){
                return b.map(e => trav2.bind(this)(a, e));
            } else {
                return f.bind(this)(a, b);
            }
        }
        return trav2;
    // } else if(arity === 3) {
        // function travN(...args){
            // if(args.every(e => e instanceof Array)){
                // let r = (i, ...a) =>
                    // args[i].map(i == 0
                        // ? travN.bind(this)(...a)
                        // : e => r(i - 1, ...a, e)
                    // );
                // return r(args.length-1);
            // }
        // }
        // return travN;
    } else {
        throw new Error("unsupported arity " + arity);
    }
}

function threeVector(f){
    function trav3V(a, b, c){
        return vectorize((a, b) => f(a, b, c));
    }
    return trav3V;
}

function vectorizeRight(f, arity = f.length){
    if(arity === 1){
        function trav(item){
            if(item[VECTORABLE]){
                return item.map(trav);
            } else {
                return f.bind(this)(item);
            }
        }
        
        return trav;
    } else if(arity === 2){
        function trav2(a, b){
            // console.log(a, b);
            if(b[VECTORABLE]){
                return b.map(e => trav2.bind(this)(a, e));
            } else {
                return f.bind(this)(a, b);
            }
        }
        return trav2;
    }
}

const depthOf = (arr, d = 0) => {
    if(arr instanceof Array){
        return Math.max(...arr.map(e => depthOf(e, d + 1)), d);
    } else {
        return d;
    }
}

const flatten = (arr, n = Infinity) =>
    arr instanceof Array
        ? arr.map((e) => n > 1 ? flatten(e, n - 1) : e).reduce((p, c) => p.concat(c), [])
        : arr;

// from http://stackoverflow.com/a/30832210/4119004
function download(data, filename, type) {
    var a = document.createElement("a"),
        file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}

const repr = (item) => {
    if(!isDefined(item)){
        return "undef";
    }
    if(isDefined(item.repr)){
        return item.repr();
    }
    if(Array.isArray(item))
        return "(" + item.map(repr).join(" ") + ")";
    else if(isString(item)){
        return "'" + item.replace(/'/g, "''") + "'";
    }
    else if(item instanceof Decimal){
        return item.toFixed().replace(/-/g, "_");
    }
    else {
        warn("the following item has no repr:");
        warn(item);
        return item.toString();
    }
}

const chunk = (arr, len) => {
    len = +len;
    let res = [];
    for(let i = 0; i < arr.length; i += len){
        res.push(arr.slice(i, i + len));
    }
    return res;
}

const table = (a, b, f) => {
    return a.map(x => b.map(y => f(x, y)));
};

const display2d = (item, castToStr = (toCast) => toCast.toString()) => {
    let nothing = Symbol("nothing");
    item = fixShape(item, nothing);
    let handle = (e) => {
        let cur = e;
        if(cur === nothing) cur = "";
        if(!isDefined(cur)) cur = "undef";
        else cur = castToStr(cur);
        return cur;
    }
    // obtain widths for columns
    let columnLens = deepMap(
        transpose(item),
        e => e === nothing ? 0 : handle(e).length
    ).map(
        e => Math.max(...e)
    );
    let lines = [];
    let [height, width] = shape(item);
    for(let i = 0; i < height; i++){
        let res = "";
        for(let j = 0; j < width; j++){
            let cur = handle(getFrom(getFrom(item, i), j));
            res += cur.padStart(columnLens[j], " ");
            if(j < width - 1) res += " ";
        }
        lines.push(res.trimRight() + ")");
    }
    return lines.join("\n").replace(/^/gm, " (").replace(/ /, "(") + ")";
}

const joinArray = (item) => {
    let trav = (arr, depth = depthOf(arr)) => {
        if(!isDefined(arr)) return "undefined";
        if(arr instanceof Array)
            if(arr.length === 0)
                return "()";
            else
                return "(" + arr.map(e => trav(e, depth - 1))
                    .join(depth === 1 ? " "
                        : "\n".repeat(depth - 1)) + ")";
        else if(arr instanceof Decimal)
            return arr.toString().replace(/-/g, "_");
        else
            return arr.toString();
    };
    if(shape(item).length === 2){
        return display2d(item);
    }
    return trav(item);
};

const joinGrid = (item) => {
    let trav = (arr, depth = depthOf(arr)) => {
        if(arr instanceof Array)
            return arr.map(e => trav(e, depth - 1))
                .join(depth <= 1 ? ""
                    : "\n".repeat(depth - 1));
        else if(arr instanceof Decimal)
            return arr.toString().replace(/-/g, "_");
        else
            return arr.toString();
    };
    return trav(item);
};

const disp = (item) => {
    if(shape(item).length === 2){
        return display2d(item, repr);
        // return display2d(item, disp);
    }
    return repr(item);
}

const pp = (item) => {
    let ident = flatten(item);
    if(typeof ident === "string" ||
        ident instanceof Array &&
        ident.every(e => typeof e === "string") &&
        ident.length){
        return joinGrid(item);
    } else {
        return joinArray(item);
    }
};

const dispJS = (x) =>
    x === undefined ? "undefined" :
    x.map ?
        x.map(disp).join(" ") :
            x.constructor === String ? '"'+x+'"' :
                x.toFixed ?
                    x.toFixed() :
                        x.toString();

const factorial = (dec) => {
    if(!dec.eq(dec.floor())) error(`Expected ${dec} to be an integer.`);
    return dec.lt(2) ? Decimal(1) : factorial(dec.sub(1)).mul(dec);
}

const takeWhile = (list, f) => {
    let i = 0;
    while(f(list[i]) && i < list.length) i++;
    return list.slice(0, i);
}

const assureTyped = (obj, type) => {
    if(typeof type !== "function")
        throw new Error(type + " is not a type thingy...");
    
    if(!isDefined(obj))
        error("popping from an empty stack");
    
    if(obj.constructor === type || obj instanceof type)
        return true;
    
    error("type conflict; expected " + typeName(type) +
        ", received `" + obj + "`, which is of type " +
        typeName(obj.constructor));
}

// http://stackoverflow.com/a/1242596/4119004
const bytes = (str) =>
    [...utf8.encode(str)].map(e => e.charCodeAt());

const parseArr = (str) => {
    let number = "(?:-?\\w+)";
    let formats = [
        [
            new RegExp("^\\s*\\(?\\s*(?:" + number + "\\s*)*\\)?\\s*$"),
            (e) => e.replace(/^\s*\(\s*|\s*\)\s*$/g, "").split(/\s+/).map(parseNum),
        ],
        [
            new RegExp("^\\s*\\[?\\s*(?:" + number + "\\s*,?\\s*)*\\s*\\]?\\s*$"),
            (e) => e.replace(/^\s*\[\s*|\s*\]\s*$/g, "").split(/\s*,\s*/).map(parseNum),
        ],
    ];
    let res = formats.find(e => e[0].test(str));
    if(!res) error("unrecognized array `" + str + "`");
    return res[1](str);
}

// todo
const grade = (list) =>
	range(0, list.length);//not decimals

class StRegex {
    constructor(body, flags = ""){
        if(body instanceof RegExp){
            flags = RegExp.getFlags(body);
            body = RegExp.getBody(body);
        }
        this.pattern = StRegex.toReg(body, flags);
        this.body = body;
        this.flags = flags;
        return this;
    }
    
    [Symbol.match](str, ...a){
        return str.match(this.pattern, ...a);
    }
    
    [Symbol.replace](str, ...a){
        return str.replace(this.pattern, ...a);
    }
    
    [Symbol.search](str, ...a){
        return str.search(this.pattern, ...a);
    }
    
    [Symbol.split](str, ...a){
        return str.replace(this.pattern, ...a);
    }
    
    static toReg(str, flags = ""){
        let build = "";
        for(let i = 0; i < str.length; i++){
            if(str[i] === "`"){
                for(i++; i < str.length; i++){
                    if(str[i] === "`")
                        if(str[i + 1] !== "`")
                            break;
                        else
                            i++;
                    build += RegExp.escape(str[i]);
                }
            }
            else if(str[i] === "\\"){
                i++;
                if(StRegex.standardEscapes.includes(str[i])){
                    build += "\\" + str[i];
                } else if(StRegex.escapes.has(str[i])){
                    build += StRegex.escapes.get(str[i]);
                } else {
                    build += str[i];
                }
            }
            else
                build += str[i];
        }
        return new RegExp(build, flags);
    }
    
    toString(){
        return "/" + this.body + "/" + this.flags;
    }
}
StRegex.standardEscapes = [..."abfnrv\\'\"^$*+?.(){}[]" +
                              "bBdDwWsS" +
                              "c0123456789"];
StRegex.escapes = new Map([
    ["m", "[A-Za-z]"],
    ["M", "[^A-Za-z]"],
    ["i", "[A-Za-z0-9]"],
    ["I", "[^A-Za-z0-9]"],
]);

if(isNode){
    module.exports = {
        REFORM: REFORM,
		range: range,
        EQUAL: EQUAL,
        defined: defined,
        isPrime: isPrime,
        repr: repr,
        joinGrid: joinGrid,
        vectorize: vectorize,
        hcat: hcat,
        permute: permute,
        powerSet: powerSet,
        betterSort: betterSort,
        transpose: transpose,
        flatten: flatten,
        intersection: intersection,
        union: union,
        partition: partition,
        verticalRepeat: verticalRepeat,
        horizontalRepeat: horizontalRepeat,
        unique: unique,
        surround: surround,
        DECIMAL_DEFAULT_PRECISION: DECIMAL_DEFAULT_PRECISION,
        isDefined: isDefined,
        VECTORABLE: VECTORABLE,
        warn: warn,
        toBase: toBase,
        vectorizeRight: vectorizeRight,
        isString: isString,
        Nil: Nil,
        typeName: typeName,
        pp: pp,
        disp: disp,
        falsey: falsey,
        assureTyped: assureTyped,
        truthy: truthy,
        chunkBy: chunkBy,
        equal: equal,
        bytes: bytes,
        chunk: chunk,
        dispJS: dispJS,
        toBaseString: toBaseString,
        factorial: factorial,
        recursiveRepl: recursiveRepl,
        joinArray: joinArray,
        clone: clone,
        format: format,
        createArray: createArray,
        eye: eye,
        antiBase: antiBase,
        shape: shape,
        display2d: display2d,
        parseArr: parseArr,
        parseNum: parseNum,
        deepMap: deepMap,
        TRUE: TRUE,
        FALSE: FALSE,
        gridify: gridify,
        ungridify: ungridify,
		table: table,
        formatDate: formatDate,
        getFrom: getFrom,
        StRegex: StRegex,
        // ##insert
        // from: https://github.com/stevenvachon/cli-clear/blob/master/index.js
        cls: function cls(){
            let windows = process.platform.indexOf("win") === 0;
            let stdout = "";
            if(!windows){
                stdout += "\x1B[2J";
            } else {
                lines = process.stdout.getWindowSize()[1];
                for(let i = 0; i < lines; i++)
                    stdout += "\r\n";
            }
            stdout += "\x1B[0f";
            
            process.stdout.write(stdout);
        },
    };
}