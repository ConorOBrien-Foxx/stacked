var isNode = typeof require !== "undefined";

class AutomataRule {
    // born, survive, display, options
    // display: [deadNumeric, liveNumeric, deadString, liveString]
    // options: ...
    constructor(born, survive, display, options){
        this.born = born.map(Number);
        this.survive = survive.map(Number);
        this.display = {
            deadNumeric: display[0] || 0,
            liveNumeric: display[1] || 1,
            deadString:  display[2] || " ",
            liveString:  display[3] || "#",
        };
    }
    
    repr(){
        return "B" + this.born.join("") + "/S" + this.survive.join("");
    }
    
    toString(){
        return "AutomataRule [ " + this.repr() + " ]";
    }
}

class CellularAutomata {
    constructor(grid, rules, options){
        if(!isArray(rules))
            rules = [rules];
        
        if(!rules.every(e => e instanceof AutomataRule))
            error("expected an array of `AutomataRule`s");
        
        this.rules = rules;
        let isStr = isString(grid);
        this.grid = surround(fixShape(isStr ? gridify(grid) : grid), isStr ? " " : 0);
        // todo: make better
        this.options = options ? options.split(" ") : [];
        this.type = isStr ? "String" : "Numeric";
    }
    
    getCell(x, y){
        return isDefined(this.grid[y]) && isDefined(this.grid[y][x]) ?
            this.grid[y][x] : null;
    }
    
    isLive(rule, x, y){
        return this.getCell(x, y) === rule.display["live" + this.type];
    }
    
    repr(){
        return ungridify(this.grid);
    }
    
    step(){
        let next = this.grid.clone();
        let height = this.grid.length;
        let width = this.grid[0].length;
        
        for(let i = 0; i < height; i++){
            for(let j = 0; j < width; j++){
                // todo: make it more like VGoL
                for(let rule of this.rules){
                    let live = rule.display["live" + this.type];
                    let dead = rule.display["dead" + this.type];
                    
                    let amt = 0;
                    
                    if(this.isLive(rule, j - 1, i - 1)) amt++;
                    if(this.isLive(rule, j - 1, i    )) amt++;
                    if(this.isLive(rule, j - 1, i + 1)) amt++;
                    if(this.isLive(rule, j    , i - 1)) amt++;
                    if(this.isLive(rule, j    , i + 1)) amt++;
                    if(this.isLive(rule, j + 1, i - 1)) amt++;
                    if(this.isLive(rule, j + 1, i    )) amt++;
                    if(this.isLive(rule, j + 1, i + 1)) amt++;
                    
                    if(this.isLive(rule, j, i)){
                        next[i][j] = rule.survive.has(amt) ? live : dead;
                    } else {
                        next[i][j] = rule.born.has(amt) ? live : dead;
                    }
                }
            }
        }
        this.grid = next.clone();
        return this;
    }
    
    toString(){
        let res = "CellularAutomata [ ("
            + this.rules.join(" ")
            + ") ; ("
            + this.options.join(" ") + ")\n";
        let r = this.repr().split("\n");
        let hstrut = " +" + "-".repeat(r[0].length) + "+\n"
        res += hstrut;
        for(let i = 0; i < r.length; i++){
            res += " |" + r[i] + "|\n";
        }
        res += hstrut;
        res += "]";
        return res;
    }
    
    static Conway(){
        return new AutomataRule([3], [2, 3], [0, 1, " ", "#"], "");
    }
}
CellularAutomata.AutomataRule = AutomataRule;

if(isNode){
    module.exports = exports.default = CellularAutomata;
}