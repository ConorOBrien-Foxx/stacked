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
     * Modifies the stroke style. Synonym for {@link Turtle#penstyle}.
     * @param {String} str The new stroke style.
     * @return {Turtle} The class itself.
     */
    strokestyle(str){
        return this.penstyle(str);
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
     * Modifies both the stroke and fill style. This is equivalent to
     * calling {@link Turtle#penstyle} then {@link Turtle#fillstyle}.
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
     * @param {Number} deg The amount to turn by.
     * @return {Turtle} The class itself.
     */
    turn(deg){
        this.dir = (this.dir + deg) % 360;
        return this;
    }
    
    /**
     * Sets the turtle's angle to a specified amount.
     * @param {Number} absDeg The degree of the turtle.
     * @return {Turtle} The class itself.
     */
    angle(absDeg){
        this.dir = absDeg - 90;
        return this;
    }
    
    /**
     * Strokes all paths made in the current path.
     * @param {Number} absDeg The degree of the turtle.
     * @return {Turtle} The class itself.
     */
    stroke(){
        this.ctx.stroke();
        return this;
    }
    
    /**
     * Absolute movement to a given position on the canvas. Does not
     * draw on canvas as a side effect.
     * @param {Number} x The x-position to move to.
     * @param {Number} y The y-position to move to.
     * @return {Turtle} The class itself.
     */
    goto(x = this.x, y = this.y) {
        this.x = x;
        this.y = y;
        this.ctx.moveTo(this.x, this.y);
        return this;
    }
    
    /**
     * Moves the turtle to a given position, marking a line, if drawing.
     * @param {Number} x The x-position to move to.
     * @param {Number} y The y-position to move to.
     * @return {Turtle} The class itself.
     */
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
    
    /**
     * Starts a motion, for ease of drawing segments. Complemented by
     * {@link Turtle#motionEnd}. Many functions defined for the Turtle
     * class begin with `this.motion()` and end with `this.motionEnd()`,
     * so as to prevent the turtle redoing what has already been done.
     * @return {Turtle} The class itself.
     */
    motion(){
        if(!this.motions) return this;
        this.ctx.beginPath();
        this.goto();
        return this;
    }
    
    
    /**
     * Ends a motion, for ease of drawing segments. Complemented
     * by {@link Turtle#motion}. See more information in the
     * previous link.
     * @return {Turtle} The class itself.
     */
    motionEnd(){
        if(!this.motions) return this;
        this.stroke();
        return this;
    }
    
    /**
     * Moves the turtle forward by a specified amount, along the line
     * defined by the turtle's angle.
     * @param {Number} dist The distance in pixels that the turtle is
     * to go.
     * @return {Turtle} The class itself.
     */
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
    
    /**
     * Moves the turtle backward  by a specified amount, along the line
     * defined by the turtle's angle. See also {@link Turtle#go}.
     * @param {Number} dist The distance in pixels that the turtle is
     * to go.
     * @return {Turtle} The class itself.
     */
    back(dist){
        this.turn(180);
        this.go(dist);
        return this.turn(180);
    }
    
    // cardinal directions
    
    /**
     * Moves the turtle north by a specified amount.
     * @param {Number} dist The distance in pixels that the turtle is
     * to go.
     * @return {Turtle} The class itself.
     */
    north(dist){
        return this.to(this.x, this.y - dist);
    }
    
    /**
     * Moves the turtle south by a specified amount.
     * @param {Number} dist The distance in pixels that the turtle is
     * to go.
     * @return {Turtle} The class itself.
     */
    south(dist){
        return this.to(this.x, this.y + dist);
    }
    
    /**
     * Moves the turtle west by a specified amount.
     * @param {Number} dist The distance in pixels that the turtle is
     * to go.
     * @return {Turtle} The class itself.
     */
    west(dist){
        return this.to(this.x - dist, this.y);
    }
    
    /**
     * Moves the turtle east by a specified amount.
     * @param {Number} dist The distance in pixels that the turtle is
     * to go.
     * @return {Turtle} The class itself.
     */
    east(dist){
        return this.to(this.x + dist, this.y);
    }
    
    /**
     * Sets the font style for the turtle's canvas.
     * @param {String} font The font for the canvas.
     * @return {Turtle} The class itself.
     */
    font(str){
        this.ctx.font = str;
        return this;
    }
    
    /**
     * Draws text starting at the turtle's coordinates.
     * @param {String} str The string to draw to the canvas.
     * @return {Turtle} The class itself.
     */
    text(str){
        this.ctx.fillText(str, this.x, this.y);
        return this;
    }
    
    /**
     * The width of the turtle's canvas.
     */
    get width(){
        return this.canvas.width;
    }
    
    /**
     * The height of the turtle's canvas.
     */
    get height(){
        return this.canvas.height;
    }
    
    /**
     * Converts a given amount of degrees into radians.
     * @param {Number} deg The said amount.
     */
    static toRad(deg){
        return deg * Math.PI / 180.0;
    }
}