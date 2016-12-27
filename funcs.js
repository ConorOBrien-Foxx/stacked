const VECTORABLE = Symbol("VECTORABLE");

const isString = (s) => typeof s === "string";

Array.prototype.reject = function(f){
	return this.filter((...a) => !f(...a));
}

Array.prototype.clone = function(){
	return this.map(e => e.clone ? e.clone() : e);
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
	let k = this.clone();
	while(k.length < len){
		k.unshift(fill);
	}
	return k;
}

Array.prototype.padEnd = function(len, fill){
	let k = this.clone();
	while(k.length < len){
		k.push(fill);
	}
	return k;
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
Array.prototype.get = String.prototype.get = function(i){
    i = +i;
    if(isDefined(this[i]))
        return this[i];
    else if(isDefined(this[i + this.length]))
        return this[i + this.length];
    else error("index `" + i + "` out of bounds");
}

RegExp.escape = function(str){
	return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

RegExp.of = function(str){
	return new RegExp(RegExp.escape(str));
}

const betterSort = (arr) => {
    return arr.sort((left, right) => 2 * (left > right) - 1);
}

const makeArray = (len, fill) => [...Array(len)].map(() => fill);

const surround = (s, f) => {
    if(isString(s)) return gridify(surround(ungridify(s), f));
    s = fixShape(s);
    let height = s.length;
    let width = s[0].length;
    s = s.map(a => [f, ...a, f]);
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

const isArray = (a) => a instanceof Array;

const fixShape = (arr, fill = 0) => {
    let recur = (a) => {
        if(!a.map) return a;
        let maxlen = Math.max(...a.map(e => isArray(e) ? e.length : -1));
        return a.map(e => recur(isArray(e) ? e.padEnd(maxlen, fill) : e));
    }
    return recur(arr);
}

const union = (a, b) => [...a, ...b];

const intersection = (a, b) =>
    union(a, b).filter(e => a.indexOf(e) >= 0 && b.indexOf(e) >= 0);

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
    while(unique(steps).length === steps.length){
        steps.push(it);
        it = f(it);
    }
    steps.pop();    // remove dup. entry
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

// http://stackoverflow.com/a/36164530/4119004
const transpose = m => m[0].map((x,i) => m.map(x => x[i]));

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
    let trav = (arr, d = 0) => {
        if(arr instanceof Array){
            return arr.map((e, i) => trav(e, d + 1));
        } else {
            return f(arr, d);
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

const isDefined = (a) => typeof a !== "undefined";
const defined = (...a) => a.find(isDefined);

const DECIMAL_DEFAULT_PRECISION = 20;
Decimal.set({ precision: DECIMAL_DEFAULT_PRECISION });

Decimal.PI = Decimal(640320).pow(3)			// (640320^3
			.add(Decimal(744)).pow(2)		// + 744)^2
			.sub(Decimal(196884).mul(2))	// - (196884*2)
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

let gridify = (str) => fixShape(str.split(/\r?\n/).map(e => [...e]), " ");
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
	} else if(x instanceof Func){
		return x.body === y.body;
	} else if(x.constructor === Number){
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

const warn = (err) => {
	(console.warn || console.log)("warning: " + err);
}

const typeName = (type) =>
	type.name.replace(/^e$/, "Decimal");

const falsey = (tp) =>
	tp === "" ||
	tp instanceof Decimal && tp.cmp(0) == 0 ||
	typeof tp === "undefined" ||
	tp.isNaN && tp.isNaN();

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
		return Math.max(...arr.map(e => depthOf(e, d + 1)));
	} else {
		return d;
	}
}

const flatten = (arr) =>
	arr instanceof Array
		? arr.map(flatten).reduce((p, c) => p.concat(c), [])
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
	return trav(item);
};

const chunk = (arr, len) => {
	len = +len;
	let res = [];
	for(let i = 0; i < arr.length; i += len){
		res.push(arr.slice(i, i + len));
	}
	return res;
}

// proper name?
const table = (a, b, f) => {
	return a.map(x => b.map(y => f(x, y)));
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

const disp = (x) =>
	x === undefined ? "undefined" :
	x.map ?
		x.map(disp).join(" ") :
			x.constructor === String ? '"'+x+'"' :
				x.toFixed ?
					x.toFixed() :
						x.toString();

const factorial = (dec) => {
	return dec.lt(2) ? Decimal(1) : factorial(dec.sub(1)).mul(dec);
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