var isNode = typeof require !== "undefined";

if(isNode)
	var Decimal = require("./decimal.js");

class Complex {
    constructor(re, im = 0) {
        this.re = Decimal(re);
        this.im = Decimal(im);
    }
    
    add(c) {
        if(c instanceof Complex){
            return new Complex(this.re.add(c.re), this.im.add(c.im));
        }
        else if(c instanceof Decimal){
            return new Complex(this.re.add(c), this.im);
        }
        else {
            // TODO: error properly, ditto for rest
            console.log(c);
        }
        // idk
        return Decimal(234234234234);
    }
    
    sub(c) {
        if(c instanceof Complex){
            return new Complex(this.re.sub(c.re), this.im.sub(c.im));
        }
        else if(c instanceof Decimal){
            return new Complex(this.re.sub(c), this.im);
        }
    }
    
    rsub(c) {
        if(c instanceof Complex){
            return c.sub(this);
        }
        else if(c instanceof Decimal){
            return new Complex(c.sub(this.re), -this.im);
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
    }
    
    rdiv(c) {
        if(c instanceof Complex) {
            return c.div(this);
        }
        else if(c instanceof Decimal) {
            return new Complex(
                c.div(this.re),
                c.div(this.im),
            );
        }
    }
    
    abs() {
        return this.absq().sqrt();
    }
    
    absq() {
        return this.re.mul(this.re).add(this.im.mul(this.im));
    }
    
    toPolar() {
        let r = this.abs();
        let theta = this.arg();
        return [r, theta];
    }
    
    arg() {
        return Decimal.atan2(this.im, this.re);
    }
    
    pow(c) {
        if(c instanceof Complex) {
            let aq = this.absq();
            let m1 = aq.pow(c.re.div(2));
            let m2 = c.im.neg().mul(this.arg()).exp();
            let m = m1.mul(m2);
            let v = c.re.mul(this.arg())
                .add(aq.ln().mul(c.im).div(2));
            let re = m.mul(v.cos());
            let im = m.mul(v.sin());
            return new Complex(re, im);
        }
        else if(c instanceof Decimal) {
            
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