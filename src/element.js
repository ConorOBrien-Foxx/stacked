let isNode = typeof require !== "undefined";

if(isNode)
	var Decimal = require("./decimal.js");

class Element {
    constructor(atomic, sym, name, weight,
                group, period, block, econf){
        this.atomic = Decimal(atomic);
        this.sym = sym;
        this.name = name;
        this.weight = Decimal(weight);
        this.group = group;
        this.period = period;
        this.block = block;
        this.econf = econf;
        Element.pnametable.set(name, this);
        Element.ptable.set(sym, this);
    }
    
    stats(){
        return [this.atomic, this.sym, this.name, this.weight];
    }
    
    allStats(){
        return [this.atomic, this.sym, this.name, this.weight, this.group, this.period, this.block, this.econf];
    }
    
    extEconf(){
        return this.econf.replace(/\[(.+?)\]/g, (_, e) => Element.ptable.get(e).econf + " ");
    }
    
    repr(){
        return repr(this.allStats()) + " Element";
    }
    
    toString(){
        let slen = Math.max(
            this.atomic.toString().length,
            this.weight.toString().length,
            this.sym.length,
            this.name.length
        ) + 2;
        let strut = "-".repeat(slen + 2);
        return ["+" + strut + "+",
            [this.atomic, this.sym, this.name, this.weight].map(e =>
                "| " + e + " ".repeat(slen - e.toString().length) + " |"
            ).join("\n"),
            "+" + strut + "+"].join("\n");
    }
}

Element.ptable = new Map([]);
Element.pnametable = new Map([]);

const HYDROGEN   = new Element(1, "H", "Hydrogen", "1.00794",
                               1, 1, "s", "1s^1");
const HELIUM     = new Element(2, "He", "Helium", "4.00260",
                               18, 1, "s", "1s^2");
const LITHIUM    = new Element(3, "Li", "Lithium", "6.941",
                               1, 2, "s", "[He]2s^1");
const BERYLIUM   = new Element(4, "Be", "Berylium", "9.012182",
                               2, 2, "s", "[He]2s^2");
const BORON      = new Element(5, "B", "Boron", "10.811",
                               13, 2, "p", "[He]2s^2 2p^1");
const CARBON     = new Element(6, "C", "Carbon", "12.0107",
                               14, 2, "p", "[He]2s^2 2p^2");
const NITROGEN   = new Element(7, "N", "Nitrogen", "14.0067",
                               15, 2, "p", "[He]2s^2 2p^3");
const OXYGEN     = new Element(8, "O", "Oxygen", "15.9994",
                               16, 2, "p", "[He]2s^2 2p^4");
const FLUORINE   = new Element(9, "F", "Fluorine", "18.99840",
                               17, 2, "p", "[He]2s^2 2p^5");
const NEON       = new Element(10, "Ne", "Neon", "20.1797",
                               18, 2, "p", "[He]2s^2 2p^6");
const SODIUM     = new Element(11, "Na", "Sodium", "22.989770",
                               1, 3, "s", "[Ne]3s^1");
const MAGNESIUM  = new Element(12, "Mg", "Magnesium", "24.3050",
                               2, 3, "s", "[Ne]3s^2");
const ALUMINUM   = new Element(13, "Al", "Aluminum", "26.981538",
                               13, 3, "p", "[Ne]3s^2 3p^1");
const SILICON    = new Element(14, "Si", "Silicon", "28.0855",
                               14, 3, "p", "[Ne]3s^2 3p^2");
const PHOSPHORUS = new Element(15, "P", "Phosphorus", "30.97376",
                               15, 3, "p", "[Ne]3s^2 3p^3");
const SULFUR     = new Element(16, "S", "Sulfur", "32.065",
                               16, 3, "p", "[Ne]3s^2 3p^4");
const CHLORINE   = new Element(17, "Cl", "Chlorine", "35.453",
                               17, 3, "p", "[Ne]3s^2 3p^5");
const ARGON      = new Element(18, "Ar", "Argon", "39.948",
                               18, 3, "p", "[Ne]3s^2 3p^6");
const POTASSIUM  = new Element(19, "K", "Potassium", "39.0983",
                               1, 4, "s", "[Ar]4s^1");
const CALCIUM    = new Element(20, "Ca", "Calcium", "40.078",
                               2, 4, "s", "[Ar]4s^2");
const SCANDIUM   = new Element(21, "Sc", "Scandium", "44.95591",
                               3, 4, "d", "[Ar]3d^1 4s^2");

// todo: add more
// todo: add ptable disp

if(isNode)
    module.exports = exports.default = Element;