// drawing heavily from https://github.com/davebalmer/turtlewax

class Turtle {
    constructor(canvas){
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.x = this.width / 2;
        this.y = this.height / 2;
        this.dir = -90;
        this.drawing = true;
        this.motions = true;
        this.goto(this.x, this.y);
    }
    
    pendown(){
        this.drawing = true;
    }
    
    penup(){
        this.drawing = false;
    }
    
    penstyle(str){
        this.ctx.strokeStyle = str;
        return this;
    }
    
    fillstyle(str){
        this.ctx.fillStyle = str;
        return this;
    }
    
    allstyle(str){
        this.penstyle(str);
        this.fillstyle(str);
        return this;
    }
    
    turn(deg){
        this.dir = (this.dir + deg) % 360;
        return this;
    }
    
    angle(absDeg){
        this.dir = absDeg - 90;
        return this;
    }
    
    stroke(){
        this.ctx.stroke();
        return this;
    }
    
    goto(x = this.x, y = this.y){
        this.x = x;
        this.y = y;
        this.ctx.moveTo(this.x, this.y);
        return this;
    }
    
    to(x, y){
        this.x = x;
        this.y = y;
        
        this.motion();
        
        if(this.drawing)
            this.ctx.lineTo(x, y);
        else
            this.ctx.moveTo(x, y);
        
        this.motionEnd();
        
        return this;
    }
    
    motion(){
        if(!this.motions) return this;
        this.ctx.beginPath();
        this.goto();
        return this;
    }
    
    motionEnd(){
        if(!this.motions) return this;
        this.stroke();
        return this;
    }
    
    go(dist){
        this.motion();
        
        let a = Turtle.toRad(this.dir);
        
        this.x += dist * Math.cos(a);
        this.y += dist * Math.sin(a);
        
        if(this.drawing)
            this.ctx.lineTo(this.x, this.y);
        else
            this.ctx.moveTo(this.x, this.y);
        
        this.motionEnd();
        
        return this;
    }
    
    back(dist){
        this.turn(180);
        this.go(dist);
        this.turn(180);
    }
    
    // cardinal directions
    north(dist){
        this.to(this.x, this.y - dist);
    }
    
    south(dist){
        this.to(this.x, this.y + dist);
    }
    
    west(dist){
        this.to(this.x - dist, this.y);
    }
    
    east(dist){
        this.to(this.x + dist, this.y);
    }
    
    font(str){
        this.ctx.font = str;
    }
    
    text(str){
        this.ctx.fillText(str, this.x, this.y);
        return this;
    }
    
    get width(){
        return this.canvas.width;
    }
    
    get height(){
        return this.canvas.height;
    }
    
    static toRad(deg){
        return deg * Math.PI / 180.0;
    }
}