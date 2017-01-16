// I looked on the internet for a class-based color implementation, but
// nothing was quite what I was looking for. Therefore, I have made my
// own. yaaay I get to do some research

// used resources:
//  - https://github.com/AndreasSoiron/Color_mixer/blob/master/color_mixer.js

class Color {
    // the constructor for this only takes a single item
    // currently valid formats:
    //  - new Color([r, g, b])
    //  - new Color([grey])
    //  - new Color([grey, a])
    //  - new Color([r, g, b, a])
    //  - new Color("#hex")
    // internal representation is rgba
    constructor(entity = [0]){
        if(entity instanceof String){
            
        } else {
            if(entity[Symbol.iterator])
                entity = [...entity];
            
            if(!(entity instanceof Array))
                entity = [entity];
            
            // cast contents to number
            entity = entity.map(e => +e);
            
            if(entity instanceof Array){
                if(entity.length === 1){
                    // this is a monocromatic color
                    entity.push(entity[0]);
                    entity.push(entity[0]);
                }
                if(entity.length === 2){
                    // this is a monocromatic color with alpha transparency
                    entity.push(entity[0]);
                }
                if(entity.length === 3){
                    // convert to rgba
                    entity.push(255);
                }
                let [r, g, b, a] = entity;
                this.r = r % 256;
                this.g = g % 256;
                this.b = b % 256;
                this.a = a % 256;
            }
        }
    }
    
    static sub(c1, c2){
        return new Color([
            c1.r - c2.r,
            c1.g - c2.g,
            c1.b - c2.g,
            Math.min(c1.a, c2.a)
        ]);
    }
    
    *[Symbol.iterator](){
        yield this.r;
        yield this.g;
        yield this.b;
        yield this.a;
    }
    
    sub(c2){
        return Color.sub(this, c2);
    }
    
    static equal(c1, c2){
        return c1.sub(c2).getRGB().every(e => e <= Color.tolerance * 255);
    }
    
    equal(c2){
        return Color.equal(this, c2);
    }
    
    static colorFromName(name){
        let temp = document.createElement("div");
        temp.style.color = name;
        return Color.colorFromString(window.getComputedStyle(temp).color);
    }
    
    static colorFromString(str){
        // if(str === "")   
        // extract function type
        let funcType = str.match(/^(.+?)\(/);
        
        if(!funcType)
            throw new Error("invalid string '" + str + "': no leading identifier");
        // the name itself
        funcType = funcType[1].toLowerCase();
        
        // extract the numbers
        let nums = str.match(/^.+?\s*\(\s*((?:\d+\s*,\s*)*\d+)\s*\)$/);
        if(!nums)
            throw new Error("invalid string '" + str + "': malformed interior");
        
        nums = nums[1].split(/,\s*/).map(Number);
        
        if(funcType === "rgb"){
            if(nums.length !== 3)
                throw new Error("invalid length " + nums.length + "; expected 3");
            
            return new Color(nums);
        }
        
        else if(funcType === "rgba"){
            if(nums.length !== 4)
                throw new Error("invalid length " + nums.length + "; expected 4");
            
            return new Color(nums);
        }
        
        else {
            throw new Error("invalid identifier '" + funcType + "'");
        }
    }
    
    static setTolerance(v){
        Color.tolerance = v;
    }
    
    getRGB(){
        return [this.r, this.g, this.b];
    }
    
    getRGBA(){
        return [this.r, this.g, this.b, this.a];
    }
    
    getCMYK(){
        let cym = this.getRGB().map(e => 255 - e);
        let black = Math.min(...cym);
        cym = cym.map(e => (e - black) / (255 - black) | 0);
        return cym.concat([black / 255, this.a]);
    }
    
    static fromCMYK([c, y, m, k, a]){
        return new Color([c, y, m].map(e => e * (1 - k) + k)
                        .map(e => (1 - e) * 255 + 0.5).concat(a));
    }
    
    static mix(c1, c2){
        let res = [0, 0, 0, 0, 1]
        for(let color of [c1, c2]){
            let cmyk = color.getCMYK();
            res = res.map((e, i) => (e + cmyk[i]) / 2);
            [color+[], cmyk, res].map(e => console.log(e));
        }
        return Color.fromCMYK(res);
    }
    
    toString(){
        return "rgba(" + this.getRGBA().join(", ") + ")";
    }
}

// absolute equality
Color.tolerance = 0;

// darnit chrome, with color form name not working
["white", "silver", "gray", "grey", "black", "red", "maroon", "yellow", "olive",
 "lime", "green", "aqua", "teal", "blue", "navy", "fuchsia", "purple"].forEach(c =>
    Color[c] = Color.colorFromName(c)
);