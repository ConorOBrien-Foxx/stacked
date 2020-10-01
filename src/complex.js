var isNode = typeof require !== "undefined";

if(isNode)
	var Decimal = require("./decimal.js");

class Complex {
    constructor(re, im){
        this.re = Decimal(re);
        this.im = Decimal(im || 0);
    }
    
    add(c){
        if(c instanceof Complex){
            return new Complex(this.re.add(c.re), this.im.add(c.im));
        } else if(c instanceof Decimal){
            return new Complex(this.re.add(c), this.im);
        } else {
            console.log(c);
        }
        // idk
        return Decimal(234234234234);
    }
    
    sub(c){
        if(c instanceof Complex){
            return new Complex(this.re.sub(c.re), this.im.sub(c.im));
        } else if(c instanceof Decimal){
            return new Complex(this.re.sub(c), this.im);
        } else if(c[VECTORABLE]){
            return c.map(e => this.sub(e));
        }
    }
    
    mul(c) {
        if(c instanceof Complex) {
            return new Complex(
                this.re.mul(c.re).sub(this.im.mul(c.im)),
                this.re.mul(c.im).add(this.im.mul(c.re))
            );
        }
        else if(c instanceof Decimal) {
            return new Complex(
                this.re.mul(c),
                this.im.mul(c)
            );
        }
        else if(c[VECTORABLE]) {
            return c.map(e => this.mul(e));
        }
    }
    
    div(c) {
        if(c instanceof Complex) {
            let exDividend = c.re.mul(c.re).add(c.im.mul(c.im));
            return new Complex(
                this.re.mul(c.re).add(this.im.mul(c.im)).div(exDividend),
                this.im.mul(c.re).sub(this.re.mul(c.im)).div(exDividend)
            );
        }
        else if(c instanceof Decimal) {
            return new Complex(
                this.re.div(c),
                this.im.div(c)
            );
        }
        else if(c[VECTORABLE]) {
            return c.map(e => this.mul(e));
        }
    }
    
    conj() {
        return new Complex(this.re, -this.im);
    }
    
    *[Symbol.iterator](){
        yield this.re;
        yield this.im;
    }
    
    repr(){
        return repr(this.re) + "i" + repr(this.im);
    }
    
    toString(){
        return this.repr();
    }
}

if(isNode)
    module.exports = exports.default = Complex;