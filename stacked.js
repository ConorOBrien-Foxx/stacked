const stacked = require("./src/stacked.js");
const fs = require("fs");

if(require.main === module){
    let args = require("minimist")(process.argv.slice(2));
    if(args.e){
        stacked(args.e);
    } else {
        let fileName = args.f ? args.f : args._.shift();
        let prog = fs.readFileSync(fileName).toString();
        stacked(prog);
    }
}

module.exports = stacked;