var isNode = typeof require !== "undefined";

if(isNode){
	Color = require("./color.js");
}

/**
 * @description
 * THE HUMICON FORMAT
 * ==================
 * The purpose of this format is provide a human-readable and human-writeable format
 * for images. It's goal is not efficiency but readability and processability; this
 * is not to say, however, it is always readable and inefficient. Since it is true
 * that writeability is subjective, there are different modes for writing a humicon
 * file.
 * 
 * Description of Format
 * ---------------------
 * The humicon format is signified by a `.hic` extension. The actual file is structured
 * generally as such:
 * 
 *     <type>
 *     <1,1><1,2><1,3>...<1,N>
 *     <2,1><2,2><2,3>...<2,N>
 *      ...
 *     <M,1><M,2><M,3>...<M,N>
 * 
 * This represents an M by N image. The type directly influences the image parsing.
 * The following values are allowed for `type`:
 *
 *   - `bw`. This is a black and white bitmap. Each entry is a `1` (black) or `0`
 *     (white).
 *   - `bw:NK`. Here, `NK` are two distinct characters. Each entry is either `N`
 *     (black) or `K` (white).
 *   - `8bit`. Each row would look like: `R0 G0 B0;R1 G1 B1;...;RN GN BN`, with 
 *     each entry being a number, with the following conditions:
 *       1. 0 <= R < 8
 *       2. 0 <= G < 8
 *       3. 0 <= B < 4
 *   - `C8bit`. Similar to `8bit`, but uses a compressed scheme. Each cell is a
 *     single byte. For example, the row `A[1Q*~!` is equivalent to:
 *         2 0 1;2 6 3;1 4 1;2 4 1;1 2 2;3 7 2;1 0 1
 *   - <more to come>
 *
 * If no type can be identified, the type is assumed to be null.
 */

/** Class representing an awesome icon. */
class Icon {
    /**
     * Creates an icon from an RGB array.
     * @type {Array.<Array.<Number>>}
     * @param {Array.<Array.<Number>>} rgbArray An array of RGB triplets.
     */
    constructor(rgbArray){
        this.array = array.map(row => row.map(cell => new Color(cell)));
    }
    
    writeToCanvas(canvas){
        
    }
    
    /**
     * Parses a humicon data string into an icon.
     * @param {String} A valid humicon string.
     * @return {Icon} An icon representing this string.
     */
    static parseHIC(str){
        let lines = str.split("\n");
        // parse out the type
        let type = lines.shift();
        let bwMatch = type.match(/^bw(?::(.)(.))?/i);
        let res = [];
        let build = [];
        let readChunk;  // function to read the information for a pixel
        let toRGB;      // function to convert the chunk to RGB
        if(bwMatch){
            bwMatch.shift();
            let [black, white] = bwMatch.map((e, i) => e || i.toString());
            readChunk = (line) => [line.shift(), line];
            toRGB = (chunk) => {
                if(chunk !== white && chunk !== black){
                    throw new Error("Expected `" + white + "` or `" + black + "`, got `" + chunk + "`");
                }
                return [0, 0, 0].fill(255 * (chunk === white));
            }
        } else {
            throw new Error("Nope.");
        }
        while(lines.length){
            let line = [...lines.shift()];
            while(line.length){                
                let chunk;
                [chunk, line] = readChunk(line);
                let triplet = toRGB(chunk);
                build.push(triplet);
            }
            res.push(build);
            build = [];
        }
        return res;
    }
}

if(isNode)
    module.exports = exports.default = Icon;