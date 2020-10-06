class StackedMap {
    constructor(mapLike = [], comp = equal) {
        this.data = [];
        this.comp = comp;
        for(let [key, val] of mapLike) {
            this.set(key, val);
        }
    }
    
    set(key, val) {
        this.data.push([key, val]);
        return this;
    }
    
    has(search) {
        return !!this.data.find(([key, val]) => this.comp(key, search));
    }
    
    keys() {
        return this.data.map(kvp => kvp[0]);
    }
    
    values() {
        return this.data.map(kvp => kvp[1]);
    }
    
    entries() {
        return [...this];
    }
    
    get(search) {
        let res = this.data.find(([key, val]) => this.comp(key, search));
        if(!res) {
            return new Nil;
        }
        else {
            return res[1];
        }
    }
    
    get length() {
        return this.data.length;
    }
    
    *[Symbol.iterator] () {
        yield* this.data;
    }
    
    toString() {
        if(this.length === 0) {
            return "{ }";
        }
        let build = "{ ";
        let strEntries = [];
        for(let [key, value] of this) {
            strEntries.push(key.toString() + " -> " + value.toString());
        }
        build += strEntries.join(", ");
        build += " }";
        return build;
    }
    
    repr() {
        if(this.length === 0) {
            return "(:)";
        }
        let build = "(: ";
        let strEntries = [];
        for(let [key, value] of this) {
            strEntries.push(repr(key) + " " + repr(value));
        }
        build += strEntries.join("  ");
        build += " )";
        return build;
    }
}