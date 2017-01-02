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