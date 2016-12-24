class AutomataRule {
    constructor(born, survive){
        this.born = born.map(Number);
        this.survive = survive.map(Number);
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
        if(!(rules instanceof Array))
            rules = [rules];
        
        if(!rules.every(e => e instanceof AutomataRule))
            error("expected an array of `AutomataRule`s");
        
        this.rules = rules;
        this.grid  = grid;
        this.options = options ? options.split(" ") : [];
    }
    
    toString(){
        return "(" + this.rules.join(" ") + ")";
    }
    
    static Conway(){
        return new AutomataRule([2], [2, 3]);
    }
}