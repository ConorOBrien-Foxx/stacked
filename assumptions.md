To use the JavaScript files in this repository, you must include it in a webpage. You must also have the following on your page, in this order:

```html
<script src="decimal.js"></script>
<script src="color.js"></script>
<script src="element.js"></script>
<script src="pen.min.js"></script>
<script src="funcs.js"></script>
<script src="stacked.js"></script>
```

Sources:
 1. [Decimal.js](https://github.com/MikeMcl/decimal.js/)
 2. Color.js--included.
 3. Element.js--included.
 4. [pen.min.js](https://github.com/davebalmer/turtlewax)
 5. Funcs.js--included.
 6. Stacked.js--included.

Calling `stacked("code")` returns the stacked instance. You can use `stacked("code").stack` to obtain the stack, and then use `pp` to observe its contents in a human-readable way.

You must have a canvas on the page with an id of `canvas` if you want pen.js to work.

The following JS is used to initialize `pen.js` (subject to change) and various interactive elements concerning the language:

```javascript
let encountered = new Map([]);
// vars.set("canvas", document.getElementById("canvas"));
let pen = new Pen(canvas);
let ctx = canvas.getContext("2d");
let props = Object.getOwnPropertyNames(Pen.prototype);
pen.font("20px Consolas");
props.forEach(k => {
    let name = k;
    if(ops.has(k)){
        console.log("`" + k + "` name conflict; renaming to `pen" + k + "`");
        name = "pen" + k;
    }
    ops.set(name, function(){
        let args = this.stack.splice(-pen[k].length).map(e => e instanceof Decimal ? +e : e);
        pen[k](...args);
    });
});
ops.set("back", function(){
    let k = this.stack.pop();
    assureTyped(k, Decimal);
    pen.back(+k);
    pen.stroke();
});
ops.set("width", func(() => Decimal(pen.tag.width)));
ops.set("height", func(() => Decimal(pen.tag.height)));
ops.set("snap", function(){
    let arr = this.stack.pop();
    if(typeof arr === "string"){
        arr = arr.split(" ");
    } else if(!(k instanceof Array)){
        arr = [arr];
    }
    for(let k of arr){
        if(k === "left" || k === 0){
            pen.jump(0, pen.y);
        } else if(k === "bottom" || k === 1){
            pen.jump(pen.x, pen.tag.height);
        }
    }
});
const getPixel = (x, y) =>
    new Color(pen.canvas.getImageData(x, y, 1, 1).data);

let globalPicId = pen.canvas.createImageData(1, 1);
let globalD = globalPicId.data;

const setPixel = (x, y, c) => {
    c = [...c];
    for(let i = 0; i < 4; i++){
        globalD[i] = c[i];
    }
    pen.canvas.putImageData(globalPicId, x, y);
}

const floodFill = (x, y, tcol, rcol) => {
    if(tcol.equal(rcol)) return;
    if(!getPixel(x, y).equal(tcol)) return;
    setPixel(x, y, rcol);
    floodFill(x, y + 1, tcol, rcol);
    floodFill(x + 1, y, tcol, rcol);
    floodFill(x, y - 1, tcol, rcol);
    floodFill(x - 1, y, tcol, rcol);
};
ops.set("setpixel", typedFunc([
    [[Decimal, Decimal, Color], setPixel]
], 3));
ops.set("fill", typedFunc([
    [[Decimal, Decimal, Color], (x, y, c) => floodFill(x, y, getPixel(x, y), c)],
], 3));
ops.set("reset", function(){
    pen.tag.getContext("2d").clearRect(0, 0, pen.tag.width, pen.tag.height);
    pen.jump(pen.tag.width / 2, pen.tag.height / 2);
    pen.angle(90);
});
ops.set("setwidth", function(){
    pen.tag.width = +this.stack.pop();
});
ops.set("setheight", function(){
    pen.tag.height = +this.stack.pop();
});
ops.set("setbg", typedFunc([
    [[Color], (c) => {
        ctx.fillStyle = c.toString();
        ctx.fillRect(0, 0, pen.tag.width, pen.tag.height);
    }]
], 1));
ops.get("reset")();
bootstrap("[neg turn] @:tleft");
bootstrap("[turn] @:tright");
bootstrap("[go stroke] @:forth");
bootstrap("[:setwidth setheight reset] @:squaredim");
bootstrap("['#CCC' penstyle stdfg setbg] @:initpen")
vars.set("stdbg", new Color(34));
vars.set("stdfg", new Color(51));
const highlight = (prog) =>
    tokenize(prog, true).map(e => "<span class=\"" + e.type + "\">" + e.raw + "</span>").join("");

const before = () => {
    pen.penstyle("#CCCCCC");
    pen.fillstyle("#CCCCCC");
    if(document && document.getElementById("stacked-output")){
        document.getElementById("stacked-output").innerHTML = "";
    }
    let c = code.value;
    let res = encountered.has(c) ? encountered.get(c) : Decimal(0);
    vars.set("execCounter", res);
    encountered.set(c, res.add(1));
}

run.addEventListener("click", function(e){
    before();
    stacked(code.value);
});
runSlow.addEventListener("click", function(e){
    before();
    stacked(code.value, true);
});
stylize.addEventListener("click", function(e){
    document.getElementById("stacked-output").innerHTML = highlight(code.value);
});
```