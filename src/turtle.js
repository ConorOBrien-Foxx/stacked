// drawing heavily from https://github.com/davebalmer/turtlewax

/** Class representing a turtle. When talking about angles, `0` represents north;
 * `90` represents east; `180`, south; and `270`, west. */
class Turtle {
    /**
     * Initialize a turtle.
     * @param {HTMLCanvasElement} canvas The canvas on which the turtle draws.
     */
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
    
    /**
     * Resumes drawing, if not already doing so.
     * @return {Turtle} The class itself.
     */
    pendown(){
        this.drawing = true;
        return this;
    }
    
    /**
     * Pauses drawing, if not already doing so.
     * @return {Turtle} The class itself.
     */
    penup(){
        this.drawing = false;
        return this;
    }
    
    /**
     * Modifies the stroke style.
     * @param {String} str The new stroke style.
     * @return {Turtle} The class itself.
     */
    penstyle(str){
        this.ctx.strokeStyle = str;
        return this;
    }
    
    /**
     * Modifies the fill style.
     * @param {String} str The new fill style.
     * @return {Turtle} The class itself.
     */
    fillstyle(str){
        this.ctx.fillStyle = str;
        return this;
    }
    
    /**
     * Modifies both the stroke and fill style. This is equivalent to {@link fillstyle(str)} and {@link strokestyle(str)} in succession.
     * @param {String} str The new stroke/fill style.
     * @return {Turtle} The class itself.
     */
    allstyle(str){
        this.penstyle(str);
        this.fillstyle(str);
        return this;
    }
    
    /**
     * Turns the turtle rightwards by a specified amount.
     * @param {Number|Decimal} deg The amount to turn by.
     * @return {Turtle} The class itself.
     */
    turn(deg){
        this.dir = (this.dir + deg.valueOf()) % 360;
        return this;
    }
    
    /**
     * Sets the turtle's angle to a specified amount.
     * @param {Number|Decimal} absDeg The degree of the turtle.
     * @return {Turtle} The class itself.
     */
    angle(absDeg){
        this.dir = absDeg - 90;
        return this;
    }
    
    /**
     * Strokes all paths made in the current path.
     * @param {Number|Decimal} absDeg The degree of the turtle.
     * @return {Turtle} The class itself.
     */
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